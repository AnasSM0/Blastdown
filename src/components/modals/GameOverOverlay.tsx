import { Animated, StyleSheet, Text, View } from "react-native";

import { colors, neonGlow, radius, spacing, typography } from "../../ui/theme";
import type { RewardActionPhase } from "../../ui/effects/rewardPhase";
import { useAppearAnimation } from "../../hooks/useAppearAnimation";
import { PressableFeedback } from "../PressableFeedback";
import { RewardOutcomeNotice } from "../RewardOutcomeNotice";

type GameOverOverlayProps = {
  score: number;
  best?: number;
  /** Whether the one-per-run rewarded revive is still available. */
  reviveAvailable: boolean;
  /** Spend a rewarded ad to repair and continue the run. */
  onRevive: () => void;
  /** Abandon the run and open the results screen. */
  onEndRun: () => void;
  /** Disables both actions while a revive reward is in flight. */
  busy?: boolean;
  /** Transient outcome of the revive reward (pending / success / cancelled /
   *  failure), shown as the same status line every other reward surface uses so
   *  a dismissed or failed ad is never silent. */
  revivePhase?: RewardActionPhase;
  /** Effective reduced-motion for the appear transition + press feedback. */
  reducedMotion?: boolean;
};

/** Game-over panel (Stitch 08). Shown over the failed board (visible beneath
 *  the scrim). Offers a single rewarded "Repair & Continue" while a revive is
 *  available, then "End Run" to the results screen. It renders no gameplay —
 *  revive applies through the domain only after the reward is earned. */
export function GameOverOverlay({
  score,
  best,
  reviveAvailable,
  onRevive,
  onEndRun,
  busy = false,
  revivePhase = "idle",
  reducedMotion = false,
}: GameOverOverlayProps) {
  const appear = useAppearAnimation(reducedMotion);
  return (
    <View
      style={styles.scrim}
      testID="game-over-overlay"
      accessibilityLabel={`Run over. Final score ${score.toLocaleString("en-US")}`}
      accessible
    >
      <Animated.View style={[styles.panel, appear]}>
        <Text style={typography.labelCaps}>RUN OVER</Text>
        <Text style={[styles.score, neonGlow(colors.scoreOrange, "low")]}>
          {score.toLocaleString("en-US")}
        </Text>
        {best !== undefined ? (
          <Text style={styles.best} testID="game-over-best">
            BEST: {best.toLocaleString("en-US")}
          </Text>
        ) : null}

        {reviveAvailable ? (
          <>
            <PressableFeedback
              onPress={busy ? undefined : onRevive}
              disabled={busy}
              reducedMotion={reducedMotion}
              style={[styles.revive, busy && styles.busy, neonGlow(colors.cyanBlock, "low")]}
              accessibilityRole="button"
              accessibilityLabel="Repair and continue by watching an ad"
              accessibilityState={{ disabled: busy }}
              testID="revive-button"
            >
              <Text style={styles.reviveText}>▶ REPAIR &amp; CONTINUE</Text>
            </PressableFeedback>
            <Text style={styles.reviveNote}>CLEAR RUBBLE · ADD +2 MOVES · NEW PIECES</Text>
            <RewardOutcomeNotice phase={revivePhase} testID="revive-outcome" />
          </>
        ) : (
          // The revive is spent (or the run never offered one): say so plainly
          // instead of silently omitting the control.
          <RewardOutcomeNotice phase="idle" unavailable testID="revive-outcome" />
        )}

        <PressableFeedback
          onPress={busy ? undefined : onEndRun}
          disabled={busy}
          reducedMotion={reducedMotion}
          style={styles.endRun}
          accessibilityRole="button"
          accessibilityLabel="End run and see results"
          accessibilityState={{ disabled: busy }}
          testID="end-run-button"
        >
          <Text style={styles.endRunText}>END RUN</Text>
        </PressableFeedback>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(5, 5, 5, 0.85)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  panel: {
    minWidth: 280,
    maxWidth: "88%",
    backgroundColor: colors.surfaceBg,
    borderColor: colors.outlineVariant,
    borderWidth: 1,
    borderRadius: radius.panel,
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.xs,
  },
  score: {
    ...typography.scoreMobile,
    marginTop: spacing.xs,
  },
  best: {
    ...typography.labelCaps,
    color: colors.onSurfaceVariant,
    marginBottom: spacing.sm,
  },
  revive: {
    marginTop: spacing.md,
    alignSelf: "stretch",
    minHeight: 52,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.cyanBlock,
    backgroundColor: `${colors.cyanBlock}1F`,
    alignItems: "center",
    justifyContent: "center",
  },
  busy: {
    opacity: 0.5,
  },
  reviveText: {
    ...typography.buttonText,
    color: colors.cyanBlock,
  },
  reviveNote: {
    ...typography.labelCaps,
    fontSize: 10,
    color: colors.onSurfaceVariant,
    marginTop: spacing.xs,
  },
  endRun: {
    marginTop: spacing.lg,
    minHeight: 44,
    paddingHorizontal: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  endRunText: {
    ...typography.labelCaps,
    color: colors.onSurface,
  },
});
