// Drawing primitives: trees, bushes, rocks, ground cover, ground and hills, all written into Layer buffers.
import { rng, hash, lerp, clamp, dith, vnoise } from '../util.js';
import { SEASON } from './state.js';
import { toneOf } from './layer.js';

// texture origin of the object being drawn: textures are hashed from coordinates relative to it,
// so they stick to objects that slide on resize
let ORX = 0, ORY = 0;
// running object and part ids (objects get outlines against each other; parts get the shade line under them)
let OBJ = 0, PART = 0;

// start numbering from scratch (a new world or front)
export function resetIds(all = true) { OBJ = 0; if (all) { PART = 0; ORX = 0; ORY = 0; } }
// pin the next object's texture origin and part numbering, so it looks the same wherever it slides
export function at(x, y, id) { ORX = Math.round(x); ORY = Math.round(y); PART = id; }
export function clearOrigin() { ORX = ORY = 0; }

function blob(L, cx, cy, r, mat, obj, sx = 1, sy = 1, o = {}) {
  const part = ++PART, seed = hash((cx - ORX) | 0, (cy - ORY) | 0, part) * 6.28, sc = o.scallop ?? (.05 + hash(part, 1, 9) * .06), lobes = 4 + Math.floor(hash(part, 2, 9) * 4) + Math.round(r / 5);
  if (o.under) L.under.add(part);
  for (let y = Math.floor(cy - r * sy) - 2; y <= cy + r * sy + 2; y++) for (let x = Math.floor(cx - r * sx) - 2; x <= cx + r * sx + 2; x++) {
    const dx = (x - cx) / sx, dy = (y - cy) / sy, d = Math.hypot(dx, dy);
    // edge waviness mostly on the underside; the sunlit top stays smooth
    if (d > r * (1 + sc * Math.sin(Math.atan2(dy, dx) * lobes + seed) * (dy < 0 ? .55 : 1)) + .4) continue;
    const nx = dx / r, ny = dy / r;
    // lighting per clump, broken up by two scales of leaf-cluster noise so clumps don't read as smooth balls
    let tone = o.tone ?? (o.shade ? (vnoise(x - ORX, y - ORY, 2.6, part) < .45 ? 1 : 2) : toneOf(-(nx * .5 + ny * .8) + dith(x - ORX, y - ORY) * .2 + (vnoise(x - ORX, y - ORY, 2.6, part) - .5) * .7 + (vnoise(x - ORX, y - ORY, 1.3, part + 7) - .5) * .45));
    if (o.tone === undefined && !o.shade && ny < .1 && tone < 5 && hash(x - ORX, y - ORY, part) < .05) tone++;
    // spring blossom: small clusters of petals on the sunnier side of leafy clumps, pink or white per tree
    if (SEASON === 'spring' && !o.shade && mat.startsWith('oak') && tone >= 3 && vnoise(x - ORX, y - ORY, 2.2, part + 3) > .7 - (ny < 0 ? .06 : 0) && hash(x - ORX, y - ORY, part + 4) < .8) { L.put(x, y, hash(obj, 5, 77) < .65 ? 'bloom' : 'bloomW', tone >= 4 ? 4 : 3, part, obj); continue; }
    L.put(x, y, mat, tone, part, obj);
  }
}
function trunk(L, cx, top, base, w, mat, obj, flare = 0, grooves = .18) {
  const part = ++PART;
  for (let y = Math.floor(top); y < base; y++) {
    const fy = flare ? Math.max(0, y - (base - flare * 2.2)) * .55 : 0, hw = w / 2 + fy;
    for (let x = Math.floor(cx - hw); x < Math.ceil(cx + hw); x++) {
      const u = (x - (cx - hw)) / (2 * hw);
      let tone = u < .2 ? 4 : u < .55 ? 3 : u < .85 ? 2 : 1;
      if (hash(x - ORX, 0, part) < grooves && hash(x - ORX, (y - ORY) >> 2, part + 1) < .75) tone = Math.max(1, tone - 1);
      if (u > .12 && u < .3 && hash(x - ORX, (y - ORY) >> 1, part + 2) < .25) tone = 5;
      L.put(x, y, mat, tone, part, obj);
    }
  }
}
function limb(L, x0, y0, x1, y1, w, mat, obj) {
  const part = ++PART, n = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
  for (let i = 0; i <= n; i++) {
    const x = lerp(x0, x1, i / n), y = lerp(y0, y1, i / n), ww = Math.max(1, w * (1 - i / n * .6));
    for (let k = 0; k < ww; k++) L.put(x + k - ww / 2, y, mat, k < ww / 2 ? 4 : 2, part, obj);
  }
}
function tier(L, cx, ty, th, hw, mat, obj) {
  const part = ++PART;
  for (let y = Math.floor(ty); y <= ty + th + hw * .35 + 2; y++) {
    const ry = (y - ty) / th;
    for (let x = Math.floor(cx - hw - 1); x <= cx + hw + 1; x++) {
      const ax = Math.abs(x - cx) / hw; if (ax > 1) continue;
      // ragged edges: each column's needle tip ends at its own length, occasionally drooping further
      const jag = hash(x - ORX, part, 5) * .18 - (hash(x - ORX, part, 6) < .12 ? .12 : 0), side = (hash(y - ORY, part, 8) - .5) * .1 * ry; // sides calmer near the top
      if (ax > ry * 1.05 + side || ry > 1 + ax * .32 - jag) continue;
      const nx = (x - cx) / hw;
      let l = -nx * .75 + (.45 - ry) * 1.1 + dith(x - ORX, y - ORY) * .25 + (vnoise(x - ORX, y - ORY, 2.2, part) - .5) * .55;
      if (ry < .7 && hash(x - ORX, y - ORY, part + 9) < .04) l += .5;
      // winter: a few clumps of snow caught in the needles
      if (SEASON === 'winter' && ry > .25 && ry < .9 && nx < .5 && hash(x - ORX, y - ORY, part + 11) < .06) { L.put(x, y, 'snow', l > 0 ? 5 : 4, part, obj); continue; }
      L.put(x, y, mat, toneOf(l), part, obj);
    }
  }
}
function pine(L, cx, base, h, mat = 'pine', o = {}) {
  const obj = ++OBJ;
  const n = o.tiers || Math.max(3, Math.round(h / (o.div || 15)));
  const tw = Math.max(2, Math.round(h / 20)), trunkH = Math.round(h * (o.trunk || .16));
  const mw = h * (o.w || .27), crownTop = base - h, crownH = h - trunkH, step = crownH / (n + .6);
  const r = o.r, lean = o.lean || 0;
  if (h > 20) trunk(L, cx, base - trunkH - step, base, tw, 'bark', obj, o.flare || 0);
  // tier heights: uniform by default; with tierVar each tier gets its own height, rescaled to fill the crown
  const wts = Array.from({ length: n }, (_, i) => r && o.tierVar && i > 0 ? Math.max(.55, 1 + (r() - .5) * 2 * o.tierVar) : 1);
  const span = step * n / wts.reduce((a, b) => a + b, 0), tops = []; let acc = 0;
  wts.forEach(w => { tops.push(acc); acc += w * span; });
  for (let i = n - 1; i >= 0; i--) {
    const th = wts[i] * span * 1.7, f = clamp((tops[i] + th * .85) / crownH, 0, 1);
    // width follows one smooth outline for the whole tree; only a little per-tier wobble
    const prof = o.round ? (f < .62 ? Math.pow(f / .62, .55) : 1 - (f - .62) * .5) : Math.pow(f, .92);
    const wob = r ? .93 + r() * .12 : 1, dx = r && i > 1 && h > 40 ? Math.round((r() - .5) * 1.6) : 0;
    // lean: 0 at the bottom layer (so the crown sits on its trunk), easing to at most 2 px at the top
    const leanOff = n > 1 ? Math.round(lean * 4 * (n - 1 - i) / (n - 1)) : 0;
    tier(L, cx + dx + leanOff, crownTop + tops[i], th, Math.max(1.5, mw * prof * wob), mat, obj);
  }
  return obj;
}
// conifer species: width, tier spacing, bare-trunk share, palette, crown profile
export const KINDS = {
  spruce: { w: .21, div: 9,  trunk: .1,  mat: 'pine' },
  fir:    { w: .34, div: 17, trunk: .12, mat: 'deep' },
  blue:   { w: .27, div: 11, trunk: .12, mat: 'blue' },
  column: { w: .15, div: 6,  trunk: .05, mat: 'olive', round: true },
  lodge:  { w: .19, div: 9,  trunk: .45, mat: 'pine' },
  sapling:{ w: .3,  div: 8,  trunk: .18, mat: 'oak' }
};
export const KIND_LIST = ['spruce', 'spruce', 'fir', 'blue', 'column', 'lodge', 'spruce', 'blue'];
export function conifer(L, cx, base, h, kind, r, extra = {}) {
  const k = KINDS[kind];
  return pine(L, cx, base, h, k.mat, { ...k, r, div: k.div * (.75 + r() * .5), tierVar: .06, lean: r() < .2 ? (r() < .5 ? -.5 : .5) : 0, ...extra });
}
export function oak(L, cx, base, h, mat, r, o = {}) {
  const obj = ++OBJ, tw = Math.max(3, Math.round(h / 11));
  trunk(L, cx, base - h * .6, base, tw, 'bark', obj, Math.round(tw * .6));
  if (SEASON !== 'winter') {
    limb(L, cx, base - h * .42, cx - h * .2, base - h * .64, Math.max(1, tw * .45), 'bark', obj);
    limb(L, cx, base - h * .48, cx + h * .22, base - h * .7, Math.max(1, tw * .45), 'bark', obj);
  }
  const R = h * (o.R || .34), ccx = cx, ccy = base - h * .7, blobs = [];
  const k = o.k || 10;
  // dark underlayer that fills gaps between clumps: kept smaller than the canopy so it never pokes out, smooth-edged, and mottled like leaves
  if (SEASON !== 'winter') blob(L, ccx, ccy, R * (o.sym ? .74 : .62), mat, obj, o.sym ? 1.06 : 1.2, o.sym ? .94 : .8, { shade: true, scallop: .03, under: true });
  if (o.sym) {
    // rounder crown: an outer ring of clumps at near-even angles, plus a few filling the middle
    // outer ring: clump sizes vary a lot, but each is pushed in or out so its edge lands near the same radius
    for (let i = 0; i < k; i++) {
      const a = i / k * Math.PI * 2 + (r() - .5) * .45, s = Math.pow(r(), 1.4), rad = R * (.2 + s * .3), d = R * (.86 + s * .14) - rad;
      blobs.push([ccx + Math.cos(a) * d * 1.06, ccy + Math.sin(a) * d * .94, rad]);
    }
    for (let i = 0; i < 4; i++) { const a = (i + r() * .6) / 4 * Math.PI * 2, d = R * (.15 + r() * .25); blobs.push([ccx + Math.cos(a) * d, ccy + Math.sin(a) * d * .9, R * (.24 + r() * .22)]); }
  } else {
    for (let i = 0; i < k; i++) { const a = r() * Math.PI * 2, d = Math.sqrt(r()) * R * .62; blobs.push([ccx + Math.cos(a) * d * 1.25, ccy + Math.sin(a) * d * .75, R * (.36 + r() * .2)]); }
  }
  if (!o.sym) blobs.push([ccx, ccy - R * .2, R * .5]);
  blobs.sort((a, b) => b[1] - a[1]);
  if (SEASON === 'winter') { bare(L, cx, base, h, tw, blobs, obj); return obj; }
  for (const b of blobs) blob(L, b[0], b[1], b[2], mat, obj);
  return obj;
}
// winter oak, grown by space colonisation: points scattered through the summer crown pull branches toward them,
// so wood forks naturally and fills the crown; widths follow the pipe rule (a limb's cross-section = the sum of its children's)
const BARE = new Map();
function bareShape(cx, base, h, tw, blobs, key) {
  if (BARE.has(key)) return BARE.get(key);
  const inside = (x, y) => blobs.some(([bx, by, br]) => (x - bx) ** 2 + (y - by) ** 2 <= (br * 1.05) ** 2);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [bx, by, br] of blobs) { x0 = Math.min(x0, bx - br); y0 = Math.min(y0, by - br); x1 = Math.max(x1, bx + br); y1 = Math.max(y1, by + br); }
  const rr = rng(key.length * 7 + Math.floor(hash(Math.round(x1 - x0), Math.round(y1 - y0), Math.round(h)) * 1e9));
  const R = Math.max(x1 - x0, y1 - y0) / 2, D = clamp(R / 22, 1, 2.6), di = Math.max(4, R * .4), dk = D * 2.2;
  // attraction points, denser toward the crown's outer shell where the twigs are
  const pts = [];
  for (let tries = 0, want = Math.round((x1 - x0) * (y1 - y0) / (D * D * 4.5)); tries < want * 3 && pts.length < want; tries++) {
    const x = lerp(x0, x1, rr()), y = lerp(y0, y1, rr()); if (inside(x, y)) pts.push([x, y]);
  }
  const nx = [cx], ny = [base - h * .58], par = [-1], cell = di, grid = new Map(), gk = (x, y) => (Math.floor(x / cell) + 500) * 4096 + Math.floor(y / cell) + 500;
  const add = (x, y, p) => { const i = nx.length; nx.push(x); ny.push(y); par.push(p); const k = gk(x, y); (grid.get(k) || grid.set(k, []).get(k)).push(i); return i; };
  grid.set(gk(nx[0], ny[0]), [0]);
  let alive = pts.map(() => true), left = pts.length;
  for (let it = 0; it < 400 && left > 0; it++) {
    const pull = new Map();
    pts.forEach(([px, py], j) => {
      if (!alive[j]) return;
      let best = -1, bd = di * di; const cx0 = Math.floor(px / cell), cy0 = Math.floor(py / cell);
      for (let gx = cx0 - 1; gx <= cx0 + 1; gx++) for (let gy = cy0 - 1; gy <= cy0 + 1; gy++) for (const i of grid.get((gx + 500) * 4096 + gy + 500) || []) { const dd = (nx[i] - px) ** 2 + (ny[i] - py) ** 2; if (dd < bd) { bd = dd; best = i; } }
      if (best < 0) return;
      if (bd < dk * dk) { alive[j] = false; left--; return; }
      const l = Math.sqrt(bd), v = pull.get(best) || [0, 0]; v[0] += (px - nx[best]) / l; v[1] += (py - ny[best]) / l; pull.set(best, v);
    });
    if (!pull.size) {
      // nothing in reach yet (the crown starts above the trunk): reach up from the newest node toward what is left
      let sx = 0, sy = 0, c = 0; pts.forEach(([px, py], j) => { if (alive[j]) { sx += px; sy += py; c++; } });
      const i = nx.length - 1, dx = sx / c - nx[i], dy = sy / c - ny[i], l = Math.hypot(dx, dy) || 1;
      add(nx[i] + dx / l * D, ny[i] + dy / l * D, i); continue;
    }
    for (const [i, [vx, vy]] of pull) {
      let dx = vx, dy = vy - .35 * Math.hypot(vx, vy) + (rr() - .5) * .3; const l = Math.hypot(dx, dy) || 1;
      add(nx[i] + dx / l * D, ny[i] + dy / l * D, i);
    }
  }
  // pipe rule from the tips back to the root, scaled so the root matches the trunk
  const n = nx.length, acc = new Float32Array(n), kids = new Uint16Array(n);
  for (let i = 1; i < n; i++) kids[par[i]]++;
  for (let i = n - 1; i > 0; i--) { if (!kids[i]) acc[i] += 1; acc[par[i]] += acc[i]; }
  const k = tw * .8 / Math.sqrt(acc[0] || 1), w = Array.from(acc, (a) => Math.max(.5, Math.sqrt(a) * k));
  const shape = { dx: nx.map(x => x - cx), dy: ny.map(y => y - base), par, w };
  BARE.set(key, shape);
  return shape;
}
function bare(L, cx, base, h, tw, blobs, obj) {
  const key = [Math.round(h * 10), ...blobs.map(([bx, by, br]) => Math.round((bx - cx) * 4) + ',' + Math.round((by - base) * 4) + ',' + Math.round(br * 4))].join('|');
  const { dx, dy, par, w } = bareShape(cx, base, h, tw, blobs, key);
  // fine wood is a separate, unoutlined object so it reads as twigs, not black wire
  const fine = ++OBJ; L.thin.add(fine);
  const pBig = ++PART, pFine = ++PART; L.under.add(pBig); L.under.add(pFine);
  for (let i = 1; i < dx.length; i++) {
    const p = par[i], x0 = cx + dx[p], y0 = base + dy[p], x1 = cx + dx[i], y1 = base + dy[i], ww = w[i];
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0))), ax = (y1 - y0), ay = -(x1 - x0), al = Math.hypot(ax, ay) || 1;
    // normal pointing to the lit upper-left side
    let ux = ax / al, uy = ay / al; if (ux + uy > 0) { ux = -ux; uy = -uy; }
    for (let t = 0; t <= steps; t++) {
      const x = Math.round(lerp(x0, x1, t / steps)), y = Math.round(lerp(y0, y1, t / steps));
      if (ww < 1.25) { L.put(x, y, ww < .85 ? 'twig' : 'bark', ww < .85 ? 3 : 2, pFine, fine); continue; }
      const big = ww >= 2.6, rad = ww / 2, c = Math.ceil(rad);
      for (let yy = -c; yy <= c; yy++) for (let xx = -c; xx <= c; xx++) {
        if (xx * xx + yy * yy > rad * rad + .3) continue;
        const side = -(xx * ux + yy * uy) / rad;
        L.put(x + xx, y + yy, 'bark', side < -.35 ? 4 : side < .35 ? 3 : 2, big ? pBig : pFine, big ? obj : fine);
      }
    }
  }
}
// flat dark patch on the ground so small objects sit on it instead of floating
function contact(L, cx, y, rx) {
  const obj = ++OBJ, part = ++PART; L.thin.add(obj);
  for (let dy = 0; dy < 2; dy++) { const w = Math.round(rx * (dy ? .7 : 1)); for (let x = -w; x <= w; x++) L.put(cx + x, y + dy, 'grass', dy ? 1 : 0, part, obj); }
}
export function bush(L, cx, base, w, mat, r) {
  contact(L, cx, Math.round(base + 1), w * .62);
  const obj = ++OBJ, blobs = [];
  mat = { oak: 'shrub', oak2: 'shrub2', oak3: 'shrub3' }[mat] || mat;
  for (let i = 0; i < 4; i++) { const rad = w * (.24 + r() * .12); blobs.push([cx + (r() - .5) * w * .9, base - rad * (.7 + r() * .5), rad]); }
  blobs.sort((a, b) => b[1] - a[1]);
  for (const b of blobs) blob(L, b[0], b[1], b[2], mat, obj, 1.3, 1);
  return obj;
}
export function fern(L, x0, base, s, mat) {
  const obj = ++OBJ; L.thin.add(obj);
  for (let f = 0; f < 5; f++) {
    const part = ++PART; let x = x0, y = base, a = -Math.PI / 2 + (f - 2) * .5;
    const bend = f < 2 ? -.075 : f > 2 ? .075 : 0, len = s * (f === 2 ? 1 : .85);
    for (let i = 0; i < len; i++) {
      L.put(x, y, mat, i > len * .65 ? 3 : 4, part, obj);
      if (i % 2 === 0 && i > 1) {
        L.put(x + Math.cos(a + 1.5) * 1.4, y + Math.sin(a + 1.5) * 1.4, mat, 2, part, obj);
        L.put(x + Math.cos(a - 1.5) * 1.4, y + Math.sin(a - 1.5) * 1.4, mat, 5, part, obj);
      }
      x += Math.cos(a); y += Math.sin(a); a += bend;
    }
  }
}
export function rock(L, cx, base, r, moss) {
  contact(L, cx, Math.round(base + r * .8), r * 1.4);
  const obj = ++OBJ;
  blob(L, cx, base, r, 'rock', obj, 1.4, .8, .15);
  if (moss) blob(L, cx - r * .4, base - r * .55, r * .45, 'moss', obj, 1.6, .5);
}
export function flowers(L, r, x0, x1, yAt, n, mat = 'flower') {
  for (let i = 0; i < n; i++) {
    const obj = ++OBJ; L.thin.add(obj); const part = ++PART, x = Math.round(x0 + r() * (x1 - x0)), y = yAt(x) + 3 + Math.floor(r() * 7);
    if (SEASON === 'autumn') {
      // fallen leaves lying flat in the grass
      const m = ['autO', 'autY', 'autR'][Math.floor(hash(i, 1, 41) * 3)];
      L.put(x, y, m, 4, part, obj); L.put(x + 1, y, m, 3, part, obj); if (hash(i, 2, 41) < .5) L.put(x + 1, y - 1, m, 5, part, obj);
      continue;
    }
    // spring wildflowers come in several colours, summer's are all pink
    const m = SEASON === 'spring' ? ['flower', 'fy', 'fw', 'fv', 'fb', 'fy'][Math.floor(hash(i, 1, 43) * 6)] : mat;
    L.put(x, y + 1, 'grass', 4, part, obj); L.put(x, y, m, 4, part, obj); L.put(x + 1, y, m, 2, part, obj); L.put(x, y - 1, m, 5, part, obj);
  }
}
// ox converts this layer's x to world x, so the ground's waves and tufts stay put when the screen width changes
export function ground(L, y0, amp, mat, seed, r, tufts = true, ox = 0) {
  const obj = ++OBJ; L.thin.add(obj); const part = ++PART;
  const top = (x) => Math.round(y0 + Math.sin((x + ox) * .035 + seed) * amp + Math.sin((x + ox) * .11 + seed * 2) * amp * .4);
  for (let x = 0; x < L.w; x++) {
    const t0 = top(x), wx = x + ox;
    for (let y = t0; y < L.h; y++) {
      const d = y - t0;
      let tone = d === 0 ? 5 : d < 3 ? 4 : hash(wx, y - t0, 3) < .14 ? 2 : 3;
      if (d > 10) tone = hash(wx, y - t0, 4) < .2 ? 1 : 2;
      L.put(x, y, mat, tone, part, obj);
    }
    // grass tufts along the top; in winter only the odd dry stalk pokes through the snow
    if (tufts && hash(wx, 17, seed) < (SEASON === 'winter' ? .07 : .25)) { const hgt = 1 + Math.floor(hash(wx, 18, seed) * 3), tm = SEASON === 'winter' ? 'straw' : mat; for (let k = 1; k <= hgt; k++) L.put(x, t0 - k, tm, k === hgt ? 5 : 4, part, obj); }
  }
  return top;
}
export function ridge(L, y0, amp, seed) {
  const obj = ++OBJ, part = ++PART; let prev = null;
  for (let x = 0; x < L.w; x++) {
    const u = (x - L.w / 2) / 320 * Math.PI * 2;
    const n = Math.sin(u * 1.3 + seed) * .5 + Math.sin(u * 3.1 + seed * 1.7) * .3 + Math.sin(u * 7 + seed * 2.3) * .12;
    const y = Math.round(y0 - (n * .5 + .5) * amp);
    for (let yy = y; yy < L.h; yy++) L.put(x, yy, 'mount', prev !== null && y <= prev && yy - y < 5 ? 4 : 3, part, obj);
    prev = y;
  }
}
export function treeline(L, base, r, hMin, hMax, gapMin, gapMax, mat = 'pine') {
  for (let x = -6; x < L.w + 6; x += gapMin + Math.floor(r() * (gapMax - gapMin))) pine(L, x, base + Math.floor(r() * 3), Math.round(hMin + r() * (hMax - hMin)), mat);
}
// meadow specks scattered across the field: tiny wildflowers or fallen leaves
export function meadow(L, r, n, cols, x1, y0, depth) {
  const obj = ++OBJ, part = ++PART;
  for (let i = 0; i < n; i++) {
    const x = Math.floor(r() * x1), y = y0 + Math.floor(Math.pow(r(), .8) * depth), m = cols[Math.floor(r() * cols.length)];
    L.put(x, y, m, 4, part, obj); if (y > 150 && r() < .5) L.put(x + 1, y, m, 3, part, obj);
  }
}
