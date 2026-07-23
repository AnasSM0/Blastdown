import { blockSurface, type BlockVariant } from "../../src/ui/blockSurface";
import { blockColor, THEMES, resolveTheme } from "../../src/ui/themes";

const reactor = resolveTheme(undefined);
const COLOR_IDS = ["cyan", "purple", "amber"] as const;
const COLOR_HEX = /#[0-9a-fA-F]{6}/;
const OPAQUE_HEX = /^#[0-9a-fA-F]{6}$/;

describe("blockSurface material (P1-4)", () => {
  it("builds a premium tile for all three block colors, preserving identity", () => {
    for (const colorId of COLOR_IDS) {
      const accent = blockColor(reactor, colorId);
      const surface = blockSurface(reactor, accent, "normal");
      // The edge carries the block's own hue — color identity kept…
      expect(surface.edge).toBe(accent);
      // …and the body is a solid, opaque color (no alpha suffix) so it reads
      // over the dark board instead of sinking into it (visibility regression).
      expect(surface.fill).toMatch(OPAQUE_HEX);
      // Layered material: an edge, an inner highlight, and a restrained glow.
      expect(surface.borderWidth).toBeGreaterThan(0);
      expect(surface.highlight).not.toBeNull();
      expect(surface.glow).not.toBeNull();
    }
  });

  it("gives placed blocks an opaque body clearly lighter than the empty cell (regression)", () => {
    const luminance = (hex: string): number => {
      const h = hex.slice(1);
      return (
        0.299 * parseInt(h.slice(0, 2), 16) +
        0.587 * parseInt(h.slice(2, 4), 16) +
        0.114 * parseInt(h.slice(4, 6), 16)
      );
    };
    for (const colorId of COLOR_IDS) {
      const accent = blockColor(reactor, colorId);
      for (const variant of ["normal", "tray", "selected", "critical"] as const) {
        const surface = blockSurface(reactor, accent, variant);
        // Opaque body…
        expect(surface.fill).toMatch(OPAQUE_HEX);
        expect(surface.opacity).toBe(1);
        // …visibly brighter than the empty-cell surface it sits over, so a
        // placed block never disappears into the board.
        expect(luminance(surface.fill)).toBeGreaterThan(luminance(reactor.emptyCell));
      }
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
    const normal = blockSurface(reactor, accent, "normal");
    // Hue identity is carried by the edge; the body stays the same solid family
    // (not a recolor) — distinct from normal only by brightness.
    expect(critical.edge).toBe(accent);
    expect(critical.fill).toMatch(OPAQUE_HEX);
    expect(critical.fill).not.toBe(normal.fill);
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

  it("keeps placed blocks opaque and lighter than the empty cell in ALL five themes (P1-9)", () => {
    const luminance = (hex: string): number => {
      const h = hex.slice(1);
      return (
        0.299 * parseInt(h.slice(0, 2), 16) +
        0.587 * parseInt(h.slice(2, 4), 16) +
        0.114 * parseInt(h.slice(4, 6), 16)
      );
    };
    for (const theme of THEMES) {
      for (const colorId of COLOR_IDS) {
        const accent = blockColor(theme, colorId);
        for (const variant of ["normal", "tray", "selected", "critical"] as const) {
          const surface = blockSurface(theme, accent, variant);
          // Opaque body that reads over the empty cell — a placed block never
          // sinks into the board in any theme (the visibility invariant).
          expect(surface.fill).toMatch(OPAQUE_HEX);
          expect(surface.opacity).toBe(1);
          expect(luminance(surface.fill)).toBeGreaterThan(luminance(theme.emptyCell));
        }
      }
    }
  });

  it("uses the dashed non-color invalid cue in every theme (P1-9)", () => {
    for (const theme of THEMES) {
      // Invalid/conflict previews carry a shape cue (dashed), not color alone —
      // in every theme, so the warning survives a colorblind-unfriendly palette.
      expect(blockSurface(theme, theme.accent, "previewValid").dashed).toBe(false);
      expect(blockSurface(theme, theme.timerCritical, "previewInvalid").dashed).toBe(true);
      expect(blockSurface(theme, theme.timerCritical, "previewConflict").dashed).toBe(true);
    }
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
