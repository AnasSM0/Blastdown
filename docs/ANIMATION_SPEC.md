# Animation Spec

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
