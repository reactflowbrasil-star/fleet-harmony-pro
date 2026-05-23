import { TextInput, View, Text, StyleSheet, type TextInputProps } from "react-native";
import { colors, radii, spacing, text as t } from "@/config/theme";

export function Input({
  label, error, ...props
}: TextInputProps & { label?: string; error?: string }) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        placeholderTextColor={colors.mutedForeground}
        style={[styles.input, error && styles.inputError]}
        {...props}
      />
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: t.sm,
    fontWeight: "600",
    color: colors.foreground,
    marginBottom: spacing.xs,
  },
  input: {
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    color: colors.foreground,
    fontSize: t.md,
  },
  inputError: { borderColor: colors.destructive },
  error: { fontSize: t.xs, color: colors.destructive, marginTop: spacing.xs },
});
