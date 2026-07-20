import { render, userEvent, waitFor } from "@testing-library/react-native";

import { StorageServiceProvider, createMemoryStorageService } from "../../src/services/storage";
import { STORAGE_KEYS } from "../../src/services/storage/keys";
import { defaultProfile } from "../../src/services/storage/schemas";
import { ProfileProvider } from "../../src/state/ProfileProvider";
import { SettingsProvider } from "../../src/state/SettingsProvider";

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: jest.fn(),
    back: jest.fn(),
    replace: jest.fn(),
    canGoBack: () => true,
  }),
}));

type Storage = ReturnType<typeof createMemoryStorageService>;

function seedProfile(storage: Storage, patch: Record<string, unknown>) {
  storage.seed(STORAGE_KEYS.profile, JSON.stringify({ ...defaultProfile(0), ...patch }));
}

function renderThemes(storage: Storage) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ThemesScreen = require("../../app/themes").default;
  return render(
    <StorageServiceProvider service={storage}>
      <SettingsProvider>
        <ProfileProvider>
          <ThemesScreen />
        </ProfileProvider>
      </SettingsProvider>
    </StorageServiceProvider>,
  );
}

async function readProfile(storage: Storage) {
  const raw = await storage.getItem(STORAGE_KEYS.profile);
  return raw ? JSON.parse(raw) : null;
}

describe("theme purchase flow", () => {
  it("buys a locked theme once, deducts Bolts, unlocks, and selects it", async () => {
    const storage = createMemoryStorageService();
    seedProfile(storage, { bolts: 600, unlockedThemeIds: ["neon-reactor"] });
    const user = userEvent.setup();
    const result = await renderThemes(storage);

    // Wait for the seeded profile to hydrate (Magma shows its price, not owned).
    await waitFor(() => expect(result.getByTestId("theme-state-magma")).toHaveTextContent(/500/));

    await user.press(result.getByTestId("theme-tile-magma"));
    await user.press(await result.findByTestId("theme-purchase-confirm"));

    // Selected immediately and owned.
    await waitFor(() => expect(result.getByTestId("theme-selected-magma")).toBeTruthy());

    await waitFor(async () => {
      const profile = await readProfile(storage);
      expect(profile.bolts).toBe(100); // 600 - 500, exactly once
      expect(profile.unlockedThemeIds).toContain("magma");
    });
    const settingsRaw = await storage.getItem(STORAGE_KEYS.settings);
    expect(settingsRaw && JSON.parse(settingsRaw).themeId).toBe("magma");
  });

  it("does not mutate the profile when Bolts are insufficient", async () => {
    const storage = createMemoryStorageService();
    seedProfile(storage, { bolts: 100, unlockedThemeIds: ["neon-reactor"] });
    const user = userEvent.setup();
    const result = await renderThemes(storage);

    await waitFor(() =>
      expect(result.getByTestId("theme-state-void")).toHaveTextContent(/NOT ENOUGH/),
    );

    await user.press(result.getByTestId("theme-tile-void"));
    const buy = await result.findByTestId("theme-purchase-confirm");
    await user.press(buy); // disabled — no effect

    // Balance unchanged, still locked.
    const profile = await readProfile(storage);
    expect(profile === null || profile.bolts === 100).toBe(true);
    expect(result.getByTestId("theme-state-void")).toHaveTextContent(/NOT ENOUGH/);
  });

  it("keeps a purchased theme owned across a restart", async () => {
    const storage = createMemoryStorageService();
    seedProfile(storage, {
      bolts: 100,
      unlockedThemeIds: ["neon-reactor", "arctic"],
    });
    const result = await renderThemes(storage);
    // Fresh mount reads persisted ownership.
    await waitFor(() =>
      expect(result.getByTestId("theme-state-arctic")).toHaveTextContent("OWNED"),
    );
  });
});
