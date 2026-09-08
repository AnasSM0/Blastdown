/** A React `key` that changes when the reduced-motion answer changes.
 *
 *  Applied to any element whose style conditionally includes `transform`, so a
 *  live reduced-motion change REMOUNTS that element instead of mutating its
 *  prop shape in place.
 *
 *  This is load-bearing on Android, not a nicety. The gated components omit
 *  `transform` entirely under reduced motion rather than animating to identity,
 *  because an identity transform promotes a rounded or elevated view to its own
 *  hardware layer (the black-render trap, DECISIONS 2026-07-22). So flipping the
 *  setting changes whether the prop EXISTS.
 *
 *  RN 0.86 re-applies the native animation driver's `transform` over each React
 *  commit for any view the driver has touched, and asserts that the committed
 *  value is still an Array (`SurfaceMountingManager.overridePropsReadableMap`).
 *  React sends a removed style key as null, so removing a transform from a view
 *  the driver is actively updating fails that assert and crashes the app —
 *  `docs/debug/2026-07-28-fabric-consent-crash/`. A `TimerBadge` mid-run is the
 *  clearest case: its pulse is an `Animated.loop`, so the view is guaranteed to
 *  be registered with the driver when the user toggles the setting.
 *
 *  Remounting sidesteps it exactly. Deleting the view clears its entry from
 *  `tagToSynchronousMountProps`, and the replacement is created with the correct
 *  prop shape from its first commit, so no removal is ever applied to a live
 *  tag. Every element keyed this way is purely presentational — there is no
 *  state to lose, and the setting still takes effect immediately.
 *
 *  Startup does not rely on this: `useReducedMotion` starts reduced precisely so
 *  the first transition can only ADD a transform. This covers the other
 *  direction — a Settings toggle, or the OS `reduceMotionChanged` event, while
 *  the app is running. */
export function motionKey(reducedMotion: boolean | undefined): string {
  // Undefined means the caller has no opinion and the component falls back to
  // its own hook, which reports a boolean — so it groups with "motion allowed".
  return reducedMotion ? "motion-off" : "motion-on";
}
