const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
const defaultResolveRequest = config.resolver.resolveRequest;
const productionTestIdsShim = path.resolve(__dirname, "src/services/ads/productionTestIdsShim.js");
const productionDevServerShim = path.resolve(__dirname, "src/config/productionDevServerShim.js");

/** Google Mobile Ads' public barrel exports its sample TestIds table, so Metro
 * includes every sample identifier even when BlastDown never imports TestIds.
 * Replace that single internal leaf in production. Development keeps Google's
 * official test table unchanged. */
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolved = defaultResolveRequest
    ? defaultResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
  if (process.env.EXPO_PUBLIC_APP_ENV !== "production" || resolved.type !== "sourceFile") {
    return resolved;
  }
  const filePath = resolved.filePath.replaceAll("\\", "/");
  if (filePath.endsWith("/react-native-google-mobile-ads/src/TestIds.ts")) {
    return { filePath: productionTestIdsShim, type: "sourceFile" };
  }
  if (filePath.endsWith("/react-native/Libraries/Core/Devtools/getDevServer.js")) {
    return { filePath: productionDevServerShim, type: "sourceFile" };
  }
  return resolved;
};

module.exports = config;
