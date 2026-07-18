# Stitch UI reference snapshot

Frozen local copy of the 16 Stitch screens approved as BlastDown's visual
direction, retrieved 2026-07-18 from the Stitch MCP project **BlastDown
Puzzle UI Design** (`projects/4472195625883229066`).

**Stitch is authoritative only for visual direction — colors, typography,
spacing, iconography, mood.** `BUILD_SPEC.md` and `docs/GAME_RULES.md` are
authoritative for gameplay (board size, hand size, timer rules, scoring,
etc.). Where a screen depicts something that conflicts with the spec, the
spec wins — see `docs/UI_REFERENCE_AUDIT.md` for the full list of
discrepancies found in this snapshot.

## Why this snapshot exists

Stitch projects are live and editable. Future edits in Stitch must not
silently change what Codex/Claude build against mid-implementation. This
directory is the **stable, versioned, point-in-time reference** — implementation
work reads from here, not from a live Stitch query. If the approved design
changes, re-run the retrieval, review the diff, and update this snapshot
deliberately (with a `docs/DECISIONS.md` entry if the change is material).

## Structure

Each `NN-slug/` folder holds one approved screen:

- `screen.png` — the Stitch-rendered screenshot (the primary visual
  reference).
- `source.html` — the raw Stitch-generated HTML. Uses a Tailwind CDN
  `<script>` tag and Google Fonts `<link>` tags plus inline `<style>` blocks.
  **Reference only.** Never executed, never imported into the Expo app,
  never used as a WebView source. See `docs/UI_IMPLEMENTATION.md` for how
  each element actually gets built in React Native.
- `styles.css` — the `<style>` block(s) extracted from `source.html`,
  concatenated, for easier diffing/searching than digging through the HTML.
- `metadata.json` — provenance for every file in this folder (Stitch screen
  ID, retrieval timestamp, size, SHA-256 checksum, retrieval status).
- `assets/` — any additional hosted assets referenced by the screen (e.g. a
  background image), present only where a screen actually references one.

`manifest.json` (this directory's root) indexes all 16 screens with their
local paths. `.download-manifest.tsv` and similar working files are not
kept — signed/token-bearing hosted URLs are redacted to host+path in
`metadata.json` rather than committed in full, per the retrieval task's
credential-handling rule.

## Screens (in manifest order)

| # | Folder | Title |
|---|--------|-------|
| 1 | `01-selection-preview` | Gameplay - Selection & Preview Interaction |
| 2 | `02-invalid-placement` | Gameplay - Invalid Placement Preview |
| 3 | `03-critical-countdown` | Gameplay - Critical State (Countdown 1) |
| 4 | `04-defuse-animation` | Gameplay - Defuse Animation |
| 5 | `05-defuse-success` | Gameplay - Defuse Success |
| 6 | `06-results` | Final Results - Run Complete |
| 7 | `07-defuse-action` | Gameplay - Defuse Action Preview |
| 8 | `08-game-over-revive` | Game Over - Revive & Continue |
| 9 | `09-freeze-active` | Gameplay - Freeze Timers Active |
| 10 | `10-second-chance` | Gameplay - Second Chance Revive |
| 11 | `11-home` | Home Screen - Neon Reactor Minimal |
| 12 | `12-pause` | Pause Overlay |
| 13 | `13-tutorial-rubble` | Tutorial - Clearing Rubble |
| 14 | `14-tutorial-defuse` | Tutorial - Defuse Strategy |
| 15 | `15-tutorial-countdown` | Tutorial - Countdown Mechanics |
| 16 | `16-developer-handoff` | Developer Handoff - Neon Reactor Minimal |

## Related documents

- `docs/UI_REFERENCE_MANIFEST.md` — human-readable index with per-screen
  notes on what each screen shows and its intended gameplay state.
- `docs/UI_REFERENCE_AUDIT.md` — discrepancies between these screens and
  `BUILD_SPEC.md`/`docs/GAME_RULES.md`, with corrections.
- `docs/STYLE_GUIDE.md` — extracted colors, typography, and geometry values.
- `docs/UI_IMPLEMENTATION.md` — web-to-React-Native translation mapping.
- `docs/ANIMATION_SPEC.md` — animation/haptics/reduced-motion spec.
- `docs/ACCESSIBILITY.md` — accessibility requirements derived from the
  screens and the spec.
- `docs/SCREEN_STATE_MATRIX.md` — screen × game-state coverage table.
- `docs/TASKS.md` — bounded Codex UI tasks that consume this snapshot.
