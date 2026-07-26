import { posterUrl } from '../services/tmdb.js';

/**
 * ID Stremio standard = IMDb (tt…).
 * Così Torrentio e gli altri addon di stream riconoscono il titolo.
 * Senza imdb_id → null (il catalogo lo salta).
 */
export function toAddonId(item) {
  const imdb = item.imdb_id || item.imdbId || null;
  if (imdb && String(imdb).startsWith('tt')) return String(imdb);
  return null;
}

/**
 * Meta preview per catalogo Stremio.
 * @returns {object|null}
 */
export function toStremioMeta(item, options = {}) {
  const { customPosterUrl, mediaType = 'movie' } = options;
  const type = mediaType === 'tv' || mediaType === 'series' ? 'series' : 'movie';
  const id = toAddonId(item);
  if (!id) return null;

  const rating = Number(item.vote_average || 0).toFixed(1);
  const title =
    item.title || item.name || item.original_title || item.original_name || 'Senza titolo';
  const date = item.release_date || item.first_air_date || '';

  return {
    id,
    type,
    name: title,
    poster: customPosterUrl || posterUrl(item.poster_path),
    posterShape: 'poster',
    background: item.backdrop_path
      ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}`
      : undefined,
    description: item.overview || undefined,
    releaseInfo: date ? date.slice(0, 4) : undefined,
    imdbRating: rating,
    // mai genres qui: Stremio crea chip Discover → "addon non installato"
  };
}
