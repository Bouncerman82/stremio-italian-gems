/**
 * Filtri Discover: genere, anno, mood, popolari, shuffle.
 */

/**
 * Mood → generi TMDB.
 * Chiavi uguali per film e serie; gli ID differiscono dove TMDB li separa.
 */
export const MOODS_MOVIE = {
  Avventuroso: { genres: [12, 28, 37], short: 'AVV' },
  'Azione pura': { genres: [28, 53], short: 'AZI' },
  'Nostalgico/Toccante': { genres: [18, 10749, 10751], short: 'NOST' },
  'Tensione/Giallo': { genres: [80, 53, 27], short: 'GIAL' },
  'Risate e Leggerezza': { genres: [35, 10402], short: 'COM' },
  'Mistero/Cospirazione': { genres: [9648, 878, 53], short: 'MIST' },
  'Epico/Storico': { genres: [36, 10752, 12], short: 'EPI' },
  'Notte Horror': { genres: [27, 53, 9648], short: 'HOR' },
  'Cuore/Romance': { genres: [10749, 18, 35], short: 'ROM' },
  'Fantascienza/Futuro': { genres: [878, 12, 28], short: 'SCI' },
  'Fantasy/Magia': { genres: [14, 12, 10751], short: 'FAN' },
  'Famiglia/Kids': { genres: [10751, 16, 35], short: 'FAM' },
  'Documentario/Reale': { genres: [99], short: 'DOC' },
  'Guerra/Conflitto': { genres: [10752, 36, 28], short: 'GUE' },
  Western: { genres: [37], short: 'WES' },
  'Crime/Noir': { genres: [80, 53, 9648], short: 'CRI' },
  'Musica/Spettacolo': { genres: [10402, 35, 18], short: 'MUS' },
  'Animazione': { genres: [16, 10751, 14], short: 'ANI' },
  'Mind-bending': { genres: [9648, 878, 53], short: 'MIN' },
  'Feel-good': { genres: [35, 10749, 10751], short: 'FEE' },
  'Dark/Dramma intenso': { genres: [18, 80, 53], short: 'DRK' },
  'Thriller da brivido': { genres: [53, 27, 9648], short: 'THR' },
};

/** Stessi mood, ID generi TV TMDB. */
export const MOODS_TV = {
  Avventuroso: { genres: [10759, 37], short: 'AVV' },
  'Azione pura': { genres: [10759], short: 'AZI' },
  'Nostalgico/Toccante': { genres: [18, 10751], short: 'NOST' },
  'Tensione/Giallo': { genres: [80, 9648], short: 'GIAL' },
  'Risate e Leggerezza': { genres: [35], short: 'COM' },
  'Mistero/Cospirazione': { genres: [9648, 10765], short: 'MIST' },
  'Epico/Storico': { genres: [10768, 18], short: 'EPI' },
  'Notte Horror': { genres: [9648, 80], short: 'HOR' },
  'Cuore/Romance': { genres: [18, 35, 10766], short: 'ROM' },
  'Fantascienza/Futuro': { genres: [10765, 10759], short: 'SCI' },
  'Fantasy/Magia': { genres: [10765, 16, 10751], short: 'FAN' },
  'Famiglia/Kids': { genres: [10751, 10762, 16], short: 'FAM' },
  'Documentario/Reale': { genres: [99, 10764], short: 'DOC' },
  'Guerra/Conflitto': { genres: [10768, 10759], short: 'GUE' },
  Western: { genres: [37], short: 'WES' },
  'Crime/Noir': { genres: [80, 9648, 18], short: 'CRI' },
  'Musica/Spettacolo': { genres: [35, 10767], short: 'MUS' },
  Animazione: { genres: [16, 10762], short: 'ANI' },
  'Mind-bending': { genres: [9648, 10765], short: 'MIN' },
  'Feel-good': { genres: [35, 10751], short: 'FEE' },
  'Dark/Dramma intenso': { genres: [18, 80], short: 'DRK' },
  'Thriller da brivido': { genres: [80, 9648], short: 'THR' },
};

