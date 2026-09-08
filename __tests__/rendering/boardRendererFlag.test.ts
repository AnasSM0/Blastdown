import {
  DEFAULT_BOARD_RENDERER,
  isCinematicRendererEnabled,
  resolveBoardRenderer,
} from "../../src/config/renderer";

/** The flag exists so an unproven renderer cannot reach a player by accident.
 *  That makes its FAILURE modes the interesting part: what a misspelling does,
 *  what an empty string does, what an unset variable does. Every one of them has
 *  to fall back to the renderer that has been on a phone. */

describe("the board renderer flag", () => {
  const original = process.env.EXPO_PUBLIC_CINEMATIC_BOARD;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.EXPO_PUBLIC_CINEMATIC_BOARD;
    } else {
      process.env.EXPO_PUBLIC_CINEMATIC_BOARD = original;
    }
  });

  it("keeps the device-tested renderer when nothing is set", () => {
    delete process.env.EXPO_PUBLIC_CINEMATIC_BOARD;

    expect(resolveBoardRenderer()).toBe("views");
    expect(DEFAULT_BOARD_RENDERER).toBe("views");
    expect(isCinematicRendererEnabled()).toBe(false);
  });

  it.each(["1", "true", "skia"])("opts in on %p", (value) => {
    process.env.EXPO_PUBLIC_CINEMATIC_BOARD = value;

    expect(resolveBoardRenderer()).toBe("skia");
  });

  it.each(["", "0", "false", "ski", "yes", "on", "views"])("falls back on %p", (value) => {
    process.env.EXPO_PUBLIC_CINEMATIC_BOARD = value;

    // "yes" and "on" are the interesting rows: they read as an opt-in to a
    // human and are not one here. Silently shipping an untested renderer to
    // someone who typed the wrong true-ish word is the failure this prevents.
    expect(resolveBoardRenderer()).toBe("views");
  });

  it.each(["SKIA", "True", " true ", "Skia"])("no longer opts in on %p", (value) => {
    process.env.EXPO_PUBLIC_CINEMATIC_BOARD = value;

    // These four DID opt in, through a `.trim().toLowerCase()`. They stopped,
    // and the change is deliberate: that normalisation is a runtime computation
    // on a literal Expo inlines at build time, so Metro cannot fold the branch
    // that keeps the cinematic renderer out of a disabled bundle. Tolerating
    // them would mean this function answering "skia" for a build whose bundle
    // does not contain the renderer — the app silently mounting the fallback
    // while every diagnostic claimed otherwise.
    //
    // Falling back is the safe direction, and the flag is a deploy-time switch
    // in EAS config rather than something a person types under pressure.
    expect(resolveBoardRenderer()).toBe("views");
    expect(isCinematicRendererEnabled()).toBe(false);
  });
});
