# Release checklist

Living pre-release gate for BlastDown. Boxes are ticked only against evidence
(command output, a device pass, or a linked artifact). Phase 6A seeds the
engineering-readiness section; store/submission items land in Phase 9.

## Engineering verification (every release candidate)

- [ ] `npm run typecheck` clean
- [ ] `npm run lint` clean
- [ ] `npm run test` all green
- [ ] `npm run test:coverage` — domain/economy/analytics/diagnostics high; no
      unexpected drop
- [ ] `npm run format:check` clean
- [ ] `npx expo-doctor` all checks pass
- [ ] `npx expo export --platform android` succeeds

## Determinism & offline (contract gates)

- [ ] Seeded determinism holds (same seed + inputs → same board)
- [ ] Game is fully playable with no network (only ads may be unavailable)
- [ ] Corrupt/old persisted profile, settings, and active-run all recover to a
      safe default (never a crash or a block)

## Analytics & diagnostics (Phase 6A)

- [ ] Events fire once per logical action; terminal events (`run_end`,
      `results_view`) are not duplicated by restart / Back / remount / restore
- [ ] No event carries personal data, free text, device ids, precise location,
      or raw `GameState` (see `docs/ANALYTICS.md`)
- [ ] Analytics failure never affects gameplay (no-op offline; throwing backend
      swallowed)
- [ ] App-level error boundary shows recovery UI and reports the error
- [ ] Error reports exclude secrets, ad ids, raw stored state, and full
      `GameState` (see `docs/ERROR_REPORTING.md`)
- [ ] Reward outcomes (offer / earned / closed / unavailable / failed) recorded
      for every placement
- [ ] Double Bolts applies at most once per run

## Monetization (Phase 6B — not yet)

- [ ] Production ad-unit ids configured (test ids only until then)
- [ ] Live rewarded/interstitial SDK wired behind the `AdService` adapter
- [ ] Ad frequency rules verified against `BUILD_SPEC.md`
- [ ] Consent / UMP flow implemented and gating ad init

## Store & submission (Phase 9)

- [ ] Production analytics + crash-reporting adapters wired and verified live
- [ ] App icon, screenshots, feature graphic
- [ ] Privacy policy + Play Data Safety form (matches the analytics taxonomy)
- [ ] Production AAB build
- [ ] Closed-testing track submission
- [ ] Crash-monitoring live check
- [ ] Balance validated against the Phase-0 prototype gate
