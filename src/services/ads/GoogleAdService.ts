import { REWARDED_EARN_GRACE_MS, REWARDED_LOAD_TIMEOUT_MS } from "../../config/ads";
import { reportError } from "../diagnostics/reportError";
import { isNoAdAvailableCode } from "./rewardedPort";
import type { RewardedAdEvent, RewardedAdHandle, RewardedAdPort } from "./rewardedPort";
import type { AdService, InterstitialResult, RewardedPlacement, RewardedResult } from "./types";

/** Where a rewarded attempt is, per placement. `showing` is global-exclusive —
 *  only one ad may be on screen at a time. */
type SlotState = "idle" | "loading" | "ready" | "showing";

/** Why an attempt did not reach `earned`. Richer than the four public
 *  `RewardedResult` values so diagnostics can tell "no ad existed" from
 *  "the SDK misbehaved"; the mapping down is in `resultOf`. */
type RewardedFailure =
  | "notAllowed"
  | "unconfigured"
  | "busy"
  | "noAdAvailable"
  | "loadError"
  | "loadTimeout"
  | "showError"
  | "disposed";

type LoadOutcome = { ok: true; handle: RewardedAdHandle } | { ok: false; failure: RewardedFailure };

type Presentation = {
  /** Set the moment the SDK reports the reward was earned. */
  earned: boolean;
  settled: boolean;
  resolve: (result: RewardedResult) => void;
  graceTimer: ReturnType<typeof setTimeout> | null;
};

type Slot = {
  state: SlotState;
  handle: RewardedAdHandle | null;
  loadTimer: ReturnType<typeof setTimeout> | null;
  loadWaiters: ((outcome: LoadOutcome) => void)[];
  presentation: Presentation | null;
};

export type GoogleAdServiceOptions = {
  port: RewardedAdPort;
  /** Ad unit per placement. A placement absent here is reported `unavailable`
   *  and never requested — see `resolveRewardedAdUnitIds`. */
  adUnitIds: Partial<Record<RewardedPlacement, string>>;
  /** Whether ads may be requested at construction. Kept current with
   *  `setAdsAllowed`, so a consent decision made mid-session takes effect on the
   *  next request without rebuilding the service and dropping a preloaded ad. */
  adsAllowed?: boolean;
  /** Awaited before the first load. Must be idempotent. */
  ensureInitialized?: () => Promise<void>;
  loadTimeoutMs?: number;
  earnGraceMs?: number;
};

export type GoogleAdService = AdService & {
  setAdsAllowed(allowed: boolean): void;
  dispose(): void;
};

/** Maps an internal failure onto the four outcomes the run lifecycle handles.
 *  `unavailable` means "nothing to show, this is normal"; `error` means
 *  "something went wrong". Neither grants anything. */
function resultOf(failure: RewardedFailure): RewardedResult {
  switch (failure) {
    case "notAllowed":
    case "unconfigured":
    case "noAdAvailable":
    case "loadTimeout":
    case "loadError":
      return "unavailable";
    case "busy":
    case "showError":
    case "disposed":
      return "error";
  }
}

/** `AdService` backed by Google rewarded ads.
 *
 *  The safety rules, all enforced here rather than at the call sites:
 *
 *  - A reward is granted only from the SDK's earned-reward event. Closing the
 *    ad, a load failure, a show failure, a timeout and a missing consent all
 *    resolve to a non-earning outcome.
 *  - A presentation resolves exactly once. `settled` guards every path into the
 *    resolver, so a reward cannot be applied twice however the events arrive.
 *  - Only one ad may be presented at a time, across every placement.
 *  - Gameplay is never touched from here: the service returns a result and the
 *    caller applies the domain change. Nothing runs before `earned`. */
