/**
 * Probabilità di *doppiaggio italiano* (non cinema italiano).
 *
 * Obiettivo: far emergere titoli stranieri (soprattutto EN/Hollywood) che
 * sul mercato IT hanno tipicamente traccia doppiata — non original_language=it.
 *
 * TMDB non espone le tracce audio: score euristico 0–100 → tier A/B/C.
 */

import { config } from '../config.js';
import { justWatchItBoostPoints } from './justwatchIt.js';

/** Generi con alta probabilità di doppiaggio IT sul mercato consumer. */
const GENRE_DUB_BOOST = new Map([
  [16, 42], // Animazione — quasi sempre doppiata
  [10751, 26], // Famiglia
  [10762, 42], // Kids (TV)
  [12, 14], // Adventure
  [14, 12], // Fantasy
  [28, 14], // Action — blockbuster quasi sempre doppiati
  [878, 12], // Sci-Fi
  [10765, 12], // Sci-Fi & Fantasy (TV)
  [10759, 14], // Action & Adventure (TV)
  [35, 6], // Comedy mainstream
  [53, 6], // Thriller
  [80, 4], // Crime
  [27, 5], // Horror (spesso doppiato in IT)
  [99, -16], // Documentario — spesso VO
  [36, -8], // History / art-house
  [10402, -5], // Music
]);

/** Provider flatrate rilevanti in Italia (TMDB watch provider IDs). */
export const IT_FLATRATE_PROVIDERS = '8|119|337|531|350|283';
// Netflix 8, Prime 119, Disney+ 337, Paramount+ 531, Apple TV+ 350,
// Crunchyroll 283 (anime spesso IT dub)

const SCORE_A = 72;
const SCORE_B = 40;

/** Quota massima di cinema italiano (originale) nella densify di testa. */
export const IT_ORIGINAL_DENSIFY_CAP = 0.12;

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function genreIdsOf(item) {
  if (Array.isArray(item.genre_ids) && item.genre_ids.length) {
    return item.genre_ids.map(Number);
  }
  if (Array.isArray(item.genres)) {
    return item.genres.map((g) => Number(g?.id || g)).filter(Boolean);
  }
  return [];
}

export function isItalianOriginal(item) {
  if (!item) return false;
  const lang = String(item.original_language || '').toLowerCase();
  if (lang === 'it') return true;
  const origins = item.origin_country || [];
  if (
    Array.isArray(origins) &&
    origins.some((c) => String(c).toUpperCase() === 'IT')
  ) {
    return true;
  }
  const prod = item.production_countries || [];
  return (
    Array.isArray(prod) &&
    prod.some((c) => String(c?.iso_3166_1 || c).toUpperCase() === 'IT')
  );
}

function hasItalianSpoken(item) {
  const spoken = item.spoken_languages || [];
  if (!Array.isArray(spoken) || !spoken.length) return false;
  return spoken.some((l) => {
    const code = String(l?.iso_639_1 || l).toLowerCase();
    return code === 'it';
  });
}

/**
 * Titolo localizzato IT diverso dall'originale → scheda curata per il mercato IT.
 * Utile soprattutto su titoli stranieri (Discover language=it-IT).
 */
function hasLocalizedItalianTitle(item) {
  const title = String(item.title || item.name || '').trim();
  const original = String(item.original_title || item.original_name || '').trim();
  if (!title || !original) return false;
  if (title.toLowerCase() === original.toLowerCase()) return false;
  return title.length >= 2;
}

function genreBoost(item) {
  const ids = genreIdsOf(item);
  if (!ids.length) return 0;
  let best = 0;
  let worst = 0;
  for (const id of ids) {
    const b = GENRE_DUB_BOOST.get(id);
    if (b == null) continue;
    if (b > best) best = b;
    if (b < worst) worst = b;
  }
  return best + (worst < 0 ? worst : 0);
}

function mainstreamBoost(item) {
  const pop = Number(item.popularity || 0);
  const votes = Number(item.vote_count || 0);
  // Blockbuster / alto voto → uscita IT quasi sempre doppiata
  const popPts = clamp(Math.log10(Math.max(pop, 1)) * 7.5, 0, 16);
  const votePts = clamp(Math.log10(Math.max(votes, 1)) * 4, 0, 14);
  return popPts + votePts;
}

/** Lingue straniere tipicamente doppiate sul mercato consumer IT. */
function foreignLangBoost(lang) {
  if (lang === 'en') return 8; // Hollywood / UK — doppiaggio standard
  if (lang === 'ja') return 5; // anime/live spesso doppiati
  if (['ko', 'zh', 'es', 'fr', 'de', 'pt'].includes(lang)) return 3;
  return 0;
}

/**
 * Score 0–100: priorità = probabilità *doppiaggio* su titoli stranieri.
 * Cinema italiano: boost lieve (ha audio IT) ma non compete coi doppiati.
 */
