import express from 'express';
import { getRouter } from '@stremio-addon/node-express';
import { buildAddon } from './addon.js';
import { assertConfig, config } from './config.js';
import { manifest } from './manifest.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import dns from 'node:dns';
import {
  renderPersonHtml,
  renderTramaHtml,
  renderGenreHtml,
  renderSchedaHtml,
  renderExitToStremioHtml,
} from './pages/templates.js';
import {
  buildPersonPageData,
  buildTramaPageData,
  buildGenrePageData,
  buildSchedaPageData,
} from './services/metaDetail.js';
import {
  handleBadgePoster,
  probeTmdbImageFetch,
} from './posters/renderer.js';

try {
  dns.setDefaultResultOrder('ipv4first');
} catch {
  // ignore
}
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');
const publicDir = path.join(rootDir, 'public');
const postersDir = path.join(publicDir, 'posters');

fs.mkdirSync(postersDir, { recursive: true });

assertConfig();

const addonInterface = buildAddon();
const app = express();
const startedAt = Date.now();

app.use(express.static(publicDir));
app.use('/posters', express.static(postersDir));

/** Healthcheck per Render / Beamup / load balancer. */
app.get('/health', (_req, res) => {
  res.status(200).json({
    ok: true,
    service: 'italian-gems',
    version: manifest.version,
    uptimeSec: Math.floor((Date.now() - startedAt) / 1000),
    posters: config.customPosters,
  });
});

/** Diagnostica: Render riesce a scaricare image.tmdb.org? */
app.get('/health/poster-probe', async (_req, res) => {
  const probe = await probeTmdbImageFetch();
  res.status(probe.ok ? 200 : 503).json({ version: manifest.version, ...probe });
});

/** Locandine con tag: generate on-demand (catalogo non blocca sul download TMDB). */
app.get('/badge-poster/:tmdbId.jpg', (req, res) => {
  handleBadgePoster(req, res).catch((err) => {
    console.error('[badge-poster]', err.message);
    res.status(500).type('text').send('poster error');
  });
});

/** Uscita dal plugin → ritorna a Stremio (telecomando TV). */
app.get('/esci', (_req, res) => {
  res.type('html').send(renderExitToStremioHtml());
});

// Pagine integrate Cast / Regia / Trama (layout italiano)
app.get('/persona/:id', async (req, res) => {
  try {
    const data = await buildPersonPageData(req.params.id, req.query);
    res.type('html').send(renderPersonHtml(data));
  } catch (err) {
    console.error('[persona]', err.message);
    res.status(404).type('html').send('<h1>Profilo non trovato</h1>');
  }
});

app.get('/trama/:mediaType/:id', async (req, res) => {
  try {
    const mediaType = req.params.mediaType === 'tv' ? 'tv' : 'movie';
    const back = req.query.back ? String(req.query.back) : undefined;
    const data = await buildTramaPageData(mediaType, req.params.id, back);
    res.type('html').send(renderTramaHtml(data));
  } catch (err) {
    console.error('[trama]', err.message);
    res.status(404).type('html').send('<h1>Trama non trovata</h1>');
  }
});

app.get('/genere/:name', async (req, res) => {
  try {
    const genreName = decodeURIComponent(req.params.name);
    const type = req.query.type === 'series' ? 'series' : 'movie';
    const back = req.query.back ? String(req.query.back) : undefined;
    const data = await buildGenrePageData(genreName, type, back);
    res.type('html').send(renderGenreHtml(data));
  } catch (err) {
    console.error('[genere]', err.message);
    res.status(404).type('html').send('<h1>Genere non trovato</h1>');
  }
});

app.get('/scheda/:mediaType/:id', async (req, res) => {
  try {
    const mediaType = req.params.mediaType === 'tv' ? 'tv' : 'movie';
    const data = await buildSchedaPageData(mediaType, req.params.id);
    res.type('html').send(renderSchedaHtml(data));
  } catch (err) {
    console.error('[scheda]', err.message);
    res.status(404).type('html').send('<h1>Scheda non trovata</h1>');
  }
});

app.use(getRouter(addonInterface));

app.get('/', (_req, res) => {
  const installUrl = `${config.publicBaseUrl}/manifest.json`;
  res.type('html').send(`<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Italian Gems ${manifest.version}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 640px; margin: 3rem auto; padding: 0 1rem; line-height: 1.5; background:#0b1210; color:#e8f2ee; }
    code { background: #12201c; padding: 0.15rem 0.4rem; border-radius: 4px; word-break: break-all; }
    a { color: #14b8a6; }
    .logo { width: 96px; height: 96px; display:block; margin-bottom: 1rem; }
    .muted { color: #9bb5ab; font-size: 0.95rem; }
  </style>
</head>
<body>
  <img class="logo" src="/logo-v30.png" alt="Italian Gems" />
  <h1>Italian Gems ${manifest.version}</h1>
  <p>Cataloghi discovery FILM e SERIE: Top 100, Popolari ultimi 2 mesi, filtri mood/anno/paese, mix intelligente.</p>
  <p><strong>Non fornisce torrent né link di streaming video</strong> — solo catalogo, metadati e schede.</p>
  <p>Installa in Stremio (Addon → Community / URL):</p>
  <p><code>${installUrl}</code></p>
  <p><a href="/manifest.json">Apri manifest.json</a> · <a href="/health">Health</a></p>
  <p class="muted">HTTPS obbligatorio fuori dalla LAN. Imposta <code>PUBLIC_BASE_URL</code> e <code>TMDB_API_KEY</code>.</p>
</body>
</html>`);
});

app.listen(config.port, () => {
  console.log('');
  console.log(`🎬  Italian Gems ${manifest.version} — server avviato`);
  console.log(`    Manifest: ${config.publicBaseUrl}/manifest.json`);
  console.log(`    Health:   ${config.publicBaseUrl}/health`);
  console.log(`    Posters:  ${config.customPosters ? 'ON' : 'OFF'}`);
  console.log('');
});
