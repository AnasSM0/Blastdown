# Human Playtest Data Schema

BlastDown's B-11 evidence is local, development-only data. It is not a
production analytics provider and it is not uploaded by the app. The canonical
TypeScript contract is `src/services/playtest/types.ts`.

## Export envelope

Each JSON export has `schemaVersion: 1`, `kind:
"blastdown-human-playtest"`, an `exportedAt` timestamp, `sessions`, and a derived
`summary`. The `kind` marker is mandatory: the analyzer rejects simulator or
unknown datasets rather than silently mixing them with human sessions.

A session contains a random local `sessionId`, app version, start/end times,
tutorial complete/skip flags, a coarse error count, renderer (`views` or
`skia`), platform, OS version, and runs. It deliberately has no participant
name, contact details, location, advertising identifier, hardware identifier,
serial number, or free-text field.

## Run evidence

Each run has a fresh random local ID plus the game's seed and start/end times.
It records authoritative totals (turn, score, combo, lines, defuses, explosions,
rubble and rewarded uses), eligibility/offer counts, first-event turns, compact
turn 1/5/10/20 milestones, hand-refill evidence, and a compact terminal context.
An explosion episode counts as recovered when a later clear or natural defuse
occurs within the next five committed turns; the metric is descriptive, not a
new game rule.

Hand evidence stores only refill index, unique-shape count, duplicate/all-three
booleans, and occupancy at generation. It does not store the board. Terminal
context stores occupancy, rubble/timer counts, remaining shape catalog IDs,
zero legal placements, recent explosion/defuse counts, repeated-hand state, and
the last committed meaningful outcome. `observedFromTurn` identifies a run that
was resumed before instrumentation observed it, so missing first-event fields
are not mistaken for evidence that an event never occurred.

Ratios and occupancy use numbers from 0 through 1. Times are Unix milliseconds.
Absent first events and unanswered replay outcomes are `null`, never fabricated
zeroes.

## Persistence and combining exports

Development builds persist the envelope under the isolated key
`blastdown/dev/playtest-evidence/v1`. Writes are debounced and terminal/session
events request an immediate flush. Storage failures are swallowed. The Reset
control removes only this key.

Save each phone's shared JSON as a separate `.json` file, then run:

```sh
npm run analyze:playtests -- path/to/export-directory
```

The dependency-free analyzer deduplicates sessions by local ID and prints
session/run counts, medians, replay and repeated-hand rates, power-up uses,
game-over occupancy, and error counts. Preserve renderer metadata and split the
OFF/ON cohorts during interpretation; the aggregate command intentionally does
not claim causality or hypothesis success.
