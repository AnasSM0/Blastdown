import {
  AdEventType,
  AdsConsentDebugGeography,
  AdsConsentPrivacyOptionsRequirementStatus,
  AdsConsentStatus,
  RewardedAdEventType,
  type AdsConsentInfo,
} from "react-native-google-mobile-ads";

import { toEvent } from "../../src/services/ads/GoogleRewardedAdPort";
import { isNoAdAvailableCode } from "../../src/services/ads/rewardedPort";
import { toAdsConsentOptions, toConsentInfo } from "../../src/services/consent/UmpConsentPort";

/** The two adapters that translate between the ad SDK and our own types do no
 *  policy, so they cannot be exercised through the service tests — and a wrong
 *  enum or a missed event name in either would surface only during device QA,
 *  as "the reward never lands" or "the form never appears". These are the
 *  mappings themselves.
 *
 *  The SDK enums come from the stub in `jest.setup.js`, whose values mirror the
 *  package's published typings. */

describe("consent info mapping", () => {
  function info(overrides: Partial<AdsConsentInfo> = {}): AdsConsentInfo {
    return {
      status: AdsConsentStatus.NOT_REQUIRED,
      canRequestAds: true,
      privacyOptionsRequirementStatus: AdsConsentPrivacyOptionsRequirementStatus.NOT_REQUIRED,
      isConsentFormAvailable: false,
      ...overrides,
    };
  }

  it("maps every consent status", () => {
    expect(toConsentInfo(info({ status: AdsConsentStatus.UNKNOWN })).status).toBe("unknown");
    expect(toConsentInfo(info({ status: AdsConsentStatus.REQUIRED })).status).toBe("required");
    expect(toConsentInfo(info({ status: AdsConsentStatus.NOT_REQUIRED })).status).toBe(
      "notRequired",
    );
    expect(toConsentInfo(info({ status: AdsConsentStatus.OBTAINED })).status).toBe("obtained");
  });

  it("maps every privacy options requirement", () => {
    const map = {
      [AdsConsentPrivacyOptionsRequirementStatus.UNKNOWN]: "unknown",
      [AdsConsentPrivacyOptionsRequirementStatus.REQUIRED]: "required",
      [AdsConsentPrivacyOptionsRequirementStatus.NOT_REQUIRED]: "notRequired",
    };
    for (const [status, expected] of Object.entries(map)) {
      const mapped = toConsentInfo(
        info({
          privacyOptionsRequirementStatus: status as AdsConsentPrivacyOptionsRequirementStatus,
        }),
      );
      expect(mapped.privacyOptionsRequirement).toBe(expected);
    }
  });

  it("falls back to the conservative reading for an unrecognised enum value", () => {
    // An SDK that grows a new state must not break the launch path.
    const mapped = toConsentInfo(
      info({
        status: "SOMETHING_NEW" as AdsConsentStatus,
        privacyOptionsRequirementStatus:
          "SOMETHING_NEW" as AdsConsentPrivacyOptionsRequirementStatus,
      }),
    );
    expect(mapped.status).toBe("unknown");
    expect(mapped.privacyOptionsRequirement).toBe("unknown");
  });

  it("treats a missing or non-boolean flag as false rather than truthy", () => {
    const mapped = toConsentInfo(
      info({
        canRequestAds: undefined as unknown as boolean,
        isConsentFormAvailable: undefined as unknown as boolean,
      }),
    );
    expect(mapped.canRequestAds).toBe(false);
    expect(mapped.isConsentFormAvailable).toBe(false);
  });
});

describe("consent request option mapping", () => {
  it("passes nothing through when there are no options", () => {
    expect(toAdsConsentOptions(undefined)).toBeUndefined();
    expect(toAdsConsentOptions({})).toEqual({});
  });

  it("maps every debug geography", () => {
    expect(toAdsConsentOptions({ debugGeography: "disabled" })?.debugGeography).toBe(
      AdsConsentDebugGeography.DISABLED,
    );
    expect(toAdsConsentOptions({ debugGeography: "eea" })?.debugGeography).toBe(
      AdsConsentDebugGeography.EEA,
    );
    expect(toAdsConsentOptions({ debugGeography: "regulatedUsState" })?.debugGeography).toBe(
      AdsConsentDebugGeography.REGULATED_US_STATE,
    );
    expect(toAdsConsentOptions({ debugGeography: "other" })?.debugGeography).toBe(
      AdsConsentDebugGeography.OTHER,
    );
  });

  it("omits an empty test device list rather than sending one", () => {
    expect(toAdsConsentOptions({ testDeviceIdentifiers: [] })).toEqual({});
    expect(toAdsConsentOptions({ testDeviceIdentifiers: ["A"] })?.testDeviceIdentifiers).toEqual([
      "A",
    ]);
  });

  it("passes the under-age tag through only when it is explicitly set", () => {
    expect(toAdsConsentOptions({})).not.toHaveProperty("tagForUnderAgeOfConsent");
    expect(toAdsConsentOptions({ tagForUnderAgeOfConsent: false })).toEqual({
      tagForUnderAgeOfConsent: false,
    });
  });
});

describe("rewarded ad event mapping", () => {
  it("treats both of the SDK's load events as loaded", () => {
    expect(toEvent(RewardedAdEventType.LOADED, { type: "coins", amount: 1 })).toEqual({
      type: "loaded",
    });
    expect(toEvent(AdEventType.LOADED, undefined)).toEqual({ type: "loaded" });
  });

  it("maps the earned-reward event, ignoring the reward payload", () => {
    // The reward amount and type are the ad network's; BlastDown's rewards are
    // fixed by the domain, so the payload is deliberately dropped.
    expect(toEvent(RewardedAdEventType.EARNED_REWARD, { type: "coins", amount: 500 })).toEqual({
      type: "earned",
    });
  });

  it("maps the close event", () => {
    expect(toEvent(AdEventType.CLOSED, undefined)).toEqual({ type: "closed" });
  });

  it("carries the error code and message through", () => {
    expect(
      toEvent(AdEventType.ERROR, { code: "googleMobileAds/no-fill", message: "no fill" }),
    ).toEqual({ type: "error", code: "googleMobileAds/no-fill", message: "no fill" });
  });

  it("survives an error payload with no code or message", () => {
    expect(toEvent(AdEventType.ERROR, undefined)).toEqual({
      type: "error",
      code: "unknown",
      message: "Unknown ad error",
    });
  });

  it("ignores events that carry no decision", () => {
    expect(toEvent(AdEventType.OPENED, undefined)).toBeNull();
    expect(toEvent(AdEventType.CLICKED, undefined)).toBeNull();
    expect(toEvent(AdEventType.PAID, undefined)).toBeNull();
  });
});

describe("load failure classification", () => {
  it("treats no-fill and network errors as 'no ad right now'", () => {
    expect(isNoAdAvailableCode("googleMobileAds/error-code-no-fill")).toBe(true);
    expect(isNoAdAvailableCode("googleMobileAds/error-code-network-error")).toBe(true);
    expect(isNoAdAvailableCode("googleMobileAds/mediation-no-fill")).toBe(true);
  });

  it("treats everything else as a real error", () => {
    expect(isNoAdAvailableCode("googleMobileAds/error-code-internal-error")).toBe(false);
    expect(isNoAdAvailableCode("googleMobileAds/error-code-invalid-request")).toBe(false);
    expect(isNoAdAvailableCode("unknown")).toBe(false);
  });
});
