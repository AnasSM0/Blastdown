/** Which board renderer the game screen mounts.
 *
 *  Two renderers ship side by side while the cinematic one is unproven:
 *
 *  - `views`   — the original React Native renderer (GameBoard + 64 GridCells +
 *                the RN effects overlay). Device-tested across Phases 1-3.
 *  - `skia`    — the single-canvas cinematic renderer.
 *
 *  The default is `views`, and stays `views` until the cinematic renderer has
 *  passed device QA on a physical Android phone. That is the whole point of the
 *  flag: this repository has now shipped two device-only faults that no local
 *  check could catch (a Kotlin metadata mismatch that broke the native build,
 *  and a Fabric prop assertion that crashed every launch), and a renderer is
 *  exactly the kind of change where a build machine's opinion is worth little.
 *
 *  Note what the default is NOT: it is not "on in development, off in
 *  production". A renderer that silently differs between the build you test and
 *  the build you ship is how an unverified path reaches a user. Both builds read
 *  the same variable, so QA runs the same code the store would. */

export type BoardRenderer = "views" | "skia";

export const DEFAULT_BOARD_RENDERER: BoardRenderer = "views";

/** Expo inlines `process.env.EXPO_PUBLIC_*` at build time by substituting the
 *  literal expression, so this must be written out in full — a computed lookup
 *  reads `undefined` in a release bundle. */
function rawFlag(): string | undefined {
  return process.env.EXPO_PUBLIC_CINEMATIC_BOARD;
}

/** Resolve the renderer for this build. Anything other than an explicit opt-in
 *  keeps the proven renderer: an unset, empty, misspelled or half-written value
 *  must never be the reason an untested renderer ships. */
export function resolveBoardRenderer(): BoardRenderer {
  const raw = rawFlag()?.trim().toLowerCase();
  if (raw === "1" || raw === "true" || raw === "skia") {
    return "skia";
  }
  return DEFAULT_BOARD_RENDERER;
}

export function isCinematicRendererEnabled(): boolean {
  return resolveBoardRenderer() === "skia";
}
