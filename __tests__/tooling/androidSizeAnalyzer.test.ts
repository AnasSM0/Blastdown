// eslint-disable-next-line @typescript-eslint/no-require-imports
const { categoryFor, summarize } = require("../../scripts/analyze-android-size.cjs") as {
  categoryFor: (name: string) => string;
  summarize: (entries: { name: string; compressedBytes: number; uncompressedBytes: number }[]) => {
    categories: { category: string; files: number; compressedBytes: number }[];
    abis: { abi: string; files: number; compressedBytes: number }[];
    largest: { name: string }[];
  };
};

describe("Android size analyzer", () => {
  it("classifies AAB paths and aggregates ABI contributions", () => {
    const entries = [
      { name: "base/lib/arm64-v8a/libreactnative.so", compressedBytes: 80, uncompressedBytes: 100 },
      { name: "base/lib/arm64-v8a/librnskia.so", compressedBytes: 40, uncompressedBytes: 50 },
      {
        name: "base/lib/armeabi-v7a/libreactnative.so",
        compressedBytes: 60,
        uncompressedBytes: 70,
      },
      { name: "base/assets/music.wav", compressedBytes: 30, uncompressedBytes: 30 },
      { name: "base/res/drawable/icon.png", compressedBytes: 20, uncompressedBytes: 25 },
      { name: "base/assets/index.android.bundle", compressedBytes: 10, uncompressedBytes: 15 },
    ];

    expect(categoryFor("base/lib/arm64-v8a/librnskia.so")).toBe("native libraries");
    expect(categoryFor("base/res/drawable/icon.png")).toBe("resources");
    expect(categoryFor("base/assets/index.android.bundle")).toBe("JS/Hermes bundle");

    const report = summarize(entries);
    expect(report.abis).toEqual([
      { abi: "arm64-v8a", files: 2, compressedBytes: 120, uncompressedBytes: 150 },
      { abi: "armeabi-v7a", files: 1, compressedBytes: 60, uncompressedBytes: 70 },
    ]);
    expect(report.largest[0].name).toBe("base/lib/arm64-v8a/libreactnative.so");
  });
});
