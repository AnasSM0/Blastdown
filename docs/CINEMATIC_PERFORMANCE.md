# Cinematic renderer performance

Why the Skia board was slow, what changed, and what is still unmeasured.

## Status

|                     |                                                                               |
| ------------------- | ----------------------------------------------------------------------------- |
| Branch              | `fix-cinematic-renderer-performance`                                          |
| Reported symptom    | "cinematic visuals and animations work, gameplay has become noticeably laggy" |
| Profiling method    | **static analysis only** — see "What was not measured"                        |
| Device measurements | **none, before or after**                                                     |
| Bug inventory       | **empty** — no reproducible bug was reported                                  |

## What was not measured

This is the first section on purpose.

No frame times were captured, before or after. This build machine has no
Android device, no Android SDK and no JDK, so nothing here rests on a profiler
trace. What it rests on is counting: how many offscreen render passes a frame
asks for, how many worklets run per frame, how many objects a pointer move
allocates. Those counts are facts about the source, and the reductions below are
arithmetic rather than measurement.

That is enough to be confident the changes point the right way, and not enough
to claim a specific improvement. **"Faster" is a prediction until the phone
agrees.**

Also missing, and requested by the brief: device model, Android version, build
type, reduced-motion state, and exact reproduction steps. None were supplied.
The bug inventory is therefore empty rather than invented — "several bugs
remain" is not a bug report, and the brief's own rule is not to claim or fix a
bug without reproduction evidence.

## Root causes

Ranked by expected impact. The first two are mine, introduced while writing the
renderer, and one of them was introduced _by a commit labelled a performance
improvement_.

### 1. A blur mask on every cell

`BlocksLayer` gave each block its own `<BlurMask>` for its bloom. A blur mask is
an offscreen render pass, so a full board asked for up to **64 offscreen passes
per frame**. On a tiled mobile GPU, memory-bandwidth-bound, that is close to the
worst thing this renderer could do.

The comment above it claimed the halo was "a blurred copy of the block rather
than a per-cell blur filter". That is not a distinction — it was a per-cell blur
filter, and the comment made it read as a considered choice.

**Fixed on the third attempt.** The first two both looked right and did
nothing, and the sequence is the most useful thing in this document:

1. **A `<BlurMask>` on every block.** One offscreen render pass per cell, under
   a comment claiming it was not a per-cell blur.

2. **The same `<BlurMask>` moved into a shared parent `<Group>`.** This reads as
   grouping and is not. In React Native Skia a mask filter on a Group becomes
   part of that Group's paint, and every child draws _with_ it — so the cost was
   completely unchanged. Only the source looked different.

3. **`<Group layer={paint}>` with a MASK filter on the paint.** The `saveLayer`
   really happened, but Skia composites a layer using only the paint's alpha,
   colour filter, **image** filter and blend mode. A mask filter acts on the
   coverage of a geometry draw and is ignored at restore. This paid for an
   offscreen surface _and_ drew crisp halos — strictly worse than the bug it
   replaced.

What ships is `<Group layer={paint}>` with an **image** filter
(`Skia.ImageFilter.MakeBlur`, `TileMode.Decal`), which is one of the four things
that do survive the composite. One blur for the whole bloom, independent of cell
count. `useBloomPaint` builds it; blocks and badges share it.

Each of the first two attempts was certified by a guard test that scanned source
text — see "Guards" for how that test was rewritten to ask the paint instead.

### 2. The "performance fix" that made it worse

Commit `d652236` replaced the flash effect's two stacked rects with one rect
carrying a `BlurMask`, reasoning that the lower rect was pure overdraw. It was.
But the replacement traded 64 cheap rect draws for **64 offscreen passes**, on
top of the 64 the block layer was already doing.

Counting the sweeps, a full-board line clear was asking for roughly **80
simultaneous blur masks**; with defuses in the same turn the audit put the
code-level worst case past 200.

**Fixed:** effects use no blur at all. A flash is a bright rounded rect that
fades — at 40 px it does not need a soft edge, and softness that costs a render
pass per cell is not worth having.

