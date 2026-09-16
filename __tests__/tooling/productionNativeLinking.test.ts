// eslint-disable-next-line @typescript-eslint/no-require-imports
const { execFileSync } = require("node:child_process") as {
  execFileSync: (
    command: string,
    args: string[],
    options: { encoding: "utf8"; env: NodeJS.ProcessEnv },
  ) => string;
};

const cinematicNativePackages = [
  "@shopify/react-native-skia",
  "react-native-reanimated",
  "react-native-worklets",
];

function linkedPackages(appEnv: string, renderer: string): string[] {
  const output = execFileSync(
    process.execPath,
    [
      "node_modules/expo-modules-autolinking/bin/expo-modules-autolinking",
      "react-native-config",
      "--platform",
      "android",
      "--json",
    ],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        EXPO_PUBLIC_APP_ENV: appEnv,
        EXPO_PUBLIC_CINEMATIC_BOARD: renderer,
      },
    },
  );
  const config = JSON.parse(output) as { dependencies: Record<string, unknown> };
  return Object.keys(config.dependencies);
}

describe("production cinematic native linking", () => {
  it("excludes cinematic-only native packages from production fallback", () => {
    const linked = linkedPackages("production", "0");
    for (const dependency of cinematicNativePackages) expect(linked).not.toContain(dependency);
  });

  it("keeps the full runtime for cinematic and development builds", () => {
    for (const [appEnv, renderer] of [
      ["production", "1"],
      ["development", "0"],
    ]) {
      const linked = linkedPackages(appEnv, renderer);
      for (const dependency of cinematicNativePackages) expect(linked).toContain(dependency);
    }
  });
});
