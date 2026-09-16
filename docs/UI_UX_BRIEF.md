# BlastDown — UI/UX Brief

**Document:** `UI_UX_BRIEF.md`
**Product:** BlastDown
**Version:** 1.0 Draft
**Status:** For Product Owner Review
**Primary platform:** Android
**Orientation:** Portrait
**Related documents:** `PRD.md`, `TECHNICAL_DESIGN.md`, `APP_FLOW.md`, `BUILD_SPEC.md`, `ANIMATION_SPEC.md`, Visual Identity & Game Feel Specification

## A-04 V1 Scope Lock

V1 production UI includes Home, Tutorial, Gameplay, Pause, Results, and
Settings plus required consent/privacy surfaces. Rewarded Freeze and Defuse
are the only ad offers. Bolts, Themes/economy, Double Bolts, rewarded Revive,
and interstitial UI are excluded. Older mockups showing them are visual history,
not implementation requirements.

---

# 1. Purpose

This document defines what BlastDown should look and feel like across every production screen, component, interaction, state, and supported mobile size.

It covers:

- visual identity;
- layout hierarchy;
- typography;
- color and lighting;
- board and tile presentation;
- HUD;
- piece tray;
- timer states;
- placement previews;
- line clears;
- explosions;
- praise/celebration feedback;
- danger atmosphere;
- rewarded-action UI;
- Home;
- Tutorial;
- Pause;
- Results;
- Settings;
- privacy/consent surfaces;
- loading states;
- empty states;
- errors;
- offline states;
- accessibility;
- responsive behavior;
- reduced motion;
- development-only UI.

This document defines **presentation and interaction quality**, not gameplay rules.

---

# 2. Experience Goal

BlastDown should feel like the player is operating a compact futuristic reactor-control board rather than manipulating generic colored rectangles.

The desired emotional cycle is:

```text
calm planning
→ visible risk
→ rising pressure
→ planned clear
→ reward / relief
→ renewed danger
→ clutch save or explosion
→ immediate desire to try again
```

The game should feel:

- fast;
- tactile;
- readable;
- technical;
- neon;
- energetic;
- tense without feeling unfair;
- polished without requiring complex illustrated assets.

The defining visual formula is:

> **Dark technical substrate + emissive tiles + readable countdown pressure + controlled escalation.**

---

# 3. Core Design Principles

## 3.1 Board First

The 8×8 board is always the most important visual element.

Nothing else should visually overpower it.

In particular:

- power-ups must not dominate;
- the tray must support the board;
- score must remain secondary to gameplay;
- decorative framing must never reduce board usability.

---

## 3.2 Light Is the Primary Visual Language

BlastDown's premium appearance should come primarily from:

- outer glow;
- inner highlights;
- rim lighting;
- line sweeps;
- bloom;
- danger vignette;
- controlled flashes.

Do not rely primarily on particle quantity.

---

## 3.3 Predict Before Reward

Important outcomes should be communicated before they happen where possible.

Most importantly:

> A placement that would clear a line must preview that clear before the player releases the piece.

---

## 3.4 Clear Feedback Hierarchy

Feedback intensity must escalate.

```text
ordinary placement
<
single clear
<
double clear
<
triple clear
<
OVERLOAD
<
clutch / rare recovery
```

If every event is loud, no event feels special.

---

## 3.5 Danger Must Be Readable

A timer should communicate danger through:

- its number;
- color;
- pulse;
- ambient lighting;
- sound;
- haptic feedback where enabled.

Never rely on color alone.

---

## 3.6 Performance Is Part of UX

A visual effect is a UX failure if it causes:

- input lag;
- dropped gestures;
- black tiles;
- frame stutter;
- progressive slowdown;
- delayed feedback;
- animation restarts;
- resource leaks.

---

## 3.7 One-Finger Portrait Play

Core gameplay should remain comfortable with one hand.

Primary controls should not require precision interaction near system edges.

---

# 4. Flagship Theme — Neon

The flagship V1 visual identity is **Neon**.

Use a near-black indigo environment so tile light appears emitted rather than merely saturated.

---

# 5. Core Color Tokens

