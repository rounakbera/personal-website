// Rendering: the sky (with sun, moon and stars), time-of-day and seasonal grading of the land, and per-frame compositing.
import { rng, hash, lerp, mix, clamp, BAYER } from '../util.js';
import { W, H, YO, PX, SV, SKYB, STACK, VT, WW, WH, SEASON } from './state.js';
import { PAL, REMAP, palette } from './palette.js';
import { MAT } from './layer.js';

function grade(c, p, atm) {
  let n = mix(c, [18, 24, 58], .74);
  n = mix(n, c, .12);
  let o = mix(n, c, p.L);
  o = mix(o, [255, 150, 100], p.Wm * .2);
  return tint(mix(o, p.hor, atm * (.45 + .55 * p.L)));
}
// season-wide colour cast: winter muted and cool, autumn warm, spring a touch overcast
const grey = (c, k) => { const l = c[0] * .3 + c[1] * .59 + c[2] * .11; return mix(c, [l, l, l], k); };
const tint = (c) => SEASON === 'winter' ? mix(grey(c, .32), [150, 170, 200], .06) : SEASON === 'autumn' ? mix(c, [240, 160, 90], .07) : SEASON === 'spring' ? grey(c, .08) : c;
const skyTint = (c, v) => SEASON === 'winter' ? mix(grey(c, .5), [205, 212, 225], .14) : SEASON === 'spring' ? mix(grey(c, .42), [175, 180, 190], .1 + .12 * v) : SEASON === 'autumn' ? mix(c, [240, 170, 110], .14 * v * v) : c;
// the static parts of a frame for one time of day: sky (with sun, moon, stars) and the land layers on top
export function prepare(scene, t) {
  const p = palette(t), d = new Uint8ClampedArray(W * H * 4), Q = 14;
  for (let y = 0; y < H; y++) {
    const v = clamp(y / ((YO + 180) * .7), 0, 1), col = skyTint(v < .55 ? mix(p.top, p.mid, v / .55) : mix(p.mid, p.hor, (v - .55) / .45), v);
    for (let x = 0; x < W; x++) {
      const th = (BAYER[(y & 3) * 4 + (x & 3)] / 16 - .5) * Q, i = (y * W + x) * 4;
      for (let k = 0; k < 3; k++) d[i + k] = clamp(Math.round((col[k] + th) / Q) * Q, 0, 255);
      d[i + 3] = 255;
    }
  }
  const plot = (x, y, c, a = 1) => { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 4; d[i] = lerp(d[i], c[0], a); d[i + 1] = lerp(d[i + 1], c[1], a); d[i + 2] = lerp(d[i + 2], c[2], a); };
  const dsk = (cx, cy, r, c, a) => { for (let dy = -r; dy <= r; dy++) { const h = Math.floor(Math.sqrt(Math.max(0, r * r - dy * dy + r * .8))); for (let dx = -h; dx <= h; dx++) plot(cx + dx, cy + dy, c, a); } };
  // stars
  const sa = Math.pow(1 - p.L, 2);
  // sun / moon
  // sun and moon keep the same on-screen size (~35 px radius) whatever the pixel scale; f scales the moon's crescent and halo.
  // Their path and size are worked out for the settled view (SV) and shifted into this one (dx, dy), so during the
  // load-in zoom they grow and move with the scene rather than flicker between sizes
  // wide screens: they rise and set at the horizon behind the land (y0) and peak at ap. Tall screens and the stacked
  // layout, where the card would hide most of that path, blend (by tt) to a path over the card: in from beyond the
  // left edge just above the card top (SKYB), over it, and out past the right edge, so nothing pops in or out.
  // On short stacked screens the bodies shrink so they still fit above the card
  // (all heights are measured from VT, the first visible row, in case the canvas reaches up behind a status bar)
  const { W: sw, YO: syo, PX: spx, SKYB: skyb, VT: vt } = SV, dx = (sw >> 1) - (W >> 1), dy = syo - YO;
  const tt = STACK ? 1 : clamp(((syo + 180 - vt) / sw - .75) / .75, 0, 1), y0 = syo + 112, sb = skyb - vt;
  const R = Math.max(5, Math.min(Math.round(35 / spx), tt > 0 ? Math.floor((sb - 4) / 2) : 99)), f = R / 7;
  const ye = lerp(y0, skyb - R - 2, tt), ap = vt + Math.max(R + 2, lerp((y0 - vt) * .22, Math.min((y0 - vt) * .22, (ye - vt) * .4), tt));
  const xa = lerp(sw * .12, -3 * R, tt), xb = lerp(sw * .88, sw + 3 * R, tt);
  const arc = (q) => [Math.round(xa + (xb - xa) * q) - dx, Math.round(ye - Math.sin(Math.PI * clamp(q, 0, 1)) * (ye - ap)) - dy];
  const sp = (t - 6.5) / 12.5;
  if (sp > -.06 && sp < 1.06) { const [x, y] = arc(sp), low = 1 - Math.sin(Math.PI * clamp(sp, 0, 1)), c = mix([255, 244, 196], [255, 150, 80], Math.pow(low, 1.5)); dsk(x, y, R * 3, c, .12); dsk(x, y, R * 2, c, .2); dsk(x, y, R, c, 1); dsk(x - Math.round(2 * f), y - Math.round(2 * f), Math.round(2 * f), [255, 255, 240], .7); }
  const mp = ((t - 19 + 24) % 24) / 11.5;
  if (mp <= 1.06) {
    // crescent tilted ~40° counterclockwise: the shadow disc sits up-right of the moon, so the lit edge faces down-left
    const [x, y] = arc(mp), ang = 40 * Math.PI / 180, ox = Math.cos(ang), oy = -Math.sin(ang);
    const inR = (dx, dy, r) => dx * dx + dy * dy <= r * r + r * .8;
    // halo shaped like the crescent: bigger copies of the moon and its shadow disc, each fainter
    for (const [gr0, k0, a] of [[16, 9, .05], [12, 6.5, .08], [9.5, 5, .12]]) {
      const gr = Math.round(gr0 * f), k = k0 * f;
      for (let dy = -gr; dy <= gr; dy++) for (let dx = -gr; dx <= gr; dx++)
        if (inR(dx, dy, gr) && !inR(dx - ox * k, dy - oy * k, gr)) plot(x + dx, y + dy, [236, 234, 219], a);
    }
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      if (!inR(dx, dy, R)) continue;
      if (inR(dx - ox * 4.2 * f, dy - oy * 4.2 * f, R)) { plot(x + dx, y + dy, [150, 160, 200], .12); continue; }
      const rim = !inR(dx - ox * (4.2 * f + 1), dy - oy * (4.2 * f + 1), R);
      plot(x + dx, y + dy, rim ? [248, 246, 232] : [222, 220, 204], 1);
    }
  }
  // layers go into their own buffer so clouds can move between sky and land
  const sky = d, fg = new Uint8ClampedArray(W * H * 4), cache = new Map();
  const { world, front } = scene, ox = (WW >> 1) - (W >> 1);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x; let m = front.mat[i], tn, at;
    if (m) { tn = front.tone[i]; at = front.atm[i]; }
    else {
      const wy = y - YO, wx = x + ox; if (wy < 0 || wy >= WH || wx < 0 || wx >= WW) continue;
      const j = wy * WW + wx; m = world.mat[j]; if (!m) continue; tn = world.tone[j]; at = world.atm[j];
    }
    // graded colours are cached per material id, tone and haze (a numeric key: no string building per pixel)
    const key = (Math.round(at * 1000) * 256 + m) * 8 + tn;
    let c = cache.get(key); if (!c) { const n = REMAP[SEASON][MAT[m]] || MAT[m]; c = grade(PAL[n][tn], p, at); cache.set(key, c); }
    fg[i * 4] = c[0]; fg[i * 4 + 1] = c[1]; fg[i * 4 + 2] = c[2]; fg[i * 4 + 3] = 255;
  }
  let base = mix([70, 74, 120], [240, 244, 250], p.L), shade = mix([46, 48, 90], mix(p.mid, [255, 255, 255], .32), p.L);
  base = mix(base, [255, 196, 150], p.Wm * .6); shade = mix(shade, [200, 100, 120], p.Wm * .5);
  // spring clouds are fuller and greyer, winter's a flat pale grey
  if (SEASON === 'spring') { base = mix(base, [150, 156, 170], .35 * p.L); shade = mix(shade, [96, 102, 120], .45 * p.L); }
  if (SEASON === 'winter') { base = grey(base, .4); shade = grey(shade, .4); }
  const hi = mix(base, [255, 255, 255], .15 + .5 * p.L), wisp = mix(mix(hi, p.top, .15), [255, 170, 150], p.Wm * .7);
  return { sky, fg, p, sa, COL: [null, base, shade, hi, wisp, wisp] };
}
const ALPHA = [0, 1, 1, 1, .6, .32];
// each star twinkles on its own cycle: a slow 1.5–2.5 s swell and fade, then a quiet gap of 8–80 s (skewed long)
let STARS = [], MAX_LIT = 0;
// stars across the world strip, up to 420 px above the horizon; each twinkles on its own slow cycle
export function makeStars() {
  const r = rng(5);
  STARS = Array.from({ length: Math.round(260 * WW * 420 / (320 * 108)) }, (_, i) => {
    const gap = 8 + Math.round(72 * Math.pow(hash(i, 1, 51), .6)), on = .5 * (3 + Math.floor(hash(i, 2, 51) * 3));
    return { x: r() * WW | 0, d: r() * 420 | 0, b: .3 + r() * .7, on, cycle: gap + on, phase: hash(i, 3, 51) * (gap + on) };
  });
}
export function draw(canvas, scene, prep, secs) {
  const g = canvas.getContext('2d'), img = g.createImageData(W, H), d = img.data, { p, COL, fg, sa } = prep;
  d.set(prep.sky);
  const blend = (x, y, c, a) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 4; d[i] = lerp(d[i], c[0], a); d[i + 1] = lerp(d[i + 1], c[1], a); d[i + 2] = lerp(d[i + 2], c[2], a); };
  // stars: flare on their own cycles, capped so no more than 5% are lit at once
  const ox = (WW >> 1) - (W >> 1);
  if (sa > .02) {
    const ts = Math.floor(secs * 2) / 2, star = [255, 248, 224];
    let lit = 0;
    STARS.forEach((s0) => {
      const s = { ...s0, x: s0.x - ox, y: YO + 108 - s0.d }; if (s.x < 0 || s.x >= W || s.y < 0) return;
      const into = (ts + s.phase) % s.cycle;
      if (lit < MAX_LIT && into < s.on) {
        // brightness rises then falls across the twinkle (half-second frames: e.g. dim, bright, dim)
        lit++; const e = Math.sin(Math.PI * (into + .25) / s.on), a = lerp(sa * s.b, Math.min(1, sa * 1.1 + .15), e);
        blend(s.x, s.y, star, a);
        if (e > .7) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) blend(s.x + dx, s.y + dy, star, a * .45 * e);
      } else blend(s.x, s.y, star, sa * s.b);
    });
  }
  for (const c of scene.clouds || []) {
    // wrap around the world strip, then window it; y sits at a fixed height above the land
    const span = WW + c.w + 20, cx = ((c.x + c.w + 10 + Math.floor(secs / c.step)) % span + span) % span - c.w - 10;
    const cxs = Math.round(cx) - ox, oy = c.y + YO + c.oy;
    for (let y = 0; y < c.h; y++) {
      const yy = oy + y; if (yy < 0 || yy >= H) continue;
      for (let x = 0; x < c.w; x++) {
        const tn = c.t[y * c.w + x], xx = cxs + x; if (!tn || xx < 0 || xx >= W) continue;
        const a = c.a * ALPHA[tn] * (tn > 3 ? .6 + .4 * p.L + .3 * p.Wm : 1), col = COL[tn], i = (yy * W + xx) * 4;
        d[i] = lerp(d[i], col[0], a); d[i + 1] = lerp(d[i + 1], col[1], a); d[i + 2] = lerp(d[i + 2], col[2], a);
      }
    }
  }
  for (let i = 3; i < fg.length; i += 4) if (fg[i]) { d[i - 3] = fg[i - 3]; d[i - 2] = fg[i - 2]; d[i - 1] = fg[i - 1]; }
  g.putImageData(img, 0, 0);
}
// at most ~5% of the stars on screen may twinkle at once; recomputed when the screen size changes
export function fitStars() {
  const ox = (WW >> 1) - (W >> 1);
  MAX_LIT = Math.max(1, Math.round(STARS.filter(s => s.x - ox >= 0 && s.x - ox < W && YO + 108 - s.d >= 0).length * .05));
}
