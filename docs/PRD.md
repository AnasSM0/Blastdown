# BlastDown — Product Requirements Document

**Document:** PRD.md\
**Product:** BlastDown\
**Version:** 1.0 Draft\
**Status:** For Product Owner Review\
**Platform:** Android-first mobile game\
**Purpose:** Define what BlastDown is, who it is for, the problem it solves, the intended player experience, and what belongs in Version 1.

## A-04 V1 Scope Lock

This PRD is the primary product source of truth for V1. The locked V1 product
includes the endless 8×8 game, a three-piece hand, move-based timers, natural
defuse, explosions and rubble, score/combo/best score, active-run persistence,
tutorial, Home/Game/Pause/Results/Settings, rewarded Freeze and Defuse,
audio/music/haptics, accessibility and reduced motion, consent/privacy,
production rewarded-ad support, analytics/crash reporting, and Android-first
release work.

V1 explicitly excludes Bolts, Themes or any economy, Double Bolts, rewarded
Revive, interstitial advertising, accounts, cloud save, leaderboards,
missions, achievements, daily systems, levels, special hazards, and
progression systems. These features must not appear in production UI or be
required by current persistence, analytics, or monetization. Deprecated stored
fields may remain parseable solely to preserve older local data.

The implementation hierarchy is PRD → Technical Design → App Flow → UI/UX
Brief → Backend Design → Engineering Plan → Game Rules → Decisions. The legacy
`BUILD_SPEC.md` is historical context only where none of those documents
supersede it.

---

## 1. Product Summary

BlastDown is a fast, replayable mobile puzzle game built around placing block-shaped pieces onto an 8×8 board, completing rows and columns, managing move-based countdown threats, and surviving increasingly dangerous board states.

The game combines the accessibility of a block-placement puzzle with a distinct reactor-management identity. Players are not only trying to create lines and maximize score; they must also manage timed threats, explosions, rubble, defuses, freezes, and escalating risk.

The intended experience is:

> **Easy to understand in seconds, satisfying on every move, increasingly tense as the board develops, and rewarding enough to encourage “one more game.”**

BlastDown should feel polished, responsive, energetic, and original rather than like a generic block puzzle with effects added on top.

---

## 2. Product Vision

BlastDown should become a highly replayable mobile puzzle game where:

- every placement feels tactile;
- successful planning is clearly rewarded;
- danger is visible before failure occurs;
- clearing multiple lines feels increasingly powerful;
- timed threats create tension without making the game feel unfair;
- optional rewarded power-ups provide meaningful recovery opportunities;
- visual effects, sound, music, haptics, scoring, and animation work together as one game-feel system;
- the game remains smooth on ordinary Android hardware.

The long-term identity should center on:

- reactor instability;
- controlled explosions;
- neon energy;
- tactical defusing;
- chain reactions;
- recovering from near-failure.

BlastDown should not rely on copying the terminology, audio, visuals, animations, characters, or branding of existing puzzle games.

---

## 3. Problem / Opportunity

Many block-placement games are mechanically understandable but become visually and emotionally repetitive.

Common weaknesses include:

- moves feeling identical;
- limited tension;
- poor anticipation before a successful clear;
- score increases without satisfying feedback;
- failure appearing suddenly rather than building naturally;
- little distinction between an ordinary move and an exceptional move;
- weak reasons to continue playing after several sessions.

BlastDown addresses this by combining a familiar placement loop with:

1. move-based timed threats;
2. explosions and rubble;
3. recovery mechanics such as Freeze and Defuse;
4. escalating audiovisual feedback;
5. predictive clear feedback;
6. score and combo reinforcement;
7. an increasingly dangerous visual atmosphere.

The result should be a game where the **board tells a story during each run**: calm beginning → increasing pressure → near failure → recovery or meltdown.

---

## 4. Target Audience

### 4.1 Primary Audience

Casual and mid-core mobile puzzle players who:

- understand drag-and-drop puzzle mechanics;
- play in short sessions;
- enjoy improving personal scores;
- like satisfying visual and audio feedback;
- appreciate strategy without complicated tutorials;
- may replay the same core game loop repeatedly.

### 4.2 Secondary Audience