/** @deprecated alias — preferire MOODS_MOVIE */
export const MOODS = MOODS_MOVIE;

/** Generi TMDB film */
export const MOVIE_GENRES = {
  Azione: [28],
  Avventura: [12],
  Animazione: [16],
  Commedia: [35],
  Crime: [80],
  Documentario: [99],
  Dramma: [18],
  Famiglia: [10751],
  Fantasy: [14],
  Storia: [36],
  Horror: [27],
  Musica: [10402],
  Mistero: [9648],
  Romance: [10749],
  Fantascienza: [878],
  'Film TV': [10770],
  Thriller: [53],
  Guerra: [10752],
  Western: [37],
};

/** Generi TMDB serie (sovrapposizione ampia) */
export const TV_GENRES = {
  Azione: [10759],
  Animazione: [16],
  Commedia: [35],
  Crime: [80],
  Documentario: [99],
  Dramma: [18],
  Famiglia: [10751],
  Kids: [10762],
  Mistero: [9648],
  News: [10763],
  Reality: [10764],
  Fantascienza: [10765],
  Soap: [10766],
  Talk: [10767],
  Guerra: [10768],
  Western: [37],
};

export const POPOLARI_GENRE = 'Popolari — ultimi 2 mesi';
export const TOP100_GENRE = 'Top 100 — voto 6,5+';
/** Soglia minima voto TMDB per la Top 100 (film e serie). */
export const TOP100_MIN_VOTE = 6.5;

/** Prefissi menu Genere (Android TV: un solo filtro alla volta). */
export const GENRE_PREFIX = {
  anno: 'Anno · ',
  anni: 'Anni · ',
  mood: 'Mood · ',
  paese: 'Paese · ',
  intervallo: 'Intervallo · ',
};

/** Paesi in evidenza sotto Genere (lista corta per TV). */
export const TV_GENRE_COUNTRIES = [
  'Italia',
  'Stati Uniti',
  'Regno Unito',
  'Francia',
  'Spagna',
  'Germania',
  'Giappone',
  'Corea del Sud',
];

/** Fasce anni nel menu Genere. */
export const YEAR_RANGE_OPTIONS = [
  { label: 'Anni · 2010-2019', gte: 2010, lte: 2019 },
  { label: 'Anni · 2000-2009', gte: 2000, lte: 2009 },
  { label: 'Anni · pre-2000', gte: null, lte: 1999 },
];

/** Intervalli sotto Genere (etichette corte per TV). */
export const GENRE_INTERVAL_OPTIONS = [
  { label: 'Intervallo · Sempre nuovo', seconds: 0 },
  { label: 'Intervallo · 5 min', seconds: 300 },
  { label: 'Intervallo · 30 min', seconds: 1800 },
  { label: 'Intervallo · 1 ora', seconds: 3600 },
];

function yearGenreOptions(count = 25) {
  const current = new Date().getFullYear();
  const out = [];
  for (let y = current; y > current - count; y--) {
    out.push(`${GENRE_PREFIX.anno}${y}`);
  }
  return out;
}

export function genreOptionsFor(mediaType) {
  const map = mediaType === 'series' ? TV_GENRES : MOVIE_GENRES;
  const moods = mediaType === 'series' ? MOODS_TV : MOODS_MOVIE;
  // Speciali + filtri TV (prefissi) + generi TMDB
  return [
    POPOLARI_GENRE,
    TOP100_GENRE,
    ...yearGenreOptions(25),
    ...YEAR_RANGE_OPTIONS.map((r) => r.label),
    ...Object.keys(moods).map((m) => `${GENRE_PREFIX.mood}${m}`),
    ...TV_GENRE_COUNTRIES.map((c) => `${GENRE_PREFIX.paese}${c}`),
    ...GENRE_INTERVAL_OPTIONS.map((i) => i.label),
    'Tutti i generi',
    ...Object.keys(map).sort((a, b) => a.localeCompare(b, 'it')),
  ];
}

