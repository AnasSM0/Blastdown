import { fonts, typography } from "../../src/ui/theme";

/** The typography tokens reference the loaded font families by name. React
 *  Native renders the system fallback for any name whose face has not loaded
 *  (or failed to load), so wiring the names is what makes the fallback safe. */
describe("typography font wiring", () => {
  it("uses Geist for UI text and JetBrains Mono for numerics", () => {
    expect(typography.body.fontFamily).toBe(fonts.uiRegular);
    expect(typography.buttonText.fontFamily).toBe(fonts.uiSemiBold);
    expect(typography.labelCaps.fontFamily).toBe(fonts.uiSemiBold);
    expect(typography.timerMono.fontFamily).toBe(fonts.monoMedium);
    expect(typography.scoreMobile.fontFamily).toBe(fonts.monoBold);
    expect(typography.numericValue.fontFamily).toBe(fonts.monoSemiBold);
  });

  it("names the approved families (Geist + JetBrains Mono)", () => {
    expect(fonts.uiRegular).toContain("Geist");
    expect(fonts.monoMedium).toContain("JetBrainsMono");
  });
});