Players attracted by:

- neon/sci-fi aesthetics;
- score chasing;
- risk management;
- “save at the last second” moments;
- chain reactions and combo feedback.

### 4.3 Intended Session Pattern

BlastDown should support:

- quick sessions of a few minutes;
- longer score-chasing sessions;
- immediate restart after failure;
- play with or without headphones;
- interruption and safe resume where technically appropriate.

---

## 5. Player Jobs to Be Done

The product should allow the player to feel:

### Functional

- “I can immediately understand what I should do.”
- “I can see where this piece can be placed.”
- “I can predict when a move will clear a line.”
- “I understand which timed pieces are becoming dangerous.”
- “I understand why I scored points.”
- “I understand why I failed.”

### Emotional

- “That placement felt good.”
- “I planned that clear.”
- “That combo was powerful.”
- “I nearly lost, but I recovered.”
- “I can beat my previous score.”
- “I want one more attempt.”

---

## 6. Product Principles

### 6.1 Gameplay First

Visual effects, advertisements, animations, audio, and monetization must never interfere with the correctness of the puzzle rules.

### 6.2 Predict Before Reward

Where possible, BlastDown should communicate an important outcome before it occurs.

For example, a player hovering a piece over a position that will complete a row should see that row prepare to clear.

### 6.3 Clear Hierarchy of Reward

An ordinary placement should not feel as powerful as:

- a line clear;
- a double clear;
- a triple clear;
- a successful defuse;
- a clutch recovery;
- a major chain reaction.

Feedback must escalate with accomplishment.

### 6.4 Danger Must Be Readable

Timer danger should be communicated through more than a number alone.

Color, animation, sound, and ambient lighting should support the timer state.

### 6.5 Performance Is Part of Game Feel

A visually impressive effect that causes dropped frames, input delay, crashes, or progressive lag is not acceptable.

### 6.6 Optional Monetization Must Remain Optional

Rewarded advertisements may offer meaningful help, but normal gameplay must not become unusable because an advertisement fails to load.

---

# 7. V1 Product Goals

Version 1 must establish a complete, polished core game rather than a large collection of unfinished features.

### G1 — Deliver a complete core puzzle loop

Players can:

- receive pieces;
- place pieces;
- complete lines;
- score points;
- manage timed threats;
- experience explosions/rubble;
- use available recovery mechanics;
- reach game over;
- immediately restart.

### G2 — Make actions feel satisfying

Placement, clearing, scoring, danger, defusing, explosions, rewards, and failure must have distinct visual and audio feedback.

### G3 — Make the timer system understandable

Players should always be able to identify the most urgent timed threat.

### G4 — Make achievement escalation obvious

The difference between one clear and an exceptional clear must be immediately understandable.

### G5 — Monetize without interrupting the core loop

Rewarded advertisements should provide optional player-controlled recovery/value.

### G6 — Ship a stable Android-first release

The game must perform reliably on physical Android devices, including representative lower-cost hardware.

---

# 8. V1 Scope

## 8.1 Core Board

V1 includes:

- an 8×8 gameplay board;
- occupied and empty cells;
- valid and invalid placement handling;
- responsive drag-and-drop interaction;
- clear visual separation between board cells;
- placement preview;
- completed row detection;
- completed column detection;
- simultaneous row and column clears.

The board must remain the visual center of the gameplay screen.

---

## 8.2 Piece Tray

The player receives a set of playable pieces presented below the board.

Requirements:

- pieces must be clearly visible;
- piece previews should scale appropriately within tray slots;
- one-cell pieces must not appear disproportionately tiny;
- selected pieces should visually lift from the tray;
- used pieces should clearly become unavailable;
- dragging should not obscure the intended board target;
- available pieces must remain readable across supported Android screen sizes.

---

## 8.3 Placement

A valid placement must provide immediate feedback.

Expected feedback may include:

- piece pickup response;
- subtle scale/lift;
- valid target indication;
- placement impact;
- short cell stagger;
- haptic feedback when enabled;
- placement sound when enabled.

Invalid placement must be visibly and audibly different from valid placement.

---

## 8.4 Pre-Clear Preview

V1 must include predictive feedback when the currently held piece would complete a row or column.