| Token             | Value     | Use                      |
| ----------------- | --------- | ------------------------ |
| `bg.void`         | `#070A18` | Main app background      |
| `bg.board`        | `#0E1430` | Board substrate          |
| `bg.cellA`        | `#151C3D` | Empty cell A             |
| `bg.cellB`        | `#111737` | Empty cell B             |
| `stroke.grid`     | `#1E2A55` | Cell borders             |
| `stroke.bezel`    | `#2E7CA8` | Technical frame          |
| `glow.ambient`    | `#3AA0D8` | Board rim glow           |
| `text.primary`    | `#F5F8FF` | Main text                |
| `text.secondary`  | `#AAB9C8` | Labels                   |
| `text.muted`      | `#66758A` | Disabled/supporting text |
| `danger.warning`  | `#F2A03C` | Warning                  |
| `danger.critical` | `#FF4A3D` | Critical/explosion       |
| `success`         | `#5BD84F` | Defuse/success           |

Empty cells should alternate subtly between `cellA` and `cellB` so the board does not read as one flat rectangle.

---

# 6. Tile Color System

Each tile color has:

1. a face;
2. an inner highlight;
3. a separate glow color.

| Tile    | Face      | Highlight | Glow      |
| ------- | --------- | --------- | --------- |
| Magenta | `#E8318F` | `#FF7DC0` | `#FF4FA8` |
| Cyan    | `#1FC8E8` | `#8CF0FF` | `#4FE0FF` |
| Amber   | `#F2A03C` | `#FFD08A` | `#FFB84F` |
| Violet  | `#8B4FE8` | `#C79CFF` | `#A66FFF` |
| Lime    | `#5BD84F` | `#A8FF9C` | `#7DFF6F` |
| Azure   | `#3F7BE8` | `#8FB4FF` | `#5F9AFF` |

The glow should never simply be the same color/value as the tile face.

---

# 7. Tile Anatomy

Each occupied cell should visually feel like a lit object.

Recommended layers:

1. **Outer glow**
2. **Colored face**
3. **Top-left inner highlight**
4. **Inset border**
5. **Content / number**
6. **Timer treatment where required**

### Outer glow

Approximate direction:

```text
opacity: ~55%
blur radius: ~40% of cell size
extension: ~25% beyond tile bounds
```

### Face

Rounded rectangle.

Recommended radius:

```text
~20–22% of cell size
```

### Inner Highlight

Subtle top-left lighting gradient.

### Inset Border

Thin highlight stroke just inside the face.

Tiles must remain individually distinguishable during bloom.

---

# 8. Empty Cells

Empty cells should be visible but quiet.

Use:

- dark fill;
- subtle alternating tone;
- thin technical border;
- no strong permanent glow.

Occupied tiles should immediately dominate empty cells.

---

# 9. Board Substrate

The board should feel recessed into a technical housing.

Required qualities:

- dark indigo base;
- clearly readable 8×8 structure;
- subtle checker variation;
- thin grid strokes;
- controlled depth;
- rim lighting;
- technical frame.

Avoid unnecessary decorative graphics inside gameplay space.

---

# 10. Board Bezel

The board housing helps turn the grid into a “device.”

Recommended details:

- four corner brackets;
- approximately 2 px technical strokes;
- short top/bottom hairline rules;
- small gaps/ticks;
- recessed inner board shadow;
- subtle ambient rim;
- optional small diegetic combo indicator.

The bezel must remain secondary to the cells.

---

# 11. Typography

Use a geometric, modern sans-serif with excellent numeral readability.

Do not introduce an unlicensed custom font.

Until a final font is approved, use a strong platform/system fallback.

---

# 12. Timer Typography

Timer numerals require:

- tabular figures;
- bold weight;
- high contrast;
- stable width.

A countdown that visually shifts as:

```text
7 → 6 → 5
```

will look unpolished.

---

# 13. Score Typography

Score must use tabular figures.

Current score:

- strong;
- large;
- clean;
- centered where possible.

Best score:

- smaller;
- quieter;
- clearly aligned.

---

# 14. Praise Typography

Praise words should be:

- uppercase;
- heavy;
- wide;
- tightly tracked;
- slightly italic/skewed for higher tiers.

Recommended skew:

```text
6–8°
```

This is the loudest typography in the game.

---

# 15. Spacing System

Use an 8-point primary rhythm with 4-point half steps.

Recommended:

```text
4
8
12
16
24
32
40
48
```

Avoid arbitrary spacing values unless visually required.

---

# 16. Gameplay Screen Hierarchy

Vertical priority:

```text
safe area
↓
HUD
↓
board
↓
piece tray
↓
Freeze / Defuse
↓
bottom safe area
```

