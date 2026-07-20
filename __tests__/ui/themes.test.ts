import {
  THEMES,
  DEFAULT_THEME_ID,
  resolveTheme,
  blockColor,
  glowFor,
  type ThemePalette,
} from "../../src/ui/themes";

const HEX = /^#[0-9a-fA-F]{6}$/;

const REQUIRED_COLOR_FIELDS: (keyof ThemePalette)[] = [
  "appBackground",
  "surfaceBg",
  "boardBg",
  "boardFrame",
  "gridLine",
  "onSurface",
  "onSurfaceVariant",
  "outline",
  "outlineVariant",
  "timerNormal",
  "timerWarning",
  "timerCritical",
  "rubbleFill",
  "rubbleCrack",
  "score",
  "accent",
];

describe("theme palettes", () => {
  it("ships exactly the five approved themes with unique ids", () => {
    expect(THEMES).toHaveLength(5);
    const ids = THEMES.map((theme) => theme.id);
    expect(new Set(ids).size).toBe(5);
    expect(ids).toEqual(["neon-reactor", "arctic", "magma", "void", "solar"]);
  });

  it("makes Reactor the default and the only unlocked theme", () => {
    const reactor = THEMES.find((theme) => theme.id === DEFAULT_THEME_ID);
    expect(reactor?.locked).toBe(false);
    expect(THEMES.filter((theme) => !theme.locked)).toHaveLength(1);
  });

  it("defines every required color and all three block hues per theme", () => {
    for (const theme of THEMES) {
      for (const field of REQUIRED_COLOR_FIELDS) {
        expect(String(theme[field])).toMatch(HEX);
      }
      expect(theme.block.cyan).toMatch(HEX);
      expect(theme.block.purple).toMatch(HEX);
      expect(theme.block.amber).toMatch(HEX);
      expect(theme.glow).toBeGreaterThan(0);
    }
  });
});

describe("resolveTheme", () => {
  it("resolves a known id and falls back to Reactor for unknown/undefined", () => {
    expect(resolveTheme("arctic").id).toBe("arctic");
    expect(resolveTheme(undefined).id).toBe(DEFAULT_THEME_ID);
    expect(resolveTheme("does-not-exist").id).toBe(DEFAULT_THEME_ID);
  });
});

describe("blockColor and glowFor", () => {
  it("maps the domain colorIds to the theme's block hues", () => {
    const arctic = resolveTheme("arctic");
    expect(blockColor(arctic, "cyan")).toBe(arctic.block.cyan);
    expect(blockColor(arctic, "purple")).toBe(arctic.block.purple);
    expect(blockColor(arctic, "amber")).toBe(arctic.block.amber);
    expect(blockColor(arctic, "unknown")).toBe(arctic.outline);
  });

  it("scales glow radius by the theme's glow factor", () => {
    const magma = resolveTheme("magma"); // glow 1.2
    const low = glowFor(magma, "#FFFFFF", "low");
    expect(low.shadowRadius).toBeCloseTo(8 * magma.glow);
  });
});
