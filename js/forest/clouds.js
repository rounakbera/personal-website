// Clouds: cumulus, stratus and cirrus shapes, and the sky's mix of them for a seed and season.
import { rng, hash, dith } from '../util.js';
import { WW, SEASON } from './state.js';

// tone codes: 1 body, 2 shade, 3 sunlit rim, 4 wisp, 5 faint wisp
function puffs(circles, flat = null, sc = 0) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [cx, cy, r] of circles) { x0 = Math.min(x0, cx - r - 1); y0 = Math.min(y0, cy - r - 1); x1 = Math.max(x1, cx + r + 1); y1 = Math.max(y1, cy + r + 1); }
  if (flat !== null) y1 = Math.min(y1, flat);
  x0 = Math.floor(x0); y0 = Math.floor(y0); x1 = Math.ceil(x1); y1 = Math.ceil(y1);
  const w = x1 - x0 + 1, h = y1 - y0 + 1, t = new Uint8Array(w * h);
  // sc > 0 gives each puff a wavy (lumpy) edge instead of a clean circle
  const owner = (x, y) => {
    if (flat !== null && y > flat) return -1;
    for (let i = circles.length - 1; i >= 0; i--) {
      const [cx, cy, r] = circles[i], dx = x - cx, dy = y - cy;
      const re = sc ? r * (1 + sc * Math.sin(Math.atan2(dy, dx) * (4 + Math.round(r / 2)) + i * 2.4)) : r;
      if (dx * dx + dy * dy <= re * re + re * .5) return i;
    }
    return -1;
  };
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const o = owner(x, y); if (o < 0) continue;
    const [cx, cy, r] = circles[o], nx = (x - cx) / r, ny = (y - cy) / r;
    let tone = owner(x, y - 1) < 0 || (owner(x - 1, y - 1) < 0 && ny < 0) ? 3 : (flat !== null && y >= flat - 1) || owner(x + 1, y + 1) < 0 ? 2 : 1;
    if (tone === 1) { const l = -(nx * .5 + ny * .9) + dith(x, y) * .1; tone = l > .6 ? 3 : l < -.15 ? 2 : 1; }
    t[(y - y0) * w + (x - x0)] = tone;
  }
  return { ox: x0, oy: y0, w, h, t };
}
const CLOUDS = {
  cumulus(cr, s) {
    // lumpy cumulus: an uneven flat-bottomed base, a few domes of mixed size, small cauliflower puffs on the domes
    const n = 4 + Math.floor(cr() * 4), base = []; let x = 0;
    for (let i = 0; i < n; i++) { const r = s * (2 + cr() * 2.5); base.push([x + r, -r * .45 + (cr() - .5) * s * 1.5, r]); x += r * (.9 + cr() * .4); }
    const lift = cr(), domes = [], tufts = [], nd = 1 + Math.floor(cr() * (lift < .3 ? 2 : 3));
    for (let i = 0; i < nd; i++) {
      const r = s * (2.8 + cr() * 2.5 + lift * 2.5), cx = x * (.15 + .7 * (i + cr()) / nd), cy = -r * (.65 + lift * .4) - cr() * s * 2;
      domes.push([cx, cy, r]);
      for (let k = 0; k < 2 + Math.floor(cr() * 2); k++) { const a = -Math.PI / 2 + (cr() - .5) * 1.9; tufts.push([cx + Math.cos(a) * r * .72, cy + Math.sin(a) * r * .72, r * (.32 + cr() * .22)]); }
    }
    return { ...puffs([...tufts, ...domes, ...base], 0, .11), a: .95 };
  },
  stratus(cr, s) {
    // a long, low, lumpy sheet
    const len = s * (80 + cr() * 70), c = []; let x = 0;
    while (x < len) { const r = s * (2.5 + cr() * 2.5) * (.55 + .45 * Math.sin(Math.PI * x / len)); c.push([x + r, -r * .35, r]); x += r * (1 + cr() * .6); }
    return { ...puffs(c, 0), a: .85 };
  },
  cirrus(cr, s) {
    const w = Math.round((55 + cr() * 60) * s), h = 26, t = new Uint8Array(w * h);
    const streaks = 6 + Math.floor(cr() * 5), slope = -.06 - cr() * .12;
    for (let k = 0; k < streaks; k++) {
      const sx = cr() * w * .55, sy = 5 + cr() * (h - 10), len = (14 + cr() * 36) * s, hook = cr() < .5;
      for (let i = 0; i < len; i++) {
        const x = Math.round(sx + i), y = Math.round(sy + i * slope + (hook && i > len * .75 ? (i - len * .75) * .45 : 0));
        if (x < 0 || x >= w || y < 0 || y + 1 >= h) continue;
        const f = i / len, core = f > .12 && f < .82;
        t[y * w + x] = core ? 4 : 5;
        if (core && f > .25 && f < .65) t[(y + 1) * w + x] = 5;
      }
    }
    return { ox: 0, oy: -h, w, h, t, a: 1 };
  }
};
// a sky mixes two or three formation types, staggered in height and kept from overlapping
const SKY = {
  //          weight  count    height band
  cumulus:  [3,      [2, 5],  [16, 64]],
  cirrus:   [2,      [1, 2],  [6, 36]],
  stratus:  [2,      [1, 2],  [40, 82]]
};
export function buildClouds(seed) {
  const cr = rng(Math.floor(hash(seed, 7, 3) * 4294967296)), pool = Object.keys(SKY), kinds = [];
  const want = 2 + (cr() < .4 ? 1 : 0);
  while (kinds.length < want) {
    const left = pool.filter(k => !kinds.includes(k)), tot = left.reduce((a, k) => a + SKY[k][0], 0);
    let roll = cr() * tot; for (const k of left) { roll -= SKY[k][0]; if (roll <= 0) { kinds.push(k); break; } }
  }
  const out = [], boxes = [];
  // the usual bands just above the horizon, then extra cumulus and cirrus filling the sky above them;
  // y is fixed relative to the land, so a taller screen simply reveals more of the upper sky
  const groups = kinds.map(kind => [kind, ...SKY[kind].slice(1)]);
  for (const kind of kinds.filter(k => k !== 'stratus')) groups.push([kind, kind === 'cumulus' ? [4, 6] : [2, 4], [-300, -45]]); // starts clear of a 180 px-tall screen, so wide screens never see half of one
  for (const [kind, [lo, hi], [y0, y1]] of groups) {
    const n = Math.round((lo + Math.floor(cr() * (hi - lo + 1))) * WW / 320 * (SEASON === 'spring' ? 1.7 : 1));
    for (let i = 0; i < n; i++) {
      // sizes skew small with the occasional big one
      const c = CLOUDS[kind](cr, (kind === 'cumulus' ? .7 : .6) + Math.pow(cr(), 1.6) * (kind === 'cumulus' ? 1.2 : 1));
      for (let tries = 0; tries < 8; tries++) {
        // alternate high and low within the band so a row of clouds never lines up
        // x in the world strip; y in the 180 px layout (negative = above it, seen on taller screens)
        c.x = Math.round(cr() * (WW + 20) - 10 - c.w / 2);
        c.y = Math.round(y0 + ((i % 2) * .5 + cr() * .5) * (y1 - y0));
        const top = c.y + c.oy;
        if (!boxes.some(([bx, by, bw, bh]) => c.x < bx + bw + 6 && bx < c.x + c.w + 6 && top < by + bh + 3 && by < top + c.h + 3)) break;
      }
      boxes.push([c.x, c.y + c.oy, c.w, c.h]);
      // each cloud steps one pixel right on its own beat, a multiple of 0.5 s: cirrus 1–2.5 s, cumulus 1.5–3.5 s, stratus 2.5–5 s
      const [k0, k1] = { cirrus: [2, 5], cumulus: [3, 7], stratus: [5, 10] }[kind];
      c.step = .5 * (k0 + Math.floor(hash(seed, out.length, 99) * (k1 - k0 + 1)));
      out.push(c);
    }
  }
  out.mood = kinds.join(' + ');
  return out;
}