The board receives the largest reliable square area.

---

# 17. Current Score

Current score should be visually prominent without dominating the screen.

Recommended behavior:

- bright neutral color by default;
- tabular figures;
- strong alignment;
- score slam on meaningful gain.

Avoid permanently using warning orange/red for the normal score because those colors should communicate danger.

---

# 18. Best Score

Best Score should be secondary.

Recommended:

```text
BEST
958
```

Use muted text and smaller scale than current score.

---

# 19. Pause Button

Pause must:

- be immediately recognizable;
- have at least a 44–48 dp interaction target;
- remain visually lighter than the board;
- sit safely within the top area.

Avoid an unnecessarily large decorative circle.

---

# 20. Gameplay Board Size

The board should occupy the largest practical width.

Requirements:

- centered;
- square;
- minimal wasted horizontal margins;
- enough external clearance for glow;
- bezel not clipped;
- timer treatment not clipped.

On short screens, reduce vertical gaps before significantly shrinking the board.

---

# 21. Piece Tray

The tray should feel visually connected to the board.

Structure:

```text
[ Piece 1 ] [ Piece 2 ] [ Piece 3 ]
```

---

# 22. Tray Piece Scale

Piece previews should occupy approximately:

```text
65–80%
```

of available slot bounds where practical.

A one-cell piece must still appear substantial.

A one-cell piece should not look like a tiny dot inside a large empty container.

---

# 23. Tray Slot Styling

Use:

- dark/translucent background;
- subtle border;
- low glow;
- stronger selected state;
- clearly inactive used state.

Do not use large heavy cards.

---

# 24. Tray Position

The tray should sit relatively close to the board.

Remove excessive empty space between:

```text
board
and
piece tray
```

before shrinking core gameplay elements.

---

# 25. Piece Pickup

Recommended feedback:

```text
lift ~4 px
scale 1.00 → 1.06
soft glow increase
~120 ms spring
```

Haptic:

```text
selection tick
```

The piece should immediately feel attached to the user's gesture.

---

# 26. Drag Ghost

When dragging over the board:

- show ghost preview at approximately 35% opacity;
- illuminate target cell borders;
- retain readable board state beneath;
- avoid covering important timer information.

---

# 27. Valid Placement

Valid placement preview should clearly communicate:

```text
this piece can go here
```

without prematurely modifying board state.

---

# 28. Invalid Placement

Invalid targets should use a critical/red treatment.

Recommended:

```text
flash near #E8536F
~180 ms
```

On release:

- piece springs back;
- warning haptic where enabled;
- short invalid SFX where enabled.

Do not show a modal.

---

# 29. Pre-Clear Line Preview

This is a mandatory V1 UX feature.

When the current valid drag position would complete a line:

- illuminate the entire row/column;
- use roughly 50% light intensity;
- slowly pulse;
- show both row and column for simultaneous clears;
- emphasize the intersection;
- trigger one light haptic when entering the clear-producing anchor.

The feedback ends when:

- anchor changes;
- placement becomes invalid;
- pointer leaves board;
- piece is released.

Purpose:

> **Make a clear feel planned rather than accidental.**

---

# 30. Valid Placement Animation

On ordinary placement:

```text
cells scale 0.85 → 1.0
~18 ms stagger per cell
~200 ms total
```

Optional:

- tiny dust/spark accent;
- light impact haptic;
- short placement SFX.

Normal placement should remain restrained.

---

# 31. Single Line Clear

Recommended sequence:

```text
white flash
→ directional sweep
→ controlled breakup/dissolve
→ score impact
→ CLEAR / NICE
```

Indicative duration:

```text
~450 ms
```

Haptic:

```text
medium impact
```

No screen shake is required for one line.

---

# 32. Double Clear

Use:

```text
DOUBLE
```

Visual escalation:

- crossing sweeps if appropriate;
- brighter intersection;
- small shake;
- stronger SFX.

Indicative shake:

```text
2 px
150 ms
```

---

# 33. Triple Clear

Use:

```text
TRIPLE BLAST
```

Recommended:

- stronger bloom;
- larger praise;
- stronger sound;
- moderate shake.

Indicative shake:

```text
4 px
250 ms
```

---

# 34. Quad+ Clear

Use:

```text
OVERLOAD
```

This is one of the highest standard gameplay events.

Recommended:

- cyan-white bloom;
- optional short hit-stop;
- heavy haptic;
- stronger combo audio;
- larger praise.

Indicative shake:

```text
7 px
350 ms
```

Indicative total effect:

```text
~900 ms
```

Gameplay input must not depend on effect completion.

---

# 35. Praise System

Only one primary praise word should dominate at a time.

Higher-tier praise replaces lower-tier praise.

---

# 36. Praise Tier 1

Frequent and restrained:

```text
CLEAR
NICE
```

Small/local treatment.

No voice requirement.

---

# 37. Praise Tier 2

Multi-line:

```text
DOUBLE
TRIPLE BLAST
OVERLOAD
```

Medium center-board treatment.

---

# 38. Praise Tier 3

Defuse/recovery:

```text
DEFUSED
CLOSE ONE
CLUTCH!
DOUBLE DEFUSE
SALVAGED
```

Large and distinctive.

---

# 39. Praise Tier 4

Rare achievements may use:

```text
MELTDOWN AVERTED
FLAWLESS
CHAIN REACTION
UNSTOPPABLE
REBUILT
```

These must remain rare.

Do not use the highest tier so frequently that it loses meaning.

---

# 40. Praise Semantics

Important:

```text
ordinary clear ≠ DEFUSED
```

Suggested defuse mapping:

```text
3+ turns remaining → DEFUSED
2 turns remaining  → CLOSE ONE
1 turn remaining   → CLUTCH!
```

Actual domain conditions remain authoritative.

---

# 41. Praise Entrance Motion

Recommended:

```text
scale 1.4
→ 0.95
→ 1.0

opacity 0 → 1 over ~120 ms

slight upward drift
hold
fade + upward drift ~200 ms
```

Higher tiers may use more bloom and larger scale.

---

# 42. Timer Badge Placement

Timer UI should feel part of the block.

Avoid large circles floating across grid boundaries.

Recommended:

- smaller;
- inside/tightly anchored to tile;
- top-left surviving cell;
- enough spacing from cell border;
- no unnecessary overlap with neighboring cells.

---

# 43. Timer States

| Remaining | State     | Presentation            |
| --------: | --------- | ----------------------- |
|       7–5 | Normal    | Cool/stable             |
|       4–3 | Caution   | Slight warmth           |
|         2 | Warning   | Amber pulse             |
|         1 | Urgent    | Red/faster pulse/jitter |
|         0 | Explosion | Explosion feedback      |

Always show the number.

---

# 44. Timer 2

At:

```text
2
```

Recommended:

- amber;
- two-beat pulse;
- subtle warning sound;
- no modal;
- no gameplay interruption.

---

# 45. Timer 1

At:

```text
1
```

Recommended:

- critical red;
- faster pulse;
- optional small RGB split/jitter;
- warm board vignette;
- warning haptic;
- higher warning sound.

Reduced Motion should remove jitter while keeping urgency.

---

# 46. Danger Lighting

Use the lowest active timer as the primary ambient danger signal.

| Lowest Timer | Vignette         | Pulse |
| -----------: | ---------------- | ----: |
|           5+ | Cool blue subtle | 2.0 s |
|            4 | Neutral          | 1.6 s |
|            3 | Faint warm       | 1.2 s |
|            2 | Amber            | 0.8 s |
|            1 | Strong red       | 0.5 s |

The lighting should make danger perceptible even before the user consciously reads the timer.

---

# 47. Ambient Background

The large dark background shape/light behind the board should serve a gameplay purpose.

Use it to communicate:

- ambient board energy;
- rising danger;
- recovery;
- major clears.

Do not leave it as purely decorative static geometry.

---

# 48. Natural Defuse

When line clearing removes the remaining cells of a timed piece:

- success bloom;
- timer visibly resolves;
- success rim light;
- praise;
- success SFX;
- appropriate haptic.

This should feel different from an ordinary clear.

---

# 49. Clutch Defuse

A defuse at timer 1 is a signature BlastDown moment.

Use:

```text
CLUTCH!
```

Recommended:

- stronger board rim light;
- large praise;
- success burst;
- distinctive SFX;
- stronger haptic.

It should remain below only the rarest Tier 4 moments.

---

# 50. Explosion

Explosion feedback should be the strongest failure-adjacent gameplay event.

Recommended sequence:

```text
critical flash
→ shockwave
→ board-group shake
→ neighboring reaction
→ rubble impact
→ dust/debris
→ settle
```