export function createGoogleAdService({
  port,
  adUnitIds,
  adsAllowed = false,
  ensureInitialized,
  loadTimeoutMs = REWARDED_LOAD_TIMEOUT_MS,
  earnGraceMs = REWARDED_EARN_GRACE_MS,
}: GoogleAdServiceOptions): GoogleAdService {
  const slots = new Map<RewardedPlacement, Slot>();
  let allowed = adsAllowed;
  /** Global: an ad is on screen. Blocks a second presentation of any placement. */
  let presenting = false;
  let disposed = false;
  let initialization: Promise<void> | null = null;
  let initializationFailed = false;

  function slotFor(placement: RewardedPlacement): Slot {
    let slot = slots.get(placement);
    if (!slot) {
      slot = { state: "idle", handle: null, loadTimer: null, loadWaiters: [], presentation: null };
      slots.set(placement, slot);
    }
    return slot;
  }

  function clearLoadTimer(slot: Slot): void {
    if (slot.loadTimer !== null) {
      clearTimeout(slot.loadTimer);
      slot.loadTimer = null;
    }
  }

  /** Release the ad instance and return the slot to `idle`. A rewarded ad is
   *  single-use, so this runs after every presentation as well as after every
   *  failure — a stale handle is never shown twice. */
  function release(slot: Slot): void {
    clearLoadTimer(slot);
    slot.handle?.destroy();
    slot.handle = null;
    slot.state = "idle";
  }

  function settleLoad(slot: Slot, outcome: LoadOutcome): void {
    const waiters = slot.loadWaiters;
    slot.loadWaiters = [];
    for (const waiter of waiters) {
      waiter(outcome);
    }
  }

  function settleShow(slot: Slot, result: RewardedResult): void {
    const presentation = slot.presentation;
    if (!presentation || presentation.settled) {
      return;
    }
    presentation.settled = true;
    if (presentation.graceTimer !== null) {
      clearTimeout(presentation.graceTimer);
      presentation.graceTimer = null;
    }
    slot.presentation = null;
    // The ad has been consumed either way; the next attempt loads a fresh one.
    release(slot);
    presentation.resolve(result);
  }

  function handleEvent(placement: RewardedPlacement, slot: Slot, event: RewardedAdEvent): void {
    if (slot.state === "loading") {
      if (event.type === "loaded" && slot.handle) {
        clearLoadTimer(slot);
        slot.state = "ready";
        settleLoad(slot, { ok: true, handle: slot.handle });
      } else if (event.type === "error") {
        const code = event.code;
        reportError({
          surface: "reward",
          // A fixed message, never the SDK's own text: Google's ad error strings
          // sometimes name the ad unit, and the diagnostics contract forbids
          // carrying one. The normalized code is the actionable part.
          message: "Rewarded ad failed to load",
          // Enumerated values only — never the ad unit id.
          context: { placement, stage: "load", code },
        });
        release(slot);
        settleLoad(slot, {
          ok: false,
          failure: isNoAdAvailableCode(code) ? "noAdAvailable" : "loadError",
        });
      }
      return;
    }

    if (slot.state !== "showing" || !slot.presentation) {
      return;
    }
    const presentation = slot.presentation;
    if (event.type === "earned") {
      presentation.earned = true;
      // If the ad already closed we are inside the grace window: settle now.
      if (presentation.graceTimer !== null) {
        settleShow(slot, "earned");
      }
      return;
    }
    if (event.type === "closed") {
      if (presentation.earned) {
        settleShow(slot, "earned");
        return;
      }
      // The Android SDK normally emits the reward before `closed`, but the order
      // is not contractual. Hold briefly for a late reward rather than dropping
      // one the player genuinely earned; `settled` still guarantees one grant.
      presentation.graceTimer = setTimeout(() => {
        settleShow(slot, presentation.earned ? "earned" : "closed");
      }, earnGraceMs);
      return;
    }
    if (event.type === "error") {
      reportError({
        surface: "reward",
        message: "Rewarded ad failed to present",
        context: { placement, stage: "show", code: event.code },
      });
      // An error after the reward was earned must not take the reward away.
      settleShow(slot, presentation.earned ? "earned" : "error");
    }
  }

  /** Start a load if the slot is idle. Safe to call repeatedly: a slot that is
   *  already loading, ready or showing is left alone. */
  function beginLoad(placement: RewardedPlacement, adUnitId: string, slot: Slot): void {
    if (slot.state !== "idle") {
      return;
    }
    const handle = port.create(adUnitId);
    slot.handle = handle;
    slot.state = "loading";
    handle.subscribe((event) => handleEvent(placement, slot, event));
    slot.loadTimer = setTimeout(() => {
      slot.loadTimer = null;
      reportError({
        surface: "reward",
        message: "Rewarded ad load timed out",
        context: { placement, stage: "load", code: "timeout" },
      });
      release(slot);
      settleLoad(slot, { ok: false, failure: "loadTimeout" });
    }, loadTimeoutMs);
    handle.load();
  }

  function awaitLoad(placement: RewardedPlacement, adUnitId: string): Promise<LoadOutcome> {
    const slot = slotFor(placement);
    if (slot.state === "ready" && slot.handle) {
      return Promise.resolve({ ok: true, handle: slot.handle });
    }
    return new Promise<LoadOutcome>((resolve) => {
      slot.loadWaiters.push(resolve);
      beginLoad(placement, adUnitId, slot);
    });
  }

  /** A placement is requestable only with consent, a configured unit, and no
   *  other ad on screen. Checked before anything is created, so a blocked
   *  request costs nothing. */
  function checkRequestable(placement: RewardedPlacement): RewardedFailure | null {
    if (disposed) {
      return "disposed";
    }
    if (!adUnitIds[placement]) {
      return "unconfigured";
    }
    if (!allowed) {
      return "notAllowed";
    }
    return null;
  }

  async function present(
    placement: RewardedPlacement,
    handle: RewardedAdHandle,
  ): Promise<RewardedResult> {
    const slot = slotFor(placement);
    slot.state = "showing";
    const result = new Promise<RewardedResult>((resolve) => {
      slot.presentation = { earned: false, settled: false, resolve, graceTimer: null };
    });
    try {
      await handle.show();
    } catch {
      // The thrown value is dropped for the same reason as above: the SDK's
      // message may name the ad unit. `show()` rejects almost exclusively
      // because the ad was not loaded, which the code records.
      reportError({
        surface: "reward",
        message: "Rewarded ad could not be presented",
        context: { placement, stage: "show", code: "showRejected" },
      });
      // Nothing was presented, so nothing can have been earned.
      settleShow(slot, "error");
    }
    return result;
  }

  /** Await the injected initializer, once. A failure is remembered rather than
   *  retried: initialization failing once in a session fails the same way
   *  again, and retrying would delay every later request for nothing. */
  async function ensureReady(placement: RewardedPlacement): Promise<boolean> {
    if (!ensureInitialized) {
      return true;
    }
    if (initializationFailed) {
      return false;
    }
    initialization ??= ensureInitialized();
    try {
      await initialization;
      return true;
    } catch {
      initializationFailed = true;
      reportError({
        surface: "reward",
        message: "Mobile Ads SDK failed to initialize",
        context: { placement, stage: "initialize" },
      });
      return false;
    }
  }

  /** Warm the next ad for a placement, best effort. Never throws, never blocks
   *  the caller, and never runs when ads are not allowed or the SDK is not up. */
  function preload(placement: RewardedPlacement): void {
    if (checkRequestable(placement)) {
      return;
    }
    const adUnitId = adUnitIds[placement];
    if (!adUnitId) {
      return;
    }
    void ensureReady(placement).then((ready) => {
      // Re-checked after the await: consent can be withdrawn, or the service
      // disposed, while initialization was in flight.
      if (ready && !checkRequestable(placement)) {
        beginLoad(placement, adUnitId, slotFor(placement));
      }
    });
  }

  return {
    async preloadRewarded(placement: RewardedPlacement): Promise<void> {
      if (checkRequestable(placement)) {
        return;
      }
      const adUnitId = adUnitIds[placement];
      if (!adUnitId || !(await ensureReady(placement)) || checkRequestable(placement)) {
        return;
      }
      beginLoad(placement, adUnitId, slotFor(placement));
    },

    async showRewarded(placement: RewardedPlacement): Promise<RewardedResult> {
      const blocked = checkRequestable(placement);
      if (blocked) {
        return resultOf(blocked);
      }
      // Concurrency gate. Checked after the cheap rejections and set
      // synchronously, so two calls in the same tick cannot both pass.
      if (presenting) {
        return resultOf("busy");
      }
      presenting = true;
      try {
        if (!(await ensureReady(placement))) {
          return resultOf("loadError");
        }
        // Re-checked after every await. Consent can be withdrawn — or the
        // service disposed — while initialization or a load is in flight, and a
        // decision made a moment ago must not be overtaken by a request that
        // passed the gate before it.
        const beforeLoad = checkRequestable(placement);
        if (beforeLoad) {
          return resultOf(beforeLoad);
        }
        const adUnitId = adUnitIds[placement] as string;
        const loaded = await awaitLoad(placement, adUnitId);
        if (!loaded.ok) {
          return resultOf(loaded.failure);
        }
        const beforeShow = checkRequestable(placement);
        if (beforeShow) {
          // Loaded under a permission that no longer holds: drop it rather than
          // present it.
          release(slotFor(placement));
          return resultOf(beforeShow);
        }
        return await present(placement, loaded.handle);
      } finally {
        presenting = false;
        // Warm the next one now the slot is free. Skipped when disposed or when
        // consent has since been withdrawn — `preload` re-checks both.
        preload(placement);
      }
    },

    // Interstitials are not part of this phase. Whether release 1 carries them
    // at all is an open owner decision (docs/MONETIZATION.md), and reporting
    // `unavailable` is the honest answer for a placement with no ad unit and no
    // frequency policy yet -- callers already treat it as a quiet no-op.
    async preloadInterstitial(): Promise<void> {},
    async showInterstitial(): Promise<InterstitialResult> {
      return "unavailable";
    },

    setAdsAllowed(next: boolean): void {
      const wasAllowed = allowed;
      allowed = next;
      if (!wasAllowed || next) {
        return;
      }
      // Consent has been withdrawn. Anything loaded or loading was requested
      // under a permission that no longer holds, so it is dropped rather than
      // left sitting as reusable inventory with its listeners alive. An ad
      // already on screen is left to finish: the user is watching it, and it
      // was requested legitimately.
      for (const slot of slots.values()) {
        if (slot.state === "showing") {
          continue;
        }
        release(slot);
        settleLoad(slot, { ok: false, failure: "notAllowed" });
      }
    },

    dispose(): void {
      disposed = true;
      for (const slot of slots.values()) {
        // Settle anything outstanding so no caller is left awaiting forever.
        // A reward already earned is still honoured -- the caller's own mounted
        // check decides whether it can be applied.
        if (slot.presentation) {
          settleShow(slot, slot.presentation.earned ? "earned" : "closed");
        }
        settleLoad(slot, { ok: false, failure: "disposed" });
        release(slot);
      }
      slots.clear();
      presenting = false;
    },
  };
}
