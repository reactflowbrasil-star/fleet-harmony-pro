import { View, Text, StyleSheet, type ViewStyle } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { colors, text as t } from "@/config/theme";

/** FrotaGo brand mark — orange circular badge with stylized "F" road. */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Circle cx="32" cy="32" r="30" fill={colors.primary} />
      {/* Stylized road F */}
      <Path
        d="M20 44 L20 22 L44 22"
        stroke="#fff"
        strokeWidth={6}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Path
        d="M22 32 L36 32"
        stroke="#fff"
        strokeWidth={6}
        strokeLinecap="round"
        fill="none"
      />
      <Circle cx="48" cy="22" r="4" fill="#fff" />
    </Svg>
  );
}

/** Full logo with wordmark. */
export function Logo({ size = 28, style }: { size?: number; style?: ViewStyle }) {
  return (
    <View style={[styles.row, style]}>
      <LogoMark size={size} />
      <Text style={[styles.word, { fontSize: size * 0.72 }]}>
        Frota<Text style={styles.accent}>Go</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  word: { fontWeight: "800", color: colors.foreground, letterSpacing: -0.4 },
  accent: { color: colors.primary },
});
