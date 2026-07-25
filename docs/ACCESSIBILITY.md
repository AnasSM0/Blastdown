# Accessibility

> **Phase 0 audit status (2026-07-21).** Implemented today: numeric timer labels
> (`TimerBadge` always renders a digit), reduced-motion gating across all
> effects, safe-area insets (`SafeAreaView` in the gameplay/overlay trees),
> touch targets ≥44–48px, and non-flashing pulses. **Still open** (tracked for
> UI Polish Phase 1 §P1-9/P1-10 and later): a dedicated colorblind-safe palette
> option, verification at 360-px width + large font scale, and keeping every new
> polished surface (premium blocks, cracked rubble, contours) within these rules
> — never signaling state by color alone. See `docs/VISUAL_POLISH_REVIEW.md` §3.

Requirements derived from `BUILD_SPEC.md` §19, cross-checked against what
the approved Stitch screens actually show. Stitch screens are a visual
reference only — none of them can demonstrate screen-reader behavior, so
most of this document is spec-derived rather than screen-derived; where a
screen does bear on an item (touch targets, color reliance), that's noted.

## Numerical timer labels

Required by `BUILD_SPEC.md` §6.11: "Every timer should also show its
number... Do not rely on color alone." All 16 approved screens comply —
every timed piece shows a numeral, never color/glow alone. Preserve this:
the `TimerBadge` component (`docs/UI_IMPLEMENTATION.md`) always renders a
`Text` digit, regardless of theme or color-blind mode.

## Colorblind-safe theme option

`BUILD_SPEC.md` §19 requires one. Not depicted in any approved screen (the
snapshot only shows the "Neon Reactor" visual direction). This is a gap to
plan for during `docs/TASKS.md`'s Settings/Themes work — likely means an
alternate palette in `src/config/themes.ts` with higher-contrast,
distinguishable hues for the cyan/purple/amber piece colors (already
distinguishable by hue+brightness, but should be verified with a
protanopia/deuteranopia/tritanopia simulator before shipping) plus reliance
on shape/position/number, never color alone, for any state signal (timer
badges already satisfy this; explosion/rubble states must too).

## Haptics / Sound / Music / Reduced Motion toggles

All four appear in the approved `12-pause` screen (Sound Effects, Haptics,
Music, Reduced Motion) and are implied for `app/settings.tsx` per
`BUILD_SPEC.md` §10.7. See `docs/UI_REFERENCE_MANIFEST.md` item 12 for the
open question of whether all four belong on the Pause overlay itself or
only in Settings — either way, all four must exist somewhere and persist
(`docs/GAME_RULES.md`/`BUILD_SPEC.md` §16).

## Large touch targets

