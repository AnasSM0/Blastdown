import type { ExpoConfig } from "expo/config";

const APP_ENV = process.env.EXPO_PUBLIC_APP_ENV ?? "development";
const IS_PRODUCTION = APP_ENV === "production";
const BUILD_PLATFORM = process.env.BLASTDOWN_BUILD_PLATFORM;

if (BUILD_PLATFORM !== undefined && BUILD_PLATFORM !== "android" && BUILD_PLATFORM !== "ios") {
  throw new Error("BLASTDOWN_BUILD_PLATFORM must be either android or ios when set.");
}

// Google's published sample AdMob app IDs. Safe to use in development and
// preview builds. Production builds must supply real IDs via environment
// configuration (see docs/DECISIONS.md and BUILD_SPEC.md section 11.6).
const TEST_ADMOB_ANDROID_APP_ID = "ca-app-pub-3940256099942544~3347511713";
const TEST_ADMOB_IOS_APP_ID = "ca-app-pub-3940256099942544~1458002511";
const GOOGLE_TEST_ADMOB_PUBLISHER = "ca-app-pub-3940256099942544";

function requireProductionAppId(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Production ${BUILD_PLATFORM ?? "multi-platform"} config requires ${name}.`);
  }
  if (value.startsWith(GOOGLE_TEST_ADMOB_PUBLISHER) || !/^ca-app-pub-\d{16}~\d{10}$/.test(value)) {
    throw new Error(`${name} must be a valid non-test AdMob App ID in production.`);
  }
  return value;
}

function optionalProductionUnitId(name: string, value: string | undefined): string | null {
  if (!value) return null;
  if (value.startsWith(GOOGLE_TEST_ADMOB_PUBLISHER) || !/^ca-app-pub-\d{16}\/\d{10}$/.test(value)) {
    throw new Error(`${name} must be a valid non-test AdMob ad unit ID in production.`);
  }
  return value;
}

let androidAppId: string | undefined;
let iosAppId: string | undefined;
let rewardedFreezeUnitId: string | null = null;
let rewardedDefuseUnitId: string | null = null;
if (IS_PRODUCTION) {
  if (BUILD_PLATFORM !== "ios") {
    androidAppId = requireProductionAppId("ADMOB_ANDROID_APP_ID", process.env.ADMOB_ANDROID_APP_ID);
    rewardedFreezeUnitId = optionalProductionUnitId(
      "ADMOB_ANDROID_REWARDED_FREEZE_UNIT_ID",
      process.env.ADMOB_ANDROID_REWARDED_FREEZE_UNIT_ID,
    );
    rewardedDefuseUnitId = optionalProductionUnitId(
      "ADMOB_ANDROID_REWARDED_DEFUSE_UNIT_ID",
      process.env.ADMOB_ANDROID_REWARDED_DEFUSE_UNIT_ID,
    );
  }
  if (BUILD_PLATFORM !== "android") {
    iosAppId = requireProductionAppId("ADMOB_IOS_APP_ID", process.env.ADMOB_IOS_APP_ID);
    rewardedFreezeUnitId = optionalProductionUnitId(
      "ADMOB_IOS_REWARDED_FREEZE_UNIT_ID",
      process.env.ADMOB_IOS_REWARDED_FREEZE_UNIT_ID,
    );
    rewardedDefuseUnitId = optionalProductionUnitId(
      "ADMOB_IOS_REWARDED_DEFUSE_UNIT_ID",
      process.env.ADMOB_IOS_REWARDED_DEFUSE_UNIT_ID,
    );
  }
} else {
  androidAppId = process.env.ADMOB_ANDROID_APP_ID ?? TEST_ADMOB_ANDROID_APP_ID;
  iosAppId = process.env.ADMOB_IOS_APP_ID ?? TEST_ADMOB_IOS_APP_ID;
}

const adMobPluginConfig: Record<string, string> = {};
if (androidAppId) adMobPluginConfig.androidAppId = androidAppId;
if (iosAppId) adMobPluginConfig.iosAppId = iosAppId;

/** The EAS project this repository builds as: `@anassm0/blastdown`. Written by
 *  hand because `eas init` cannot edit a dynamic `app.config.ts` — it creates
 *  the project remotely and then asks for the link to be made here. Changing it
 *  points builds at a different EAS project, so it is a constant, not an env
 *  var. */
const EAS_PROJECT_ID = "12dff6d2-1121-40b4-bc34-e0b481285266";

const config: ExpoConfig = {
  name: "BlastDown",
  slug: "blastdown",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  scheme: "blastdown",
  ios: {
    supportsTablet: false,
    bundleIdentifier: "com.blastdown.app",
  },
  android: {
    package: "com.blastdown.app",
    adaptiveIcon: {
      backgroundColor: "#E6F4FE",
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundImage: "./assets/android-icon-background.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: "./assets/favicon.png",
  },
  plugins: [
    "expo-router",
    "expo-asset",
    "expo-audio",
    "expo-font",
    "expo-status-bar",
    "expo-splash-screen",
    ["react-native-google-mobile-ads", adMobPluginConfig],
  ],
  extra: {
    appEnv: APP_ENV,
    adMobRewardedUnitIds: {
      rewarded_freeze: rewardedFreezeUnitId,
      rewarded_defuse: rewardedDefuseUnitId,
    },
    eas: {
      projectId: EAS_PROJECT_ID,
    },
  },
};

export default config;
