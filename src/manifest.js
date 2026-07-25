import { config } from './config.js';
import {
  GENRE_OPTIONS,
  INTERVAL_OPTIONS,
  SHUFFLE_OPTIONS,
} from './lib/moods.js';

/**
 * Extra comuni a tutti i cataloghi:
 * - genre: molti generi + mood
 * - shuffle: attiva/disattiva mescolamento (menu in Discover)
 * - intervallo: ogni quanto rimescolare
 * - skip: paginazione Stremio
 */
const commonExtras = [
  {
    name: 'genre',
    isRequired: false,
    options: GENRE_OPTIONS,
  },
  {
    name: 'shuffle',
    isRequired: false,
    options: SHUFFLE_OPTIONS,
  },
  {
    name: 'intervallo',
    isRequired: false,
    options: INTERVAL_OPTIONS,
  },
  { name: 'skip', isRequired: false },
];

/**
 * Manifest Stremio: descrive chi siamo e quali cataloghi offriamo.
 * Stremio lo legge da GET /manifest.json
 *
 * Nota: in Discover i "pulsanti" sono i menu a tendina degli extra.
 */
export const manifest = {
  id: 'com.italian.gems.shuffle',
  version: '1.2.1',
  name: 'Italian Gems Shuffle',
  description:
    'Film italiani: gemme nascoste, tanti generi/mood, shuffle e timer di rimescolamento.',
  logo: `${config.publicBaseUrl}/logo.png`,
  background:
    'https://image.tmdb.org/t/p/original/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg',
  resources: ['catalog'],
  types: ['movie'],
  idPrefixes: ['tt', 'tmdb'],
  catalogs: [
    {
      id: 'it_gems',
      type: 'movie',
      name: 'Gemme Nascoste IT',
      extra: commonExtras,
    },
    {
      id: 'it_mood',
      type: 'movie',
      name: 'Generi & Mood IT',
      extra: commonExtras,
    },
    {
      id: 'it_popular',
      type: 'movie',
      name: 'Cinema Italiano',
      extra: commonExtras,
    },
  ],
};
