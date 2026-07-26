/**
 * Logo v27 — cerchio evidente, angoli = sfondo lista Stremio (opaco).
 * Nessuna trasparenza → Stremio non dipinge nero.
 * Nella lista addon gli angoli si fondono con lo sfondo UI.
 */
import sharp from 'sharp';
import { existsSync, copyFileSync } from 'fs';

const SIZE = 512;
const PAD = 24;
const DIAM = SIZE - PAD * 2;
const UI = { r: 43, g: 41, b: 55 }; // screenshot lista addon
const src = 'public/logo-original.png';

if (existsSync('public/logo.png')) {
  copyFileSync('public/logo.png', 'public/logo-backup.png');
}

const art = await sharp(src)
  .resize(DIAM, DIAM, { fit: 'cover' })
  .ensureAlpha()
  .png()
  .toBuffer();

const mask = Buffer.from(
  `<svg width="${DIAM}" height="${DIAM}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="s" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000" flood-opacity="0.35"/>
      </filter>
    </defs>
    <circle cx="${DIAM / 2}" cy="${DIAM / 2}" r="${DIAM / 2}" fill="white"/>
  </svg>`
);

const circle = await sharp(art)
  .composite([{ input: mask, blend: 'dest-in' }])
  .png()
  .toBuffer();

// Sostituisci nero residuo DENTRO il cerchio (angoli dell’arte originale)
const { data, info } = await sharp(circle)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const cleaned = Buffer.alloc(DIAM * DIAM * 4);
const cr = DIAM / 2;
for (let y = 0; y < DIAM; y++) {
  for (let x = 0; x < DIAM; x++) {
    const i = (y * DIAM + x) * 4;
    const o = i;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    const dx = x + 0.5 - cr;
    const dy = y + 0.5 - cr;
    const inside = dx * dx + dy * dy <= cr * cr;
    if (!inside || a < 8 || r + g + b < 18) {
      cleaned[o] = 7;
      cleaned[o + 1] = 59;
      cleaned[o + 2] = 47;
      cleaned[o + 3] = inside ? 255 : 0;
    } else {
      cleaned[o] = r;
      cleaned[o + 1] = g;
      cleaned[o + 2] = b;
      cleaned[o + 3] = 255;
    }
  }
}

const circleClean = await sharp(cleaned, {
  raw: { width: DIAM, height: DIAM, channels: 4 },
})
  .png()
  .toBuffer();

await sharp({
  create: {
    width: SIZE,
    height: SIZE,
    channels: 3,
    background: UI,
  },
})
  .composite([{ input: circleClean, left: PAD, top: PAD }])
  .removeAlpha()
  .png()
  .toFile('public/logo.png');

await sharp('public/logo.png').toFile('public/logo-v27.png');

// Anteprima su rosa: deve vedersi il CERCHIO, angoli rosa? No, angoli UI.
// Anteprima su UI: angoli invisibili.
const L = await sharp('public/logo-v27.png').resize(256, 256).png().toBuffer();
await sharp({
  create: {
    width: 560,
    height: 300,
    channels: 3,
    background: UI,
  },
})
  .composite([{ input: L, left: 40, top: 22 }])
  .png()
  .toFile('public/logo-verify-ui.png');

await sharp({
  create: {
    width: 560,
    height: 300,
    channels: 3,
    background: { r: 255, g: 105, b: 180 },
  },
})
  .composite([{ input: L, left: 40, top: 22 }])
  .png()
  .toFile('public/logo-verify-pink.png');

console.log('logo-v27 ready');