export function isPopolariGenre(genreName) {
  if (!genreName) return false;
  const v = String(genreName).toLowerCase();
  // Evita falsi positivi su altre voci
  if (v.startsWith('anno') || v.startsWith('anni') || v.startsWith('mood') ||
      v.startsWith('paese') || v.startsWith('intervallo')) {
    return false;
  }
  return v.includes('popolari') || v.includes('ultimi 2');
}

export function isTop100Genre(genreName) {
  if (!genreName) return false;
  const v = String(genreName).toLowerCase();
  if (v.startsWith('anno') || v.startsWith('anni') || v.startsWith('mood') ||
      v.startsWith('paese') || v.startsWith('intervallo')) {
    return false;
  }
  return (
    v.includes('top 100') ||
    v.includes('top100') ||
    v.includes('voti alti') ||
    v.includes('voto 6')
  );
}

/** Genere “speciale” (non TMDB): Popolari / Top 100. */
export function isSpecialCatalogGenre(genreName) {
  return isPopolariGenre(genreName) || isTop100Genre(genreName);
}

/**
 * Parser della scelta Genere (TV + desktop).
 * @returns {{
 *   special: 'popolari'|'top100'|null,
 *   year: number|null,
 *   yearRange: { gte: number|null, lte: number|null }|null,
 *   mood: string|null,
 *   originCountry: string|null,
 *   intervalSec: number|null,
 *   tmdbGenreIds: number[],
 * }}
 */
export function parseGenreSelection(genreName, mediaType = 'movie') {
  const empty = {
    special: null,
    year: null,
    yearRange: null,
    mood: null,
    originCountry: null,
    intervalSec: null,
    tmdbGenreIds: [],
  };
  if (!genreName || String(genreName).startsWith('Tutti')) return empty;

  const raw = String(genreName).trim();

  if (isPopolariGenre(raw)) {
    return { ...empty, special: 'popolari' };
  }
  if (isTop100Genre(raw)) {
    return { ...empty, special: 'top100' };
  }

  if (raw.startsWith(GENRE_PREFIX.anno)) {
    const y = Number(raw.slice(GENRE_PREFIX.anno.length).trim());
    return { ...empty, year: Number.isFinite(y) ? y : null };
  }

  if (raw.startsWith(GENRE_PREFIX.anni) || raw.startsWith('Anni ·')) {
    const range = YEAR_RANGE_OPTIONS.find((r) => r.label === raw);
    if (range) {
      return { ...empty, yearRange: { gte: range.gte, lte: range.lte } };
    }
    // fallback: "Anni · 2010-2019" / "Anni · pre-2000"
    const body = raw.replace(/^Anni\s*[·•\-–—]\s*/i, '').trim();
    if (/^pre-?2000$/i.test(body)) {
      return { ...empty, yearRange: { gte: null, lte: 1999 } };
    }
    const m = body.match(/(\d{4})\s*[-–—]\s*(\d{4})/);
    if (m) {
      return {
        ...empty,
        yearRange: { gte: Number(m[1]), lte: Number(m[2]) },
      };
    }
    return empty;
  }

  if (raw.startsWith(GENRE_PREFIX.mood)) {
    const mood = raw.slice(GENRE_PREFIX.mood.length).trim();
    const ids = resolveMoodGenreIds(mood, mediaType);
    return { ...empty, mood: mood || null, tmdbGenreIds: ids };
  }

  if (raw.startsWith(GENRE_PREFIX.paese)) {
    const paese = raw.slice(GENRE_PREFIX.paese.length).trim();
    return { ...empty, originCountry: parseOriginCountry(paese) };
  }

  if (raw.startsWith(GENRE_PREFIX.intervallo)) {
    const body = raw.slice(GENRE_PREFIX.intervallo.length).trim();
    const known = GENRE_INTERVAL_OPTIONS.find((i) => i.label === raw);
    if (known) {
      return { ...empty, intervalSec: known.seconds };
    }
    return { ...empty, intervalSec: parseIntervalSeconds(body, 0) };
  }

  // Genere TMDB classico
  const map = mediaType === 'series' || mediaType === 'tv' ? TV_GENRES : MOVIE_GENRES;
  const ids = map[raw] || [];
  return { ...empty, tmdbGenreIds: ids };
}

