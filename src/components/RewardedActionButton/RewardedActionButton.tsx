import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, neonGlow, spacing, typography } from "../../ui/theme";

type RewardedActionButtonProps = {
  glyph: string;
  label: string;
  testID: string;
  onPress: () => void;
  /** Charged/active treatment (cyan fill) — used by Freeze while frozen. */
  active?: boolean;
  /** Cyan outline highlight — used by Defuse while its confirm card is open. */
  selected?: boolean;
  disabled?: boolean;
};

/** A rewarded power-up control (Stitch 07/09). Idle: neutral outline. Active:
 *  cyan fill (Freeze while frozen). Selected: cyan outline (Defuse pending
 *  confirm). Disabled: dimmed and non-interactive when the domain says the
 *  power-up is unavailable or a reward is in flight. */
function RewardedActionButton({
  glyph,
  label,
  testID,
  onPress,
  active = false,
  selected = false,
  disabled = false,
}: RewardedActionButtonProps) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={[
        styles.button,
        active && styles.buttonActive,
        selected && !active && styles.buttonSelected,
        disabled && !active && styles.buttonDisabled,
        active ? neonGlow(colors.cyanBlock, "low") : undefined,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      testID={testID}
    >
      <Text style={[styles.glyph, active && styles.glyphActive, disabled && styles.glyphDisabled]}>
        {glyph}
      </Text>
    </Pressable>
  );
}

export type RewardedActionBarProps = {
  freeze: {
    onPress: () => void;
    disabled: boolean;
    /** True while a freeze is holding timers. */
    active: boolean;
    /** Successful placements the active freeze still covers (0 when idle). */
    placementsRemaining: number;
  };
  defuse: {
    onPress: () => void;
    disabled: boolean;
    /** True while the defuse confirm card is open. */
    selected: boolean;
  };
};

/** The two in-run rewarded controls beneath the tray. Freeze surfaces its
 *  remaining-placements count while active (Stitch 09's "N MOVES"); Defuse
 *  opens a confirm card before spending the reward (Stitch 07). Both are
 *  disabled by the caller from the domain's own capability checks. */
export function RewardedActionBar({ freeze, defuse }: RewardedActionBarProps) {
  return (
    <View style={styles.bar} testID="rewarded-action-bar">
      <View style={styles.slot}>
        {freeze.active ? (
          <Text style={styles.movesLabel} testID="freeze-moves-label">
            {freeze.placementsRemaining} {freeze.placementsRemaining === 1 ? "MOVE" : "MOVES"}
          </Text>
        ) : null}
        <RewardedActionButton
          glyph="❄"
          label={
            freeze.active
              ? `Freeze active, ${freeze.placementsRemaining} placements left`
              : "Freeze timers"
          }
          testID="freeze-button"
          onPress={freeze.onPress}
          active={freeze.active}
          disabled={freeze.disabled}
        />
      </View>
      <View style={styles.slot}>
        <RewardedActionButton
          glyph="⚡"
          label="Defuse the lowest-timer piece"
          testID="defuse-button"
          onPress={defuse.onPress}
          selected={defuse.selected}
          disabled={defuse.disabled}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "flex-end",
    gap: spacing.xl,
    paddingVertical: spacing.sm,
  },
  slot: {
    alignItems: "center",
    gap: spacing.xs,
  },
  movesLabel: {
    ...typography.labelCaps,
    color: colors.cyanBlock,
    fontSize: 11,
  },
  button: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  buttonActive: {
    backgroundColor: colors.cyanBlock,
    borderColor: colors.cyanBlock,
  },
  buttonSelected: {
    borderColor: colors.cyanBlock,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  glyph: {
    fontSize: 20,
    color: colors.onSurfaceVariant,
  },
  glyphActive: {
    color: colors.appBackground,
  },
  glyphDisabled: {
    color: colors.onSurfaceVariant,
  },
});
