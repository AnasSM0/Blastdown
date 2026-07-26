import { act, render, renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { Text } from "react-native";

import {
  parseDebugGeography,
  parseTestDeviceIdentifiers,
  resolveConsentRequestOptions,
} from "../../src/config/consent";
import {
  ConsentProvider,
  areAdsAllowed,
  createMockConsentPort,
  isConsentFormRequired,
  isPrivacyOptionsRequired,
  useConsent,
  type MockConsentPort,
} from "../../src/services/consent";

/** Surfaces the whole consent state as text, so every branch the lifecycle must
 *  handle can be asserted without reaching into internals. */
function ConsentProbe() {
  const { state } = useConsent();
  return (
    <>
      <Text testID="phase">{state.phase}</Text>
      <Text testID="status">{state.status}</Text>
      <Text testID="failure">{state.failure ?? "none"}</Text>
      <Text testID="ads">{areAdsAllowed(state) ? "allowed" : "unavailable"}</Text>
      <Text testID="form">{isConsentFormRequired(state) ? "required" : "not-required"}</Text>
      <Text testID="privacy">{isPrivacyOptionsRequired(state) ? "required" : "not-required"}</Text>
      {/* Proves gameplay content renders regardless of the consent outcome. */}
      <Text testID="child">game</Text>
    </>
  );
}

type Harness = {
  port: MockConsentPort;
  initializeAds: jest.Mock<Promise<void>, []>;
};

async function renderConsent(
  port: MockConsentPort,
  overrides: { debugEnabled?: boolean; initializeAds?: Harness["initializeAds"] } = {},
) {
  const initializeAds = overrides.initializeAds ?? jest.fn(async () => undefined);
  // RNTL 14's `render` is async and opens its own act() scope; leaving it
  // un-awaited lets the next render open a second, overlapping scope.
  const result = await render(
    <ConsentProvider
      port={port}
      initializeAds={initializeAds}
      debugEnabled={overrides.debugEnabled ?? false}
    >
      <ConsentProbe />
    </ConsentProvider>,
  );
  return { result, initializeAds };
}

/** Renders the controller alone, for the branches driven by calling it rather
 *  than by what the tree shows. */
async function renderController(
  port: MockConsentPort,
  overrides: { debugEnabled?: boolean; initializeAds?: Harness["initializeAds"] } = {},
) {
  return renderHook(() => useConsent(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <ConsentProvider
        port={port}
        initializeAds={overrides.initializeAds}
        debugEnabled={overrides.debugEnabled ?? false}
      >
        {children}
      </ConsentProvider>
    ),
  });
}

describe("consent lifecycle at launch", () => {
  it("reports ads allowed and initializes once when consent is not required", async () => {
    const port = createMockConsentPort();
    const { result, initializeAds } = await renderConsent(port);

    expect(await result.findByText("ready")).toBeTruthy();
    expect(result.getByTestId("status").props.children).toBe("notRequired");
    expect(result.getByTestId("ads").props.children).toBe("allowed");
    expect(result.getByTestId("form").props.children).toBe("not-required");
    expect(port.gatherCalls).toHaveLength(1);
    expect(initializeAds).toHaveBeenCalledTimes(1);
  });

  it("reports a form as required when UMP has one to show", async () => {
    const port = createMockConsentPort({
      gather: { status: "required", isConsentFormAvailable: true, canRequestAds: false },
    });
    const { result, initializeAds } = await renderConsent(port);

    expect(await result.findByText("ready")).toBeTruthy();
    expect(result.getByTestId("form").props.children).toBe("required");
    expect(result.getByTestId("ads").props.children).toBe("unavailable");
    // Consent is outstanding, so the SDK must not be initialized.
    expect(initializeAds).not.toHaveBeenCalled();
  });

  it("does not initialize the SDK when consent is obtained but ads are refused", async () => {
    const port = createMockConsentPort({ gather: { status: "obtained", canRequestAds: false } });
    const { result, initializeAds } = await renderConsent(port);

    expect(await result.findByText("ready")).toBeTruthy();
    expect(result.getByTestId("ads").props.children).toBe("unavailable");
    expect(initializeAds).not.toHaveBeenCalled();
  });

  it("surfaces a request failure without blocking the app", async () => {
    const port = createMockConsentPort({ gather: { error: "UMP unreachable" } });
    const { result, initializeAds } = await renderConsent(port);

    expect(await result.findByText("error")).toBeTruthy();
    expect(result.getByTestId("failure").props.children).toBe("request");
    expect(result.getByTestId("ads").props.children).toBe("unavailable");
    expect(initializeAds).not.toHaveBeenCalled();
    // The whole point: consent failing offline must leave the game playable.
    expect(result.getByTestId("child")).toBeTruthy();
  });

  it("shows the privacy options entry point only when UMP requires one", async () => {
    const hidden = createMockConsentPort({ gather: { privacyOptionsRequirement: "notRequired" } });
    const first = await renderConsent(hidden);
    expect(await first.result.findByText("ready")).toBeTruthy();
    expect(first.result.getByTestId("privacy").props.children).toBe("not-required");
    await first.result.unmount();

    const shown = createMockConsentPort({
      gather: { status: "obtained", privacyOptionsRequirement: "required" },
    });
    const second = await renderConsent(shown);
    expect(await second.result.findByText("ready")).toBeTruthy();
    expect(second.result.getByTestId("privacy").props.children).toBe("required");
  });
});