### 3. ~470 worklet evaluations per frame

Each effect primitive owned four to eight `useDerivedValue` callbacks watching
the same clock:

| Primitive     | Before | After |
| ------------- | -----: | ----: |
| Sweep         |      5 |     2 |
| Flash         |      6 |   1–2 |
| Ring          |      3 |     2 |
| Burst         |      8 |     2 |
| Floating text |      3 |     2 |

A full-board clear ran ~470 callbacks per frame on the UI thread, while the
gesture handler and Skia competed for the same budget.

**Fixed:** every primitive animates a group's `transform` and `opacity` instead
of its own edges or its own circle centres. Debris specks sit at fixed offsets
inside a group that travels, rather than each animating its own position — for
debris this is indistinguishable.

### 4. The whole board re-composited during effects that do not shake

The shake transform was bound to the `<Group>` wrapping the **entire board**
whenever the effect clock ran. A line clear, a defuse and a revive do not shake,
but all three drove an animated transform over the cached static picture, every
block, all rubble and all numerals for their whole sequence.

**Fixed:** the transform binds only while a shake is actually playing. The
`Group` stays in the tree either way — conditionally wrapping would change the
tree shape when a shake starts, remounting every layer and rebuilding the cached
picture, which trades one problem for a worse one.

### 5. A drag rebuilt the whole board

`handleDragMove` already gated React updates on the anchor changing (a Phase 2
optimization, correctly preserved). But when the anchor _did_ change, the whole
64-cell scene was rebuilt: every block material, every badge visual, every
rubble crack layout — then every layer got new array identities and Skia
reconciled all of it. For a change affecting about four cells.

**Fixed:** `buildPreviewCells` builds the ghost separately, and every layer is
memoized. A drag now rebuilds four cells; the block, rubble and numeral layers
skip on a shallow comparison. The scene also stopped building 64 empty-cell
objects the canvas never read — empty cells live in the cached picture.

### 6. Smaller costs

- `shapeBoundsFor` ran on **every pointer move**, allocating two intermediate
  arrays and a bounds object for a value that is constant per shape. Now cached;
  the catalogue is ~12 shapes, so it never needs clearing.
- Numerals called `measureText` twice per badge per render, for the same string.
- The debris budget was enforced with `return` inside a `forEach` callback,
  which skips one cell rather than stopping. An exhausted budget kept walking
  every remaining cell of every remaining explosion.
- Sweeps, defuse flashes and rings were uncapped in the renderer.

## Before and after, by count

Worst realistic turn — a full board clearing every row and column, with defuses
and an explosion:

|                                              |                Before |                 After |
| -------------------------------------------- | --------------------: | --------------------: |
| Offscreen blur passes per frame              | ~80 (200+ worst case) |                 **2** |
| Derived callbacks per frame                  |                  ~470 | ~160 primitives × 1–2 |
| Board recomposited during a non-shake effect |           every frame |                 never |
| Scene rebuild on a drag anchor change        |              64 cells |               4 cells |
| Unused scene objects per rebuild             |                   128 |                     0 |
| Allocations per pointer move                 |  ~5 objects, 2 arrays |            ~3 objects |

Steady state, full board of glowing blocks: **1 blur pass** instead of 64.

Both "after" figures depend on the `saveLayer` and its image filter behaving on
device as the API describes. That has now been got wrong twice from this
machine, so it is worth stating bluntly: if the composite does not blur, the
numbers revert to the "before" column and the board also loses its bloom
entirely. This is the single most valuable thing for device QA to eyeball —
**do the placed blocks still glow?**

## Guards

`__tests__/rendering/cinematicGpuBudget.test.ts` enforces the invariants these
fixes depend on, because every one of them regressed silently once:

- **The bloom paint is built for real and inspected.** It must carry an image
  filter and must not carry a mask filter — the distinction that decides whether
  the bloom exists at all. The jest Skia mock records what each paint is given,
  which is what makes this checkable without a device.
- No declarative `<BlurMask>` anywhere in the canvas layers: that form cannot
  express a single pass over many shapes, wherever it is placed.
