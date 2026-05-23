import { Text, View, StyleSheet } from "react-native";
import { colors, radii, spacing, text as t } from "@/config/theme";

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <View style={styles.box}>
      <Text style={styles.title}>{title}</Text>
      {description && <Text style={styles.desc}>{description}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    padding: spacing.xl,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
    alignItems: "center",
    gap: spacing.xs,
  },
  title: { fontSize: t.md, fontWeight: "700", color: colors.foreground },
  desc: { fontSize: t.sm, color: colors.mutedForeground, textAlign: "center" },
});
