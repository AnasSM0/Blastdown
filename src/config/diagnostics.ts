import { Platform } from "react-native";

import { resolveAdEnvironment } from "./ads";

/** Development-only switches for bisecting a device-only fault.
 *
 *  These exist to make `docs/debug/2026-07-28-fabric-consent-crash` reproducible
 *  one variable at a time, on a physical phone, by someone who is not holding a
 *  debugger. They are not features and not user settings.
 *
 *  Every one of them is gated on `EXPO_PUBLIC_APP_ENV === "development"`, which
 *  is a build-environment gate rather than a runtime toggle — a preview or
 *  production build cannot be talked into any of these states, whatever is in
 *  its environment. Each is read as a literal `process.env.EXPO_PUBLIC_X`
 *  access, because Expo's inlining is a compile-time substitution of that exact
 *  syntax and a computed lookup would silently read `undefined` in a release
 *  bundle.
 *
 *  Everything here is expected to be deleted once the crash is closed out. */

const IS_DEVELOPMENT = resolveAdEnvironment() === "development";

function devFlag(raw: string | undefined): boolean {
  return IS_DEVELOPMENT && raw === "1";
}

/** Matrix row 6 — do not mount `ConsentProvider` at all.
 *
 *  Ads stay unavailable for the run, exactly as they do when the SDK is
 *  missing, and gameplay is untouched. If the crash survives this, consent is
 *  exonerated outright. */
export const DIAG_DISABLE_CONSENT = devFlag(process.env.EXPO_PUBLIC_DIAG_DISABLE_CONSENT);

/** Matrix row 5 — run the consent lifecycle but never present a form.
 *
 *  The port requests fresh consent information and stops there, so UMP is still
 *  exercised (including the debug-device message and any WebView warm-up) with
 *  the form presentation removed as a variable. */
export const DIAG_BYPASS_CONSENT_FORM = devFlag(process.env.EXPO_PUBLIC_DIAG_BYPASS_CONSENT_FORM);

/** Matrix rows 7/8 — drop the Android screen transition.
 *
 *  This is the temporary confirmation lever, not a fix. It stays a flag rather
 *  than an unconditional `animation: "none"` because there is no evidence yet
 *  that navigation transitions are involved, and shipping a permanent UX change
 *  on an untested hunch is worse than shipping the flag. If the device matrix
 *  shows this is what stops the crash, it graduates into a real, narrow change
 *  with a comment pointing at the evidence. */
export const DIAG_ANDROID_NAV_ANIMATION_NONE = devFlag(
  process.env.EXPO_PUBLIC_DIAG_ANDROID_NAV_ANIMATION_NONE,
);

/** The `animation` screen option for the root stack. `undefined` leaves Expo
 *  Router's default in place, which is what every non-diagnostic build gets. */
export function resolveStackAnimation(): "none" | undefined {
  return DIAG_ANDROID_NAV_ANIMATION_NONE && Platform.OS === "android" ? "none" : undefined;
}
