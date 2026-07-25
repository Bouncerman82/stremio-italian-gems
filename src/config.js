import 'dotenv/config';

/**
 * Configurazione centrale dell'add-on.
 * Tutti i valori sensibili arrivano da variabili d'ambiente (.env).
 */
const port = Number(process.env.PORT) || 7000;

export const config = {
  port,
  /** URL pubblico raggiunto da Stremio (localhost in sviluppo). */
  publicBaseUrl: (process.env.PUBLIC_BASE_URL || `http://localhost:${port}`).replace(/\/$/, ''),
  tmdbApiKey: process.env.TMDB_API_KEY || '',
  tmdbBaseUrl: 'https://api.themoviedb.org/3',
  tmdbImageBase: 'https://image.tmdb.org/t/p/w500',
  language: 'it-IT',
  originCountry: 'IT',
  /** Pagine TMDB da recuperare per cataloghi estesi (shuffle). */
  tmdbPages: 8,
  /** Rating minimo per le "Gemme Nascoste". */
  gemMinRating: 7.0,
  /** Soglia massima di popolarità TMDB per considerare un film "nascosto". */
  gemMaxPopularity: 40,
  /**
   * Ore di validità della cache shuffle.
   * 0 = rimescola sempre (ad ogni richiesta).
   */
  shuffleCacheHours: Number(process.env.SHUFFLE_CACHE_HOURS ?? 6),
  /** Se true, genera locandine custom con badge (sharp). */
  customPosters: process.env.CUSTOM_POSTERS !== '0',
};

export function assertConfig() {
  if (!config.tmdbApiKey || config.tmdbApiKey === 'la_tua_chiave_tmdb_qui') {
    console.warn(
      '\n⚠️  TMDB_API_KEY mancante o non configurata.\n' +
        '   1. Copia .env.example in .env\n' +
        '   2. Inserisci la chiave da https://www.themoviedb.org/settings/api\n'
    );
  }
}
