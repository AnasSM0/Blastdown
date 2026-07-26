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

/** Environment variable holding the rewarded ad unit for each placement, plus
 *  the shared fallback for a single-unit AdMob setup. Mirrors — and is verified
 *  against — `REWARDED_AD_UNIT_ENV_VARS` in `src/config/ads.ts`; this file
 *  cannot import from `src/` because Expo transpiles only the config entry
 *  itself, so `__tests__/domain/adConfig.test.ts` asserts the two agree. */
const REWARDED_AD_UNIT_ENV_VARS = {
  freeze: "EXPO_PUBLIC_ADMOB_REWARDED_FREEZE",
  defuse: "EXPO_PUBLIC_ADMOB_REWARDED_DEFUSE",
  revive: "EXPO_PUBLIC_ADMOB_REWARDED_REVIVE",
  doubleBolts: "EXPO_PUBLIC_ADMOB_REWARDED_DOUBLE_BOLTS",
} as const;

const REWARDED_AD_UNIT_FALLBACK_ENV_VAR = "EXPO_PUBLIC_ADMOB_REWARDED_DEFAULT";

/** Every reason a production ad-unit configuration is unusable. Exported for
 *  the drift test above; the build itself only uses `assertProductionAdUnits`. */
export function collectProductionAdUnitErrors(env: Record<string, string | undefined>): string[] {
  const errors: string[] = [];
  const fallback = env[REWARDED_AD_UNIT_FALLBACK_ENV_VAR];
  for (const [key, variable] of Object.entries(REWARDED_AD_UNIT_ENV_VARS)) {
    const configured = env[variable] ?? fallback;
    if (!configured) {
      errors.push(
        `Missing rewarded ad unit for "${key}". Set ${variable} ` +
          `(or ${REWARDED_AD_UNIT_FALLBACK_ENV_VAR} for all placements).`,
      );
    } else if (configured.startsWith("ca-app-pub-3940256099942544/")) {
      errors.push(
        `Rewarded ad unit for "${key}" is a Google test unit (${configured}). ` +
          `Production builds must use a real AdMob ad unit id.`,
      );
    }
  }
  return errors;
}

if (IS_PRODUCTION) {
  if (!process.env.ADMOB_ANDROID_APP_ID || !process.env.ADMOB_IOS_APP_ID) {
    throw new Error(
      "Production builds require ADMOB_ANDROID_APP_ID and ADMOB_IOS_APP_ID to be set. " +
        "Refusing to ship Google test ad unit IDs in a production build.",
    );
  }
  // Same rule one level down: the app id identifies the account, the ad unit ids
  // identify what actually gets requested. Failing here means a misconfigured
  // release never leaves the build machine. See docs/MONETIZATION.md.
  const adUnitErrors = collectProductionAdUnitErrors(process.env);
  if (adUnitErrors.length > 0) {
    throw new Error(`Invalid production ad configuration:\n  - ${adUnitErrors.join("\n  - ")}`);
  }
}

/** R8 strips the UMP consent SDK's reflected classes in a release build, which
 *  surfaces as a consent form that never appears — only in release, only on
 *  device. Keeping the package is the fix Google documents. `extraProguardRules`
 *  is appended to the generated `proguard-rules.pro` by expo-build-properties;
 *  there is no other Expo-config route to a ProGuard rule. */
const UMP_PROGUARD_RULES = "-keep class com.google.android.gms.internal.consent_sdk.** { *; }";

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
      "expo-build-properties",
      {
        android: {
          extraProguardRules: UMP_PROGUARD_RULES,
        },
      },
    ],
    [
      "react-native-google-mobile-ads",
      {
        androidAppId,
        iosAppId,
        // Hold app-measurement back until the UMP flow has run and reported
        // that ads may be requested. Without this the measurement SDK starts
        // collecting at process start, before any consent decision exists.
        delayAppMeasurementInit: true,
      },
    ],
  ],
  extra: {
    appEnv: APP_ENV,
  },
};

export default config;
