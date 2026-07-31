import { GameBoard } from "../components/GameBoard";

/** Which board renderer this build uses, resolved once at module load.
 *
 *  ## Two separate guarantees, and why the first one was not enough
 *
 *  **Initialisation.** `@shopify/react-native-skia` installs its native JSI
 *  bindings when the module is EVALUATED, not when a component using it first
 *  renders — which is why importing the real package under jest throws "Native
 *  Skia Module failed to correctly install JSI Bindings" rather than failing
 *  later. A top-level `import` of the cinematic board therefore initialised Skia
 *  at app startup even with the flag off, defeating the point of the flag: the
 *  fallback is meant to rescue a build when the new path is broken, so if Skia
 *  cannot initialise on a device, turning the renderer off has to actually help.
 *  A require that never executes fixes that, and did.
 *
 *  **Bundling.** The require used to be gated on `isCinematicRendererEnabled()`,
 *  under a comment claiming the branch was a constant the bundler could see both
 *  sides of. It was not. Expo does substitute `EXPO_PUBLIC_*` with a literal in
 *  a production build — that part was true — but wrapping it in a function call
 *  throws the constant away, so Metro folded nothing, `collectDependencies`
 *  walked into the require, and the cinematic renderer, Skia, Reanimated and
 *  every canvas layer shipped inside builds that would never draw one frame with
 *  them. The runtime guarantee held the whole time, which is exactly why it went
 *  unnoticed.
 *
 *  ## The shape below is load-bearing
 *
 *  Three things have to be true together, and dropping any one of them silently
 *  puts the module back in the bundle:
 *
 *  1. The condition compares `process.env.EXPO_PUBLIC_CINEMATIC_BOARD` DIRECTLY
 *     against string literals. No function call, no local variable, no `.trim()`
 *     or `.toLowerCase()` — every one of those turns the inlined literal back
 *     into something Metro has to evaluate at runtime.
 *  2. The require sits INSIDE the branch that folds away. `if (!enabled) return`
 *     followed by the require does not work: the `if` folds to its consequent
 *     and leaves the require in the body underneath, still collected. That
 *     near-miss is documented in `src/dev/effectHarnessEntry.ts`, which made it.
 *  3. `CINEMATIC_RENDERER` is derived from whether the require actually
 *     happened, not from re-reading the flag. That is what makes the two
 *     guarantees impossible to disagree: a build that excluded the module
 *     reports `false` and mounts `GameBoard`, whatever anything else thinks.
 *
 *  `src/config/renderer.ts` deliberately uses the identical comparison so the
 *  runtime answer and the bundled answer cannot drift apart.
 *
 *  `__tests__/rendering/boardRendererBundle.test.ts` runs Expo's own inlining
 *  plugin and Metro's constant folding over THIS FILE and asserts the require is
 *  gone when the flag is off — and, in the same suite, that both wrong gates
 *  above still retain it. A source-pattern guard was not used on purpose; see
 *  `docs/DECISIONS.md` on the guard that certified two broken blur passes.
 *
 *  Resolved at module scope rather than per render so that the decision, and
 *  therefore the initialisation, happens exactly once. */
let cinematic: typeof GameBoard | null = null;

if (
  process.env.EXPO_PUBLIC_CINEMATIC_BOARD === "1" ||
  process.env.EXPO_PUBLIC_CINEMATIC_BOARD === "true" ||
  process.env.EXPO_PUBLIC_CINEMATIC_BOARD === "skia"
) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  cinematic = (require("../components/CinematicBoard") as { CinematicBoard: typeof GameBoard })
    .CinematicBoard;
}

export const CINEMATIC_RENDERER = cinematic !== null;

/** The board this build draws with. Falls back to the device-tested renderer
 *  whenever the cinematic module is not in this bundle, so a build that excluded
 *  it cannot fail to render — it renders the proven one. */
export const BoardRenderer: typeof GameBoard = cinematic ?? GameBoard;
