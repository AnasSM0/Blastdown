import { act, fireEvent, render, renderHook, waitFor } from "@testing-library/react-native";
import { AccessibilityInfo, Text } from "react-native";

import { PressableFeedback } from "../../src/components/PressableFeedback";
import { useReducedMotion } from "../../src/hooks/useReducedMotion";
import { motionKey } from "../../src/ui/motionKey";

/** Guards a Fabric crash first diagnosed on the `phase-6b-production-ads-consent`
 *  branch, where the full analysis lives under
 *  `docs/debug/2026-07-28-fabric-consent-crash/`. The crash is a rendering
 *  defect, not an ads one, so the guards are ported here without the ads code
 *  that happened to surface them.
 *
 *  RN 0.86 re-applies the native animation driver's `transform`/`opacity` over
 *  each React commit for any view the driver has touched, and asserts on the
 *  committed type while doing so:
 *
 *    assert(outputReadableMap.getType(PROP_TRANSFORM) == ReadableType.Array ...)
 *
 *  A committed `transform` that is no longer an Array — which is what React
 *  sends when a previously-set style key is REMOVED — fails that assert and
 *  crashes the app. The nine components that omit `transform` under reduced
 *  motion (rather than animating to identity, which is the Android
 *  hardware-layer black-render trap) produce exactly that removal if the
 *  reduced-motion answer flips after they have already bound a transform.
 *
 *  What jest CANNOT do here is decisive: the assert lives in Kotlin and there is
 *  no Fabric under test, so none of this reproduces the crash. These tests pin
 *  the JS-side precondition only — that the reduced-motion signal never travels
 *  in the unsafe direction. Confirmation was a device rebuild.
 *
 *  This matters to the cinematic renderer for a reason that outlives the bug:
 *  every one of these gated components is scheduled to move inside a Skia
 *  Canvas, where a style prop is not an RN view prop at all and the whole class
 *  of defect stops existing. Until that migration is complete both renderers
 *  ship side by side, so the guards must hold for the RN path throughout. */

describe("reduced motion is never guessed as 'motion allowed'", () => {
  it("starts reduced, so no transform is bound before the OS has answered", async () => {
    // Never resolves: the startup window, held open.
    jest
      .spyOn(AccessibilityInfo, "isReduceMotionEnabled")
      .mockReturnValue(new Promise<boolean>(() => {}));

    const { result } = await renderHook(() => useReducedMotion());

    // The unsafe sequence is: report "motion allowed", let the gated components
    // bind a native-driven transform, then report "reduced" and take it away.
    // Reporting reduced first makes that sequence impossible.
    expect(result.current).toBe(true);
  });

  it("only ever ADDS a transform at startup, on a device that allows motion", async () => {
    let resolveOs!: (value: boolean) => void;
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockReturnValue(
      new Promise<boolean>((resolve) => {
        resolveOs = resolve;
      }),
    );

    const { result } = await renderHook(() => useReducedMotion());
    const before = result.current;

    await act(async () => {
      resolveOs(false);
    });
    await waitFor(() => expect(result.current).toBe(false));

    // true -> false is transform ABSENT -> PRESENT. That direction registers a
    // well-formed Array for a view the driver was not yet animating, which is
    // the case the assert accepts. The reverse is the one that crashes.
    expect(before).toBe(true);
  });

  it("settles reduced with no transition at all when the OS reports reduced", async () => {
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);

    const { result } = await renderHook(() => useReducedMotion());

    // The crashing device's configuration: no flip, so no prop-shape change and
    // nothing for the assert to reject.
    await waitFor(() => expect(result.current).toBe(true));
  });

  it("treats an unavailable OS API as motion allowed", async () => {
    jest
      .spyOn(AccessibilityInfo, "isReduceMotionEnabled")
      .mockRejectedValue(new Error("unsupported"));

    const { result } = await renderHook(() => useReducedMotion());

    await waitFor(() => expect(result.current).toBe(false));
  });
});

