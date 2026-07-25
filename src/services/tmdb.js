import { config } from '../config.js';

const imdbCache = new Map();

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

async function tmdbFetch(pathname, params = {}) {
  const url = buildUrl(pathname, params);
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`TMDB ${res.status} ${pathname}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

/**
 * Scarica N pagine di discover in parallelo.
 * Priorità: film italiani (paese IT) con metadata in it-IT.
 */
export async function discoverItalianMovies(options = {}) {
  const {
    pages = config.tmdbPages,
    genreIds = [],
    sortBy = 'popularity.desc',
    voteAverageGte,
    maxPopularity,
  } = options;

  const pageNumbers = Array.from({ length: pages }, (_, i) => i + 1);

  const results = await Promise.all(
    pageNumbers.map((page) =>
      tmdbFetch('/discover/movie', {
        page,
        sort_by: sortBy,
        include_adult: false,
        with_origin_country: config.originCountry,
        with_genres: genreIds.length ? genreIds.join('|') : undefined,
        'vote_average.gte': voteAverageGte,
        // Preferisci contenuti con lingua originale italiana quando possibile
        // (non esclude gli altri: il sort di priorità avviene dopo)
      })
    )
  );

  const seen = new Set();
  let movies = [];
  for (const page of results) {
    for (const movie of page.results || []) {
      if (seen.has(movie.id)) continue;
      seen.add(movie.id);
      movies.push(movie);
    }
  }

  if (typeof maxPopularity === 'number') {
    movies = movies.filter((m) => Number(m.popularity || 0) <= maxPopularity);
  }

  return prioritizeItalianLanguage(movies);
}

/**
 * Priorità assoluta ai film con original_language = 'it',
 * poi gli altri (es. inglese) prodotti/legati all'Italia.
 */
export function prioritizeItalianLanguage(movies) {
  return [...movies].sort((a, b) => {
    const aIt = a.original_language === 'it' ? 0 : 1;
    const bIt = b.original_language === 'it' ? 0 : 1;
    if (aIt !== bIt) return aIt - bIt;
    // Tra pari priorità: voto più alto prima
    return Number(b.vote_average || 0) - Number(a.vote_average || 0);
  });
}

export async function getImdbId(tmdbId) {
  if (imdbCache.has(tmdbId)) return imdbCache.get(tmdbId);

  const data = await tmdbFetch(`/movie/${tmdbId}/external_ids`);
  const imdbId = data.imdb_id || null;
  imdbCache.set(tmdbId, imdbId);
  return imdbId;
}

/**
 * Arricchisce i film con IMDb id (concorrenza limitata per non martellare TMDB).
 */
export async function attachImdbIds(movies, concurrency = 8) {
  const out = [];
  for (let i = 0; i < movies.length; i += concurrency) {
    const chunk = movies.slice(i, i + concurrency);
    const enriched = await Promise.all(
      chunk.map(async (movie) => {
        try {
          const imdbId = await getImdbId(movie.id);
          return { ...movie, imdb_id: imdbId };
        } catch {
          return { ...movie, imdb_id: null };
        }
      })
    );
    out.push(...enriched);
  }
  return out;
}

export function posterUrl(posterPath) {
  if (!posterPath) return null;
  return `${config.tmdbImageBase}${posterPath}`;
}
