/**
 * Production fallback builds exclude native libraries that are reachable only
 * from the opt-in cinematic renderer. Expo Autolinking officially honors a
 * `null` platform entry for React Native modules. Development clients keep the
 * full native runtime regardless of renderer flag so ON/OFF Metro qualification
 * remains possible with either client.
 */
const isProduction = process.env.EXPO_PUBLIC_APP_ENV === "production";
const cinematicEnabled = ["1", "true", "skia"].includes(
  process.env.EXPO_PUBLIC_CINEMATIC_BOARD ?? "",
);
const excludeCinematicNativeRuntime = isProduction && !cinematicEnabled;

const android = excludeCinematicNativeRuntime ? null : {};

module.exports = {
  dependencies: {
    "@shopify/react-native-skia": { platforms: { android } },
    "react-native-reanimated": { platforms: { android } },
    "react-native-worklets": { platforms: { android } },
  },
};
