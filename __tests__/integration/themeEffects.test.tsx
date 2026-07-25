import { render, waitFor } from "@testing-library/react-native";

import { GameBoard } from "../../src/components/GameBoard";
import { EffectsLayer } from "../../src/components/effects/EffectsLayer";
import { buildEffectPlan } from "../../src/ui/effects/eventEffects";
import { StorageServiceProvider, createMemoryStorageService } from "../../src/services/storage";
import { STORAGE_KEYS } from "../../src/services/storage/keys";
import { defaultProfile, defaultSettings } from "../../src/services/storage/schemas";
import { SettingsProvider } from "../../src/state/SettingsProvider";
import { ProfileProvider } from "../../src/state/ProfileProvider";
import { ThemeProvider } from "../../src/ui/ThemeProvider";
import { THEMES } from "../../src/ui/themes";
import type { GridCell } from "../../src/domain/gameTypes";

type Storage = ReturnType<typeof createMemoryStorageService>;

function grid8(): GridCell[][] {
  const grid: GridCell[][] = Array.from({ length: 8 }, () =>
    Array.from({ length: 8 }, (): GridCell => ({ kind: "empty" })),
  );
  grid[2][2] = { kind: "rubble", explosionId: "e" };
  return grid;
}

const EXPLOSION_PLAN = buildEffectPlan(
  [
    { type: "explosionStarted", explosionId: "e", pieceId: "piece-1" },
    { type: "rubbleCreated", explosionId: "e", cells: [{ row: 2, column: 2 }] },
    { type: "scoreChanged", delta: -50, score: 0 },
  ],
  false,
);

function seed(storage: Storage, themeId: string) {
  storage.seed(
    STORAGE_KEYS.profile,
    JSON.stringify({ ...defaultProfile(0), unlockedThemeIds: THEMES.map((t) => t.id) }),
  );
  storage.seed(STORAGE_KEYS.settings, JSON.stringify({ ...defaultSettings(), themeId }));
}

function borderColorOf(node: { props: Record<string, unknown> }): string | undefined {
  const style = node.props.style;
  const flat = Array.isArray(style) ? style.flat(Infinity) : [style];
  return Object.assign({}, ...flat.filter(Boolean)).borderColor;
}

describe("theme-aware explosion effects", () => {
  it.each(THEMES.map((t) => [t.id, t.timerCritical] as const))(
    "renders the explosion burst with the critical-danger color for theme %s",
    async (themeId, critical) => {
      const storage = createMemoryStorageService();
      seed(storage, themeId);
      const result = await render(
        <StorageServiceProvider service={storage}>
          <SettingsProvider>
            <ProfileProvider>
              <ThemeProvider>
                <GameBoard
                  grid={grid8()}
                  badges={[]}
                  boardSize={328}
                  explosionCount={1}
                  effectKey={1}
                />
                <EffectsLayer plan={EXPLOSION_PLAN} cellSize={38} reducedMotion={false} />
              </ThemeProvider>
            </ProfileProvider>
          </SettingsProvider>
        </StorageServiceProvider>,
      );
      // The burst reads danger via the theme's critical color in every theme.
      await waitFor(() => expect(borderColorOf(result.getByTestId("burst-cell"))).toBe(critical));
    },
  );
});
