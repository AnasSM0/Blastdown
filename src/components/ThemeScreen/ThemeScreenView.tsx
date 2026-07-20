import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { catalogEntry, isUnlocked } from "../../economy/themeCatalog";
import { colors, radius, spacing, typography } from "../../ui/theme";
import { resolveTheme, type ThemePalette } from "../../ui/themes";

type ThemeScreenViewProps = {
  themes: readonly ThemePalette[];
  selectedThemeId: string;
  unlockedThemeIds: readonly string[];
  bolts: number;
  /** The locked theme whose purchase confirmation is open, or null. */
  pendingThemeId: string | null;
  /** Tile tap: the caller selects an owned theme or opens purchase for a locked one. */
  onSelect: (themeId: string) => void;
  onConfirmPurchase: (themeId: string) => void;
  onCancelPurchase: () => void;
  onBack: () => void;
};

function ThemePreview({ theme }: { theme: ThemePalette }) {
  return (
    <View
      style={[styles.preview, { backgroundColor: theme.boardBg, borderColor: theme.boardFrame }]}
    >
      <View style={[styles.swatch, { backgroundColor: theme.block.cyan }]} />
      <View style={[styles.swatch, { backgroundColor: theme.block.purple }]} />
      <View style={[styles.swatch, { backgroundColor: theme.block.amber }]} />
      <View
        style={[
          styles.swatch,
          { backgroundColor: theme.rubbleFill, borderColor: theme.rubbleCrack, borderWidth: 1 },
        ]}
      />
      <View style={[styles.swatch, styles.timerDot, { backgroundColor: theme.timerCritical }]} />
    </View>
  );
}

/** Themes screen (BUILD_SPEC.md §10.6). Owned themes select immediately; locked
 *  themes open a Bolt purchase confirmation. Prices/ownership come from the
 *  authoritative catalog + profile, never hardcoded here. Every control is at
 *  least 44x44 with an accessibility label. */
