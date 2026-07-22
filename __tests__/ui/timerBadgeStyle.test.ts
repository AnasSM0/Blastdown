import { getBadgeVisual } from "../../src/ui/timerBadgeStyle";
import { getPulseConfig } from "../../src/ui/timerPulse";
import { THEMES, resolveTheme } from "../../src/ui/themes";

const reactor = resolveTheme(undefined);

describe("getBadgeVisual (P1-5)", () => {
  it("maps each timer state to its semantic ring color", () => {
    expect(getBadgeVisual("normal", false, reactor).ringColor).toBe(reactor.timerNormal);
    expect(getBadgeVisual("warning", false, reactor).ringColor).toBe(reactor.timerWarning);
    expect(getBadgeVisual("urgent", false, reactor).ringColor).toBe(reactor.timerCritical);
    expect(getBadgeVisual("normal", true, reactor).ringColor).toBe(reactor.timerFrozen);
  });

  it("distinguishes the named states without relying on color alone", () => {
    const normal = getBadgeVisual("normal", false, reactor);
    const warning = getBadgeVisual("warning", false, reactor);
    const critical = getBadgeVisual("urgent", false, reactor);
    const frozen = getBadgeVisual("normal", true, reactor);

    // Normal vs warning: ring weight differs.
    expect(warning.ringWidth).toBeGreaterThan(normal.ringWidth);
    // Warning vs critical: critical is heavier AND larger.
    expect(critical.ringWidth).toBeGreaterThan(warning.ringWidth);
    expect(critical.size).toBeGreaterThan(warning.size);
    // Frozen is the only dashed ring — a shape cue independent of hue.
    expect(frozen.dashed).toBe(true);
    expect(normal.dashed).toBe(false);
    expect(warning.dashed).toBe(false);
    expect(critical.dashed).toBe(false);
  });

  it("keeps the frozen badge static (its timer is paused) and pulses only warning/critical", () => {
    // pulseState routes through getPulseConfig, so a frozen badge never breathes.
    expect(getPulseConfig(getBadgeVisual("normal", true, reactor).pulseState, false)).toBeNull();
    expect(getPulseConfig(getBadgeVisual("normal", false, reactor).pulseState, false)).toBeNull();
    expect(getPulseConfig(getBadgeVisual("caution", false, reactor).pulseState, false)).toBeNull();
    expect(
      getPulseConfig(getBadgeVisual("warning", false, reactor).pulseState, false),
    ).not.toBeNull();
    expect(
      getPulseConfig(getBadgeVisual("urgent", false, reactor).pulseState, false),
    ).not.toBeNull();
  });

  it("frozen overrides the countdown emphasis regardless of remaining turns", () => {
    // Even an otherwise-urgent countdown reads as frozen while freeze is active.
    const frozenUrgent = getBadgeVisual("urgent", true, reactor);
    expect(frozenUrgent.dashed).toBe(true);
    expect(frozenUrgent.ringColor).toBe(reactor.timerFrozen);
    expect(getPulseConfig(frozenUrgent.pulseState, false)).toBeNull();
  });

  it("defines a distinct, valid frozen token in every theme", () => {
    const hex = /^#[0-9A-Fa-f]{6}$/;
    for (const theme of THEMES) {
      const frozen = getBadgeVisual("normal", true, theme);
      expect(theme.timerFrozen).toMatch(hex);
      // The frozen cue never collides with the other timer hues in any theme.
      expect(frozen.ringColor).not.toBe(theme.timerNormal);
      expect(frozen.ringColor).not.toBe(theme.timerWarning);
      expect(frozen.ringColor).not.toBe(theme.timerCritical);
    }
  });
});
