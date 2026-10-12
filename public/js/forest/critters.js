// Summer nights: a few fireflies glowing low over the foreground's ground and bushes.
// Laid out across the world strip like the stars (own random stream, so nothing else shifts), drawn every half second.
import { rng, clamp } from '../util.js';
import { WW, W, H, YO, SEASON } from './state.js';

const GLOW = [222, 255, 120];
// what a firefly may show against: the foreground's ground and what grows or lies on it, never a tree, the field or the sky
const LOW = new Set(['grass', 'shrub', 'shrub2', 'shrub3', 'moss', 'rock', 'flower', 'fy', 'fw', 'fr', 'fb']);

export function buildCritters(seed) {
  const r = rng(seed + 131);
  // each wanders a few pixels about its spot in the foreground, and glows on its own slow cycle
  return Array.from({ length: Math.round(12 * WW / 320) }, () => {
    const on = .5 * (3 + Math.floor(r() * 4)), gap = 4 + r() * 12;
    return { x: r() * WW, y: 150 + r() * 28, ax: 2 + r() * 4, ay: 1 + r() * 2, wx: .1 + r() * .2, wy: .12 + r() * .25, px: r() * 7, py: r() * 7,
      on, cycle: on + gap, phase: r() * (on + gap) };
  });
}
// blend(x, y, colour, alpha) paints one pixel of the frame; matAt(x, y) names the foreground's material there (undefined where there's none)
export function drawCritters(blend, matAt, flies, p, secs) {
  if (SEASON !== 'summer' || !flies) return;
  // they come out at dusk and stay until dawn
  const night = clamp((.5 - p.L) / .35, 0, 1); if (!night) return;
  const ts = Math.floor(secs * 2) / 2, ox = (WW >> 1) - (W >> 1), low = (x, y) => x >= 0 && y >= 0 && x < W && y < H && LOW.has(matAt(x, y));
  for (const f of flies) {
    const into = (ts + f.phase) % f.cycle; if (into >= f.on) continue;
    const x = Math.round(f.x + f.ax * Math.sin(ts * f.wx + f.px)) - ox, y = Math.round(YO + f.y + f.ay * Math.sin(ts * f.wy + f.py));
    if (!low(x, y)) continue;   // drifted in front of a tree: dark this beat
    const e = Math.sin(Math.PI * (into + .25) / f.on), a = night * (.35 + .65 * e);
    blend(x, y, GLOW, a);
    if (e > .6) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (low(x + dx, y + dy)) blend(x + dx, y + dy, GLOW, a * .45 * e);
  }
}
