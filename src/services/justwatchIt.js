/**
 * JustWatch Italia (https://www.justwatch.com/it) — segnale doppiaggio.
 *
 * Usa il GraphQL pubblico di JustWatch (popular/trending per country=IT).
 * Match su TMDB id (e IMDb). Cache memoria + disco; se JW fallisce → no-op.
 *
 * Non privilegia cinema italiano: il boost vale soprattutto per titoli stranieri
 * presenti nelle liste JW IT (spesso doppiati sulle piattaforme).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';
import { cacheGet, cacheSet, DAY_SECONDS } from './cache.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const diskPath = path.join(__dirname, '..', '..', 'data', 'justwatch-it.json');

const JW_GQL = 'https://apis.justwatch.com/graphql';
const MEMORY_KEY = 'justwatch-it:index:v1';

const POPULAR_QUERY = `
query GetPopularTitles(
  $country: Country!
  $language: Language!
  $first: Int!
  $sortBy: PopularTitlesSorting!
  $objectTypes: [ObjectType!]
  $after: String
) {
  popularTitles(
    country: $country
    first: $first
    sortBy: $sortBy
    after: $after
    filter: { objectTypes: $objectTypes }
  ) {
    pageInfo { hasNextPage endCursor }
    edges {
      node {
        objectId
        objectType
        content(country: $country, language: $language) {
          title
          originalTitle
          originalReleaseYear
          externalIds { imdbId tmdbId }
        }
      }
    }
  }
}`;

/** @type {null | { builtAt: number, byTmdb: Map<string, object>, byImdb: Map<string, object> }} */
let liveIndex = null;
let inflight = null;

function ttlSeconds() {
  return Math.max(300, Number(config.justWatchCacheSeconds || DAY_SECONDS));
}

function pageSize() {
  return Math.min(100, Math.max(20, Number(config.justWatchPageSize || 50)));
}

function maxPages() {
  return Math.min(4, Math.max(1, Number(config.justWatchMaxPages || 2)));
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function jwGraphql(variables) {
  const res = await fetch(JW_GQL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Accept: 'application/json',
      'App-Version': '3.8.0-web-web',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Referer: 'https://www.justwatch.com/it',
    },
    body: JSON.stringify({
      operationName: 'GetPopularTitles',
      variables: {
        country: 'IT',
        language: 'it',
        ...variables,
      },
      query: POPULAR_QUERY,
    }),
  });
  if (!res.ok) {
    throw new Error(`JustWatch HTTP ${res.status}`);
  }
  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(
      `JustWatch GQL: ${String(json.errors[0]?.message || 'error').slice(0, 160)}`
    );
  }
  return json.data?.popularTitles || null;
}

async function fetchList(objectType, sortBy) {
  const out = [];
  let after = null;
  const first = pageSize();
  const pages = maxPages();
  for (let p = 0; p < pages; p++) {
    const conn = await jwGraphql({
      first,
      sortBy,
      objectTypes: [objectType],
      after,
    });
    const edges = conn?.edges || [];
    for (const edge of edges) {
      const node = edge?.node;
      const content = node?.content;
      const tmdbId = content?.externalIds?.tmdbId;
      if (!tmdbId) continue;
      out.push({
        tmdbId: String(tmdbId),
        imdbId: content?.externalIds?.imdbId || null,
        title: content?.title || content?.originalTitle || '',
        year: content?.originalReleaseYear || null,
        objectType: node?.objectType || objectType,
        rank: out.length + 1,
        list: sortBy === 'TRENDING' ? 'trending' : 'popular',
      });
    }
    if (!conn?.pageInfo?.hasNextPage || !conn?.pageInfo?.endCursor) break;
    after = conn.pageInfo.endCursor;
    await sleep(120); // gentile col rate limit
  }
  return out;
}

function emptyMaps() {
  return {
    builtAt: Date.now(),
    byTmdb: new Map(),
    byImdb: new Map(),
    popularMovieIds: [],
    trendingMovieIds: [],
    popularShowIds: [],
    trendingShowIds: [],
  };
}

