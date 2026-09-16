import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { PressableFeedback } from "../src/components/PressableFeedback";
import { ReactorBackground } from "../src/components/ReactorBackground";
import { useEffectiveReducedMotion } from "../src/hooks/useEffectiveReducedMotion";
import { useAdService, type PrivacyOptionsResult } from "../src/services/ads";
import { colors, radius, spacing, typography } from "../src/ui/theme";

const PRIVACY_COPY = [
  [
    "ON THIS DEVICE",
    "BlastDown stores your active run, settings, tutorial status, and best score locally. BlastDown has no account system or cloud save.",
  ],
  [
    "REWARDED ADS",
    "Optional Freeze and Defuse ads use Google Mobile Ads. The advertising SDK may process device identifiers, approximate location derived from network information, diagnostics, interactions, and ad performance data under your consent choices and Google's policies.",
  ],
  [
    "YOUR CHOICES",
    "Where required, Google's consent form appears before ads become eligible. You can revisit available advertising privacy choices below. Gameplay remains available if consent or advertising is unavailable.",
  ],
] as const;

const RESULT_COPY: Record<PrivacyOptionsResult, string> = {
  shown: "Advertising privacy choices were updated.",
  "not-required": "No additional Google advertising choices are required for this device.",
  error: "Privacy choices are temporarily unavailable. Gameplay is unaffected; try again later.",
};

/** Release-compliance surface linked from Home and Settings. The hosted policy
 * remains the Play listing authority; this screen keeps the in-app entry useful
 * offline and exposes the SDK-owned UMP privacy form where required. */
export default function PrivacyScreen() {
  const router = useRouter();
  const ads = useAdService();
  const reducedMotion = useEffectiveReducedMotion();
  const [result, setResult] = useState<PrivacyOptionsResult | null>(null);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }, [router]);

  const handleChoices = useCallback(() => {
    setResult(null);
    void ads.showPrivacyOptions().then(setResult);
  }, [ads]);

  return (
    <View style={styles.screen} testID="privacy-screen">
      <ReactorBackground />
      <SafeAreaView style={styles.safe} edges={["top", "bottom", "left", "right"]}>
        <View style={styles.header}>
          <PressableFeedback
            onPress={handleBack}
            reducedMotion={reducedMotion}
            pressStyle="scale"
            accessibilityRole="button"
            accessibilityLabel="Back"
            testID="privacy-back-button"
            hitSlop={8}
            style={styles.backHit}
          >
            <Text style={styles.back}>‹</Text>
          </PressableFeedback>
          <Text style={styles.title}>PRIVACY</Text>
          <View style={styles.backSpacer} />
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          {PRIVACY_COPY.map(([heading, body]) => (
            <View key={heading} style={styles.card}>
              <Text style={styles.heading}>{heading}</Text>
              <Text style={styles.body}>{body}</Text>
            </View>
          ))}
          <PressableFeedback
            onPress={handleChoices}
            reducedMotion={reducedMotion}
            accessibilityRole="button"
            accessibilityLabel="Open advertising privacy choices"
            testID="privacy-options-button"
            style={styles.choiceButton}
          >
            <Text style={styles.choiceLabel}>AD PRIVACY CHOICES</Text>
          </PressableFeedback>
          {result ? <Text style={styles.result}>{RESULT_COPY[result]}</Text> : null}
          <Text style={styles.footer}>Effective September 14, 2026</Text>
        </ScrollView>
      </SafeAreaView>
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.appBackground },
  safe: { flex: 1, padding: spacing.xl, gap: spacing.lg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backHit: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: `${colors.surfaceBg}CC`,
    alignItems: "center",
    justifyContent: "center",
  },
  back: { ...typography.scoreMobile, fontSize: 30, lineHeight: 32, color: colors.onSurface },
  backSpacer: { width: 44 },
  title: { ...typography.labelCaps, fontSize: 18, letterSpacing: 3, color: colors.onSurface },
  content: { gap: spacing.md, paddingBottom: spacing.xl },
  card: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radius.panel,
    backgroundColor: `${colors.surfaceBg}E6`,
  },
  heading: { ...typography.labelCaps, color: colors.cyanBlock },
  body: { ...typography.body, color: colors.onSurfaceVariant, lineHeight: 22 },
  choiceButton: {
    minHeight: 52,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.cyanBlock,
  },
  choiceLabel: { ...typography.buttonText, color: colors.appBackground },
  result: { ...typography.body, textAlign: "center", color: colors.onSurface },
  footer: { ...typography.labelCaps, textAlign: "center", color: colors.onSurfaceVariant },
});