export function moodOptions() {
  return ['Tutti i mood', ...Object.keys(MOODS_MOVIE)];
}

export function yearOptions() {
  const current = new Date().getFullYear();
  const years = ['Tutti gli anni'];
  for (let y = current; y >= 1950; y--) years.push(String(y));
  return years;
}

/** Intervallo = quanto dura lo stesso ordine se esci e rientri (Stremio non auto-refresh). */
export const INTERVAL_OPTIONS = [
  'Nuovo ordine a ogni apertura',
  'Mantieni lo stesso ordine 5 min',
  'Mantieni lo stesso ordine 30 min',
  'Mantieni lo stesso ordine 1 ora',
];

export function resolveGenreIds(mediaType, genreName) {
  if (
    !genreName ||
    genreName.startsWith('Tutti') ||
    isSpecialCatalogGenre(genreName)
  ) {
    return [];
  }
  // Prefissi TV (Anno/Mood/Paese/Intervallo): non sono generi TMDB
  const raw = String(genreName);
  if (
    raw.startsWith(GENRE_PREFIX.anno) ||
    raw.startsWith(GENRE_PREFIX.anni) ||
    raw.startsWith('Anni ·') ||
    raw.startsWith(GENRE_PREFIX.mood) ||
    raw.startsWith(GENRE_PREFIX.paese) ||
    raw.startsWith(GENRE_PREFIX.intervallo)
  ) {
    // Mood sotto Genere → ID mood; altri prefissi → nessun genere
    if (raw.startsWith(GENRE_PREFIX.mood)) {
      return resolveMoodGenreIds(raw.slice(GENRE_PREFIX.mood.length).trim(), mediaType);
    }
    return [];
  }
  const map = mediaType === 'series' ? TV_GENRES : MOVIE_GENRES;
  return map[genreName] || [];
}

export function resolveMoodGenreIds(moodName, mediaType = 'movie') {
  if (!moodName || moodName.startsWith('Tutti')) return [];
  const map = mediaType === 'series' || mediaType === 'tv' ? MOODS_TV : MOODS_MOVIE;
  return map[moodName]?.genres || [];
}

export function mergeGenreIds(genreIds, moodIds) {
  if (!genreIds.length) return moodIds;
  if (!moodIds.length) return genreIds;
  return [...new Set([...genreIds, ...moodIds])];
}

/** @deprecated Shuffle sempre ON. */
export function parseShuffleOn(_value) {
  return true;
}

/**
 * Quanto tenere lo stesso ordine se l’utente esce e rientra.
 * Default: nuovo mix a ogni apertura (~0 → seed cambia subito).
 */
export function parseIntervalSeconds(value, fallback = 0) {
  if (value === undefined || value === null || value === '') return fallback;
  const v = String(value).toLowerCase();
  if (v.includes('ogni apertura') || v.includes('sempre nuovo') || v.includes('0 sec')) {
    return 0;
  }
  // legacy labels
  if (v.includes('30 sec')) return 0; // inutile senza auto-refresh → tratta come ogni apertura
  if (v.includes('3 min')) return 180;
  if (v.includes('5 min') || (v.includes('mantieni') && v.includes('5'))) return 300;
  if (v.includes('30 min') || (v.includes('mantieni') && v.includes('30'))) return 1800;
  if (v.includes('1 ora') || v.includes('1 h') || (v.includes('mantieni') && v.includes('1 ora')))
    return 3600;
  if (v.includes('mantieni') && v.includes('1')) return 3600;
  const m = v.match(/(\d+)/);
  return m ? Number(m[1]) : fallback;
}

export function wantsPopolari(value) {
  if (!value) return false;
  const v = String(value).toLowerCase();
  if (v.includes('popolari: no') || v === 'no') return false;
  return (
    v.includes('popolari') ||
    v.startsWith('sì') ||
    v.startsWith('si') ||
    v.includes('ultimi 2')
  );
}

export function parseYear(value) {
  if (!value || String(value).startsWith('Tutti')) return null;
  const y = Number(value);
  return Number.isFinite(y) ? y : null;
}

