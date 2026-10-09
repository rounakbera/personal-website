// Scene building: a fixed world strip (built once per seed and season) plus a screen-sized front
// (rebuilt on resize), each flattened to one material per pixel.
import { rng, hash, clamp } from '../util.js';
import { W, H, YO, PX, WW, WH, SV, SEASON } from './state.js';
import { SNOWY } from './palette.js';
import { Layer, MAT, mid, hid } from './layer.js';
import { resetIds, at, clearOrigin, ids, setIds, meadow, KINDS, KIND_LIST, conifer, oak, bush, fern, rock, flowers, ground, groundTop, ridge, treeline } from './draw.js';

// foreground plan: which side the big oak stands on and which two conifers frame the other side
export function planFor(seed) {
  const fr = rng(seed * 7919 + 13), choose = (list) => list[Math.floor(fr() * list.length)];
  let plan = { flip: false, small: 'column', big: 'fir', smallDiv: 6, bigDiv: 15, oakDX: 0, pairDX: 0 };
  if (seed !== 21) {
    const small = choose(['column', 'column', 'spruce', 'blue', 'fir']);
    // spruce and fir read as the same dark-green tiered tree, so the pair must come from different looks
    const LOOK = { spruce: 'green', fir: 'green', lodge: 'green', blue: 'blue', column: 'olive' };
    plan = { flip: fr() < .5, small, big: choose(['fir', 'spruce', 'blue'].filter(k => LOOK[k] !== LOOK[small])) };
    // one tree gets tight layers, the other loose ones (layer height in px ≈ div)
    const tight = 6 + fr() * 2, loose = 13 + fr() * 4;
    [plan.smallDiv, plan.bigDiv] = fr() < .5 ? [tight, loose] : [loose, tight];
    // the framing trees slide a little sideways per forest: the oak on its own, the two conifers together
    // (own stream, so nothing else in the plan or the layout shifts)
    const sr = rng(seed * 104729 + 31);
    plan.oakDX = Math.round((sr() - .5) * 28); plan.pairDX = Math.round((sr() - .5) * 28);
  }
  return plan;
}
const leafOf = (r) => ['oak', 'oak2', 'oak3'][Math.floor(r() * 3)];
// the world: mountains, the field and its groves across a 960 px strip; built once per seed, then windowed by the screen
// clip = [x0, x1]: draw only what touches those columns (the slow trees and clumps skip the rest). The layout,
// ids and textures are unchanged, so a clipped world matches the full one inside the clip; main.js builds the
// visible middle first for a fast first frame and the whole strip once the page is idle
// Returns the world already flattened: each layer is merged as soon as it's drawn, and its buffers are cleared and
// reused for the next, so the ten layers don't each need their own full-strip buffers
export function buildWorld(seed, clip = null) {
  resetIds();
  const flat = blank(WW * WH), out = { push: (L) => merge(flat, L) };
  let L0 = null;
  const NL = (atm, ol = true) => {
    if (!L0) L0 = new Layer(atm, ol, WW, WH);
    else { L0.atm = atm; L0.outline = ol; L0.mat.fill(0); L0.thin.clear(); L0.under.clear(); }
    if (clip) [L0.x0, L0.x1] = clip;
    return L0;
  };
  const r = rng(seed), pick = () => KIND_LIST[Math.floor(r() * KIND_LIST.length)];
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
  return flat;
}
// The load-in zoom rebuilds the front every frame for a slightly different screen size, but its objects keep the shape
// they have in the settled view (SV) and only slide: the ground cover with the world's window, the framing trees with
// the screen edges. So each group is drawn once as it is in the settled view, into a layer of its own, and replayed
// shifted by whole pixels (sx, sy) into the current one; the settled frame replays it unshifted, which is exactly
// drawing it there. (Shifting isn't bit-exact for other sizes, since the drawing does float maths on screen
// coordinates, so a group is keyed on its exact inputs and only zoom frames see shifted copies.) A group's pixels are
// the ones left holding its objects' ids (ids only grow), found in the box it drew in; one that ran off its layer's
// edges replays only where the recording covers.
const FRONT = new Map(); let frontKey = '';
function memo(L, key, sx, sy, draw) {
  const [o0, p0] = ids(); key += `|${o0}|${p0}`;
  let e = FRONT.get(key);
  if (e && e.cut) {
    // the part of the box the current layer shows must lie inside the part the recording's layer showed
    const b = e.box, x0 = Math.max(b[0], -sx), y0 = Math.max(b[1], -sy), x1 = Math.min(b[2], L.w - 1 - sx), y1 = Math.min(b[3], L.h - 1 - sy);
    if (x0 <= x1 && y0 <= y1 && (x0 < Math.max(b[0], 0) || y0 < Math.max(b[1], 0) || x1 > Math.min(b[2], e.w - 1) || y1 > Math.min(b[3], e.h - 1))) e = null;
  }
  if (!e) {
    const Ls = new Layer(0, true, SV.W, SV.H), r = Ls.rec = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity, cut: false };
    draw(Ls);
    Ls.rec = null;
    const [o1] = ids(), { w, mat, tone, part, obj } = Ls, out = [];
    for (let y = Math.max(0, r.y0); y <= Math.min(Ls.h - 1, r.y1); y++) for (let x = Math.max(0, r.x0), i = y * w + x; x <= Math.min(w - 1, r.x1); x++, i++) {
      const o = obj[i]; if (mat[i] && o > o0 && o <= o1) out.push(x, y, mat[i], tone[i], part[i], o);
    }
    FRONT.set(key, e = { rec: Int32Array.from(out), box: [r.x0, r.y0, r.x1, r.y1], cut: r.cut, w: Ls.w, h: Ls.h, ids: ids(), thin: [...Ls.thin], under: [...Ls.under] });
  }
  L.replay(e.rec, sx, sy); for (const t of e.thin) L.thin.add(t); for (const u of e.under) L.under.add(u); setIds(...e.ids);
}
// parallax for the back conifer during the load-in zoom: it stands further in from its screen edge by this fraction
// of its edge distance per unit of extra zoom, so it starts further off and moves faster than the front conifer
const PAR = .5;
// the front: foreground ground cover and the framing trees, sized to the screen; cheap enough to rebuild while resizing
export function buildFront(seed, plan) {
  resetIds(false);
  // sizes and the ground cover's spread follow the settled width (SV.W), so during the load-in zoom nothing is redrawn
  // at a new size each frame: the ground cover moves with the world (off keeps it centred like the world's window)
  // and the framing trees keep their shape as they slide with the screen edges
  const LW = SV.W, k = clamp(LW / 320, .6, 1), ks = Math.sqrt(k);
  // the layout for a view w × h with the land at yo (off: how far the ground cover's window is shifted)
  // F mirrors for flipped seeds; LX/RX anchor the framing trees to the screen edges; MX spreads ground cover across the width
  const lay = (w, h, yo) => {
    const off = (LW >> 1) - (w >> 1), F = (x) => plan.flip ? w - x : x;
    // under a phone's toolbar (rows below yo + 180) the trunks whose foot is already below the visible bottom run on
    // a little (sink, 10 px), so the foot shows through the toolbar partway down rather than lined up with its top
    // edge; the trees themselves don't move or grow, and without a toolbar strip nothing changes
    return { off, Y: (y) => y + yo, LX: (x) => F(x * k), RX: (x) => F(w - (320 - x) * k), MX: (x) => (plan.flip ? LW - x * LW / 320 : x * LW / 320) - off,
      sink: (base) => base > yo + 180 && h > yo + 180 ? Math.min(10, h - base) : 0, top: groundTop(yo + 160, 3, 4, -(w >> 1)) };
  };
  const cur = lay(W, H, YO), set = lay(SV.W, SV.H, SV.YO), sy = YO - SV.YO;
  const fk = [seed, JSON.stringify(plan), SEASON].join('|'); if (fk !== frontKey || FRONT.size > 64) { FRONT.clear(); frontKey = fk; }
  // every object gets fixed part ids (via at()), its own random stream and its own texture origin, so nothing reshuffles as it slides
  const fg = new Layer(0, false); at(0, 0, 100); ground(fg, cur.Y(160), 3, 'grass', 4, null, true, -(W >> 1));
  const ft = new Layer(0);
  // ground cover by season: wildflowers (many more in spring), fallen leaves in autumn, nothing under the snow
  const { MX, top } = set;
  memo(ft, `cover|${LW}|${SV.YO}`, set.off - cur.off, sy, (L) => {
    if (SEASON !== 'winter') { const [a, b, n] = { spring: [16, 304, 90], summer: [60, 240, 16], autumn: [30, 290, 34] }[SEASON]; at(0, 0, 200); flowers(L, rng(seed + 2), Math.min(MX(a), MX(b)), Math.max(MX(a), MX(b)), top, n, 'flower', SV.YO + 180); }
    const br = rng(seed + 3);
    [[70, 26], [96, 20], [222, 20], [122, 16], [190, 18]].forEach(([x, w], i) => { at(MX(x), top(MX(x)), 2000 + i * 40); bush(L, MX(x), top(MX(x)) + 3, w * ks, leafOf(br), br); });
    if (SEASON !== 'winter') [[84, 10], [150, 8], [206, 9], [244, 11]].forEach(([x, s], i) => { at(MX(x), 0, 3000 + i * 10); fern(L, MX(x), top(MX(x)) + 1, s, SEASON === 'autumn' ? 'autY' : 'oak'); });
    [[168, 5, true], [108, 3, false], [140, 2, false], [236, 6, true], [246, 3, false], [200, 2, false], [56, 4, true]].forEach(([x, sz, moss], i) => { at(MX(x), top(MX(x)), 3500 + i * 10); rock(L, MX(x), top(MX(x)) + 2 + sz * .3, sz, moss); });
  });
  // each tree is drawn where it stands in the settled view and shifted to where it stands in this one. par (only for
  // trees anchored with RX) adds parallax: an extra shift toward the middle, proportional to the tree's distance from
  // its edge and to the extra zoom (PX / SV.PX − 1), so it's 0 once settled and the same on either side of a flip
  const tree = (name, x, base, draw, par = 0) => {
    const xs = x(set), sink = set.sink(set.Y(base));
    const p = par * (PX / SV.PX - 1) * (plan.flip ? xs : SV.W - xs) * (plan.flip ? 1 : -1);
    memo(ft, `${name}|${xs}|${SV.YO}|${k}|${sink}`, Math.round(x(cur) - xs + p), sy, (L) => draw(L, xs, set.Y(base), sink));
  };
  tree('oak', (g) => g.LX(34 + plan.oakDX), 186, (L, x, y, sink) => { at(x, y, 4000); oak(L, x, y, 150 * ks, 'oak', rng(seed + 4), { k: 10, R: .38, sym: true, inward: plan.flip ? -1 : 1, sink }); });
  tree('small', (g) => g.RX(264 + plan.pairDX), 178, (L, x, y, sink) => { at(x, y, 5000); conifer(L, x, y, 100 * ks, plan.small, rng(seed + 5), { lean: 0, tierVar: .08, div: plan.smallDiv, sink }); }, PAR);
  tree('big', (g) => g.RX(302 + plan.pairDX), 188, (L, x, y, sink) => { at(x, y, 6000); conifer(L, x, y, 176 * ks, plan.big, rng(seed + 6), { lean: 0, flare: 3, tierVar: .08, div: plan.bigDiv, sink, ...(plan.big === 'fir' ? { w: .3 } : {}) }); });
  clearOrigin();
  return [fg, ft];
}
// winter: snow settles on every upward-facing surface of conifers, rocks, hills and branches, just under the outline
const BARK = mid('bark'), SNOW = mid('snow');
function snowify(L) {
  const w = L.w, h = L.h, [xa, xb] = L.cols();
  for (let y = 0; y < h; y++) for (let x = xa; x < xb; x++) {
    const i = y * w + x, m = MAT[L.mat[i]]; if (!SNOWY.has(m)) continue;
    const o = L.obj[i];
    if (y > 0 && L.mat[i - w] && L.obj[i - w] === o) continue;   // not a top surface
    const ol = L.outline && !L.thin.has(o), depth = m === 'rock' ? 3 : m === 'bark' ? 1 : 2;
    if (m === 'bark' && hash(x, y, 61) < .6) continue;                      // patchy on branches
    if (m === 'bark' && !ol && !(y + 1 < h && L.obj[i + w] === o && L.mat[i + w] === BARK)) continue; // only on wood thick enough to hold it
    for (let k = ol ? 1 : 0; k <= depth - (ol ? 0 : 1); k++) {
      const yy = y + k, j = yy * w + x; if (yy >= h || L.obj[j] !== o || !SNOWY.has(MAT[L.mat[j]])) break;
      if (k > 1 && hash(x, yy, 62) < .45) break;                             // ragged lower edge
      L.mat[j] = SNOW; L.tone[j] = k <= (ol ? 1 : 0) ? 5 : 4;
    }
  }
}
// keep only the top-most material per pixel (with its layer's haze id); the layer buffers are dropped
const blank = (n) => ({ mat: new Uint8Array(n), tone: new Uint8Array(n), haze: new Uint8Array(n) });
function merge(flat, L) {
  L.finalize(); if (SEASON === 'winter') snowify(L);
  const { mat, tone, haze } = flat, w = L.w, [xa, xb] = L.cols(), hz = hid(L.atm);
  for (let y = 0; y < L.h; y++) for (let i = y * w + xa, e = y * w + xb; i < e; i++) if (L.mat[i]) { mat[i] = L.mat[i]; tone[i] = L.tone[i]; haze[i] = hz; }
}
export function flatten(layers, w, h) {
  const flat = blank(w * h);
  for (const L of layers) merge(flat, L);
  return flat;
}