When the drag anchor changes to a clear-producing position:

- affected line(s) should illuminate;
- simultaneous row and column clears should both be previewed;
- their intersection may receive additional emphasis;
- the preview must disappear when the placement is no longer valid;
- the preview must not alter the actual gameplay state.

This feature is considered a high-priority part of the intended game feel because it connects player planning directly to the eventual reward.

---

## 8.5 Line Clearing

Completing a full row or column clears the appropriate cells according to the established game rules.

The player must receive clear feedback consisting of some combination of:

- flash;
- line sweep;
- controlled bloom;
- cell disappearance/breakup;
- score animation;
- sound;
- haptic feedback;
- celebration text.

Simultaneous clears must remain visually understandable.

---

## 8.6 Praise / Celebration System

Ordinary clears and exceptional outcomes must not share the same label.

Initial V1 vocabulary:

### Standard

- `CLEAR`
- `NICE`

### Multi-Clear

- `DOUBLE`
- `TRIPLE BLAST`
- `OVERLOAD`

### Defuse / Recovery

- `DEFUSED`
- `CLOSE ONE`
- `CLUTCH!`
- `DOUBLE DEFUSE`
- `SALVAGED`

### Rare / High Achievement

- `CHAIN REACTION`
- `FLAWLESS`
- `MELTDOWN AVERTED`
- `UNSTOPPABLE`
- `REBUILT`

Requirements:

- only one praise message should dominate the screen at a time;
- higher-priority messages may replace lower-priority messages;
- ordinary line clears must not incorrectly use `DEFUSED`;
- reduced-motion mode must retain readable text while suppressing unnecessary motion/bloom.

---

## 8.7 Score

V1 includes:

- current score;
- locally available best score;
- visible score increase after successful actions;
- stronger score feedback for higher-value events.

A meaningful score increase should feel impactful rather than appearing as a silent number change.

Recommended treatment:

- rapid count-up;
- brief scale increase;
- spring/settle;
- stronger treatment for exceptional scoring events.

---

## 8.8 Timed Threats

BlastDown's timed-piece system is a core differentiator.

Timed threats must:

- display their remaining move count clearly;
- update reliably according to established domain rules;
- visually become more dangerous as the timer decreases;
- distinguish safe, warning, and critical states;
- never depend only on color for comprehension.

Suggested product states:

- safe: cool/cyan;
- warning: amber;
- critical: red.

Timer transitions should also be supported by sound/haptic feedback where appropriate.

Exact countdown and explosion logic remains defined by the game rules and must not be duplicated in presentation code.

---

## 8.9 Explosion and Rubble

When a timed threat reaches the established failure condition, the corresponding explosion/rubble behavior occurs according to the domain rules.

Explosions must feel meaningfully stronger than line clears.

V1 explosion feedback should prioritize:

- strong but short impact;
- controlled board or screen reaction;
- stylized reactor burst;
- clear consequence;
- rubble readability;
- strong audio response.

Effects must remain bounded so repeated explosions do not create progressive performance degradation.

---

## 8.10 Freeze

Freeze is an optional recovery mechanic available through the existing rewarded-ad flow.

Requirements:

- the player must understand what Freeze will do before watching the ad;
- reward is granted only after the rewarded-ad condition succeeds;
- ad failure must not break gameplay;
- cancellation must safely return the player to the game;
- Freeze must follow the existing domain rule rather than implementing alternate UI logic.

---

## 8.11 Defuse

Defuse is an optional recovery mechanic available through the existing rewarded-ad flow.

Requirements:

- successful Defuse must have a distinct success state;
- `DEFUSED` must be reserved for an actual defuse outcome;
- late recovery may trigger higher-tier messages such as `CLOSE ONE` or `CLUTCH!`;
- ad failure must not modify gameplay state;
- reward application must occur exactly once.

---

# 9. Game Atmosphere

## 9.1 Calm State

At lower danger:

- cool background;
- restrained board glow;
- low-intensity ambient movement;
- minimal screen-wide effects.

## 9.2 Increasing Danger

As the most urgent countdown approaches failure:

- ambient lighting becomes warmer;
- timer emphasis increases;
- warning sounds become stronger;
- the background can react subtly to danger.

