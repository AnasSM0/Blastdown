# UI Reference Audit

Audit of the 16 approved Stitch screens (`docs/references/ui/stitch-mcp/`)
against `BUILD_SPEC.md` and `docs/GAME_RULES.md`, which remain authoritative
for gameplay. Stitch is authoritative only for visual direction. Every
finding below was verified by reading the actual retrieved
`source.html`/`styles.css`, not assumed from screen titles.

Legend: **Correct** — fix the code (or the design, with sign-off) before
Codex builds against it. **Clarify** — needs a decision recorded in
`docs/DECISIONS.md` before implementation, not necessarily a "bug".
**Ignore** — a web-mockup artifact irrelevant to the native implementation.

---

## 1. Timer numbers shown independently on every cell (systemic — Correct)

**Source screens:** `02-invalid-placement`, `03-critical-countdown`,
`09-freeze-active`.

**Problem:** `BUILD_SPEC.md` §6.11 says the countdown is a property of the
_piece instance_ and should be rendered once, "preferably the top-left
surviving cell." These three screens instead print the same digit as plain
centered text inside **every** cell of a multi-cell piece — e.g. in
`02-invalid-placement`, a 3-cell horizontal cyan piece at row1/col3–5 shows
"6" three times; a 2-cell purple piece at row3/col1–2 shows "4" twice.
Four other screens (`01-selection-preview`, `04-defuse-animation`,
`05-defuse-success`, `07-defuse-action`) instead use a single small floating
circular badge on one cell of the piece — the spec-correct pattern.

**Correct implementation:** one `TimerBadge` per piece instance, positioned
on the topmost surviving cell (leftmost if there's a tie in that row), never
repeated across sibling cells. See `docs/STYLE_GUIDE.md` "Timer badge" and
the resolution recorded in `docs/DECISIONS.md`.

**Authoritative rule:** `BUILD_SPEC.md` §6.11.

---

## 2. Impossible board state — pieces rendered at timer "0" (Correct)

**Source screen:** `09-freeze-active`.

**Problem:** Multiple board cells render the digit `0` as a stable,
non-exploding piece (e.g. two cyan cells and one amber cell in "row 4", two
more in "row 7", one in "row 8"). Per the turn-resolution order
(`docs/ARCHITECTURE.md`, steps 7–11), a piece never rests at `0` — the same
turn that decrements a timer to `0` immediately resolves the explosion and
converts it to rubble. A stable UI frame showing an unexploded piece at `0`
cannot occur in the real game.

**Correct implementation:** the domain layer never emits a `GameState`
with a timed piece at `remainingTurns: 0` — that value transitions straight
to an `explosion` event and a `rubble` cell in the same reducer call. If
Codex needs a "just about to explode" visual, use the existing `1` (urgent)
state, not a fabricated `0` state.

**Authoritative rule:** `BUILD_SPEC.md` §6.10 (turn-resolution order),
§6.12 (explosion behavior).

---

## 3. Extra feature not in `BUILD_SPEC.md`: online leaderboard (Correct)

**Source screen:** `11-home`.

**Problem:** The home screen's secondary-actions row has three buttons —
Themes, How to Play, and a third labeled "RANKS" using a `leaderboard`
Material Symbol icon. `BUILD_SPEC.md` §3.1 explicitly lists "online
leaderboards" among features to _not_ add, and §5.3 lists it under
explicitly out-of-scope. §10.1's Home screen spec lists only: logo, play,
best score, bolts balance, themes button, settings button, privacy link,
optional "How to Play" — no ranks/leaderboard entry.

**Correct implementation:** remove the "RANKS" button from the home screen
entirely for the MVP. If a future milestone wants a local (non-online)
stats/history view, that's a new, separately-scoped feature requiring a
`BUILD_SPEC.md` update — not something to build opportunistically because
the mockup includes it.

**Authoritative rule:** `BUILD_SPEC.md` §3.1, §5.3, §10.1.

---

## 4. Missing required stat on Final Results screen (Correct)

**Source screen:** `06-results`.

**Problem:** `BUILD_SPEC.md` §10.5 requires the Final Results screen to show
final score, best score, **pieces placed**, lines cleared, pieces defused,
explosions, Bolts earned, double-Bolts option, Play Again, and Home. The
retrieved screen shows Best Combo, Lines Cleared, Pieces Defused,
Explosions, Rubble Cleared, and Bolts Earned — **"Pieces placed" is
missing**, and "Best Combo"/"Rubble Cleared" are shown instead (not
required, but not harmful additions).

**Correct implementation:** add a "Pieces Placed" row to the stats list
(Codex task, presentation-only — the value already exists on `GameState` as
`piecesPlaced`). Keeping Best Combo and Rubble Cleared as bonus stats is
fine; they don't conflict with anything in the spec.

**Authoritative rule:** `BUILD_SPEC.md` §10.5.

---

## 5. Power-up buttons always visible, not contextual (Correct)

**Source screens:** `01-selection-preview`, `02-invalid-placement`,
`03-critical-countdown`, `07-defuse-action` (Freeze inactive/Defuse
inactive shown regardless of run state).

**Problem:** `BUILD_SPEC.md` §10.2 calls for a "contextual rewarded-power
button when appropriate," implying the Freeze/Defuse controls should
reflect availability (uses remaining this run, whether any timed piece
exists to defuse, ad availability) rather than being permanently rendered
in an identical style. `09-freeze-active` is the one screen that _does_
show a contextual active/inactive visual difference (Freeze charged +
glowing + "2 MOVES" counter vs. Defuse in a neutral/idle state) — that's
the pattern to generalize, not the always-on-identical-buttons pattern from
the other three screens.

**Correct implementation:** power-up buttons reflect three states —
available, in-cooldown/exhausted (`rewardedFreezeUses`/`rewardedDefuseUses`
maxed out per `BUILD_SPEC.md` §6.16/§6.17), and (for Defuse specifically)
hidden or disabled when no active timed piece exists to target. Use
`09-freeze-active`'s active-state treatment (filled, glowing, ring, counter
label) as the visual reference for "available/active"; use a dimmed/
outline-only treatment (already present in the other screens) for
"available but idle"; add a disabled/greyed treatment for "exhausted or not
applicable" (not present in any approved screen — a gap, see item 12).

