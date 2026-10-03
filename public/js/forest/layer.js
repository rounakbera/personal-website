// Pixel layer buffers: each pixel records material, tone, part and object, so outlines and shading
// can be worked out after everything is drawn.
import { W, H } from './state.js';

export class Layer {
  constructor(atm, outline = true, w = W, h = H) {
    this.atm = atm; this.outline = outline; this.w = w; this.h = h;
    this.mat = new Array(w * h).fill(null);
    this.tone = new Uint8Array(w * h);
    this.part = new Int32Array(w * h).fill(-1);
    this.obj = new Int32Array(w * h).fill(-1);
    this.thin = new Set();
    this.under = new Set(); // underlayer parts that never cast the tier/clump shadow line
  }
  put(x, y, mat, tone, part, obj) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = y * this.w + x; this.mat[i] = mat; this.tone[i] = tone; this.part[i] = part; this.obj[i] = obj;
  }
  finalize() {
    const t = this.tone.slice();
    const W = this.w, H = this.h;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; if (this.mat[i] === null) continue;
      const o = this.obj[i];
      if (this.outline && !this.thin.has(o)) {
        let edge = false;
        for (const [a, b] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
          if (a < 0 || b < 0 || a >= W || b >= H) continue;
          const j = b * W + a; if (this.mat[j] === null || this.obj[j] < o) { edge = true; break; }
        }
        if (edge) { t[i] = 0; continue; }
      }
      if (y > 0) { const j = i - W; if (this.mat[j] !== null && this.obj[j] === o && this.part[j] !== this.part[i] && !this.under.has(this.part[j])) t[i] = Math.max(1, this.tone[i] - 2); }
    }
    this.tone = t;
    return this;
  }
}
// light value → tone index (1 deep shadow … 5 highlight)
export const toneOf = (l) => l > .8 ? 5 : l > .32 ? 4 : l > -.15 ? 3 : l > -.6 ? 2 : 1;
