import { useCallback } from "react";
import { render, userEvent, waitFor } from "@testing-library/react-native";

import { TutorialView } from "../../src/components/Tutorial";
import { StorageServiceProvider, createMemoryStorageService } from "../../src/services/storage";
import { STORAGE_KEYS } from "../../src/services/storage/keys";
import { defaultProfile } from "../../src/services/storage/schemas";
import { ProfileProvider, useProfile } from "../../src/state/ProfileProvider";
import { SettingsProvider } from "../../src/state/SettingsProvider";
import { GameSessionProvider } from "../../src/state/GameSessionProvider";

const mockReplace = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: jest.fn(),
    back: jest.fn(),
    replace: mockReplace,
    canGoBack: () => true,
  }),
}));

type Storage = ReturnType<typeof createMemoryStorageService>;

function homeWrapper(storage: Storage) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <StorageServiceProvider service={storage}>
        <SettingsProvider>
          <ProfileProvider>
            <GameSessionProvider>{children}</GameSessionProvider>
          </ProfileProvider>
        </SettingsProvider>
      </StorageServiceProvider>
    );
  };
}

function seededProfile(storage: Storage, patch: Record<string, unknown>) {
  storage.seed(STORAGE_KEYS.profile, JSON.stringify({ ...defaultProfile(0), ...patch }));
}

describe("first-run tutorial gating", () => {
  beforeEach(() => mockReplace.mockClear());

  it("redirects to the tutorial on first run", async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const HomeScreen = require("../../app/index").default;
    const storage = createMemoryStorageService();
    render(<HomeScreen />, { wrapper: homeWrapper(storage) });
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/tutorial"));
  });

  it("does not redirect once the tutorial is completed", async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const HomeScreen = require("../../app/index").default;
    const storage = createMemoryStorageService();
    seededProfile(storage, { tutorialCompleted: true });
    const result = await render(<HomeScreen />, { wrapper: homeWrapper(storage) });
    // Wait until the profile has hydrated (best score reflects the seed path).
    await waitFor(() => expect(result.getByTestId("play-button")).toBeTruthy());
    expect(mockReplace).not.toHaveBeenCalledWith("/tutorial");
  });
});

/** Mirrors app/tutorial's finish: persist completion, nothing else. */
function TutorialHarness({ storage }: { storage: Storage }) {
  const { updateProfile } = useProfile();
  const finish = useCallback(() => {
    updateProfile((profile) =>
      profile.tutorialCompleted ? profile : { ...profile, tutorialCompleted: true },
    );
  }, [updateProfile]);
  return <TutorialView onComplete={finish} onSkip={finish} boardSize={328} />;
}

describe("tutorial completion persistence", () => {
  it("persists completion and never touches a saved active run", async () => {
    const storage = createMemoryStorageService();
    // A saved run must survive the tutorial untouched.
    storage.seed(STORAGE_KEYS.activeRun, "SAVED_RUN_SENTINEL");

    const user = userEvent.setup();
    const result = await render(
      <StorageServiceProvider service={storage}>
        <SettingsProvider>
          <ProfileProvider>
            <TutorialHarness storage={storage} />
          </ProfileProvider>
        </SettingsProvider>
      </StorageServiceProvider>,
    );

    await user.press(result.getByTestId("tray-piece-tut-1"));
    await user.press(result.getByTestId("cell-4-4"));
    // Skip to finish (allowed after the placement).
    await user.press(result.getByTestId("tutorial-skip-button"));

    await waitFor(async () => {
      const raw = await storage.getItem(STORAGE_KEYS.profile);
      expect(raw && JSON.parse(raw).tutorialCompleted).toBe(true);
    });
    // The active run is exactly as seeded — the tutorial wrote nothing to it.
    expect(await storage.getItem(STORAGE_KEYS.activeRun)).toBe("SAVED_RUN_SENTINEL");
  });
});
