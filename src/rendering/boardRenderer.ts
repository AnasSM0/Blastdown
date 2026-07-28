import { GameBoard } from "../components/GameBoard";
import { isCinematicRendererEnabled } from "../config/renderer";

/** Which board renderer this build uses, resolved once at module load.
 *
 *  The `require` is deliberate, and the static `import` it replaced was a real
 *  defect. `@shopify/react-native-skia` installs its native JSI bindings when
 *  the module is EVALUATED, not when a component using it first renders — which
 *  is why importing the real package under jest throws "Native Skia Module
 *  failed to correctly install JSI Bindings" rather than failing later.
 *
 *  So a top-level import of the cinematic board initialised Skia at app startup
 *  even with the flag off, and that defeats the point of having a flag. The
 *  fallback is meant to be the thing that rescues a build when the new path is
 *  broken: if Skia cannot initialise on a device, turning the renderer off has
 *  to actually help, and with a static import it would not have.
 *
 *  `EXPO_PUBLIC_CINEMATIC_BOARD` is inlined at build time, so this branch is a
 *  constant and the bundler can see both sides. With the flag off the cinematic
 *  graph — Skia, Reanimated, the canvas layers — is never evaluated, and the app
 *  runs exactly the code it ran before this renderer existed.
 *
 *  Resolved at module scope rather than per render so that the decision, and
 *  therefore the initialisation, happens exactly once. */
export const CINEMATIC_RENDERER = isCinematicRendererEnabled();

export const BoardRenderer: typeof GameBoard = CINEMATIC_RENDERER
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require("../components/CinematicBoard").CinematicBoard as typeof GameBoard)
  : GameBoard;
