import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";

import { radius, spacing, typography } from "../../ui/theme";
import { useTheme } from "../../ui/ThemeProvider";
import type { ThemePalette } from "../../ui/themes";

export type RewardActionPhase = "idle" | "pending" | "success" | "failure" | "cancelled";

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
};

type PresentationState =
  | "pending"
  | "active"
  | "selected"
  | "success"
  | "failure"
  | "cancelled"
  | "unavailable"
  | "disabled"
  | "available";

type DockActionProps = RewardedDockActionBase & {
  engaged: "active" | "selected" | null;
  accessibilityLabel: string;
  activeCaption?: ReactNode;
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
    case "unavailable":
      return "—";
    case "active":
    case "disabled":
    case "available":
      return "";
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
}: DockActionProps) {
  const theme = useTheme();
  const state = presentationState({ phase, engaged, disabled, unavailable });
  const pending = state === "pending";
  const pressDisabled = disabled || pending;
  const rewardedVisible = state === "available" && rewarded;
  const active = state === "active";

  return (
    <Pressable
      onPress={pressDisabled ? undefined : onPress}
      disabled={pressDisabled}
      style={[styles.action, { backgroundColor: theme.boardBg }, stateStyle(theme, state)]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      testID={testID}
    >
      <View style={styles.glyphRow}>
        <Text style={[styles.glyph, { color: active ? theme.boardBg : theme.onSurface }]}>
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
            <Text style={[styles.rewardText, { color: theme.accent }]}>▷ AD</Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.label, { color: active ? theme.boardBg : theme.onSurface }]}>
        {label}
      </Text>
      <View style={styles.captionRow}>
        {state === "active" && activeCaption ? (
          activeCaption
        ) : (
          <Text
            style={[
              styles.caption,
              { color: state === "failure" ? theme.timerCritical : theme.onSurfaceVariant },
            ]}
            testID={`${testID}-caption`}
          >
            {captionFor(state)}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

export function RewardedActionBar({ freeze, defuse }: RewardedActionBarProps) {
  const theme = useTheme();

  return (
    <View
      style={[styles.bar, { backgroundColor: theme.surfaceBg, borderColor: theme.outlineVariant }]}
      testID="rewarded-action-bar"
    >
      <DockAction
        {...freeze}
        engaged={freeze.active ? "active" : null}
        accessibilityLabel={
          freeze.active
            ? `Freeze active, ${freeze.placementsRemaining} placements left`
            : "Freeze timers"
        }
        activeCaption={
          <Text style={[styles.caption, { color: theme.boardBg }]} testID="freeze-moves-label">
            {freeze.placementsRemaining} {freeze.placementsRemaining === 1 ? "MOVE" : "MOVES"}
          </Text>
        }
      />
      <DockAction
        {...defuse}
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
