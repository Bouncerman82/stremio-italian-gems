import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { countryBadge } from '../lib/filters.js';
import { config } from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const postersDir = path.join(__dirname, '..', '..', 'public', 'posters');

fs.mkdirSync(postersDir, { recursive: true });

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

function buildOverlaySvg({ width, height, rating, country }) {
  const ratingText = Number(rating || 0).toFixed(1);
  const countryText = country || 'INT';

  const pad = Math.round(width * 0.04);
  const badgeH = Math.round(height * 0.07);
  const ratingW = Math.round(width * 0.22);
  const countryW = Math.max(
    Math.round(width * 0.16),
    countryText.length * Math.round(badgeH * 0.42)
  );
  const fontSize = Math.round(badgeH * 0.55);
  const radius = Math.round(badgeH * 0.22);
  const gap = Math.round(width * 0.018);

  // Entrambi a destra: [PAESE]  gap  [★ voto]
  const ratingX = width - pad - ratingW;
  const ratingY = pad;
  const countryX = ratingX - gap - countryW;
  const countryY = pad;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.55"/>
    </filter>
  </defs>

  <!-- Badge paese (a destra, a sinistra del voto) -->
  <g filter="url(#shadow)">
    <rect x="${countryX}" y="${countryY}" rx="${radius}" ry="${radius}"
          width="${countryW}" height="${badgeH}" fill="#0f766e"/>
    <text x="${countryX + countryW / 2}" y="${countryY + badgeH / 2 + fontSize * 0.35}"
          text-anchor="middle" font-family="Arial, Helvetica, sans-serif"
          font-size="${fontSize}" font-weight="700" fill="#ffffff">${escapeXml(countryText)}</text>
  </g>

  <!-- Badge voto (alto destra) -->
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

export async function renderCustomPoster({
  tmdbId,
  posterPath,
  rating,
  country = 'INT',
}) {
  if (!posterPath || !tmdbId) return null;

  const ratingKey = Number(rating || 0).toFixed(1);
  const filename = `${tmdbId}_${ratingKey}_${safeKey(country)}_r.jpg`;
  const outPath = path.join(postersDir, filename);
  const publicUrl = `${config.publicBaseUrl}/posters/${filename}`;

  if (fs.existsSync(outPath)) return publicUrl;

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
      buildOverlaySvg({ width, height, rating, country })
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

export async function renderPostersForMovies(items, { concurrency = 6 } = {}) {
  const results = new Map();

  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency);
    await Promise.all(
      chunk.map(async (item) => {
        const country = countryBadge(item);
        const url = await renderCustomPoster({
          tmdbId: item.id,
          posterPath: item.poster_path,
          rating: item.vote_average,
          country,
        });
        if (url) results.set(item.id, url);
      })
    );
  }

  return results;
}
