import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const poolDir = path.join(__dirname, '..', '..', 'data', 'pools');

fs.mkdirSync(poolDir, { recursive: true });

function safeName(key) {
  return String(key).replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 180);
}

export function diskPoolGet(key, maxAgeSeconds) {
  const file = path.join(poolDir, `${safeName(key)}.json`);
  try {
    if (!fs.existsSync(file)) return null;
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!raw?.builtAt || !Array.isArray(raw.items)) return null;
    const age = (Date.now() - raw.builtAt) / 1000;
    if (age > maxAgeSeconds) return null;
    return raw;
  } catch {
    return null;
  }
}

export function diskPoolSet(key, payload) {
  const file = path.join(poolDir, `${safeName(key)}.json`);
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(payload));
  fs.renameSync(tmp, file);
}

export { poolDir };
