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
import { fisherYatesShuffle, hashString, seededMapIndex } from '../lib/shuffle.js';
import { renderPostersForMovies } from '../posters/renderer.js';
import { DAY_SECONDS, cacheGet, cacheSet } from './cache.js';
import {
  attachImdbIds,
  buildDiscoverParams,
  discoverPage,
  discoverPopularRecent,
  discoverTop100,
  discoverProbe,
  TMDB_DISCOVER_MAX_PAGE,
  TMDB_DISCOVER_PAGE_SIZE,
} from './tmdb.js';

const PAGE_SIZE = 100;
const COUNT_TILE_SLOTS = 1;
const SHUFFLE_POOL_SIZE = Number(process.env.SHUFFLE_POOL_SIZE || 500);
const FETCH_CONCURRENCY = config.tmdbConcurrency;
/** Nuovo campione TMDB non più spesso di così (lo shuffle riordina prima). */
const CONTENT_REFRESH_MIN_SEC = Number(process.env.CONTENT_REFRESH_MIN_SEC || 600);

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
        : `${totalLabel} trovati · mix ${poolLabel}`;

  return {
    id,
    type,
    name:
      mode === 'top100-shuffle'
        ? `▣ Top 100 ${kind} · voto 6,5+`
        : mode === 'popular-shuffle'
          ? `▣ Popolari ${kind} · ultimi 2 mesi`
          : `▣ ${totalLabel} ${kind} · mix ${poolLabel}`,
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

/**
 * Campione TMDB da 500 titoli per filtri (TTL lungo).
 * Lo shuffle cambia solo l’ORDINE (veloce), non rifà 500 fetch ogni 30s.
 */
async function getContentPool({
  baseDiscover,
  genreIds,
  year,
  originCountry,
  dataKey,
  intervalSec,
}) {
  const refreshSec = Math.max(CONTENT_REFRESH_MIN_SEC, intervalSec * 2);
  const contentBucket = Math.floor(Date.now() / 1000 / refreshSec);
  const poolKey = `content:v5:${dataKey}:c${contentBucket}`;
  const cached = cacheGet(poolKey);
  if (cached?.items?.length) {
    return { ...cached, poolCached: true };
  }

  const probe = await discoverProbe(baseDiscover);
  const collected = [];
  const seen = new Set();
  const pushAll = (results) => {
    for (const item of results || []) {
      if (!item?.id || seen.has(item.id)) continue;
      seen.add(item.id);
      collected.push(item);
      if (collected.length >= SHUFFLE_POOL_SIZE) return true;
    }
    return false;
  };

  if (year) {
    const maxPage = Math.max(1, probe.totalPages || 1);
    const wantPages = Math.min(
      Math.ceil(SHUFFLE_POOL_SIZE / TMDB_DISCOVER_PAGE_SIZE),
      maxPage,
      40
    );
    const pageSet = new Set();
    for (let i = 0; pageSet.size < wantPages && i < wantPages * 8; i++) {
      pageSet.add(seededMapIndex(i, maxPage, `${dataKey}:pg:${contentBucket}`) + 1);
    }
    const pages = await mapPool([...pageSet], FETCH_CONCURRENCY, (p) =>
      discoverPage(baseDiscover, p)
    );
    for (const results of pages) {
      if (pushAll(results)) break;
    }
  } else {
    const years = yearList();
    const wantPages = Math.ceil(SHUFFLE_POOL_SIZE / TMDB_DISCOVER_PAGE_SIZE);
    const jobs = [];
    const seenJob = new Set();
    for (let i = 0; jobs.length < wantPages + 8 && i < wantPages * 12; i++) {
      const y =
        years[seededMapIndex(i, years.length, `${dataKey}:y:${contentBucket}`)] ||
        years[0];
      const pageHint =
        seededMapIndex(i, TMDB_DISCOVER_MAX_PAGE, `${dataKey}:p:${contentBucket}`) + 1;
      const jk = `${y}:${pageHint}`;
      if (seenJob.has(jk)) continue;
      seenJob.add(jk);
      jobs.push({ y, pageHint });
    }

    const yearProbes = new Map();
    const yearsNeeded = [...new Set(jobs.map((j) => j.y))];
    await mapPool(yearsNeeded, FETCH_CONCURRENCY, async (y) => {
      const d = buildDiscoverParams({
        mediaType: baseDiscover.mediaType,
        genreIds,
        year: y,
        originCountry,
      });
      yearProbes.set(y, { discover: d, probe: await discoverProbe(d) });
    });

    const fetchList = [];
    const uk = new Set();
    for (const j of jobs) {
      const entry = yearProbes.get(j.y);
      if (!entry?.probe?.totalPages) continue;
      const page = ((j.pageHint - 1) % entry.probe.totalPages) + 1;
      const key = `${j.y}:${page}`;
      if (uk.has(key)) continue;
      uk.add(key);
      fetchList.push({ discover: entry.discover, page });
    }

    const pageResults = await mapPool(fetchList, FETCH_CONCURRENCY, (f) =>
      discoverPage(f.discover, f.page)
    );
    for (const results of pageResults) {
      if (pushAll(results)) break;
    }
  }

  if (collected.length < SHUFFLE_POOL_SIZE) {
    const maxPage = Math.max(1, probe.totalPages || 1);
    const pagesNeeded = Math.ceil(
      (SHUFFLE_POOL_SIZE - collected.length) / TMDB_DISCOVER_PAGE_SIZE
    );
    const pageNums = [];
    for (let i = 0; i < pagesNeeded + 2; i++) {
      pageNums.push((i % maxPage) + 1);
    }
    const fillPages = await mapPool(pageNums, FETCH_CONCURRENCY, (p) =>
      discoverPage(baseDiscover, p)
    );
    for (const results of fillPages) {
      if (pushAll(results)) break;
    }
  }

  const pool = {
    items: collected.slice(0, SHUFFLE_POOL_SIZE),
    totalResults: probe.totalResults,
    poolSize: Math.min(collected.length, SHUFFLE_POOL_SIZE),
    mode: year ? 'content-pool-year' : 'content-pool',
  };
  cacheSet(poolKey, pool, refreshSec + 120);
  return { ...pool, poolCached: false };
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
    // Totale sempre fresco da TMDB (non dal pool cache)
    const probe = await discoverProbe(baseDiscover, {
      maxAgeMs: config.tmdbProbeMaxAgeMs,
    });
    liveTotal = probe.totalResults;
    const pool = await getContentPool({
      baseDiscover,
      genreIds,
      year,
      originCountry,
      dataKey,
      intervalSec,
    });
    const ordered = orderBySeed(pool.items, seed);
    const sliceItems =
      realSkip >= ordered.length
        ? []
        : ordered.slice(realSkip, realSkip + limit);
    window = {
      items: sliceItems,
      totalResults: liveTotal,
      poolSize: pool.poolSize,
      poolCached: pool.poolCached,
      mode: pool.mode,
    };
  }

  let slice = window.items || [];
  slice = await attachImdbIds(slice, mediaType === 'tv' ? 'tv' : 'movie');

  let posterMap = new Map();
  if (config.customPosters) {
    posterMap = await renderPostersForMovies(slice, { concurrency: 8 });
  }

  const metas = slice
    .map((item) =>
      toStremioMeta(item, {
        mediaType: stremioType,
        customPosterUrl: posterMap.get(item.id) || null,
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
