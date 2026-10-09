// Pixel layer buffers: each pixel records material, tone, part and object, so outlines and shading
// can be worked out after everything is drawn.
import { W, H } from './state.js';

// materials are stored as small ids (0 = empty) so the buffers can be typed arrays; MAT[id] gives the name back
export const MAT = [null], MID = Object.create(null);
export const mid = (name) => MID[name] ?? (MAT.push(name), MID[name] = MAT.length - 1);
// the same for each layer's haze (distance to the horizon colour, 0–1): HAZE[id] gives it back, at float32
// precision (as the per-pixel Float32Array it replaced held it, so the graded colours stay the same)
export const HAZE = [], HID = new Map();
export const hid = (atm) => { const k = Math.round(atm * 1000); if (!HID.has(k)) { HAZE.push(Math.fround(atm)); HID.set(k, HAZE.length - 1); } return HID.get(k); };

export class Layer {
  constructor(atm, outline = true, w = W, h = H) {
    this.atm = atm; this.outline = outline; this.w = w; this.h = h;
    this.mat = new Uint8Array(w * h);
    this.tone = new Uint8Array(w * h);
    this.part = new Int32Array(w * h);   // only read where mat is set, so no fill needed
    this.obj = new Int32Array(w * h);
    this.thin = new Set();
    this.under = new Set(); // underlayer parts that never cast the tier/clump shadow line
    // columns worth drawing: the costly primitives skip anything wholly outside [x0, x1] (see buildWorld)
    this.x0 = -Infinity; this.x1 = Infinity;
    this.rec = null;      // set while memo() (scene.js) records a group for replay
  }
  // true when the columns xa..xb lie wholly outside the drawn range
  off(xa, xb) { return xb < this.x0 || xa > this.x1; }
  // the columns [a, b) worth sweeping: the drawn range plus a small margin, or all of them
  cols() { return [Math.max(0, Math.floor(this.x0) - 2), Math.min(this.w, Math.ceil(this.x1) + 3)]; }
  put(x, y, mat, tone, part, obj) {
    x = Math.round(x); y = Math.round(y);
    const m = MID[mat] ?? mid(mat);
    // while memo() (scene.js) records a group: the box it draws in, and whether any of it fell off the layer
    const r = this.rec;
    if (r) { if (x < r.x0) r.x0 = x; if (x > r.x1) r.x1 = x; if (y < r.y0) r.y0 = y; if (y > r.y1) r.y1 = y; }
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) { if (r) r.cut = true; return; }
    const i = y * this.w + x; this.mat[i] = m; this.tone[i] = tone; this.part[i] = part; this.obj[i] = obj;
  }
  // replay recorded puts (x, y, material id, tone, part, object; six numbers each), shifted by dx, dy
  replay(rec, dx, dy) {
    const { w, h, mat, tone, part, obj } = this;
    for (let k = 0; k < rec.length; k += 6) {
      const x = rec[k] + dx, y = rec[k + 1] + dy; if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const i = y * w + x; mat[i] = rec[k + 2]; tone[i] = rec[k + 3]; part[i] = rec[k + 4]; obj[i] = rec[k + 5];
    }
  }
  finalize() {
    const t = this.tone.slice(), { mat, obj, part, tone, thin, under } = this;
    const W = this.w, H = this.h, [xa, xb] = this.cols();
    for (let y = 0; y < H; y++) for (let x = xa; x < xb; x++) {
      const i = y * W + x; if (!mat[i]) continue;
      const o = obj[i];
      if (this.outline && !thin.has(o)) {
        // outline where a 4-neighbour is empty or belongs to an object drawn earlier
        if ((x > 0 && (!mat[i - 1] || obj[i - 1] < o)) || (x < W - 1 && (!mat[i + 1] || obj[i + 1] < o)) ||
            (y > 0 && (!mat[i - W] || obj[i - W] < o)) || (y < H - 1 && (!mat[i + W] || obj[i + W] < o))) { t[i] = 0; continue; }
      }
      if (y > 0) { const j = i - W; if (mat[j] && obj[j] === o && part[j] !== part[i] && !under.has(part[j])) t[i] = Math.max(1, tone[i] - 2); }
    }
    this.tone = t;
    return this;
  }
}
// light value → tone index (1 deep shadow … 5 highlight)
export const toneOf = (l) => l > .8 ? 5 : l > .32 ? 4 : l > -.15 ? 3 : l > -.6 ? 2 : 1;
