import { act, fireEvent, render, renderHook, waitFor } from "@testing-library/react-native";
import { AccessibilityInfo, AppState, Text } from "react-native";

import { PressableFeedback } from "../../src/components/PressableFeedback";
import { resolveStackAnimation } from "../../src/config/diagnostics";
import { useReducedMotion } from "../../src/hooks/useReducedMotion";
import { ConsentProvider } from "../../src/services/consent";
import { createMockConsentPort } from "../../src/services/consent/MockConsentPort";
import { captureAppStateHandlers } from "../../test-utils/appState";

/** Guards the Fabric crash recorded in
 *  `docs/debug/2026-07-28-fabric-consent-crash/`.
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
 *  in the unsafe direction at startup. Confirmation is the device matrix. */

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

describe("the Android navigation-animation diagnostic", () => {
  it("leaves the default transition in place unless explicitly enabled", () => {
    // Development-only and off, so every build that reaches a user keeps Expo
    // Router's own animation. The workaround is a lever for the device matrix,
    // not a shipped behaviour change.
    expect(resolveStackAnimation()).toBeUndefined();
  });
});

describe("the consent launch waits for a foregrounded app", () => {
  const originalState = AppState.currentState;

  afterEach(() => {
    (AppState as { currentState: string }).currentState = originalState;
  });

  it("starts immediately when the app is already active", async () => {
    (AppState as { currentState: string }).currentState = "active";
    const port = createMockConsentPort();

    await render(
      <ConsentProvider port={port} debugEnabled={false}>
        <Text>game</Text>
      </ConsentProvider>,
    );

    // The normal case must be unchanged: no deferral, no extra frame.
    await waitFor(() => expect(port.gatherCalls.length).toBe(1));
  });

  it("defers the launch sequence until the app becomes active, and runs it once", async () => {
    (AppState as { currentState: string }).currentState = "background";
    const captured = captureAppStateHandlers();
    const port = createMockConsentPort();

    try {
      const view = await render(
        <ConsentProvider port={port} debugEnabled={false}>
          <Text>game</Text>
        </ConsentProvider>,
      );

      // A cold start into the background must not present a form into an
      // activity that is not stable.
      expect(port.gatherCalls.length).toBe(0);
      // Gameplay never waits on any of this.
      expect(view.getByText("game")).toBeTruthy();

      await act(async () => {
        captured.handlers.forEach((handler) => handler("active"));
      });
      await waitFor(() => expect(port.gatherCalls.length).toBe(1));

      // A later background/resume cycle must not re-run a launch-once sequence.
      await act(async () => {
        captured.handlers.forEach((handler) => handler("background"));
        captured.handlers.forEach((handler) => handler("active"));
      });
      expect(port.gatherCalls.length).toBe(1);
    } finally {
      captured.restore();
    }
  });

  it("ignores a consent result that arrives after unmount", async () => {
    (AppState as { currentState: string }).currentState = "active";
    let resolveGather!: () => void;
    const port = createMockConsentPort();
    const slowGather = new Promise<void>((resolve) => {
      resolveGather = resolve;
    });
    const original = port.gather.bind(port);
    port.gather = async (options) => {
      await slowGather;
      return original(options);
    };

    const view = await render(
      <ConsentProvider port={port} debugEnabled={false}>
        <Text>game</Text>
      </ConsentProvider>,
    );
    await view.unmount();

    // The provider is gone; the port resolving afterwards must not set state on
    // an unmounted tree.
    await act(async () => {
      resolveGather();
      await slowGather;
    });
  });
});