## 9.3 Critical State

At immediate danger:

- critical timer clearly pulses;
- danger lighting becomes visibly red/warm;
- warning sound is distinct;
- visual intensity rises without obscuring gameplay.

The large background treatment behind the board should serve a gameplay purpose by supporting these danger states rather than remaining purely decorative.

---

# 10. Audio Requirements

V1 should include a complete audio foundation.

## 10.1 Sound Effects

Minimum V1 sound events:

- UI tap;
- piece pickup;
- valid placement;
- invalid placement;
- line clear;
- multi-clear/combo;
- timer warning;
- critical timer warning;
- defuse;
- clutch defuse;
- freeze;
- explosion;
- rubble clear;
- reward granted;
- game over;
- best-score event where appropriate.

Sound effects must be:

- short;
- responsive;
- distinct;
- understandable on phone speakers;
- commercially licensed or created specifically for BlastDown.

---

## 10.2 Combo Pitch Escalation

Consecutive successful clears may use a rising-pitch treatment.

Initial requirement:

- first clear uses base pitch;
- each consecutive combo rises approximately one semitone;
- escalation caps at one octave;
- pitch resets when the combo chain breaks.

The result should create escalation without requiring many separate audio files.

---

## 10.3 Gameplay Music

V1 should include at least one production-quality gameplay loop.

Direction:

- futuristic electronic;
- reactor/technology atmosphere;
- approximately 95–110 BPM;
- no vocals;
- restrained melody;
- suitable for repeated listening;
- does not mask gameplay sounds;
- seamless looping.

A separate calm menu track may be included if quality and implementation time permit, but one excellent gameplay loop is more important than several mediocre tracks.

---

# 11. Haptics

Where supported and enabled:

- light haptic: selection/placement;
- medium response: meaningful clear;
- stronger response: explosion or major recovery;
- haptics must not fire excessively during rapid chained events.

Haptics are a support layer and must not be required to understand gameplay.

---

# 12. Accessibility and Player Settings

V1 should provide appropriate controls for:

- music on/off;
- sound effects on/off;
- haptics on/off;
- reduced motion.

Reduced motion should:

- reduce or eliminate shake;
- reduce large scaling effects;
- reduce excessive bloom/motion;
- preserve gameplay information;
- preserve important text such as praise and timer information.

Critical information must not rely exclusively on:

- animation;
- sound;
- color;
- haptic feedback.

---

# 13. Pause, Interruption and Resume

V1 must support:

- pausing gameplay;
- returning safely from pause;
- app backgrounding;
- app resume;
- interruption by advertisements;
- safe restoration of audio state;
- no duplication of effects/rewards after resume.

Where the game state is preserved, visual effects from a previous invalid session must not reappear incorrectly.

---

# 14. Game Over

The player must clearly understand why a run ended.

Game-over experience should provide:

- final score;
- best score where relevant;
- clear indication when a new best score is achieved;
- replay/restart action;
- access to appropriate navigation/settings actions.

Restart should be fast.

The product should encourage a “one more game” response without forcing additional steps.

---

# 15. Monetization

## 15.1 V1 Monetization Model

The currently established V1 monetization focus is rewarded advertising connected to optional gameplay assistance such as Freeze and Defuse.

Rewarded advertising must:

- be initiated intentionally by the player;
- clearly state the reward;
- grant the reward only after valid rewarded completion;
- fail safely;
- never corrupt game state;
- never grant duplicate rewards from one ad event.

## 15.2 Consent and Privacy

Production release requires:

- appropriate consent handling;
- production AdMob configuration;
- published privacy policy;
- required platform disclosures;
- correct audience classification;
- compliance with applicable store and advertising requirements.

---

# 16. Network Behavior

Core puzzle gameplay should remain functional without an active internet connection.

Network-dependent capabilities such as rewarded advertising may become unavailable.

When a network-dependent feature fails:

- gameplay continues;
- no incorrect reward is granted;
- the player receives an understandable error or unavailable state;
- the application must not crash.

---

# 17. Persistence

V1 should persist locally where appropriate:

- best score;
- gameplay preferences/settings;
- required consent/configuration state as allowed by the relevant SDK.

