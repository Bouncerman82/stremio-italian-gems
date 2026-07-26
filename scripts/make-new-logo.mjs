/**
 * Nuovo logo: toglie TUTTO lo sfondo nero (anche macchie isolate).
 * Protegge gemma verde, oro e scintille; le strisce nere del ciak restano
 * perché attaccate all’oro (non espandiamo dentro zone “soggetto”).
 */
import sharp from 'sharp';
import { copyFileSync, existsSync } from 'fs';

const SRC = 'public/logo-source-new.png';
const SIZE = 512;
const EMERALD = { r: 8, g: 72, b: 58 };

if (existsSync('public/logo.png')) {
  copyFileSync('public/logo.png', 'public/logo-backup.png');
}

const { data, info } = await sharp(SRC)
  .resize(SIZE, SIZE, { fit: 'cover' })
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const w = info.width;
const h = info.height;
const rgba = Buffer.alloc(w * h * 4);

const i3 = (x, y) => (y * w + x) * 3;
const i4 = (x, y) => (y * w + x) * 4;

function rgb(x, y) {
  const i = i3(x, y);
  return [data[i], data[i + 1], data[i + 2]];
}

function isSubject(r, g, b) {
  const greenBias = g - Math.max(r, b);
  if (greenBias > 8 && g >= 25) return true; // gemma
  if (r >= 60 && g >= 40 && r >= b) return true; // oro / glow
  if (r >= 100 && g >= 100 && b >= 80) return true; // scintille
  // bandiera IT sulla gemma
  if (r > 140 && g < 90 && b < 90) return true;
  if (r > 140 && g > 140 && b > 140) return true;
  return false;
}

function isBg(r, g, b) {
  if (isSubject(r, g, b)) return false;
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum < 38 || (r <= 35 && g <= 35 && b <= 35);
}

for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    const [r, g, b] = rgb(x, y);
    const o = i4(x, y);
    rgba[o] = r;
    rgba[o + 1] = g;
    rgba[o + 2] = b;
    rgba[o + 3] = 255;
  }
}

const clear = new Uint8Array(w * h);
const stack = [];
const seed = (x, y) => {
  if (x >= 0 && y >= 0 && x < w && y < h) stack.push([x, y]);
};
for (let i = 0; i < w; i++) {
  seed(i, 0);
  seed(i, h - 1);
}
for (let j = 0; j < h; j++) {
  seed(0, j);
  seed(w - 1, j);
}

while (stack.length) {
  const [x, y] = stack.pop();
  const p = y * w + x;
  if (clear[p]) continue;
  const [r, g, b] = rgb(x, y);
  if (!isBg(r, g, b)) continue;
  clear[p] = 1;
  rgba[i4(x, y) + 3] = 0;
  seed(x + 1, y);
  seed(x - 1, y);
  seed(x, y + 1);
  seed(x, y - 1);
}

// Espandi: macchie nere attaccate allo sfondo già trasparente (fino a 14 pass)
for (let pass = 0; pass < 14; pass++) {
  const toClear = [];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const p = y * w + x;
      if (clear[p]) continue;
      const [r, g, b] = rgb(x, y);
      if (!isBg(r, g, b)) continue;
      let touch = false;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [-1, -1],
        [1, -1],
        [-1, 1],
      ]) {
        if (clear[(y + dy) * w + (x + dx)]) touch = true;
      }
      if (touch) toClear.push([x, y]);
    }
  }
  if (!toClear.length) break;
  for (const [x, y] of toClear) {
    clear[y * w + x] = 1;
    rgba[i4(x, y) + 3] = 0;
  }
}

// Anti-alias bordo: pixel soggetto vicino al trasparente → un filo di alpha
for (let y = 1; y < h - 1; y++) {
  for (let x = 1; x < w - 1; x++) {
    const o = i4(x, y);
    if (rgba[o + 3] === 0) continue;
    let t = 0;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      if (rgba[i4(x + dx, y + dy) + 3] === 0) t++;
    }
    if (t >= 2) {
      const [r, g, b] = rgb(x, y);
      if (isBg(r, g, b)) rgba[o + 3] = 0;
    }
  }
}

const transparent = await sharp(rgba, {
  raw: { width: w, height: h, channels: 4 },
})
  .png()
  .toBuffer();

await sharp(transparent).png().toFile('public/logo.png');
await sharp(transparent).png().toFile('public/logo-v28.png');
await sharp(transparent).png().toFile('public/logo-transparent.png');

// Stremio: soggetto su smeraldo pieno (angoli = smeraldo, mai nero)
const subject = await sharp(transparent).png().toBuffer();
await sharp({
  create: {
    width: SIZE,
    height: SIZE,
    channels: 3,
    background: EMERALD,
  },
})
  .composite([{ input: subject, blend: 'over' }])
  .removeAlpha()
  .png()
  .toFile('public/logo-v28-stremio.png');

const L = await sharp('public/logo-v28.png').resize(300, 300).png().toBuffer();
await sharp({
  create: {
    width: 380,
    height: 380,
    channels: 3,
    background: { r: 255, g: 105, b: 180 },
  },
})
  .composite([{ input: L, left: 40, top: 40 }])
  .png()
  .toFile('public/logo-verify-pink.png');

const t = await sharp('public/logo-v28.png')
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const a = (x, y) => t.data[(y * SIZE + x) * 4 + 3];
console.log(
  JSON.stringify({
    corners: [a(0, 0), a(511, 0), a(0, 511), a(511, 511)],
    midEdge: a(256, 2),
    center: a(256, 256),
  })
);
