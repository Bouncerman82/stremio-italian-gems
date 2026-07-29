import { config } from '../config.js';
import { formatMetaBlocks } from '../lib/copy.js';
import {
  countryBadge,
  isPopolariGenre,
  resolveGenreIds,
} from '../lib/filters.js';
import {
  discoverMovies,
  discoverSeries,
  findByImdb,
  getMovieDetails,
  getPersonDetails,
  getTvDetails,
  posterUrl,
  profileUrl,
  tmdbFetch,
} from './tmdb.js';

function schedaPageUrl(mediaType, tmdbId) {
  return `${config.publicBaseUrl}/scheda/${mediaType}/${tmdbId}`;
}

function genrePageUrl(type, genreName, backHref) {
  const q = new URLSearchParams({
    type: type === 'series' ? 'series' : 'movie',
  });
  if (backHref) q.set('back', backHref);
  return `${config.publicBaseUrl}/genere/${encodeURIComponent(genreName)}?${q.toString()}`;
}

function personPageUrl(personId, { mediaType, mediaId, ruolo, backHref }) {
  const q = new URLSearchParams({
    mediaType: mediaType || 'movie',
    mediaId: String(mediaId || ''),
    ruolo: ruolo || '',
  });
  if (backHref) q.set('back', backHref);
  return `${config.publicBaseUrl}/persona/${personId}?${q.toString()}`;
}

function tramaPageUrl(mediaType, tmdbId) {
  return `${config.publicBaseUrl}/trama/${mediaType}/${tmdbId}`;
}

/**
 * Supporta: tt… | tt…:season:ep | igems:tt… | igems:tmdb:123 | tmdb:123
 */
async function resolveTmdbFromStremioId(type, id) {
  let raw = String(id || '');
  if (raw.startsWith('igems:')) raw = raw.slice('igems:'.length);

  // Episodio serie Stremio: tt1234567:1:5 → usa solo IMDb
  if (raw.startsWith('tt') && raw.includes(':')) {
    raw = raw.split(':')[0];
  }

  if (raw.startsWith('tmdb:')) {
    return { tmdbId: Number(raw.replace('tmdb:', '')), imdbId: null };
  }
  if (raw.startsWith('tt')) {
    const found = await findByImdb(raw);
    if (type === 'series') {
      const tv = found.tv_results?.[0];
      if (tv) return { tmdbId: tv.id, imdbId: raw };
    } else {
      const movie = found.movie_results?.[0];
      if (movie) return { tmdbId: movie.id, imdbId: raw };
    }
  }
  return null;
}

async function buildSeriesVideos(tv, imdbId) {
  const videos = [];
  const seasons = (tv.seasons || []).filter((s) => s.season_number > 0).slice(0, 8);
  for (const season of seasons) {
    try {
      const detail = await tmdbFetch(`/tv/${tv.id}/season/${season.season_number}`);
      for (const ep of detail.episodes || []) {
        // Stremio core (TV/Web) richiede ISO 8601 completo, non solo YYYY-MM-DD
        // altrimenti la meta serie viene scartata → "Nessun metadato trovato"
        let released;
        if (ep.air_date) {
          released = /^\d{4}-\d{2}-\d{2}$/.test(ep.air_date)
            ? `${ep.air_date}T00:00:00.000Z`
            : ep.air_date;
        }
        videos.push({
          id: `${imdbId || `tmdb:${tv.id}`}:${season.season_number}:${ep.episode_number}`,
          title: ep.name || `Episodio ${ep.episode_number}`,
          season: season.season_number,
          episode: ep.episode_number,
          overview: ep.overview || '',
          released,
          thumbnail: ep.still_path
            ? `https://image.tmdb.org/t/p/w300${ep.still_path}`
            : undefined,
        });
      }
    } catch {
      // stagione non disponibile
    }
  }
  return videos;
}

/**
 * Meta dettagliata in italiano con link cliccabili (Cast, Regia, Genere, Trama).
 */