Indicative color:

```text
#FF4A3D
```

Indicative duration:

```text
~800 ms
```

Indicative shake:

```text
8 px
350 ms
```

---

# 51. Multiple Explosions

Multiple simultaneous explosions may escalate shake and bloom but must remain understandable.

Indicative shake maximum:

```text
12 px
500 ms
```

Do not stack multiple independent full-screen flashes without coordination.

---

# 52. Explosion Readability

After an explosion:

- final rubble layout should become readable quickly;
- the player should understand what changed;
- effects should not cover the board for several seconds;
- input should remain available according to game state.

---

# 53. Rubble

Rubble must not look like a normal tile recolored grey.

Use:

- cracked/damaged face;
- low saturation;
- charred or technical debris texture;
- reduced glow;
- strong blocked-state readability.

---

# 54. Rubble Clear

Recommended sequence:

```text
crack
→ crumble
→ green repair sweep
→ clean cell
```

Indicative duration:

```text
~500 ms
```

Haptic:

```text
medium
```

---

# 55. Score Slam

On a meaningful score increase:

```text
count up quickly
scale → ~1.3
spring → 1.0
```

Do not use a long smooth number tween that trails behind gameplay.

---

# 56. Combo Indicator

Combo should remain compact.

Recommended behavior:

```text
increment
→ oversized pop/slam
→ settle

combo lost
→ desaturate
→ drop/fade
```

Optional bezel segments can reinforce combo without occupying more screen space.

---

# 57. Power-Up Area

Core V1:

```text
FREEZE
DEFUSE
```

Recommended:

```text
[ FREEZE ] [ DEFUSE ]
```

These controls should be easy to find but visibly secondary to the board.

---

# 58. Power-Up Size

Power-up controls should be relatively compact.

Avoid tall cards that consume a large part of the bottom half.

Reduce visual height before shrinking board/tray interaction space.

---

# 59. Freeze Button

Visual identity:

- cyan/ice accent;
- snowflake or technical freeze icon;
- concise label;
- small rewarded-ad badge.

States:

```text
available
pressed
loading
ad opening
earned
unavailable
usage limit reached
offline
```

---

# 60. Defuse Button

Visual identity:

- lime/success accent;
- defuse/bolt technical icon;
- small rewarded-ad badge.

Disable when no timed piece exists.

Do not allow an ad to be watched when the reward cannot be applied.

---

# 61. Rewarded-Ad Badge

The ad indicator should be clearly visible but small.

Recommended:

```text
AD
```

or a small play/video symbol + `AD`.

It should not become the strongest part of the button.

---

# 62. Reward Confirmation

Before an ad, show a compact confirmation surface.

Example:

```text
FREEZE TIMERS

Freeze all active timers for the
next two successful placements.

[NOT NOW] [WATCH AD]
```

For Defuse:

```text
DEFUSE

Permanently defuse the most urgent
timed piece.

[NOT NOW] [WATCH AD]
```

---

# 63. Reward Loading State

Use local feedback:

```text
Loading ad…
```

or button spinner.

Do not block the entire app with an indefinite loading screen.

---

# 64. Reward Failure

Use concise recoverable copy:

```text
Ad unavailable right now.
Try again later.
```

Return immediately to Gameplay.

No alarming error styling is required.

---

# 65. Pause Overlay

Pause overlays the current game.

Recommended hierarchy:

```text
PAUSED

RESUME

Restart
Settings
Home
```

Optional quick toggles:

```text
Sound
Music
Haptics
```

---

# 66. Pause Background

Use:

- dark translucent scrim;
- visible board beneath;
- reduced/inactive board lighting.

The player should still recognize the run they paused.

---

# 67. Restart Confirmation

Use a simple destructive modal:

```text
RESTART THIS RUN?

Your current score will be lost.

[CANCEL] [RESTART]
```

Only `RESTART` uses destructive color.

---

# 68. Home Screen

Home should feel calmer than Gameplay.

Core V1 hierarchy:

```text
BlastDown logo

BEST SCORE

PLAY

Settings
How to Play
Privacy
```

`PLAY` must be unmistakably primary.

Do not place an ad on app launch.

---

# 69. Home Atmosphere

Use subtle ambient energy:

- slow reactor glow;
- soft background motion;
- minimal light animation.

No large explosions or intense effects should run continuously on Home.

---

