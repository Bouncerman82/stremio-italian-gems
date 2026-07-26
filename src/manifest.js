import { config } from './config.js';
import { commonExtras } from './lib/filters.js';
import { ADDON_DESCRIPTION } from './lib/copy.js';

/**
 * idPrefixes:
 * - tt → titoli IMDb: gli addon torrent/stream li riconoscono
 * - igems → solo tile info catalogo (non riproducibile)
 */
export const manifest = {
  id: 'com.italian.gems.shuffle',
  version: '3.2.1',
  name: 'Italian Gems',
  description: ADDON_DESCRIPTION,
  logo: `${config.publicBaseUrl}/logo-v30.png`,
  background:
    'https://image.tmdb.org/t/p/original/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg',
  resources: ['catalog', 'meta', 'stream'],
  types: ['movie', 'series'],
  idPrefixes: ['tt', 'igems'],
  catalogs: [
    {
      id: 'gemme_film',
      type: 'movie',
      name: 'Gemme FILM',
      extra: commonExtras('movie'),
    },
    {
      id: 'gemme_serie',
      type: 'series',
      name: 'Gemme SERIE',
      extra: commonExtras('series'),
    },
  ],
};
