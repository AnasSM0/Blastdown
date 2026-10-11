# BlastDown 2.0 — Art, Motion, VFX and Audio Bible

**Status:** Agreed aesthetic; specific measurements below are design targets requiring visual comparison/device profiling. Do not silently replace existing production effects with heavier rendering components.

## 1. Creative identity: Neon Reactor Arcade

**Personality:** vivid premium arcade first, restrained reactor/sci-fi second. Warm, approachable, tactile and legible. **Not:** gloomy technical control panel, flat clone, elaborate full-3D machinery, inaccessible strobe spectacle.

**Hierarchy:** board legibility > touch response > timer danger > clear/defuse payoff > ambient decoration. Dark indigo/cobalt board provides contrast for bright cyan, violet, amber, magenta, lime and azure blocks. Sector environments vary lighting/colors but retain stable gameplay symbols and interaction conventions.

**Source references:** user-uploaded Block Blast play video and stills inform simple silhouettes and punchy achievements; linked stock futuristic countdown HUD is stylistic inspiration only; linked Suno music preview is mood inspiration, not an audio asset or evidence of usable commercial rights. Verify source file and licensing prior to production import.

## 2. Reference design tokens (PROPOSED, not yet approved exact palette)

From legacy Visual Identity specification, retained as starting palette:

| Role | Candidate | Rule |
|---|---|---|
| App void | `#070A18` | Avoid uniform black expanses in menus; layer depth sparingly |
| Board substrate | `#0E1430` | Recessed panel, high contrast |
| Cell background A/B | `#151C3D` / `#111737` | Subtle variation, non-distracting |
| Grid stroke | `#1E2A55` | Empty cells readable at low brightness |
| Bezel stroke | `#2E7CA8` | Thin; must not obscure edge rows/clear animations |
| Cyan | `#1FC8E8` | Distinct brightness and silhouette |
| Amber | `#F2A03C` | Critical warm/benefit distinction |
| Violet | `#8B4FE8` | Contrast with magenta |
| Magenta | `#E8318F` | Contrast with violet |
| Lime | `#5BD84F` | Avoid red-green-only state signals |
| Azure | `#3F7BE8` | Separate from cyan by luminosity |

Run legibility tests with small mobile tile sizes, dark/bright screen settings and reduced color discrimination. Select final hex/token ramp only after in-game screenshots and approved assets. Maintain text and icons as redundant status indicators.

## 3. Tiles and board rendering

**2.5D luminous arcade-plastic/crystal hybrid:** clean rounded-rectangle tile face, shallow beveled edge, thin inner specular border, upper-left highlight, slight embedded shadow and controlled contextual outer light. Avoid noisy microtextures or extreme reflectivity that make shape silhouettes hard to recognize. Glow is stateful: idle < selected < pre-clear < critical, and disabled/reduced if device constraints or accessibility require it. Render position is always grid-aligned, regardless of cosmetic animation.

**Timer badge** is separate from tile face and carries an unambiguous *move count*, stable-width numerals, sufficient contrast and a subtle segmented ring. Never display continuously decreasing seconds unless a separate explicitly labeled real-time mode is later introduced. At timer=2 use amber warning; at 1 use critical red and alternative noncolor cues. Timer updates occur on successful placements, never while thinking/paused/backgrounded.

**Board enclosure:** faint recessed lighting, subtle reactor bezel and corner brackets placed outside playable content. Preserve all 8×8 cells, especially edge clear animations; avoid previous occluding corner-accent regression. Board size and piece tray must fit small Android viewports, status/nav insets and accessibility scaling.

## 4. UI and campaign surfaces

Home: instant Play, Campaign and Daily entry, clear resume path, concise mode choices, progress/reward strip, privacy/settings navigation. Level map: Reactor sectors have unique accent lighting and background silhouettes; avoid excessive 3D/map complexity. HUD: score, best, danger and pause prioritized; no banner ads. Rewards/results: first-time star reveals and Bolt changes are attractive but skippable, with Next/Retry visible immediately. Never let external ad load block results navigation.

## 5. Motion vocabulary (PROPOSED initial budgets)

