import { useState } from "react";
import { TextInput, View, Text, StyleSheet, Pressable, type TextInputProps } from "react-native";
import { colors, radii, spacing, text as t } from "@/config/theme";
import { EyeIcon, EyeOffIcon } from "@/components/Icon";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightSlot?: React.ReactNode;
}

export function Input({
  label, error, leftIcon, rightSlot, style, secureTextEntry, ...props
}: InputProps) {
  const [hidden, setHidden] = useState(secureTextEntry);
  const isPassword = secureTextEntry;

  return (
    <View style={{ marginBottom: spacing.md }}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.wrapper, error && styles.wrapperError]}>
        {leftIcon && <View style={styles.left}>{leftIcon}</View>}
        <TextInput
          placeholderTextColor={colors.subtleForeground}
          style={[styles.input, leftIcon ? { paddingLeft: 6 } : null, (isPassword || rightSlot) ? { paddingRight: 6 } : null, style]}
          secureTextEntry={isPassword ? hidden : false}
          {...props}
        />
        {isPassword ? (
          <Pressable onPress={() => setHidden((v) => !v)} hitSlop={8} style={styles.right}>
            {hidden ? <EyeIcon size={20} color={colors.mutedForeground} /> : <EyeOffIcon size={20} color={colors.mutedForeground} />}
          </Pressable>
        ) : rightSlot ? (
          <View style={styles.right}>{rightSlot}</View>
        ) : null}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: t.sm,
    fontWeight: "600",
    color: colors.foreground,
    marginBottom: spacing.xs + 2,
  },
  wrapper: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 54,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  wrapperError: { borderColor: colors.destructive },
  left: { paddingRight: 8 },
  right: { paddingLeft: 8 },
  input: {
    flex: 1,
    color: colors.foreground,
    fontSize: t.md,
    paddingVertical: 0,
  },
  error: { fontSize: t.xs, color: colors.destructive, marginTop: spacing.xs },
});