describe("privacy options and reset", () => {
  it("reopens the privacy options form and applies the refreshed snapshot", async () => {
    const port = createMockConsentPort({
      gather: { status: "obtained", canRequestAds: false, privacyOptionsRequirement: "required" },
      privacyOptions: {
        status: "obtained",
        canRequestAds: true,
        privacyOptionsRequirement: "required",
      },
    });
    const initializeAds = jest.fn(async () => undefined);
    const { result } = await renderController(port, { initializeAds });

    await waitFor(() => expect(result.current.state.phase).toBe("ready"));
    expect(initializeAds).not.toHaveBeenCalled();

    // Driven directly rather than through the Settings row: this suite is about
    // the lifecycle. The call updates state, so it needs its own act() scope.
    await act(async () => {
      await result.current.openPrivacyOptions();
    });

    expect(port.privacyOptionsCalls).toBe(1);
    expect(areAdsAllowed(result.current.state)).toBe(true);
    // Consent granted for the first time from the form is a genuine chance to
    // initialize -- and still only once.
    expect(initializeAds).toHaveBeenCalledTimes(1);
  });

  it("keeps the entry point available when the privacy form fails to open", async () => {
    const port = createMockConsentPort({
      gather: { status: "obtained", canRequestAds: true, privacyOptionsRequirement: "required" },
      privacyOptions: { error: "form dismissed by the system" },
    });
    const { result } = await renderController(port);
    await waitFor(() => expect(result.current.state.phase).toBe("ready"));

    await act(async () => {
      await result.current.openPrivacyOptions();
    });

    expect(result.current.state.failure).toBe("privacyOptions");
    // The launch snapshot is still valid -- only a dialog failed to open -- so
    // the phase stays `ready` and the row stays on screen. Dropping to `error`
    // would hide the retry control, and since the lifecycle runs once per
    // launch nothing would bring it back for the rest of the session.
    expect(result.current.state.phase).toBe("ready");
    expect(isPrivacyOptionsRequired(result.current.state)).toBe(true);
    expect(result.current.state.privacyOptionsRequirement).toBe("required");
    // The user's existing consent is untouched by a failed presentation.
    expect(areAdsAllowed(result.current.state)).toBe(true);
  });

  it("clears the recorded failure once the form opens successfully", async () => {
    const port = createMockConsentPort({
      gather: { status: "obtained", canRequestAds: true, privacyOptionsRequirement: "required" },
      privacyOptions: { error: "form dismissed by the system" },
    });
    const { result } = await renderController(port);
    await waitFor(() => expect(result.current.state.phase).toBe("ready"));

    await act(async () => {
      await result.current.openPrivacyOptions();
    });
    expect(result.current.state.failure).toBe("privacyOptions");

    // Second attempt succeeds.
    port.showPrivacyOptionsForm = async () => ({
      status: "obtained",
      canRequestAds: true,
      isConsentFormAvailable: false,
      privacyOptionsRequirement: "required",
    });
    await act(async () => {
      await result.current.openPrivacyOptions();
    });

    expect(result.current.state.failure).toBeNull();
    expect(result.current.state.errorMessage).toBeNull();
    expect(isPrivacyOptionsRequired(result.current.state)).toBe(true);
  });

  it("still reports a launch failure as a lifecycle error", async () => {
    // The contrast case: no snapshot at all, so ads are off and the phase is
    // `error`. Only the privacy-form failure is scoped.
    const port = createMockConsentPort({ gather: { error: "UMP unreachable" } });
    const { result } = await renderController(port);

    await waitFor(() => expect(result.current.state.phase).toBe("error"));
    expect(result.current.state.failure).toBe("request");
    expect(areAdsAllowed(result.current.state)).toBe(false);
  });

  it("initializes the SDK once only across repeated refreshes", async () => {
    const port = createMockConsentPort();
    const initializeAds = jest.fn(async () => undefined);
    const { result } = await renderController(port, { initializeAds });
    await waitFor(() => expect(result.current.state.phase).toBe("ready"));

    await act(async () => {
      await result.current.refresh();
      await result.current.refresh();
    });

    expect(port.gatherCalls.length).toBeGreaterThanOrEqual(3);
    expect(initializeAds).toHaveBeenCalledTimes(1);
  });

  it("exposes the consent reset only when debug tooling is enabled", async () => {
    const production = createMockConsentPort();
    const first = await renderController(production, { debugEnabled: false });
    await waitFor(() => expect(first.result.current.state.phase).toBe("ready"));
    expect(first.result.current.resetConsent).toBeNull();
    await first.unmount();

    const development = createMockConsentPort();
    const second = await renderController(development, { debugEnabled: true });
    await waitFor(() => expect(second.result.current.state.phase).toBe("ready"));
    expect(second.result.current.resetConsent).not.toBeNull();

    await act(async () => {
      await second.result.current.resetConsent!();
    });
    expect(development.resetCalls).toBe(1);
    // A reset replays the launch sequence so the form can be seen again.
    expect(development.gatherCalls.length).toBeGreaterThanOrEqual(2);
    expect(production.resetCalls).toBe(0);
  });
});

