// Shared, mutable view and season state. Other modules read these as live bindings;
// only the setters below change them.

// scene size in pixels, set from the screen; YO pushes the land down when the screen is taller than 16:9
export let W = 320, H = 180, YO = 0;
// the wide fixed strip the background world is laid out in (windowed to the screen width)
export const WW = 960, WH = 180;
// top of the card in scene pixels: on tall screens the sun and moon arc over it instead of the horizon
export let SKYB = 112;
export let PX = 5; // screen pixels per scene pixel
// true in the stacked (narrow-screen) card layout
export let STACK = false;
// first visible row: > 0 when the canvas reaches up behind a browser's status bar (Safari 26 on iPhone)
export let VT = 0;
// the view the load-in zoom settles on ({ W, H, YO, PX, SKYB, VT }; the current view once it has): the front and the
// sun and moon are laid out for it while zooming, so they aren't redrawn a little differently every frame
export let SV = { W, H, YO, PX, SKYB, VT };

/* ---------- seasons ---------- */
// one of four looks, picked by the date; the layout is the same in every season, only colours and details change
export const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
export const seasonOf = (d = new Date()) => SEASONS[Math.floor(((d.getMonth() + 10) % 12) / 3)]; // Mar–May spring … Dec–Feb winter
export let SEASON = 'summer';

// called by fit() whenever the screen size changes
export function setView(v) { ({ W, H, YO, PX, SKYB, STACK, VT, SV } = { W, H, YO, PX, SKYB, STACK, VT, SV, ...v }); }
export function setSeasonState(s) { SEASON = s; }