export function ThemeScreenView({
  themes,
  selectedThemeId,
  unlockedThemeIds,
  bolts,
  pendingThemeId,
  onSelect,
  onConfirmPurchase,
  onCancelPurchase,
  onBack,
}: ThemeScreenViewProps) {
  const pendingEntry = pendingThemeId ? catalogEntry(pendingThemeId) : undefined;
  const pendingAffordable = pendingEntry ? bolts >= pendingEntry.price : false;

  return (
    <SafeAreaView style={styles.screen} testID="themes-screen">
      <View style={styles.header}>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Back"
          testID="themes-back-button"
          hitSlop={8}
          style={styles.backHit}
        >
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <Text style={styles.title}>THEMES</Text>
        <View style={styles.bolts} testID="themes-bolts">
          <Text style={styles.boltsText}>{bolts.toLocaleString("en-US")} ⚡</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {themes.map((theme) => {
          const entry = catalogEntry(theme.id);
          const owned = isUnlocked(unlockedThemeIds, theme.id);
          const selected = theme.id === selectedThemeId;
          const price = entry?.price ?? 0;
          const affordable = bolts >= price;
          const state = selected
            ? "selected"
            : owned
              ? "owned"
              : affordable
                ? "locked"
                : "insufficient";

          return (
            <Pressable
              key={theme.id}
              onPress={() => onSelect(theme.id)}
              accessibilityRole="button"
              accessibilityLabel={`${theme.name} theme, ${
                selected
                  ? "selected"
                  : owned
                    ? "owned"
                    : `locked, ${price} Bolts${affordable ? "" : ", not enough Bolts"}`
              }`}
              accessibilityHint={
                owned ? "Selects immediately" : affordable ? "Opens purchase" : "Not enough Bolts"
              }
              accessibilityState={{ selected }}
              testID={`theme-tile-${theme.id}`}
              style={[styles.tile, selected && styles.tileSelected]}
            >
              <ThemePreview theme={theme} />
              <View style={styles.tileInfo}>
                <Text style={styles.tileName}>{theme.name}</Text>
                <Text
                  style={[styles.tileState, state === "insufficient" && styles.tileStateWarn]}
                  testID={`theme-state-${theme.id}`}
                >
                  {selected
                    ? "SELECTED"
                    : owned
                      ? "OWNED"
                      : affordable
                        ? `${price} ⚡`
                        : `${price} ⚡ · NOT ENOUGH`}
                </Text>
              </View>
              {selected ? (
                <Text style={styles.selectedMark} testID={`theme-selected-${theme.id}`}>
                  ✓
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>

      {pendingThemeId && pendingEntry ? (
        <View style={styles.scrim} testID="theme-purchase-panel">
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>{resolveTheme(pendingThemeId).name}</Text>
            <View style={styles.panelRow}>
              <Text style={styles.panelLabel}>Price</Text>
              <Text style={styles.panelValue}>{pendingEntry.price} ⚡</Text>
            </View>
            <View style={styles.panelRow}>
              <Text style={styles.panelLabel}>Your Bolts</Text>
              <Text style={styles.panelValue}>{bolts} ⚡</Text>
            </View>
            <View style={styles.panelRow}>
              <Text style={styles.panelLabel}>After purchase</Text>
              <Text style={styles.panelValue}>
                {pendingAffordable ? `${bolts - pendingEntry.price} ⚡` : "—"}
              </Text>
            </View>
            {pendingAffordable ? null : (
              <Text style={styles.insufficient} testID="theme-purchase-insufficient">
                Not enough Bolts. Earn more by playing.
              </Text>
            )}
            <View style={styles.panelButtons}>
              <Pressable
                onPress={onCancelPurchase}
                accessibilityRole="button"
                accessibilityLabel="Cancel purchase"
                style={[styles.panelButton]}
                testID="theme-purchase-cancel"
              >
                <Text style={styles.panelButtonText}>CANCEL</Text>
              </Pressable>
              <Pressable
                onPress={() => onConfirmPurchase(pendingThemeId)}
                disabled={!pendingAffordable}
                accessibilityRole="button"
                accessibilityLabel={`Buy ${resolveTheme(pendingThemeId).name} for ${pendingEntry.price} Bolts`}
                accessibilityState={{ disabled: !pendingAffordable }}
                style={[
                  styles.panelButton,
                  styles.panelBuy,
                  !pendingAffordable && styles.panelBuyDisabled,
                ]}
                testID="theme-purchase-confirm"
              >
                <Text style={[styles.panelButtonText, styles.panelBuyText]}>BUY</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.appBackground,
    paddingHorizontal: spacing.screenPadding,
    gap: spacing.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: spacing.md,
  },
  backHit: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: "center",
  },
  back: {
    ...typography.scoreMobile,
    fontSize: 32,
    color: colors.onSurface,
  },
  bolts: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "flex-end",
  },
  boltsText: {
    ...typography.numericValue,
    color: colors.cyanBlock,
  },
  title: {
    ...typography.labelCaps,
    fontSize: 18,
    letterSpacing: 3,
    color: colors.onSurface,
  },
  list: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  tile: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    minHeight: 72,
    padding: spacing.md,
    borderRadius: radius.panel,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceBg,
  },
  tileSelected: {
    borderColor: colors.onSurface,
  },
  preview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    padding: 6,
    borderRadius: radius.cell,
    borderWidth: 1,
  },
  swatch: {
    width: 14,
    height: 14,
    borderRadius: 2,
  },
  timerDot: {
    borderRadius: 7,
  },
  tileInfo: {
    flex: 1,
    gap: 2,
  },
  tileName: {
    ...typography.buttonText,
    color: colors.onSurface,
    fontSize: 16,
  },
  tileState: {
    ...typography.labelCaps,
    color: colors.onSurfaceVariant,
    textTransform: "none",
  },
  tileStateWarn: {
    color: colors.amberBlock,
  },
  selectedMark: {
    ...typography.numericValue,
    color: colors.onSurface,
    fontSize: 20,
  },
  scrim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#000000B0",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  panel: {
    width: "100%",
    maxWidth: 340,
    gap: spacing.md,
    padding: spacing.xl,
    borderRadius: radius.panel,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceBg,
  },
  panelTitle: {
    ...typography.scoreMobile,
    fontSize: 24,
    color: colors.onSurface,
  },
  panelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  panelLabel: {
    ...typography.buttonText,
    color: colors.onSurfaceVariant,
  },
  panelValue: {
    ...typography.numericValue,
    color: colors.onSurface,
  },
  insufficient: {
    ...typography.buttonText,
    color: colors.error,
  },
  panelButtons: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  panelButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    alignItems: "center",
    justifyContent: "center",
  },
  panelBuy: {
    borderColor: colors.cyanBlock,
    backgroundColor: `${colors.cyanBlock}14`,
  },
  panelBuyDisabled: {
    opacity: 0.4,
  },
  panelButtonText: {
    ...typography.buttonText,
    color: colors.onSurface,
  },
  panelBuyText: {
    color: colors.cyanBlock,
  },
});
