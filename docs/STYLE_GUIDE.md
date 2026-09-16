# Style Guide

Extracted from the approved Stitch UI snapshot in
`docs/references/ui/stitch-mcp/`, cross-checked against all 16 approved
screens. Where screens disagreed, resolution followed the rule in
`BUILD_SPEC.md`'s design-ingestion task: prefer the Developer Handoff screen
(`16-developer-handoff`), then majority consistency, then gameplay
readability. Every resolution is logged in `docs/DECISIONS.md`.

This is a **visual** reference only. Gameplay values (timer counts, scoring,
board size, hand size) come from `BUILD_SPEC.md` / `docs/GAME_RULES.md` /
`src/config/balance.ts` — never from here.

Working name for this visual direction: **"Neon Reactor"** (dark,
glassmorphic, neon-glow puzzle aesthetic on a near-black background), one of
several skins implied by the Stitch project; see `docs/DECISIONS.md` for the
note on reconciling this with `BUILD_SPEC.md` §8.3's five named themes
(Default/Neon/Ice/Lava/Midnight) — this snapshot maps most directly to
**Neon**.

## Colors

Confirmed identical across all 16 screens (a genuine strength of this
snapshot — no per-screen color drift):

| Token                                 | Hex       | Usage                                           |
| ------------------------------------- | --------- | ----------------------------------------------- |
| `appBackground`                       | `#050505` | Page/screen background (near-black)             |
| `surfaceBg`                           | `#0B1326` | Base surface tint (deep navy-black)             |
| `boardBg`                             | `#0F172A` | Board panel background                          |
| `boardFrame`                          | `#2D2D35` | Board border, cell borders (graphite)           |
| `cyanBlock` / `primary-container`     | `#00F0FF` | Cyan piece color, primary glow accent           |
| `purpleBlock` / `secondary-container` | `#9D05FF` | Purple piece color                              |
| `amberBlock` / `tertiary-fixed-dim`   | `#FFBA20` | Amber piece color, Bolts/currency accent        |
| `scoreOrange`                         | `#FF6B00` | Current-score display glow (home, game screen)  |
| `on-surface`                          | `#DAE2FD` | Primary text on dark background                 |
| `on-surface-variant`                  | `#B9CACB` | Secondary/label text                            |
| `outline`                             | `#849495` | Icon/border neutral                             |
| `outline-variant`                     | `#3B494B` | Subtle borders/dividers                         |
| `error`                               | `#FFB4AB` | Invalid-placement feedback (ghost cell, X icon) |

**Unresolved / needs a decision before implementation** (see
`docs/UI_REFERENCE_AUDIT.md` for detail):

- A second, undeclared "urgent red" (`#FF003D`) is used for the countdown-2
  and countdown-1 warning pulse (`pulseWarning` in `03-critical-countdown`,
  `pulseRed` in `14-tutorial-defuse`). It is visually distinct from `error`
  (`#FFB4AB`, used for invalid-placement feedback) but was never added to
  the Developer Handoff's color-token section. **Decision needed:** either
  formalize `#FF003D` as a new `urgentRed` token (recommended — keeps
  "invalid action" and "piece about to explode" visually distinct, which
  matches BUILD_SPEC §6.11's requirement that danger states be
  unmistakable) or replace it with `error` for consistency. Record whichever
  is chosen in `docs/DECISIONS.md` before Codex builds the timer badge
  component.
- Tailwind's `borderRadius.full` token is overridden to `0.75rem` (12px) in
  every screen's config, which breaks true circularity for the many
  `rounded-full` circular buttons (48px power-up buttons would need 24px
  radius, not 12px, to render as a circle). This is a Stitch/Tailwind-config
  artifact, not a React Native concern — RN implementations should use
  `borderRadius: size / 2` for true circles regardless of this token.

## Typography

