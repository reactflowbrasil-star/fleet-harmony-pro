import { Text, View, StyleSheet } from "react-native";
import { colors, spacing, text as t } from "@/config/theme";

export function Header({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{title}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.md },
  title: { fontSize: t.xxl, fontWeight: "800", color: colors.foreground, letterSpacing: -0.5 },
  subtitle: { fontSize: t.sm, color: colors.mutedForeground, marginTop: 2 },
});
