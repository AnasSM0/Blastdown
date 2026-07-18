# Monetization

Derived from `BUILD_SPEC.md` sections 8 and 11. All numeric caps below must
be configurable (`src/config/monetization.ts`), never hardcoded at call
sites.

## Ad formats

Rewarded and interstitial only. **No banner ads during gameplay, ever.**

## Rewarded placements

- `rewarded_revive`
- `rewarded_freeze`
- `rewarded_defuse`
- `rewarded_double_bolts`
- (optional, future, feature-flagged) `rewarded_repair_blast`

## Interstitial placement

May appear after a completed run only when **all** of these hold:

- Player has completed ≥2 lifetime runs.
- The run lasted ≥60 seconds.
- ≥120 seconds since the previous interstitial.
- No rewarded ad completed in the previous 45 seconds.
- Current session hasn't exceeded its frequency cap.
- Consent state permits the requested ad type.
- An interstitial is already loaded.

Never show: on first app open, during gameplay, immediately after a
rewarded ad, before the revive decision, after every very short failed run,
or two ads back-to-back.

## Session frequency caps (initial, all configurable)

- Max 1 rewarded revive per run.
- Max 2 freezes per run.
- Max 2 defuses per run.
- Max 1 double-reward ad per run.
- Max 3 interstitials per 20-minute session.

## Ad failure behavior

On not-loaded / timeout / crash / closed-without-reward / SDK error: preserve
current state, show a short non-blaming message, never silently drop a
promised reward, allow retry when appropriate, record the failure event.

## Development vs. production ads

Dev and preview builds use Google test ad IDs by default (see
`.env.example` and `app.config.ts`). Production IDs are loaded through
`ADMOB_ANDROID_APP_ID` / `ADMOB_IOS_APP_ID` environment configuration —
`app.config.ts` throws at config-eval time if a production build doesn't
have both set, to prevent shipping test IDs. Real AdMob integration
requires an Expo development build (native config), not Expo Go — see
`react-native-google-mobile-ads`'s Expo config plugin, already wired in
`app.config.ts`.

## Consent

Before requesting personalized ads: obtain required consent, respect
non-personalized choices, persist consent state, offer a Settings entry to
revisit privacy choices, and never initialize ad requests in a way that
bypasses required consent. Use the consent support built into the chosen
Google Mobile Ads integration rather than a hand-rolled flow.

## Bolts and the double-reward offer

`Bolts = floor(score / 250) + successfully defused pieces` per run. At final
results, offer to watch an ad to double that run's Bolts — only if the
player didn't revive via an unfinished ad flow, an ad is available, and the
reward hasn't already been doubled.

## Ownership

Claude Code owns the contracts and rules above (frequency caps, consent
requirements, `AdService` interface, failure-handling contract). Codex owns
the presentation layer built on top of them (buttons, loading states,
failure-state UI) — see Phase 6/7 in `docs/TASKS.md`.
