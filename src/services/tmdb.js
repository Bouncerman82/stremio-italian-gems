import { config } from '../config.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  italianDubScore,
  italianHybridTier,
  rankItalianHybrid,
  markRegionIt,
  markWatchIt,
  attachJustWatchFlags,
  mergeDedupePreferHigherScores,
  isItalianOriginal,
  IT_FLATRATE_PROVIDERS,
} from './italianDubScore.js';
import {
  ensureJustWatchItIndex,
  getJustWatchSeedTmdbIds,
  markJustWatchIt,
} from './justwatchIt.js';

export {
  italianDubScore,
  italianHybridTier,
  rankItalianHybrid,
  markRegionIt,
  markWatchIt,
  attachJustWatchFlags,
  isItalianOriginal,
  IT_FLATRATE_PROVIDERS,
};

const imdbCache = new Map();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const imdbDiskPath = path.join(__dirname, '..', '..', 'data', 'imdb-cache.json');
let imdbDiskDirty = false;
let imdbDiskLoaded = false;

function loadImdbDisk() {
  if (imdbDiskLoaded) return;
  imdbDiskLoaded = true;
  try {
    if (!fs.existsSync(imdbDiskPath)) return;
    const raw = JSON.parse(fs.readFileSync(imdbDiskPath, 'utf8'));
    if (raw && typeof raw === 'object') {
      for (const [k, v] of Object.entries(raw)) imdbCache.set(k, v);
    }
  } catch {
    // ignore
  }
}

function scheduleImdbDiskFlush() {
  if (!imdbDiskDirty) return;
  imdbDiskDirty = false;
  try {
    fs.mkdirSync(path.dirname(imdbDiskPath), { recursive: true });
    const obj = Object.fromEntries(imdbCache);
    // Cap dimensione: tieni le ultime ~20k chiavi
    const keys = Object.keys(obj);
    if (keys.length > 20_000) {
      for (const k of keys.slice(0, keys.length - 20_000)) delete obj[k];
    }
    fs.writeFileSync(imdbDiskPath, JSON.stringify(obj));
  } catch {
    // ignore
  }
}

function buildUrl(pathname, params = {}) {
  const url = new URL(`${config.tmdbBaseUrl}${pathname}`);
  url.searchParams.set('api_key', config.tmdbApiKey);
  url.searchParams.set('language', config.language);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    url.searchParams.set(key, String(value));
  }
  return url;
}

export async function tmdbFetch(pathname, params = {}) {
  const url = buildUrl(pathname, params);
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(config.upstreamTimeoutMs),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        // retry su rate limit / errori temporanei
        if ((res.status === 429 || res.status >= 500) && attempt < 2) {
          await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
          continue;
        }
        throw new Error(`TMDB ${res.status} ${pathname}: ${body.slice(0, 200)}`);
      }
      return res.json();
    } catch (err) {
      lastErr = err;
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
        continue;
      }
    }
  }
  throw lastErr || new Error(`TMDB fetch failed ${pathname}`);
}

function twoMonthsAgoISO() {
  const d = new Date();
  d.setMonth(d.getMonth() - 2);
  return d.toISOString().slice(0, 10);
}

function yearsAgoISO(years) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d.toISOString().slice(0, 10);
}

function itemReleaseISO(item) {
  return String(item.release_date || item.first_air_date || '').slice(0, 10);
}

/**
 * Mix ~100 titoli: preferenza ultimi 5 anni, max 30 anni, voti alti, generi vari.
 * Il giorno (UTC) entra nel ranking così la lista “cambia” ogni giorno.
 */