describe("a live reduced-motion change remounts rather than removing a transform", () => {
  it("gives the timer badge a different identity in each motion mode", () => {
    // The launch fix only removes the FIRST flip. A user toggling the setting
    // mid-run — or the OS emitting `reduceMotionChanged` — still moves
    // true <-> false while views are mounted, and TimerBadge is the sharpest
    // case: its pulse is an `Animated.loop`, so during any run with a timed
    // piece the driver is certainly updating that view.
    //
    // The key makes the change a remount. Deleting the view clears its entry
    // from `tagToSynchronousMountProps`, so the replacement is built with the
    // correct prop shape from its first commit and no removal is ever applied
    // to a live tag.
    expect(motionKey(false)).not.toBe(motionKey(true));
  });

  it("keys every element whose transform is conditional on reduced motion", () => {
    // A structural guard rather than a behavioural one: jest has no Fabric, so
    // the assert cannot be reproduced here. What can be pinned is that each
    // component which OMITS `transform` under reduced motion also carries the
    // key that turns the change into a remount. A tenth component added later
    // with the same conditional and no key would reintroduce the crash.
    const gated = [
      "src/components/ComboIndicator/ComboIndicator.tsx",
      "src/components/effects/PulseRing.tsx",
      "src/components/effects/CellFlash.tsx",
      "src/components/ScoreHeader/ScoreHeader.tsx",
      "src/components/TimerBadge/TimerBadge.tsx",
      "src/components/GridCell/GridCell.tsx",
      "src/components/PieceTray/PieceTray.tsx",
      "src/components/GameBoard/GameBoard.tsx",
      // Found by a second audit, not the first: this one's ternary is nested
      // across lines, so a single-line grep for the pattern missed it. Its
      // "scale" mode toggles the transform exactly like the others, and the
      // value is native-driven, so any dock button that has been pressed is
      // registered with the driver.
      "src/components/PressableFeedback/PressableFeedback.tsx",
    ];
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { readFileSync } = require("fs") as { readFileSync: (p: string, e: string) => string };
    for (const file of gated) {
      const source = readFileSync(file, "utf8");
      // A regex rather than a literal: PressableFeedback's key is conditional
      // (only its "scale" mode toggles the transform), so the call is not the
      // first thing inside the braces.
      const keyed = /key=\{[^}]*motionKey\(/.test(source);
      expect({ file, keyed }).toEqual({ file, keyed: true });
    }
  });

  it("keys the modal appear transition, which also toggles a transform", () => {
    // `useAppearAnimation` returns `{opacity: 1}` under reduced motion and
    // `{opacity, transform: [...]}` otherwise — the same shape toggle, on a
    // native-driven value, applied to pause/defuse/game-over panels.
    //
    // The key comes back FROM the hook rather than being computed by each
    // panel, because the hook resolves the effective reduced-motion value
    // itself: a caller passing `undefined` would key off the wrong input and
    // the style and the key could disagree.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { readFileSync } = require("fs") as { readFileSync: (p: string, e: string) => string };
    for (const file of [
      "src/components/modals/DefuseConfirmCard.tsx",
      "src/components/modals/GameOverOverlay.tsx",
      "src/components/modals/PauseOverlay.tsx",
    ]) {
      const source = readFileSync(file, "utf8");
      expect({ file, keyed: source.includes("key={appear.key}") }).toEqual({ file, keyed: true });
    }
  });
});

describe("press feedback survives unmount mid-animation", () => {
  it("unmounts during a press without throwing", async () => {
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false);

    const view = await render(
      <PressableFeedback testID="control" reducedMotion={false} onPress={() => {}}>
        <Text>press</Text>
      </PressableFeedback>,
    );
    await fireEvent(view.getByTestId("control"), "pressIn");

    // Navigation happens on press, so unmount-mid-animation is the ordinary
    // case rather than the edge one.
    await expect(view.unmount()).resolves.not.toThrow();
  });
});
