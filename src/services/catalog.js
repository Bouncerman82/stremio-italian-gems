import { config } from '../config.js';
import {
  mergeGenreIds,
  parseIntervalSeconds,
  parseYear,
  parseOriginCountry,
  resolveGenreIds,
  resolveMoodGenreIds,
  wantsPopolari,
  isPopolariGenre,
  isTop100Genre,
  countryBadge,
  yearOptions,
} from '../lib/filters.js';
import { buildCountTileDescription } from '../lib/copy.js';
import { toStremioMeta } from '../lib/meta.js';
import { hashString, seededMapIndex } from '../lib/shuffle.js';
import { customPosterUrlForItem } from '../posters/renderer.js';
import { DAY_SECONDS, cacheGet, cacheSet } from './cache.js';
import {
  attachImdbIds,
  buildDiscoverParams,
  discoverPage,
  discoverPopularRecent,
  discoverTop100,
  discoverProbe,
  TMDB_DISCOVER_PAGE_SIZE,
} from './tmdb.js';

const PAGE_SIZE = Number(process.env.CATALOG_PAGE_SIZE || 30);
const COUNT_TILE_SLOTS = 1;
const FETCH_CONCURRENCY = config.tmdbConcurrency;
/** Cache probe per-anno (shuffle full-DB). */
const YEAR_PROBE_TTL_MS = Number(process.env.YEAR_PROBE_TTL_MS || 6 * 3600 * 1000);
/** Anni distinti per pagina catalogo (più anni = più lento). */
const YEARS_PER_PAGE = Number(process.env.YEARS_PER_PAGE || 3);
/** Pagine TMDB per anno (20 titoli/pagina). */
const PAGES_PER_YEAR = Number(process.env.PAGES_PER_YEAR || 2);

async function mapPool(items, concurrency, fn) {
  const out = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const idx = cursor++;
      out[idx] = await fn(items[idx], idx);
    }
  }
  const n = Math.min(concurrency, Math.max(items.length, 1));
  await Promise.all(Array.from({ length: n }, () => worker()));
  return out;
}

