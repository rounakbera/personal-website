# AGENTS.md

Knowledge for anyone (human or agent) working on this site. Read this before changing anything.

## What this is

Rounak Bera's one-page personal website. A procedurally generated pixel-art forest fills the screen, its sky follows the visitor's local time, and a parchment card floats on top with a pixel portrait, the name and four link buttons.

- **Static, no frameworks, no build step, no runtime dependencies.** Plain HTML, CSS and vanilla JS. Keep it that way. The only package is Wrangler, a dev dependency used to preview and deploy.
- No web fonts are downloaded: every bit of text in the card is pre-rasterised into SVG pixel paths.
- Source lives at `github.com/rounakbera/personal-website`. The site is served on the owner's own domain (DNS on Cloudflare).

## Deploying (Cloudflare Workers, static assets)

- The site is a **static-assets-only Worker**: `wrangler.jsonc` points `assets.directory` at `public/`, and there is no Worker script. Only `public/` is uploaded; `AGENTS.md`, configs and `node_modules` never are.
- First time: `npm install`, then `npx wrangler login` (opens a browser to authorise).
- **Preview:** `npm run dev` (Wrangler's local server, same behaviour as production). **Deploy:** `npm run deploy`, which serves on `personal-website.<account>.workers.dev`.
- **Domain:** the site is served at `rounakbera.com` (zone on Cloudflare). The owner set it up in the dashboard, and it's also declared in `wrangler.jsonc` under `routes` (`custom_domain: true`), so a deploy keeps it attached.
- **Deploy on push (optional):** in the Cloudflare dashboard, connect the Worker to this GitHub repo (*Workers Builds*), with deploy command `npx wrangler deploy` and no build command.
- `public/_headers` sets a few security headers on every response (nosniff, referrer policy, no framing, no camera/mic/location). Unknown paths return a plain 404 (`not_found_handling: "none"`).

## Files

```
public/                 everything served to the browser (the Worker's static assets)
  index.html            markup only: the canvas, the card, the hidden time panel
  _headers              response headers for Cloudflare
  css/site.css          all styles
  js/util.js            shared helpers: seeded rng, coordinate hash, lerp/mix/clamp, dithering, value noise
  js/card.js            the card: copy-email button, parchment grain, portrait pixelation effect
  js/forest/
    main.js             entry point: picks seed and season, fits the scene to the screen, redraw loop
    state.js            shared view state (W, H, YO, PX, SKYB, STACK, VT, WW, WH) and the current SEASON, with setters
    palette.js          PAL (6 tones per material), REMAP (seasonal swaps), SNOWY, sky KEYS and palette(t)
    layer.js            Layer pixel buffers (material id, tone, part, object), the material id table, finalize() outlines/shading
    draw.js             drawing primitives: blob, trunk, limb, tier, pine/conifer, oak + bare winter oak,
                        bush, fern, rock, flowers, meadow, ground, ridge, treeline; owns object/part ids
    clouds.js           cloud shapes and buildClouds(seed)
    scene.js            planFor, buildWorld, buildFront, snowify, flatten
    render.js           prepare() (sky, sun, moon, grading) and draw() (stars, clouds, land) per frame
    timepanel.js        the easter-egg panel; talks to main.js through a small api object
  rounakbera_resume.pdf the résumé, linked from the scroll button; X-Robots-Tag noindex
  robots.txt            allow all; points at the sitemap
  sitemap.xml           the one page, with the photo as its image
  favicon.ico           summer icon, for browsers that ask for /favicon.ico
  assets/
    portrait-pixel.png  48×48 pixel-art portrait (hand-tuned; see Portrait); X-Robots-Tag noindex
    portrait.jpg        320 px photo the portrait reveals on hover; the one image meant for search
    icons/              seasonal favicons: {spring,summer,autumn,winter}-{32,192}.png, -180.png apple-touch on parchment
wrangler.jsonc          Cloudflare Workers config (static assets from public/, custom domain rounakbera.com)
package.json            npm scripts `dev` / `deploy`; Wrangler as the only (dev) dependency
AGENTS.md               this file
```

The scripts are native ES modules (`<script type="module">`), so the page has to be served over HTTP; opening `index.html` straight from disk (`file://`) won't run them. Shared mutable state lives in `state.js` (and the id counters in `draw.js`); other modules read it through live imports and change it only via the exported setters.

## Running and checking

- **Run:** `npm run dev` (Wrangler, matches production), or without Node `python3 -m http.server 8000 -d public` and open `http://localhost:8000/`. A server is required: ES modules don't load from `file://`.
- **URL hash options:** `#seed-21` pins a forest, `#winter` (also `spring`/`summer`/`autumn`) pins a season, and they combine as `#seed-21-winter`. Seed 21 is the original "favourite" forest and has a hand-set foreground plan.
- **Visual checks:** take headless screenshots, e.g. with Playwright. Check wide (1280×720), tall/phone (390×844) and a narrow width just under the stacked-layout breakpoint (660 px). Check noon, dawn (~6.5) and night (~22). Drive the time through the hidden time panel: double-click the name, set `#tp-range` and dispatch `input`.
- **Always look at the render after a visual change.** Several regressions were only caught by looking.
- **Refactors:** freeze time with Playwright's `page.clock`, wait ~1.5 s of real time for the card's CSS drop-in, then compare screenshots before and after pixel for pixel. The background is fully deterministic for a pinned seed and season.

## Page structure

1. **`css/site.css`.** Tokens on `:root` (`--ink`, `--parch*`). The page is one fixed screen: `html`/`body` have no margin, `overflow: hidden` and no overscroll, so there's never a scrollbar. The viewport meta has `viewport-fit=cover` so the forest reaches under notches in phone landscape, while `.stage` and the time panel pad by `env(safe-area-inset-*)`. Card layout: side-by-side above 660 px, stacked below, smaller again under 340 px. Link tooltips. The time panel.
2. **`index.html` markup.**
   - `canvas#world` holds the background.
   - `main > .card-wrap > article`:
     - the portrait (canvas);
     - `h1`, holding a screen-reader name plus four SVG versions of the name (Jersey 10/15/20/25);
     - `ul.links`.
   - `#timepanel` is the hidden easter-egg dialog.
3. **`js/card.js`.** Copy-email button, parchment grain, portrait pixelation effect. (The link icons are static SVG in `index.html`, so they show without JS.)
4. **`js/forest/`.** Everything about the background and the time panel (see Files).

## Search and favicon (owner's rules)

- **Search results show only the name.** The `<title>` is "Rounak Bera". There's no meta description, and `robots` is `nosnippet` so no page text is used as a snippet either. Open Graph and Twitter tags carry the title and the photo, with no description.
- **The only image meant for search is the photo** (`assets/portrait.jpg`). It's the `img` under the portrait canvas (alt "Portrait of Rounak Bera"), `og:image`, the `image` of the Person JSON-LD, and the image in `sitemap.xml`. The pixel portrait is served with `X-Robots-Tag: noindex` (`_headers`). Everything else is drawn (canvas or inline SVG), so there's nothing else to index. Favicons stay crawlable, since search engines need them for the icon next to the result.
- **Seasonal favicon:** pixel trees in the site's palette, drawn on a 16×16 grid: a green oak (summer), the oak in pink blossom (spring), an orange oak (autumn) and a snow-capped conifer (winter). The static links point at summer. The inline head script swaps them to the current (or `#season`) season, and the time panel's season button swaps them too.

## Card details

- **Name:** a bitmap of the Jersey fonts. Glyphs were rasterised from the TTF outlines, at grid units 75/50/38/30 for Jersey 10/15/20/25, into crisp SVG path runs.
- **Shimmer:** every 4.5 s a pale diagonal strip sweeps the portrait from top left to bottom right in ~0.6 s (7 CSS steps). It crosses the whole portrait while it's pure pixel art (`.portrait.art`, toggled in `paint()`), and only the frame while the photo (or any in-between) shows. `::before` lights the frame under the image, `::after` the image; `::after` hides with opacity, not display, so the two stay in step.
- **Hover effect:** hovering the portrait or name runs a ~0.45 s de-pixelation. The portrait goes from 48 px art to the photo with linear block size, so the pacing is even. At the same time the name steps through Jersey 10 → 15 → 20 → 25.
- **Click/tap toggles it** (mouse and touch) and the state sticks after the pointer leaves, until the next click. (With a mouse, hover already shows the photo, so a click while hovering pixelates.) The toggle waits 300 ms in case a second click turns it into a double click, which opens the time panel instead and leaves the pixelation alone.
- **Load:** the markup shows the photo (an `img` under the canvas) and the Jersey 25 name, so that's the no-JS look. Once both images decode, the canvas takes over at the photo and ~0.65 s later pixelates into the art while the name steps down to Jersey 10.
- **Link icons** (static pixel SVGs in `index.html`):
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
  - Exception (owner's call): the résumé PDF contains the address, inside its compressed streams (it isn't greppable in the raw file, and the PDF is only fetched on click).
- **Résumé link:** `rounakbera_resume.pdf` (the owner's PDF, at the site root), opened in a new tab. It's a plain link, so the PDF loads only when clicked, never with the page. It's served with `X-Robots-Tag: noindex` so it doesn't turn up in search. To update it, replace the file under the same name.

## Forest: how it works

**Coordinates.** Everything is drawn in scene pixels.

- One scene pixel is `PX` screen pixels, where `S = max(1, min(vh/180, vw/200))`. S is continuous, so resizing zooms smoothly.
- The land is a 180 px-tall band. `YO = H − 180` pushes it down on tall screens, showing more sky.
- **Under browser toolbars:** the canvas is `100lvh` tall, so Safari's toolbars show forest rather than a blank strip. `fit()` sizes the scene to the visible area (`100svh`, toolbars shown) and adds the extra rows below `YO + 180` as plain foreground ground. Flowers stop at `YO + 180`, so they and the bushes stay above the bar. Sky gradient and sun path use `YO + 180`, not `H`. On desktop there are no extra rows.
- **Safari 26 on iPhone** draws page pixels behind its status bar and toolbar only when the page is scrolled, and never draws fixed elements there (it just tints the bars). So in that browser (`BLEED` in `main.js`, `html.bleed` in CSS):
  - The page is `OFF` (80 px) taller and parked at `scrollY = OFF`. Touch and wheel scrolling are blocked (`touchmove`/`wheel` `preventDefault`, except on the time slider), and any scroll snaps back.
  - The canvas is `position: absolute` in the page's flow. It reaches `TB` (80 px) above the visible top and `BB` (160 px) below the visible bottom: sky behind the status bar, ground behind the toolbar.
  - The land still ends at the visible bottom, so the flowers and bushes stay above the bar. `VT` in `state.js` is the first visible row, and the sun and moon path is measured from it.
  - Elsewhere none of this applies (the fixed 100lvh canvas above).
- In the stacked layout (≤ 660 px) the scene zooms in further, with `S ≥ min(vh/250, vw/110)`, so the land fills about the lower half and the framing trees reach the middle of the screen (owner's request). The view gets narrower to allow this.

**Two parts, built differently:**

- **World:** mountains, treeline, field, groves and rocks. A fixed 960×180 strip, built once per seed and season, then windowed to the screen width.
- **Front:** foreground ground, ground cover and the three framing trees (big oak on one side, two different conifers on the other). Sized to the screen and rebuilt on every resize.
  - Every front object gets fixed part ids, its own random stream and its own texture origin, via `at(x, y, id)`. That way nothing reshuffles as it slides.
  - **Per-forest shift:** the oak slides up to ±14 layout px sideways (`plan.oakDX`), and the two conifers slide together as a pair (`plan.pairDX`). Both come from their own stream in `planFor`. Seed 21 keeps its hand-set positions (0, 0).
  - **Trunks behind the toolbar:** a framing tree whose foot is already below the visible bottom (the oak at +186, the big conifer at +188) gets `sink`. Its trunk runs on just 10 px further, so behind a phone's toolbar the foot (flare and all) shows through the bar partway down rather than lining up with the bar's top edge. Owner: only a little; the base should stay visible. The trees don't move or grow (proportions are right as they are), and without a toolbar strip nothing changes.

**Rendering pipeline:**

1. Drawing functions write into `Layer` buffers (per pixel: `mat`, `tone`, `part`, `obj`).
2. `finalize()` adds outlines and the shade line under overlapping parts.
3. `flatten()` keeps the top-most pixel.
4. `prepare(t)` paints the dithered sky, sun, crescent moon and halo, then grades every land pixel for time of day and distance haze (`grade`) plus a season cast (`tint`). It runs once a minute.
5. `draw()` runs every 500 ms. It composites stars (each twinkles on its own slow cycle, at most ~5% lit at once), clouds and the land.

**Materials.** `PAL` gives each material six tones: outline, deep shadow, shadow, mid, light, highlight. In the `Layer` buffers, materials are stored as small ids (`Uint8Array`, 0 = empty). `mid(name)` registers a name and `MAT[id]` gives it back (`layer.js`), so the buffers are all typed arrays.

**Load speed** (the forest should be on screen as soon as possible; the owner wants no loading animation):

- `index.html` preloads every module (`modulepreload`), so they download in parallel rather than import by import.
- **Clipped first build:** the first `fit()` builds only the middle of the 960 px world strip that the screen shows, plus a margin (`buildWorld(seed, clip)`). The slow primitives (`blob`, `tier`, `bare`, `blossom`) return early when wholly outside the clip, after taking their part ids. `finalize`, `snowify` and `flatten` only sweep the drawn columns. Layout, ids and hashes are untouched, so inside the clip the result is identical to a full build. `ensureWorld()` builds the whole strip once the page is idle (after the load-in zoom), or at once if a resize widens the view first.
- **Clouds:** `puffs()` works out each pixel's owning circle once into a grid, and skips the trig for pixels beyond a circle's widest lobe.
- **Grading cache:** in `prepare()` the cache key is numeric (material id, tone, haze), not a string built per pixel.
- **Backdrop:** an inline script in `<head>` sets `--pre`, a gradient of this hour's sky (a copy of `KEYS`, keep in sync) over the season's forest and grass. It's laid out where the first, zoomed-in frame puts them, and is the body background until the canvas covers it. So the moment before the forest is drawn shows matching colours, not navy.
- These changes were verified pixel-identical to the previous renderer (all seasons, three screen sizes, several seeds). Keep that bar for any future speed work.

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

- They keep about a 35 px radius on screen at any scale (shrinking only on short stacked screens, so they fit above the card).
- On wide screens they rise and set at the horizon, behind the land.
- On tall screens and in the stacked layout the path blends into one over the card: in from beyond the left edge just above the card's top (`SKYB`), over it, and out past the right edge. Nothing pops in or out mid-sky, and the card never hides them (`STACK` in `state.js` flags the stacked layout).
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
  - Fresh pale greens, with blossom on the oaks only (`blossom()`), pink or white per tree. Size follows the tree's height: the foreground oak (h ≥ 90) gets full flowers (mostly a 5-px yellow-eyed flower, sometimes a 3-px bud, a diagonal one or a large one). Nearer background oaks (h 35–90) get 2–3 px sprigs; distant ones single-pixel buds. Placement is patchy (a coarse noise decides where the crown is in bloom) and each flower keeps its own random elbow room, so it neither clumps nor looks like a grid. The foreground oak is kept fairly sparse (owner). Tone (±1) and occasionally the other shade vary per flower.
  - Many multicoloured wildflowers in the foreground (~90, across nearly the full width; pink, yellow, white, violet, blue, red `fr` and orange `fo`).
  - In every season, foreground flowers (and autumn's fallen leaves) are scattered over the whole ground strip, from just below the grass line to the bottom edge. The specks scattered across the field (`meadow()`, also autumn's fallen leaves) only appear in the nearer part of the field, thinning toward the middle, since far back they'd be too small to see.
  - 1.7× the clouds, with a greyer sky and greyer clouds.

**Motion:**

- **Load-in:** the forest starts zoomed in 1.8× on its bottom middle and eases out (cubic, 1.6 s) to its real size. `zoom` multiplies `S` in `fit()`, and the front is rebuilt for each size, as on resize. Skipped with reduced motion.

- The sky's motion runs even with reduced motion on (owner's choice). Only the card's drop-in respects `prefers-reduced-motion`.
- Animation pauses while the tab is hidden.

## Time panel (easter egg)

- **Opening and hiding:** double-click (or double-tap) the portrait or name to open it, and again to hide it (there's no close button; Escape also hides it). The panel slides down from the top edge into the top-left corner. `card.js` tells single from double clicks (300 ms window) and fires `card:dblclick`, which `timepanel.js` listens for. `touch-action: manipulation` on both stops a double tap from zooming the page.
- **Controls:**
  - pixel clock (Jersey 10 digits baked to paths);
  - time slider;
  - season button (cycles spring → summer → autumn → winter);
  - dice (new random forest; keeps season and time);
  - reset (real time and real season).
  - Hiding slides it back up off the top edge, stepped like the way it came in (`tp-up`, its own keyframes so the animation restarts).

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

- **Winter oak (`bare()`/`bareShape()` in `js/forest/draw.js`)** — being iterated with the owner. It follows the ternary branching model from *The Algorithmic Beauty of Plants*, ch. 2, fig. 2.8a (owner's pick; 2.8d is the next candidate). Earlier sympodial (2.7) and monopodial (2.6c) versions were rejected.
  - Productions: ω: !(1) F(200) /(45) A; A → !(vr) F(50) [&(a) F(50) A] /(d1) [&(a) F(50) A] /(d2) [&(a) F(50) A]; F(l) → F(l·lr); !(w) → !(w·vr). Older segments keep elongating and thickening, so a segment made at step s ends up 50·lr^(n−s) long and vr^(n−s+1) wide (vr = √3, so a stem's cross-section equals its three branches').
  - 2.8a constants: d1 94.74°, d2 132.63°, a 18.95° (+0–6° per tree), lr 1.109, vr 1.732, tropism T straight down with e 0.22 after every F. Small per-tree and per-segment jitter.
  - The turtle runs in true 3-D (H/L/U frame) and is projected onto the picture, so each fork shows one, two or three branches of similar size (owner's observation of the figure).
  - n is 6 in the book; here it's scaled to crown size (2–5; 5 for the foreground oak), because at pixel scale more steps merge into a solid brown mass and turn small background oaks into blobs.
  - The tree branches low (owner): the plain trunk ends at ~28% of height and the first stem (the top of the trunk) is 30% shorter than the model gives. Widths are scaled so the first stem matches the trunk. Lengths are scaled so the tree reaches the summer crown's top; the branches may spread up to 1.35× the leafy crown's width so a low split doesn't shrink the tree. The foreground oak's first roll is picked so its first branch leans toward the screen's middle (`inward`).
  - To keep trees "standard" (owner saw odd ones), the first fork's roll isn't random: of 24 candidates, the one whose three limbs spread widest across the picture and balance left/right wins (plus the `inward` lean on the foreground oak).
  - Segments are rasterised oldest first. A limb (≥ 2 px) that would run into another limb is cut there and tapers to a point. The first three widths of a branch may overlap freely, since sisters leave a fork only ~20° apart and cutting there left odd stubs at the trunk top. Each branch segment tapers into the next width, so nothing steps down suddenly.
  - Thin wood: the last generation is kept short (×0.55), so 1 px wood never runs on for long. Widths render monotonically (1 px below 1.3, 2 px up to 2.4, round stamps above), so a branch never looks thicker than its parent.
  - Shapes are cached per crown, so resizing doesn't regrow them.
  - 2.8d constants, if the owner wants to try it: d1 180°, d2 252°, a 36°, lr 1.07, T (−0.61, 0.77, −0.19), e 0.40, n 6.