# 70. Tutorial

Tutorial should use Gameplay visuals rather than separate diagrams where possible.

Each step:

- one short instruction;
- one highlighted target;
- minimal inactive UI;
- deterministic board;
- deterministic piece.

Avoid long explanations.

---

# 71. Tutorial Copy

Recommended short messages:

```text
Drag a block onto the board.
```

```text
Complete a row or column to clear it.
```

```text
Every placed piece has a countdown.
```

```text
Clear every cell before the timer reaches zero.
```

```text
Expired pieces create rubble.
```

```text
Complete its row or column to repair the board.
```

---

# 72. Game Over

Recommended sequence:

- board desaturates;
- activity settles;
- remaining timers resolve visually;
- short zoom/settle;
- Game Over sound/haptic;
- move to Results.

Indicative duration:

```text
~1.2 s maximum
```

---

# 73. Results

Core hierarchy:

```text
FINAL SCORE

NEW BEST
when applicable

small run-stat summary

PLAY AGAIN

HOME
```

`PLAY AGAIN` should be the most obvious action.

---

# 74. Results Statistics

Show only useful summary information.

Possible:

- lines cleared;
- pieces placed;
- defuses;
- explosions;
- best combo.

Do not turn Results into an analytics dashboard.

---

# 75. New Best

New Best deserves a stronger but short celebration.

Recommended:

- `NEW BEST`;
- score glow;
- scale accent;
- short reward SFX;
- optional sparkle.

No separate achievement screen.

---

# 76. Settings

Core V1:

```text
Sound Effects
Music
Haptics
Reduced Motion

Replay Tutorial

Privacy Choices
Privacy Policy

App Version
```

Use clean list rows and switches.

No Save button.

---

# 77. Settings States

Switch changes should feel immediate.

Possible states:

- On;
- Off;
- pressed;
- disabled;
- unavailable.

Persist automatically.

---

# 78. Privacy / Consent

Use calm, factual language.

Do not:

- obscure privacy options;
- pressure users toward personalized ads;
- imply that personalized ads are required to play.

---

# 79. Loading States

## App Startup

Use:

- dark branded background;
- wordmark/logo;
- subtle light pulse.

Only show a spinner if loading is visibly delayed.

## Audio

Background/invisible.

## Analytics

Background/invisible.

## Ads

Local button/modal state.

---

# 80. Empty States

### No Best Score

Use either:

```text
BEST —
```

or:

```text
BEST 0
```

Pick one convention.

### No Timed Pieces

Defuse is disabled.

### No Active Run

Simply show:

```text
PLAY
```

### No Ad Inventory

Rewarded button becomes unavailable.

---

# 81. Error States

Recoverable failures should use:

- toast;
- inline status;
- small modal.

Examples:

```text
Ad unavailable
Could not save setting
Audio unavailable
```

Avoid full-screen errors for optional-service failures.

---

# 82. Offline State

Do not display a persistent global offline warning during normal play.

Gameplay should look normal.

When the user tries a network-dependent feature:

```text
Ads require an internet connection.
```

---

# 83. Primary Button Style

Use for:

- Play;
- Play Again;
- Watch Ad after user chooses reward.

Characteristics:

- strong contrast;
- clear label;
- large interaction target;
- restrained glow.

---

# 84. Secondary Button Style

Use for:

- Settings;
- Home;
- Not Now;
- Resume where appropriate.

Less visually dominant.

---

# 85. Destructive Button Style

Use only for:

- Restart;
- discard current run.

Use critical red sparingly.

---

# 86. Touch Targets

Target approximately:

```text
44–48 dp minimum
```

Visible icons may be smaller inside the interactive area.

---

# 87. Motion Language

Use motion to explain:

- selection;
- validity;
- causality;
- success;
- danger;
- transition.

Avoid motion purely because the screen seems empty.

---

# 88. Spring Motion

Use springs for:

- pickup;
- placement settle;
- score slam;
- praise pop;
- returning invalid pieces.

---

# 89. Timed Motion

Use timed/eased animation for:

- line sweeps;
- bloom;
- danger pulse;
- fades;
- modal transitions;
- game-over settling.

---

# 90. Hit-Stop

Potential major-event treatment:

```text
60–90 ms
```

Only for events such as:

- triple clear;
- Overload;
- explosion.

Never block the JS thread.

Disable/reduce under Reduced Motion.

---