function parseSkip(extra = {}) {
  const n = Number(extra.skip || 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function yearList() {
  return yearOptions()
    .filter((y) => /^\d{4}$/.test(String(y)))
    .map(Number)
    .sort((a, b) => b - a);
}

function describeActiveFilters(extra = {}, { popularRecent, top100, genreIds }) {
  const parts = [];
  if (top100) parts.push('Top 100 · voto 6,5+');
  else if (popularRecent) parts.push('Popolari ultimi 2 mesi');
  else if (
    extra.genre &&
    !String(extra.genre).startsWith('Tutti') &&
    !isPopolariGenre(extra.genre) &&
    !isTop100Genre(extra.genre)
  ) {
    parts.push(`Genere: ${extra.genre}`);
  } else {
    parts.push('Tutti i generi');
  }
  if (extra.mood && !String(extra.mood).startsWith('Tutti')) {
    parts.push(`Mood: ${extra.mood}`);
  }
  if (extra.anno && !String(extra.anno).startsWith('Tutti')) {
    parts.push(`Anno: ${extra.anno}`);
  }
  if (extra.paese && !String(extra.paese).startsWith('Tutti')) {
    parts.push(`Paese: ${extra.paese}`);
  }
  return parts.join(' · ');
}

function shuffleSeed({ dataKey, intervalSec }) {
  // intervalSec=0 → nuovo ordine a ogni richiesta (ogni apertura catalogo)
  const bucket =
    intervalSec > 0
      ? Math.floor(Date.now() / 1000 / intervalSec)
      : Date.now();
  return {
    seed: hashString(`${dataKey}|shuf|${bucket}|${intervalSec}`),
    bucket,
  };
}

function orderBySeed(items, seed) {
  return [...items].sort((a, b) => {
    const ha = seededMapIndex(a.id, 1_000_000_007, seed);
    const hb = seededMapIndex(b.id, 1_000_000_007, seed);
    return ha - hb;
  });
}

/** Blocchi descrizione → src/lib/copy.js */

/**
 * Prima tile: totale TMDB + spiega la logica della modalità attiva.
 */
export function makeCountMeta({
  total,
  poolSize,
  type,
  filterLabel,
  intervalSec = 30,
  bucket,
  pageSize = PAGE_SIZE,
  mode = 'content-pool',
}) {
  const kind = type === 'series' ? 'serie' : 'film';
  const id = `igems:count:${kind}`;
  const totalLabel = Number(total || 0).toLocaleString('it-IT');
  const poolLabel = Number(poolSize || 0).toLocaleString('it-IT');

  const description = buildCountTileDescription({
    kind,
    totalLabel,
    poolLabel,
    mode,
    intervalSec,
    bucket,
    pageSize,
    filterLabel,
  });


  const releaseInfo =
    mode === 'top100-shuffle'
      ? `Top 100 · voto 6,5+ · validi 24h`
      : mode === 'popular-shuffle'
        ? `Ultimi 2 mesi · finestra scorrevole`
        : `${totalLabel} trovati · shuffle su tutto il catalogo`;

  return {
    id,
    type,
    name:
      mode === 'top100-shuffle'
        ? `▣ Top 100 ${kind} · voto 6,5+`
        : mode === 'popular-shuffle'
          ? `▣ Popolari ${kind} · ultimi 2 mesi`
          : `▣ ${totalLabel} ${kind} · shuffle totale`,
    poster: `${config.publicBaseUrl}/logo-v30.png`,
    posterShape: 'square',
    description,
    releaseInfo,
  };
}

async function loadPopularWindow({
  mediaType,
  genreIds,
  originCountry,
  intervalSec,
  realSkip,
  limit,
  cacheKey,
}) {
  // Aggiornamento giornaliero: la finestra “ultimi 2 mesi” scorre coi giorni
  const day = new Date().toISOString().slice(0, 10);
  const dayKey = `${cacheKey}:d${day}`;
  let items = cacheGet(dayKey);
  let rebuilt = false;
  if (!items) {
    items = await discoverPopularRecent(mediaType, genreIds, originCountry);
    cacheSet(dayKey, items, DAY_SECONDS);
    rebuilt = true;
  }
  const { seed } = shuffleSeed({ dataKey: dayKey, intervalSec });
  const ordered = orderBySeed(items, seed);
  return {
    items: ordered.slice(realSkip, realSkip + limit),
    totalResults: items.length,
    poolSize: items.length,
    poolCached: !rebuilt,
    mode: 'popular-shuffle',
  };
}

/**
 * Top 100: lista ricostruita ogni giorno; shuffle solo su questi ≤100 titoli.
 */
async function loadTop100Window({
  mediaType,
  genreIds,
  originCountry,
  intervalSec,
  realSkip,
  limit,
  cacheKey,
}) {
  const day = new Date().toISOString().slice(0, 10);
  const dayKey = `${cacheKey}:d${day}`;
  let items = cacheGet(dayKey);
  let rebuilt = false;
  if (!items) {
    items = await discoverTop100(mediaType, genreIds, originCountry);
    cacheSet(dayKey, items, DAY_SECONDS);
    rebuilt = true;
  }
  const { seed } = shuffleSeed({ dataKey: dayKey, intervalSec });
  const ordered = orderBySeed(items, seed);
  return {
    items: ordered.slice(realSkip, realSkip + limit),
    totalResults: items.length,
    poolSize: items.length,
    poolCached: !rebuilt,
    mode: 'top100-shuffle',
  };
}

async function probeYearDiscover(mediaType, genreIds, originCountry, year) {
  const cacheKey = `yprobe:v1:${mediaType}:g${(genreIds || []).join('-') || 'any'}:c${originCountry || 'any'}:y${year}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;
  const discover = buildDiscoverParams({
    mediaType,
    genreIds,
    year,
    originCountry,
  });
  const probe = await discoverProbe(discover, { maxAgeMs: YEAR_PROBE_TTL_MS });
  const packed = {
    discover,
    accessible: Math.max(1, probe.accessible || TMDB_DISCOVER_PAGE_SIZE),
    totalPages: Math.max(1, probe.totalPages || 1),
  };
  cacheSet(cacheKey, packed, Math.floor(YEAR_PROBE_TTL_MS / 1000));
  return packed;
}

/**
 * Shuffle su tutto il catalogo TMDB, ma con poche richieste HTTP.
 * Strategia: per ogni pagina Stremio si scelgono pochi anni (seed),
 * da ciascuno 1–2 pagine Discover intere → varietà sul DB senza
 * 50 probe/fetch sparse (che rendevano tutto lentissimo).
 */
async function loadFullDbShuffleWindow({
  baseDiscover,
  genreIds,
  year,
  originCountry,
  seed,
  realSkip,
  limit,
}) {
  const mediaType = baseDiscover.mediaType === 'tv' ? 'tv' : 'movie';
  const probe = await discoverProbe(baseDiscover, {
    maxAgeMs: config.tmdbProbeMaxAgeMs,
  });
  const liveTotal = probe.totalResults || 0;
  const pageBucket = Math.floor(realSkip / Math.max(limit, 1));

  async function fillFromPack(pack, salt, want) {
    const pagesWant = Math.min(
      PAGES_PER_YEAR,
      Math.max(1, Math.ceil(want / TMDB_DISCOVER_PAGE_SIZE)),
      pack.totalPages
    );
    const pageSet = new Set();
    for (let i = 0; pageSet.size < pagesWant && i < pagesWant * 6; i++) {
      pageSet.add(seededMapIndex(i, pack.totalPages, `${seed}:${salt}:pg`) + 1);
    }
    const pages = await mapPool([...pageSet], FETCH_CONCURRENCY, (p) =>
      discoverPage(pack.discover, p)
    );
    const items = [];
    const seen = new Set();
    for (const rows of pages) {
      for (const row of rows || []) {
        if (!row?.id || seen.has(row.id)) continue;
        seen.add(row.id);
        items.push(row);
      }
    }
    // Ordine stabile pseudo-casuale entro il pacchetto
    return orderBySeed(items, `${seed}:${salt}`).slice(0, want);
  }

  if (year) {
    const pack = {
      discover: baseDiscover,
      accessible: Math.max(1, probe.accessible || TMDB_DISCOVER_PAGE_SIZE),
      totalPages: Math.max(1, probe.totalPages || 1),
    };
    const items = await fillFromPack(pack, `y${year}:b${pageBucket}`, limit);
    return {
      items,
      totalResults: liveTotal,
      poolSize: liveTotal,
      poolCached: false,
      mode: 'full-db-shuffle',
    };
  }

  const years = yearList();
  const yearCount = Math.min(YEARS_PER_PAGE, years.length);
  const pickedYears = [];
  const usedY = new Set();
  for (let i = 0; pickedYears.length < yearCount && i < yearCount * 8; i++) {
    const y =
      years[seededMapIndex(pageBucket * 17 + i, years.length, `${seed}:yr`)] ||
      years[0];
    if (usedY.has(y)) continue;
    usedY.add(y);
    pickedYears.push(y);
  }

  const yearPacks = await mapPool(pickedYears, FETCH_CONCURRENCY, async (y) => ({
    y,
    pack: await probeYearDiscover(mediaType, genreIds, originCountry, y),
  }));

  // Oversample: alcuni titoli non hanno IMDb
  const perYear = Math.ceil((limit * 1.4) / Math.max(pickedYears.length, 1));
  const chunks = await mapPool(yearPacks, FETCH_CONCURRENCY, async ({ y, pack }) =>
    fillFromPack(pack, `y${y}:b${pageBucket}`, perYear)
  );

  const seen = new Set();
  const merged = [];
  for (const chunk of chunks) {
    for (const it of chunk) {
      if (!it?.id || seen.has(it.id)) continue;
      seen.add(it.id);
      merged.push(it);
    }
  }

  const items = orderBySeed(merged, `${seed}:merge:${pageBucket}`).slice(
    0,
    Math.ceil(limit * 1.35)
  );

  return {
    items,
    totalResults: liveTotal,
    poolSize: liveTotal,
    poolCached: false,
    mode: 'full-db-shuffle',
  };
}

export async function buildCatalog({ type, id, extra = {} }) {
  const isSeries = id === 'gemme_serie' || type === 'series';
  const mediaType = isSeries ? 'tv' : 'movie';
  const stremioType = isSeries ? 'series' : 'movie';

  if (
    (id === 'gemme_film' && type !== 'movie') ||
    (id === 'gemme_serie' && type !== 'series')
  ) {
    return { metas: [], totalItems: 0, skip: 0 };
  }

  const intervalSec = parseIntervalSeconds(extra.intervallo, 0);
  const skip = parseSkip(extra);
  const year = parseYear(extra.anno);
  const originCountry = parseOriginCountry(extra.paese);
  const popularRecent =
    wantsPopolari(extra.popolari) || isPopolariGenre(extra.genre);
  const top100 = !popularRecent && isTop100Genre(extra.genre);
  const genreIds = mergeGenreIds(
    resolveGenreIds(stremioType, extra.genre),
    resolveMoodGenreIds(extra.mood, stremioType)
  );

  let includeCountTile = false;
  let realSkip = skip;
  let limit = PAGE_SIZE;
  if (skip === 0) {
    includeCountTile = true;
    realSkip = 0;
    limit = PAGE_SIZE - COUNT_TILE_SLOTS;
  } else {
    realSkip = Math.max(0, skip - COUNT_TILE_SLOTS);
    limit = PAGE_SIZE;
  }

  const filterLabel = describeActiveFilters(extra, {
    popularRecent,
    top100,
    genreIds,
  });
  const dataKey = [
    mediaType,
    top100 ? 'top100' : popularRecent ? 'pop' : 'all',
    `g:${(genreIds || []).join('-') || 'any'}`,
    `y:${year || 'any'}`,
    `m:${extra.mood || 'any'}`,
    `c:${originCountry || 'any'}`,
  ].join(':');

  const { seed, bucket } = shuffleSeed({ dataKey, intervalSec });

  let window;
  let liveTotal = null;
  if (top100) {
    window = await loadTop100Window({
      mediaType,
      genreIds,
      originCountry,
      intervalSec,
      realSkip,
      limit,
      cacheKey: `top100:v65:${dataKey}`,
    });
    liveTotal = window.totalResults;
  } else if (popularRecent) {
    window = await loadPopularWindow({
      mediaType,
      genreIds,
      originCountry,
      intervalSec,
      realSkip,
      limit,
      cacheKey: `pop:${dataKey}`,
    });
    liveTotal = window.totalResults;
  } else {
    const baseDiscover = buildDiscoverParams({
      mediaType: mediaType === 'tv' ? 'tv' : 'movie',
      genreIds,
      year,
      originCountry,
    });
    window = await loadFullDbShuffleWindow({
      baseDiscover,
      genreIds,
      year,
      originCountry,
      seed,
      realSkip,
      limit,
    });
    liveTotal = window.totalResults;
  }

  let slice = window.items || [];
  slice = await attachImdbIds(
    slice,
    mediaType === 'tv' ? 'tv' : 'movie',
    Math.min(8, Math.max(4, config.tmdbConcurrency || 4))
  );

  const metas = slice
    .map((item) =>
      toStremioMeta(item, {
        mediaType: stremioType,
        customPosterUrl: customPosterUrlForItem(item),
      })
    )
    .filter(Boolean)
    .slice(0, limit);

  const totalItems = liveTotal ?? window.totalResults ?? 0;
  const poolSize = window.poolSize || 0;

  if (includeCountTile) {
    metas.unshift(
      makeCountMeta({
        total: totalItems,
        poolSize,
        type: stremioType,
        filterLabel,
        intervalSec,
        bucket,
        mode: window.mode,
      })
    );
  }

  // Cache allineata: 0 = non trattenere il mix (nuovo a ogni apertura)
  const cacheMaxAge =
    intervalSec > 0 ? Math.max(60, Math.min(intervalSec, 3600)) : 1;

  return {
    metas,
    totalItems,
    poolSize,
    poolCached: !!window.poolCached,
    skip,
    includeCountTile,
    shuffleOn: true,
    mode: window.mode,
    intervalSec,
    shuffleBucket: bucket,
    cacheMaxAge,
  };
}

export { countryBadge };
