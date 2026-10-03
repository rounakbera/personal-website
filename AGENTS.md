# AGENTS.md

Knowledge for anyone (human or agent) working on this site. Read this before changing anything.

## What this is

Rounak Bera's one-page personal website. A procedurally generated pixel-art forest fills the screen, its sky follows the visitor's local time, and a parchment card floats on top with a pixel portrait, the name and four link buttons.

- **Static, no frameworks, no build step, no dependencies.** Plain HTML, CSS and vanilla JS. Keep it that way.
- No web fonts are downloaded: every bit of text in the card is pre-rasterised into SVG pixel paths.
- To deploy, serve the folder as-is. Source lives at `github.com/rounakbera/personal-website`; the site is served on the owner's own domain (DNS on Cloudflare).

## Files

| File | Purpose |
|---|---|
| `index.html` | The whole site: CSS, card markup, the card script and the forest script (~110 KB) |
| `portrait-pixel.png` | 48×48 pixel-art portrait (hand-tuned; see Portrait) |
| `portrait.jpg` | 320 px photo the portrait reveals on hover |
| `AGENTS.md` | This file |

## Running and checking

- **Run:** `python3 -m http.server 8000` and open `http://localhost:8000/`.
- **URL hash options:** `#seed-21` pins a forest, `#winter` (also `spring`/`summer`/`autumn`) pins a season, and they combine as `#seed-21-winter`. Seed 21 is the original "favourite" forest and has a hand-set foreground plan.
- **Visual checks:** take headless screenshots, e.g. with Playwright. Check wide (1280×720), tall/phone (390×844) and a narrow width just under the stacked-layout breakpoint (660 px). Check noon, dawn (~6.5) and night (~22). Drive the time through the hidden time panel: click the name, set `#tp-range` and dispatch `input`.
- **Always look at the render after a visual change.** Several regressions were only caught by looking.

## Page structure (`index.html`)

1. **CSS.** Tokens on `:root` (`--ink`, `--parch*`). Card layout: side-by-side above 660 px, stacked below, smaller again under 340 px. Link tooltips. The time panel.
2. **Markup.**
   - `canvas#world` holds the background.
   - `main > .card-wrap > article`:
     - the portrait (canvas);
     - `h1`, holding a screen-reader name plus four SVG versions of the name (Jersey 10/15/20/25);
     - `ul.links`.
   - `#timepanel` is the hidden easter-egg dialog.
3. **Card script (first IIFE).** Icons (string grids → SVG), copy-email button, parchment grain, portrait hover effect.
4. **Forest script (second IIFE).** Everything about the background and the time panel.

## Card details

- **Name:** a bitmap of the Jersey fonts. Glyphs were rasterised from the TTF outlines, at grid units 75/50/38/30 for Jersey 10/15/20/25, into crisp SVG path runs.
- **Hover effect:** hovering the portrait or name runs a ~0.45 s de-pixelation. The portrait goes from 48 px art to the photo with linear block size, so the pacing is even. At the same time the name steps through Jersey 10 → 15 → 20 → 25. On touch screens, tapping toggles it.
- **Link icons:**
  - The GitHub and LinkedIn icons were pixelated from the official brand images the owner supplied. Brand guidelines may not allow altering them.
  - The résumé icon is a scroll with parallel diagonal sides.
  - Email is a winged envelope.
- **Tooltips:** lowercase, typed in letter by letter (CSS `steps()`, with the box growing as it types). On the side-by-side layout the email tooltip types right-to-left.
- **Hover behaviour:** hover is tracked on the `li`, not the lifted `a`, and `a::after` extends the hit area. This stops the lifted button from un-hovering itself and keeps its lower edge clickable.
- **Email rule — important:** the literal address must never appear anywhere in the repo, the HTML or any asset.
  - The tooltip says "first name + last name @gmail.com".
  - Clicking copies an address built at runtime from the screen-reader name in `h1 .sr` (lowercased, letters only) plus `@gmail.com`.
  - The "copied" tag resets on pointer-leave or after 1.5 s.
  - Grep for the address before every commit.
- **Résumé link:** still `href="#"`; waiting on the owner.

## Forest: how it works

**Coordinates.** Everything is drawn in scene pixels.

- One scene pixel is `PX` screen pixels, where `S = max(1, min(vh/180, vw/200))`. S is continuous, so resizing zooms smoothly.
- The land is a 180 px-tall band. `YO = H − 180` pushes it down on tall screens, showing more sky.

**Two parts, built differently:**

- **World:** mountains, treeline, field, groves and rocks. A fixed 960×180 strip, built once per seed and season, then windowed to the screen width.
- **Front:** foreground ground, ground cover and the three framing trees (big oak on one side, two different conifers on the other). Sized to the screen and rebuilt on every resize.
  - Every front object gets fixed part ids, its own random stream and its own texture origin, via `at(x, y, id)`. That way nothing reshuffles as it slides.

**Rendering pipeline:**

1. Drawing functions write into `Layer` buffers (per pixel: `mat`, `tone`, `part`, `obj`).
2. `finalize()` adds outlines and the shade line under overlapping parts.
3. `flatten()` keeps the top-most pixel.
4. `prepare(t)` paints the dithered sky, sun, crescent moon and halo, then grades every land pixel for time of day and distance haze (`grade`) plus a season cast (`tint`). It runs once a minute.
5. `draw()` runs every 500 ms. It composites stars (each twinkles on its own slow cycle, at most ~5% lit at once), clouds and the land.