Account creation is not required for V1.

Cloud save is not required for V1.

---

# 18. V1 Screen-Level Product Scope

Detailed navigation will be defined in `APP_FLOW.md`.

At minimum, V1 requires product surfaces for:

- entering gameplay;
- main gameplay;
- pause;
- game over/results;
- settings;
- required privacy/consent interactions;
- rewarded-ad power-up interaction;
- development-only diagnostic surfaces that are excluded from production.

Development tools must never ship unintentionally in production bundles.

---

# 19. V1 Functional Requirements

| ID           | Requirement                                                     |
| ------------ | --------------------------------------------------------------- |
| PRD-GAME-001 | Player can complete a full game loop without account creation.  |
| PRD-GAME-002 | Board state and placement rules are deterministic and reliable. |
| PRD-GAME-003 | Row and column clears work independently and simultaneously.    |
| PRD-GAME-004 | Timed threats follow established move-based rules.              |
| PRD-GAME-005 | Explosions/rubble follow domain rules exactly.                  |
| PRD-GAME-006 | Restart creates a clean gameplay session.                       |
| PRD-UX-001   | Valid and invalid placement are visibly distinct.               |
| PRD-UX-002   | Clear-producing placements are previewed before release.        |
| PRD-UX-003   | Multi-clear reward escalates visibly.                           |
| PRD-UX-004   | Actual defuse events use dedicated praise semantics.            |
| PRD-UX-005   | Danger escalation is understandable before failure.             |
| PRD-UX-006   | Score changes provide immediate feedback.                       |
| PRD-AUD-001  | Core gameplay events have distinct SFX.                         |
| PRD-AUD-002  | Gameplay has a licensed/original production music loop.         |
| PRD-AUD-003  | Music and SFX can be independently disabled.                    |
| PRD-ACC-001  | Reduced-motion mode preserves gameplay comprehension.           |
| PRD-ACC-002  | Haptics can be disabled.                                        |
| PRD-ADS-001  | Rewarded ads grant rewards exactly once.                        |
| PRD-ADS-002  | Failed/cancelled ads do not alter gameplay state.               |
| PRD-ADS-003  | Advertising consent is completed for production release.        |
| PRD-PERF-001 | Gameplay remains responsive on representative Android devices.  |
| PRD-PERF-002 | Repeated effects do not produce progressive slowdown.           |
| PRD-PERF-003 | Development-only tooling is absent from production bundles.     |
| PRD-REL-001  | Audio/effect failures do not break core gameplay.               |
| PRD-REL-002  | Background/resume does not duplicate rewards or stale effects.  |

---

# 20. Non-Functional Product Requirements

## 20.1 Performance

BlastDown must prioritize:

- responsive dragging;
- smooth board rendering;
- bounded effects;
- no growing memory usage during ordinary play;
- no progressive frame-rate degradation.

Target experience is smooth 60 FPS gameplay where device capability permits.

Ordinary placement and dragging must remain responsive even when effects are active.

---

## 20.2 Stability

V1 must not ship with known reproducible:

- gameplay crashes;
- black board/cell rendering defects;
- reward duplication;
- session leakage;
- runaway animation loops;
- audio-player leaks;
- increasing lag during repeated play.

---

## 20.3 Quality

Automated tests are required for core game rules and important UI contracts, but automated tests do not replace physical-device verification.

Major visual/game-feel changes must be tested on an actual Android device.

---

# 21. V1 Non-Goals

Unless separately approved, V1 does **not** require:

- user accounts;
- cloud saves;
- multiplayer;
- real-time competition;
- global leaderboard;
- friends/social graph;
- chat;
- clans;
- story campaign;
- character collection;
- large cosmetic inventory;
- subscription system;
- complex in-app economy;
- voice acting;
- multiple gameplay music tracks;
- iOS-first optimization;
- server-authoritative gameplay;
- web gameplay client.

These may be considered after the core game demonstrates sufficient quality and engagement.

---

# 22. Success Metrics

Exact launch targets should be finalized once analytics strategy is approved.

Initial metrics should include:

### Product Quality

- crash-free session rate;
- ANR rate;
- startup failure rate;
- frame/performance problems on representative devices.

