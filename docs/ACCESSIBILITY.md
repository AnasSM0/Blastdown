# Accessibility

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