# 91. Effect Concurrency

Several effects may be active together.

UX rules:

- higher priority dominates visually;
- no effect should erase another event's meaning;
- only one primary praise message;
- avoid stacking several full-screen blooms;
- input remains responsive.

---

# 92. Particle Limit

Maximum upper guardrail:

```text
40 concurrent particles board-wide
```

Initial production tuning should use fewer wherever possible.

Prefer:

```text
light
sweep
bloom
rim light
```

over particle density.

---

# 93. Ambient Breathing

Optional subtle idle effect:

```text
tile scale
1.000 ↔ 1.005

~3 s cycle
```

Use one shared animation signal.

Disable under Reduced Motion.

Remove if hardware testing shows unnecessary cost.

---

# 94. Post-Clear Rim Light

For approximately:

```text
200 ms
```

surviving tiles adjacent to a cleared line may receive a bright edge facing the clear.

This makes the board feel like one lit environment.

---

# 95. Tray Warning

If the domain determines only one hand piece can still fit:

- dim unusable pieces;
- highlight the usable piece.

This helps impending failure feel foreseeable.

Only use this if backed by authoritative placement selectors.

---

# 96. Background Music UX

Gameplay music should be:

- futuristic;
- electronic;
- restrained;
- seamless;
- non-vocal;
- approximately 95–110 BPM.

It should sit below SFX in the mix.

---

# 97. Audio Importance Hierarchy

```text
explosion / clutch save
>
major multi-clear
>
single clear
>
placement
>
UI tap
```

Ordinary actions should remain quiet.

---

# 98. Combo Pitch

Use one base clear sound where practical.

```text
combo 1 = base
combo 2 = +1 semitone
combo 3 = +2
...
cap = +12
```

Reset on combo break.

---

# 99. Explosion Audio

Explosion should briefly dominate the mix.

Where practical:

- low-frequency impact;
- short music/SFX duck;
- fast smooth recovery.

Do not suppress subsequent player feedback for too long.

---

# 100. Haptic Hierarchy

| Event        | Haptic                 |
| ------------ | ---------------------- |
| Pickup       | Selection tick         |
| Placement    | Light                  |
| Single clear | Medium                 |
| Multi-clear  | Stronger/double medium |
| Timer 1      | Warning tick           |
| Defuse       | Success                |
| Clutch       | Strong success         |
| Explosion    | Heavy/rumble           |
| Game Over    | Long warning           |

All haptics respect the global toggle.

---

# 101. Reduced Motion

Reduce/remove:

- shake;
- hit-stop;
- large overshoot;
- idle breathing;
- aggressive bloom motion;
- RGB jitter;
- long travel.

Keep:

- timer numbers;
- clear preview;
- praise text;
- score changes;
- danger status;
- success/error communication.

---

# 102. Colorblind Support

Color must not be the only channel.

Use secondary cues such as:

- numerical timers;
- iconography;
- luminance;
- border thickness;
- pattern.

A colorblind-safe theme may use a blue → amber → white luminance ramp with different border weights.

---

# 103. Accessibility Labels

Label key controls:

- Play;
- Pause;
- Score;
- Best Score;
- Settings;
- Freeze;
- Defuse;
- rewarded-ad nature of reward controls;
- Results actions;
- tutorial actions.

---

# 104. Copy Tone

BlastDown language should sound:

- concise;
- technical;
- controlled;
- energetic without being childish.

Good examples:

```text
CLEAR
DEFUSED
CLUTCH!
OVERLOAD
MELTDOWN AVERTED
```

Do not copy vocabulary strongly associated with competing puzzle games.

---

# 105. Small-Screen Behavior

On narrow Android screens:

- reduce side padding first;
- preserve board size where possible;
- maintain enough margin for glow;
- keep tray pieces readable;
- keep power-up labels legible;
- do not shrink touch targets below safe size.

---

# 106. Short-Height Behavior

Compression order:

```text
1. decorative vertical gaps
2. board-to-tray spacing
3. tray-to-power-up spacing
4. power-up visual height
5. secondary label sizes
6. board size only after the above
```

Gameplay must not require vertical scrolling.

---

# 107. Tall-Screen Behavior

Do not simply increase every gap.

Keep:

```text
board
tray
power-ups
```

visually grouped.

Use extra height as moderate breathing room.

---

# 108. Orientation

V1 is portrait.

Do not design a separate landscape gameplay UI unless product scope changes.