- No blur of any kind in the effects layer.
- Sweeps, flashes and rings capped, tested with deliberately impossible plans
  (40 cleared rows on an 8×8 board, 80 defuses).
- The debris budget stops the traversal, not just the emission — 12,800 cells
  offered against a 24 budget must finish fast.
- A worst-case turn stays under 160 animated primitives.

The guards strip comments before scanning — an early version fired on the
renderer's own documentation, which quotes the syntax it bans.

The more important lesson is why the blur guard was rewritten twice. Both
earlier versions matched source patterns, and both certified a bloom that did
not exist: first `<BlurMask>` moved into a parent Group, then a mask filter on a
`saveLayer` paint. A test that checks the shape of the code will agree with the
code. Asking the constructed paint what it carries is the first version that
could have caught either failure.

## Remaining bottlenecks

Known, not fixed, and each with a reason:

- **The cached board is a `Picture`, not a raster.** A `Picture` is a recorded
  display list; nothing guarantees it becomes one GPU texture. Rasterizing it to
  an offscreen image would make the static board genuinely free, at the cost of
  a re-raster on resize and theme change. Worth doing only if the device says
  the board is still the bottleneck — it is a real complexity increase.
- **Effect components stay mounted for the whole sequence.** A primitive whose
  window has passed still evaluates its worklets until the plan is cleared.
  Unmounting on completion would need per-primitive state, which costs React
  work to save UI-thread work — the wrong trade at these counts, but worth
  revisiting if a turn ever mounts many more.
- **Block geometry is rebuilt on every board render.** Bevels, contours and
  colour strings are recomputed per block. This is per render, not per frame,
  and renders are now rare — but it is the next thing to attack if placement
  still feels heavy.
- **`empties` is gone but `cellRect` still runs for every occupied cell** on
  each rebuild. Cheap, and correct to keep while geometry can change.

## What device QA has to answer

None of the above is confirmed. The acceptance list, unchanged from the brief:

- drag stays under the finger
- no visible board stutter during preview
- placement feels immediate
- line clear and expiry do not freeze input
- ten minutes of repeated effects does not degrade
- no memory or listener growth
- no black or invisible tiles
- no Fabric crash
- the fallback build is unaffected
- reduced motion ON and OFF both behave

Two visual deltas are deliberate and should be sanity-checked rather than
reported as bugs: block halos now blend where blocks touch, and clear flashes
have hard rather than soft edges.

## The device procedure (2026-07-31)

The acceptance list above was, until now, a list of things to look for while
playing. That is not a procedure. Half the claims the effect queue makes cannot
be reached by playing at all without waiting for the board to produce a double
clear plus two expiring timers on the same turn, and the other half — "the
survivor did not restart", "the seventh effect evicted the first" — cannot be
judged by an unaided eye even when they do happen.

So there is now a scripted harness and a diagnostics readout, both
development-only.

### Reaching the harness

1. Build or start a **development** build (`npx expo start`, or an
   `eas build --profile development` install). `__DEV__` must be true; a preview
   or store build has no harness in it — see below.
2. Settings → **EFFECT HARNESS (DEV)**. The route is `/dev-effects`, reachable
   directly if you prefer.
3. Run the same procedure twice: once on a build with
   `EXPO_PUBLIC_CINEMATIC_BOARD` unset (the React Native renderer) and once with
   `EXPO_PUBLIC_CINEMATIC_BOARD=1` (the cinematic renderer). The harness mounts
   whichever board the flag resolved, so both runs exercise the shipped path.

Outside a development build the harness is **absent**, not disabled:
`resolveEffectHarness()` returns `null`, the settings row is not rendered
because the route never supplies its callback, and Metro removes the screen's
require so the module leaves the graph. `/dev-effects` renders an empty screen
backed by no code.

Verified by grepping the exported Android bundle rather than asserted — the
first two versions of that gate both returned `null` correctly in production and
shipped the harness anyway. `docs/CINEMATIC_RENDERER.md` has the mechanism.

