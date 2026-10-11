# BlastDown — Design 2.0 review pack

**Date:** 2026-10-12  
**Status:** Owner-approved creative/product *direction*, draft implementation contracts pending repository audit.  
**Publisher:** Naxum Games  
**Platform:** Android-first, portrait, offline-first  
**Engineering:** Codex is the sole coding/build agent; work proceeds one bounded task at a time.

This review pack records decisions from the seven user interviews and proposes detailed contracts for review. It is **not** a claim that the current repository already implements these systems. The Closed-testing release is the baseline to protect.

## Reading order

1. `DESIGN_DECISIONS_2_0.md` — authoritative interview decision register; `LOCKED` vs `PROPOSED` vs `VERIFY`.
2. `GAME_DESIGN_2_0.md` — gameplay, modes, objectives, progression and UX requirements.
3. `ART_MOTION_AUDIO_BIBLE_2_0.md` — presentation language, animation, audio, accessibility and budgets.
4. `MONETIZATION_RETENTION_ANALYTICS_2_0.md` — economy, fair ads, retention and telemetry.
5. `TECHNICAL_VERIFICATION_2_0.md` — unresolved engineering, policy and asset questions.
6. `PRODUCTION_ROADMAP_2_0.md` — stages and release gates.
7. `CODEX_TASK_BD2_001_REPO_AUDIT.md` — **first bounded task, read-only**.

## Governance

The live repository's existing authoritative documents must be inspected before integration: `AGENTS.md`, `docs/PRD.md`, `docs/TECHNICAL_DESIGN.md`, `docs/APP_FLOW.md`, `docs/UI_UX_BRIEF.md`, `docs/BACKEND_DESIGN.md`, `docs/ENGINEERING_PLAN.md`, `docs/GAME_RULES.md`, `docs/DECISIONS.md`. Historical `BUILD_SPEC.md` is context, not an excuse to resurrect features excluded from the currently shipped scope. Resolve discrepancies in the decision register, then update authoritative docs in a separate **docs-only** task with owner approval. Never silently replace current live rules.

## Source grounding

Interview decisions in this bundle originate from the user's Round 1–7 answers and final five choices. Prior implementation facts are based on earlier owner/Codex reports and **must be reverified** in the current repository. The legacy visual specification is reference material; colors and durations in it are starting hypotheses, not acceptance evidence. The ZIP art/video references are inspiration; asset licenses are not established by their presence.

## Current working scope (not a code claim)

**Public launch priority:** high-quality Endless + 20–30-level Reactor Campaign + one shared Daily Defuse challenge, stars/Bolts, lightweight daily and weekly objectives, achievements, high-quality game feel, optional rewarded assistance, no IAP/no login. Shareable challenge codes are requested but deferrable if quality or schedule demands. Seasonal LiveOps and additional game modes are post-launch.

**Do not** rebuild, upload, merge, change version codes, edit secrets or activate interstitials/analytics during the first audit task.
