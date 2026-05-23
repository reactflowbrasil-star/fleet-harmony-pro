import { Text, View, StyleSheet } from "react-native";
import { colors, radii, text as t } from "@/config/theme";

type Tone = "default" | "success" | "warning" | "destructive" | "primary";

const palette: Record<Tone, { bg: string; fg: string }> = {
  default:     { bg: colors.muted, fg: colors.mutedForeground },
  success:     { bg: "#dbeee2", fg: colors.success },
  warning:     { bg: "#fbe5c0", fg: colors.warning },
  destructive: { bg: "#fde0db", fg: colors.destructive },
  primary:     { bg: "#cfe1d6", fg: colors.primary },
};

export function StatusBadge({ label, tone = "default" }: { label: string; tone?: Tone }) {
  const c = palette[tone];
  return (
    <View style={[styles.base, { backgroundColor: c.bg }]}>
      <Text style={[styles.text, { color: c.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radii.xl, alignSelf: "flex-start" },
  text: { fontSize: t.xs, fontWeight: "700", letterSpacing: 0.4, textTransform: "uppercase" },
});