**Materials.** `PAL` gives each material six tones: outline, deep shadow, shadow, mid, light, highlight.

**Determinism rules — don't break these:**

- Seeded RNG (`rng`) plus coordinate `hash`. Textures hash coordinates relative to the object's origin (`ORX`/`ORY`), so they stick to objects that move.
- **Never add or remove `r()` calls on a shared stream for a seasonal or cosmetic variant.** That reshuffles the whole layout. Give new features their own stream (e.g. `rng(seed + 77)`) or use `hash`.
- Same seed means the same layout in every season.

**Trees:**

- `oak()` builds a crown from leaf clumps. The big foreground oak uses the `sym` option for a rounder, more even crown.
- Conifers go through `pine()` / `conifer()`. Kinds: spruce, fir, blue, column, lodge.
  - The tiers follow one smooth outline.
  - Any lean is anchored at the bottom tier, so the crown sits on its trunk.
  - The two foreground conifers always have different looks and noticeably different tier heights: one tight, one loose.
- Bushes are **evergreen shrubs** (`shrub*` materials). They stay green in every season.

**Clouds:**

- Kinds are cumulus (lumpy, flat-bottomed), stratus and cirrus. Every sky mixes at least two kinds.
- An upper group sits above the 180 px band, so tall screens get more clouds up high. Clouds do not move up as the aspect ratio changes.
- Each cloud steps one pixel right on its own beat, a multiple of 0.5 s, and wraps across the 960 px strip.

**Sun and moon:**

- They keep about a 35 px radius on screen at any scale.
- On tall screens their arc rises smoothly so it passes above the card. `SKYB` is the card's top edge.
- The moon is a crescent tilted ~40° counter-clockwise, with a crescent-shaped halo.

**Time of day:** `KEYS` sets the sky colours. Dawn runs ~3.75–9 h and dusk ~16–22.25 h, deliberately long.

**Seasons** (`SEASON`, picked from the date: Mar–May spring, Jun–Aug summer, Sep–Nov autumn, Dec–Feb winter):

- **Summer:** the original look.
- **Autumn:**
  - Oaks turn orange, gold or red (`REMAP`).
  - Grass is warmer and the ferns turn yellow.
  - Fallen leaves replace the flowers, in the foreground and across the field.
  - Warm colour cast.
- **Winter:**
  - Oaks are bare branches (`bare()`).
  - Snow is added by `snowify()` on the top surfaces of conifers, rocks, ridges, branches and bushes, plus flecks of snow in the needles.
  - Ground is snow with a few straw stalks.
  - No flowers or ferns.
  - Muted, cool grading.
- **Spring:**
  - Fresh pale greens, with pink or white blossom on the oaks only.
  - Many multicoloured wildflowers.
  - 1.7× the clouds, with a greyer sky and greyer clouds.

**Motion:**

- The sky's motion runs even with reduced motion on (owner's choice). Only the card's drop-in respects `prefers-reduced-motion`.
- Animation pauses while the tab is hidden.

## Time panel (easter egg)

- **Opening:** click the portrait or name. The panel slides down from the top edge into the top-left corner.
- **Controls:**
  - pixel clock (Jersey 10 digits baked to paths);
  - time slider;
  - season button (cycles spring → summer → autumn → winter);
  - dice (new random forest; keeps season and time);
  - reset (real time and real season);
  - × to close, which fades it out (Escape also closes).

## Owner's design decisions

Keep these unless asked otherwise.

- **Pixel art everywhere:** no smooth scaling of art and no anti-aliased text.
- **Forest:**
  - Mixed woodland with scattered groves, not a single treeline and an open field.
  - Never stack two trees of the same type directly in front of each other.
  - Flowers sit embedded in the ground, never floating.
- **Leaves:**
  - Deciduous canopies should be clumpy and textured, not visible spheres.
  - The tops of leaf clumps and conifer tiers are smoother; the undersides more ragged.
- **Clouds:** no towering cumulus, no mackerel sky.
- **Motion:** slow and stepped. Clouds move in half-second multiples. Stars twinkle 1.5–2.5 s with long gaps. The sun and moon move once a minute.
- **Portrait:**
  - The current art (msG48) is approved, including the measured mouth position and the original eyes.
  - A symmetric-eyes edit was rejected.
  - The glasses frames are thin and pale gold.

## Open work

- **Winter foreground oak looks wrong.** The background bare trees are acceptable. Plan:
  - Rebuild the foreground tree with regular forking. The trunk splits at about half the tree's height into 2–3 limbs, then each limb forks into a continuing child (~0.8× width, 10–20° bend) and a side child (~0.6× width, 30–45°).
  - Thickness shrinks from the trunk down to 1 px twigs, with a fine, lighter twig haze tracing the old crown edge.
  - No branches pointing down.
  - Cache the result per seed so resizing doesn't regrow it.
- **Résumé link** target.
- **Hosting:** hook the repo up to the owner's Cloudflare domain (e.g. Cloudflare Pages, no build command, output directory `/`).
