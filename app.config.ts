import type { ExpoConfig } from "expo/config";

const APP_ENV = process.env.EXPO_PUBLIC_APP_ENV ?? "development";
const IS_PRODUCTION = APP_ENV === "production";

// Google's published sample AdMob app IDs. Safe to use in development and
// preview builds. Production builds must supply real IDs via environment
// configuration (see docs/DECISIONS.md and BUILD_SPEC.md section 11.6).
const TEST_ADMOB_ANDROID_APP_ID = "ca-app-pub-3940256099942544~3347511713";
const TEST_ADMOB_IOS_APP_ID = "ca-app-pub-3940256099942544~1458002511";

const androidAppId = process.env.ADMOB_ANDROID_APP_ID ?? TEST_ADMOB_ANDROID_APP_ID;
const iosAppId = process.env.ADMOB_IOS_APP_ID ?? TEST_ADMOB_IOS_APP_ID;

if (IS_PRODUCTION) {
  if (!process.env.ADMOB_ANDROID_APP_ID || !process.env.ADMOB_IOS_APP_ID) {
    throw new Error(
      "Production builds require ADMOB_ANDROID_APP_ID and ADMOB_IOS_APP_ID to be set. " +
        "Refusing to ship Google test ad unit IDs in a production build.",
    );
  }
}

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
    [
      "react-native-google-mobile-ads",
      {
        androidAppId,
        iosAppId,
      },
    ],
  ],
  extra: {
    appEnv: APP_ENV,
    eas: {
      projectId: EAS_PROJECT_ID,
    },
  },
};

export default config;
