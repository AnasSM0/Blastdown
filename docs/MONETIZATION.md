# V1 Monetization

The PRD is authoritative. BlastDown V1 uses optional rewarded advertising only
for Freeze and Defuse. Core gameplay remains available offline and no reward is
required to complete or restart a run.

## Approved placements

- `rewarded_freeze`
- `rewarded_defuse`

Bolts, Double Bolts, rewarded Revive, repair-blast offers, and interstitials are
excluded from V1. They must not appear in the placement catalog, production UI,
analytics event requirements, or persistence/settlement behavior.

## Reward contract

For each approved placement:

1. Explain the reward before the player requests the ad.
2. Flush the newest active-run snapshot before native ad UI opens.
3. Grant nothing on close, unavailable, error, or background interruption.
4. Apply the domain action only after an earned callback.
5. Apply it at most once per request.
6. Return safely to the same run on every non-earned outcome.

The ad network determines whether a reward was earned. The pure game domain
determines whether and how the approved action applies.

## Consent, privacy, and production configuration

Production release requires approved consent handling, a published privacy
policy, correct audience classification, Play Data Safety declarations, and
production rewarded-ad identifiers. Development and automated tests use the
mock adapter. Real AdMob configuration is deferred to G-01 through G-03.

## Governance

Codex is the sole engineering agent. Any proposal to add a placement or ad
format changes product scope, service interfaces, analytics, and QA obligations;
it must be surfaced explicitly and approved in the PRD before implementation.
