import 'dotenv/config';

const port = Number(process.env.PORT) || 7000;
const BEAMUP_FALLBACK =
  'https://1db6964a221d-stremio-italian-gems.baby-beamup.club';

function isLikelyHosted() {
  return Boolean(
    process.env.DYNO ||
      process.env.DOKKU_APP_TYPE ||
      process.env.HEROKU ||
      process.env.RENDER ||
      process.env.RENDER_EXTERNAL_URL
  );
}

/** URL pubblico: env HTTPS, altrimenti host Beamup (mai localhost in hosting). */
function resolvePublicBaseUrl() {
  const fromEnv = (process.env.PUBLIC_BASE_URL || process.env.BEAMUP_URL || '')
    .trim()
    .replace(/\/$/, '');
  const hosted = isLikelyHosted();

  if (fromEnv && !(hosted && /localhost|127\.0\.0\.1/i.test(fromEnv))) {
    return fromEnv;
  }
  if (process.env.RENDER_EXTERNAL_URL) {
    return String(process.env.RENDER_EXTERNAL_URL).replace(/\/$/, '');
  }
  if (hosted) return BEAMUP_FALLBACK;
  return fromEnv || `http://localhost:${port}`;
}

const publicBaseUrl = resolvePublicBaseUrl();
const isProd = publicBaseUrl.startsWith('https://');

export const config = {
  port,
  publicBaseUrl,
  tmdbApiKey: process.env.TMDB_API_KEY || '',
  tmdbBaseUrl: 'https://api.themoviedb.org/3',
  tmdbImageBase: 'https://image.tmdb.org/t/p/w500',
  language: 'it-IT',
  originCountry: 'IT',
  /** Pagine “rapide” (fallback / popolari). */
  tmdbPages: Number(process.env.TMDB_PAGES || 25),
  /**
   * Pool massimo per shuffle ampio (year-sharding TMDB).
   * TMDB espone anche 100k+ titoli, ma max 500 pagine (10k) per singola query:
   * per arrivare oltre si scarica anno per anno.
   */
  tmdbMaxPool: Number(process.env.TMDB_MAX_POOL || 100000),
  /** vote_count minimo (1 = molto più ampio di 20). */
  tmdbVoteMin: Number(process.env.TMDB_VOTE_MIN || 1),
  /** Anno più vecchio nello sharding. */
  tmdbYearStart: Number(process.env.TMDB_YEAR_START || 1950),
  /**
   * Concorrenza richieste TMDB.
   * Default più basso in produzione (HTTPS) per ridurre 429.
   */
  tmdbConcurrency: Number(
    process.env.TMDB_CONCURRENCY || (isProd ? 4 : 8)
  ),
  /** Cache dati discover (secondi). Default 6 ore. */
  dataCacheSeconds: Number(process.env.DATA_CACHE_SECONDS ?? 6 * 3600),
  /** Cache disco del pool ampio (secondi). Default 7 giorni. */
  poolDiskCacheSeconds: Number(process.env.POOL_DISK_CACHE_SECONDS ?? 7 * 24 * 60 * 60),
  /** TTL probe totale TMDB (ms). Default 5 min in prod, 90s in locale. */
  tmdbProbeMaxAgeMs: Number(
    process.env.TMDB_PROBE_MAX_AGE_MS ?? (isProd ? 300_000 : 90_000)
  ),
  /** Shuffle default se manca extra (secondi). */
  shuffleDefaultSeconds: 300,
  /**
   * Poster custom (sharp): badge paese verde sulla locandina.
   * Default ON. Disattiva con CUSTOM_POSTERS=0 (es. hosting free in OOM).
   */
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
  if (isProd && !config.publicBaseUrl.startsWith('https://')) {
    console.warn(
      '\n⚠️  PUBLIC_BASE_URL dovrebbe essere HTTPS in produzione (Stremio lo richiede).\n'
    );
  }
}