---

# 109. Development Effect Harness

Development-only.

It can be visually utilitarian.

Requirements:

- readable scenario buttons;
- deterministic labels;
- easy QA;
- no production navigation exposure;
- absent from production bundles.

---

# 110. Development Diagnostics

Use a compact translucent panel.

May show:

```text
queue depth
rendered effects
accepted
started
completed
evicted
dropped
effect IDs
priority
clock slots
session
renderer
latency
```

Do not cover core drag interaction.

---

# 111. Performance UX Guardrails

The UX is unacceptable if:

- drag visibly trails finger;
- effects disappear intermittently;
- a surviving effect restarts;
- repeated clears progressively slow;
- first audio playback is delayed;
- board flashes black;
- timers become unreadable;
- power-ups become unresponsive;
- debug UI ships in production.

---

# 112. Visual QA — Gameplay

Confirm:

- board is the visual focus;
- score is readable;
- Best Score remains secondary;
- timer badges do not obscure neighboring cells;
- one-cell tray pieces are visually substantial;
- tray sits reasonably close to board;
- power-ups do not dominate;
- pre-clear preview is obvious;
- danger is readable;
- ordinary clear never shows `DEFUSED`;
- simultaneous effects remain understandable.

---

# 113. Visual QA — Effects

Confirm:

- single clear is satisfying without excess shake;
- multi-clear visibly escalates;
- explosion is stronger than line clear;
- bloom clears quickly;
- particle count stays bounded;
- praise priority works;
- Reduced Motion remains understandable;
- effects never gate gameplay.

---

# 114. Visual QA — Navigation

Confirm:

- Home has one obvious Play action;
- Pause preserves gameplay context;
- Restart is clearly destructive;
- Results emphasizes Play Again;
- Settings is simple;
- Privacy language is factual;
- ad errors return to gameplay cleanly.

---

# 115. Device QA Matrix

Review at minimum on:

- compact Android screen;
- standard Android phone;
- tall Android phone;
- budget/low-memory device if available;
- current Android version;
- older supported Android version.

Test with:

```text
cinematic OFF
cinematic ON

Reduced Motion OFF
Reduced Motion ON

Sound OFF/ON
Music OFF/ON

online
offline

ad available
ad unavailable
```

---

# 116. Recommended UX Implementation Order

For maximum perceived improvement:

1. improve emissive tile quality;
2. implement pre-clear preview;
3. polish line-clear sweep;
4. add danger lighting;
5. add praise system;
6. improve explosion/bloom;
7. integrate production audio/music;
8. add lower-value ambient polish.

Do not prioritize rare celebration text while basic board feel remains weak.

---

# 117. Excluded Legacy Features

The original engineering specification also included:

- Bolts;
- Themes;
- Double Bolts;
- rewarded Revive;
- interstitial advertisements.

These are excluded UI surfaces under the locked V1 PRD.

Do not allocate prominent V1 screen space to them solely because older code/specification exists.

---

# 118. Post-V1 Themes Reference

If separately approved in a later product version:

- simple preview cards;
- lock/unlock state;
- selected state;
- same underlying visual token structure;
- themes change appearance only.

Themes must never affect gameplay.

---

# 119. UI/UX Definition of Done

BlastDown V1 UI/UX is ready when a new player can:

1. understand the board immediately;
2. identify score and Best Score;
3. understand the three available pieces;
4. drag without visible input lag;
5. distinguish valid and invalid placement;
6. predict a line clear before release;
7. understand timer urgency without color alone;
8. feel a clear is more important than normal placement;
9. feel clear intensity escalate with skill;
10. understand actual defuse feedback;
11. recognize explosion consequences;
12. understand Freeze/Defuse rewarded actions;
13. pause and restart easily;
14. immediately choose Play Again after Game Over;
15. play on compact Android screens without clipping;
16. use Reduced Motion without losing information;
17. play repeatedly without progressive lag or visual fatigue.

---

# 120. Final Design Principle

BlastDown should not look like separate UI widgets surrounding a grid.

The:

- board;
- timer;
- score;
- lighting;
- praise;
- tray;
- power-ups;
- sound;
- haptics;

should behave like one coherent feedback system.

The final rule is:

> **Quiet planning. Readable danger. Decisive impact.**

When nothing important is happening, the screen should breathe.

When the player makes a smart move, BlastDown should make that intelligence feel visible.
