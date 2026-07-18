# Screen × Game-State Matrix

Maps `GameState.status` values and key gameplay moments (per
`BUILD_SPEC.md` §14's `GameStatus` union and §6.9–6.18's event list) to the
approved Stitch reference screen(s) that visualize them, so Codex tasks in
`docs/TASKS.md` can cite an exact visual reference per state instead of
guessing.

| `GameStatus` / moment                           | Approved reference screen(s)                                                                                       | Coverage                                                        |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| `ready` (home, pre-run)                         | `11-home`                                                                                                          | Covered                                                         |
| `playing` — normal turn                         | `01-selection-preview`, `07-defuse-action` (idle board, before the confirm sheet opens)                            | Covered                                                         |
| `playing` — piece selected / drag preview       | `01-selection-preview`                                                                                             | Covered                                                         |
| `playing` — invalid placement attempt           | `02-invalid-placement`                                                                                             | Covered (see audit item 1 re: overlap-marker alignment)         |
| `playing` — timer at caution (4–3)              | `02-invalid-placement`, `03-critical-countdown` (amber cells)                                                      | Covered                                                         |
| `playing` — timer at warning (2)                | `15-tutorial-countdown` (amber `subtle-pulse`)                                                                     | Covered                                                         |
| `playing` — timer at urgent (1)                 | `03-critical-countdown`, `14-tutorial-defuse`                                                                      | Covered                                                         |
| `playing` — timer at 0 / mid-explosion          | _(none — `09-freeze-active` shows an impossible stable "0" state, not an explosion in progress; see audit item 2)_ | **Gap** — no approved screen shows an actual explosion sequence |
| `resolving` — line clear / defuse in progress   | `04-defuse-animation`                                                                                              | Covered (richest reference in the set)                          |
| `resolving` — defuse just completed             | `05-defuse-success`                                                                                                | Covered                                                         |
| `resolving` — Defuse power-up confirmation      | `07-defuse-action`                                                                                                 | Covered                                                         |
| `playing` — Freeze power-up active              | `09-freeze-active`                                                                                                 | Covered                                                         |
| Post-explosion rubble state                     | _(none)_                                                                                                           | **Gap** — flagged in `docs/UI_REFERENCE_AUDIT.md` item 12       |
| `paused`                                        | `12-pause`                                                                                                         | Covered                                                         |
| `gameOver` / `awaitingRevive` — decision dialog | `08-game-over-revive`                                                                                              | Covered                                                         |
| Post-revive restoration                         | `10-second-chance`                                                                                                 | Covered                                                         |
| `finished` — results                            | `06-results`                                                                                                       | Covered                                                         |
| Tutorial step 1 (place a piece)                 | _(none explicitly — closest is `01-selection-preview`'s generic selection state)_                                  | **Gap (minor)**                                                 |
| Tutorial step 2 (complete a row)                | _(none explicitly)_                                                                                                | **Gap (minor)**                                                 |
| Tutorial step 3 (introduce a timer)             | `15-tutorial-countdown`                                                                                            | Covered                                                         |
| Tutorial step 4 (save a timer at 1)             | `14-tutorial-defuse`                                                                                               | Covered                                                         |
| Tutorial step 5 (controlled explosion)          | _(none — same gap as the general explosion state above)_                                                           | **Gap**                                                         |
| Tutorial step 6 (clear rubble via line)         | `13-tutorial-rubble`                                                                                               | Covered (though no rubble visual exists yet — see gap above)    |
| Settings screen                                 | _(none — not in the approved 16)_                                                                                  | **Gap**                                                         |
| Themes screen                                   | _(none — not in the approved 16)_                                                                                  | **Gap**                                                         |

## Summary of gaps to close before full visual coverage

1. **Explosion sequence** (piece expires at 0) — no approved screen shows
   this; `docs/ANIMATION_SPEC.md` derives a spec from the defuse sequence
   as an interim reference, but a real Stitch screen (or direct design
   sign-off) should replace that derivation before Phase 4 ships it.
2. **Rubble cell visual** — no approved screen shows post-explosion board
   damage. `docs/STYLE_GUIDE.md` proposes a placeholder treatment.
3. **Settings and Themes screens** — not in the approved set at all.
4. **Tutorial steps 1, 2, 5** — no dedicated approved screen; steps 3, 4, 6
   are covered.

None of these gaps block starting Phase 1/Phase 2 (pure domain engine —
this snapshot doesn't affect domain work at all) or the parts of Phase 3
that have full visual coverage (home, normal gameplay, invalid placement,
pause, results, game-over/revive). They do block writing a _complete_
Codex task for the explosion effect, rubble rendering, or the
Settings/Themes screens until either more screens are approved or Claude
Code signs off on a derived design (as `docs/ANIMATION_SPEC.md` and
`docs/STYLE_GUIDE.md` already do for the explosion/rubble gaps).
