// Scene building: a fixed world strip (built once per seed and season) plus a screen-sized front
// (rebuilt on resize), each flattened to one material per pixel.
import { rng, hash, clamp } from '../util.js';
import { W, YO, WW, WH, SEASON } from './state.js';
import { SNOWY } from './palette.js';
import { Layer } from './layer.js';
import { resetIds, at, clearOrigin, meadow, KINDS, KIND_LIST, conifer, oak, bush, fern, rock, flowers, ground, ridge, treeline } from './draw.js';

// foreground plan: which side the big oak stands on and which two conifers frame the other side
export function planFor(seed) {
  const fr = rng(seed * 7919 + 13), choose = (list) => list[Math.floor(fr() * list.length)];
  let plan = { flip: false, small: 'column', big: 'fir', smallDiv: 6, bigDiv: 15 };
  if (seed !== 21) {
    const small = choose(['column', 'column', 'spruce', 'blue', 'fir']);
    // spruce and fir read as the same dark-green tiered tree, so the pair must come from different looks
    const LOOK = { spruce: 'green', fir: 'green', lodge: 'green', blue: 'blue', column: 'olive' };
    plan = { flip: fr() < .5, small, big: choose(['fir', 'spruce', 'blue'].filter(k => LOOK[k] !== LOOK[small])) };
    // one tree gets tight layers, the other loose ones (layer height in px ≈ div)
    const tight = 6 + fr() * 2, loose = 13 + fr() * 4;
    [plan.smallDiv, plan.bigDiv] = fr() < .5 ? [tight, loose] : [loose, tight];
  }
  return plan;
}
const leafOf = (r) => ['oak', 'oak2', 'oak3'][Math.floor(r() * 3)];
// the world: mountains, the field and its groves across a 960 px strip; built once per seed, then windowed by the screen
export function buildWorld(seed) {
  resetIds();
  const r = rng(seed), out = [], pick = () => KIND_LIST[Math.floor(r() * KIND_LIST.length)], NL = (atm, ol = true) => new Layer(atm, ol, WW, WH);
  const m = NL(.55, false); ridge(m, 100, 30, 1.2); out.push(m);
  const f = NL(.4, false); treeline(f, 110, r, 8, 14, 3, 6); out.push(f);
  const mg = NL(.2, false); ground(mg, 119, 2, 'grass', 2, r, false, -WW / 2); out.push(mg);
  // meadow specks across the field: wildflowers in spring, fallen leaves in autumn (own random stream, so the layout never shifts)
  if (SEASON === 'spring' || SEASON === 'autumn') {
    const md = NL(.12, false), cols = { spring: ['flower', 'fy', 'fw', 'fv', 'fb'], autumn: ['autO', 'autY', 'autR'] }[SEASON];
    meadow(md, rng(seed + 77), SEASON === 'spring' ? 420 : 260, cols, WW, 123, 50);
    out.push(md);
  }
  const edge = NL(.24);
  for (let x = -4; x < WW + 6; x += 5 + Math.floor(r() * 6)) r() < .3 ? oak(edge, x, 123 + r() * 2, 15 + r() * 6, 'oak', r, { k: 6 }) : conifer(edge, x, 123 + r() * 2, 14 + r() * 12, pick(), r);
  out.push(edge);
  // trees spread across the strip at four depths, one candidate per slot; a tree never stands right behind one of the same type
  const placed = [], clash = (x, hw, type) => placed.some(q => q.type === type && Math.abs(q.x - x) < (q.hw + hw) * .75);
  [[131, .17, 13, 34, 9], [140, .11, 18, 44, 7], [149, .06, 24, 56, 6], [156, .03, 32, 68, 4]].forEach(([y, atm, h0, h1, slots0], bi) => {
    const L = NL(atm), items = [], slots = Math.round(slots0 * WW / 320);
    for (let sl = 0; sl < slots; sl++) {
      if (r() < .18) continue;
      items.push([(sl + .1 + r() * .8) * WW / slots, y + r() * 4, 'tree']);
      if (r() < .3) items.push([r() * WW, y + 2 + r() * 4, 'rock']);
    }
    items.sort((a, b) => a[1] - b[1]);
    for (const [x, yy, what] of items) {
      if (what === 'rock') { rock(L, x, yy, 2 + bi + r() * 2, r() < .4); continue; }
      const h = h0 + Math.pow(r(), 1.3) * (h1 - h0), roll = r();
      let type = roll < .4 ? 'oak' : roll < .48 ? 'bush' : pick();
      if (type === 'bush') { bush(L, x, yy, h * .45, leafOf(r), r); continue; }
      const hwOf = (t) => t === 'oak' ? h * .85 * .38 : h * KINDS[t].w;
      for (let tries = 0; tries < 5 && clash(x, hwOf(type), type); tries++) type = type === 'oak' || r() < .6 ? pick() : 'oak';
      if (clash(x, hwOf(type), type)) continue;
      placed.push({ x, hw: hwOf(type), type });
      if (type === 'oak') oak(L, x, yy, h * .85, leafOf(r), r, { k: 8 });
      else conifer(L, x, yy, h, type, r);
    }
    out.push(L);
  });
  return out;
}
// the front: foreground ground cover and the framing trees, sized to the screen; cheap enough to rebuild while resizing
export function buildFront(seed, plan) {
  resetIds(false);
  const Y = (y) => y + YO, k = clamp(W / 320, .6, 1), ks = Math.sqrt(k);
  // F mirrors for flipped seeds; LX/RX anchor the framing trees to the screen edges; MX spreads ground cover across the width
  const F = (x) => plan.flip ? W - x : x, LX = (x) => F(x * k), RX = (x) => F(W - (320 - x) * k), MX = (x) => F(x * W / 320);
  // every object gets fixed part ids (via at()), its own random stream and its own texture origin, so nothing reshuffles as it slides
  const fg = new Layer(0, false); at(0, 0, 100); const top = ground(fg, Y(160), 3, 'grass', 4, null, true, -(W >> 1));
  const ft = new Layer(0);
  // ground cover by season: wildflowers (many more in spring), fallen leaves in autumn, nothing under the snow
  if (SEASON !== 'winter') { const [a, b, n] = { spring: [24, 296, 48], summer: [60, 240, 16], autumn: [30, 290, 34] }[SEASON]; at(0, 0, 200); flowers(ft, rng(seed + 2), Math.min(MX(a), MX(b)), Math.max(MX(a), MX(b)), top, n); }
  const br = rng(seed + 3);
  [[70, 26], [96, 20], [222, 20], [122, 16], [190, 18]].forEach(([x, w], i) => { at(MX(x), top(MX(x)), 2000 + i * 40); bush(ft, MX(x), top(MX(x)) + 3, w * ks, leafOf(br), br); });
  if (SEASON !== 'winter') [[84, 10], [150, 8], [206, 9], [244, 11]].forEach(([x, s], i) => { at(MX(x), 0, 3000 + i * 10); fern(ft, MX(x), top(MX(x)) + 1, s, SEASON === 'autumn' ? 'autY' : 'oak'); });
  [[168, 5, true], [108, 3, false], [140, 2, false], [236, 6, true], [246, 3, false], [200, 2, false], [56, 4, true]].forEach(([x, sz, moss], i) => { at(MX(x), top(MX(x)), 3500 + i * 10); rock(ft, MX(x), top(MX(x)) + 2 + sz * .3, sz, moss); });
  at(LX(34), Y(186), 4000); oak(ft, LX(34), Y(186), 150 * ks, 'oak', rng(seed + 4), { k: 10, R: .38, sym: true });
  at(RX(264), Y(178), 5000); conifer(ft, RX(264), Y(178), 100 * ks, plan.small, rng(seed + 5), { lean: 0, tierVar: .08, div: plan.smallDiv });
  at(RX(302), Y(188), 6000); conifer(ft, RX(302), Y(188), 176 * ks, plan.big, rng(seed + 6), { lean: 0, flare: 3, tierVar: .08, div: plan.bigDiv, ...(plan.big === 'fir' ? { w: .3 } : {}) });
  clearOrigin();
  return [fg, ft];
}
// winter: snow settles on every upward-facing surface of conifers, rocks, hills and branches, just under the outline
function snowify(L) {
  const w = L.w, h = L.h;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, m = L.mat[i]; if (!SNOWY.has(m)) continue;
    const o = L.obj[i];
    if (y > 0 && L.mat[i - w] !== null && L.obj[i - w] === o) continue;   // not a top surface
    const ol = L.outline && !L.thin.has(o), depth = m === 'rock' ? 3 : m === 'bark' ? 1 : 2;
    if (m === 'bark' && hash(x, y, 61) < .6) continue;                      // patchy on branches
    if (m === 'bark' && !ol && !(y + 1 < h && L.obj[i + w] === o && L.mat[i + w] === 'bark')) continue; // only on wood thick enough to hold it
    for (let k = ol ? 1 : 0; k <= depth - (ol ? 0 : 1); k++) {
      const yy = y + k, j = yy * w + x; if (yy >= h || L.obj[j] !== o || !SNOWY.has(L.mat[j])) break;
      if (k > 1 && hash(x, yy, 62) < .45) break;                             // ragged lower edge
      L.mat[j] = 'snow'; L.tone[j] = k <= (ol ? 1 : 0) ? 5 : 4;
    }
  }
}
// keep only the top-most material per pixel; the layer buffers are dropped
export function flatten(layers, w, h) {
  const n = w * h, mat = new Array(n).fill(null), tone = new Uint8Array(n), atm = new Float32Array(n);
  for (const L of layers) { L.finalize(); if (SEASON === 'winter') snowify(L); for (let i = 0; i < n; i++) if (L.mat[i] !== null) { mat[i] = L.mat[i]; tone[i] = L.tone[i]; atm[i] = L.atm; } }
  return { mat, tone, atm };
}