### Engagement

- games started per user;
- games completed;
- average session duration;
- restart rate after game over;
- returning players;
- best-score improvement frequency.

### Gameplay

- average score;
- average run length;
- frequency of line clears;
- frequency of multi-clears;
- timer explosions;
- defuse usage;
- Freeze usage.

### Monetization

- rewarded-ad offer visibility;
- rewarded-ad initiation rate;
- completion rate;
- reward-grant success rate;
- ad-load failure rate.

Analytics implementation details belong in the Technical Design and Backend Design documents.

---

# 23. V1 Release Gates

BlastDown V1 is ready for production consideration only when:

### Gameplay

- core rules are stable;
- simultaneous effects do not overwrite one another;
- timer and explosion systems behave consistently;
- restart produces a clean session.

### Game Feel

- pre-clear preview is implemented;
- placement feedback is polished;
- line-clear feedback is polished;
- praise mapping is correct;
- danger states are readable;
- score feedback is satisfying;
- production SFX are integrated;
- production gameplay music is integrated.

### Performance

- physical Android testing has been completed;
- no progressive slowdown is observed during extended play;
- drag responsiveness remains acceptable;
- major effect scenarios are verified on hardware.

### Monetization

- production advertising identifiers are configured;
- rewarded flow is device-tested;
- consent flow is device-tested;
- privacy policy is published;
- production audience classification is confirmed.

### Licensing

All external production assets must have recorded:

- source;
- creator;
- license;
- commercial-use permission;
- attribution requirement;
- download/acquisition date.

No unlicensed third-party material may ship.

### Engineering

- required automated suites are passing;
- production builds succeed;
- development-only tools are excluded;
- known critical/high-severity defects are resolved.

---

# 24. Product Risks

## Risk 1 — Over-juicing

Too many simultaneous effects may reduce readability or performance.

**Mitigation:** use an escalation hierarchy and bounded effect counts.

## Risk 2 — Visual polish before reliability

Adding more effects before reliable event delivery may produce inconsistent feedback.

**Mitigation:** maintain deterministic event/effect architecture and device QA.

## Risk 3 — Timer frustration

If danger escalation is unclear, explosions may feel unfair.

**Mitigation:** strong timer state communication and predictable warning feedback.

## Risk 4 — Rewarded ads feel mandatory

If recovery mechanics become necessary rather than optional, monetization may harm retention.

**Mitigation:** keep core play viable without ads and evaluate power-up balance.

## Risk 5 — Audio fatigue

Repeated puzzle sounds can become irritating quickly.

**Mitigation:** short restrained samples, retrigger limits, volume control, pitch limits, and device testing.

## Risk 6 — Android performance variability

Skia/effects may perform differently across devices.

**Mitigation:** physical QA on both capable and budget Android hardware and preserve a reliable rendering strategy.

---

# 25. Open Product Decisions

The Product Owner should explicitly approve the following before production release:

1. Final audience/age classification.
2. Final production AdMob identifiers.
3. Privacy policy URL.
4. Whether V1 launches Android-only or Android first with iOS immediately following.
5. Final production music asset.
6. Final production SFX set.
7. Whether menu music belongs in V1.
8. Final praise-word vocabulary.
9. Exact analytics events and provider.
10. No monetization beyond rewarded Freeze and Defuse is allowed in V1.
11. Minimum Android OS/device support target.
12. Final store positioning, screenshots, title/subtitle, and launch copy.

---

# 26. Definition of V1

BlastDown V1 is **not** simply the current mechanics compiled into an APK.

V1 is achieved when a new player can:

1. launch the game;
2. understand the board without lengthy instruction;
3. drag and place pieces confidently;
4. anticipate a line clear;
5. feel rewarded when the clear occurs;
6. recognize escalating danger;
7. understand timed threats;
8. experience a meaningful explosion consequence;
9. optionally use Freeze or Defuse;
10. understand their score and best score;
11. lose without confusion;
12. immediately restart;
13. play repeatedly without crashes, progressive slowdown, or irritating feedback.

The defining V1 quality bar is:

> **The core loop must already feel like the real BlastDown product, not like a prototype waiting for future polish.**

#
