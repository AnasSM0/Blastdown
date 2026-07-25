import type { ReactNode } from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";

import { radius, spacing, typography } from "../../ui/theme";
import { useTheme } from "../../ui/ThemeProvider";
import type { ThemePalette } from "../../ui/themes";
// The phase vocabulary is shared with every other reward surface (game-over
// Revive, results Double Bolts) so an outcome reads the same everywhere.
import type { RewardActionPhase } from "../../ui/effects/rewardPhase";
import { PressableFeedback } from "../PressableFeedback";

export type { RewardActionPhase };

type RewardedDockActionBase = {
  label: string;
  glyph: string;
  onPress: () => void;
  disabled: boolean;
  unavailable?: boolean;
  phase?: RewardActionPhase;
  rewarded?: boolean;
  testID: string;
};

export type RewardedActionBarProps = {
  freeze: RewardedDockActionBase & {
    active: boolean;
    placementsRemaining: number;
  };
  defuse: RewardedDockActionBase & {
    selected: boolean;
  };
  /** Effective reduced-motion, for the dock buttons' press feedback. */
  reducedMotion?: boolean;
};

type PresentationState =
  | "pending"
  | "active"
  | "selected"
  | "success"
  | "failure"
  | "cancelled"
  | "unapplied"
  | "unavailable"
  | "disabled"
  | "available";

type DockActionProps = RewardedDockActionBase & {
  engaged: "active" | "selected" | null;
  accessibilityLabel: string;
  activeCaption?: ReactNode;
  reducedMotion?: boolean;
};

function presentationState({
  phase = "idle",
  engaged,
  disabled,
  unavailable = false,
}: Pick<DockActionProps, "phase" | "engaged" | "disabled" | "unavailable">): PresentationState {
  if (phase === "pending") {
    return "pending";
  }
  if (engaged) {
    return engaged;
  }
  if (phase !== "idle") {
    return phase;
  }
  if (disabled && unavailable) {
    return "unavailable";
  }
  if (disabled) {
    return "disabled";
  }
  return "available";
}

function stateStyle(theme: ThemePalette, state: PresentationState): ViewStyle {
  switch (state) {
    case "active":
      return {
        backgroundColor: theme.timerFrozen,
        borderColor: theme.timerFrozen,
        borderWidth: 2,
      };
    case "selected":
      return {
        backgroundColor: theme.boardBg,
        borderColor: theme.block.cyan,
        borderWidth: 2,
      };
    case "success":
      return { borderColor: theme.accent, borderWidth: 2 };
    case "failure":
      return { borderColor: theme.timerCritical, borderWidth: 2 };
    case "cancelled":
      return { borderColor: theme.outline, borderWidth: 1 };
    case "unapplied":
      return { borderColor: theme.timerCritical, borderWidth: 2, opacity: 0.72 };
    case "pending":
      return { borderColor: theme.timerWarning, borderWidth: 1, opacity: 0.72 };
    case "unavailable":
      return { borderColor: theme.outlineVariant, borderStyle: "dashed", opacity: 0.58 };
    case "disabled":
      return { borderColor: theme.outlineVariant, borderStyle: "solid", opacity: 0.4 };
    case "available":
      return { borderColor: theme.outline, borderStyle: "solid", opacity: 1 };
  }
}

function captionFor(state: PresentationState): string {
  switch (state) {
    case "pending":
      return "…";
    case "selected":
      return "SELECTED";
    case "success":
      return "✓ DONE";
    case "failure":
      return "AD FAILED";
    case "cancelled":
      return "CANCELLED";
    case "unapplied":
      return "NOT APPLIED";
    case "unavailable":
      return "—";
    case "active":
    case "disabled":
    case "available":
      return "";
  }
}

/** A screen-reader hint conveying the button's current state — the equivalent of
 *  the visible caption/indicator for assistive tech. */
function stateHint(state: PresentationState, rewardedVisible: boolean): string | undefined {
  switch (state) {
    case "pending":
      return "Loading the rewarded ad";
    case "unavailable":
      return "Not available right now";
    case "disabled":
      return "Temporarily unavailable";
    case "success":
      return "Reward earned";
    case "failure":
      return "Ad failed, tap to try again";
    case "cancelled":
      return "Ad cancelled";
    case "unapplied":
      return "Ad finished but the reward could not be applied. Nothing was spent";
    case "available":
      return rewardedVisible ? "Watch a rewarded ad to use this" : undefined;
    case "active":
    case "selected":
      return undefined;
  }
}