describe("consent debug configuration", () => {
  it("is unavailable outside a development build however the variables are set", () => {
    const env = { geography: "eea", testDeviceIds: "ABC123" };
    expect(resolveConsentRequestOptions(env, false)).toBeUndefined();
    expect(resolveConsentRequestOptions(env, true)).toEqual({
      debugGeography: "eea",
      testDeviceIdentifiers: ["ABC123"],
    });
  });

  it("stays undefined in a development build with nothing configured", () => {
    expect(resolveConsentRequestOptions({}, true)).toBeUndefined();
    expect(resolveConsentRequestOptions({ geography: "" }, true)).toBeUndefined();
  });

  it("parses geographies case-insensitively and ignores unknown values", () => {
    expect(parseDebugGeography("EEA")).toBe("eea");
    expect(parseDebugGeography(" regulated_us_state ")).toBe("regulatedUsState");
    expect(parseDebugGeography("other")).toBe("other");
    expect(parseDebugGeography("atlantis")).toBeUndefined();
    expect(parseDebugGeography(undefined)).toBeUndefined();
  });

  it("parses a comma-separated test device list", () => {
    expect(parseTestDeviceIdentifiers(" A , B ,, C ")).toEqual(["A", "B", "C"]);
    expect(parseTestDeviceIdentifiers(undefined)).toEqual([]);
  });

  // `tagForUnderAgeOfConsent` depends on the owner's audience decision, which is
  // still outstanding. Setting it wrongly is a compliance failure in either
  // direction, so it must never be guessed — see docs/MONETIZATION.md.
  it("never tags for under-age of consent while the audience is undecided", () => {
    const options = resolveConsentRequestOptions({ geography: "eea" }, true);
    expect(options).not.toHaveProperty("tagForUnderAgeOfConsent");
  });
});