**Authoritative rule:** `BUILD_SPEC.md` §10.2, §6.16, §6.17.

---

## 6. Combo indicator missing/inconsistently placed (Clarify)

**Source screens:** `01-selection-preview` (no combo indicator anywhere in
the header), `02-invalid-placement` (combo shown as an absolutely-
positioned pill floating above the board, not in the header).

**Problem:** `BUILD_SPEC.md` §10.2 requires the game screen's top area to
include a combo indicator alongside score/best-score/pause. Screen 1 omits
it entirely; screen 2 shows it, but positioned as a floating overlay above
the board rather than in the header row with Best/Score/Pause.

**Correct implementation:** put the combo indicator in the persistent
header alongside score/best/pause (not a floating overlay that can occlude
board cells), and only render it when `combo > 0` (both screens agree a
combo indicator shouldn't show at combo 0 — screen 1 simply omits it
outright at that state, which is consistent with "hide when zero" — the
disagreement is placement, not visibility logic).

**Authoritative rule:** `BUILD_SPEC.md` §10.2.

---

## 7. Board width token conflict: 350px vs 380px (Correct — resolved)

**Source screens:** Developer Handoff (`16`, declares 350px board width at
a 390px viewport with 20px padding) vs. several gameplay screens'
inline CSS (`01`, `07`) which set `max-width: 380px` on `.board-grid`.

**Resolution:** per the stated precedence (prefer Developer Handoff, then
majority, then readability), **350px wins** — it's also internally
consistent with the 390px viewport and 20px padding declared in the same
reference screen, while 380px would leave only 5px of side padding.
Recorded in `docs/DECISIONS.md`. In practice, the RN board should be sized
as `min(deviceWidth - 2×screenPadding, someMaxCap)`, computed at runtime,
not hardcoded to either pixel value — see `docs/STYLE_GUIDE.md`.

**Authoritative rule:** N/A (visual-only token, not a gameplay rule) — this
is a Stitch-internal inconsistency, resolved per the design-ingestion
task's own precedence rule.

---

## 8. Undeclared "urgent red" color token (Clarify)

**Source screens:** `03-critical-countdown` (`pulseWarning` keyframe),
`14-tutorial-defuse` (`pulseRed` keyframe) both use `#FF003D`, which never
appears in the Developer Handoff's color-token section (`16`) or in the
`error` token (`#FFB4AB`, used for invalid-placement feedback elsewhere).

**Needs a decision:** formalize `#FF003D` as a distinct `urgentRed` token
(recommended, so "invalid action" and "piece about to explode" stay
visually distinct) or fold it into the existing `error` token. See
`docs/STYLE_GUIDE.md`. Not yet recorded as a final decision — flag for
Claude Code sign-off before the timer-badge component is built.

**Authoritative rule:** N/A — visual token gap, not a gameplay rule.

---

## 9. Expensive per-cell blur effects unsuitable for React Native (Correct)

**Source screens:** all gameplay screens use `backdrop-filter: blur(16px)`
on every occupied cell's `.glass-block`/`.glow-*` treatment — up to
several dozen simultaneously-blurred elements on one board, plus tray items
and overlay panels.

**Problem:** `backdrop-filter` has no direct React Native equivalent.
Approximating it with `expo-blur`'s `BlurView` per-cell (potentially 20–40+
instances at once on a busy board) is a realistic performance risk on
budget/mid-range Android, directly contradicting `BUILD_SPEC.md` §18's "no
continuous expensive animations" / "profile before introducing Skia or
another renderer" guidance — blur is in the same expense category.

**Correct implementation:** approximate the "glass" look with a solid
semi-transparent fill color + 1px colored border + a (non-blurred) glow
`shadow`/`elevation`, no `BlurView` on individual grid cells. Reserve
`BlurView` (if used at all) for a small, fixed number of full-panel
overlays (pause modal, revive modal) where only one or two instances exist
at once. See `docs/UI_IMPLEMENTATION.md`.

