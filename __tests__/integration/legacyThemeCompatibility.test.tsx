import { render, waitFor } from "@testing-library/react-native";

import { GameBoard } from "../../src/components/GameBoard";
import type { GridCell } from "../../src/domain/gameTypes";
import { StorageServiceProvider, createMemoryStorageService } from "../../src/services/storage";
import { STORAGE_KEYS } from "../../src/services/storage/keys";
import { defaultProfile, defaultSettings } from "../../src/services/storage/schemas";
import { ProfileProvider } from "../../src/state/ProfileProvider";
import { SettingsProvider } from "../../src/state/SettingsProvider";
import { ThemeProvider } from "../../src/ui/ThemeProvider";
import { resolveTheme } from "../../src/ui/themes";

function grid8(): GridCell[][] {
  return Array.from({ length: 8 }, () =>
    Array.from({ length: 8 }, (): GridCell => ({ kind: "empty" })),
  );
}

function boardBackground(node: { props: Record<string, unknown> }): string | undefined {
  const style = node.props.style;
  const flat = Array.isArray(style) ? style.flat(Infinity) : [style];
  return Object.assign({}, ...flat.filter(Boolean)).backgroundColor;
}

describe("legacy theme-field compatibility", () => {
  it("loads old theme/economy fields but always renders the canonical V1 palette", async () => {
    const storage = createMemoryStorageService({
      [STORAGE_KEYS.profile]: JSON.stringify({
        ...defaultProfile(0),
        bolts: 900,
        unlockedThemeIds: ["neon-reactor", "magma"],
      }),
      [STORAGE_KEYS.settings]: JSON.stringify({ ...defaultSettings(), themeId: "magma" }),
    });

    const result = await render(
      <StorageServiceProvider service={storage}>
        <SettingsProvider>
          <ProfileProvider>
            <ThemeProvider>
              <GameBoard grid={grid8()} badges={[]} boardSize={328} />
            </ThemeProvider>
          </ProfileProvider>
        </SettingsProvider>
      </StorageServiceProvider>,
    );

    await waitFor(() =>
      expect(boardBackground(result.getByTestId("game-board"))).toBe(
        resolveTheme(undefined).boardBg,
      ),
    );
  });
});
