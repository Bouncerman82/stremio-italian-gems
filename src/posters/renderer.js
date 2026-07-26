import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import https from 'node:https';
import dns from 'node:dns';
import sharp from 'sharp';
import { countryBadge } from '../lib/filters.js';
import { config } from '../config.js';

try {
  dns.setDefaultResultOrder('ipv4first');
} catch {
  // Node vecchio
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const postersDir = path.join(__dirname, '..', '..', 'public', 'posters');

fs.mkdirSync(postersDir, { recursive: true });

const TMDB_SIZES = ['w342', 'w185', 'w500'];

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
  <g filter="url(#shadow)">
    <rect x="${countryX}" y="${countryY}" rx="${radius}" ry="${radius}"
          width="${countryW}" height="${badgeH}" fill="#0f766e"/>
    <text x="${countryX + countryW / 2}" y="${countryY + badgeH / 2 + fontSize * 0.35}"
          text-anchor="middle" font-family="Arial, Helvetica, sans-serif"
          font-size="${fontSize}" font-weight="700" fill="#ffffff">${escapeXml(countryText)}</text>
  </g>
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

/** Download forzando IPv4 + SNI (su Render image.tmdb.org spesso fallisce su IPv6/fetch). */
function httpsGetBuffer(urlString, { timeoutMs = 10_000 } = {}) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const fail = (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    };
    const ok = (buf) => {
      if (settled) return;
      settled = true;
      resolve(buf);
    };

    let u;
    try {
      u = new URL(urlString);
    } catch (err) {
      return fail(err);
    }

    dns.lookup(u.hostname, { family: 4 }, (dnsErr, address) => {
      if (dnsErr) return fail(dnsErr);

      const req = https.get(
        {
          host: address,
          servername: u.hostname,
          path: `${u.pathname}${u.search}`,
          headers: {
            Host: u.hostname,
            'User-Agent': 'ItalianGems/3.1 (+https://stremio-italian-gems.onrender.com)',
            Accept: 'image/jpeg,image/webp,image/*,*/*',
            Referer: 'https://www.themoviedb.org/',
            Connection: 'close',
          },
          timeout: timeoutMs,
        },
        (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            res.resume();
            return httpsGetBuffer(new URL(res.headers.location, u).href, { timeoutMs })
              .then(ok)
              .catch(fail);
          }
          if (res.statusCode !== 200) {
            res.resume();
            return fail(new Error(`HTTP ${res.statusCode}`));
          }
          const chunks = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => ok(Buffer.concat(chunks)));
          res.on('error', fail);
        }
      );
      req.on('timeout', () => {
        req.destroy();
        fail(new Error('timeout'));
      });
      req.on('error', fail);
    });
  });
}

async function fetchPosterBuffer(posterPath) {
  let lastErr;
  const candidates = [];
  for (const size of TMDB_SIZES) {
    candidates.push(`https://image.tmdb.org/t/p/${size}${posterPath}`);
  }
  // Proxy pubblico: su alcuni host Render non apre image.tmdb.org in uscita
  candidates.push(
    `https://wsrv.nl/?url=${encodeURIComponent(`image.tmdb.org/t/p/w342${posterPath}`)}&output=jpg&n=-1`
  );

  for (const sourceUrl of candidates) {
    for (let i = 0; i < 2; i++) {
      try {
        return await httpsGetBuffer(sourceUrl);
      } catch (err) {
        lastErr = err;
        await new Promise((r) => setTimeout(r, 120 * (i + 1)));
      }
    }
  }
  const msg = lastErr?.message || String(lastErr);
  const cause = lastErr?.cause?.message ? ` (${lastErr.cause.message})` : '';
  throw new Error(`${msg}${cause}`);
}

export function posterFallbackUrl(posterPath) {
  if (!posterPath) return null;
  return `https://image.tmdb.org/t/p/w500${posterPath}`;
}

/** URL immediato per il catalogo (generazione lazy al primo hit di Stremio). */
export function customPosterPublicUrl({ tmdbId, posterPath, rating, country }) {
  if (!config.customPosters || !posterPath || !tmdbId) return null;
  const qs = new URLSearchParams({
    p: posterPath,
    r: Number(rating || 0).toFixed(1),
    c: country || 'INT',
  });
  return `${config.publicBaseUrl}/badge-poster/${tmdbId}.jpg?${qs.toString()}`;
}

export function customPosterUrlForItem(item) {
  return customPosterPublicUrl({
    tmdbId: item.id,
    posterPath: item.poster_path,
    rating: item.vote_average,
    country: countryBadge(item),
  });
}

function cachePath(tmdbId, rating, country) {
  const ratingKey = Number(rating || 0).toFixed(1);
  const filename = `${tmdbId}_${ratingKey}_${safeKey(country)}_r.jpg`;
  return path.join(postersDir, filename);
}

export async function renderCustomPoster({
  tmdbId,
  posterPath,
  rating,
  country = 'INT',
}) {
  if (!posterPath || !tmdbId) return null;

  const outPath = cachePath(tmdbId, rating, country);
  const publicUrl = `${config.publicBaseUrl}/posters/${path.basename(outPath)}`;

  if (fs.existsSync(outPath)) return publicUrl;

  try {
    const input = await fetchPosterBuffer(posterPath);

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

/** Handler Express: genera badge o redirect a TMDB (il client dell'utente può scaricare). */
export async function handleBadgePoster(req, res) {
  const tmdbId = String(req.params.tmdbId || '').replace(/\.jpg$/i, '');
  const posterPath = String(req.query.p || '');
  const rating = String(req.query.r || '0');
  const country = String(req.query.c || 'INT');

  if (!tmdbId || !posterPath.startsWith('/')) {
    res.status(400).type('text').send('bad poster request');
    return;
  }

  const outPath = cachePath(tmdbId, rating, country);
  if (fs.existsSync(outPath)) {
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    res.type('jpg').sendFile(outPath);
    return;
  }

  const url = await renderCustomPoster({
    tmdbId,
    posterPath,
    rating,
    country,
  });

  if (url && fs.existsSync(outPath)) {
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    res.type('jpg').sendFile(outPath);
    return;
  }

  // Render non raggiunge image.tmdb.org → lascia scaricare al device Stremio
  const fallback = posterFallbackUrl(posterPath);
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.redirect(302, fallback);
}

/** Probe diagnostico (health). */
export async function probeTmdbImageFetch() {
  const sample = '/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg'; // Interstellar
  const started = Date.now();
  try {
    const buf = await fetchPosterBuffer(sample);
    return {
      ok: true,
      bytes: buf.length,
      ms: Date.now() - started,
    };
  } catch (err) {
    return {
      ok: false,
      error: err.message,
      ms: Date.now() - started,
    };
  }
}

/** @deprecated preferisci URL lazy; tenuto per compat. */
export async function renderPostersForMovies(items, { concurrency } = {}) {
  const results = new Map();
  for (const item of items) {
    const url = customPosterUrlForItem(item);
    if (url) results.set(item.id, url);
  }
  void concurrency;
  return results;
}
