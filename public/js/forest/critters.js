// Summer's small lives: butterflies over the foreground by day, fireflies glowing over the field and the ground at night.
// Laid out across the world strip like the stars (own random stream, so nothing else shifts), drawn every half second.
import { rng, hash, clamp } from '../util.js';
import { WW, W, H, YO, SEASON } from './state.js';

// wing colours (light, shade) and the body: cabbage white, sulphur yellow, orange
export const WINGS = [[[246, 244, 234], [196, 200, 190]], [[252, 224, 84], [208, 166, 40]], [[246, 146, 44], [178, 80, 26]]];
export const BODY = [52, 40, 34];
const GLOW = [222, 255, 120];

export function buildCritters(seed) {
  const r = rng(seed + 131);
  // fireflies: mostly low and near, each wandering a few pixels about its spot and glowing on its own slow cycle
  const flies = Array.from({ length: Math.round(70 * WW / 320) }, () => {
    const on = .5 * (3 + Math.floor(r() * 4)), gap = 2 + r() * 10;
    return { x: r() * WW, y: 116 + Math.pow(r(), .55) * 62, ax: 2 + r() * 4, ay: 1 + r() * 2.5, wx: .1 + r() * .2, wy: .12 + r() * .25, px: r() * 7, py: r() * 7,
      on, cycle: on + gap, phase: r() * (on + gap) };
  });
  // butterflies: a few over the ground cover, drifting about their spot and bobbing as they flap
  const bflies = Array.from({ length: Math.round(5 * WW / 320) }, () => ({
    x: r() * WW, y: 152 + r() * 22, ax: 8 + r() * 12, ay: 2 + r() * 4, wx: .06 + r() * .1, wy: .2 + r() * .3, px: r() * 7, py: r() * 7,
    c: Math.floor(r() * WINGS.length), day: .62 + r() * .2
  }));
  return { flies, bflies };
}
// blend(x, y, colour, alpha) paints one pixel of the frame; wings: graded WINGS and BODY for this time of day ([wings, body])
export function drawCritters(blend, cr, p, secs, wings) {
  if (SEASON !== 'summer' || !cr) return;
  const ts = Math.floor(secs * 2) / 2, ox = (WW >> 1) - (W >> 1);
  const spot = (o, ts) => [Math.round(o.x + o.ax * Math.sin(ts * o.wx + o.px)) - ox, Math.round(YO + o.y + o.ay * Math.sin(ts * o.wy + o.py))];
  // fireflies come out at dusk and stay until dawn
  const night = clamp((.5 - p.L) / .35, 0, 1);
  if (night > 0) cr.flies.forEach((f, i) => {
    const into = (ts + f.phase) % f.cycle; if (into >= f.on) return;
    const [x, y] = spot(f, ts); if (x < -1 || x > W || y >= H) return;
    const e = Math.sin(Math.PI * (into + .25) / f.on), a = night * (.35 + .65 * e);
    blend(x, y, GLOW, a);
    if (e > .6) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) blend(x + dx, y + dy, GLOW, a * .45 * e);
  });
  // butterflies by day, each leaving at its own point of the evening (and coming back at its own in the morning)
  cr.bflies.forEach((b, i) => {
    if (p.L < b.day) return;
    const open = hash(i, ts * 2, 71) < .6, [x, y0] = spot(b, ts), y = y0 - (open ? 1 : 0);
    if (x < -2 || x > W + 1 || y >= H) return;
    const [lt, sh] = wings[0][b.c], body = wings[1];
    // open: a bow of big fore wings over smaller hind wings, either side of a thin body; closed: the wings folded up together
    const px = (pts, c) => { for (let k = 0; k < pts.length; k += 2) blend(x + pts[k], y + pts[k + 1], c, 1); };
    if (open) { px([-2, -2, -1, -2, 1, -2, 2, -2, -2, -1, -1, -1, 1, -1, 2, -1], lt); px([-1, 0, 1, 0, -1, 1, 1, 1], sh); px([0, -1, 0, 0], body); }
    else { px([0, -3, 1, -3, 0, -2], lt); px([1, -2, 0, -1], sh); px([0, 0, 1, -1], body); }
  });
}
