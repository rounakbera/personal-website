// Easter egg: the gear in the card's top right corner opens (and clicked again hides) a small panel to scrub the time of day,
// cycle the season, grow a new forest, or reset to the real time and season.
import { SEASON, SEASONS, seasonOf } from './state.js';

// api comes from main.js: { hoursNow, realHours, setTime(t | null), setSeason(s), reseed() }
export function initTimePanel(api) {
  // Jersey 10 digits baked to pixel paths: [advance, path]; each digit is centred in an 8 px cell so the clock never jitters
  const DIG = {"0":[7,"M1 0h4v1H1zM0 1h6v1H0zM0 2h2v6H0zM4 2h2v6H4zM0 8h6v1H0zM1 9h4v1H1z"],"1":[4,"M0 0h3v2H0zM1 2h2v8H1z"],"2":[8,"M1 0h5v1H1zM0 1h7v1H0zM0 2h2v1H0zM5 2h2v1H5zM4 3h3v1H4zM3 4h3v1H3zM2 5h3v1H2zM1 6h3v1H1zM0 7h3v1H0zM0 8h7v2H0z"],"3":[8,"M1 0h5v1H1zM0 1h7v1H0zM0 2h2v1H0zM5 2h2v2H5zM2 4h4v2H2zM5 6h2v2H5zM0 7h2v1H0zM0 8h7v1H0zM1 9h5v1H1z"],"4":[7,"M4 0h2v1H4zM3 1h3v1H3zM2 2h4v1H2zM1 3h2v1H1zM4 3h2v3H4zM0 4h2v2H0zM0 6h6v2H0zM4 8h2v2H4z"],"5":[7,"M0 0h6v2H0zM0 2h2v2H0zM0 4h5v1H0zM1 5h5v1H1zM4 6h2v2H4zM0 7h2v1H0zM0 8h6v1H0zM1 9h4v1H1z"],"6":[8,"M1 0h5v1H1zM0 1h7v1H0zM0 2h2v2H0zM5 2h2v1H5zM0 4h6v1H0zM0 5h7v1H0zM0 6h2v2H0zM5 6h2v2H5zM0 8h7v1H0zM1 9h5v1H1z"],"7":[7,"M0 0h6v2H0zM4 2h2v2H4zM3 4h3v1H3zM2 5h3v2H2zM2 7h2v3H2z"],"8":[8,"M1 0h5v1H1zM0 1h7v1H0zM0 2h2v2H0zM5 2h2v2H5zM1 4h5v1H1zM0 5h7v1H0zM0 6h2v2H0zM5 6h2v2H5zM0 8h7v1H0zM1 9h5v1H1z"],"9":[8,"M1 0h5v1H1zM0 1h7v1H0zM0 2h2v2H0zM5 2h2v2H5zM0 4h7v1H0zM1 5h6v1H1zM5 6h2v2H5zM0 7h2v1H0zM0 8h7v1H0zM1 9h5v1H1z"],":":[3,"M0 2h2v2H0zM0 8h2v2H0z"]}, DH = 10;
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
    clockSvg.innerHTML = paths; range.setAttribute('aria-valuetext', txt);
  }
  let overridden = false;
  function setTime(t) { overridden = true; api.setTime(t); showClock(t); }
  // the gear: six slightly tapered teeth on a round body, drawn one css px per pixel so a tilted tooth really slants, in six frames
  // 10° apart (a tooth repeats every 60°); opening turns it a third of a turn clockwise and hiding a third back, in twelve
  // steps over the panel's 0.35 s slide
  const GEAR = ["M11 1h7v4h-7zM4 5h1v1H4zm6 0h9v1h-9zM24 5h1v1h-1zM3 6h5v1H3zM9 6h11v1H9zM21 6h5v1h-5zM2 7h25v2H2zM1 9h27v1H1zm1 1h10v1H2zm15 0h10v1H17zM3 11h8v1H3zm15 0h8v1h-8zM4 12h6v1H4zm15 0h6v1h-6zM5 13h5v3H5zm14 0h5v3h-5zM4 16h6v1H4zm15 0h6v1h-6zM3 17h8v1H3zm15 0h8v1h-8zM2 18h10v1H2zm15 0h10v1H17zM1 19h27v1H1zm1 1h25v2H2zm1 2h5v1H3zm6 0h11v1H9zm12 0h5v1h-5zM4 23h1v1H4zm6 0h9v1h-9zm14 0h1v1h-1zM11 24h7v4h-7z", "M14 0h2v1h-2zm0 1h6v1h-6zM13 2h7v3h-7zM5 4h3v1H5zM4 5h5v1H4zm6 0h10v1H10zM3 6h17v1H3zM2 7h20v1H2zM24 7h3v1h-3zM3 8h24v1H3zM3 9h25v1H3zm1 1h8v1H4zm13 0h11v1H17zM5 11h6v1H5zm13 0h10v1H18zM5 12h5v2H5zm14 0h9v1h-9zm0 1h8v1h-8zM4 14h6v1H4zm15 0h6v1h-6zM2 15h8v1H2zm17 0h5v2h-5zM1 16h9v1H1zm0 1h10v1H1zm17 0h6v1h-6zM1 18h11v1H1zm16 0h8v1h-8zM1 19h25v1H1zm1 1h24v1H2zm0 1h3v1H2zm5 0h20v1H7zm2 1h17v1H9zm0 1h10v1H9zm11 0h5v1h-5zM9 24h7v3H9zm12 0h3v1h-3zM9 27h6v1H9zm4 1h2v1h-2z", "M16 1h4v1h-4zM7 2h1v1H7zm8 0h7v2h-7zM6 3h4v1H6zM5 4h6v1H5zm9 0h8v1h-8zM4 5h17v2H4zM4 7h18v1H4zM5 8h17v1H5zM6 9h22v1H6zM5 10h7v1H5zm12 0h11v1H17zM5 11h6v1H5zm13 0h10v1H18zM5 12h5v1H5zm14 0h9v1h-9zM2 13h8v1H2zm17 0h10v2H19zM0 14h10v2H0zm19 1h8v1h-8zM1 16h9v1H1zm18 0h5v1h-5zM1 17h10v1H1zm17 0h6v1h-6zM1 18h11v1H1zm16 0h7v1h-7zM1 19h22v1H1zm6 1h17v1H7zm0 1h18v1H7zm1 1h17v2H8zM7 24h8v1H7zm11 0h6v1h-6zM7 25h7v2H7zm12 0h4v1h-4zm2 1h1v1h-1zM9 27h4v1H9z", "M9 1h1v1H9zM19 1h1v1h-1zM7 2h4v1H7zM18 2h4v1h-4zM6 3h6v1H6zM17 3h6v1h-6zM5 4h8v1H5zM16 4h8v1h-8zM6 5h17v3H6zM7 8h15v1H7zM6 9h17v1H6zM5 10h7v1H5zm12 0h7v1h-7zM1 11h10v1H1zm17 0h10v1H18zM1 12h9v5H1zm18 0h9v5h-9zM1 17h10v1H1zm17 0h10v1H18zM5 18h7v1H5zm12 0h7v1h-7zM6 19h17v1H6zm1 1h15v1H7zM6 21h17v3H6zM5 24h8v1H5zm11 0h8v1h-8zM6 25h6v1H6zm11 0h6v1h-6zM7 26h4v1H7zm11 0h4v1h-4zM9 27h1v1H9zm10 0h1v1h-1z", "M9 1h4v1H9zM7 2h7v2H7zM21 2h1v1h-1zM19 3h4v1h-4zM7 4h8v1H7zM18 4h6v1h-6zM8 5h17v2H8zM7 7h18v1H7zM7 8h17v1H7zM1 9h22v1H1zm0 1h11v1H1zm16 0h7v1h-7zM1 11h10v1H1zm17 0h6v1h-6zM1 12h9v1H1zm18 0h5v1h-5zM0 13h10v2H0zm19 0h8v1h-8zm0 1h10v2H19zM2 15h8v1H2zm3 1h5v1H5zm14 0h9v1h-9zM5 17h6v1H5zm13 0h10v1H18zM5 18h7v1H5zm12 0h11v1H17zM6 19h22v1H6zM5 20h17v1H5zM4 21h18v1H4zm0 1h17v2H4zm1 2h6v1H5zm9 0h8v1h-8zM6 25h4v1H6zm9 0h7v2h-7zM7 26h1v1H7zm9 1h4v1h-4z", "M13 0h2v1h-2zM9 1h6v1H9zM9 2h7v3H9zM21 4h3v1h-3zM9 5h10v1H9zM20 5h5v1h-5zM9 6h17v1H9zM2 7h3v1H2zM7 7h20v1H7zM2 8h24v1H2zM1 9h25v1H1zm0 1h11v1H1zm16 0h8v1h-8zM1 11h10v1H1zm17 0h6v1h-6zM1 12h9v1H1zm18 0h5v2h-5zM2 13h8v1H2zm2 1h6v1H4zm15 0h6v1h-6zM5 15h5v2H5zm14 0h8v1h-8zm0 1h9v1h-9zM5 17h6v1H5zm13 0h10v1H18zM4 18h8v1H4zm13 0h11v1H17zM3 19h25v1H3zm0 1h24v1H3zM2 21h20v1H2zm22 0h3v1h-3zM3 22h17v1H3zm1 1h5v1H4zm6 0h10v1H10zM5 24h3v1H5zm8 0h7v3h-7zm1 3h6v1h-6zm0 1h2v1h-2z"];
  const cog = gear.querySelector('.cog path');
  let turn = 0, spinning = 0;
  function spin(dir) { clearInterval(spinning); let k = 12; spinning = setInterval(() => { turn = (turn + dir + 6) % 6; cog.setAttribute('d', GEAR[turn]); if (--k <= 0 && turn === 0) clearInterval(spinning); }, 350 / 12); }
  let closing = 0;
  function open() { clearTimeout(closing); spin(1); gear.setAttribute('aria-expanded', 'true'); panel.classList.remove('closing'); panel.hidden = false; range.value = Math.round(api.hoursNow() * 60) % 1440; showClock(api.hoursNow()); }
  // if focus is inside the panel as it hides, hand it back to the gear rather than strand it
  function close() { if (panel.hidden || panel.classList.contains('closing')) return; spin(-1); if (panel.contains(document.activeElement)) gear.focus(); panel.classList.add('closing'); gear.setAttribute('aria-expanded', 'false'); closing = setTimeout(() => { panel.hidden = true; panel.classList.remove('closing'); }, 350); }
  // the gear on the card opens it, and another click hides it
  gear.addEventListener('click', () => (panel.hidden || panel.classList.contains('closing') ? open() : close()));
  range.addEventListener('input', () => setTime(range.value / 60));
  // season button: shows the current season's icon and steps to the next one
  const SICON = {"spring": "M2 0h2v1H2zM5 0h2v1H5zM1 1h7v1H1zM1 2h2v1H1zM6 2h2v1H6zM2 3h1v1H2zM6 3h1v1H6zM1 4h2v1H1zM6 4h2v1H6zM1 5h7v1H1zM2 6h2v1H2zM5 6h2v1H5zM4 7h1v1H4zM3 8h2v1H3z", "summer": "M4 0h1v1H4zM1 1h1v1H1zM7 1h1v1H7zM3 2h3v1H3zM2 3h5v3H2zM0 4h1v1H0zM8 4h1v1H8zM3 6h3v1H3zM1 7h1v1H1zM7 7h1v1H7zM4 8h1v1H4z", "autumn": "M5 0h4v1H5zM3 1h6v1H3zM2 2h4v1H2zM7 2h2v1H7zM1 3h4v1H1zM6 3h3v1H6zM1 4h3v1H1zM5 4h4v1H5zM1 5h2v1H1zM4 5h4v1H4zM2 6h1v1H2zM4 6h3v1H4zM1 7h1v1H1zM0 8h1v1H0z", "winter": "M4 0h1v3H4zM1 1h1v1H1zM7 1h1v1H7zM2 2h1v1H2zM6 2h1v1H6zM3 3h3v1H3zM0 4h9v1H0zM3 5h3v1H3zM2 6h1v1H2zM4 6h1v3H4zM6 6h1v1H6zM1 7h1v1H1zM7 7h1v1H7z"}, sBtn = document.getElementById('tp-season');
  const showSeason = () => { sBtn.querySelector('path').setAttribute('d', SICON[SEASON]); sBtn.setAttribute('aria-label', 'Season: ' + SEASON + ' (next: ' + SEASONS[(SEASONS.indexOf(SEASON) + 1) % 4] + ')'); };
  showSeason();
  // the season and dice buttons change things silently for a screen reader, so they say what happened in the status region
  const say = (msg) => { const s = document.getElementById('status'); s.textContent = ''; setTimeout(() => { s.textContent = msg; }, 50); };
  // dice: a brand-new forest (new seed), same season and time
  document.getElementById('tp-reseed').addEventListener('click', () => { api.reseed(); say('New forest'); });
  sBtn.addEventListener('click', () => { api.setSeason(SEASONS[(SEASONS.indexOf(SEASON) + 1) % 4]); showSeason(); say(SEASON[0].toUpperCase() + SEASON.slice(1)); });
  document.getElementById('tp-reset').addEventListener('click', () => { if (SEASON !== seasonOf()) { api.setSeason(seasonOf()); showSeason(); } overridden = false; api.setTime(null); const t = api.realHours(); range.value = Math.round(t * 60); showClock(t); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) close(); });
  // keep the clock ticking while the panel shows real time
  setInterval(() => { if (!panel.hidden && !overridden) { const t = api.realHours(); range.value = Math.round(t * 60); showClock(t); } }, 15000);
}
