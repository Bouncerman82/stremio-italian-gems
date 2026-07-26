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
  TMDB_DISCOVER_MAX_PAGE,
  TMDB_DISCOVER_MAX_RESULTS,
  TMDB_DISCOVER_PAGE_SIZE,
} from './tmdb.js';

const PAGE_SIZE = Number(process.env.CATALOG_PAGE_SIZE || 50);
const COUNT_TILE_SLOTS = 1;
const FETCH_CONCURRENCY = config.tmdbConcurrency;
/** Cache probe per-anno (shuffle full-DB). */
const YEAR_PROBE_TTL_MS = Number(process.env.YEAR_PROBE_TTL_MS || 6 * 3600 * 1000);

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

/** Indici catalogo → indici pseudo-casuali unici nello spazio [0, universe). */
function uniqueUniverseIndices(realSkip, limit, universe, seed) {
  const n = Math.max(1, universe);
  const out = [];
  const used = new Set();
  const maxAttempts = Math.max(limit * 12, 48);
  for (let i = 0; out.length < limit && i < maxAttempts; i++) {
    let idx = seededMapIndex(realSkip + i, n, seed);
    let guard = 0;
    while (used.has(idx) && guard < 64) {
      idx = (idx + 1 + seededMapIndex(realSkip + i, n, `${seed}:g${guard}`)) % n;
      guard++;
    }
    if (used.has(idx)) continue;
    used.add(idx);
    out.push({ idx, order: out.length });
  }
  return out;
}

async function itemsFromDiscoverPages(discover, picks) {
  // picks: [{ page, offset, order }] → [{ order, item }]
  const byPage = new Map();
  for (const p of picks) {
    if (!byPage.has(p.page)) byPage.set(p.page, []);
    byPage.get(p.page).push(p);
  }
  const pageNums = [...byPage.keys()];
  const pages = await mapPool(pageNums, FETCH_CONCURRENCY, (page) =>
    discoverPage(discover, page)
  );
  const pageMap = new Map(pageNums.map((p, i) => [p, pages[i] || []]));
  const out = [];
  for (const p of picks) {
    const row = pageMap.get(p.page)?.[p.offset];
    if (row) out.push({ order: p.order, item: row });
  }
  return out;
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
 * Shuffle su TUTTO lo spazio TMDB dei filtri (non un campione fisso).
 * Carica solo le pagine necessarie per la finestra Stremio corrente.
 * Senza anno: sharding per anno per superare il tetto TMDB da 10k.
 * In catalogo restano solo titoli con ID IMDb (attachImdbIds + toStremioMeta).
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

  // Con anno filtrato: shuffle su tutte le pagine accessibili di quell’anno (max 10k TMDB)
  if (year) {
    const universe = Math.max(
      1,
      probe.accessible ||
        Math.min(liveTotal, TMDB_DISCOVER_MAX_RESULTS) ||
        TMDB_DISCOVER_PAGE_SIZE
    );
    const mapped = uniqueUniverseIndices(realSkip, limit, universe, seed);
    const picks = mapped.map(({ idx, order }) => ({
      page: Math.min(
        TMDB_DISCOVER_MAX_PAGE,
        Math.floor(idx / TMDB_DISCOVER_PAGE_SIZE) + 1
      ),
      offset: idx % TMDB_DISCOVER_PAGE_SIZE,
      order,
    }));
    const rows = await itemsFromDiscoverPages(baseDiscover, picks);
    const items = rows
      .sort((a, b) => a.order - b.order)
      .map((r) => r.item);
    return {
      items,
      totalResults: liveTotal,
      poolSize: liveTotal,
      poolCached: false,
      mode: 'full-db-shuffle',
    };
  }

  // Nessun anno: universo virtuale = anni × fino a 10k/anno (oltre il tetto Discover)
  const years = yearList();
  const virtualPerYear = TMDB_DISCOVER_MAX_RESULTS;
  const universe = Math.max(1, years.length * virtualPerYear);
  const mapped = uniqueUniverseIndices(realSkip, limit, universe, seed);

  const planned = mapped.map(({ idx, order }) => {
    const y = years[seededMapIndex(idx, years.length, `${seed}:yr`)] || years[0];
    const local = seededMapIndex(idx, virtualPerYear, `${seed}:loc`);
    return { y, local, order };
  });

  const yearsNeeded = [...new Set(planned.map((p) => p.y))];
  const yearPacks = new Map();
  await mapPool(yearsNeeded, FETCH_CONCURRENCY, async (y) => {
    yearPacks.set(y, await probeYearDiscover(mediaType, genreIds, originCountry, y));
  });

  const picksByDiscover = new Map();
  for (const p of planned) {
    const pack = yearPacks.get(p.y);
    if (!pack) continue;
    const local = p.local % pack.accessible;
    const page = Math.min(
      pack.totalPages,
      Math.floor(local / TMDB_DISCOVER_PAGE_SIZE) + 1
    );
    const offset = local % TMDB_DISCOVER_PAGE_SIZE;
    const key = String(p.y);
    if (!picksByDiscover.has(key)) {
      picksByDiscover.set(key, { discover: pack.discover, picks: [] });
    }
    picksByDiscover.get(key).picks.push({ page, offset, order: p.order });
  }

  const ordered = new Array(limit);
  await mapPool([...picksByDiscover.values()], 2, async (entry) => {
    const rows = await itemsFromDiscoverPages(entry.discover, entry.picks);
    for (const { order, item } of rows) {
      ordered[order] = item;
    }
  });

  const seen = new Set();
  const deduped = [];
  for (const it of ordered) {
    if (!it?.id || seen.has(it.id)) continue;
    seen.add(it.id);
    deduped.push(it);
  }

  return {
    items: deduped,
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
    Math.min(6, config.tmdbConcurrency || 4)
  );

  const metas = slice
    .map((item) =>
      toStremioMeta(item, {
        mediaType: stremioType,
        customPosterUrl: customPosterUrlForItem(item),
      })
    )
    .filter(Boolean);

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
