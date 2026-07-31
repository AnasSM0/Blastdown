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

/** Resolve the renderer for this build. Anything other than an explicit opt-in
 *  keeps the proven renderer: an unset, empty, misspelled or half-written value
 *  must never be the reason an untested renderer ships.
 *
 *  ## Why this is an exact match and no longer case-insensitive
 *
 *  It used to read `raw?.trim().toLowerCase()`, so `"SKIA"` and `" true "` opted
 *  in too. That tolerance cost more than it bought.
 *
 *  Expo substitutes `process.env.EXPO_PUBLIC_*` with a string literal in a
 *  production build, which is what lets `src/rendering/boardRenderer.ts` fold its
 *  branch away and keep the cinematic renderer out of the bundle entirely. A
 *  `.trim().toLowerCase()` is a runtime computation on that literal, so it can
 *  only ever be evaluated at runtime — the tolerant spellings are unreachable to
 *  the bundler by construction.
 *
 *  Keeping them would mean `EXPO_PUBLIC_CINEMATIC_BOARD="SKIA"` resolving to
 *  `"skia"` here while the bundle excluded the module: the app would silently
 *  mount the fallback while this function, and the diagnostics overlay reading
 *  it, both reported `skia`. A diagnostic that disagrees with what is on screen
 *  is worse than a strict flag.
 *
 *  So the comparison below is character-for-character the one `boardRenderer.ts`
 *  folds on, and the two cannot drift. The cost is that a mis-cased value now
 *  falls back — which is the direction this flag is supposed to fail in anyway.
 *  This is a deploy-time switch set in EAS config, not user input. */
export function resolveBoardRenderer(): BoardRenderer {
  if (
    process.env.EXPO_PUBLIC_CINEMATIC_BOARD === "1" ||
    process.env.EXPO_PUBLIC_CINEMATIC_BOARD === "true" ||
    process.env.EXPO_PUBLIC_CINEMATIC_BOARD === "skia"
  ) {
    return "skia";
  }
  return DEFAULT_BOARD_RENDERER;
}

export function isCinematicRendererEnabled(): boolean {
  return resolveBoardRenderer() === "skia";
}
