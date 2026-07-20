import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, radius, spacing, typography } from "../../ui/theme";
import type { ThemePalette } from "../../ui/themes";

type ThemeScreenViewProps = {
  themes: readonly ThemePalette[];
  selectedThemeId: string;
  onSelect: (themeId: string) => void;
  onBack: () => void;
};

/** A compact swatch showing a theme's board, three blocks, a timer dot, and
 *  rubble — enough to judge a theme without leaving the screen. */
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

/** Themes screen (BUILD_SPEC.md §10.6). Selecting a theme applies immediately
 *  and is persisted by the caller. All themes are selectable for now — the
 *  Bolt-unlock economy is deferred (see docs/DECISIONS.md); locked tiles show
 *  their price for information only. */
export function ThemeScreenView({
  themes,
  selectedThemeId,
  onSelect,
  onBack,
}: ThemeScreenViewProps) {
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
        <View style={styles.backSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {themes.map((theme) => {
          const selected = theme.id === selectedThemeId;
          return (
            <Pressable
              key={theme.id}
              onPress={() => onSelect(theme.id)}
              accessibilityRole="button"
              accessibilityLabel={`${theme.name} theme`}
              accessibilityHint={
                theme.locked ? `Locked, costs ${theme.price} Bolts` : "Applies immediately"
              }
              accessibilityState={{ selected }}
              testID={`theme-tile-${theme.id}`}
              style={[styles.tile, selected && styles.tileSelected]}
            >
              <ThemePreview theme={theme} />
              <View style={styles.tileInfo}>
                <Text style={styles.tileName}>{theme.name}</Text>
                {theme.locked ? (
                  <Text style={styles.tilePrice} testID={`theme-price-${theme.id}`}>
                    {`${theme.price} ⚡`}
                  </Text>
                ) : (
                  <Text style={styles.tileFree}>Included</Text>
                )}
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
  backSpacer: {
    width: 44,
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
  tilePrice: {
    ...typography.labelCaps,
    color: colors.amberBlock,
    textTransform: "none",
  },
  tileFree: {
    ...typography.labelCaps,
    color: colors.onSurfaceVariant,
    textTransform: "none",
  },
  selectedMark: {
    ...typography.numericValue,
    color: colors.onSurface,
    fontSize: 20,
  },
});
