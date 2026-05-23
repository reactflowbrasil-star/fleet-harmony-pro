import { ActivityIndicator, Pressable, Text, StyleSheet, type ViewStyle } from "react-native";
import { colors, radii, spacing, text as t } from "@/config/theme";

type Variant = "primary" | "outline" | "destructive" | "ghost";

export function Button({
  label, onPress, loading, disabled, variant = "primary", style, leftIcon,
}: {
  label: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: Variant;
  style?: ViewStyle;
  leftIcon?: React.ReactNode;
}) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        variantStyles[variant].btn,
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variantStyles[variant].textColor} />
      ) : (
        <>
          {leftIcon}
          <Text style={[styles.label, { color: variantStyles[variant].textColor }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  label: { fontSize: t.md, fontWeight: "700" },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
});

const variantStyles = {
  primary: { btn: { backgroundColor: colors.primary } as ViewStyle, textColor: colors.primaryForeground },
  outline: {
    btn: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border } as ViewStyle,
    textColor: colors.foreground,
  },
  destructive: { btn: { backgroundColor: colors.destructive } as ViewStyle, textColor: "#fff" },
  ghost: { btn: { backgroundColor: "transparent" } as ViewStyle, textColor: colors.primary },
};
