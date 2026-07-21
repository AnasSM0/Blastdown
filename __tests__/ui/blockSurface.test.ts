import { blockSurface, type BlockVariant } from "../../src/ui/blockSurface";
import { blockColor, THEMES, resolveTheme } from "../../src/ui/themes";

const reactor = resolveTheme(undefined);
const COLOR_IDS = ["cyan", "purple", "amber"] as const;
const COLOR_HEX = /#[0-9a-fA-F]{6}/;

describe("blockSurface material (P1-4)", () => {
  it("builds a premium tile for all three block colors, preserving identity", () => {
    for (const colorId of COLOR_IDS) {
      const accent = blockColor(reactor, colorId);
      const surface = blockSurface(reactor, accent, "normal");
      // Fill and edge are tints of the block's own hue — color identity kept.
      expect(surface.fill.startsWith(accent)).toBe(true);
      expect(surface.edge).toBe(accent);
      // Layered material: an edge, an inner highlight, and a restrained glow.
      expect(surface.borderWidth).toBeGreaterThan(0);
      expect(surface.highlight).not.toBeNull();
      expect(surface.glow).not.toBeNull();
    }
  });

  it("keeps normal, selected, critical, and disabled visually distinct", () => {
    const accent = blockColor(reactor, "cyan");
    const normal = blockSurface(reactor, accent, "normal");
    const selected = blockSurface(reactor, accent, "selected");
    const critical = blockSurface(reactor, accent, "critical");
    const disabled = blockSurface(reactor, accent, "disabled");

    // Selected and critical intensify (thicker edge, stronger glow) vs normal.
    expect(selected.borderWidth).toBeGreaterThan(normal.borderWidth);
    expect(critical.borderWidth).toBeGreaterThan(normal.borderWidth);
    // Disabled loses glow and priority.
    expect(disabled.glow).toBeNull();
    expect(disabled.opacity).toBeLessThan(1);
    // All four fills differ.
    const fills = new Set([normal.fill, selected.fill, critical.fill, disabled.fill]);
    expect(fills.size).toBe(4);
  });

  it("preserves the original block color in the critical state (no recolor)", () => {
    const accent = blockColor(reactor, "amber");
    const critical = blockSurface(reactor, accent, "critical");
    expect(critical.edge).toBe(accent);
    expect(critical.fill.startsWith(accent)).toBe(true);
    // The danger read is intensity, not hue: stronger glow than normal.
    expect(critical.glow).not.toBeNull();
  });

  it("uses a dashed edge as the non-color cue for invalid/conflict previews", () => {
    const danger = reactor.timerCritical;
    expect(blockSurface(reactor, reactor.accent, "previewValid").dashed).toBe(false);
    expect(blockSurface(reactor, danger, "previewInvalid").dashed).toBe(true);
    expect(blockSurface(reactor, danger, "previewConflict").dashed).toBe(true);
    // Conflict is a stronger fill than a plain invalid preview.
    const invalid = blockSurface(reactor, danger, "previewInvalid");
    const conflict = blockSurface(reactor, danger, "previewConflict");
    expect(invalid.fill).not.toBe(conflict.fill);
  });

  it("produces valid color strings for every state under all five themes", () => {
    const variants: BlockVariant[] = [
      "normal",
      "tray",
      "selected",
      "critical",
      "disabled",
      "previewValid",
      "previewInvalid",
      "previewConflict",
    ];
    for (const theme of THEMES) {
      for (const colorId of COLOR_IDS) {
        const accent = blockColor(theme, colorId);
        for (const variant of variants) {
          const surface = blockSurface(theme, accent, variant);
          expect(surface.fill).toMatch(COLOR_HEX);
          expect(surface.edge).toMatch(COLOR_HEX);
        }
      }
    }
  });
});