| Event | Visual language | Approx. target | Audio/haptic tier |
|---|---|---|---|
| Pickup | Tiny lift, scale to ~1.04–1.06, local glow | 80–120 ms | Very light selection |
| Drag | Direct tracked movement; cell-snapped preview, line pre-light | Continuous | No repeated buzzing |
| Invalid release | Fast spring-back and danger outline | 150–200 ms | Brief reject |
| Placement | Firm grid snap, tiny squash/recover, cell stagger | 120–200 ms | Crisp placement |
| Single clear | White-to-color sweep, brief shards | 250–450 ms | Clear tone, light-medium |
| Double/triple | Intersecting sweep, controlled glow and score slam | 450–650 ms | Rising emphasis |
| Defused | Timed cells relief glow, resolved badge exit | 350–550 ms | Distinct success |
| Critical 1-move save | Board rim relief pulse + CLUTCH praise, no misleading defuse | 550–800 ms | Signature musical accent, voice/haptic |
| Explosion | Directional shockwave, capped shards, rubble settle | 500–800 ms | Weighty impact; music ducks |
| Rare overload | Stronger short accent and optional micro-hitstop | <= 1s | Rare voice/heavy haptic |
| Ordinary results | Stars, Bolts, progress reveal | <= 1.5s; immediately skippable | Musical resolution |
| Sector unlock | More expressive transition | User-skippable | One signature reward |

Timings are perceptual goals, not reducer delays. Effects are decoupled from gameplay and must cancel/replace gracefully when moves occur quickly. Avoid full-screen white flashes, harsh flicker or excessive shaking; expose reduced-motion controls and equivalent textual feedback.

### Feedback precedence

1. Actual game-over, actual explosion, actual timed-piece defuse, major level clear.
2. Multiple-line clear, meaningful combo/score breakthrough.
3. Single-line clear, normal placement.

One spoken line or large praise phrase at a time. Never claim `DEFUSED`, `CLUTCH` or high-level mastery without corresponding domain event/evidence. If simultaneous events occur, resolve with explicit priority and cancellation rules, not accidental queue stacking.

## 6. Audio design

**Music:** melodic arcade electronic, coherent repeating motif and synchronized layers: base rhythmic groove, added harmonic/lower percussion for danger, restrained accent for result/rescue. A move from safe->danger may crossfade or quantize to musical boundary; **danger never advances based on wall-clock time**. Avoid continuous stressful countdown ticks when player is not making moves. Build with licensed stems where practical; inspect app-size trade-offs (older production WAV music was comparatively large).

**Operator:** calm concise radio/technical delivery, lightly processed; rare genuine accomplishments only. Example vocabulary: 'Defused', 'Critical save', 'Reactor stabilized'; exact recorded lines need script approval. Never vocalize every placement. Separate Music / SFX / Voice / Haptics controls and obey silent/reduced-motion preferences.

**Mix priority:** explosion and real critical save take precedence over weaker SFX; lower music around high-impact event, fast recovery; prevent overlapping voices. Preserve consonant/midrange definition on phone speakers, not just bass on headphones. Verify clipping, abrupt resuming and headphone/bluetooth transitions.

**Haptics:** pickup subtle, commit crisp, rejected placement distinct, line clear mild, multi-line moderate, defuse recognizable, explosion impact; no repetitive per-frame warnings. Haptics are optional and should degrade gracefully across Android devices.

## 7. Rendering and performance contracts

- Existing Android production configuration previously used a cinematic-OFF branch to constrain native dependency size. **Reverify actual current build** before selecting renderer.
- Prototype both lightweight sprite/gradient treatment and a premium renderer only if justified by device profiling. No unconditional Skia/Reanimated dependency changes before owner's build-size/QA approval.
- Aim for responsive stable 60 FPS on representative devices where sustainable; profile 30/low-end fallback where necessary. Target frame budget ~16.7 ms at 60 FPS (measurement target, not measured current achievement).
- Cap particles and animated layers; sample legacy guidance capped fragments around 40 board-wide. Use shared animation drivers, not 64 independent continuously running clocks.
- Test worst-case multi-line + simultaneous explosions on device; record FPS distribution, JS/UI frame stalls, native heap, thermal and battery indications, binary delta.
- Effects may never alter reducer state, modify placement precision or stall subsequent touches.

## 8. Content pipeline and accessibility

Define sprite/sound attribution and commercial-use evidence before importing any reference media. Original production icons/tiles should be authored for BlastDown, not extracted from screenshots. Store art can be cinematic but must represent actual mechanics honestly; store screenshots must be authentic captures. Fonts must be redistributed only if permitted.

Accessibility: timer numeral plus shape/ring, optional reduced motion, flashes capped, color-independent alerts, large enough touch targets, readable contrast, voice separately disableable, no sound-only success/failure, full offline functionality, screen reader labels and persistence of preferences.

## 9. Vertical slice acceptance

On a representative real Android device, demonstrate: drag and tap parity, precise ghost + prospective clear, pickup/placement feel, timer 2/1 danger, authentic critical defuse praise, 1/2-line clear, explosion+rubble, haptics/audio layering, rapid-placement interruptions and reduced-motion alternative. Side-by-side capture against Closed-test baseline with frame-time/size report. No campaign work until visual prototype is judged usable and appropriately performant.
