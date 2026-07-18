# Game Rules

Derived from `BUILD_SPEC.md` sections 6–9. This is the gameplay contract:
any UI or engine change that would alter these rules requires Claude Code's
approval and a `docs/DECISIONS.md` entry.

## Board

- 8×8 grid.
- Each cell is one of: empty, normal timed block, normal untimed block,
  rubble.
- Normal untimed blocks exist only after a timed piece is defused with a
  power-up.

## Piece hand

- Three pieces at a time, placeable in any order.
- New hand of three generated once all three are used.
- No rotation in the MVP.

## Piece catalog (~12 shapes)

Single cell; 2/3/4-cell horizontal line; 2/3/4-cell vertical line; 2×2
square; small L; mirrored small L; large L; T shape. Defined as arrays of
relative coordinates (`ShapeDefinition`), never as image assets.

## Piece generation

- Seeded PRNG; every run records its seed for reproduction.
- Generator never inspects the board to pick punishing pieces.
- Weighted bag: ~40% small, ~40% medium, ~20% large.
- Tutorial run: fixed seed, fixed hands.
- Early game may use a safer opening bag, gated on turn count — never on
  board condition.

## Placement

Valid when: every shape cell stays inside the board, every target cell is
empty, no target cell is rubble, and the piece hasn't already been used.

Production interaction: drag with translucent preview, release to place,
return to hand on invalid release, light haptic on valid placement, warning
feedback on invalid. Accessibility fallback: tap to select, tap a valid cell
to place. **Tap placement ships first** (easier to validate); drag is added
once rules are stable.

## Line clearing

After a successful placement: detect every completed row and column, clear
them simultaneously (a cell in both a row and column counts once), removing
both normal blocks and rubble. Never clear 3×3 subgrids.

## Timed pieces

Each placed shape becomes one timed piece instance. All its cells share: a
unique piece-instance ID, remaining-turn count, placement turn, and color.
Partial clear keeps the timer running on the remaining cells; clearing every
cell of the piece defuses it.

### Initial timer values (central balance config, never hardcoded)

| Run turn | Starting countdown |
| -------- | -----------------: |
| 1–15     |            7 moves |
| 16–40    |            6 moves |
| 41–75    |            5 moves |
| 76+      |            4 moves |

Tutorial always starts at 7.

### Turn-resolution order

See `docs/ARCHITECTURE.md` — the 17-step order is gameplay-critical and
lives there as the single source so it isn't duplicated out of sync.

### Timer display

Countdown attached to the piece instance; render on the top-left surviving
cell where possible. States: 7–5 normal, 4–3 caution, 2 warning pulse, 1
urgent pulse + stronger haptic, 0 explosion. Never rely on color alone —
always show the number.

## Explosions

When a timed piece hits zero with cells remaining:

1. Remove the timer record.
2. Convert surviving cells of that piece into rubble.
3. Find orthogonally adjacent empty cells around the expired piece.
4. Convert up to 4 adjacent empty cells into rubble.
5. Select adjacent cells deterministically via the run's seeded RNG.
6. Emit one explosion animation for that piece.
7. Record the rubble cells created.
8. No automatic line clear from explosion-created rubble.
9. Continue the run unless no hand piece can fit.

Simultaneous expirations (same turn): resolve as one simultaneous phase, cap
newly added adjacent rubble at 6 cells total for the turn, deterministic
ordering, no recursive explosions.

## Rubble

Occupies a cell, blocks placement, has no timer, awards no placement score,
removable only by completing its row/column, visually distinct damaged
appearance.

## Game over

Run ends when none of the current-hand pieces can fit anywhere on the board.
An explosion never ends the game by itself — damage is recoverable.

## Revive (one rewarded use per run)

On earned reward: remove all rubble, add 2 moves to every active timer
(cap 9), replace hand with three small/medium pieces, reset combo to 0,
resume the same score, mark revive used. If the ad fails/closes/is
unavailable: do not change game state, preserve the game-over state, allow
retry only if the ad service reports a recoverable failure.

## Freeze power-up (max 2 rewarded uses per run)

"Freeze all timers for the next two successful placements." Newly placed
pieces still get normal timers; existing timers don't decrease during frozen
turns; the freeze counter decrements after each successful placement; freeze
doesn't stop UI animation or input.

## Defuse power-up (max 2 rewarded uses per run)

"Permanently defuse the piece with the lowest remaining timer." Timer record
removed, cells remain as normal untimed blocks, ties resolved
deterministically. Don't offer if no active timed pieces exist.

## Repair latest blast (feature-flagged, post-MVP testing only)

Removes rubble created by the most recent explosion only. Not in the initial
public interface unless testing shows revive opportunities are too rare.

## Scoring

All values configurable, never hardcoded in components/reducer.

- Placement: 1 point per placed cell.
- Line clear: 100 points per cleared line.
- Multi-line bonus multiplier: 1 line → 1×, 2 → 1.5×, 3 → 2×, 4+ → 3×.
- Combo: increases when consecutive placements each clear ≥1 line; a
  no-clear placement resets it. Multiplier `1 + 0.25 × comboStreak`, capped
  at 3× for MVP.
- Defuse bonus: `25 + 10 × remainingTimer` when every cell of a timed piece
  is cleared.
- Explosion penalty: reset combo, −50 points, score floor 0.
- Best score persists locally; no online leaderboard required.

## Bolts currency

`Bolts = floor(score / 250) + successfully defused pieces` per run, earned at
run end. Double-reward offer at final results: "Watch an ad to double this
run's Bolts" — only if the player didn't revive through an unfinished ad
flow, an ad is available, and the reward hasn't already been doubled.

## Themes

Five programmatic themes for MVP: Default, Neon, Ice, Lava, Midnight. They
change block colors, board background, rubble appearance, particle colors,
and selected UI accents — never gameplay.

## Tutorial

Playable, not text-heavy, fixed board and piece sequence, no ads, no
interstitial after completion, replayable from Settings, skippable after the
first instructional placement. Six scripted steps: place a simple piece →
complete a row/column → introduce a timer → save a timer at one move → show
a controlled explosion → clear rubble through a line.