function upsert(maps, entry) {
  const key = entry.tmdbId;
  const prev = maps.byTmdb.get(key) || {
    tmdbId: key,
    imdbId: entry.imdbId,
    title: entry.title,
    year: entry.year,
    objectType: entry.objectType,
    popularRank: null,
    trendingRank: null,
  };
  if (entry.list === 'popular') {
    prev.popularRank =
      prev.popularRank == null
        ? entry.rank
        : Math.min(prev.popularRank, entry.rank);
  } else {
    prev.trendingRank =
      prev.trendingRank == null
        ? entry.rank
        : Math.min(prev.trendingRank, entry.rank);
  }
  if (entry.imdbId) prev.imdbId = entry.imdbId;
  maps.byTmdb.set(key, prev);
  if (prev.imdbId) maps.byImdb.set(String(prev.imdbId), prev);
}

function serialize(maps) {
  return {
    builtAt: maps.builtAt,
    entries: [...maps.byTmdb.values()],
    popularMovieIds: maps.popularMovieIds,
    trendingMovieIds: maps.trendingMovieIds,
    popularShowIds: maps.popularShowIds,
    trendingShowIds: maps.trendingShowIds,
  };
}

function deserialize(raw) {
  const maps = emptyMaps();
  if (!raw || !Array.isArray(raw.entries)) return maps;
  maps.builtAt = Number(raw.builtAt) || Date.now();
  for (const e of raw.entries) {
    if (!e?.tmdbId) continue;
    maps.byTmdb.set(String(e.tmdbId), e);
    if (e.imdbId) maps.byImdb.set(String(e.imdbId), e);
  }
  maps.popularMovieIds = raw.popularMovieIds || [];
  maps.trendingMovieIds = raw.trendingMovieIds || [];
  maps.popularShowIds = raw.popularShowIds || [];
  maps.trendingShowIds = raw.trendingShowIds || [];
  return maps;
}

function loadDisk() {
  try {
    if (!fs.existsSync(diskPath)) return null;
    const raw = JSON.parse(fs.readFileSync(diskPath, 'utf8'));
    const ageSec = (Date.now() - Number(raw.builtAt || 0)) / 1000;
    if (ageSec > ttlSeconds()) return null;
    return deserialize(raw);
  } catch {
    return null;
  }
}

