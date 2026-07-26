import type { ConsentInfo, ConsentPort, ConsentRequestOptions } from "./types";

/** One scripted result: a partial snapshot merged over the default, or a
 *  rejection with this message. */
export type MockConsentOutcome = Partial<ConsentInfo> | { error: string };

export type MockConsentConfig = {
  /** Result for `gather`. An array is consumed one entry per call, the last
   *  entry repeating — so a test can fail once and then succeed. */
  gather?: MockConsentOutcome | MockConsentOutcome[];
  privacyOptions?: MockConsentOutcome;
};

/** The state a device outside any consent regime reports: nothing to ask, ads
 *  allowed, no privacy entry point. The happy path works with no config. */
const DEFAULT_INFO: ConsentInfo = {
  status: "notRequired",
  canRequestAds: true,
  isConsentFormAvailable: false,
  privacyOptionsRequirement: "notRequired",
};

export type MockConsentPort = ConsentPort & {
  /** Options each `gather` was called with, in order — for assertions. */
  readonly gatherCalls: (ConsentRequestOptions | undefined)[];
  readonly privacyOptionsCalls: number;
  readonly resetCalls: number;
};

function isError(outcome: MockConsentOutcome): outcome is { error: string } {
  return "error" in outcome && typeof outcome.error === "string";
}

/** In-memory `ConsentPort` for development and tests. Deterministic: no timers,
 *  no randomness, no native module. Every branch the lifecycle must handle —
 *  not required, form required, obtained, ads refused, request failure — is
 *  reachable by scripting a snapshot. */
export function createMockConsentPort(config: MockConsentConfig = {}): MockConsentPort {
  const gatherCalls: (ConsentRequestOptions | undefined)[] = [];
  let privacyOptionsCalls = 0;
  let resetCalls = 0;
  const queue = Array.isArray(config.gather) ? [...config.gather] : null;

  function nextGather(): MockConsentOutcome {
    if (queue && queue.length > 0) {
      // Keep the final scripted entry once the queue would empty.
      return queue.length === 1 ? queue[0] : (queue.shift() as MockConsentOutcome);
    }
    return Array.isArray(config.gather) ? {} : (config.gather ?? {});
  }

  function resolve(outcome: MockConsentOutcome): Promise<ConsentInfo> {
    if (isError(outcome)) {
      return Promise.reject(new Error(outcome.error));
    }
    return Promise.resolve({ ...DEFAULT_INFO, ...outcome });
  }

  return {
    get gatherCalls() {
      return gatherCalls;
    },
    get privacyOptionsCalls() {
      return privacyOptionsCalls;
    },
    get resetCalls() {
      return resetCalls;
    },
    gather(options?: ConsentRequestOptions) {
      gatherCalls.push(options);
      return resolve(nextGather());
    },
    showPrivacyOptionsForm() {
      privacyOptionsCalls += 1;
      return resolve(config.privacyOptions ?? {});
    },
    reset() {
      resetCalls += 1;
    },
  };
}