Audited in `docs/UI_REFERENCE_AUDIT.md` — every actual button element
across all 16 screens is ≥48×48px, comfortably above the 44×44 logical-
pixel minimum. Maintain this as a hard floor for every new interactive
element Codex builds, including the drag-piece touch area (which should be
the full tray-slot bounding box, not just the visible piece cells within
it — a small 1-cell piece inside a 64×64 slot should still have a 64×64 tap/
drag target, not a target sized to the piece's visible pixels).

## Clear invalid-placement feedback

`02-invalid-placement` shows a dashed/tinted ghost + a red X icon on the
conflicting cell. Audit item 1 flags that the X marker isn't drawn on cells
that actually coincide with the attempted piece's own ghost cells in that
particular mockup — the real implementation must highlight exactly the
cells where the attempted placement overlaps an occupied/rubble cell, so
the feedback is spatially unambiguous, not merely "somewhere nearby is
wrong." Pair with the haptic warning cue from `BUILD_SPEC.md` §6.5 and a
brief non-flashing shake/tint (see `docs/ANIMATION_SPEC.md`).

## No countdown while the player is inactive

Structural, not visual — the move-based timer model (`BUILD_SPEC.md` §3.3)
already guarantees this: nothing decrements except on a successful
placement. No screen contradicts it (none show any kind of real-time clock
UI, which is correct — a countdown UI element implying real-time urgency
would itself be a spec violation; confirmed absent everywhere).

## No flashing effect that creates accessibility risk

Every pulse/glow animation surveyed in `docs/ANIMATION_SPEC.md` is a smooth
box-shadow/opacity breathe (1–2s cycles), not a hard strobe/flash. Keep all
new effects within this envelope — no sub-500ms full-opacity flicker
anywhere, especially not on the urgent (1-move) timer state, which is
exactly where a poorly-implemented "urgent" effect could accidentally
become a strobe.

## No required audio cues

Every state surveyed (timer warnings, invalid placement, explosions) pairs
a visual + optional haptic signal; none of the approved screens imply audio
is the _only_ channel for any piece of information. Maintain this: sound
in `docs/TASKS.md`'s Phase 4 work is additive feedback, never the sole
carrier of required information.

## Safe-area and small-screen support

No approved screen models safe-area insets (they're fixed-height web
headers/footers against a fixed 390×844 viewport) — expected, since Stitch
mockups aren't native layout engines. This must be added natively via
`react-native-safe-area-context` (already in the required stack,
`BUILD_SPEC.md` §12.1) regardless of what any mockup shows literally: the
score header, bottom power-up nav, and every modal/overlay must respect
`useSafeAreaInsets()` top/bottom padding on top of the mockups' 20px
`container-padding`, not instead of it. Flagged as a required addition in
`docs/UI_REFERENCE_AUDIT.md`.

Small-screen support: the mockups' 390px reference viewport is a mid-size
phone. `BUILD_SPEC.md` §18/§21.4 requires small-Android-screen support
too — the board-sizing rule in `docs/STYLE_GUIDE.md` (compute board width
from available space, don't hardcode 350px) is what makes this work on
narrower devices; verify at implementation time on a ~360px-wide reference
device, not just the 390px one the designs were built against.

## P1-10 responsive & accessibility review (2026-07-23)

Verification pass over the polished gameplay screen. A read-only Codex audit
(18 findings) was reviewed against the code; only proven regressions were fixed.

**Tested geometry.** `computeBoardSide` is now driven off the INNER content box
(the content view's 20px horizontal padding + 8px vertical padding are subtracted
before sizing, fixing a board that previously overran both gutters), and it
reserves a fixed 200px beneath the board for the tray + dock so they can never be
pushed off a short screen (was a height fraction that under-reserved on the
shortest phones). Composition verified at 320/360/390/420px board widths (64-cell
board + HUD + tray + dock all present) and the reserve verified at short heights
(460px → 260px board; ≤200px → board suppressed rather than overflowing).

**Board-cell touch targets — accepted constraint.** An 8×8 board on a phone
yields cells ~35–42px at 320–360px width; 44px×8 = 352px+gutters exceeds those
widths, so per-cell 44px is geometrically impossible without a redesign (out of
P1-10 scope). This is a dense spatial grid, not a set of discrete controls — the
44×44 floor is upheld for every discrete control (tray slots 64×64, dock cells
≥48×76, pause 48×48 + hit-slop). Placement also has a tap-to-select-then-tap path
and drag. Documented as an accepted trade-off; revisit only if a redesign adds an
accessible non-grid placement affordance.

**Text scaling.** Score/best already capped (P1-2). Added caps so large OS font
scales can't push controls off-screen or clip: combo pill (`numberOfLines`,
`maxFontSizeMultiplier`), dock FREEZE/DEFUSE labels + state captions + reward chip
(`numberOfLines` + `maxFontSizeMultiplier`), and the timer numeral
(`allowFontScaling={false}` — a spatial indicator sized to its badge; the count is
also in the badge's accessibility label).

**Labels & hints.** Rubble now announces "Blocked rubble cell…". The board-cell
placement hint is **validity-aware**, driven by the domain's own read-only
placement preview (`getPlacementPreview` via `controller.previewAt`) — the UI
duplicates no gameplay rule and mutates nothing. Only empty cells (the sole legal
anchors) ever carry a placement hint, and only while a piece is selected:

- valid anchor → "Double tap to place the selected piece here" (announces the
  placement the tap will perform);
- invalid anchor → "The selected piece can't be placed here" (states
  unavailability; never promises success);
- no piece selected → **no hint** (the label already says "Empty cell"), so it
  never implies an action a bare tap won't perform;
- occupied/rubble cells → never announce placement.

`app/game.tsx` builds a `placementHints` map (empty cell → valid/invalid) while a
piece is selected and passes it through `GameBoard` to each `GridCell`; it is null
otherwise and recomputes on selection/board change, so hints never go stale.
Timed-cell **labels** also speak the countdown and state rather than relying on
color/glow — "{color} block with timer, N move(s) left[, frozen | urgent], row R,
column C" (a frozen piece never also says "urgent"). The pause control gained a
hint; the dock exposes a per-state hint (pending→"Loading the rewarded ad",
unavailable/disabled/failure/cancelled variants) and announces the rewarded-ad
cost ("Watch a rewarded ad to use this") when the "▷ AD" chip shows; a pending
dock button reports `accessibilityState.disabled` so it can't be triggered again.

**Reduced motion.** `TimerBadge` and `PieceTray` now consume the EFFECTIVE
reduced-motion value (OS combined with the persisted in-app override) threaded
from the screen, instead of the OS-only hook — so the Settings toggle actually
suppresses the badge pulse and the tray lift. Every rounded, animatable gameplay
view (TimerBadge, the board's shake wrapper, DragGhost — joining GridCell/tray
slot/dock already done) now OMITS its transform entirely under reduced motion
rather than binding an identity one, upholding the Android hardware-layer
"black-render" guard. Static block/rubble/empty visibility is unchanged; warnings
stay readable (numeral + ring, never color alone).

**Deferred device checks.** No Android device on the build machine, so the
on-device matrix (very short phone, large font scale, gesture vs three-button nav,
reduced-motion on a real device) is recorded here, not captured/fabricated. The
board-cell size and safe-area behavior should be eyeballed on a ~360px device.

**Colorblind-safe palette** (from the Phase-0 gap list) remains a separate,
larger task — not in P1-10 scope; state is never signaled by color alone across
the polished surfaces (verified in P1-9 + here).

## Phase 2 interaction motion — reduced motion (2026-07-25)

The interaction-motion pass adds only cause-and-result feedback, and every beat
is removed under the effective reduced-motion value (OS + persisted override):

- Press feedback (`PressableFeedback`) does not animate under reduced motion (or
  while a control is disabled/pending); the control and its state styling are
  unchanged, so nothing is lost.
- The tray selection lift, drag pick-up/return scale, placement snap, timer tick,
  and modal appear (`useAppearAnimation`) all resolve to their end state instantly
  with **no transform** under reduced motion — upholding the Android
  identity-transform / rounded-layer black-render guard.
- No looping decorative motion was added; the only loop remains the existing
  timer urgency pulse, which already degrades to a static higher-contrast badge.
- State is still never signaled by motion alone: selection has border/glow, the
  timer has its numeral + ring, invalid placement keeps its dashed non-color cue,
  and every button keeps its label/role. Focus order, accessibility labels/hints,
  safe areas, and once-only callbacks are unchanged by the motion layer.

Physical-device confirmation with reduced motion ON and OFF (and a smooth drag on
a real phone) was run by the repository owner on 2026-07-25 and passed — there is
no Android device on the build machine, so it is recorded as the owner's result.

## Phase 3 event effects — reduced motion and non-visual reporting (2026-07-25)

The event-effects pass reports outcomes, so the accessibility bar is higher than
for interaction motion: an effect that only exists as movement would make the
outcome unreadable to anyone who turns motion off. Every beat therefore keeps a
non-motion form:

- **Line clear** still flashes each cleared cell under reduced motion — the
  stagger and the settle scale are dropped, not the signal. The board update
  itself is authoritative and never waited on the effect.
- **Defuse** collapses to a brief fade on the defused piece's own cells with no
  scale; the `DEFUSED +N` text stays and holds position instead of floating.
- **Timer expiry** drops the burst and the board shake but the rubble is drawn
  from the authoritative result either way, and the expiry haptic still fires
  (once per turn, honoring the persisted haptics setting).
- **Revive** keeps the recovery wave as a low-peak fade over the restored cells,
  so restoration is still visible as a distinct event rather than the board
  silently changing.
- **Combo and score** emphasis is dropped, but both values are plain text in the
  HUD and the combo pill carries its own `Combo xN` label — the numbers were
  never conveyed by the pulse.
- **Reward outcomes** are the strongest case: success, cancelled, unavailable,
  and failure are reported as _words_ on every reward surface
  (`RewardOutcomeNotice`, announced via a polite live region), never by color or
  motion alone. Previously Revive and Double Bolts said nothing at all when an ad
  was dismissed or failed, which read as the app ignoring the tap.

No effect binds an identity transform under reduced motion (the Android
rounded-layer black-render guard), and no beat loops, flashes repeatedly, or
covers the board or tray. Labels, roles, hints, focus order, and once-only
callbacks are unchanged by the effects layer.

Physical-device confirmation with reduced motion ON and OFF for the event effects
is required and is the user's step — recorded here, not captured or fabricated.
