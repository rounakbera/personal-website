// Entry point for the background: picks the forest and season, sizes the scene to the screen,
// and runs the redraw loop. Loaded from index.html as a module.
import { W, H, WW, WH, setView, setSeasonState, seasonOf } from './state.js';
import { buildClouds } from './clouds.js';
import { planFor, buildWorld, buildFront, flatten } from './scene.js';
import { prepare, draw, makeStars, fitStars } from './render.js';
import { initTimePanel } from './timepanel.js';

const canvas = document.getElementById('world');
const stacked = matchMedia('(max-width: 660px)');

// a new forest every visit; #seed-104 pins a forest, #winter (or #seed-104-winter) pins a season,
// otherwise the season follows the calendar
const mh = /seed-(\d{1,6})/.exec(location.hash), ms = /spring|summer|autumn|winter/.exec(location.hash);
let seed = mh ? +mh[1] : randomSeed();
setSeasonState(ms ? ms[0] : seasonOf());
function randomSeed() { return 1 + Math.floor(Math.random() * 99999); }

// the sky follows the visitor's clock unless the time panel overrides it
let override = null;
const realHours = () => { const d = new Date(); return d.getHours() + d.getMinutes() / 60; };
const hoursNow = () => override ?? realHours();
const t0 = performance.now(), secs = () => (performance.now() - t0) / 1000;

let plan = planFor(seed);
// first frame fast: build only the middle of the world strip that this screen shows (plus a margin), then the
// whole strip when the page is idle, before a resize or a wider screen could need it (see ensureWorld)
const scene = { world: null, front: null, clouds: buildClouds(seed), full: false, clip: null };
let fullTimer = 0;
function buildWorldFor(vw, vh) {
  const half = (Math.round(vw / baseScale(vw, vh)) >> 1) + 10;
  scene.clip = [(WW >> 1) - half, (WW >> 1) + half]; scene.full = false;
  scene.world = flatten(buildWorld(seed, scene.clip), WW, WH);
  clearTimeout(fullTimer);
  // after the load-in zoom has settled, so the extra work doesn't stutter it
  fullTimer = setTimeout(() => (window.requestIdleCallback || setTimeout)(ensureWorld), 2200);
}
function ensureWorld(redraw = true) {
  if (scene.full) return;
  scene.world = flatten(buildWorld(seed), WW, WH); scene.full = true; scene.clip = null;
  if (redraw) { minute = -1; frame(); }
}
makeStars();
let prep = null, minute = -1;

