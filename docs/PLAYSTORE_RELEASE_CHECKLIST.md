# BlastDown 1.0.0 Google Play Release Checklist

Allowed states are **PASS**, **OWNER ACTION REQUIRED**, **BLOCKED**, and
**POST-LAUNCH**. Update this file with Console links and test evidence as the
owner completes the submission.

## Engineering qualification

| Item                                                                                               | Status                    | Evidence / next action                                                                                                                                                 |
| -------------------------------------------------------------------------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Production Android environment values exist and match AdMob formats                                | **PASS**                  | Validated without exposing complete identifiers                                                                                                                        |
| Production uses real ad identifiers; development uses Google's official test configuration         | **PASS**                  | Dynamic config and service tests                                                                                                                                       |
| Missing production rewarded units fail closed; reward is exactly once                              | **PASS**                  | Service and reward-flow tests                                                                                                                                          |
| Version 1.0.0 signed AAB built by EAS production profile                                           | **PASS**                  | Record final build ID, version code, SHA-256, and URL in release report                                                                                                |
| Package, SDK levels, portrait mode, ABIs, permissions, debug/dev absence inspected from actual AAB | **PASS**                  | Artifact qualification report; target SDK must be at least 36                                                                                                          |
| Raw AAB and packaged contributors measured                                                         | **PASS**                  | Artifact size analysis; Play download/installed estimates require Play or bundletool                                                                                   |
| Automated quality gate and clean production export                                                 | **PASS**                  | Typecheck, lint, formatting, two Jest runs, coverage, audit, diff check, Graphify                                                                                      |
| Physical test of exact Play-delivered version                                                      | **OWNER ACTION REQUIRED** | Execute every manual row in `V1_RELEASE_SMOKE_TEST.md` from the internal track                                                                                         |
| Production analytics and crash reporting                                                           | **BLOCKED**               | Approved V1 scope requires both, but current production providers are no-ops. An owner-approved provider/dependency/configuration decision is required before rollout. |

## Policy and Console readiness

| Item                                                                     | Status                    | Evidence / next action                                                                                                     |
| ------------------------------------------------------------------------ | ------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Privacy policy text accurately reflects local data and Google Mobile Ads | **PASS**                  | `PRIVACY_POLICY.md` and `privacy-policy.html`                                                                              |
| Public privacy-policy URL                                                | **OWNER ACTION REQUIRED** | Replace contact placeholders, host HTML on stable public HTTPS, verify no authentication, enter URL in App content/listing |
| Data Safety worksheet                                                    | **PASS**                  | `PLAYSTORE_DATA_SAFETY.md`; reconfirm against live SDK Index/form wording                                                  |
| Contains-ads, app-access, Advertising ID, and other declarations         | **PASS**                  | Recommended answers in `PLAY_CONSOLE_DECLARATIONS.md`                                                                      |
| Intended target audience                                                 | **OWNER ACTION REQUIRED** | Owner approves actual age groups; do not automatically select child-directed groups                                        |
| Content rating                                                           | **OWNER ACTION REQUIRED** | Complete IARC questionnaire from actual app/ads and accept resulting rating                                                |
| AdMob Privacy & messaging                                                | **OWNER ACTION REQUIRED** | Publish/review applicable EEA/UK/Switzerland and US-state messages, ad partners, consent settings, and app association     |
| App-ads.txt / seller information where applicable                        | **OWNER ACTION REQUIRED** | Complete AdMob/Play account-level requirements shown for this publisher                                                    |
| Production-access eligibility                                            | **OWNER ACTION REQUIRED** | Account/test requirements cannot be determined from repository; follow live Console path                                   |

## Store presentation

| Item                                                         | Status                    | Evidence / next action                                                           |
| ------------------------------------------------------------ | ------------------------- | -------------------------------------------------------------------------------- |
| App name, short description, full description, category/tags | **PASS**                  | Copy prepared in `PLAYSTORE_LISTING.md`; owner reviews live catalog tags         |
| Dedicated 512×512 Play icon                                  | **OWNER ACTION REQUIRED** | Export/review from source icon                                                   |
| 1024×500 feature graphic                                     | **OWNER ACTION REQUIRED** | Create and review final marketing artwork                                        |
| Phone screenshots from release build                         | **OWNER ACTION REQUIRED** | Capture from exact internal-track build; recommended sequence in asset checklist |
| Launcher/adaptive icon and splash source assets              | **PASS**                  | Present and configured; physical visual inspection remains part of smoke test    |

## Rollout

| Item                                                 | Status                    | Evidence / next action                                                                           |
| ---------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------ |
| Internal-test upload and automated Play checks       | **OWNER ACTION REQUIRED** | Upload exact qualified AAB; resolve Console errors and review every warning                      |
| Internal tester smoke sign-off                       | **OWNER ACTION REQUIRED** | Attach completed device matrix and rewarded-ad/consent evidence                                  |
| Closed/production release submission                 | **OWNER ACTION REQUIRED** | Choose the path allowed by the account and submit only after preceding owner actions             |
| Crash/ANR, ad-fill, consent, and review monitoring   | **POST-LAUNCH**           | Monitor Play vitals, the approved production telemetry providers, and AdMob after staged release |
| Store-listing/asset experiments and low-value polish | **POST-LAUNCH**           | Must not delay a compliant, stable release                                                       |

The exact AAB can be uploaded to an internal track for Console validation and
device smoke testing, but production rollout is **BLOCKED** until the approved
V1 analytics/crash-reporting requirement has a product-approved provider and a
verified implementation. All owner actions are also submission gates.

## Exact Play Console order

1. Create or select **BlastDown** in Play Console and verify package ownership.
2. Complete the Main store listing with approved text and final assets.
3. Publish the HTTPS Privacy Policy and enter its URL.
4. Complete App access: all functionality is available without special access.
5. Declare that the app contains ads.
6. Complete the content-rating questionnaire.
7. Approve and declare the intended target audience.
8. Complete Data Safety from the audited worksheet.
9. Complete remaining App Content declarations, including Advertising ID and
   any live-console forms applicable to the account.
10. Upload the exact SHA-verified production AAB to Internal testing.
11. Resolve all automated Play errors; review every warning against the AAB.
12. Distribute to internal testers.
13. Run and record the full physical release smoke test on the delivered build.
14. Promote through closed testing or production according to the account's
    eligibility and current Play requirements.

The repository cannot determine the Play developer account's production-access
eligibility, identity-verification state, tester thresholds, or Console policy
deadlines.
