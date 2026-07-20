import { Pressable, Text } from "react-native";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

import { GameBoard } from "../../src/components/GameBoard";
import { StorageServiceProvider, createMemoryStorageService } from "../../src/services/storage";
import { STORAGE_KEYS } from "../../src/services/storage/keys";
import { defaultProfile, defaultSettings } from "../../src/services/storage/schemas";
import { SettingsProvider, useSettings } from "../../src/state/SettingsProvider";
import { ProfileProvider } from "../../src/state/ProfileProvider";
import { ThemeProvider } from "../../src/ui/ThemeProvider";
import { resolveTheme, THEMES } from "../../src/ui/themes";
import type { GridCell } from "../../src/domain/gameTypes";

type Storage = ReturnType<typeof createMemoryStorageService>;

/** Seed the profile as owning every theme, so these rendering tests exercise
 *  the palettes rather than the ownership fallback (covered separately). */
function ownAllThemes(storage: Storage) {
  storage.seed(
    STORAGE_KEYS.profile,
    JSON.stringify({ ...defaultProfile(0), unlockedThemeIds: THEMES.map((t) => t.id) }),
  );
}

function grid8(): GridCell[][] {
  const grid: GridCell[][] = Array.from({ length: 8 }, () =>
    Array.from({ length: 8 }, (): GridCell => ({ kind: "empty" })),
  );
  grid[0][0] = { kind: "normal", colorId: "cyan" };
  grid[1][1] = { kind: "timed", colorId: "purple", pieceInstanceId: "p" };
  grid[2][2] = { kind: "rubble", explosionId: "e" };
  return grid;
}

function Providers({ storage, children }: { storage: Storage; children: React.ReactNode }) {
  return (
    <StorageServiceProvider service={storage}>
      <SettingsProvider>
        <ProfileProvider>
          <ThemeProvider>{children}</ThemeProvider>
        </ProfileProvider>
      </SettingsProvider>
    </StorageServiceProvider>
  );
}

function Switcher() {
  const { updateSettings } = useSettings();
  return (
    <>
      <Pressable testID="to-arctic" onPress={() => updateSettings({ themeId: "arctic" })}>
        <Text>arctic</Text>
      </Pressable>
      <GameBoard grid={grid8()} badges={[]} boardSize={328} />
    </>
  );
}

function boardBackground(node: { props: Record<string, unknown> }): string | undefined {
  const style = node.props.style;
  const flat = Array.isArray(style) ? style.flat(Infinity) : [style];
  return Object.assign({}, ...flat.filter(Boolean)).backgroundColor;
}

describe("theme application", () => {
  it("applies a theme change immediately to the board", async () => {
    const storage = createMemoryStorageService();
    ownAllThemes(storage);
    const result = await render(
      <Providers storage={storage}>
        <Switcher />
      </Providers>,
    );

    expect(boardBackground(result.getByTestId("game-board"))).toBe(
      resolveTheme("neon-reactor").boardBg,
    );

    fireEvent.press(result.getByTestId("to-arctic"));
    await waitFor(() =>
      expect(boardBackground(result.getByTestId("game-board"))).toBe(
        resolveTheme("arctic").boardBg,
      ),
    );
  });

  it("restores a persisted theme on load (survives restart)", async () => {
    const storage = createMemoryStorageService();
    ownAllThemes(storage);
    storage.seed(STORAGE_KEYS.settings, JSON.stringify({ ...defaultSettings(), themeId: "magma" }));

    const result = await render(
      <Providers storage={storage}>
        <GameBoard grid={grid8()} badges={[]} boardSize={328} />
      </Providers>,
    );

    await waitFor(() =>
      expect(boardBackground(result.getByTestId("game-board"))).toBe(resolveTheme("magma").boardBg),
    );
  });

  it.each(THEMES.map((theme) => [theme.id, theme.boardBg] as const))(
    "renders a valid board with normal, timed, and rubble cells for theme %s",
    async (themeId, boardBg) => {
      const storage = createMemoryStorageService();
      ownAllThemes(storage);
      storage.seed(STORAGE_KEYS.settings, JSON.stringify({ ...defaultSettings(), themeId }));
      const result = await render(
        <Providers storage={storage}>
          <GameBoard grid={grid8()} badges={[]} boardSize={328} />
        </Providers>,
      );
      await waitFor(() => expect(boardBackground(result.getByTestId("game-board"))).toBe(boardBg));
      expect(result.getAllByTestId(/^cell-\d+-\d+$/)).toHaveLength(64);
      expect(result.getByLabelText(/rubble.*row 3.*column 3/i)).toBeTruthy();
    },
  );
});