/** Paese di produzione (etichetta IT → ISO 3166-1). */
export const PRODUCTION_COUNTRIES = {
  Italia: 'IT',
  'Stati Uniti': 'US',
  'Regno Unito': 'GB',
  Francia: 'FR',
  Germania: 'DE',
  Spagna: 'ES',
  Giappone: 'JP',
  'Corea del Sud': 'KR',
  Cina: 'CN',
  India: 'IN',
  Canada: 'CA',
  Australia: 'AU',
  Brasile: 'BR',
  Messico: 'MX',
  Argentina: 'AR',
  Russia: 'RU',
  Svezia: 'SE',
  Norvegia: 'NO',
  Danimarca: 'DK',
  'Paesi Bassi': 'NL',
  Belgio: 'BE',
  Svizzera: 'CH',
  Austria: 'AT',
  Polonia: 'PL',
  Portogallo: 'PT',
  Grecia: 'GR',
  Turchia: 'TR',
  Irlanda: 'IE',
  'Nuova Zelanda': 'NZ',
  'Hong Kong': 'HK',
  Taiwan: 'TW',
  Thailandia: 'TH',
  Indonesia: 'ID',
  Filippine: 'PH',
  'Sudafrica': 'ZA',
  Israele: 'IL',
  Egitto: 'EG',
  Nigeria: 'NG',
};

export function countryOptions() {
  const names = Object.keys(PRODUCTION_COUNTRIES).sort((a, b) =>
    a.localeCompare(b, 'it')
  );
  // Italia in evidenza subito dopo "Tutti"
  const withoutIt = names.filter((n) => n !== 'Italia');
  return ['Tutti i paesi', 'Italia', ...withoutIt];
}

export function parseOriginCountry(value) {
  if (!value || String(value).startsWith('Tutti')) return null;
  const v = String(value).trim();
  if (PRODUCTION_COUNTRIES[v]) return PRODUCTION_COUNTRIES[v];
  // fallback: "Italia (IT)" o codice grezzo
  const m = v.match(/\(([A-Z]{2})\)\s*$/);
  if (m) return m[1];
  if (/^[A-Za-z]{2}$/.test(v)) return v.toUpperCase();
  return null;
}

/** ISO paese → etichetta corta badge (ITA, USA, GER…). */
const COUNTRY_LABELS = {
  IT: 'ITA',
  US: 'USA',
  GB: 'GBR',
  UK: 'GBR',
  EN: 'ENG',
  DE: 'GER',
  FR: 'FRA',
  ES: 'ESP',
  JP: 'JPN',
  KR: 'KOR',
  CN: 'CHN',
  BR: 'BRA',
  MX: 'MEX',
  CA: 'CAN',
  AU: 'AUS',
  IN: 'IND',
  RU: 'RUS',
  SE: 'SWE',
  NO: 'NOR',
  DK: 'DEN',
  NL: 'NED',
  BE: 'BEL',
  CH: 'SUI',
  AT: 'AUT',
  PL: 'POL',
  PT: 'POR',
  GR: 'GRE',
  TR: 'TUR',
  AR: 'ARG',
};

export function countryBadge(item) {
  const fromArray =
    item.production_countries?.[0]?.iso_3166_1 ||
    item.origin_country?.[0] ||
    null;
  const lang = item.original_language;
  const iso = fromArray || (lang === 'en' ? 'US' : lang?.toUpperCase?.() === 'IT' ? 'IT' : null);
  if (!iso) return 'INT';
  return COUNTRY_LABELS[iso] || iso.slice(0, 3).toUpperCase();
}

export function commonExtras(mediaType) {
  return [
    { name: 'genre', isRequired: false, options: genreOptionsFor(mediaType) },
    { name: 'anno', isRequired: false, options: yearOptions() },
    { name: 'mood', isRequired: false, options: moodOptions() },
    { name: 'paese', isRequired: false, options: countryOptions() },
    { name: 'intervallo', isRequired: false, options: INTERVAL_OPTIONS },
    { name: 'skip', isRequired: false },
  ];
}
