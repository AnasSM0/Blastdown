# Cinematic renderer

A second board renderer, drawing the whole playfield into one Skia canvas
instead of into several hundred React Native views. It ships alongside the
original renderer behind a feature flag and is **not yet device-tested**.

Visual target: `docs/current game images/reference_gif.gif` — a recessed sci-fi
board, dark textured cells, luminous beveled blocks, glowing numerals, impact
feedback and energetic clears.

## Status

|                     |                                                               |
| ------------------- | ------------------------------------------------------------- |
| Branch              | `feature-cinematic-board-renderer`                            |
| Flag                | `EXPO_PUBLIC_CINEMATIC_BOARD`, default **off**                |
| Local verification  | typecheck, lint, format, full jest suite — all green          |
| Device verification | **none.** No Android device, SDK or JDK on this build machine |
| Merge readiness     | **not ready.** See "What is unverified" below                 |

Nothing in this document was observed running. Every visual claim describes what
the code draws, not what a phone showed.

## Why a canvas

The React Native board renders 64 `GridCell` views, each with its own layout
pass, its own props, and — for the animated ones — its own entry in the native
animation driver. Each cell can carry a block surface, a contour, a preview, a
highlight ring or a rubble surface as children. A turn that clears two lines
touches most of them.

A canvas changes the unit of work. One view, one layout, one draw pass, and a
static board baked into a cached picture that a placement does not invalidate.

It also removes an entire class of Android bug rather than working around it.
Both hazards this project has hit on device — the rounded-view-on-a-hardware-
layer black render, and the RN 0.86 Fabric assertion on a removed `transform` —
are properties of _native views carrying animated style props_. Inside a canvas
there are no views and no style props, so neither can occur. The React Native
renderer keeps its guards; see `src/ui/motionKey.ts` and
`__tests__/integration/fabricPropStability.test.tsx`.

## Architecture

```
game state ──► buildBoardScene ──► BoardScene ──► CinematicBoardCanvas
   (domain)      (pure adapter)     (immutable)     (Skia layers)
                                          │
                                          └──► CinematicBoard
                                               (RN touch + a11y overlay)
```

**`src/rendering/cinematic/`** — everything that draws.

| Module                     | Role                                    |
| -------------------------- | --------------------------------------- |
| `types.ts`                 | The `BoardScene` contract               |
| `scene.ts`                 | Pure game state → scene                 |
| `geometry.ts`              | Board box model, reproduced exactly     |
| `palette.ts`               | Theme → canvas colours, all derived     |
| `boardPicture.ts`          | The static board as a pure command list |
| `CinematicBoardCanvas.tsx` | The single `<Canvas>`                   |
| `layers/*.tsx`             | One layer per depth band                |
| `effects/effectScene.ts`   | Pure effect plan → timed primitives     |

**`src/components/CinematicBoard/`** — the React Native wrapper: the canvas plus
the touch and accessibility layer, and the font fallback.

**`src/config/renderer.ts`** — the flag.

### Three rules the design is built on

**1. The scene is pure, immutable, and carries no motion.**

`buildBoardScene` is a function of its inputs: every colour resolved, every
rectangle in canvas pixels, nothing left to look up. Animated quantities are
Reanimated shared values living outside it. If a per-frame value lived in the
scene, the scene object would be rebuilt sixty times a second and React would
re-render with it — the exact cost the renderer exists to remove. The scene
changes when the _game_ changes.

**2. No logic lives inside the canvas.**

Skia draws nothing under jest, so nothing inside `<Canvas>` runs under test.
Rather than fight that, the design obeys it: everything deciding _what_ to draw
is a pure module outside the canvas and is tested directly. The canvas subtree
turns a description into draw calls and makes no decisions. See
`test-utils/skiaMock.tsx`.

**3. Drawing moved; interaction did not.**

A canvas is one view to the platform — one accessibility node, one touch target.
64 transparent `Pressable`s sit over it carrying the same labels, hints, roles
and testIDs the `GridCell` renderer exposes, plus one node per timer badge.

This is not a compromise, it is a requirement. `docs/GAME_RULES.md` makes
tap-to-select then tap-to-place the accessibility fallback for placement, and
`docs/ACCESSIBILITY.md` treats the per-cell labels and validity-aware hints as
shipped behaviour. Those overlay views never animate, hold no `Animated.Value`,
bind no transform, and re-render only when the grid or the selection changes —
so they are not the "64 animated views" the performance rules were written
against.

## Parity

The two renderers must look different and behave identically. That is enforced
three ways.

**Shared helpers, not copied ones.** The scene adapter calls the same functions
`GameBoard` calls: `blockSurface`, `getBadgeVisual`, `getRubbleGeometry`,
`contourMaskOf`, `getTimerVisualState`. There is no second definition of a
critical block that could drift from the first. Both renderers also share one
props type (`boardProps.ts`) and one cell-label module (`cellLabel.ts`).