| Token                  | Font           | Size / Line-height | Weight | Letter-spacing | Usage                                            |
| ---------------------- | -------------- | ------------------ | ------ | -------------- | ------------------------------------------------ |
| `body-standard`        | Geist          | 16 / 24px          | 400    | —              | Body text                                        |
| `button-text`          | Geist          | 14 / 20px          | 600    | 0.02em         | Button labels                                    |
| `label-caps`           | Geist          | 12 / 16px          | 600    | 0.1em          | Uppercase small labels (BEST, COMBO, stat names) |
| `timer-mono`           | JetBrains Mono | 24 / 32px          | 500    | —              | Timer badge digits, in-cell countdown numbers    |
| `score-display`        | JetBrains Mono | 48 / 48px          | 700    | −0.05em        | Large score (results screen, logo digit)         |
| `score-display-mobile` | JetBrains Mono | 36 / 36px          | 700    | —              | In-game current-score header (mobile)            |

Two font families total: **Geist** (UI text/labels/buttons) and
**JetBrains Mono** (all numeric displays — score, timer, stat values). This
split is consistent across every screen — carry it into the RN
implementation as two loaded font families via `expo-font`, not a system
default.

## Board geometry

Resolved from the Developer Handoff screen (`16-developer-handoff`), which
is the authoritative token source per the resolution rule — note this
differs slightly from the ad-hoc CSS in a few gameplay mockups (see
`docs/UI_REFERENCE_AUDIT.md`):

