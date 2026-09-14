# BlastDown Privacy Policy

**Effective date:** September 15, 2026
**App:** BlastDown (`com.blastdown.app`)

This policy describes the production Android version of BlastDown. Replace the
developer-contact placeholder and publish this policy at a stable public HTTPS
URL before submitting the app to Google Play.

## Information stored on your device

BlastDown stores the following information locally in the app's private Android
storage:

- the active game, so it can be continued after pausing or closing the app;
- best score and tutorial-completion status; and
- sound, music, haptics, and reduced-motion settings.

BlastDown does not provide accounts, login, cloud save, user-generated content,
or a BlastDown-operated backend. The local information above is not uploaded by
BlastDown. It remains until it is replaced by normal use, the app's data is
cleared, or the app is uninstalled.

## Optional rewarded advertising

BlastDown offers optional rewarded advertisements for the Freeze and Defuse
actions. Core gameplay works offline and does not require an ad. Production ads
use the Google Mobile Ads SDK and Google User Messaging Platform (UMP).

When an ad is requested, Google's SDK automatically collects and shares an IP
address (which may be used to estimate general location), product interactions
such as app launches, taps and video views, diagnostic/performance information,
and device or account identifiers including the Android advertising ID and app
set ID where available. Google states that these data are used for advertising,
analytics, and fraud prevention and are encrypted in transit using TLS. Ad
availability, personalization, and identifier use depend on the device,
jurisdiction, Google settings, and consent choices.

BlastDown asks UMP whether ads may be requested before initializing or loading
an ad. If consent cannot be resolved or ads are not eligible, the ad action is
unavailable and gameplay continues. BlastDown currently requests
non-personalized/limited inventory from the SDK even when an ad is eligible.

## Consent and privacy choices

Where required, Google's UMP displays the applicable consent message. UMP, not
BlastDown custom storage, is authoritative for the consent state. The in-app
**Privacy & Ad Choices** screen can reopen Google's privacy-options form when
Google reports that it is required. Android advertising-ID controls are also
available in Android Settings.

## Third-party service

The only production service that receives data from this app is Google Mobile
Ads, including UMP. BlastDown does not currently include a third-party analytics
or crash-reporting SDK; its analytics and error-reporting application seams are
no-ops in production.

- [Google Privacy Policy](https://policies.google.com/privacy)
- [How Google uses information from sites or apps that use its services](https://policies.google.com/technologies/partner-sites)
- [Google Mobile Ads data disclosure](https://developers.google.com/admob/android/privacy/play-data-disclosure)

Google controls retention of information processed by its advertising systems.
Refer to Google's policy and account/activity controls for current details.
BlastDown does not receive or retain a copy of Google's advertising profile or
consent record.

## Security

Local game data is kept in Android's app-private storage. Network traffic made
by Google Mobile Ads/UMP uses the SDK's encrypted transport. No method of local
storage or network transmission is completely secure, but BlastDown limits its
own stored data to what is needed for game continuity and preferences.

## Children and target audience

BlastDown is not designed specifically for children and does not knowingly ask
for names, contact details, or other direct personal information. The product
owner must approve the final Google Play target-age groups before release. If
the owner chooses any child-directed age group, the advertising configuration,
Families-policy obligations, consent signals, store declarations, and this
policy must be reviewed before publication. Do not represent BlastDown as
child-directed until that review is complete.

## Deletion and contact

BlastDown has no account to delete. Players can remove BlastDown's local data by
clearing app storage or uninstalling the app. Advertising identifiers can be
reset or deleted in Android Settings; Google controls deletion requests for data
it processes.

Questions or privacy requests: **[OWNER ACTION REQUIRED: replace with the
developer's monitored privacy email and postal/business identity, if legally
required.]**

Material changes to this policy will update its effective date. The published
HTTPS copy and in-app disclosures must remain consistent with the shipped app.
