// Small shared helpers: seeded randomness, coordinate hashing, colour maths and dithering.

// a seeded random stream: rng(seed)() returns the next number in [0, 1)
export const rng = (seed) => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
export const hash = (x, y, s = 0) => { let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s, 982451653)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
export const lerp = (a, b, t) => a + (b - a) * t;
export const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
export const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

export const dith = (x, y) => BAYER[((y & 3) * 4) + (x & 3)] / 16 - .5;
// smooth value noise (0–1) on a grid of the given cell size: gives clumpy, uneven leaf texture
export const vnoise = (x, y, cell, s) => {
  const gx = x / cell, gy = y / cell, x0 = Math.floor(gx), y0 = Math.floor(gy), fx = gx - x0, fy = gy - y0;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  return lerp(lerp(hash(x0, y0, s), hash(x0 + 1, y0, s), sx), lerp(hash(x0, y0 + 1, s), hash(x0 + 1, y0 + 1, s), sx), sy);
};
