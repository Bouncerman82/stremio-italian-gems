import { config } from '../config.js';
import { filterHiddenGems } from '../lib/gems.js';
import { toStremioMeta } from '../lib/meta.js';
import {
  parseIntervalHours,
  parseShuffleExtra,
  resolveGenre,
} from '../lib/moods.js';
import { fisherYatesShuffle } from '../lib/shuffle.js';
import { renderPostersForMovies } from '../posters/renderer.js';
import { cacheGet, cacheSet } from './cache.js';
import { attachImdbIds, discoverItalianMovies } from './tmdb.js';

const PAGE_SIZE = 100;

function parseSkip(extra = {}) {
  const n = Number(extra.skip || 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

async function loadBaseMovies({
  genreIds,
  voteAverageGte,
  maxPopularity,
  cacheKey,
  sortBy = 'popularity.desc',
}) {
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  let movies = await discoverItalianMovies({
    pages: config.tmdbPages,
    genreIds,
    voteAverageGte,
    maxPopularity,
    sortBy,
  });

  movies = await attachImdbIds(movies);
  cacheSet(cacheKey, movies, Math.max(config.shuffleCacheHours, 1));
  return movies;
}

/**
 * Shuffle Fisher-Yates con cache a tempo scelta dall'utente (extra intervallo).
 */
function applyShuffle(movies, shuffleOn, shuffleCacheKey, intervalHours) {
  if (!shuffleOn) return movies;

  if (intervalHours > 0) {
    const cached = cacheGet(shuffleCacheKey);
    if (cached) return cached;
  }

  const shuffled = fisherYatesShuffle(movies);
  cacheSet(shuffleCacheKey, shuffled, intervalHours);
  return shuffled;
}

/**
 * Costruisce il catalogo Stremio in base all'id richiesto.
 */
export async function buildCatalog({ id, extra = {} }) {
  const shuffleOn = parseShuffleExtra(extra.shuffle);
  const intervalHours = parseIntervalHours(
    extra.intervallo,
    config.shuffleCacheHours
  );
  const skip = parseSkip(extra);
  const genreName = extra.genre || null;
  const genre = genreName ? resolveGenre(genreName) : null;
  const genreIds = genre?.genres || [];
  const moodLabel = genreName || null;

  let movies = [];
  let dataCacheKey = `discover:it:base`;

  const genreSuffix = genreName ? `:g:${genreName}` : '';

  if (id === 'it_gems') {
    dataCacheKey = `discover:it:gems${genreSuffix}`;
    movies = await loadBaseMovies({
      genreIds,
      voteAverageGte: config.gemMinRating,
      maxPopularity: config.gemMaxPopularity,
      cacheKey: dataCacheKey,
      sortBy: 'vote_count.desc',
    });
    movies = filterHiddenGems(movies);
  } else if (id === 'it_mood') {
    dataCacheKey = `discover:it:mood${genreSuffix || ':all'}`;
    movies = await loadBaseMovies({
      genreIds,
      cacheKey: dataCacheKey,
    });
  } else if (id === 'it_popular') {
    dataCacheKey = `discover:it:popular${genreSuffix}`;
    movies = await loadBaseMovies({
      genreIds,
      cacheKey: dataCacheKey,
    });
  } else {
    return { metas: [] };
  }

  const shuffleKey = `shuffle:${dataCacheKey}:h${intervalHours}`;
  movies = applyShuffle(movies, shuffleOn, shuffleKey, intervalHours);

  const slice = movies.slice(skip, skip + PAGE_SIZE);

  let posterMap = new Map();
  if (config.customPosters) {
    posterMap = await renderPostersForMovies(slice, { moodLabel });
  }

  const metas = slice.map((m) =>
    toStremioMeta(m, {
      moodLabel,
      customPosterUrl: posterMap.get(m.id) || null,
    })
  );

  return { metas };
}
