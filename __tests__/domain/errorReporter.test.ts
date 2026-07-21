import { createMemoryErrorReporter } from "../../src/services/diagnostics/MemoryErrorReporter";
import {
  reportCaught,
  reportError,
  resetActiveErrorReporter,
  setActiveErrorReporter,
} from "../../src/services/diagnostics/reportError";

describe("MemoryErrorReporter", () => {
  it("records reports and filters by surface", () => {
    const reporter = createMemoryErrorReporter();
    reporter.report({ surface: "ui", message: "a" });
    reporter.report({ surface: "persistence", message: "b" });
    expect(reporter.reports).toHaveLength(2);
    expect(reporter.bySurface("persistence")).toEqual([{ surface: "persistence", message: "b" }]);
  });
});

describe("reportError bridge", () => {
  afterEach(() => resetActiveErrorReporter());

  it("routes to the active reporter and never throws", () => {
    const reporter = createMemoryErrorReporter();
    setActiveErrorReporter(reporter);
    reportError({ surface: "storage", message: "disk full" });
    expect(reporter.bySurface("storage")).toHaveLength(1);
  });

  it("swallows a throwing reporter", () => {
    setActiveErrorReporter({
      report() {
        throw new Error("reporter broke");
      },
    });
    expect(() => reportError({ surface: "unknown", message: "x" })).not.toThrow();
  });

  it("drops safely when no reporter is registered", () => {
    resetActiveErrorReporter();
    expect(() => reportError({ surface: "audio", message: "x" })).not.toThrow();
  });
});

describe("reportCaught", () => {
  afterEach(() => resetActiveErrorReporter());

  it("extracts only message and stack — never serializes the thrown value", () => {
    const reporter = createMemoryErrorReporter();
    setActiveErrorReporter(reporter);
    const error = new Error("boom");
    // Attach a sensitive-looking payload to the thrown object.
    (error as unknown as { secretToken: string }).secretToken = "hunter2";

    reportCaught("reward", error, { placement: "rewarded_freeze" });

    const report = reporter.bySurface("reward")[0];
    expect(report.message).toBe("boom");
    expect(report.context).toEqual({ placement: "rewarded_freeze" });
    // The secret is not present anywhere in the serialized report.
    expect(JSON.stringify(report)).not.toContain("hunter2");
  });

  it("handles a non-Error thrown value", () => {
    const reporter = createMemoryErrorReporter();
    setActiveErrorReporter(reporter);
    reportCaught("storage", "just a string");
    expect(reporter.bySurface("storage")[0].message).toBe("Unknown error");
  });
});
