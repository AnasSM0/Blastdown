/* eslint-disable @typescript-eslint/no-require-imports */
import type { ExpoConfig } from "expo/config";

const ENV_NAMES = [
  "EXPO_PUBLIC_APP_ENV",
  "BLASTDOWN_BUILD_PLATFORM",
  "ADMOB_ANDROID_APP_ID",
  "ADMOB_IOS_APP_ID",
  "ADMOB_ANDROID_REWARDED_FREEZE_UNIT_ID",
  "ADMOB_ANDROID_REWARDED_DEFUSE_UNIT_ID",
  "ADMOB_IOS_REWARDED_FREEZE_UNIT_ID",
  "ADMOB_IOS_REWARDED_DEFUSE_UNIT_ID",
] as const;

const ANDROID_APP_ID = "ca-app-pub-1111111111111111~2222222222";
const IOS_APP_ID = "ca-app-pub-3333333333333333~4444444444";
const FREEZE_UNIT_ID = "ca-app-pub-1111111111111111/5555555555";
const DEFUSE_UNIT_ID = "ca-app-pub-1111111111111111/6666666666";

function loadConfig(environment: Partial<Record<(typeof ENV_NAMES)[number], string>>): ExpoConfig {
  for (const name of ENV_NAMES) delete process.env[name];
  Object.assign(process.env, environment);
  jest.resetModules();
  return (require("../../app.config") as { default: ExpoConfig }).default;
}

function adMobPlugin(config: ExpoConfig): Record<string, string> {
  const plugin = config.plugins?.find(
    (entry) => Array.isArray(entry) && entry[0] === "react-native-google-mobile-ads",
  );
  if (!Array.isArray(plugin) || typeof plugin[1] !== "object" || plugin[1] === null) {
    throw new Error("AdMob plugin configuration missing");
  }
  return plugin[1] as Record<string, string>;
}

describe("platform-scoped production AdMob config", () => {
  afterEach(() => {
    for (const name of ENV_NAMES) delete process.env[name];
    jest.resetModules();
  });

  it("resolves Android production without an iOS App ID", () => {
    const config = loadConfig({
      EXPO_PUBLIC_APP_ENV: "production",
      BLASTDOWN_BUILD_PLATFORM: "android",
      ADMOB_ANDROID_APP_ID: ANDROID_APP_ID,
      ADMOB_ANDROID_REWARDED_FREEZE_UNIT_ID: FREEZE_UNIT_ID,
      ADMOB_ANDROID_REWARDED_DEFUSE_UNIT_ID: DEFUSE_UNIT_ID,
    });

    expect(adMobPlugin(config)).toEqual({ androidAppId: ANDROID_APP_ID });
    expect(config.extra?.adMobRewardedUnitIds).toEqual({
      rewarded_freeze: FREEZE_UNIT_ID,
      rewarded_defuse: DEFUSE_UNIT_ID,
    });
    expect(config.android?.blockedPermissions).toEqual(
      expect.arrayContaining([
        "android.permission.FOREGROUND_SERVICE",
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.RECORD_AUDIO",
        "android.permission.SYSTEM_ALERT_WINDOW",
        "android.permission.WRITE_EXTERNAL_STORAGE",
      ]),
    );
    expect(config.plugins).toContainEqual([
      "expo-audio",
      {
        recordAudioAndroid: false,
        enableBackgroundRecording: false,
        enableBackgroundPlayback: false,
      },
    ]);
  });

  it("resolves iOS production without an Android App ID", () => {
    const config = loadConfig({
      EXPO_PUBLIC_APP_ENV: "production",
      BLASTDOWN_BUILD_PLATFORM: "ios",
      ADMOB_IOS_APP_ID: IOS_APP_ID,
    });

    expect(adMobPlugin(config)).toEqual({ iosAppId: IOS_APP_ID });
  });

  it("requires the selected platform App ID and rejects Google's test publisher", () => {
    expect(() =>
      loadConfig({
        EXPO_PUBLIC_APP_ENV: "production",
        BLASTDOWN_BUILD_PLATFORM: "android",
        ADMOB_IOS_APP_ID: IOS_APP_ID,
      }),
    ).toThrow("ADMOB_ANDROID_APP_ID");

    expect(() =>
      loadConfig({
        EXPO_PUBLIC_APP_ENV: "production",
        BLASTDOWN_BUILD_PLATFORM: "android",
        ADMOB_ANDROID_APP_ID: "ca-app-pub-3940256099942544~3347511713",
      }),
    ).toThrow("non-test AdMob App ID");
  });

  it("rejects malformed and Google-sample production rewarded unit IDs", () => {
    expect(() =>
      loadConfig({
        EXPO_PUBLIC_APP_ENV: "production",
        BLASTDOWN_BUILD_PLATFORM: "android",
        ADMOB_ANDROID_APP_ID: ANDROID_APP_ID,
        ADMOB_ANDROID_REWARDED_FREEZE_UNIT_ID: "ca-app-pub-3940256099942544/5224354917",
      }),
    ).toThrow("non-test AdMob ad unit ID");

    expect(() =>
      loadConfig({
        EXPO_PUBLIC_APP_ENV: "production",
        BLASTDOWN_BUILD_PLATFORM: "android",
        ADMOB_ANDROID_APP_ID: ANDROID_APP_ID,
        ADMOB_ANDROID_REWARDED_DEFUSE_UNIT_ID: "not-an-ad-unit",
      }),
    ).toThrow("non-test AdMob ad unit ID");
  });

  it("keeps missing rewarded units null so production fails closed at runtime", () => {
    const config = loadConfig({
      EXPO_PUBLIC_APP_ENV: "production",
      BLASTDOWN_BUILD_PLATFORM: "android",
      ADMOB_ANDROID_APP_ID: ANDROID_APP_ID,
    });

    expect(config.extra?.adMobRewardedUnitIds).toEqual({
      rewarded_freeze: null,
      rewarded_defuse: null,
    });
  });
});
