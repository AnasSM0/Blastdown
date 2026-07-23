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
  "timerFrozen",
  "rubbleFill",
  "rubbleEdge",
  "rubbleFacet",
  "rubbleCrack",
  "rubbleFissure",
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

  it("includes the Reactor default palette", () => {
    expect(THEMES.some((theme) => theme.id === DEFAULT_THEME_ID)).toBe(true);
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

  it("defines a valid reactor-background token set for every theme (P1-2)", () => {
    for (const theme of THEMES) {
      const bg = theme.background;
      for (const field of ["base", "glow", "seam", "grid", "corner"] as const) {
        expect(bg[field]).toMatch(HEX);
      }
    }
  });

  it("defines valid board-frame and empty-cell tokens for every theme (P1-3)", () => {
    for (const theme of THEMES) {
      for (const field of [
        "boardFrameInner",
        "boardFrameBevel",
        "boardFrameCorner",
        "emptyCell",
        "emptyCellBorder",
      ] as const) {
        expect(theme[field]).toMatch(HEX);
      }
    }
  });

  it("keeps the empty-cell fill distinct from the board panel and rubble (P1-3)", () => {
    for (const theme of THEMES) {
      // Empty cells must read as their own surface, not the board void or rubble.
      expect(theme.emptyCell).not.toBe(theme.boardBg);
      expect(theme.emptyCell).not.toBe(theme.rubbleFill);
      expect(theme.emptyCellBorder).not.toBe(theme.emptyCell);
    }
  });

  it("keeps the four timer states mutually distinct in every theme (P1-9)", () => {
    for (const theme of THEMES) {
      // Normal / warning / critical / frozen must each read differently — the
      // frozen cue in particular must never collide with a live-timer color, so
      // "paused" is unambiguous in every theme. (Non-color cues also back these
      // up in the badge itself; this guards the color layer.)
      const timers = [
        theme.timerNormal,
        theme.timerWarning,
        theme.timerCritical,
        theme.timerFrozen,
      ];
      expect(new Set(timers).size).toBe(4);
    }
  });

  it("defines a readable, layered rubble material for every theme (P1-6)", () => {
    for (const theme of THEMES) {
      // The rubble tile reads via contrast between its own layers…
      expect(theme.rubbleEdge).not.toBe(theme.rubbleFill);
      expect(theme.rubbleCrack).not.toBe(theme.rubbleFill);
      expect(theme.rubbleFacet).not.toBe(theme.rubbleFill);
      // …and stays distinct from empty cells and the three block hues so rubble
      // never reads as a normal block.
      expect(theme.rubbleFill).not.toBe(theme.emptyCell);
      expect(theme.rubbleFill).not.toBe(theme.block.cyan);
      expect(theme.rubbleFill).not.toBe(theme.block.purple);
      expect(theme.rubbleFill).not.toBe(theme.block.amber);
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
