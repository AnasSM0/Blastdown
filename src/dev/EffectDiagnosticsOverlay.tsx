import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import {
  DIAGNOSTICS_REFRESH_MS,
  readEffectDiagnostics,
  type EffectDiagnosticsSnapshot,
} from "../ui/effects/effectDiagnostics";

/** The effect-delivery readout, for a phone in someone's hand.
 *
 *  ## Why it polls
 *
 *  The overlay exists to diagnose dropped frames and effects that never draw.
 *  An overlay driven by an animation frame, or one that re-rendered on every
 *  recorded transition, would be adding React work to precisely the frames it is
 *  meant to be measuring — it would report a problem it was partly causing, and
 *  the numbers would get worse the harder you looked at them.
 *
 *  So it reads the ledger on a fixed interval an order of magnitude slower than
 *  a frame, and the ledger itself is plain JavaScript with no React state in it.
 *  Between refreshes this component costs nothing at all.
 *
 *  ## Why it is not themed
 *
 *  Deliberately hard-coded colours. It has to stay legible over every theme,
 *  including the dark ones it will usually be read against, and a diagnostic
 *  that changes appearance with the thing under test is one more variable. */
export function EffectDiagnosticsOverlay() {
  const [snapshot, setSnapshot] = useState<EffectDiagnosticsSnapshot>(() =>
    readEffectDiagnostics(Date.now()),
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setSnapshot(readEffectDiagnostics(Date.now()));
    }, DIAGNOSTICS_REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <View style={styles.panel} pointerEvents="none" testID="effect-diagnostics">
      <Text style={styles.heading}>EFFECT DELIVERY</Text>

      <View style={styles.grid}>
        <Metric testID="effect-diagnostics-queue-depth" label="queue" value={snapshot.queueDepth} />
        <Metric testID="effect-diagnostics-rendered" label="drawn" value={snapshot.renderedCount} />
        <Metric testID="effect-diagnostics-accepted" label="accept" value={snapshot.accepted} />
        <Metric
          testID="effect-diagnostics-started"
          label="started"
          value={snapshot.startedDrawing}
        />
        <Metric testID="effect-diagnostics-completed" label="done" value={snapshot.completed} />
        <Metric testID="effect-diagnostics-evicted" label="evict" value={snapshot.evicted} />
        <Metric testID="effect-diagnostics-dropped" label="drop" value={snapshot.dropped} />
        <Metric
          testID="effect-diagnostics-session"
          label="gen"
          value={`${snapshot.sessionId} (${snapshot.sessionCleared} cleared)`}
        />
        <Metric
          testID="effect-diagnostics-cinematic"
          label="renderer"
          value={snapshot.cinematic ? "skia" : "views"}
        />
        <Metric
          testID="effect-diagnostics-oldest-waiting"
          label="waiting"
          // Climbing rather than settling means the renderer is not reporting
          // draws at all, which is a different fault from a slow frame.
          value={`${snapshot.oldestWaitingMs}ms`}
        />
        <Metric
          testID="effect-diagnostics-latency"
          label="latency"
          value={`${snapshot.lastLatencyMs ?? "-"} / ${snapshot.maxLatencyMs ?? "-"}ms`}
        />
      </View>

      {snapshot.effects.length === 0 ? (
        <Text style={styles.row}>no live effects</Text>
      ) : (
        snapshot.effects.map((effect) => (
          <Text key={effect.id} style={styles.row} testID={`effect-diagnostics-row-${effect.id}`}>
            {effect.id} · {effect.type} · {effect.priority} · slot{" "}
            {effect.slot === null ? "-" : effect.slot} ·{" "}
            {effect.latencyMs === null ? `waiting ${effect.waitingMs}ms` : `${effect.latencyMs}ms`}
          </Text>
        ))
      )}
    </View>
  );
}

function Metric({
  testID,
  label,
  value,
}: {
  testID: string;
  label: string;
  value: number | string;
}) {
  // Label and value are separate nodes so the value carries the testID alone —
  // a device readout asserted against "accept 0" would break every time the
  // wording changed.
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue} testID={testID}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: "rgba(0, 0, 0, 0.82)",
    borderColor: "#39ff88",
    borderRadius: 6,
    borderWidth: 1,
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  heading: {
    color: "#39ff88",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  metric: {
    alignItems: "baseline",
    flexDirection: "row",
    gap: 3,
  },
  metricLabel: {
    color: "#7f8c9b",
    fontSize: 10,
  },
  metricValue: {
    color: "#e8e8e8",
    fontSize: 10,
    fontWeight: "700",
  },
  row: {
    color: "#9fd8ff",
    fontSize: 10,
  },
});
