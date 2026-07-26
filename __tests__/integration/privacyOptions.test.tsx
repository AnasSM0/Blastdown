import { fireEvent, render, waitFor } from "@testing-library/react-native";

import SettingsScreen from "../../app/settings";
import { ConsentProvider, createMockConsentPort } from "../../src/services/consent";
import type { MockConsentConfig } from "../../src/services/consent";
import { createMemoryStorageService } from "../../src/services/storage/StorageService";
import { StorageServiceProvider } from "../../src/services/storage/StorageServiceProvider";
import { SettingsProvider } from "../../src/state/SettingsProvider";

jest.mock("expo-router", () => ({
  useRouter: () => ({
    back: jest.fn(),
    push: jest.fn(),
    replace: jest.fn(),
    canGoBack: () => true,
  }),
}));

/** A snapshot from a user who is under a regulation granting a persistent
 *  privacy entry point — the only case in which the Settings row appears. */
const PRIVACY_REQUIRED: MockConsentConfig = {
  gather: { status: "obtained", canRequestAds: true, privacyOptionsRequirement: "required" },
  // UMP reports the requirement again on every snapshot, including the one
  // returned when the privacy form closes — the entry point is a property of the
  // user's regulation, not a one-shot event.
  privacyOptions: {
    status: "obtained",
    canRequestAds: true,
    privacyOptionsRequirement: "required",
  },
};

async function renderSettings(config: MockConsentConfig, debugEnabled = false) {
  const port = createMockConsentPort(config);
  const utils = await render(
    <StorageServiceProvider service={createMemoryStorageService()}>
      <SettingsProvider>
        <ConsentProvider port={port} debugEnabled={debugEnabled}>
          <SettingsScreen />
        </ConsentProvider>
      </SettingsProvider>
    </StorageServiceProvider>,
  );
  return { ...utils, port };
}

describe("Settings privacy options entry point", () => {
  it("is absent when UMP does not require one", async () => {
    const { queryByTestId, getByTestId } = await renderSettings({
      gather: { privacyOptionsRequirement: "notRequired" },
    });

    // The screen itself renders — only the privacy row is withheld.
    expect(getByTestId("settings-screen")).toBeTruthy();
    await waitFor(() => expect(queryByTestId("settings-privacy-options-button")).toBeNull());
  });

  it("is absent when there is no consent provider at all", async () => {
    const utils = await render(
      <StorageServiceProvider service={createMemoryStorageService()}>
        <SettingsProvider>
          <SettingsScreen />
        </SettingsProvider>
      </StorageServiceProvider>,
    );
    expect(utils.getByTestId("settings-screen")).toBeTruthy();
    expect(utils.queryByTestId("settings-privacy-options-button")).toBeNull();
  });

  it("appears when required and reopens the form when pressed", async () => {
    const { findByTestId, port } = await renderSettings(PRIVACY_REQUIRED);

    const button = await findByTestId("settings-privacy-options-button");
    await fireEvent.press(button);

    await waitFor(() => expect(port.privacyOptionsCalls).toBe(1));
  });

  it("can be reopened more than once", async () => {
    const { findByTestId, port } = await renderSettings(PRIVACY_REQUIRED);

    const button = await findByTestId("settings-privacy-options-button");
    await fireEvent.press(button);
    await waitFor(() => expect(port.privacyOptionsCalls).toBe(1));
    // The row must survive the round trip: UMP still reports the requirement,
    // so the user can change their mind as often as they like.
    await fireEvent.press(await findByTestId("settings-privacy-options-button"));
    await waitFor(() => expect(port.privacyOptionsCalls).toBe(2));
  });

  it("does not queue a second form while one is being presented", async () => {
    const port = createMockConsentPort(PRIVACY_REQUIRED);
    // Hold the form open so both presses land inside the same presentation.
    let release: (() => void) | null = null;
    const original = port.showPrivacyOptionsForm.bind(port);
    port.showPrivacyOptionsForm = () =>
      new Promise((resolve) => {
        release = () => resolve(original());
      });

    const utils = await render(
      <StorageServiceProvider service={createMemoryStorageService()}>
        <SettingsProvider>
          <ConsentProvider port={port} debugEnabled={false}>
            <SettingsScreen />
          </ConsentProvider>
        </SettingsProvider>
      </StorageServiceProvider>,
    );

    const button = await utils.findByTestId("settings-privacy-options-button");
    await fireEvent.press(button);
    await waitFor(() => expect(release).not.toBeNull());
    await fireEvent.press(button);
    await fireEvent.press(button);

    release!();
    await waitFor(() => expect(port.privacyOptionsCalls).toBe(1));
  });
});

describe("Settings consent reset", () => {
  it("is absent outside a development build", async () => {
    const { queryByTestId } = await renderSettings(PRIVACY_REQUIRED, false);
    expect(queryByTestId("settings-reset-consent-button")).toBeNull();
  });

  it("clears the stored decision and replays the launch flow in development", async () => {
    const { findByTestId, port } = await renderSettings(PRIVACY_REQUIRED, true);

    await fireEvent.press(await findByTestId("settings-reset-consent-button"));

    await waitFor(() => expect(port.resetCalls).toBe(1));
    // The reset re-runs the launch gather, which is what makes the first-install
    // consent form appear again on device.
    await waitFor(() => expect(port.gatherCalls.length).toBeGreaterThanOrEqual(2));
  });
});
