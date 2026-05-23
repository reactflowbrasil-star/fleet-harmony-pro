import { ScrollView, StyleSheet, View, type ViewStyle, type StyleProp } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing } from "@/config/theme";

export function ScreenContainer({
  children, scroll = true, style,
}: { children: React.ReactNode; scroll?: boolean; style?: StyleProp<ViewStyle> }) {
  const Inner = scroll ? ScrollView : View;
  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <Inner
        contentContainerStyle={scroll ? styles.scroll : undefined}
        style={!scroll ? [styles.scroll, style] : undefined}
      >
        {children}
      </Inner>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, gap: spacing.md, flexGrow: 1 },
});
