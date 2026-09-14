import NativeSourceCode from "react-native/Libraries/NativeModules/specs/NativeSourceCode";

let cachedUrl;
let cachedFullBundleUrl;

/** Release equivalent of React Native's getDevServer helper. React Native's
 * fallback embeds a localhost URL even when the bundle is installed; the URL
 * is never used in that state, but release qualification forbids it. */
export default function getDevServer() {
  if (cachedUrl === undefined) {
    const scriptUrl = NativeSourceCode.getConstants().scriptURL;
    const match = scriptUrl.match(/^https?:\/\/.*?\//);
    cachedUrl = match ? match[0] : null;
    cachedFullBundleUrl = match ? scriptUrl : null;
  }
  return {
    url: cachedUrl ?? "https://invalid.invalid/",
    fullBundleUrl: cachedFullBundleUrl,
    bundleLoadedFromServer: cachedUrl !== null,
  };
}