export async function buildDetailedMeta({ type, id }) {
  const resolved = await resolveTmdbFromStremioId(type, id);
  if (!resolved?.tmdbId) return { meta: null };

  const isSeries = type === 'series';
  const detail = isSeries
    ? await getTvDetails(resolved.tmdbId)
    : await getMovieDetails(resolved.tmdbId);

  const imdbId =
    detail.external_ids?.imdb_id || resolved.imdbId || null;
  // ID nudo IMDb → Torrentio e altri addon di riproduzione funzionano
  const addonId = imdbId || `tmdb:${detail.id}`;
  const videoIdBase = imdbId || addonId;
  const title = detail.title || detail.name || 'Senza titolo';
  const year = (detail.release_date || detail.first_air_date || '').slice(0, 4);
  const rating = Number(detail.vote_average || 0).toFixed(1);
  const country = countryBadge(detail);
  const genres = (detail.genres || []).map((g) => g.name);

  const castSrc = isSeries
    ? (detail.aggregate_credits?.cast || detail.credits?.cast || []).slice(0, 18)
    : (detail.credits?.cast || []).slice(0, 18);

  const crewSrc = isSeries
    ? detail.aggregate_credits?.crew || detail.credits?.crew || []
    : detail.credits?.crew || [];

  const directors = crewSrc
    .filter((c) => c.job === 'Director' || c.jobs?.some((j) => j.job === 'Director'))
    .slice(0, 6);

  const links = [];

  // NON usare category "genre"/"Genere": Stremio le tratta come Discover interno
  for (const g of genres) {
    links.push({
      name: g,
      category: 'Filtra',
      url: genrePageUrl(type, g),
    });
  }

  // Categorie consigliate dall'SDK: actor / director
  for (const actor of castSrc) {
    const ruolo =
      actor.character ||
      actor.roles?.map((r) => r.character).filter(Boolean).join(', ') ||
      'Ruolo non indicato';
    links.push({
      name: actor.name,
      category: 'actor',
      url: personPageUrl(actor.id, {
        mediaType: isSeries ? 'tv' : 'movie',
        mediaId: detail.id,
        ruolo,
      }),
    });
  }

  for (const d of directors) {
    links.push({
      name: d.name,
      category: 'director',
      url: personPageUrl(d.id, {
        mediaType: isSeries ? 'tv' : 'movie',
        mediaId: detail.id,
        ruolo: 'Regia',
      }),
    });
  }

  const schedaUrl = schedaPageUrl(isSeries ? 'tv' : 'movie', detail.id);

  links.push({
    name: 'Scheda completa Cast · Regia · Trama',
    category: 'Scheda',
    url: schedaUrl,
  });

  const castLines = castSrc
    .slice(0, 8)
    .map((a) => {
      const ruolo =
        a.character ||
        a.roles?.map((r) => r.character).filter(Boolean).join(', ') ||
        '';
      return ruolo ? `• ${a.name} — ${ruolo}` : `• ${a.name}`;
    })
    .join('\n');

  const trama = detail.overview || 'Trama non disponibile in italiano.';
  const runtimeLabel = detail.runtime
    ? `${detail.runtime} min`
    : detail.episode_run_time?.[0]
      ? `${detail.episode_run_time[0]} min/ep`
      : null;
  const voteCount = Number(detail.vote_count || 0);
  const lang = (detail.original_language || '').toUpperCase() || null;
  const seasonsCount = isSeries
    ? (detail.number_of_seasons || detail.seasons?.filter((s) => s.season_number > 0).length || null)
    : null;

  const infoLines = [
    genres.length ? `Genere  ${genres.join(' · ')}` : null,
    `Voto    ${rating}/10${voteCount > 0 ? ` (${voteCount} voti)` : ''}`,
    year ? `Anno    ${year}` : null,
    `Paese   ${country || 'N/D'}`,
    runtimeLabel ? `Durata  ${runtimeLabel}` : null,
    seasonsCount ? `Stagioni  ${seasonsCount}` : null,
    lang ? `Lingua  ${lang}` : null,
  ].filter(Boolean);

  const description = formatMetaBlocks([
    { title: 'INFO', lines: infoLines },
    { title: 'TRAMA', body: trama },
    {
      title: 'REGIA',
      body: directors.map((d) => d.name).join(', ') || 'N/D',
    },
    { title: 'CAST', body: castLines || 'N/D' },
    {
      title: 'SCHEDA COMPLETA',
      lines: [
        '› Apri Play → “Scheda completa”',
        '› Foto cast, biografie e trama estesa',
      ],
    },
  ]);

  const meta = {
    id: addonId,
    type,
    name: title,
    // Mai meta.genres: chip Discover → "addon non installato"
    genres: undefined,
    description,
    poster: posterUrl(detail.poster_path),
    background: detail.backdrop_path
      ? `https://image.tmdb.org/t/p/original${detail.backdrop_path}`
      : undefined,
    releaseInfo: year,
    imdbRating: rating,
    runtime: detail.runtime
      ? `${detail.runtime} min`
      : detail.episode_run_time?.[0]
        ? `${detail.episode_run_time[0]} min`
        : undefined,
    language: detail.original_language,
    country,
    director: directors.map((d) => d.name),
    cast: castSrc.map((a) => a.name),
    links,
    website: schedaUrl,
  };

  if (isSeries) {
    meta.videos = await buildSeriesVideos(detail, videoIdBase);
  }

  return { meta, tmdbId: detail.id, schedaUrl, isSeries };
}