| Property                            | Value                                                                                                       |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Base viewport (reference)           | 390×844                                                                                                     |
| Screen padding (safe content inset) | 20px each side                                                                                              |
| Board width                         | 350px (390 − 20×2), aspect ratio 1:1                                                                        |
| Grid                                | 8×8 (confirmed in every gameplay screen's markup)                                                           |
| Grid gutter (gap between cells)     | 2px                                                                                                         |
| Board frame thickness               | 2px                                                                                                         |
| Board corner radius                 | `rounded-sm`/`rounded-xl` varies by screen (2–8px) — not load-bearing, pick one (recommend 8px, `xl` token) |

Individual gameplay screens sometimes set the board's CSS `max-width` to
`380px` instead of `350px` (e.g. `01-selection-preview`,
`07-defuse-action`). Per the resolution rule, **350px (Developer Handoff)
wins** — it's also the value that's internally consistent with the
documented 390px viewport and 20px padding; 380px would leave only 5px of
side padding, which doesn't match the "Screen Padding: 20px" token declared
in the same handoff screen.

## Grid-cell geometry

| Property                                  | Value                                                                                                                                                                                             |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cell size                                 | 40px (declared token; at 350px board ÷ 8 cells + 7×2px gutters ≈ 41px actual — close enough to treat 40px as nominal, compute actual size from board width at runtime, don't hardcode 40px in RN) |
| Cell border                               | 1px, `#2D2D35`                                                                                                                                                                                    |
| Cell corner radius                        | `rounded-sm` (2px)                                                                                                                                                                                |
| Cell background (empty)                   | `#0F172A`                                                                                                                                                                                         |
| Cell background (occupied, "glass-block") | `rgba(255,255,255,0.05–0.1)` + `backdrop-filter: blur(16px)` + a 1px colored border matching the piece color, plus an outer glow `box-shadow` in the same color                                   |

## Piece/tray geometry

| Property                         | Value                                                                                                                                                        |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Hand size                        | 3 pieces (confirmed in every gameplay screen)                                                                                                                |
| Tray item bounding box           | 60×60px (3×3 cell grid) in some screens, 64×64px (`w-16 h-16`) in others — pick one; recommend 64px for a cleaner touch target margin above the 44px minimum |
| Tray item gap                    | 2px between sub-cells                                                                                                                                        |
| Piece cell size within tray      | ~18–24px (scaled down from board cell size to fit the 3×3 bounding box)                                                                                      |
| Selected/dragged piece treatment | Scales up (`scale-105` to `scale-110`), lifts with a drop-shadow, in `01-selection-preview`                                                                  |

## Timer badge

**This is the single most important visual-consistency finding — see
`docs/UI_REFERENCE_AUDIT.md` for full detail.** Two different conventions
appear across the 16 screens:

1. **Single floating circular badge** (`01-selection-preview`,
   `04-defuse-animation`, `05-defuse-success`, `07-defuse-action`): a small
   circle (24px / `w-6 h-6`, or 32px / `w-8 h-8` when "cracking") rendered
   on **one** cell of the piece, dark background (`surface-container-lowest`),
   1px border in the piece's color, mono digit centered inside.
2. **Repeated inline digit** (`02-invalid-placement`, `03-critical-countdown`,
   `09-freeze-active`): the same number rendered as plain centered text
   inside **every** cell belonging to the piece, no distinct badge shape.

**Resolved:** use convention 1 (single floating badge), for three reasons —
it's the majority pattern (4 of 7 screens that show timed pieces), it
matches `BUILD_SPEC.md` §6.11 literally ("Render the countdown on the
visually most suitable surviving cell, preferably the top-left surviving
cell" — singular), and it reads more clearly during gameplay (repeating a
number across 2–4 cells adds visual noise without new information). Badge
placement: the piece's topmost surviving cell; if there's a tie, leftmost
among the topmost row. Recorded in `docs/DECISIONS.md`.

| Timer state | Threshold | Treatment                                                                                                                                       |
| ----------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Normal      | 7–5       | Piece color border/glow only, mono digit, no pulse                                                                                              |
| Caution     | 4–3       | Amber-tinted badge (`#FFBA20`), no pulse (`03-critical-countdown` uses amber "3" cells)                                                         |
| Warning     | 2         | Amber pulse animation (`subtle-pulse`, 2s ease-in-out infinite, glow 12px→20px)                                                                 |
| Urgent      | 1         | Red pulse (`pulseWarning`/`pulseRed`, 1–1.5s, glow intensifies, needs the `urgentRed` color decision above) + stronger haptic on the JS/RN side |
| Explosion   | 0         | See Animation Spec — crack, shrink, dissolve to rubble                                                                                          |

## Rubble

Not directly depicted with a distinct "damaged" visual treatment in any of
the 16 approved screens (none of them show a post-explosion board state
with rubble cells). **Gap — flagged in the audit.** Recommend deriving a
rubble style consistent with the rest of the system: desaturated/darker
version of `boardFrame` (`#2D2D35`) with a cracked-texture overlay (an SVG
crack pattern, reusing the `showCrack` SVG-stroke animation primitive seen
in `04-defuse-animation`), clearly distinct from both empty cells and any
piece color per `BUILD_SPEC.md` §6.13's "must remain clearly different from
normal pieces" requirement.

## Buttons

| Type                                          | Size                                                                      | Notes                                                                                                                                                                                                                                                                 |
| --------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Power-up button (Freeze/Defuse)               | 48×48px (`w-12 h-12`) circular, 1px `outline-variant` border              | Active/charged state: filled `cyanBlock` background + glow. Inactive: transparent + neutral border. **Always rendered in the mockups — audit flags this as needing to become conditional per BUILD_SPEC §10.2 ("contextual rewarded-power button when appropriate")** |
| Primary CTA (Play, Play Again)                | Full-width or large circular (home Play button is 192×192px, `w-48 h-48`) | Glow border in `scoreOrange` (home) or `cyanBlock` (results), `active:scale-95` press feedback                                                                                                                                                                        |
| Secondary action (Home, End Run)              | Full-width, text-only, low-opacity until hover/press                      |                                                                                                                                                                                                                                                                       |
| Icon-only nav buttons (Settings, Pause, Back) | 40–48px tap area                                                          | Meets the 44×44 minimum                                                                                                                                                                                                                                               |

All interactive buttons found in the snapshot are ≥48px in at least one
dimension — no sub-44px tap targets found among actual `<button>` elements
(the sub-44px elements found by the audit are decorative grid/tray cells,
not tap targets).

## Overlays / modals

Pause, Game Over/Revive, and Second-Chance screens share one visual
pattern: a translucent dark scrim (`bg-background/85` + `backdrop-blur`)
over a dimmed/desaturated snapshot of the board, with a centered rounded
panel (`surface-container-high`, 1px `outline-variant` border, inner
top-edge highlight line). Reuse this as the standard modal/overlay shell
for every full-screen dialog (pause, revive, game over).

## Glows and shadows

Glow pattern used throughout: `box-shadow: inset 0 0 Npx <color>-tint, 0 0
Mpx <color>` — an inner glow plus an outer glow in the same hue. Values
range N=8–20px, M=8–40px depending on emphasis (small badges use the low
end, primary CTAs and explosion peaks use the high end). This is the single
recurring "neon" motif — implement as a shared style helper
(`neonGlow(color, intensity)`) rather than one-off shadow values per
component.

## Animation timings

See `docs/ANIMATION_SPEC.md` for the full table extracted from the
`@keyframes` blocks across the snapshot.

## Haptics

Not encoded in any of the HTML/CSS (haptics has no web equivalent) — mapped
qualitatively from `BUILD_SPEC.md` §6.5/§6.11 in `docs/ANIMATION_SPEC.md`
and `docs/UI_IMPLEMENTATION.md`. No screen contradicts the spec here since
none attempt to represent it.

## Reduced-motion

Only `04-defuse-animation`'s stylesheet actually gates its keyframes behind
`@media (prefers-reduced-motion: no-preference)`. None of the other
animated screens (line-clear sweep, timer pulses, combo pop, home's
floating decorative blocks) do. **Flagged in the audit:** the real
implementation must gate _every_ Reanimated effect behind the app's reduced-
motion setting uniformly, not just the defuse effect — this is a
`BUILD_SPEC.md` §19 requirement, not optional per-effect behavior.

## Cinematic renderer — canvas surfaces (2026-07-28)

The Skia board renderer (`docs/CINEMATIC_RENDERER.md`) draws the same visual
system with more depth. It does not introduce a second design language, and it
adds **no new colour tokens**: every cinematic tone is derived from the active
theme's own colours (`src/rendering/cinematic/palette.ts`).

That derivation is the point. Lifting a theme's frame colour toward white
produces the rim; sinking it toward black produces the recess shadow. So
Reactor, Arctic, Magma, Void and Solar all gain the recessed frame, rim
lighting, ambience and vignette without any of them needing an entry in a table
— and a sixth theme added later is correct by default rather than correct only
if someone remembers to extend this file.

| Surface     | Canvas treatment                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------------------ |
| Board frame | recessed: lit rim on the top inner edge, sunk shadow on the bottom, corner brackets as before          |
| Grid        | etched hairline down each gutter, beneath the cells so a cell border always wins where they meet       |
| Ambience    | scanlines across the playable area only, alpha-only, never crossing the frame                          |
| Block       | glow halo, solid body, the existing 45%/0.22 sheen, top-left bevel, bottom-right depth, saturated edge |
| Rubble      | no accent, no glow, no bevel — distinguished by material, not by hue                                   |
| Preview     | valid: solid accent edge. Invalid and conflict: danger hue **and** a dashed edge                       |
| Timer badge | opaque disc, ring per `getBadgeVisual`, numeral always drawn                                           |

**Light direction is one decision, applied everywhere.** The board's recess and
the blocks' bevels are lit from the same top-left, which is what makes blocks
read as sitting _inside_ the board rather than floating over an unrelated
surface. Reversing either one breaks the illusion for both.

**Colour is never the only channel.** An invalid preview is dashed as well as
red; a frozen badge is dashed as well as icy; an urgent badge is larger as well
as hotter; rubble differs by material as well as by tone. This is the same rule
the React Native renderer follows, and the parity tests check the spoken
equivalents survive the move to a canvas — where, unlike a view, nothing is
announced unless something outside the canvas announces it.

**No per-cell blur.** The block halo is a blurred copy of the block, not a blur
filter over the cell. `docs/UI_REFERENCE_AUDIT.md` item 9 already ruled out
per-cell blur for the React Native renderer; a canvas makes it cheap enough to
attempt and no less wasteful.
