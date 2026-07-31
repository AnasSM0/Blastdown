# Animation Spec

> **Phase 0 audit status (2026-07-21).** Implementation reality: **all motion
> uses React Native `Animated`, not Reanimated** (single animation system; no
> `react-native-reanimated` imports — `DECISIONS.md` 2026-07-20). Read
> "Reanimated" below as "RN `Animated`". Reduced-motion gating is **implemented**
> and threaded through every effect via `useReducedMotion` /
> `useEffectiveReducedMotion` (the mandatory-gating section below is satisfied).
> Currently implemented beats: timer-badge pulse (`TimerBadge`), placement snap
> (`GridCell`), explosion shake (`GameBoard`), line-clear/defuse/explosion/rubble
> via `useEventAnimator` + `src/ui/effects/eventEffects.ts` + `EffectsLayer`
> (`CellFlash`/`PulseRing`/`BurstCell`/`FloatingText`), second-chance banner,
> drag ghost. UI Polish **Phase 2** (not Phase 1) refines motion feel; Phase 1 is
> static-surface polish only.

Timing/easing values extracted from the `@keyframes` blocks in the approved
Stitch screens (`docs/references/ui/stitch-mcp/`), translated to
Reanimated. `BUILD_SPEC.md` §12.2 and §18 govern what may animate and how
cheaply — this document supplies _how it should look_, not license to add
motion beyond what the spec calls for.

All durations/easings below are extracted as reference, not literal
CSS-to-Reanimated ports — implement with `withTiming`/`withSequence`/
`withSpring` as appropriate, matching the _feel_, not replaying the exact
CSS keyframes.

## Reduced motion — mandatory gating