export async function buildPersonPageData(personId, query = {}) {
  const person = await getPersonDetails(personId);
  const mediaType = query.mediaType === 'tv' ? 'tv' : 'movie';
  const mediaId = query.mediaId ? Number(query.mediaId) : null;
  const ruolo = query.ruolo || '';
  const backHref = query.back ? String(query.back) : mediaId
    ? schedaPageUrl(mediaType, mediaId)
    : undefined;

  let operaTitle = '';
  let operaPoster = null;
  if (mediaId) {
    try {
      const detail =
        mediaType === 'tv'
          ? await getTvDetails(mediaId)
          : await getMovieDetails(mediaId);
      operaTitle = detail.title || detail.name || '';
      operaPoster = posterUrl(detail.poster_path, 'w300');
    } catch {
      // ignore
    }
  }

  const imdbId = person.external_ids?.imdb_id;
  const imdbUrl = imdbId ? `https://www.imdb.com/name/${imdbId}/` : null;
  const hasBio = !!(person.biography && String(person.biography).trim());

  let biography;
  if (hasBio) {
    biography = String(person.biography).trim();
  } else {
    const bits = [
      person.known_for_department
        ? `Reparto: ${person.known_for_department}`
        : null,
      person.birthday ? `Nato/a: ${person.birthday}` : null,
      person.place_of_birth ? `Luogo: ${person.place_of_birth}` : null,
    ].filter(Boolean);
    biography = [
      'Nessuna biografia su TMDB per questa persona (succede spesso con cast secondario).',
      bits.length ? bits.join(' · ') : null,
      imdbUrl
        ? 'Puoi aprire IMDb dal pulsante sopra per eventuali dettagli extra.'
        : 'Neanche un ID IMDb è collegato su TMDB.',
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  return {
    person,
    ruolo,
    mediaType,
    mediaId,
    operaTitle,
    operaPoster,
    photo: profileUrl(person.profile_path, 'h632'),
    biography,
    backHref,
    imdbUrl,
  };
}

export async function buildTramaPageData(mediaType, tmdbId, backHref) {
  const detail =
    mediaType === 'tv'
      ? await getTvDetails(tmdbId)
      : await getMovieDetails(tmdbId);
  const runtimeLabel = detail.runtime
    ? `${detail.runtime} min`
    : detail.episode_run_time?.[0]
      ? `${detail.episode_run_time[0]} min/ep`
      : null;
  const voteCount = Number(detail.vote_count || 0);
  const lang = (detail.original_language || '').toUpperCase() || null;

  return {
    title: detail.title || detail.name,
    year: (detail.release_date || detail.first_air_date || '').slice(0, 4),
    overview: detail.overview || 'Trama non disponibile in italiano.',
    poster: posterUrl(detail.poster_path, 'w500'),
    backdrop: detail.backdrop_path
      ? `https://image.tmdb.org/t/p/w1280${detail.backdrop_path}`
      : null,
    rating: Number(detail.vote_average || 0).toFixed(1),
    voteCount,
    genres: (detail.genres || []).map((g) => g.name),
    country: countryBadge(detail),
    runtime: runtimeLabel,
    language: lang,
    mediaType,
    backHref: backHref || schedaPageUrl(mediaType, tmdbId),
  };
}

export async function buildGenrePageData(genreName, type = 'movie', backHref) {
  const stremioType = type === 'series' ? 'series' : 'movie';
  const mediaType = type === 'series' ? 'tv' : 'movie';
  const popularRecent = isPopolariGenre(genreName);
  const genreIds = resolveGenreIds(stremioType, genreName);

  const itemsRaw =
    mediaType === 'tv'
      ? await discoverSeries({ pages: 3, genreIds, popularRecent })
      : await discoverMovies({ pages: 3, genreIds, popularRecent });

  const schedaBack = backHref || undefined;

  const items = itemsRaw.slice(0, 36).map((it) => ({
    title: it.title || it.name,
    poster: posterUrl(it.poster_path, 'w300'),
    tramaUrl: `${config.publicBaseUrl}/trama/${mediaType}/${it.id}?back=${encodeURIComponent(
      schedaPageUrl(mediaType, it.id)
    )}`,
  }));

  return {
    genre: genreName,
    type: stremioType,
    items,
    backHref: schedaBack,
  };
}

/**
 * Scheda unica: trama + regia + cast con foto (navigabile col telecomando).
 */
export async function buildSchedaPageData(mediaType, tmdbId) {
  const isTv = mediaType === 'tv';
  const detail = isTv ? await getTvDetails(tmdbId) : await getMovieDetails(tmdbId);
  const genres = (detail.genres || []).map((g) => g.name);
  const schedaSelf = schedaPageUrl(mediaType, tmdbId);

  const castSrc = isTv
    ? (detail.aggregate_credits?.cast || detail.credits?.cast || []).slice(0, 24)
    : (detail.credits?.cast || []).slice(0, 24);

  const crewSrc = isTv
    ? detail.aggregate_credits?.crew || detail.credits?.crew || []
    : detail.credits?.crew || [];

  const directors = crewSrc
    .filter((c) => c.job === 'Director' || c.jobs?.some((j) => j.job === 'Director'))
    .slice(0, 8);

  const type = isTv ? 'series' : 'movie';

  const runtimeLabel = detail.runtime
    ? `${detail.runtime} min`
    : detail.episode_run_time?.[0]
      ? `${detail.episode_run_time[0]} min/ep`
      : null;
  const voteCount = Number(detail.vote_count || 0);
  const lang = (detail.original_language || '').toUpperCase() || null;
  const seasonsCount = isTv
    ? (detail.number_of_seasons ||
        detail.seasons?.filter((s) => s.season_number > 0).length ||
        null)
    : null;

  return {
    title: detail.title || detail.name,
    year: (detail.release_date || detail.first_air_date || '').slice(0, 4),
    overview: detail.overview || 'Trama non disponibile in italiano.',
    poster: posterUrl(detail.poster_path, 'w500'),
    backdrop: detail.backdrop_path
      ? `https://image.tmdb.org/t/p/w1280${detail.backdrop_path}`
      : null,
    rating: Number(detail.vote_average || 0).toFixed(1),
    voteCount,
    country: countryBadge(detail),
    runtime: runtimeLabel,
    language: lang,
    seasonsCount,
    genres: genres.map((g) => ({
      name: g,
      url: genrePageUrl(type, g, schedaSelf),
    })),
    directors: directors.map((d) => ({
      name: d.name,
      photo: profileUrl(d.profile_path, 'w185'),
      url: personPageUrl(d.id, {
        mediaType: isTv ? 'tv' : 'movie',
        mediaId: detail.id,
        ruolo: 'Regia',
        backHref: schedaSelf,
      }),
    })),
    cast: castSrc.map((a) => {
      const ruolo =
        a.character ||
        a.roles?.map((r) => r.character).filter(Boolean).join(', ') ||
        'Ruolo non indicato';
      return {
        name: a.name,
        ruolo,
        photo: profileUrl(a.profile_path, 'w185'),
        url: personPageUrl(a.id, {
          mediaType: isTv ? 'tv' : 'movie',
          mediaId: detail.id,
          ruolo,
          backHref: schedaSelf,
        }),
      };
    }),
    backHref: undefined,
  };
}

/** Usato dallo stream handler: risolve tt/tmdb → URL scheda. */
export async function resolveSchedaStream({ type, id }) {
  const resolved = await resolveTmdbFromStremioId(type, id);
  if (!resolved?.tmdbId) return null;
  const isSeries = type === 'series';
  return {
    schedaUrl: schedaPageUrl(isSeries ? 'tv' : 'movie', resolved.tmdbId),
    tmdbId: resolved.tmdbId,
  };
}