function saveDisk(maps) {
  try {
    fs.mkdirSync(path.dirname(diskPath), { recursive: true });
    const tmp = `${diskPath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(serialize(maps)));
    fs.renameSync(tmp, diskPath);
  } catch {
    // ignore disk errors
  }
}

async function buildFreshIndex() {
  const maps = emptyMaps();
  const [popMovies, trendMovies, popShows, trendShows] = await Promise.all([
    fetchList('MOVIE', 'POPULAR'),
    fetchList('MOVIE', 'TRENDING'),
    fetchList('SHOW', 'POPULAR'),
    fetchList('SHOW', 'TRENDING'),
  ]);

  for (const e of popMovies) upsert(maps, e);
  for (const e of trendMovies) upsert(maps, e);
  for (const e of popShows) upsert(maps, e);
  for (const e of trendShows) upsert(maps, e);

  maps.popularMovieIds = popMovies.map((e) => e.tmdbId);
  maps.trendingMovieIds = trendMovies.map((e) => e.tmdbId);
  maps.popularShowIds = popShows.map((e) => e.tmdbId);
  maps.trendingShowIds = trendShows.map((e) => e.tmdbId);
  maps.builtAt = Date.now();
  return maps;
}

/**
 * Carica (o riusa) l'indice JW IT. Mai throw verso il catalogo.
 * @returns {Promise<{ byTmdb: Map, byImdb: Map, popularMovieIds: string[], ... } | null>}
 */
export async function ensureJustWatchItIndex() {
  if (!config.justWatchBoost) return null;

  if (liveIndex && Date.now() - liveIndex.builtAt < ttlSeconds() * 1000) {
    return liveIndex;
  }

  const mem = cacheGet(MEMORY_KEY);
  if (mem?.entries) {
    liveIndex = deserialize(mem);
    return liveIndex;
  }

  const disk = loadDisk();
  if (disk && disk.byTmdb.size) {
    liveIndex = disk;
    cacheSet(MEMORY_KEY, serialize(disk), ttlSeconds());
    return liveIndex;
  }

  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const maps = await buildFreshIndex();
      liveIndex = maps;
      cacheSet(MEMORY_KEY, serialize(maps), ttlSeconds());
      saveDisk(maps);
      return maps;
    } catch (err) {
      console.warn(
        '[justwatch-it] fetch failed, ranking continues without JW:',
        err?.message || err
      );
      // Stale disk anche se scaduto: meglio qualcosa che niente
      try {
        if (fs.existsSync(diskPath)) {
          const raw = JSON.parse(fs.readFileSync(diskPath, 'utf8'));
          const stale = deserialize(raw);
          if (stale.byTmdb.size) {
            liveIndex = stale;
            return stale;
          }
        }
      } catch {
        // ignore
      }
      return null;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

export function lookupJustWatchIt(tmdbId) {
  if (!config.justWatchBoost || !liveIndex || tmdbId == null) return null;
  return liveIndex.byTmdb.get(String(tmdbId)) || null;
}

/**
 * Punti score (0–30) da liste JW IT. Più alto = più in alto in popular/trending.
 */
export function justWatchItBoostPoints(tmdbId) {
  const hit = lookupJustWatchIt(tmdbId);
  if (!hit) return 0;

  const rankPts = (rank, top, mid, low) => {
    if (rank == null) return 0;
    if (rank <= 15) return top;
    if (rank <= 40) return mid;
    if (rank <= 100) return low;
    return Math.max(4, Math.floor(low * 0.6));
  };

  const pop = rankPts(hit.popularRank, 28, 20, 12);
  const trend = rankPts(hit.trendingRank, 22, 16, 10);
  // Prendi il meglio delle due liste (non sommare pieno: evita doppio conteggio)
  return Math.min(30, Math.max(pop, trend) + Math.floor(Math.min(pop, trend) * 0.25));
}

export function markJustWatchIt(items) {
  if (!config.justWatchBoost || !liveIndex) {
    return items || [];
  }
  return (items || []).map((it) => {
    if (!it?.id) return it;
    const hit = lookupJustWatchIt(it.id);
    if (!hit) return it;
    const next = {
      ...it,
      _justWatchIt: true,
      _justWatchPopularRank: hit.popularRank,
      _justWatchTrendingRank: hit.trendingRank,
    };
    delete next._itDubScore;
    return next;
  });
}

/**
 * TMDB ids da seedare nel pool (popular prima di trending), filtrati per movie/tv.
 */
export function getJustWatchSeedTmdbIds(mediaType = 'movie', limit = 40) {
  if (!liveIndex) return [];
  const isTv = mediaType === 'tv';
  const primary = isTv ? liveIndex.popularShowIds : liveIndex.popularMovieIds;
  const secondary = isTv
    ? liveIndex.trendingShowIds
    : liveIndex.trendingMovieIds;
  const seen = new Set();
  const out = [];
  for (const id of [...primary, ...secondary]) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= limit) break;
  }
  return out;
}

/** Stats per smoke test / debug. */
export function justWatchItStats() {
  if (!liveIndex) return { ready: false, size: 0 };
  return {
    ready: true,
    size: liveIndex.byTmdb.size,
    builtAt: liveIndex.builtAt,
    popularMovies: liveIndex.popularMovieIds.length,
    trendingMovies: liveIndex.trendingMovieIds.length,
    popularShows: liveIndex.popularShowIds.length,
    trendingShows: liveIndex.trendingShowIds.length,
  };
}