Only one source screen (`04-defuse-animation`) gates its animations behind
`@media (prefers-reduced-motion: no-preference)`; the rest don't model
reduced motion at all (audit finding). **This must not carry over** —
`BUILD_SPEC.md` §19 requires a reduced-motion toggle, and it must gate
_every_ effect below uniformly. Implementation pattern: a
`useReducedMotion()` hook reading the persisted settings value; every
Reanimated animation either skips to its end state instantly or plays a
strictly simplified version (e.g. opacity-only, no scale/rotate/particles)
when reduced motion is on. No flashing effect is permitted regardless of
the setting (`BUILD_SPEC.md` §19 "no flashing effect that creates
accessibility risk").

## Timer badge states

| State         | Source                                                                                                    | Behavior                                                                                                                     | Duration                                                                                                          |
| ------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Normal (7–5)  | —                                                                                                         | Static, no animation                                                                                                         | —                                                                                                                 |
| Caution (4–3) | `03-critical-countdown` (amber cells, no pulse)                                                           | Static amber tint, no animation                                                                                              | —                                                                                                                 |
| Warning (2)   | `15-tutorial-countdown` `subtle-pulse`                                                                    | Glow breathes 12px→20px and back (box-shadow blur radius), ease-in-out                                                       | 2s, infinite loop                                                                                                 |
| Urgent (1)    | `03-critical-countdown` `pulseWarning`, `14-tutorial-defuse` `pulseRed`                                   | Glow intensifies (inset+outer shadow) and back, using the `urgentRed` color (pending decision, `docs/STYLE_GUIDE.md` item 8) | 1–1.5s, infinite loop, plus a stronger haptic pulse on each cycle start (not just once) per `BUILD_SPEC.md` §6.11 |
| Explosion (0) | `04-defuse-animation` `crackAndShrink`/`showCrack` (defuse variant; explosion is the failure-path analog) | See "Explosion sequence" below                                                                                               | ~0.6s                                                                                                             |

Reduced-motion equivalents: Warning/Urgent states show a static
higher-contrast badge (no pulsing glow) instead of looping animation;
numeral remains fully legible either way (never rely on the pulse alone —
`BUILD_SPEC.md` §6.11 "never rely on color alone").

## Defuse sequence (successful clear of a timed piece)

Source: `04-defuse-animation`, `05-defuse-success`. This is the richest
animation reference in the snapshot — treat it as the template for both
"defuse via line clear" and, with a failure palette swap, the explosion
sequence.

| Stage                      | Keyframe                                                                                     | Timing                             | Effect                                                                                                                                                                                                                                                                                                                                                   |
| -------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Cell illumination       | `sweepIllumination`                                                                          | 0.8s, `cubic-bezier(0.25,1,0.5,1)` | Cell flashes to white-hot at 30%, scales to 1.05, then fades to transparent by 100% — the "about to clear" flash                                                                                                                                                                                                                                         |
| 2. Line sweep              | `rowSweepAnim`                                                                               | 0.7s, ease-in-out                  | A gradient bar translates across the full cleared row/column (−100% → +100% translateX), fading in over the first 10% and out over the last 10%                                                                                                                                                                                                          |
| 3. Badge crack             | `crackAndShrink`                                                                             | 0.6s, ease-in                      | Badge scales 1 → 1.1 (+3° rotate, brightness/saturation spike) → 0.4 (fade out) — plays on the `TimerBadge` itself as it's defused                                                                                                                                                                                                                       |
| 4. Crack overlay           | `showCrack`                                                                                  | 0.6s, ease-in                      | An SVG crack-line stroke draws in (`stroke-dashoffset` 20→0) then holds — a static hairline crack decal that appears with the crack-and-shrink stage, not a separate visual                                                                                                                                                                              |
| 5. Particles               | `dissolveParticleUp` (defuse-in-progress variant) / `dissolveParticle` (post-defuse variant) | 0.8s, `cubic-bezier(0.25,1,0.5,1)` | Small (8×8px) square particles fly outward+upward (defuse-in-progress: `translate(tx, ty−80px)`; post-defuse: `translate(tx, ty)`, no extra upward bias) with a 0.2 scale-down and 90–180° rotation, fading to 0 opacity. Cap particle count per `BUILD_SPEC.md` §18 ("cap explosion particles") — 6–10 particles per piece is enough, not one per pixel |
| 6. Floating score feedback | `floatFeedback`                                                                              | 1.5s, ease-out                     | A "+N" text floats from `translateY(20px)` up to `translateY(-50px)`, scaling 0.8→1.1→0.9, glow peaking at 20%                                                                                                                                                                                                                                           |
| 7. Score bump              | `scoreBump`                                                                                  | 0.5s, ease-out                     | The header score digits scale 1→1.1→1 with an amber flash-to-white-to-amber color cycle                                                                                                                                                                                                                                                                  |
| 8. Combo pulse             | `comboPulseAnim`                                                                             | 0.6s, ease-out                     | The combo indicator scales 1→1.1→1 with a cyan glow flash, plays whenever combo increments                                                                                                                                                                                                                                                               |

Stages 1–5 play together as one "defuse resolves" beat; 6–8 are the score/
combo feedback that follows in the same turn-resolution frame (per the
17-step order, defuse bonus and combo changes are computed before the
explosion phase but the visual beats can overlap slightly for game feel —
don't block input on the full 1.5s float-feedback duration).

## Explosion sequence (piece expires at 0)

No approved screen shows an actual explosion (only the defuse/success
path). Derive from the defuse sequence above with these changes, consistent
with `BUILD_SPEC.md` §6.12:

- Use the `urgentRed`/danger palette (pending `docs/STYLE_GUIDE.md` item 8's
  decision) instead of cyan/success colors for stages 1–3.
- Stage 5's particles represent debris, not "cleared" sparkle — same
  timing/cap, danger palette.
- After the sequence, the affected cells (and up to 4 adjacent empty cells,
  up to 6 total for simultaneous multi-piece explosions per §6.12) settle
  into the rubble visual (`docs/STYLE_GUIDE.md`'s proposed rubble
  treatment), not fade to empty.
- A single screen shake (small, capped translation, ~150–250ms) is
  appropriate per `BUILD_SPEC.md` §12.2's explicit mention of "explosion
  shake" as a named Reanimated effect — keep it subtle enough not to
  trigger vestibular discomfort, and skip entirely under reduced motion.

## Freeze state indicator

Source: `09-freeze-active`. A small pause-icon badge overlays frozen
pieces' cells (`frozen-badge`, `absolute inset-1`), and the Freeze
power-up button shows a filled/glowing "active" treatment with a "N MOVES"
counter label beneath it (`animate-pulse` on the label — a simple opacity
breathe, not a named keyframe). Use a simple `withRepeat(withTiming(...))`
opacity pulse (0.6↔1.0, ~1.5s) for the counter label; the frozen-piece
pause-icon overlay itself should be static (no animation) — it's a status
indicator, not a feedback moment.

## Placement feedback (not separately animated in any approved screen)

`BUILD_SPEC.md` §6.5 requires light haptic feedback on valid placement and
warning feedback on invalid placement. No approved screen shows a distinct
placement animation beyond the static ghost-preview treatment
(`02-invalid-placement`'s dashed/tinted ghost cells). Implement: a brief
(~150ms) scale/opacity settle on the newly placed piece's cells
(`withSpring`, no named source keyframe to match), paired with the haptic
call (`docs/UI_IMPLEMENTATION.md`'s `useHaptics`) — not a Stitch-derived
timing, a game-feel decision for whoever implements Phase 4.

## Home screen decorative floats

Source: `11-home`, `float1`/`float2` keyframes — small glass blocks drift
±20px vertically with slight rotation, 6–8s ease-in-out infinite loops,
staggered start delays. Purely decorative, non-gameplay; skip entirely
under reduced motion (no information is lost by doing so).

## Second-Chance / revive restoration wave

Source: `10-second-chance`, `wave-sweep` — a horizontal light bar sweeps
top-to-bottom across the board (`cubic-bezier(0.2,0,0,1)`, 2s, forwards,
plays once) immediately after a revive is granted, coinciding with rubble
being cleared and timers being boosted. Good candidate for the revive
resolution moment; pair with the existing `rowSweepAnim`-style visual
language rather than inventing a third sweep treatment.

## Phase 2 — interaction motion (implemented, 2026-07-25)

The consolidated interaction-motion pass. Scope is **interaction feedback**
(cause → result), NOT event effects — no explosions, particles, line-clear, or
reward-celebration motion was added (those remain Phase 3). Every beat below is
RN `Animated`, native-driven, within the 100–220 ms band, and removed under the
effective reduced-motion value; no new animation dependency was added.

| Beat            | Where                  | Motion                                                                                                                     | Reduced motion                                        |
| --------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Piece selection | `PieceTray` `TraySlot` | lift scale 1 → 1.08, 150 ms timing (no spring overshoot); previous selection settles back in the same window               | instant `setValue`, no transform                      |
| Drag follow     | `DragGhost`            | position on a native `Animated.ValueXY` driven imperatively — zero React renders per pointer move                          | native translate (no scale)                           |
| Drag pick-up    | `DragGhost`            | subtle lift scale ×1.06 while dragging                                                                                     | no scale                                              |
| Board preview   | `GridCell`             | valid/invalid appear **instantly** (fastest, and avoids animating 64 cells / board geometry)                               | unchanged                                             |
| Placement snap  | `GridCell`             | placed cells settle scale 1.12 → 1, 150 ms                                                                                 | skipped, transform omitted                            |
| Invalid return  | `DragGhost`            | ghost glides back to the pick-up point + fades + shrinks, 160 ms, deterministic                                            | returns immediately                                   |
| Timer tick      | `TimerBadge`           | on a countdown value change, one-shot scale 1 → 1.16 → 1 (~210 ms), composed over the pulse; never on mount or when frozen | no tick                                               |
| Timer urgency   | `TimerBadge`           | existing warning/urgent pulse (unchanged)                                                                                  | static higher-contrast badge                          |
| Button press    | `PressableFeedback`    | dim: opacity → 0.6 (transform-free, for rounded/elevated controls); scale: → 0.96 (elevation-free dock only)               | no animation; disabled/pending controls never animate |
| Modal appear    | `useAppearAnimation`   | pause / defuse / game-over panels fade + rise 12 px, 180 ms                                                                | instant, opacity 1, no transform                      |

**Android safety.** Press feedback defaults to **opacity** (no transform) so it
is safe on rounded, glowing (elevated) controls — a transient scale on those is
exactly the rounded-view hardware-layer black-render hazard this project has hit
on-device, and the build machine has no Android device to verify a scale against.
Scale press is used only on the reward dock, which has no elevation and no
`overflow:hidden`. No animation binds an identity transform under reduced motion;
the drag ghost's position translate is a real position (not identity) on a view
with no `overflow:hidden`/elevation.

**Performance.** The only per-frame work on the drag path was the ghost's
`setPoint`; it is gone. The board still updates React preview state only when the
mapped anchor changes, so a gesture never triggers a 64-cell rerender. Confirmed
on a physical Android phone (owner, 2026-07-25): drag feels smoother and
gameplay is no longer noticeably laggy.

## Phase 3 — gameplay event effects (implemented, 2026-07-25)

The consolidated event-effects pass: what the engine just did, reported back.
Every beat is driven by the domain's own event stream or by a read-only look at
authoritative state — no gameplay, scoring, reward, or persistence behaviour
changed, and no animation dependency was added (RN `Animated` only).

| Event             | Beat                                                                                                          | Duration                      | Reduced motion                            |
| ----------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------- | ----------------------------------------- |
| Line clear        | directional sweep — rows left→right, columns top→bottom, intersections take the earlier delay — plus a settle | 90 in / 190 out, ≤112 stagger | opacity flash only, no stagger, no settle |
| Defuse (by clear) | the defused piece's own cells flash; a pulse ring and the `DEFUSED +N` text sit on that piece's centroid      | ring 320                      | brief fade, no scale, no transform bound  |
| Defuse (rewarded) | the same contained pulse on the target piece, played as an out-of-turn cue; no bonus text (none is awarded)   | cue 400                       | cue 140                                   |
| Timer countdown 1 | existing urgent badge pulse (unchanged)                                                                       | —                             | static higher-contrast badge              |
| Timer expiry      | per-rubble-cell burst over the authoritative rubble, one board shake, one heavier haptic for the turn         | burst ~360, shake ~200        | burst omitted; rubble still drawn         |
| Revive            | recovery wave down the cells the revive restored, over an already-interactive board                           | cue 400                       | low-peak fade, no movement                |
| Score gain        | floating `+N` at the event, plus a short HUD score bump                                                       | bump ~240                     | no bump                                   |
| Combo increase    | emphasis pulse on the HUD combo pill (increase only — never a reset)                                          | ~240                          | no pulse                                  |
| Reward outcome    | shared success / cancelled / failure / unavailable line on all four reward surfaces                           | 1400 (700 reduced)            | static text, never motion-only            |

**Input.** Only a clear, defuse, or explosion holds the input lock, and only for
its own sequence (340 ms, +440 ms when an explosion is involved; 120 ms under
reduced motion). The board update itself is always applied first and is never
delayed by an effect. The revive and rewarded-defuse cues hold **no** lock — the
board is already updated and must stay usable.

**Out-of-turn cues.** `activateFreeze`, `applyRewardedDefuse`, and `applyRevive`
do not advance `state.turn`, so the turn-keyed animator never sees them. The
rewarded defuse and the revive play through `animator.playCue(...)` instead,
carrying cells the screen read from authoritative state _before_ applying the
action — the only point at which a defused piece or cleared rubble can still be
located. A cue is ignored while a required sequence is playing, so it can never
cut one short.

**Budgets.** Cleared-cell flashes are budgeted to the board itself; explosion
bursts share one budget of 24 views across every explosion in a turn, so several
simultaneous expiries can't multiply into an overlapping cascade. Nothing loops,
nothing blurs, no animated shadow, no full-screen opacity layer.

**Android safety.** Two real hazards were closed. `RubbleSurface` combined a
rounded tile with `overflow: hidden`, and rubble appears on exactly the turns the
board plays its shake transform — the hardware-layer black-render trap. The clip
moved to an inner square view inset 1 px inside the 2 px corner radius. And
`PulseRing` bound an identity scale under reduced motion; it now binds no
transform at all, matching every other effect.

**Render cost.** The effects overlay is a sibling of the board, not a child, so a
new effect plan re-renders only the overlay. Board cells are memoized and stay
memoized (one shared press handler instead of 64 closures, contour passed as a
bitmask, derived maps memoized), and the screen's cell-press handler no longer
changes identity when the animation or reward state flips.

**Device confirmation (2026-07-25, passed).** A physical Android release/profile
pass by the user confirmed the effects on hardware: line clears, expiry and
rubble, Defuse, Freeze, revive, combo, score and reward feedback all correct;
reduced motion works; no black or invisible blocks; no significant stutter; drag
responsiveness unchanged from Phase 2; no duplicate audio or haptics; no
lingering effects after restart or Home. Both Android hazards above are settled
on device. The finding is the user's, recorded here — the build machine has no
Android device and captured nothing.

## Cinematic renderer — motion on a canvas (implemented, not device-verified, 2026-07-28)

A second board renderer draws the playfield into one Skia canvas
(`docs/CINEMATIC_RENDERER.md`). It ships behind `EXPO_PUBLIC_CINEMATIC_BOARD`,
default off, and nothing below has been seen on a phone.

Every beat above is preserved in intent and in **duration**, so switching
renderers does not change how long a turn takes to read. What changes is how
motion is expressed: React Native `Animated` drives view props; the canvas
advances one clock over a pure list of timed primitives
(`src/rendering/cinematic/effects/effectScene.ts`).

| Event          | Canvas beat                                                        | Reduced motion                        |
| -------------- | ------------------------------------------------------------------ | ------------------------------------- |
| Line clear     | directional gradient sweep along each lane, plus staggered flashes | flashes only, no stagger, no settle   |
| Defuse         | the piece's own cells flash; one ring on their centroid            | brief fade, contained ring, no growth |
| Timer expiry   | debris thrown from each authoritative rubble cell; one board shake | contained flash, no throw, no shake   |
| Revive         | restoration wave down the restored rows                            | low-peak fade, no stagger             |
| Score          | floating `+N` rising from the event's own anchor                   | static, no rise                       |
| Board ambience | very subtle light breathing; no continuous motion while dragging   | omitted                               |

**Stagger and cap parity.** Clear stagger is 14 ms per cell capped at 112 ms;
explosion stagger is 30 ms per piece plus 12 ms per cell capped at 120 ms; revive
is 18 ms per row capped at 140 ms. Debris shares one budget of `MAX_BURST_CELLS`
across every explosion in the turn — capped globally rather than per explosion,
because four pieces expiring at once is a legal turn and a per-explosion cap
would let legal play multiply past the budget.

**Intersections.** A cell in both a cleared row and a cleared column takes the
EARLIER of the two delays and flashes once. Flashing twice would double its
brightness; taking the later delay would make it lag its own row.

**Determinism.** Debris direction is derived from the cell's coordinates, not
randomised, so a repeated explosion looks like the same explosion and a board of
rubble does not shimmer as it redraws.

**Reduced motion removes movement, never meaning.** Travelling sweeps, staggers,
debris throw, text rise and the board shake all go to zero, and each beat is
shortened — a static emphasis that lingers reads as a stall rather than as
feedback. The event itself always still plays. This is decided once, in the
model, so the canvas has no second reduced-motion branch to get wrong.

**Board-only shake.** The shake moves the board drawing, never the screen. It is
the one beat with a real vestibular cost and no informational content the drawn
rubble does not already carry, so it is also the first thing reduced motion
drops.

## Exercising these beats on a phone (2026-07-31)

Every timing above is decided in the pure model and covered by unit tests, which
answers "is the plan right" and not "did the plan reach the screen". The second
question needs a device, and most of the interesting cases cannot be produced by
playing on demand: a row and a column clearing together, a clear plus a defuse
plus two explosions on one turn, seven effects arriving faster than any of them
can finish.

`src/dev/effectHarness.ts` holds a fixed catalogue of thirteen scenarios that
produce exactly those cases, played through the same event pipeline gameplay
uses. The catalogue is data, not behaviour: the same button produces the same
events in the same order on every device and every run, so a tester comparing
two phones is comparing the phones.

Durations the scenarios lean on, all from this document:

- a clear or defuse sequence is **340 ms** (120 ms reduced),
- an explosion adds **440 ms** on top,
- a rewarded cue is **400 ms** (140 ms reduced) and holds **no** input lock.

The "lower effect retires first" scenario exists because of the first and third:
a 340 ms clear and a 400 ms cue overlap, the clear ends first, and the cue must
not restart when it does. That is the visible symptom of clock slots assigned by
draw position instead of leased by effect id, and it is not something an unaided
eye catches during ordinary play.

Development builds only, and absent rather than disabled elsewhere. Access and
the diagnostics readout are documented in `docs/CINEMATIC_PERFORMANCE.md`.
