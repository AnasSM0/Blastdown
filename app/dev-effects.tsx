import { resolveEffectHarness } from "../src/dev/effectHarnessEntry";

/** The effect delivery harness route.
 *
 *  Present as a file because expo-router builds its routes from the filesystem,
 *  and absent as a screen because the resolver returns nothing outside a
 *  development build. A player on a store build who reaches this path gets an
 *  empty screen backed by no code, rather than a hidden debug menu.
 *
 *  Reached in development by navigating to `/dev-effects` — see
 *  `docs/CINEMATIC_PERFORMANCE.md` for the device procedure. */
// Resolved once, at module scope, so the route renders a stable component type
// rather than minting one per render — and so the decision, like the renderer
// flag's, happens exactly once.
const Harness = resolveEffectHarness();

export default function DevEffectsRoute() {
  return Harness ? <Harness /> : null;
}
