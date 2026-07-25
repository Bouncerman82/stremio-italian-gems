import { config } from '../config.js';

/**
 * Algoritmo "Gemme Nascoste":
 * rating alto (>= 7.0) + popolarità bassa/media.
 */
export function isHiddenGem(movie) {
  const rating = Number(movie.vote_average ?? 0);
  const popularity = Number(movie.popularity ?? 0);
  return rating >= config.gemMinRating && popularity <= config.gemMaxPopularity;
}

export function filterHiddenGems(movies) {
  return movies.filter(isHiddenGem);
}
