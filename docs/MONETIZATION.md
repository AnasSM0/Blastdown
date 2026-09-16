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
mock adapter. Production native builds use `GoogleMobileAdsService`, which
requests non-personalized inventory until the approved consent flow is wired.

### EAS production environment

Configure these Android values in the EAS `production` environment with
**sensitive** visibility. They are client identifiers embedded in the app, not
server credentials; EAS must be able to resolve them while evaluating the
dynamic app config locally.

| Variable                                | Requirement                            | Missing behavior                                         |
| --------------------------------------- | -------------------------------------- | -------------------------------------------------------- |
| `ADMOB_ANDROID_APP_ID`                  | Mandatory for Android production build | Config fails before upload; Google test IDs are rejected |
| `ADMOB_ANDROID_REWARDED_FREEZE_UNIT_ID` | Required to serve Freeze ads           | Freeze ad request returns `unavailable`; no reward       |
| `ADMOB_ANDROID_REWARDED_DEFUSE_UNIT_ID` | Required to serve Defuse ads           | Defuse ad request returns `unavailable`; no reward       |

Future iOS production uses the equivalent `ADMOB_IOS_APP_ID`,
`ADMOB_IOS_REWARDED_FREEZE_UNIT_ID`, and
`ADMOB_IOS_REWARDED_DEFUSE_UNIT_ID`. Android generation does not read or
require those iOS values. Production never falls back to Google's sample App
IDs or rewarded unit IDs.

## Governance

Codex is the sole engineering agent. Any proposal to add a placement or ad
format changes product scope, service interfaces, analytics, and QA obligations;
it must be surfaced explicitly and approved in the PRD before implementation.