**Authoritative rule:** `BUILD_SPEC.md` §18, §12.2 (no Skia without
profiling — blur-per-cell is the same class of risk).

---

## 10. Web-only controls and generated markup not to be ported (Ignore)

Every screen relies on hover states (`hover:scale-105`, `hover:opacity-80`),
a `document.write` loop to generate 64 grid cells, inline `<script>` blocks
for touch-feedback micro-interactions, a Tailwind CDN `<script>` tag, and
Google Fonts `<link>` tags. None of this transfers to React Native and none
of it should be copied — `app.config.ts`/Expo already loads fonts via
`expo-font`, board cells are data-driven from `GameState.grid`, and touch
feedback uses Reanimated + `Pressable`, not CSS `:hover`/`:active`. See
`docs/UI_IMPLEMENTATION.md` for the explicit per-element mapping. This is
expected and not a defect in the Stitch output — it's simply why "translate,
don't copy" is the rule for Part 6.

Also note: a handful of Tailwind utility classes in the raw HTML are
invalid/typo'd (e.g. `11-home`'s header has `pt-grid-unit` — no such
spacing token is defined anywhere, and stray words like `flat no shadows`
appear as literal (non-functional) class names in a few screens' `<nav>`
elements). Harmless in the mockup (Tailwind silently ignores unknown
classes) and irrelevant once translated to RN StyleSheet, but a reminder
that the HTML is AI-generated scaffolding, not hand-audited production
code — never import it verbatim.

---

## 11. Inconsistent implementation of the same visual concept across screens (Ignore, but informs Part 6)

Different screens invent different class names for what is conceptually
the same "glowing glass piece" component: `.glass-block` +
`.neon-inner-stroke-{color}` in some, `.block-{color} .block-glass` in
others, ad hoc `bg-{color}/10` + `border` combinations in a few more. This
is expected in Stitch's screen-by-screen generation, not a defect — but it
reinforces that Codex should build **one** canonical `PieceCell`/
`TimerBadge`/`GlassPanel` component set (per `docs/UI_IMPLEMENTATION.md`),
not port any single screen's CSS wholesale.

---

## 12. Missing screens/states (gap, not a defect)

The approved set of 16 doesn't include: a Settings screen, a Themes
screen, any screen depicting a rubble cell's actual visual treatment
(no approved screen shows post-explosion board damage), or a "power-up
exhausted/disabled" visual state for Freeze/Defuse. These aren't wrong —
they're simply not yet designed. `docs/STYLE_GUIDE.md` proposes a rubble
treatment derived from the existing system (crack-pattern overlay +
desaturated frame color) as a placeholder pending an actual approved
screen; the power-up disabled state should follow the same
outline/dimmed pattern already used for "idle" but at lower opacity with
no glow, consistent with standard disabled-button treatment.

---

## Checklist pass/fail summary

| Check                                         | Result                                                                                                                                                                                          |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Board not exactly 8×8                         | **Pass** — every gameplay screen's board is 8×8                                                                                                                                                 |
| Numbers shown independently on every cell     | **Fail** — items 1, 2 above                                                                                                                                                                     |
| More/fewer than three tray pieces             | **Pass** — every screen shows exactly 3                                                                                                                                                         |
| Different HUD positions                       | **Fail (minor)** — item 6 (combo indicator)                                                                                                                                                     |
| Different board sizes                         | **Fail (minor, resolved)** — item 7 (350 vs 380px)                                                                                                                                              |
| Inconsistent tray positions                   | **Fail (minor)** — tray bounding box sizes vary (60px/64px) and container layout (`justify-between` vs `justify-center gap-8`) across screens; not gameplay-affecting, pick one for consistency |
| Incorrect countdown behavior                  | **Fail** — item 2 (piece rendered at `0`)                                                                                                                                                       |
| Impossible board states                       | **Fail** — item 2                                                                                                                                                                               |
| Distorted generated text                      | **Pass** — no evidence of AI text-rendering artifacts in the retrieved screenshots                                                                                                              |
| Web-only controls                             | **Expected/Ignore** — item 10                                                                                                                                                                   |
| Extra features not in `BUILD_SPEC.md`         | **Fail** — item 3 (leaderboard)                                                                                                                                                                 |
| Missing safe-area spacing                     | **Gap, expected** — none of the web mockups model safe-area insets; must be added natively via `react-native-safe-area-context` regardless of what any screen shows                             |
| Touch targets below 44×44 logical pixels      | **Pass** — every actual `<button>` element found is ≥48×48px; sub-44px elements are decorative (grid/tray cells), not tap targets                                                               |
| Inconsistent colors                           | **Fail (minor)** — item 8 (undeclared urgent red); core palette (cyan/purple/amber/orange/backgrounds) is otherwise identical across all 16 screens                                             |
| Inconsistent block materials                  | **Pass overall, informs Part 6** — item 11; all screens use the same "glass + glow" visual language, just different CSS class names                                                             |
| Expensive effects unsuitable for React Native | **Fail** — item 9 (per-cell backdrop blur)                                                                                                                                                      |
| Missing screens or states                     | **Gap, expected** — item 12                                                                                                                                                                     |
