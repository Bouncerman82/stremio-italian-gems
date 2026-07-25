import express from 'express';
import { getRouter } from '@stremio-addon/node-express';
import { buildAddon } from './addon.js';
import { assertConfig, config } from './config.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');
const publicDir = path.join(rootDir, 'public');
const postersDir = path.join(publicDir, 'posters');

// Assicura che la cartella poster esista
fs.mkdirSync(postersDir, { recursive: true });

assertConfig();

const addonInterface = buildAddon();
const app = express();

// Icona add-on + altre statiche (logo.png, …)
app.use(express.static(publicDir));

// Serve le locandine custom generate da sharp
app.use('/posters', express.static(postersDir));

// Router ufficiale Stremio (/manifest.json, /catalog/...)
app.use(getRouter(addonInterface));

// Landing page semplice per verificare che il server sia vivo
app.get('/', (_req, res) => {
  res.type('html').send(`<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="utf-8" />
  <title>Italian Gems Shuffle</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 640px; margin: 3rem auto; padding: 0 1rem; line-height: 1.5; }
    code { background: #f0f0f0; padding: 0.15rem 0.4rem; border-radius: 4px; }
    a { color: #0d47a1; }
  </style>
</head>
<body>
  <h1>Italian Gems Shuffle</h1>
  <p>Add-on Stremio attivo. Installa in Stremio Desktop con:</p>
  <p><code>http://localhost:${config.port}/manifest.json</code></p>
  <p><a href="/manifest.json">Apri manifest.json</a></p>
</body>
</html>`);
});

app.listen(config.port, () => {
  console.log('');
  console.log('🎬  Italian Gems Shuffle — server avviato');
  console.log(`    Manifest: http://localhost:${config.port}/manifest.json`);
  console.log(`    Home:     http://localhost:${config.port}/`);
  console.log('');
});
