import { useEffect, useState } from "react";
import { Pressable, Share, StyleSheet, Text, View } from "react-native";

import type { PlaytestSession } from "../../services/playtest/types";
import { playtestRecorder } from "./recorderSingleton";

function durationLabel(session: PlaytestSession | null, now: number): string {
  if (!session) return "0m 00s";
  const end = session.completedAt ?? now;
  const seconds = Math.max(0, Math.floor((end - session.startedAt) / 1000));
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, "0")}s`;
}

export function PlaytestDashboard() {
  const [session, setSession] = useState(() => playtestRecorder.getCurrentSession());
  const [now, setNow] = useState(() => session?.startedAt ?? 0);
  const [resetArmed, setResetArmed] = useState(false);
  const [exportText, setExportText] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => setSession(playtestRecorder.getCurrentSession());
    const unsubscribe = playtestRecorder.subscribe(refresh);
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      unsubscribe();
      clearInterval(timer);
    };
  }, []);

  const run = session?.runs.at(-1) ?? null;
  const activeTimers = run?.currentActiveTimerCount ?? 0;
  const lowestTimer = run?.currentLowestTimer ?? null;
  const exportData = async () => {
    const json = JSON.stringify(playtestRecorder.export(), null, 2);
    setExportText(json);
    try {
      await Share.share({ title: "BlastDown playtest evidence", message: json });
    } catch {
      // Sharing is optional; the selectable preview remains available below.
    }
  };

  const resetData = () => {
    if (!resetArmed) {
      setResetArmed(true);
      return;
    }
    setResetArmed(false);
    setExportText(null);
    void playtestRecorder.reset();
  };

  return (
    <View style={styles.panel} testID="playtest-dashboard">
      <Text style={styles.title}>HUMAN PLAYTEST EVIDENCE</Text>
      <Text style={styles.metrics}>
        Runs {session?.runs.length ?? 0} · Turn {run?.turnsSurvived ?? 0} · Score{" "}
        {run?.finalScore ?? 0}
      </Text>
      <Text style={styles.metrics}>
        Timers {activeTimers} · Lowest {lowestTimer ?? "—"} · Explosions {run?.explosions ?? 0} ·
        Defuses {run?.naturalDefuses ?? 0}
      </Text>
      <Text style={styles.metrics}>
        First explosion {run?.firstExplosionTurn ?? "—"} · Repeated hands{" "}
        {run?.repeatedShapeHandCount ?? 0}/{run?.handRefillCount ?? 0} · Session{" "}
        {durationLabel(session, now)}
      </Text>
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Export playtest data"
          testID="playtest-export"
          style={styles.button}
          onPress={() => void exportData()}
        >
          <Text style={styles.buttonText}>EXPORT PLAYTEST DATA</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={resetArmed ? "Confirm reset playtest data" : "Reset playtest data"}
          testID="playtest-reset"
          style={[styles.button, resetArmed && styles.danger]}
          onPress={resetData}
        >
          <Text style={styles.buttonText}>
            {resetArmed ? "CONFIRM RESET" : "RESET PLAYTEST DATA"}
          </Text>
        </Pressable>
      </View>
      {exportText ? (
        <Text selectable style={styles.exportPreview} testID="playtest-export-preview">
          {exportText}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: "#0d151f",
    borderColor: "#2c3f57",
    borderRadius: 6,
    borderWidth: 1,
    gap: 5,
    padding: 10,
    width: "100%",
  },
  title: { color: "#39ff88", fontSize: 12, fontWeight: "800" },
  metrics: { color: "#cfd8e3", fontSize: 11, lineHeight: 15 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  button: {
    backgroundColor: "#16202e",
    borderColor: "#2c3f57",
    borderRadius: 5,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  danger: { borderColor: "#ff5964" },
  buttonText: { color: "#e8f1ff", fontSize: 10, fontWeight: "700" },
  exportPreview: {
    backgroundColor: "#05070a",
    color: "#aab8c8",
    fontFamily: "monospace",
    fontSize: 8,
    maxHeight: 180,
    padding: 6,
  },
});
