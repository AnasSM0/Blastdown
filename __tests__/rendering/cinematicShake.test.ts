import { shakeOffset } from "../../src/rendering/cinematic/CinematicBoardCanvas";

/** The explosion shake, which was broken once and would have shipped that way.
 *
 *  The first version mutated a module-level array inside the derived-value
 *  worklet to avoid allocating one array per frame, and returned that same array
 *  every time. `useDerivedValue` assigns its result to a shared value, and
 *  assigning the SAME object identity emits no change — so the board jumped to
 *  frame one's offset and froze there for the rest of the shake.
 *
 *  Nothing local caught it. Skia draws nothing under jest, the component still
 *  rendered, every other test stayed green, and the only symptom was a shake
 *  that did not shake. That is why the curve is now a pure exported function:
 *  the part that can be wrong is the part that can be checked. */

const AMPLITUDE = 4;
const SEQUENCE_MS = 780;

describe("the shake curve", () => {
  it("starts still, so the board does not jump on the first frame", () => {
    expect(shakeOffset(0, AMPLITUDE, SEQUENCE_MS)).toBeCloseTo(0, 6);
  });

  it("actually moves during the shake", () => {
    // The regression this file exists for: the broken version produced one
    // value and then repeated it. Several distinct offsets across the window is
    // the property that was missing.
    const samples = [20, 40, 60, 80, 100, 120, 140, 160, 180].map((t) =>
      shakeOffset(t, AMPLITUDE, SEQUENCE_MS),
    );

    expect(new Set(samples.map((v) => v.toFixed(4))).size).toBeGreaterThan(5);
    expect(Math.max(...samples.map(Math.abs))).toBeGreaterThan(0.5);
  });

  it("swings both ways, rather than pushing the board off to one side", () => {
    const samples = [25, 50, 75, 100, 125, 150].map((t) => shakeOffset(t, AMPLITUDE, SEQUENCE_MS));

    expect(samples.some((v) => v > 0)).toBe(true);
    expect(samples.some((v) => v < 0)).toBe(true);
  });

  it("decays, so the end is gentler than the start", () => {
    // Squared decay: the first swing should clearly outweigh a later one at the
    // same phase. Without it the shake would stop dead rather than settle.
    const early = Math.abs(shakeOffset(25, AMPLITUDE, SEQUENCE_MS));
    const late = Math.abs(shakeOffset(175, AMPLITUDE, SEQUENCE_MS));

    expect(early).toBeGreaterThan(late);
  });

  it("never exceeds its amplitude", () => {
    for (let t = 0; t <= 220; t += 5) {
      expect(Math.abs(shakeOffset(t, AMPLITUDE, SEQUENCE_MS))).toBeLessThanOrEqual(AMPLITUDE);
    }
  });

  it("is finished well before the sequence it rides on", () => {
    // A shake lasting the whole 780 ms explosion sequence would read as a fault
    // rather than as impact.
    expect(shakeOffset(200, AMPLITUDE, SEQUENCE_MS)).toBe(0);
    expect(shakeOffset(400, AMPLITUDE, SEQUENCE_MS)).toBe(0);
    expect(shakeOffset(SEQUENCE_MS, AMPLITUDE, SEQUENCE_MS)).toBe(0);
  });

  it("stays perfectly still under reduced motion", () => {
    // The model sets the amplitude to 0 for reduced motion, so this function
    // needs no second check — but it must honour it exactly, at every instant.
    for (let t = 0; t <= 400; t += 10) {
      expect(shakeOffset(t, 0, SEQUENCE_MS)).toBe(0);
    }
  });

  it("stays still when there is no sequence to ride", () => {
    expect(shakeOffset(50, AMPLITUDE, 0)).toBe(0);
  });
});