function pickDiverseTop100(candidates, daySeed) {
  const cutoff5 = yearsAgoISO(5);
  const recent = [];
  const older = [];
  for (const item of candidates) {
    const d = itemReleaseISO(item);
    if (d && d >= cutoff5) recent.push(item);
    else older.push(item);
  }

  const byGenre = new Map();
  const place = (item) => {
    const g = item.genre_ids?.[0] || 0;
    if (!byGenre.has(g)) byGenre.set(g, []);
    byGenre.get(g).push(item);
  };
  // Ordine stabile ma diverso ogni giorno
  const score = (item) => {
    const vote = Number(item.vote_average || 0);
    const votes = Math.log10(Math.max(Number(item.vote_count || 1), 1));
    const jitter = ((hashDay(item.id, daySeed) % 1000) / 1000) * 0.35;
    return vote + votes * 0.15 + jitter;
  };
  recent.sort((a, b) => score(b) - score(a));
  older.sort((a, b) => score(b) - score(a));
  recent.forEach(place);
  older.forEach(place);

  const buckets = [...byGenre.values()].map((arr) => [...arr]);
  const picked = [];
  const seen = new Set();
  // Preferenza: ~65 recenti + riempimento (fino a 100) anche più vecchi
  const wantRecent = 65;
  for (const item of recent) {
    if (picked.length >= wantRecent) break;
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    picked.push(item);
  }
  // Round-robin sui generi per varietà
  let progress = true;
  while (picked.length < 100 && progress) {
    progress = false;
    for (const bucket of buckets) {
      while (bucket.length) {
        const item = bucket.shift();
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        picked.push(item);
        progress = true;
        break;
      }
      if (picked.length >= 100) break;
    }
  }
  if (picked.length < 100) {
    for (const item of [...recent, ...older]) {
      if (picked.length >= 100) break;
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      picked.push(item);
    }
  }
  return picked.slice(0, 100);
}