**Reproduced geometry.** Dragging maps finger coordinates to cells through
`src/ui/boardGeometry.ts`, not through anything the renderer draws. A canvas on
a slightly different lattice would put the visible board out of step with where
pieces actually land — a rendering change becoming a gameplay bug.
`cinematicGeometry.test.ts` asserts the round trip at six board widths: a point
inside the drawn rect for cell (r, c) maps back to cell (r, c).

**Behavioural comparison.** `cinematicParity.test.tsx` mounts both renderers on
identical state and compares every cell label, every placement hint, the press
surface, the badge nodes, and the reported cell size.

One value is redeclared rather than shared: the block sheen (top 45%, opacity
0.22) is a percentage string in a React Native `StyleSheet` and a number in
Skia. A test reads both files and pins them together.

## What the canvas draws

**The board.** A recessed frame — a lit rim along the top inner edge, a sunk
shadow along the bottom. Light from above is what reads as "sunk in"; reversing
the two reads as a raised panel, the wrong illusion for a board pieces drop
into. Beneath it an etched hairline grid, the empty cells, and scanline ambience
across the playable area only, at a pitch chosen not to beat against the cell
lattice.

All of it depends on `(geometry, palette)` alone, so it is emitted as a pure
command list, cached, and replayed into one Skia `Picture` — roughly two hundred
draw calls collapsed into one, rebuilt only on resize or theme change.

**Blocks.** Five cheap draws: glow halo, solid body, the sheen, a top-left bevel
highlight, a bottom-right depth shadow, the saturated outline. The halo is a
blurred copy of the block rather than a per-cell blur filter — blurring 64 cells
individually is the most expensive thing a renderer like this can do, and buys
nothing. Hue never changes with state: "critical" arrives as a heavier edge and
stronger glow, already resolved upstream.

**Rubble.** No accent, no glow, no bevel — the three things every block has — so
it differs by material rather than by colour, and therefore also for a player
who cannot separate the hues. Crack layout is the same deterministic preset
table the React Native renderer uses.

**Previews.** Valid is a solid accent edge; invalid and conflict are the danger
hue with a **dashed** edge. The dash is the non-colour half of the signal.
Previews draw above blocks, because a conflict _is_ an overlap and the ghost has
to be visible over what it collides with.

**Numerals.** Always the number itself. The badge ring's colour, weight, dash
and size are emphasis layered onto information already legible without them.

**Effects.** `effectScene.ts` turns an authoritative `EffectPlan` into timed,
positioned primitives — sweeps, flashes, rings, bursts, floating score — capped
by the same `MAX_BURST_CELLS` budget the React Native overlay respects. Every
primitive is anchored on cells the engine already committed, which is what makes
capping safe: dropping one costs a flourish, never information.

## Themes

Every cinematic tone is derived from the active theme, never authored. Lifting a
theme's frame colour toward white produces the rim; sinking it toward black
produces the recess shadow. So Reactor, Arctic, Magma, Void and Solar all gain
the recess, rim, ambience and vignette without new tokens, and a sixth theme
would be correct by default rather than correct only if someone remembered to
extend a table. A test walks all five and asserts no canvas colour is left
undefined — Skia would draw that as transparent black, an invisible failure on a
dark board rather than a loud one.

## Reduced motion

Handled in the model, not the canvas, so there is exactly one place it is
decided. Under reduced motion, travelling sweeps, staggers, debris throw, text
rise and the board shake all go to zero, and each beat is shortened — a static
emphasis that lingers reads as a stall rather than as feedback.

What does **not** go: the event itself. A cleared line still flashes, expiry
still shows its rubble, a defuse still pulses, a revive still reads as
restoration. `docs/ACCESSIBILITY.md` is explicit about this, and removing the
signal rather than the movement would make the board less legible for exactly
the players the setting exists to serve.

## Android safety

- No rounded React Native view with `overflow: hidden` was reintroduced. All
  clipping is inside the canvas.
- No conditional removal of a native-driven `transform` prop was added. The
  overlay views bind no transform at all.
- The structural guards from the Fabric crash fix are intact and still tested.
  The cinematic renderer does not weaken them: while the flag is off, the React
  Native renderer is the one that runs.

## The flag

`EXPO_PUBLIC_CINEMATIC_BOARD`. `1`, `true` or `skia` opts in; anything else —
unset, empty, `0`, `yes`, `on`, a misspelling — keeps the React Native renderer.

It is deliberately **not** "on in development, off in production". A renderer
that differs between the build you test and the build you ship is how an
unverified path reaches a player. Device QA must therefore set the variable
explicitly and rebuild.

## What is unverified

Everything visual, and this is the important section.

The coverage numbers say it more precisely than prose can:

| Area                                                            | Statements |
| --------------------------------------------------------------- | ---------- |
| `rendering/cinematic` (scene, geometry, palette, board picture) | 96%        |
| `rendering/cinematic/effects` (the effect model)                | 100%       |
| `components/CinematicBoard` (the React Native wrapper)          | 87%        |
| **`rendering/cinematic/layers` (everything inside the canvas)** | **2%**     |

