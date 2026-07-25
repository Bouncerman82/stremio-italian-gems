import { posterUrl } from '../services/tmdb.js';

/**
 * Converte un film TMDB nel formato Meta Preview di Stremio.
 * Preferisce id IMDb (tt...) così Cinemeta/stream addon funzionano meglio.
 */
export function toStremioMeta(movie, options = {}) {
  const { moodLabel, customPosterUrl } = options;
  const id = movie.imdb_id || `tmdb:${movie.id}`;
  const rating = Number(movie.vote_average || 0).toFixed(1);
  const langTag =
    movie.original_language === 'it'
      ? 'IT'
      : (movie.original_language || '').toUpperCase();

  const descriptionParts = [];
  if (movie.overview) descriptionParts.push(movie.overview);
  descriptionParts.push(`Voto TMDB: ${rating}/10 · Lingua: ${langTag}`);
  if (moodLabel) descriptionParts.push(`Mood: ${moodLabel}`);

  return {
    id,
    type: 'movie',
    name: movie.title || movie.original_title || 'Senza titolo',
    poster: customPosterUrl || posterUrl(movie.poster_path),
    posterShape: 'poster',
    background: movie.backdrop_path
      ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}`
      : undefined,
    description: descriptionParts.join('\n\n'),
    releaseInfo: movie.release_date ? movie.release_date.slice(0, 4) : undefined,
    imdbRating: rating,
    genres: moodLabel ? [moodLabel] : undefined,
  };
}