// size the scene to the screen; only the front is rebuilt when the size changes, so this can run on every resize frame.
//
// Browser toolbars. Elsewhere the canvas is fixed and 100lvh tall, so a toolbar drawn over the page shows forest;
// the scene is fitted to the visible area (100svh, toolbars shown) and the rows below are just more ground.
// Safari 26 on iPhone, though, draws page pixels behind its status bar and toolbar only when the page is scrolled,
// and never draws fixed elements there. So in that browser (html.bleed) the page is made a little taller and
// parked at a small scroll offset (OFF) that the visitor can't change, and the canvas sits in the page's flow,
// reaching TB px above the visible top and BB px below the visible bottom: sky behind the status bar, ground
// behind the toolbar. The land still ends at the visible bottom, so the flowers and bushes stay above the bar.
const BLEED = CSS.supports('-webkit-touch-callout: none') && CSS.supports('font: -apple-system-body') && !navigator.standalone;
const TB = 80, BB = 160, OFF = TB;
const stage = document.querySelector('.stage');
const probe = (hgt) => { const d = document.createElement('div'); d.style.cssText = `position:fixed;top:0;left:0;width:0;height:${hgt};visibility:hidden;pointer-events:none`; document.body.append(d); return d; };
const svh = probe('100svh'), lvh = probe('100lvh');
if (BLEED) {
  document.documentElement.classList.add('bleed');
  document.documentElement.style.setProperty('--off', `${OFF}px`);
  history.scrollRestoration = 'manual';
  const park = () => { if (scrollY !== OFF) scrollTo({ top: OFF, left: 0, behavior: 'instant' }); };
  park(); addEventListener('load', park); addEventListener('pageshow', park); addEventListener('scroll', park, { passive: true });
  // no scrolling by touch (the time slider still drags) or by wheel
  document.addEventListener('touchmove', (e) => { if (!e.target.closest?.('input[type=range]')) e.preventDefault(); }, { passive: false });
  addEventListener('wheel', (e) => e.preventDefault(), { passive: false });
}
// continuous pixel size: the scene is 180 px tall on wide screens and 200 px wide on tall ones, and the
// two meet at the same value, so resizing zooms smoothly with no jumps (min() picks whichever fits).
// Stacked layout (narrow screens): zoom in so the land fills about the lower half and the framing trees
// reach up to the middle of the screen; the scene gets narrower (at least 110 px) to make room
function baseScale(vw, vh) {
  const S = Math.max(1, Math.min(vh / 180, vw / 200));
  return stacked.matches ? Math.max(S, Math.min(vh / 250, vw / 110)) : S;
}
// the scene's size and rows for pixel scale S: width, height, first visible row (top), land offset (yo), card top (skyb)
function view(S, vw, vh, full) {
  const top = BLEED ? Math.ceil(TB / S) : 0, below = BLEED ? Math.ceil(BB / S) : Math.max(0, Math.round((full - vh) / S));
  const w = Math.round(vw / S), hv = Math.max(180, Math.round(vh / S)), yo = top + hv - 180;
  // skyb: the card's top edge (layout position, ignoring the drop-in animation), so the sun and moon arc above it
  const skyb = Math.max(top + 14, Math.min(yo + 112, top + Math.floor(document.querySelector('.card-wrap').offsetTop / S) - 6));
  return { W: w, H: top + hv + below, YO: yo, PX: S, SKYB: skyb, VT: top };
}
function fit() {
  const vw = innerWidth;
  const vh = BLEED ? stage.clientHeight : Math.min(innerHeight, svh.offsetHeight || innerHeight);
  const full = BLEED ? vh : Math.max(vh, innerHeight, lvh.offsetHeight || 0);
  const S0 = baseScale(vw, vh), v = view(S0 * zoom, vw, vh, full), { W: w, H: h, PX: S, VT: top } = v;   // zoom > 1 only during the load-in
  if (scene.front && w === W && h === H) return false;
  // first fit: build the visible middle of the world; later, a window wider than that (a resize before the idle
  // build) gets the whole strip at once
  if (!scene.world) buildWorldFor(vw, vh);
  else if (scene.clip && (WW >> 1) - (w >> 1) < scene.clip[0] + 2) ensureWorld(false);
  setView({ ...v, STACK: stacked.matches, SV: zoom > 1 ? view(S0, vw, vh, full) : v });
  canvas.width = w; canvas.height = h;
  if (BLEED) { canvas.style.top = `${OFF - top * S}px`; canvas.style.height = `${h * S}px`; }
  scene.front = flatten(buildFront(seed, plan), W, H);
  fitStars();
  minute = -1;
  return true;
}
function frame() {
  const t = hoursNow(), mk = Math.floor(t * 60), fresh = mk !== minute;
  if (fresh) { minute = mk; prep = prepare(scene, t); }   // sky, sun and moon move once a minute
  draw(canvas, scene, prep, secs());                      // clouds and stars on their own half-second beats
}
// rebuild everything for the current seed and season (the same seed gives the same layout in every season)
function rebuild() {
  scene.world = null; scene.clouds = buildClouds(seed); scene.front = null;
  fit(); minute = -1; frame();
}

// load-in: the forest starts zoomed in ~1.8× on its bottom middle and eases out to its real size, in step with
// the card's drop-in. The front is rebuilt for each size on the way (the same path a window resize takes), so the
// scene resolves smoothly rather than as a scaled picture. Plays even with reduced motion on (owner's choice)
let zoom = 1.8;
const Z0 = zoom, ZDUR = 1600, zStart = performance.now();
fit();
frame();
if (zoom > 1) requestAnimationFrame(function zstep(now) {
  const q = Math.min(1, (now - zStart) / ZDUR), e = 1 - Math.pow(1 - q, 3);
  zoom = 1 + (Z0 - 1) * (1 - e);
  if (fit()) frame();
  if (q < 1) requestAnimationFrame(zstep);
});
// redraw on every animation frame while the window is being resized
let queued = false;
addEventListener('resize', () => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; if (fit()) frame(); }); });
// the sky's motion is a pixel every few seconds, gentle enough to keep even with reduced motion on
setInterval(() => { if (!document.hidden) frame(); }, 500);
document.addEventListener('visibilitychange', () => { if (!document.hidden) frame(); });

initTimePanel({
  hoursNow, realHours,
  setTime(t) { override = t; minute = -1; frame(); },
  setSeason(s) { setSeasonState(s); rebuild(); document.querySelectorAll('[data-season-icon]').forEach((l) => { l.href = `assets/icons/${s}-${l.dataset.seasonIcon}.png`; }); },
  reseed() { seed = randomSeed(); plan = planFor(seed); rebuild(); }
});