That last row is not a gap to close on this machine — it is the shape of
the problem. Those components live inside `<Canvas>`, which renders null under
jest, so they never mount. The design puts every decision outside them for
exactly that reason, which is why the modules that decide what to draw sit at
96–100% while the modules that draw it sit at 2%. The 2% is a device question,
and no amount of local testing converts it into anything else.

Skia draws nothing under jest, so no local test has seen a single pixel of this
renderer. Specifically unverified:

- **That it looks right at all.** Every colour, blur radius, bevel weight and
  stroke width is an informed guess against the reference GIF.
- **Frame rate.** No measurement was taken, so "faster than 64 views" is an
  argument from structure, not a benchmark. It could be slower — a Skia canvas
  has its own overhead and the block layer draws several primitives per cell.
- **Drag responsiveness** against the Phase 2 baseline.
- **Skia's runtime shape.** `npm run typecheck` proves the names exist; nothing
  proves `measureText`, `BlurMask`, `DashPathEffect` or `createPicture` behave
  as assumed on Android.
- **The font path.** `useFont` may fail on device, in which case the text
  fallback mounts. Neither branch has run.
- **`StyleSheet.hairlineWidth`** is density-dependent; the canvas uses a fixed
  1px stroke where the React Native frame used a hairline. They may differ
  visibly at high density.
- **Memory** over a long session, and behaviour across background/resume.

Until a physical Android phone has run both a development and a
release/profile build, the flag stays off and this branch does not merge.

## Known deviations from the brief

**The drag ghost is not in the board canvas.** It travels from the tray, across
the screen, to the board and back — the whole gameplay viewport. A Skia canvas
cannot draw outside its own view bounds, so a board-sized canvas would clip the
ghost the moment it left the board. The existing React Native `DragGhost`
therefore still runs under both renderers. Two workable answers exist — a second
root-level canvas for the ghost, or one viewport-sized canvas with the board
translated into it — and neither should be chosen without measuring on a device
first. Recorded in `docs/DECISIONS.md`.

**The renderer branch carries the Fabric crash fix.** The brief said to branch
from master, and master predates that fix; it also said to maintain the fix's
structural guards. The rendering half of the fix was ported (commit `1b816ad`),
without any ads or consent code. Both branches now hold byte-identical versions
of every file involved.

## Two defects found in review

Both were caught by the stop-time review, not by any test here, and both are
worth recording because of what they say about where this renderer's blind
spots are.

**The shake never shook.** The board-shake worklet mutated one module-level
array in place and returned it every frame, to avoid allocating. But
`useDerivedValue` assigns its result to a shared value, and assigning the same
object identity emits no change — so the board jumped to the first frame's
offset and froze there for the rest of the sequence. Nothing local noticed:
Skia draws nothing under jest, the component still rendered, and every other
test stayed green. The allocation being avoided was one two-field array per
frame; the cost of avoiding it was the whole effect.

Fixed by returning a fresh array, and by pulling the curve out into an exported
pure function (`shakeOffset`) so the part that can be wrong is the part that can
be checked. `cinematicShake.test.ts` now pins that it starts still, moves,
swings both ways, decays, stays within amplitude, ends well before the sequence
it rides on, and is exactly zero at every instant under reduced motion.

**The flag did not isolate Skia's initialisation.** `app/game.tsx` imported the
cinematic board at module scope, and `@shopify/react-native-skia` installs its
native JSI bindings when the module is EVALUATED — which is why importing the
real package under jest throws rather than failing later. So Skia initialised at
app startup even with the flag off.

That is precisely the job the flag exists to do. The fallback renderer is meant
to be the thing that rescues a build when the new path is broken; if Skia cannot
initialise on some device, turning the renderer off has to actually help, and it
would not have. The flag isolated rendering while leaving initialisation
unconditional — a safety net with a hole in exactly the shape of the accident it
was meant to catch.

Fixed by resolving the renderer in `src/rendering/boardRenderer.ts` through a
require guarded by the build-time flag. With the flag off the cinematic graph —
Skia, Reanimated, the canvas layers — is never evaluated at all, and the app
runs the same code it ran before this renderer existed.
`rendererIsolation.test.ts` exercises both branches of the resolver at runtime
and enforces the structural rules that keep Skia out of the startup path: no
static cinematic import in the screen, no Skia or Reanimated import there, and
no Skia import anywhere in `src/` outside the two directories the flag gates.

## Performance pass (2026-07-28)

The first device test found this renderer visually correct and noticeably laggy.
`docs/CINEMATIC_PERFORMANCE.md` records the causes, the fixes and the counts.

The headline: the renderer applied a blur mask per cell — an offscreen render
pass each, up to ~80 simultaneously during a full-board clear — and gave every
effect primitive four to eight per-frame worklets. Both are fixed, and both are
now guarded by tests, because both regressed silently and neither was visible
from a build machine.

Two visual deltas are deliberate and are not bugs: block halos blend where
blocks touch (they are drawn under one grouped blur now), and clear flashes have
hard rather than soft edges.

The "What is unverified" section above still stands in full, and now has a
companion: no frame time has been measured before or after.
