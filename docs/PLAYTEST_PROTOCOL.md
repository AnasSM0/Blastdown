# BlastDown V1 Human Playtest Protocol

## Purpose and first round

Run an initial observational round with 5–10 people: include both people who
regularly play block puzzles and people who do not. This is an evidence gate for
timer comprehension, fairness, feedback load, and replay intent—not a balance
vote and not proof of product-market fit.

Use a development/internal Android build. Reset playtest evidence before each
participant. Do not explain the timer beyond the actual tutorial. Do not coach
during the first run unless the participant is completely stuck. Record with a
separate participant code (for example P01) in the research notes; never put a
name or contact detail into the app export.

## Device sheet

Before play, record manually:

- participant code and block-puzzle familiarity (low/medium/high)
- device model and Android version (no IMEI, serial, ad ID, or location)
- renderer OFF (`EXPO_PUBLIC_CINEMATIC_BOARD=0`) or ON
  (`EXPO_PUBLIC_CINEMATIC_BOARD=1`)
- short or normal screen

During play, note time to explain the timer correctly, first explosion reaction,
first intentional natural defuse, confusion points, run count, voluntary Play
Again, obvious frame drops, touch lag, audio/haptic issues, thermal issues, and
crashes. Do not silently combine renderer cohorts.

## Test sequence

1. Open Settings → Development effect harness and press **RESET PLAYTEST DATA**,
   then **CONFIRM RESET**.
2. Return Home. Ask the participant to complete or skip the real tutorial and
   play without explanation.
3. Observe the first run silently. Ask neutral prompts only after the run.
4. Let Results remain untouched long enough to see whether Play Again is
   voluntary. If the participant chooses Home, do not redirect them.
5. Continue for additional voluntary runs, normally stopping at 15–20 minutes.
6. Open Settings → Development effect harness and press **EXPORT PLAYTEST
   DATA**. Share the JSON to an approved local research location and label the
   file with participant code plus renderer cohort outside the JSON.
7. Record the questionnaire answers and device observations separately.

## Short post-session questionnaire

1. What did the number on the blocks mean?
2. How did you stop a block from exploding?
3. Did you understand why your first explosion happened?
4. Did the first explosion feel too early, about right, or too late?
5. Did you ever feel there was nothing reasonable you could do?
6. Were timer warnings too weak, clear, or annoying?
7. Did line clears feel satisfying?
8. Did explosions feel fair?
9. Was anything visually overwhelming?
10. Did any sound become annoying?
11. Did you notice Freeze? Did you notice Defuse? Which seemed more useful?
12. Did you want to play again? What caused you to stop?

Answers stay in the research worksheet, not the app JSON. Capture close
paraphrases without unrelated personal information.

## Acceptance hypotheses

These are hypotheses awaiting human results, not current pass/fail claims:

- H1: Most players correctly explain the timer after the tutorial/first run.
- H2: Most players understand how to naturally defuse a piece.
- H3: The first explosion is usually understood rather than perceived as random.
- H4: At least half voluntarily start another run in the first round.
- H5: Timer warning audio is not irritating across repeated runs.
- H6: Early explosion timing is not consistently reported as too early.
- H7: Repeated-shape hands are not disproportionately present in reported
  frustration or terminal states.
- H8: Feedback remains readable, with no repeated report of visual/audio overload.

Review telemetry and questionnaire evidence together. Do not change balance
from a single outlier, simulator data, or one renderer cohort. Physical Android
qualification (`A-DEVICE-PENDING`) remains open until device observations return.
