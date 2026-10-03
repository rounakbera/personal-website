# AGENTS.md

Knowledge for anyone (human or agent) working on this site. Read this before changing anything.

## What this is

Rounak Bera's one-page personal website. A procedurally generated pixel-art forest fills the screen, its sky follows the visitor's local time, and a parchment card floats on top with a pixel portrait, the name and four link buttons.

- **Static, no frameworks, no build step, no dependencies.** Plain HTML, CSS and vanilla JS. Keep it that way.
- No web fonts are downloaded: every bit of text in the card is pre-rasterised into SVG pixel paths.
- To deploy, serve the folder as-is. Source lives at `github.com/rounakbera/personal-website`; the site is served on the owner's own domain (DNS on Cloudflare).

## Files

```
index.html            markup only: the canvas, the card, the hidden time panel
css/site.css          all styles
js/util.js            shared helpers: seeded rng, coordinate hash, lerp/mix/clamp, dithering, value noise
js/card.js            the card: link icons, copy-email button, parchment grain, portrait hover effect
js/forest/
  main.js             entry point: picks seed and season, fits the scene to the screen, redraw loop
  state.js            shared view state (W, H, YO, PX, SKYB, WW, WH) and the current SEASON, with setters
  palette.js          PAL (6 tones per material), REMAP (seasonal swaps), SNOWY, sky KEYS and palette(t)
  layer.js            Layer pixel buffers (material, tone, part, object) and finalize() outlines/shading
  draw.js             drawing primitives: blob, trunk, limb, tier, pine/conifer, oak + bare winter oak,
                      bush, fern, rock, flowers, meadow, ground, ridge, treeline; owns object/part ids
  clouds.js           cloud shapes and buildClouds(seed)
  scene.js            planFor, buildWorld, buildFront, snowify, flatten
  render.js           prepare() (sky, sun, moon, grading) and draw() (stars, clouds, land) per frame
  timepanel.js        the easter-egg panel; talks to main.js through a small api object
assets/
  portrait-pixel.png  48×48 pixel-art portrait (hand-tuned; see Portrait)
  portrait.jpg        320 px photo the portrait reveals on hover
AGENTS.md             this file
```

The scripts are native ES modules (`<script type="module">`), so the page has to be served over HTTP; opening `index.html` straight from disk (`file://`) won't run them. Shared mutable state lives in `state.js` (and the id counters in `draw.js`); other modules read it through live imports and change it only via the exported setters.

## Running and checking

- **Run:** `python3 -m http.server 8000` and open `http://localhost:8000/` (a server is required: ES modules don't load from `file://`).
- **URL hash options:** `#seed-21` pins a forest, `#winter` (also `spring`/`summer`/`autumn`) pins a season, and they combine as `#seed-21-winter`. Seed 21 is the original "favourite" forest and has a hand-set foreground plan.
- **Visual checks:** take headless screenshots, e.g. with Playwright. Check wide (1280×720), tall/phone (390×844) and a narrow width just under the stacked-layout breakpoint (660 px). Check noon, dawn (~6.5) and night (~22). Drive the time through the hidden time panel: click the name, set `#tp-range` and dispatch `input`.
- **Always look at the render after a visual change.** Several regressions were only caught by looking.
- **Refactors:** freeze time with Playwright's `page.clock`, wait ~1.5 s of real time for the card's CSS drop-in, then compare screenshots before and after pixel for pixel. The background is fully deterministic for a pinned seed and season.

## Page structure

1. **`css/site.css`.** Tokens on `:root` (`--ink`, `--parch*`). Card layout: side-by-side above 660 px, stacked below, smaller again under 340 px. Link tooltips. The time panel.
2. **`index.html` markup.**
   - `canvas#world` holds the background.
   - `main > .card-wrap > article`:
     - the portrait (canvas);
     - `h1`, holding a screen-reader name plus four SVG versions of the name (Jersey 10/15/20/25);
     - `ul.links`.
   - `#timepanel` is the hidden easter-egg dialog.
3. **`js/card.js`.** Icons (string grids → SVG), copy-email button, parchment grain, portrait hover effect.
4. **`js/forest/`.** Everything about the background and the time panel (see Files).

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

- **Winter oak (`bare()`/`bareShape()` in `js/forest/draw.js`)** — being iterated with the owner. Current approach:
  - In winter the trunk stops at ~40% of the tree's height and splits in two: a leader nearly as thick as the trunk carrying on almost straight up, and a thinner limb swinging out. Both start inside the trunk and the trunk casts no seam line onto them, so they grow out of it smoothly.
  - The two main limbs open 60–105° apart (owner's rule): the leader leans 0.1–0.25 rad one way, the outward limb takes the rest. If the outward limb would miss the crown, the pair turns up together so the angle is kept. A rounded crotch is stamped on the trunk top so the wide fork doesn't leave its flat top showing. (Applying 60–105° at every later split too was tried: it made antler-like, stubby trees.)
  - The two main limbs are about equal in length (owner's rule): both get one shared first run, long enough to be well inside the crown before they first fork.
  - Every split is in two (owner's rule): a leading child nearly parallel to its parent (slight bend, ~0.85–0.9× width) and a side child (~0.6–0.75×) bending the other way by anything up to ~80°. Sides alternate down a branch. Wood tapers slowly (owner wanted thicker branches): the main limbs and their first children keep ~0.95× per run and the first split's children are ~0.9× / ~0.8× of their parent, and thick wood stops each run well short of the crown edge (at least ~2.5× its width) so its children have room to carry on.
  - A thick branch never just ends (owner): when one runs out of room or is blocked while still thicker than ~1.3 px, `splay()` forces a split, sending a thinner child toward the side with the most room (both sides if both have some). If nowhere has room it still forks into two short thin shoots. Only wood already ~1 px may end, with a twig or two.
  - Longer runs get short side shoots; long thick runs on the main limbs and their first children also put out one real side branch.
  - Low limbs that haven't reached the summer crown yet may cross the gap up into it.
  - The foreground oak stands half off-screen, so its outward limb always swings toward the screen's middle (`inward` option), and any first-split limb that would miss the crown is swung up until it enters it. Otherwise one of the two first limbs ends up off-screen or as a stub.
  - Each run covers only a share of the room left before the crown's edge, so wood keeps dividing and thinning out to 1 px twigs.
  - At every fork after the trunk split, the side child starts a few px back inside its parent so it grows out of the parent's flank (owner: it should cover the branch it diverges from), and the leading child carries on from the parent's full width.
  - Branches never cross or curve into each other (owner): every split draws a line along the parent at the fork, and each child's whole subtree stays on its own side (inherited half-planes `C`). A branch about to cross is steered away and, if it still can't, tapers off. The trunk split's line runs up the middle of the fork.
  - The crown edge should be star-like, not a circle (owner): each branch line carries its own reach (0.65–1.45× the summer crown), drifting at every fork, so tips land at uneven distances.
  - Thick wood never points below horizontal; thin twigs may dip slightly. Branches wander a little instead of curving steadily upward.
  - Shapes are cached per crown, so resizing doesn't regrow them.
- **Résumé link** target.
- **Hosting:** hook the repo up to the owner's Cloudflare domain (e.g. Cloudflare Pages, no build command, output directory `/`).
