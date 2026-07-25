/**
 * Generi TMDB (italiani) + Mood preset.
 * Usati come opzioni del filtro "genre" in Stremio Discover.
 */

/** Mood → uno o più genre id TMDB */
export const MOODS = {
  'Mood: Avventuroso': {
    genres: [12, 28, 37],
    short: 'AVV',
  },
  'Mood: Nostalgico/Toccante': {
    genres: [18, 10749, 10751],
    short: 'NOST',
  },
  'Mood: Tensione/Giallo': {
    genres: [80, 53, 27],
    short: 'GIAL',
  },
  'Mood: Risate e Leggerezza': {
    genres: [35, 10402],
    short: 'COM',
  },
  'Mood: Mistero/Cospirazione': {
    genres: [9648, 878, 53],
    short: 'MIST',
  },
  'Mood: Epico/Storico': {
    genres: [36, 10752, 12],
    short: 'EPI',
  },
  'Mood: Notte Horror': {
    genres: [27, 53, 9648],
    short: 'HOR',
  },
  'Mood: Cuore/Romance': {
    genres: [10749, 18, 35],
    short: 'ROM',
  },
};

/** Singoli generi TMDB (film) */
export const TMDB_GENRES = {
  Azione: { genres: [28], short: 'AZ' },
  Avventura: { genres: [12], short: 'AVV' },
  Animazione: { genres: [16], short: 'ANIM' },
  Commedia: { genres: [35], short: 'COM' },
  Crime: { genres: [80], short: 'CRI' },
  Documentario: { genres: [99], short: 'DOC' },
  Dramma: { genres: [18], short: 'DRA' },
  Famiglia: { genres: [10751], short: 'FAM' },
  Fantasy: { genres: [14], short: 'FAN' },
  Storia: { genres: [36], short: 'STO' },
  Horror: { genres: [27], short: 'HOR' },
  Musica: { genres: [10402], short: 'MUS' },
  Mistero: { genres: [9648], short: 'MIS' },
  Romance: { genres: [10749], short: 'ROM' },
  Fantascienza: { genres: [878], short: 'SCI' },
  'Film TV': { genres: [10770], short: 'TV' },
  Thriller: { genres: [53], short: 'THR' },
  Guerra: { genres: [10752], short: 'GUE' },
  Western: { genres: [37], short: 'WES' },
  // Combinazioni utili
  'Azione + Thriller': { genres: [28, 53], short: 'A+T' },
  'Commedia + Romance': { genres: [35, 10749], short: 'C+R' },
  'Dramma + Storia': { genres: [18, 36], short: 'D+S' },
  'Crime + Giallo': { genres: [80, 9648], short: 'C+G' },
  'Horror + Thriller': { genres: [27, 53], short: 'H+T' },
  'Fantasy + Avventura': { genres: [14, 12], short: 'F+A' },
};

export const ALL_GENRE_FILTERS = {
  ...MOODS,
  ...TMDB_GENRES,
};

/** Elenco ordinato per il manifest (mood prima, poi generi A→Z). */
export const GENRE_OPTIONS = [
  ...Object.keys(MOODS),
  ...Object.keys(TMDB_GENRES).sort((a, b) => a.localeCompare(b, 'it')),
];

export function resolveGenre(name) {
  if (!name) return null;
  return ALL_GENRE_FILTERS[name] || null;
}

/** Retrocompatibilità con vecchio nome resolveMood */
export function resolveMood(name) {
  return resolveGenre(name);
}

export function moodBadgeLabel(name) {
  const entry = resolveGenre(name);
  if (entry?.short) return entry.short;
  if (!name) return 'IT';
  return String(name).slice(0, 4).toUpperCase();
}

/** Opzioni menu Shuffle in Discover */
export const SHUFFLE_OPTIONS = ['Mescola: SÌ', 'Mescola: NO'];

/** Opzioni timer rimescolamento */
export const INTERVAL_OPTIONS = [
  'Ogni volta',
  'Ogni 1 ora',
  'Ogni 3 ore',
  'Ogni 6 ore',
  'Ogni 12 ore',
  'Ogni 24 ore',
];

export function parseShuffleExtra(value) {
  if (value === undefined || value === null || value === '') return true;
  const v = String(value).toLowerCase();
  if (v.includes('no') || v.includes('fisso') || v.includes('off')) return false;
  if (v === 'si' || v === 'sì' || v.includes('sì') || v.includes('mescola')) return true;
  return true;
}

/** Converte la scelta UI in ore di cache (0 = sempre). */
export function parseIntervalHours(value, fallbackHours = 6) {
  if (value === undefined || value === null || value === '') return fallbackHours;
  const v = String(value).toLowerCase();
  if (v.includes('volta') || v.includes('sempre')) return 0;
  const match = v.match(/(\d+)/);
  if (match) return Number(match[1]);
  return fallbackHours;
}