### The scenarios, and what each proves

Each button plays a fixed script through the same pipeline gameplay uses — a
turn counter plus that turn's `GameEvent[]` into `useEventAnimator`, plus
`playCue` and `reset`. Steps land one frame apart. The harness cannot fabricate
an effect, stamp a start time or touch a renderer, so anything it shows is
something delivery genuinely produced.

| Scenario                    | What must happen                                                                                          |
| --------------------------- | --------------------------------------------------------------------------------------------------------- |
| Placement only              | The board snaps. **Nothing is queued** — a plain placement has no required sequence. Queue depth stays 0. |
| One line clear              | Row 3 sweeps left to right, once. Input unlocks when it ends.                                             |
| Row + column together       | Row 3 sweeps across while column 5 sweeps down, as one effect. The intersection lights once.              |
| Two clears, back to back    | Two clears run side by side. Neither restarts the other; the first is not cut short.                      |
| Clear + defuse              | Row 2 sweeps and the defused piece flashes on **its own footprint**, not the line's midpoint.             |
| Clear + explosion           | Both play, then the board shakes. The clear is not replaced by the burst. Priority reads `critical`.      |
| Two explosions at once      | Two bursts, in event order, each over its own rubble. One shake.                                          |
| Six rapid effects           | Six clears visible at once. Queue depth 6, drawn 6. This is the cap.                                      |
| Seventh effect (eviction)   | Seven arrive, six remain, and the **first** is the one that goes. Evicted 1, dropped 0.                   |
| Rewarded cue under pressure | The cue is admitted first and still survives six clears. A `critical` effect outranks ordinary churn.     |
| Lower effect retires first  | The 340ms clear ends while the 400ms cue runs. The cue must **not** jump back to its start.               |
| Restart mid-effect          | Everything vanishes at once; the board is usable immediately. Generation increments, nothing lingers.     |
| Session change mid-effect   | The clear after the restart plays normally under the new generation.                                      |

### Reading the diagnostics overlay

The panel sits above the scenario buttons and refreshes four times a second — it
polls a plain-JavaScript ledger rather than re-rendering per effect, so it does
not distort the frames it is measuring.

| Field           | Meaning                                                                                                                                   |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `queue`         | Live effects right now. Never above 6.                                                                                                    |
| `drawn`         | How many of those a renderer has reported drawing.                                                                                        |
| `accept`        | Admissions the queue took.                                                                                                                |
| `started`       | First-draw reports received. Must equal `accept` once everything has drawn — a **larger** number means an effect restarted.               |
| `done`          | Effects that finished their lifetime.                                                                                                     |
| `evict`         | Effects dropped to stay under the cap.                                                                                                    |
| `drop`          | Admissions **refused** — a duplicate id, or one aimed at a generation the player had left.                                                |
| `gen`           | The current run generation, and how many times a session has been cleared.                                                                |
| `renderer`      | `skia` or `views`. Confirms which build you are actually testing.                                                                         |
| `waiting`       | Age of the oldest effect not yet drawn. Settling means a slow frame; **climbing** means the renderer is not reporting at all.             |
| `latency`       | Last / worst enqueue-to-first-draw, in ms.                                                                                                |
| per-effect rows | `id · type · priority · slot · latency`. `slot` is the leased cinematic clock; `-` on the React Native renderer, which has no clock pool. |

Three readings and what each means:

- **`accept` climbs, `started` does not.** The queue is admitting and the
  renderer is not drawing. `waiting` will be climbing with it.
- **`started` exceeds `accept`.** An effect is being re-reported, which means it
  remounted — the exact fault the leased clock slots exist to prevent. Check
  whether two rows share a `slot`.
- **`drop` climbs.** Admissions are being refused. Almost always a duplicate id
  or a stale generation; neither is a rendering problem.

### The measurement that is still missing

Still no frame time, before or after. The harness proves delivery — that six
effects exist, draw once each, and retire independently. It says nothing about
what they cost. A trace remains the only way to answer that, and the branch does
not merge on this evidence alone.
