// Easter egg: the gear in the card's top right corner opens (and clicked again hides) a small panel to scrub the time of day,
// cycle the season, grow a new forest, or reset to the real time and season.
import { SEASON, SEASONS, seasonOf } from './state.js';

// api comes from main.js: { hoursNow, realHours, setTime(t | null), setSeason(s), reseed() }
export function initTimePanel(api) {
  // Jersey 10 digits baked to pixel paths: [advance, path]; each digit is centred in an 8 px cell so the clock never jitters
  const DIG = {"0":[7,"M1 0h4v1h-4zM0 1h6v1h-6zM0 2h2v1h-2zM4 2h2v1h-2zM0 3h2v1h-2zM4 3h2v1h-2zM0 4h2v1h-2zM4 4h2v1h-2zM0 5h2v1h-2zM4 5h2v1h-2zM0 6h2v1h-2zM4 6h2v1h-2zM0 7h2v1h-2zM4 7h2v1h-2zM0 8h6v1h-6zM1 9h4v1h-4z"],"1":[4,"M0 0h3v1h-3zM0 1h3v1h-3zM1 2h2v1h-2zM1 3h2v1h-2zM1 4h2v1h-2zM1 5h2v1h-2zM1 6h2v1h-2zM1 7h2v1h-2zM1 8h2v1h-2zM1 9h2v1h-2z"],"2":[8,"M1 0h5v1h-5zM0 1h7v1h-7zM0 2h2v1h-2zM5 2h2v1h-2zM4 3h3v1h-3zM3 4h3v1h-3zM2 5h3v1h-3zM1 6h3v1h-3zM0 7h3v1h-3zM0 8h7v1h-7zM0 9h7v1h-7z"],"3":[8,"M1 0h5v1h-5zM0 1h7v1h-7zM0 2h2v1h-2zM5 2h2v1h-2zM5 3h2v1h-2zM2 4h4v1h-4zM2 5h4v1h-4zM5 6h2v1h-2zM0 7h2v1h-2zM5 7h2v1h-2zM0 8h7v1h-7zM1 9h5v1h-5z"],"4":[7,"M4 0h2v1h-2zM3 1h3v1h-3zM2 2h4v1h-4zM1 3h2v1h-2zM4 3h2v1h-2zM0 4h2v1h-2zM4 4h2v1h-2zM0 5h2v1h-2zM4 5h2v1h-2zM0 6h6v1h-6zM0 7h6v1h-6zM4 8h2v1h-2zM4 9h2v1h-2z"],"5":[7,"M0 0h6v1h-6zM0 1h6v1h-6zM0 2h2v1h-2zM0 3h2v1h-2zM0 4h5v1h-5zM1 5h5v1h-5zM4 6h2v1h-2zM0 7h2v1h-2zM4 7h2v1h-2zM0 8h6v1h-6zM1 9h4v1h-4z"],"6":[8,"M1 0h5v1h-5zM0 1h7v1h-7zM0 2h2v1h-2zM5 2h2v1h-2zM0 3h2v1h-2zM0 4h6v1h-6zM0 5h7v1h-7zM0 6h2v1h-2zM5 6h2v1h-2zM0 7h2v1h-2zM5 7h2v1h-2zM0 8h7v1h-7zM1 9h5v1h-5z"],"7":[7,"M0 0h6v1h-6zM0 1h6v1h-6zM4 2h2v1h-2zM4 3h2v1h-2zM3 4h3v1h-3zM2 5h3v1h-3zM2 6h3v1h-3zM2 7h2v1h-2zM2 8h2v1h-2zM2 9h2v1h-2z"],"8":[8,"M1 0h5v1h-5zM0 1h7v1h-7zM0 2h2v1h-2zM5 2h2v1h-2zM0 3h2v1h-2zM5 3h2v1h-2zM1 4h5v1h-5zM0 5h7v1h-7zM0 6h2v1h-2zM5 6h2v1h-2zM0 7h2v1h-2zM5 7h2v1h-2zM0 8h7v1h-7zM1 9h5v1h-5z"],"9":[8,"M1 0h5v1h-5zM0 1h7v1h-7zM0 2h2v1h-2zM5 2h2v1h-2zM0 3h2v1h-2zM5 3h2v1h-2zM0 4h7v1h-7zM1 5h6v1h-6zM5 6h2v1h-2zM0 7h2v1h-2zM5 7h2v1h-2zM0 8h7v1h-7zM1 9h5v1h-5z"],":":[3,"M0 2h2v1h-2zM0 3h2v1h-2zM0 8h2v1h-2zM0 9h2v1h-2z"]}, DH = 10;
  const panel = document.getElementById('timepanel'), gear = document.getElementById('settings'), range = document.getElementById('tp-range'), clockSvg = document.getElementById('tp-clock');
  const pad = (n) => String(n).padStart(2, '0');
  function showClock(t) {
    const m = Math.round(t * 60) % 1440, txt = pad(Math.floor(m / 60)) + ':' + pad(m % 60);
    let x = 0, paths = '';
    for (const ch of txt) {
      const [adv, d] = DIG[ch], cell = ch === ':' ? 3 : 8, off = Math.floor((cell - adv) / 2);
      paths += `<path transform="translate(${x + off} 0)" d="${d}" fill="currentColor"/>`; x += cell + 1;
    }
    clockSvg.setAttribute('viewBox', `0 0 ${x - 1} ${DH}`); clockSvg.setAttribute('width', (x - 1) * 1.5);
    clockSvg.innerHTML = paths; clockSvg.setAttribute('aria-label', txt);
  }
  let overridden = false;
  function setTime(t) { overridden = true; api.setTime(t); showClock(t); }
  // the gear: 8 spiky teeth in three frames 15° apart (a tooth repeats every 45°); opening turns it a quarter clockwise
  // and hiding a quarter back, in six steps over the panel's 0.35 s slide
  const GEAR = ["M4 1h1v1h-1zM8 1h1v1h-1zM4 2h2v1h-2zM7 2h2v1h-2zM4 3h5v1h-5zM1 4h11v1h-11zM2 5h3v1h-3zM8 5h3v1h-3zM3 6h2v1h-2zM8 6h2v1h-2zM2 7h3v1h-3zM8 7h3v1h-3zM1 8h11v1h-11zM4 9h5v1h-5zM4 10h2v1h-2zM7 10h2v1h-2zM4 11h1v1h-1zM8 11h1v1h-1z", "M5 1h2v1h-2zM5 2h2v1h-2zM8 2h2v1h-2zM2 3h8v1h-8zM2 4h8v1h-8zM3 5h2v1h-2zM8 5h4v1h-4zM1 6h4v1h-4zM8 6h4v1h-4zM1 7h4v1h-4zM8 7h2v1h-2zM3 8h8v1h-8zM3 9h8v1h-8zM3 10h2v1h-2zM6 10h2v1h-2zM6 11h2v1h-2z", "M6 1h2v1h-2zM3 2h2v1h-2zM6 2h2v1h-2zM3 3h8v1h-8zM3 4h8v1h-8zM1 5h4v1h-4zM8 5h2v1h-2zM1 6h4v1h-4zM8 6h4v1h-4zM3 7h2v1h-2zM8 7h4v1h-4zM2 8h8v1h-8zM2 9h8v1h-8zM5 10h2v1h-2zM8 10h2v1h-2zM5 11h2v1h-2z"];
  const cog = gear.querySelector('.cog path');
  let turn = 0, spinning = 0;
  function spin(dir) { clearInterval(spinning); let k = 6; spinning = setInterval(() => { turn = (turn + dir + 3) % 3; cog.setAttribute('d', GEAR[turn]); if (--k === 0) clearInterval(spinning); }, 350 / 6); }
  // after hiding, the gear stays faded until the pointer leaves it (or it loses focus), so hovering doesn't light it straight back up;
  // a finger "leaves" the moment it lifts while touch hover sticks, so touch waits for blur instead
  const unfade = () => gear.classList.remove('fading');
  gear.addEventListener('pointerleave', (e) => { if (e.pointerType !== 'touch') unfade(); }); gear.addEventListener('blur', unfade);
  let closing = 0;
  function open() { clearTimeout(closing); unfade(); spin(1); gear.setAttribute('aria-expanded', 'true'); panel.classList.remove('closing'); panel.hidden = false; range.value = Math.round(api.hoursNow() * 60) % 1440; showClock(api.hoursNow()); }
  function close() { if (panel.hidden || panel.classList.contains('closing')) return; spin(-1); gear.classList.add('fading'); panel.classList.add('closing'); gear.setAttribute('aria-expanded', 'false'); closing = setTimeout(() => { panel.hidden = true; panel.classList.remove('closing'); }, 350); }
  // the gear on the card opens it, and another click hides it
  gear.addEventListener('click', () => (panel.hidden || panel.classList.contains('closing') ? open() : close()));
  range.addEventListener('input', () => setTime(range.value / 60));
  // season button: shows the current season's icon and steps to the next one
  const SICON = {"spring": "M2 0h2v1h-2zM5 0h2v1h-2zM1 1h7v1h-7zM1 2h2v1h-2zM6 2h2v1h-2zM2 3h1v1h-1zM6 3h1v1h-1zM1 4h2v1h-2zM6 4h2v1h-2zM1 5h7v1h-7zM2 6h2v1h-2zM5 6h2v1h-2zM4 7h1v1h-1zM3 8h2v1h-2z", "summer": "M4 0h1v1h-1zM1 1h1v1h-1zM7 1h1v1h-1zM3 2h3v1h-3zM2 3h5v1h-5zM0 4h1v1h-1zM2 4h5v1h-5zM8 4h1v1h-1zM2 5h5v1h-5zM3 6h3v1h-3zM1 7h1v1h-1zM7 7h1v1h-1zM4 8h1v1h-1z", "autumn": "M5 0h4v1h-4zM3 1h6v1h-6zM2 2h4v1h-4zM7 2h2v1h-2zM1 3h4v1h-4zM6 3h3v1h-3zM1 4h3v1h-3zM5 4h4v1h-4zM1 5h2v1h-2zM4 5h4v1h-4zM2 6h1v1h-1zM4 6h3v1h-3zM1 7h1v1h-1zM0 8h1v1h-1z", "winter": "M4 0h1v1h-1zM1 1h1v1h-1zM4 1h1v1h-1zM7 1h1v1h-1zM2 2h1v1h-1zM4 2h1v1h-1zM6 2h1v1h-1zM3 3h3v1h-3zM0 4h9v1h-9zM3 5h3v1h-3zM2 6h1v1h-1zM4 6h1v1h-1zM6 6h1v1h-1zM1 7h1v1h-1zM4 7h1v1h-1zM7 7h1v1h-1zM4 8h1v1h-1z"}, sBtn = document.getElementById('tp-season');
  const showSeason = () => { sBtn.querySelector('path').setAttribute('d', SICON[SEASON]); sBtn.setAttribute('aria-label', 'Season: ' + SEASON + ' (next: ' + SEASONS[(SEASONS.indexOf(SEASON) + 1) % 4] + ')'); sBtn.title = SEASON; };
  showSeason();
  // dice: a brand-new forest (new seed), same season and time
  document.getElementById('tp-reseed').addEventListener('click', () => api.reseed());
  sBtn.addEventListener('click', () => { api.setSeason(SEASONS[(SEASONS.indexOf(SEASON) + 1) % 4]); showSeason(); });
  document.getElementById('tp-reset').addEventListener('click', () => { if (SEASON !== seasonOf()) { api.setSeason(seasonOf()); showSeason(); } overridden = false; api.setTime(null); const t = api.realHours(); range.value = Math.round(t * 60); showClock(t); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) close(); });
  // keep the clock ticking while the panel shows real time
  setInterval(() => { if (!panel.hidden && !overridden) { const t = api.realHours(); range.value = Math.round(t * 60); showClock(t); } }, 15000);
}
