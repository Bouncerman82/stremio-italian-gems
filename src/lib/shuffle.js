/**
 * Fisher-Yates shuffle — mescolamento davvero uniforme.
 * Non muta l'array originale: restituisce una copia mescolata.
 */
export function fisherYatesShuffle(items) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Hash 32-bit stabile da stringa. */
export function hashString(str) {
  let h = 2166136261;
  const s = String(str || '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** PRNG seeded (Mulberry32). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Intero in [0, max) deterministico da seed + salt. */
export function seededInt(seed, salt, max) {
  if (max <= 0) return 0;
  const rnd = mulberry32((hashString(`${seed}:${salt}`) || 1) >>> 0);
  return Math.floor(rnd() * max);
}

/**
 * Mappa un indice di catalogo a un indice nel range [0, n) in modo
 * pseudo-casuale e stabile (buona distribuzione, poche collisioni in finestre piccole).
 */
export function seededMapIndex(slot, n, seed) {
  if (n <= 0) return 0;
  if (n === 1) return 0;
  // Mix slot into a permutation-like value without allocating n elements
  const x = hashString(`${seed}|${slot}`);
  const mixed = Math.imul(x ^ slot, 0x9e3779b1) >>> 0;
  return mixed % n;
}