function hashDay(id, daySeed) {
  const s = `${daySeed}:${id}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function prioritizeItalianLanguage(items) {
  return rankItalianHybrid(items, { soft: false });
}

/**
 * Garantisce una quota di titoli *stranieri* con alta probabilità di doppiaggio IT
 * in testa. Cinema italiano cappato. Applica flag JustWatch se indice pronto.
 */
function densifyItalianLikely(ranked, limit) {
  const withJw = attachJustWatchFlags(ranked);
  const target = Math.max(
    1,
    Math.floor(limit * Number(config.itDubDensity ?? 0.55))
  );
  const maxOriginals = Math.max(
    0,
    Math.floor(limit * Number(config.itOriginalDensifyCap ?? 0.12))
  );

  const dubbedLikely = [];
  const originals = [];
  const rest = [];

  for (const item of withJw) {
    if (isItalianOriginal(item)) {
      originals.push(item);
      continue;
    }
    if (italianDubScore(item) >= 40) dubbedLikely.push(item);
    else rest.push(item);
  }

  const out = [];
  const seen = new Set();
  const push = (item) => {
    if (!item?.id || seen.has(item.id) || out.length >= limit) return false;
    seen.add(item.id);
    out.push(item);
    return true;
  };

  for (const item of dubbedLikely) {
    if (out.length >= target) break;
    push(item);
  }

  let nOrig = 0;
  for (const item of originals) {
    if (out.length >= target || nOrig >= maxOriginals) break;
    if (push(item)) nOrig++;
  }

  for (const item of withJw) {
    if (out.length >= limit) break;
    if (isItalianOriginal(item) && nOrig >= maxOriginals) continue;
    if (isItalianOriginal(item) && push(item)) nOrig++;
    else if (!isItalianOriginal(item)) push(item);
  }
  for (const list of [dubbedLikely, rest, originals]) {
    for (const item of list) {
      if (out.length >= limit) break;
      if (isItalianOriginal(item) && nOrig >= maxOriginals) continue;
      if (isItalianOriginal(item)) {
        if (push(item)) nOrig++;
      } else {
        push(item);
      }
    }
  }
  return out.slice(0, limit);
}

/** Seed leggeri da JustWatch IT → oggetti stile Discover TMDB. */
async function fetchJustWatchSeedItems(mediaType, existingIds, limit) {
  if (!config.justWatchBoost || limit <= 0) return [];
  warmJustWatchIndex();
  const ids = getJustWatchSeedTmdbIds(mediaType, limit).filter(
    (id) => !existingIds.has(Number(id)) && !existingIds.has(String(id))
  );
  if (!ids.length) return [];

  const pathBase = mediaType === 'tv' ? '/tv' : '/movie';
  const concurrency = Math.min(config.tmdbConcurrency || 4, 4);
  const out = [];
  for (let i = 0; i < ids.length; i += concurrency) {
    const chunk = ids.slice(i, i + concurrency);
    const rows = await Promise.all(
      chunk.map(async (id) => {
        try {
          const data = await tmdbFetch(`${pathBase}/${id}`);
          if (!data?.id) return null;
          // Skip cinema italiano nel seed doppiaggio
          if (String(data.original_language || '').toLowerCase() === 'it') {
            return null;
          }
          return {
            id: data.id,
            title: data.title || data.name,
            name: data.name || data.title,
            original_title: data.original_title || data.original_name,
            original_name: data.original_name || data.original_title,
            original_language: data.original_language,
            overview: data.overview,
            poster_path: data.poster_path,
            backdrop_path: data.backdrop_path,
            genre_ids: (data.genres || []).map((g) => g.id),
            popularity: data.popularity,
            vote_average: data.vote_average,
            vote_count: data.vote_count,
            release_date: data.release_date,
            first_air_date: data.first_air_date,
            origin_country: data.origin_country,
            adult: data.adult,
          };
        } catch {
          return null;
        }
      })
    );
    for (const row of rows) {
      if (row) out.push(row);
    }
  }
  return markJustWatchIt(out);
}

function dedupeById(pages) {
  const seen = new Set();
  const out = [];
  for (const page of pages) {
    for (const item of page.results || []) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      out.push(item);
    }
  }
  return out;
}

/** TMDB Discover: max page = 500 → max 10_000 risultati per singola query. */
export const TMDB_DISCOVER_PAGE_SIZE = 20;
export const TMDB_DISCOVER_MAX_PAGE = 500;
export const TMDB_DISCOVER_MAX_RESULTS =
  TMDB_DISCOVER_MAX_PAGE * TMDB_DISCOVER_PAGE_SIZE;

const pageCache = new Map();
const probeCache = new Map();

function warmJustWatchIndex() {
  // JustWatch migliora il ranking, ma non è necessario per costruire il catalogo.
  void ensureJustWatchItIndex().catch(() => null);
}

/**
 * Parametri Discover condivisi (film/serie).
 * vote_count.gte=10 ≈ 100k+ film, qualità accettabile.
 */
export function buildDiscoverParams({
  mediaType = 'movie',
  genreIds = [],
  year = null,
  yearRange = null,
  originCountry = null,
  popularRecent = false,
  sortBy = 'popularity.desc',
  originalLanguage = null,
  region = null,
  watchRegion = null,
  watchProviders = null,
  watchMonetizationTypes = null,
} = {}) {
  const isMovie = mediaType === 'movie';
  const path = isMovie ? '/discover/movie' : '/discover/tv';
  const params = {
    sort_by: sortBy,
    include_adult: false,
    'vote_count.gte': popularRecent ? undefined : 10,
    with_genres: genreIds.length ? genreIds.join('|') : undefined,
    with_origin_country: originCountry || undefined,
    with_original_language: originalLanguage || undefined,
    region: region || undefined,
    watch_region: watchRegion || undefined,
    with_watch_providers: watchProviders || undefined,
    with_watch_monetization_types: watchMonetizationTypes || undefined,
  };

  if (popularRecent) {
    const dateKey = isMovie ? 'primary_release_date.gte' : 'first_air_date.gte';
    params[dateKey] = twoMonthsAgoISO();
    params.sort_by = 'popularity.desc';
  } else if (year) {
    if (isMovie) params.primary_release_year = year;
    else params.first_air_date_year = year;
  } else if (yearRange) {
    const dateGte = isMovie ? 'primary_release_date.gte' : 'first_air_date.gte';
    const dateLte = isMovie ? 'primary_release_date.lte' : 'first_air_date.lte';
    if (yearRange.gte != null) params[dateGte] = `${yearRange.gte}-01-01`;
    if (yearRange.lte != null) params[dateLte] = `${yearRange.lte}-12-31`;
  }

  return { path, params, mediaType: isMovie ? 'movie' : 'tv' };
}

function cacheKey(prefix, path, params, page) {
  return `${prefix}:${path}:${JSON.stringify(params)}:${page || ''}`;
}

/** Totale TMDB + pagine accessibili (max 500). TTL configurabile. */
export async function discoverProbe(discover, { maxAgeMs = 180_000 } = {}) {
  const { path, params } = discover;
  const key = cacheKey('probe', path, params, 1);
  const hit = probeCache.get(key);
  if (hit && Date.now() - (hit._fetchedAt || 0) < maxAgeMs) return hit;

  const data = await tmdbFetch(path, { ...params, page: 1 });
  const totalResults = Number(data.total_results) || 0;
  const rawPages = Number(data.total_pages) || 0;
  const totalPages = Math.min(Math.max(rawPages, 0), TMDB_DISCOVER_MAX_PAGE);
  const accessible = Math.min(totalResults, totalPages * TMDB_DISCOVER_PAGE_SIZE);
  const out = {
    totalResults,
    totalPages,
    rawPages,
    accessible,
    sample: data.results || [],
    _fetchedAt: Date.now(),
  };
  probeCache.set(key, out);
  return out;
}

/** Una pagina Discover (20 item), cache in-process. */
export async function discoverPage(discover, page) {
  const { path, params } = discover;
  const p = Math.min(Math.max(1, Number(page) || 1), TMDB_DISCOVER_MAX_PAGE);
  const key = cacheKey('page', path, params, p);
  if (pageCache.has(key)) return pageCache.get(key);

  const data = await tmdbFetch(path, { ...params, page: p });
  const results = data.results || [];
  pageCache.set(key, results);
  if (pageCache.size > 400) {
    // evita crescita infinita: elimina le chiavi più vecchie
    const first = pageCache.keys().next().value;
    pageCache.delete(first);
  }
  return results;
}

/**
 * Discover film (legacy / pagine HTML genere).
 */
export async function discoverMovies(options = {}) {
  const {
    pages = config.tmdbPages,
    genreIds = [],
    year = null,
    popularRecent = false,
    sortBy = 'popularity.desc',
  } = options;

  if (popularRecent) {
    return discoverPopularRecent('movie', genreIds);
  }

  const discover = buildDiscoverParams({
    mediaType: 'movie',
    genreIds,
    year,
    sortBy,
  });
  const pageNumbers = Array.from({ length: pages }, (_, i) => i + 1);
  const results = await Promise.all(
    pageNumbers.map((page) => discoverPage(discover, page).then((r) => ({ results: r })))
  );

  return prioritizeItalianLanguage(dedupeById(results));
}

/**
 * Discover serie.
 */
export async function discoverSeries(options = {}) {
  const {
    pages = config.tmdbPages,
    genreIds = [],
    year = null,
    popularRecent = false,
    sortBy = 'popularity.desc',
  } = options;

  if (popularRecent) {
    return discoverPopularRecent('tv', genreIds);
  }

  const discover = buildDiscoverParams({
    mediaType: 'tv',
    genreIds,
    year,
    sortBy,
  });
  const pageNumbers = Array.from({ length: pages }, (_, i) => i + 1);
  const results = await Promise.all(
    pageNumbers.map((page) => discoverPage(discover, page).then((r) => ({ results: r })))
  );

  return prioritizeItalianLanguage(dedupeById(results));
}

/**
 * Ultime 100 uscite popolari negli ultimi 2 mesi.
 * Focus doppiaggio: region IT + watch providers IT + JustWatch IT + fill.
 */
export async function discoverPopularRecent(mediaType, genreIds = [], originCountry = null) {
  const regionPages = [1, 2, 3, 4, 5];
  const fillPages = [1, 2, 3, 4, 5];
  const fetchPages = (discover, pages) =>
    Promise.all(
      pages.map((page) => discoverPage(discover, page).then((r) => ({ results: r })))
    );

  // Preload JW IT senza trattenere il catalogo.
  warmJustWatchIndex();

  const baseOpts = {
    mediaType,
    genreIds,
    popularRecent: true,
    originCountry,
  };

  if (originCountry) {
    const discover = buildDiscoverParams(baseOpts);
    const results = await fetchPages(discover, regionPages);
    let merged = markJustWatchIt(dedupeById(results));
    const seed = await fetchJustWatchSeedItems(
      mediaType,
      new Set(merged.map((i) => i.id)),
      config.justWatchSeedLimit
    );
    if (seed.length) {
      merged = mergeDedupePreferHigherScores(seed, merged);
    }
    return densifyItalianLikely(rankItalianHybrid(merged), 100);
  }

  const jobs = [
    fetchPages(
      buildDiscoverParams({
        ...baseOpts,
        region: 'IT',
        watchRegion: 'IT',
      }),
      regionPages
    ),
    fetchPages(buildDiscoverParams(baseOpts), fillPages),
  ];

  if (config.itWatchOversample) {
    jobs.push(
      fetchPages(
        buildDiscoverParams({
          ...baseOpts,
          watchRegion: 'IT',
          watchProviders: IT_FLATRATE_PROVIDERS,
          watchMonetizationTypes: 'flatrate',
        }),
        regionPages
      )
    );
  }

  if (!(genreIds && genreIds.length)) {
    jobs.push(
      fetchPages(
        buildDiscoverParams({
          ...baseOpts,
          genreIds: mediaType === 'tv' ? [16, 10762, 10759] : [16, 10751, 28, 12],
          region: 'IT',
          watchRegion: 'IT',
        }),
        [1, 2, 3]
      )
    );
  }

  const settled = await Promise.all(jobs);
  const tierRegion = markRegionIt(dedupeById(settled[0]));
  const tierFill = dedupeById(settled[1]);
  let cursor = 2;
  const tierWatch = config.itWatchOversample
    ? markWatchIt(dedupeById(settled[cursor++]))
    : [];
  const tierGenre =
    settled[cursor] != null
      ? markRegionIt(dedupeById(settled[cursor]))
      : [];
  let merged = mergeDedupePreferHigherScores(
    tierRegion,
    tierWatch,
    tierGenre,
    tierFill
  );
  merged = markJustWatchIt(merged);
  const seed = await fetchJustWatchSeedItems(
    mediaType,
    new Set(merged.map((i) => i.id)),
    config.justWatchSeedLimit
  );
  if (seed.length) {
    merged = mergeDedupePreferHigherScores(seed, merged);
  }
  return densifyItalianLikely(rankItalianHybrid(merged), 100);
}

/**
 * Top 100: voto ≥ 6,5, max 30 anni, preferenza ultimi 5, generi misti.
 * Focus doppiaggio: region IT + watch IT + fill (niente lingua originale IT).
 */
export async function discoverTop100(mediaType, genreIds = [], originCountry = null) {
  const isMovie = mediaType !== 'tv';
  const path = isMovie ? '/discover/movie' : '/discover/tv';
  const dateGte = isMovie ? 'primary_release_date.gte' : 'first_air_date.gte';
  const dateLte = isMovie ? 'primary_release_date.lte' : 'first_air_date.lte';
  const daySeed = new Date().toISOString().slice(0, 10);
  const from30 = yearsAgoISO(30);
  const from5 = yearsAgoISO(5);
  const minVote = 6.5;

  const base = {
    sort_by: 'vote_average.desc',
    include_adult: false,
    with_origin_country: originCountry || undefined,
    with_genres: genreIds.length ? genreIds.join('|') : undefined,
  };

  function jobsFor(extraParams = {}) {
    const jobs = [];
    const params = { ...base, ...extraParams };
    // Recenti (0–5 anni)
    for (const page of [1, 2, 3, 4]) {
      jobs.push(
        discoverPage(
          {
            path,
            params: {
              ...params,
              'vote_average.gte': minVote,
              'vote_count.gte': isMovie ? 150 : 60,
              [dateGte]: from5,
            },
            mediaType: isMovie ? 'movie' : 'tv',
          },
          page
        ).then((r) => ({ results: r }))
      );
    }
    // Classici (5–30 anni)
    for (const page of [1, 2, 3]) {
      jobs.push(
        discoverPage(
          {
            path,
            params: {
              ...params,
              'vote_average.gte': minVote,
              'vote_count.gte': isMovie ? 250 : 80,
              [dateGte]: from30,
              [dateLte]: from5,
            },
            mediaType: isMovie ? 'movie' : 'tv',
          },
          page
        ).then((r) => ({ results: r }))
      );
    }
    // Extra per genere → varietà
    if (!genreIds.length) {
      const variety = isMovie
        ? [28, 35, 18, 27, 878, 53, 12, 16, 10749, 80]
        : [35, 18, 80, 10765, 9648, 10759, 16, 10751];
      for (const g of variety) {
        jobs.push(
          discoverPage(
            {
              path,
              params: {
                ...params,
                with_genres: String(g),
                'vote_average.gte': minVote,
                'vote_count.gte': isMovie ? 150 : 60,
                [dateGte]: from30,
              },
              mediaType: isMovie ? 'movie' : 'tv',
            },
            1
          ).then((r) => ({ results: r }))
        );
      }
    }
    return jobs;
  }

  const filterCandidates = (pages) =>
    dedupeById(pages).filter((item) => {
      const d = itemReleaseISO(item);
      if (!d || d < from30) return false;
      return Number(item.vote_average || 0) >= minVote;
    });

  // Paese esplicito → una sola passata + rank doppiaggio
  if (originCountry) {
    warmJustWatchIndex();
    const pages = await Promise.all(jobsFor());
    let merged = markJustWatchIt(filterCandidates(pages));
    const seed = await fetchJustWatchSeedItems(
      mediaType,
      new Set(merged.map((i) => i.id)),
      Math.min(config.justWatchSeedLimit, 25)
    );
    if (seed.length) merged = mergeDedupePreferHigherScores(seed, merged);
    const picked = pickDiverseTop100(merged, daySeed);
    return densifyItalianLikely(rankItalianHybrid(picked), 100);
  }

  warmJustWatchIndex();

  // Niente with_original_language=it: vogliamo stranieri doppiati, non cinema IT
  const jobs = [
    Promise.all(jobsFor({ region: 'IT', watch_region: 'IT' })),
    Promise.all(jobsFor()),
  ];
  if (config.itWatchOversample) {
    jobs.push(
      Promise.all(
        jobsFor({
          watch_region: 'IT',
          with_watch_providers: IT_FLATRATE_PROVIDERS,
          with_watch_monetization_types: 'flatrate',
        })
      )
    );
  }

  const settled = await Promise.all(jobs);
  const tierRegion = markRegionIt(filterCandidates(settled[0]));
  const tierFill = filterCandidates(settled[1]);
  const tierWatch = settled[2]
    ? markWatchIt(filterCandidates(settled[2]))
    : [];
  let merged = mergeDedupePreferHigherScores(tierRegion, tierWatch, tierFill);
  merged = markJustWatchIt(merged);
  const seed = await fetchJustWatchSeedItems(
    mediaType,
    new Set(merged.map((i) => i.id)),
    Math.min(config.justWatchSeedLimit, 25)
  );
  if (seed.length) merged = mergeDedupePreferHigherScores(seed, merged);
  const picked = pickDiverseTop100(merged, daySeed);
  return densifyItalianLikely(rankItalianHybrid(picked), 100);
}

export async function getImdbId(tmdbId, mediaType = 'movie') {
  loadImdbDisk();
  const key = `${mediaType}:${tmdbId}`;
  if (imdbCache.has(key)) return imdbCache.get(key);
  const pathName =
    mediaType === 'tv'
      ? `/tv/${tmdbId}/external_ids`
      : `/movie/${tmdbId}/external_ids`;
  const data = await tmdbFetch(pathName);
  const imdbId = data.imdb_id || null;
  imdbCache.set(key, imdbId);
  imdbDiskDirty = true;
  if (imdbCache.size % 40 === 0) scheduleImdbDiskFlush();
  return imdbId;
}

export async function attachImdbIds(items, mediaType = 'movie', concurrency = 12) {
  loadImdbDisk();
  const out = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency);
    const enriched = await Promise.all(
      chunk.map(async (item) => {
        try {
          const imdbId = await getImdbId(item.id, mediaType);
          return { ...item, imdb_id: imdbId, media_type: mediaType };
        } catch {
          return { ...item, imdb_id: null, media_type: mediaType };
        }
      })
    );
    out.push(...enriched);
  }
  scheduleImdbDiskFlush();
  return out;
}

export async function findByImdb(imdbId) {
  return tmdbFetch(`/find/${imdbId}`, { external_source: 'imdb_id' });
}

export async function getMovieDetails(tmdbId) {
  const it = await tmdbFetch(`/movie/${tmdbId}`, {
    append_to_response: 'credits,external_ids,images',
  });
  if (!it.overview || !String(it.overview).trim()) {
    const en = await tmdbFetch(`/movie/${tmdbId}`, { language: 'en-US' });
    if (en.overview) {
      it.overview = `${en.overview}\n\n(Trama in inglese: versione italiana non disponibile)`;
    }
  }
  return it;
}

export async function getTvDetails(tmdbId) {
  const it = await tmdbFetch(`/tv/${tmdbId}`, {
    append_to_response: 'credits,external_ids,images,aggregate_credits',
  });
  if (!it.overview || !String(it.overview).trim()) {
    const en = await tmdbFetch(`/tv/${tmdbId}`, { language: 'en-US' });
    if (en.overview) {
      it.overview = `${en.overview}\n\n(Trama in inglese: versione italiana non disponibile)`;
    }
  }
  return it;
}

export async function getPersonDetails(personId) {
  const it = await tmdbFetch(`/person/${personId}`, {
    append_to_response: 'external_ids,images',
  });
  let bioSource = it.biography && String(it.biography).trim() ? 'it' : null;

  if (!bioSource) {
    const en = await tmdbFetch(`/person/${personId}`, {
      language: 'en-US',
      append_to_response: 'external_ids,images',
    });
    if (en.biography && String(en.biography).trim()) {
      it.biography = `${en.biography}\n\n(Biografia in inglese: versione italiana non disponibile)`;
      bioSource = 'en';
    }
    if (!it.birthday && en.birthday) it.birthday = en.birthday;
    if (!it.place_of_birth && en.place_of_birth) it.place_of_birth = en.place_of_birth;
    if (!it.profile_path && en.profile_path) it.profile_path = en.profile_path;
    if (!it.external_ids && en.external_ids) it.external_ids = en.external_ids;
  }

  // Ultimo tentativo: altre lingue via /translations (a volte EN sul person è vuoto)
  if (!bioSource) {
    try {
      const tr = await tmdbFetch(`/person/${personId}/translations`);
      const candidates = (tr.translations || [])
        .map((t) => ({
          lang: t.iso_639_1,
          text: (t.data?.biography || '').trim(),
        }))
        .filter((t) => t.text.length > 40)
        .sort((a, b) => b.text.length - a.text.length);
      const best = candidates[0];
      if (best) {
        it.biography = `${best.text}\n\n(Biografia in ${best.lang}: non disponibile in italiano/inglese)`;
        bioSource = `tr:${best.lang}`;
      }
    } catch {
      // ignore
    }
  }


  it._bioSource = bioSource;
  return it;
}

export async function getMovieCredits(tmdbId) {
  return tmdbFetch(`/movie/${tmdbId}/credits`);
}

export async function getTvCredits(tmdbId) {
  return tmdbFetch(`/tv/${tmdbId}/aggregate_credits`);
}

export function posterUrl(posterPath, size = 'w500') {
  if (!posterPath) return null;
  return `https://image.tmdb.org/t/p/${size}${posterPath}`;
}

export function profileUrl(profilePath, size = 'w400') {
  if (!profilePath) return null;
  return `https://image.tmdb.org/t/p/${size}${profilePath}`;
}
