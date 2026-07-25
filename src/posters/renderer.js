import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { moodBadgeLabel } from '../lib/moods.js';
import { config } from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const postersDir = path.join(__dirname, '..', '..', 'public', 'posters');

fs.mkdirSync(postersDir, { recursive: true });

const MOOD_COLORS = {
  Avventuroso: '#e67e22',
  'Nostalgico/Toccante': '#5dade2',
  'Tensione/Giallo': '#c0392b',
  'Risate e Leggerezza': '#27ae60',
  'Mistero/Cospirazione': '#8e44ad',
};

function safeKey(value) {
  return String(value || 'x')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .slice(0, 40);
}

function escapeXml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildOverlaySvg({ width, height, rating, moodName, isItalian }) {
  const ratingText = Number(rating || 0).toFixed(1);
  const moodShort = moodName ? moodBadgeLabel(moodName) : isItalian ? 'ITA' : 'GEM';
  const moodColor = MOOD_COLORS[moodName] || (isItalian ? '#1abc9c' : '#f39c12');

  // Dimensioni relative alla locandina
  const pad = Math.round(width * 0.04);
  const badgeH = Math.round(height * 0.07);
  const ratingW = Math.round(width * 0.22);
  const moodW = Math.round(width * 0.2);
  const fontSize = Math.round(badgeH * 0.55);
  const radius = Math.round(badgeH * 0.22);

  const ratingX = width - pad - ratingW;
  const ratingY = pad;
  const moodX = pad;
  const moodY = pad;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.55"/>
    </filter>
  </defs>

  <!-- Badge mood / ITA (alto sinistra) -->
  <g filter="url(#shadow)">
    <rect x="${moodX}" y="${moodY}" rx="${radius}" ry="${radius}"
          width="${moodW}" height="${badgeH}" fill="${moodColor}"/>
    <text x="${moodX + moodW / 2}" y="${moodY + badgeH / 2 + fontSize * 0.35}"
          text-anchor="middle" font-family="Arial, Helvetica, sans-serif"
          font-size="${fontSize}" font-weight="700" fill="#ffffff">${escapeXml(moodShort)}</text>
  </g>

  <!-- Badge voto (alto destra) stile IMDb -->
  <g filter="url(#shadow)">
    <rect x="${ratingX}" y="${ratingY}" rx="${radius}" ry="${radius}"
          width="${ratingW}" height="${badgeH}" fill="#121212"/>
    <rect x="${ratingX}" y="${ratingY}" rx="${radius}" ry="${radius}"
          width="${Math.round(ratingW * 0.32)}" height="${badgeH}" fill="#f5c518"/>
    <text x="${ratingX + Math.round(ratingW * 0.16)}" y="${ratingY + badgeH / 2 + fontSize * 0.35}"
          text-anchor="middle" font-family="Arial, Helvetica, sans-serif"
          font-size="${Math.round(fontSize * 0.85)}" font-weight="800" fill="#121212">★</text>
    <text x="${ratingX + Math.round(ratingW * 0.62)}" y="${ratingY + badgeH / 2 + fontSize * 0.35}"
          text-anchor="middle" font-family="Arial, Helvetica, sans-serif"
          font-size="${fontSize}" font-weight="700" fill="#ffffff">${escapeXml(ratingText)}</text>
  </g>
</svg>`;
}

/**
 * Scarica la locandina TMDB, sovrappone badge voto + mood, salva su disco.
 * @returns {Promise<string|null>} URL pubblico del poster custom, o null se fallisce
 */
export async function renderCustomPoster({
  tmdbId,
  posterPath,
  rating,
  moodName = null,
  isItalian = false,
}) {
  if (!posterPath || !tmdbId) return null;

  const ratingKey = Number(rating || 0).toFixed(1);
  const moodKey = safeKey(moodName || (isItalian ? 'ita' : 'gem'));
  const filename = `${tmdbId}_${ratingKey}_${moodKey}.jpg`;
  const outPath = path.join(postersDir, filename);
  const publicUrl = `${config.publicBaseUrl}/posters/${filename}`;

  // Cache su disco: se esiste già, riusa
  if (fs.existsSync(outPath)) {
    return publicUrl;
  }

  const sourceUrl = `${config.tmdbImageBase}${posterPath}`;

  try {
    const res = await fetch(sourceUrl);
    if (!res.ok) return null;
    const input = Buffer.from(await res.arrayBuffer());

    const image = sharp(input);
    const meta = await image.metadata();
    const width = meta.width || 500;
    const height = meta.height || 750;

    const overlay = Buffer.from(
      buildOverlaySvg({
        width,
        height,
        rating,
        moodName,
        isItalian,
      })
    );

    await image
      .composite([{ input: overlay, top: 0, left: 0 }])
      .jpeg({ quality: 86, mozjpeg: true })
      .toFile(outPath);

    return publicUrl;
  } catch (err) {
    console.warn(`[poster] fallito tmdb=${tmdbId}:`, err.message);
    return null;
  }
}

/**
 * Genera poster in parallelo con concorrenza limitata.
 */
export async function renderPostersForMovies(movies, { moodLabel = null, concurrency = 6 } = {}) {
  const results = new Map();

  for (let i = 0; i < movies.length; i += concurrency) {
    const chunk = movies.slice(i, i + concurrency);
    await Promise.all(
      chunk.map(async (movie) => {
        const url = await renderCustomPoster({
          tmdbId: movie.id,
          posterPath: movie.poster_path,
          rating: movie.vote_average,
          moodName: moodLabel,
          isItalian: movie.original_language === 'it',
        });
        if (url) results.set(movie.id, url);
      })
    );
  }

  return results;
}