function DockAction({
  label,
  glyph,
  onPress,
  disabled,
  unavailable = false,
  phase = "idle",
  rewarded = false,
  testID,
  engaged,
  accessibilityLabel,
  activeCaption,
  reducedMotion,
}: DockActionProps) {
  const theme = useTheme();
  const state = presentationState({ phase, engaged, disabled, unavailable });
  const pending = state === "pending";
  const pressDisabled = disabled || pending;
  const rewardedVisible = state === "available" && rewarded;
  const active = state === "active";

  // A hint that conveys the CURRENT state to assistive tech (the visible captions
  // do this for sighted users). "available + rewarded" announces the rewarded-ad
  // cost, which is otherwise only shown as the visual "▷ AD" chip.
  const accessibilityHint = stateHint(state, rewardedVisible);

  return (
    <PressableFeedback
      onPress={pressDisabled ? undefined : onPress}
      disabled={pressDisabled}
      reducedMotion={reducedMotion}
      pressStyle="scale"
      style={[styles.action, { backgroundColor: theme.boardBg }, stateStyle(theme, state)]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: pressDisabled }}
      testID={testID}
    >
      <View style={styles.glyphRow}>
        <Text
          style={[styles.glyph, { color: active ? theme.boardBg : theme.onSurface }]}
          allowFontScaling={false}
        >
          {glyph}
        </Text>
        {rewardedVisible ? (
          <View
            style={[
              styles.rewardChip,
              { borderColor: theme.accent, backgroundColor: theme.surfaceBg },
            ]}
            testID={`${testID}-reward`}
          >
            <Text
              style={[styles.rewardText, { color: theme.accent }]}
              numberOfLines={1}
              maxFontSizeMultiplier={1.3}
            >
              ▷ AD
            </Text>
          </View>
        ) : null}
      </View>
      <Text
        style={[styles.label, { color: active ? theme.boardBg : theme.onSurface }]}
        numberOfLines={1}
        maxFontSizeMultiplier={1.3}
      >
        {label}
      </Text>
      <View style={styles.captionRow}>
        {state === "active" && activeCaption ? (
          activeCaption
        ) : (
          <Text
            style={[
              styles.caption,
              {
                color:
                  state === "failure" || state === "unapplied"
                    ? theme.timerCritical
                    : theme.onSurfaceVariant,
              },
            ]}
            numberOfLines={1}
            maxFontSizeMultiplier={1.3}
            testID={`${testID}-caption`}
          >
            {captionFor(state)}
          </Text>
        )}
      </View>
    </PressableFeedback>
  );
}

export function RewardedActionBar({ freeze, defuse, reducedMotion }: RewardedActionBarProps) {
  const theme = useTheme();

  return (
    <View
      style={[styles.bar, { backgroundColor: theme.surfaceBg, borderColor: theme.outlineVariant }]}
      testID="rewarded-action-bar"
    >
      <DockAction
        {...freeze}
        reducedMotion={reducedMotion}
        engaged={freeze.active ? "active" : null}
        accessibilityLabel={
          freeze.active
            ? `Freeze active, ${freeze.placementsRemaining} placements left`
            : "Freeze timers"
        }
        activeCaption={
          <Text
            style={[styles.caption, { color: theme.boardBg }]}
            numberOfLines={1}
            maxFontSizeMultiplier={1.3}
            testID="freeze-moves-label"
          >
            {freeze.placementsRemaining} {freeze.placementsRemaining === 1 ? "MOVE" : "MOVES"}
          </Text>
        }
      />
      <DockAction
        {...defuse}
        reducedMotion={reducedMotion}
        engaged={defuse.selected ? "selected" : null}
        accessibilityLabel="Defuse the lowest-timer piece"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    gap: spacing.xs,
    padding: spacing.xs,
    borderWidth: 1,
    borderRadius: radius.panel,
    shadowColor: "#000000",
    shadowOpacity: 0.16,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  action: {
    flex: 1,
    minWidth: 48,
    minHeight: 76,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderRadius: radius.cell,
    alignItems: "center",
    justifyContent: "center",
  },
  glyphRow: {
    minHeight: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  glyph: {
    fontSize: 20,
    lineHeight: 22,
  },
  rewardChip: {
    position: "absolute",
    left: 18,
    top: -2,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xs,
    minWidth: 31,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  rewardText: {
    fontSize: 8,
    lineHeight: 10,
    fontWeight: "600",
  },
  label: {
    ...typography.labelCaps,
    fontSize: 11,
    lineHeight: 14,
    marginTop: 1,
  },
  captionRow: {
    height: 16,
    marginTop: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  caption: {
    ...typography.labelCaps,
    fontSize: 9,
    lineHeight: 12,
    letterSpacing: 0.7,
  },
});
