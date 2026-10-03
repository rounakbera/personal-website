// Colours: every material's six-tone palette, the seasonal material swaps, and the sky keyframes by hour.
import { hex, mix, lerp } from '../util.js';

// six tones per material: outline, deep shadow, shadow, mid, light, highlight
export const PAL = Object.fromEntries(Object.entries({
  pine:   ['#0d2419', '#163626', '#1f4a33', '#2b6141', '#447d4c', '#6fa35c'],
  deep:   ['#08150f', '#0f2219', '#163022', '#1f402c', '#2c573a', '#45744a'],
  oak:    ['#15301a', '#22451f', '#305e29', '#447a32', '#64993f', '#97c457'],
  oak2:   ['#1b2f14', '#2b451c', '#3d5f25', '#527b2e', '#74993c', '#a6c457'],
  oak3:   ['#12291b', '#1d3d24', '#285630', '#356f3a', '#52904a', '#82b462'],
  // bushes are evergreen shrubs: same greens as the oaks, but they keep them all year
  shrub:  ['#15301a', '#22451f', '#305e29', '#447a32', '#64993f', '#97c457'],
  shrub2: ['#1b2f14', '#2b451c', '#3d5f25', '#527b2e', '#74993c', '#a6c457'],
  shrub3: ['#12291b', '#1d3d24', '#285630', '#356f3a', '#52904a', '#82b462'],
  twig:   ['#2a2420', '#3e3530', '#5a4e46', '#76695e', '#928476', '#b0a292'],
  bark:   ['#1b120c', '#2c1e15', '#44301f', '#5c3f29', '#775435', '#946c45'],
  moss:   ['#1a2a10', '#2a4116', '#3e5c1d', '#567b25', '#789c33', '#a3c34d'],
  grass:  ['#11251a', '#1b3720', '#264d28', '#35662f', '#4f843b', '#78a94c'],
  rock:   ['#22242a', '#363a42', '#4c525c', '#646b75', '#828a92', '#a8b0b6'],
  flower: ['#4a1a3a', '#7a2a5a', '#b5487a', '#e27aa2', '#f6b0c8', '#fff4f8'],
  blue:   ['#0e2026', '#17323c', '#21474f', '#2d5f63', '#4a7f7b', '#7aa899'],
  olive:  ['#1b2911', '#283c17', '#38521f', '#4b6a28', '#6a8a36', '#95b254'],
  mount:  ['#2f3e55', '#3d5068', '#4e6680', '#5f7a94', '#7590a8', '#9ab3c6'],
  // autumn canopies and grass
  autO:   ['#3a1a0c', '#6a2c10', '#9a4416', '#c8621e', '#e6893a', '#f6b660'],
  autY:   ['#3a2a0c', '#6a4a12', '#9a6e1a', '#c89a26', '#e6c044', '#f8e07a'],
  autR:   ['#34100e', '#5e1a14', '#8c2618', '#b63a1e', '#d85a30', '#f08a52'],
  grassA: ['#1f2412', '#33391a', '#4a5122', '#636a2c', '#848a3c', '#aaa852'],
  // spring: fresh, pale leaves, blossom and wildflowers
  sprA:   ['#17321a', '#25502a', '#367036', '#4c9040', '#74b450', '#a8d878'],
  sprB:   ['#1e3418', '#305222', '#46722c', '#629438', '#8cb84a', '#c0de78'],
  sprC:   ['#163220', '#22502e', '#32703c', '#46904c', '#6cb066', '#a2d494'],
  grassS: ['#13281a', '#1e3c22', '#2b542b', '#3c7034', '#5a9242', '#88bc5a'],
  bloom:  ['#5a2a40', '#8a4a66', '#c97a98', '#ef9fbc', '#fbcadc', '#fff3f7'],
  bloomW: ['#4a4450', '#7a7484', '#b0aabc', '#dcd6e4', '#f2eef6', '#ffffff'],
  fy:     ['#4a3a0a', '#7a6010', '#b8901a', '#e8c02a', '#f8dc5a', '#fff2a8'],
  fw:     ['#4a4a54', '#7a7a88', '#b0b0c0', '#dcdce8', '#f2f2f8', '#ffffff'],
  fv:     ['#2a1a4a', '#46307a', '#6a4ab0', '#9070d8', '#b49af0', '#dcd0ff'],
  fb:     ['#0e2a4a', '#18467a', '#2a6ab0', '#4a92d8', '#7ab6f0', '#bcdcff'],
  // winter
  snow:   ['#4a5468', '#6c7890', '#9aa6bc', '#c4cedc', '#e2e8f0', '#f8fbff'],
  snowG:  ['#3e4658', '#7d8aa2', '#a9b5c8', '#c9d2e0', '#e3e9f1', '#f6f9fd'],
  straw:  ['#2a2214', '#4a3c22', '#6a5834', '#8c7648', '#ad9660', '#cdb882']
}).map(([k, v]) => [k, v.map(hex)]));

