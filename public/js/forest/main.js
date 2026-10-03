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
const scene = { world: flatten(buildWorld(seed), WW, WH), front: null, clouds: buildClouds(seed) };
makeStars();
let prep = null, minute = -1;

// size the scene to the screen; only the front is rebuilt when the size changes, so this can run on every resize frame
function fit() {
  const vw = innerWidth, vh = innerHeight;
  // continuous pixel size: the scene is 180 px tall on wide screens and 200 px wide on tall ones, and the
  // two meet at the same value, so resizing zooms smoothly with no jumps (min() picks whichever fits)
  let S = Math.max(1, Math.min(vh / 180, vw / 200));
  // stacked layout (narrow screens): zoom in so the land fills about the lower half and the framing trees
  // reach up to the middle of the screen; the scene gets narrower (at least 110 px) to make room
  if (stacked.matches) S = Math.max(S, Math.min(vh / 250, vw / 110));
  const w = Math.round(vw / S), h = Math.max(180, Math.round(vh / S));
  if (scene.front && w === W && h === H) return false;
  const yo = h - 180;
  // SKYB: the card's top edge (layout position, ignoring the drop-in animation), so the sun and moon arc above it
  setView({ W: w, H: h, YO: yo, PX: S, STACK: stacked.matches, SKYB: Math.max(14, Math.min(yo + 112, Math.floor(document.querySelector('.card-wrap').offsetTop / S) - 6)) });
  canvas.width = w; canvas.height = h;
  scene.front = flatten(buildFront(seed, plan), W, H);
  fitStars();
  minute = -1;
  return true;
}
function frame() {
  const t = hoursNow(), mk = Math.floor(t * 60);
  if (mk !== minute) { minute = mk; prep = prepare(scene, t); }   // sky, sun and moon move once a minute
  draw(canvas, scene, prep, secs());                              // clouds and stars on their own half-second beats
}
// rebuild everything for the current seed and season (the same seed gives the same layout in every season)
function rebuild() {
  scene.world = flatten(buildWorld(seed), WW, WH); scene.clouds = buildClouds(seed); scene.front = null;
  fit(); minute = -1; frame();
}

fit();
frame();
// redraw on every animation frame while the window is being resized
let queued = false;
addEventListener('resize', () => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; if (fit()) frame(); }); });
// the sky's motion is a pixel every few seconds, gentle enough to keep even with reduced motion on
// (the card's drop-in still respects it)
setInterval(() => { if (!document.hidden) frame(); }, 500);
document.addEventListener('visibilitychange', () => { if (!document.hidden) frame(); });

initTimePanel({
  hoursNow, realHours,
  setTime(t) { override = t; minute = -1; frame(); },
  setSeason(s) { setSeasonState(s); rebuild(); },
  reseed() { seed = randomSeed(); plan = planFor(seed); rebuild(); }
});