export function italianDubScore(item) {
  if (!item) return 0;
  if (typeof item._itDubScore === 'number' && Number.isFinite(item._itDubScore)) {
    return item._itDubScore;
  }

  const lang = String(item.original_language || '').toLowerCase();
  const italianOrig = isItalianOriginal(item);
  let score = 6;

  if (italianOrig) {
    // Ha audio italiano, ma NON è il target “doppiato”: non deve dominare.
    score += 14;
    score += Math.min(mainstreamBoost(item) * 0.25, 8);
  } else {
    if (item._regionIt || item._itTier === 'B') score += 32;
    if (item._watchIt) score += 26;
    // JustWatch IT popular/trending → forte correlazione con doppiaggio consumer
    const jw =
      typeof item._justWatchBoost === 'number'
        ? item._justWatchBoost
        : justWatchItBoostPoints(item.id);
    if (jw > 0) {
      score += jw;
      item._justWatchIt = true;
    }
    score += genreBoost(item);
    score += mainstreamBoost(item) * 0.85;
    score += foreignLangBoost(lang);
    if (hasLocalizedItalianTitle(item)) score += 12;
    if (hasItalianSpoken(item)) score += 6;
  }

  const strength = Number(config.itDubBoostStrength ?? 1);
  if (strength !== 1 && !italianOrig) {
    const delta = score - 6;
    score = 6 + delta * strength;
  }

  score = clamp(Math.round(score), 0, 100);
  item._itDubScore = score;
  return score;
}

/**
 * Tier: 0 = A (alto doppiaggio-likely), 1 = B, 2 = C.
 * Gli originali IT restano tipicamente in B/C salvo eccezioni.
 */
export function italianHybridTier(item) {
  // Originali IT: mai tier A per il ranking “doppiato”
  if (isItalianOriginal(item)) {
    const score = italianDubScore(item);
    return score >= SCORE_B ? 1 : 2;
  }
  const score = italianDubScore(item);
  if (score >= SCORE_A) return 0;
  if (score >= SCORE_B) return 1;
  return 2;
}

/**
 * Soft: bucket A→B→C (ordine relativo entro il bucket).
 * Hard: score desc; a parità preferisci non-italiani, poi voto.
 */
export function rankItalianHybrid(items, { soft = false } = {}) {
  if (!items?.length) return [];

  if (config.itDubBoost === false) {
    return [...items];
  }

  if (soft) {
    const buckets = [[], [], []];
    for (const item of items) {
      buckets[italianHybridTier(item)].push(item);
    }
    return [...buckets[0], ...buckets[1], ...buckets[2]];
  }

  return [...items].sort((a, b) => {
    const sa = italianDubScore(a);
    const sb = italianDubScore(b);
    if (sa !== sb) return sb - sa;
    const aIt = isItalianOriginal(a) ? 1 : 0;
    const bIt = isItalianOriginal(b) ? 1 : 0;
    if (aIt !== bIt) return aIt - bIt; // stranieri prima a parità di score
    return Number(b.vote_average || 0) - Number(a.vote_average || 0);
  });
}

export function markRegionIt(items) {
  return (items || []).map((it) => {
    const next = { ...it, _regionIt: true, _itTier: 'B' };
    delete next._itDubScore;
    return next;
  });
}

export function markWatchIt(items) {
  return (items || []).map((it) => {
    const next = { ...it, _watchIt: true };
    delete next._itDubScore;
    return next;
  });
}

/** Marca item già noti a JustWatch IT (dopo ensureJustWatchItIndex). */
export function attachJustWatchFlags(items) {
  return (items || []).map((it) => {
    if (!it?.id) return it;
    const boost = justWatchItBoostPoints(it.id);
    if (!boost) return it;
    const next = {
      ...it,
      _justWatchIt: true,
      _justWatchBoost: boost,
    };
    delete next._itDubScore;
    return next;
  });
}

export function mergeDedupePreferHigherScores(...lists) {
  const best = new Map();
  for (const list of lists) {
    for (const item of list || []) {
      if (!item?.id) continue;
      const prev = best.get(item.id);
      if (!prev || italianDubScore(item) > italianDubScore(prev)) {
        best.set(item.id, item);
      } else if (italianDubScore(item) === italianDubScore(prev)) {
        const itemSig =
          (item._regionIt ? 1 : 0) +
          (item._watchIt ? 1 : 0) +
          (item._justWatchIt ? 1 : 0);
        const prevSig =
          (prev._regionIt ? 1 : 0) +
          (prev._watchIt ? 1 : 0) +
          (prev._justWatchIt ? 1 : 0);
        if (itemSig > prevSig) best.set(item.id, { ...prev, ...item });
      }
    }
  }
  return [...best.values()];
}
