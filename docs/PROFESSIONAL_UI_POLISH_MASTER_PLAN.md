# BlastDown Professional UI Polish — Master Phase Plan

## Purpose

This document is the single implementation authority for the complete BlastDown professional UI-polish program.

Claude Code must read this file before beginning any polish phase. It defines:

- Visual direction
- Phase order
- Allowed work
- Protected files
- Required tests
- Review procedures
- Stop conditions

The program upgrades BlastDown from a functional build into a polished commercial mobile puzzle game without changing gameplay, scoring, timers, persistence, economy, analytics, rewards, or domain behavior.

The target is the smoothness, clarity, tactile feedback, visual consistency, and game feel expected from successful mobile puzzle games, without copying another game’s assets, branded interface, or characters.

---

# 1. Source-of-Truth Order

When references conflict, use this order:

1. `BUILD_SPEC.md`
2. `docs/GAME_RULES.md`
3. Domain tests and stable domain APIs
4. Approved Stitch references
5. This document
6. Current device screenshots
7. Existing implementation

Rules:

- Gameplay documents override visual references.
- Stitch is authoritative for visual direction only.
- AI-generated screens may contain invalid board states or distorted UI.
- Existing UI is not automatically correct because it already works.
- Visual polish must never change gameplay rules.

---

# 2. Approved Visual Direction

## Name

**Neon Reactor Premium**

## Character

- Premium futuristic casual puzzle game
- Deep graphite and navy surfaces
- Controlled cyan, violet, amber, orange, and red accents
- Tactile, clean, energetic, and readable
- Technological, not military
- Dark but not visually empty
- Polished without excessive neon
- Comfortable for long sessions
- Strong enough for Play Store screenshots and promotional clips

## Avoid

- Outline-only blocks
- Placeholder graphics
- Featureless black empty areas
- Floating unrelated controls
- Excessive blur or glow
- Realistic fire
- 3D board perspective
- Generic dashboard cards
- Screenshot-based interactive screens
- Web-style layouts
- Cartoon characters
- Direct imitation of another game
- Decoration that obscures gameplay

---

# 3. Reactor Reference Colors

Use semantic theme tokens. Do not hardcode these values throughout components.

- app background: `#05070B`
- secondary surface: `#09111A`
- board background: `#070C13`
- empty cell: `#101A2C`
- board frame: `#29313B`
- cyan block: `#00DDEB`
- violet block: `#A33CFF`
- amber block: `#FFB21A`
- score accent: `#FF6200`
- warning amber: `#FFAA16`
- critical red: `#FF335C`
- primary text: `#F3FAFF`
- secondary text: `#94A3AE`
- rubble base: `#252A30`
- rubble crack: `#FF5A36`

Preserve Reactor, Arctic, Magma, Void, and Solar themes.

Critical danger must remain readable in every theme.

Themes must never alter gameplay.

---

# 4. Global Protected Boundaries

These apply to every polish phase.

## Do not modify without explicit approval

- `src/domain/**`
- Gameplay rules
- Balance configuration
- Persistence schemas
- Economy rules
- Analytics contracts
- Production ad configuration
- Reward logic
- `BUILD_SPEC.md`

## Architecture rules

- Domain state remains authoritative.
- UI renders state and reacts to typed events.
- Animation code must not calculate gameplay.
- No score, timer, placement, explosion, reward, or settlement logic may be duplicated in UI.
- Reuse the existing event pipeline.
- Preserve the theme architecture.
- Preserve accessibility behavior.

## Preferred tools

- React Native `View`
- `Text`
- `Pressable`
- Gesture Handler
- Existing Animated or Reanimated implementation
- Existing theme tokens
- Programmatic borders, fills, highlights, cracks, particles, and contours
- Minimal licensed SVG or PNG assets only when necessary

## Do not add without approval

- React Native Skia
- WebView
- New rendering engine
- Lottie
- Video backgrounds
- Screenshot-based gameplay UI
- Unlicensed assets
- Second animation architecture
- New global state-management library

## Single-writer rule

Before editing:

1. Confirm the working tree is clean.
2. Confirm no other Claude or Codex agent is editing the same files.
3. Assign bounded file ownership.
4. Review every Codex diff.
5. Never allow parallel edits to the same UI files.

---

# 5. Baseline and Review Files

Store current screenshots under:

```text
docs/references/ui/current/
```