// materials swapped at paint time
export const REMAP = {
  summer: {},
  autumn: { oak: 'autO', oak2: 'autY', oak3: 'autR', grass: 'grassA' },
  spring: { oak: 'sprA', oak2: 'sprB', oak3: 'sprC', grass: 'grassS' },
  winter: { moss: 'snow', grass: 'snowG' }
};
export const SNOWY = new Set(['pine', 'deep', 'blue', 'olive', 'rock', 'mount', 'bark', 'shrub', 'shrub2', 'shrub3']);

/* ---------- sky by hour ---------- */
// hour, top, middle, horizon, daylight (0–1), warmth (0–1); dawn runs ~3.75–9h and dusk ~16–22.25h
export const KEYS = [
  [0,     [10, 12, 38],   [20, 24, 64],    [40, 40, 90],    0,   0],
  [3.75,  [10, 12, 38],   [20, 24, 64],    [40, 40, 90],    0,   0],
  [4.75,  [16, 18, 52],   [40, 38, 90],    [92, 62, 112],   .05, .15],
  [5.75,  [28, 32, 82],   [78, 64, 122],   [196, 110, 120], .2,  .45],
  [6.75,  [60, 96, 170],  [190, 140, 160], [250, 180, 120], .55, .6],
  [7.75,  [66, 124, 206], [160, 170, 200], [245, 205, 160], .85, .35],
  [9,     [70, 140, 220], [120, 180, 235], [190, 225, 240], 1,   .08],
  [12,    [52, 128, 222], [104, 172, 236], [180, 220, 244], 1,   0],
  [16,    [60, 126, 210], [120, 170, 225], [220, 210, 190], 1,   .12],
  [17.5,  [62, 104, 184], [170, 150, 170], [245, 190, 130], .85, .5],
  [18.75, [64, 80, 150],  [200, 120, 120], [250, 170, 90],  .65, .8],
  [19.75, [40, 40, 96],   [120, 70, 120],  [230, 110, 80],  .35, .7],
  [20.75, [22, 24, 64],   [56, 46, 104],   [120, 70, 110],  .14, .35],
  [22.25, [10, 12, 38],   [20, 24, 64],    [40, 40, 90],    0,   0],
  [24,    [10, 12, 38],   [20, 24, 64],    [40, 40, 90],    0,   0]
];
export const palette = (t) => {
  let i = 0; while (i < KEYS.length - 2 && KEYS[i + 1][0] <= t) i++;
  const a = KEYS[i], b = KEYS[i + 1], f = (t - a[0]) / (b[0] - a[0]);
  return { top: mix(a[1], b[1], f), mid: mix(a[2], b[2], f), hor: mix(a[3], b[3], f), L: lerp(a[4], b[4], f), Wm: lerp(a[5], b[5], f) };
};
