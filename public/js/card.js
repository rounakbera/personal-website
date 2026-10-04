// The parchment card: the copy-email button, paper grain, and the portrait's pixelation effect.
import { rng, lerp } from './util.js';

const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

/* link icons are baked into index.html as pixel SVGs (GitHub and LinkedIn reduced from their brand marks,
   a scroll for the résumé, a winged envelope for email), so they show even without JS */

/* ---------- email: never written out in the page; built from the name and copied on click ---------- */
{
  const a = document.querySelector('[data-copy-email]'), hint = a.querySelector('[data-state="hint"]'), done = a.querySelector('[data-state="copied"]');
  let t = 0;
  a.addEventListener('click', async (e) => {
    e.preventDefault();
    const addr = document.querySelector('h1 .sr').textContent.toLowerCase().replace(/[^a-z]/g, '') + '@' + 'gmail.com';
    try { await navigator.clipboard.writeText(addr); }
    catch { const ta = document.createElement('textarea'); ta.value = addr; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.append(ta); ta.select(); try { document.execCommand('copy'); } catch {} ta.remove(); }
    hint.hidden = true; done.hidden = false; a.classList.add('copied');
    clearTimeout(t); t = setTimeout(reset, 1500);
  });
  // "copied!" goes away as soon as the pointer leaves the button (e.g. onto another link)
  function reset() { clearTimeout(t); hint.hidden = false; done.hidden = true; a.classList.remove('copied'); }
  a.parentElement.addEventListener('pointerleave', reset);
}

/* ---------- parchment grain ---------- */
{
  const c = mk(48, 48), g = c.getContext('2d'), r = rng(3);
  g.fillStyle = '#ecd7a6'; g.fillRect(0, 0, 48, 48);
  for (let i = 0; i < 280; i++) { const v = r(); g.fillStyle = v < .5 ? '#e3ca94' : v < .86 ? '#f3e3bb' : '#d6b77e'; g.fillRect(r() * 48 | 0, r() * 48 | 0, r() < .2 ? 2 : 1, 1); }
  for (let i = 0; i < 7; i++) { g.fillStyle = 'rgba(169,122,69,.28)'; g.fillRect(r() * 48 | 0, r() * 48 | 0, 3 + (r() * 5 | 0), 1); }
  document.querySelector('.card').style.setProperty('--grain', `url(${c.toDataURL()})`);
}

/* ---------- portrait: pixel art that resolves into the photo on hover or click ---------- */
{
  const cv = document.getElementById('avatar'), g = cv.getContext('2d'), N = cv.width;
  const art = new Image(), photo = new Image(), tmp = document.createElement('canvas'), tg = tmp.getContext('2d');
  art.src = 'assets/portrait-pixel.png'; photo.src = 'assets/portrait.jpg';
  // one continuous progress value p (0 = pixel art, 1 = photo) eased over ~0.45 s.
  // The block size shrinks linearly (6 → 1 canvas px), so the image visibly de-pixelates the whole way
  // instead of jumping sharp at the start; the art fades out over the first 40%, the smooth photo fades in at the end,
  // and the name steps Jersey 10 → 15 → 20 → 25 alongside it
  const names = [...document.querySelectorAll('h1 .name')], DUR = 450;
  let p = 0, target = 0, raf = 0, last = 0, loaded = false, pinned = null, hovering = false;
  const ease = (x) => x * x * (3 - 2 * x);
  function paint() {
    // the name swaps crisply at even points along the way (blending two pixel grids just looks muddy)
    const e = ease(p), step = Math.min(3, Math.floor(e * 4));
    names.forEach((n, k) => { n.style.opacity = k === step ? 1 : 0; });
    g.imageSmoothingEnabled = false; g.globalAlpha = 1;
    cv.parentElement.classList.toggle('art', loaded && e <= 0);   // the shimmer crosses the image only while it's pure pixel art
    if (!loaded) return;
    if (e <= 0) { g.drawImage(art, 0, 0, N, N); return; }
    const b = Math.round(N / lerp(N / 48, 1, e));
    if (b >= N) { g.imageSmoothingEnabled = true; g.drawImage(photo, 0, 0, N, N); }
    else { tmp.width = tmp.height = b; tg.imageSmoothingEnabled = true; tg.drawImage(photo, 0, 0, b, b); g.drawImage(tmp, 0, 0, N, N); }
    if (e < .4) { g.globalAlpha = 1 - e / .4; g.drawImage(art, 0, 0, N, N); }
    if (e > .85) { g.imageSmoothingEnabled = true; g.globalAlpha = (e - .85) / .15; g.drawImage(photo, 0, 0, N, N); }
    g.globalAlpha = 1;
  }
  function tick(now) {
    const dt = now - last; last = now;
    p = clamp01(p + Math.sign(target - p) * dt / DUR);
    if ((target === 1 && p >= 1) || (target === 0 && p <= 0)) { p = target; paint(); raf = 0; return; }
    paint(); raf = requestAnimationFrame(tick);
  }
  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  function go(t) {
    target = t ? 1 : 0;
    // no reduced-motion shortcut: this is an in-place fade, not movement
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
  }
  // the page loads showing the photo and the smoothest name (the no-JS look); once both images are in, the canvas
  // takes over at p = 1 and, a beat later, pixelates into the art while the name steps back to Jersey 10
  Promise.all([art.decode(), photo.decode()]).then(() => {
    loaded = true; p = target = 1; paint();
    setTimeout(() => { if (pinned === null && !hovering) go(0); }, 650);
  }, () => {});   // if an image fails, the plain photo and name simply stay
  // hovering the portrait or the name resolves both (mouse); a click or tap toggles it and keeps it that way
  // after the pointer leaves, until the next click
  // a single click toggles the pixelation; a double click (or double tap) opens the time panel instead
  // (timepanel.js listens for 'card:dblclick'), so a click waits a moment to see whether a second one follows
  const DBL = 300; let pend = 0, lastClick = -1e9;
  function onClick() {
    const now = performance.now();
    if (now - lastClick < DBL) { clearTimeout(pend); lastClick = -1e9; document.dispatchEvent(new CustomEvent('card:dblclick')); return; }
    lastClick = now;
    pend = setTimeout(() => { if (!loaded) return; pinned = target ? 0 : 1; go(pinned); }, DBL);
  }
  for (const el of [cv.parentElement, document.querySelector('h1')]) {
    el.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'mouse') return; hovering = true; if (pinned === null) go(1); });
    el.addEventListener('pointerleave', (e) => { if (e.pointerType !== 'mouse') return; hovering = false; go(pinned ?? 0); if (pinned === 0) pinned = null; });
    el.addEventListener('click', onClick);
  }
}
