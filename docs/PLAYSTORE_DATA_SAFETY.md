# Google Play Data Safety — BlastDown 1.0.0

This worksheet reflects the production Android dependency/configuration audited
on September 15, 2026. Recheck it against the final Play Console SDK Index and
Google Mobile Ads disclosure immediately before submission. Google says its
Mobile Ads SDK automatically collects and shares IP address, product
interactions, diagnostics, and device/account identifiers for advertising,
analytics, and fraud prevention, with TLS in transit.

## Form-level answers

| Question                                                | Recommended answer                                              | Basis                                                                                                                                          |
| ------------------------------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Does the app collect or share required user-data types? | **YES**                                                         | Google Mobile Ads behavior below                                                                                                               |
| Is all collected user data encrypted in transit?        | **YES**                                                         | Google states all Mobile Ads user data is sent using TLS                                                                                       |
| Can users request deletion?                             | **YES — provide mechanism/explanation appropriate to the form** | Local data: clear storage/uninstall; ad ID: Android controls; Google data: Google privacy controls. No BlastDown account/server record exists. |
| Does the app provide account creation?                  | **NO**                                                          | No accounts or login                                                                                                                           |

## Data types to declare YES

| Play category                          | Collected | Shared | Purpose                                                                                                                                | Optional / required                                                                                                       | Source                                                                                   | Encrypted in transit       | Deletion implications                                                                            |
| -------------------------------------- | --------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------ |
| Location → Approximate location        | YES       | YES    | Advertising or marketing; Analytics; Fraud prevention, security and compliance                                                         | Optional at app level because the player can decline/avoid rewarded ads; automatic when the SDK makes an eligible request | Google Mobile Ads: IP address may estimate general location                              | YES (Google TLS statement) | BlastDown holds no copy; use Google controls. Clearing/uninstalling only removes local app data. |
| App activity → App interactions        | YES       | YES    | Advertising or marketing; Analytics; Fraud prevention, security and compliance                                                         | Optional at app level; automatic during eligible ad use                                                                   | Google Mobile Ads: app launch, taps, video views and interaction information             | YES                        | Google controls retention/deletion; BlastDown holds no server copy.                              |
| App info and performance → Diagnostics | YES       | YES    | Analytics; Fraud prevention, security and compliance; Advertising or marketing (Google lists all three purposes for the automatic set) | Optional at app level; automatic during SDK use                                                                           | Google Mobile Ads: launch time, hang rate, energy usage and SDK/app performance          | YES                        | Google controls retention/deletion; BlastDown's own reporter is a no-op.                         |
| Device or other IDs                    | YES       | YES    | Advertising or marketing; Analytics; Fraud prevention, security and compliance                                                         | Optional at app level; identifier availability depends on OS/user/consent settings                                        | Google Mobile Ads: advertising ID, app set ID, and applicable device/account identifiers | YES                        | User can reset/delete advertising ID in Android Settings; Google controls its retained data.     |

Treat “shared” as **YES** conservatively because Google describes this automatic
set as collected and shared, and advertising partners may use data beyond acting
solely as BlastDown's service provider. Do not mark personalization as a
BlastDown purpose: the current adapter requests non-personalized inventory.

## Data types to declare NO

BlastDown and its exact production SDK set do not collect/share the following:

| Category                                                                                                                      | Collected | Shared | Evidence                                                    |
| ----------------------------------------------------------------------------------------------------------------------------- | --------- | ------ | ----------------------------------------------------------- |
| Personal info (name, email, user IDs, address, phone, race/ethnicity, political/religious beliefs, sexual orientation, other) | NO        | NO     | No account, forms, backend, or such SDK input               |
| Financial info (payment, purchase history, credit score, other)                                                               | NO        | NO     | No billing, purchases, financial features, or economy       |
| Health and fitness                                                                                                            | NO        | NO     | No health/fitness features or sensors                       |
| Messages                                                                                                                      | NO        | NO     | No email/SMS/in-app messaging collection                    |
| Photos and videos                                                                                                             | NO        | NO     | No camera/media read access or upload                       |
| Audio files / voice recordings                                                                                                | NO        | NO     | Audio is playback-only; RECORD_AUDIO is disabled/blocked    |
| Files and docs                                                                                                                | NO        | NO     | No user file upload; legacy storage permissions are blocked |
| Calendar                                                                                                                      | NO        | NO     | No calendar access                                          |
| Contacts                                                                                                                      | NO        | NO     | No contacts access                                          |
| Web browsing                                                                                                                  | NO        | NO     | No browser-history collection                               |
| Search history                                                                                                                | NO        | NO     | No search feature                                           |
| Installed apps                                                                                                                | NO        | NO     | No installed-app inventory access                           |
| Other user-generated content                                                                                                  | NO        | NO     | No UGC                                                      |

## Local-only data and exemptions

Active-run state, settings, tutorial status, and best score never leave the
device through BlastDown. Google Play's guidance says data handled solely on the
device and never transmitted off-device is not “collected” for this form. Do
not list these local records as collected. They are deleted by clearing app data
or uninstalling.

## Sources

- [Google Mobile Ads Play data disclosure](https://developers.google.com/admob/android/privacy/play-data-disclosure)
- [Google Play Data Safety instructions and definitions](https://support.google.com/googleplay/android-developer/answer/10787469)
- [Advertising ID guidance](https://support.google.com/googleplay/android-developer/answer/6048248)
