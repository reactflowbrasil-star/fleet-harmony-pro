import { Pressable, StyleSheet, Text, View } from "react-native";
import { BellIcon, ChevronLeft, MenuIcon } from "@/components/Icon";
import { Logo } from "@/components/Logo";
import { colors, radii, spacing } from "@/config/theme";

interface AppTopBarProps {
  leftIcon?: "menu" | "back" | "none";
  onLeftPress?: () => void;
  rightIcon?: "bell" | "more" | "none";
  onRightPress?: () => void;
  badgeCount?: number;
  rightSlot?: React.ReactNode;
}

export function AppTopBar({
  leftIcon = "menu",
  onLeftPress,
  rightIcon = "bell",
  onRightPress,
  badgeCount,
  rightSlot,
}: AppTopBarProps) {
  return (
    <View style={styles.bar}>
      <View style={styles.side}>
        {leftIcon === "menu" && (
          <IconBtn onPress={onLeftPress}><MenuIcon size={22} color={colors.foreground} /></IconBtn>
        )}
        {leftIcon === "back" && (
          <IconBtn onPress={onLeftPress}><ChevronLeft size={22} color={colors.foreground} /></IconBtn>
        )}
      </View>

      <View style={styles.center}>
        <Logo size={22} />
      </View>

      <View style={[styles.side, { alignItems: "flex-end" }]}>
        {rightSlot ?? (
          rightIcon === "bell" ? (
            <IconBtn onPress={onRightPress}>
              <BellIcon size={22} color={colors.foreground} />
              {!!badgeCount && badgeCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{badgeCount > 9 ? "9+" : badgeCount}</Text>
                </View>
              )}
            </IconBtn>
          ) : null
        )}
      </View>
    </View>
  );
}

function IconBtn({ children, onPress }: { children: React.ReactNode; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  side: { width: 44, height: 44, justifyContent: "center" },
  center: { flex: 1, alignItems: "center" },
  iconBtn: {
    width: 40, height: 40,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.background,
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
});
