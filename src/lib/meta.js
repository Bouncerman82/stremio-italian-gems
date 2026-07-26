import { posterUrl } from '../services/tmdb.js';
import { countryBadge } from '../lib/filters.js';

/** Prefisso unico: evita che Cinemeta “rubi” la scheda e rompa i tag Genere. */
export function toAddonId(item) {
  if (item.imdb_id) return `igems:${item.imdb_id}`;
  return `igems:tmdb:${item.id}`;
}

/**
 * Meta preview per catalogo Stremio.
 */
export function toStremioMeta(item, options = {}) {
  const { customPosterUrl, mediaType = 'movie' } = options;
  const type = mediaType === 'tv' || mediaType === 'series' ? 'series' : 'movie';
  const id = toAddonId(item);
  const rating = Number(item.vote_average || 0).toFixed(1);
  const title =
    item.title || item.name || item.original_title || item.original_name || 'Senza titolo';
  const date = item.release_date || item.first_air_date || '';
  const country = countryBadge(item);

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
