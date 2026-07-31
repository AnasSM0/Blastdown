import type { ComponentType } from "react";

import { isDevelopmentBuild } from "../config/environment";

/** The only way into the effect harness.
 *
 *  Returns `null` outside a development build, and the `require` below is the
 *  reason that means something. A static import would evaluate the harness
 *  screen — and everything it pulls in — on every bundle, and "renders a message
 *  instead" is not the same as absent: the screen would still be shipped, still
 *  be reachable by anyone who found the route, and still be a surface nobody
 *  tests in a release build.
 *
 *  The pattern deliberately mirrors `src/rendering/boardRenderer.ts`, which
 *  gates the cinematic renderer the same way and for the same reason: the
 *  bundler can see a constant branch and drop the untaken side. */
export function resolveEffectHarness(): ComponentType | null {
  if (!isDevelopmentBuild()) {
    return null;
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("./EffectHarnessScreen").EffectHarnessScreen as ComponentType;
}
