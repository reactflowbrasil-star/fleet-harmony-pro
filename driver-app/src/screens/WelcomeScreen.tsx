import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { colors, spacing, text as t } from "@/config/theme";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/Button";
import { TruckIcon } from "@/components/Icon";

const slides = [
  {
    title: "Gestão de Frota\nna palma da mão",
    body: "Acompanhe suas viagens, rotas, documentos e abastecimentos em tempo real.",
  },
  {
    title: "Rastreamento\nem tempo real",
    body: "GPS ativo durante cada viagem para o gestor acompanhar sua rota.",
  },
  {
    title: "Tudo num só lugar",
    body: "Documentos, abastecimentos, ocorrências e notificações sempre com você.",
  },
];

export function WelcomeScreen({ navigation }: any) {
  const [page, setPage] = useState(0);
  const slide = slides[page];
  const isLast = page === slides.length - 1;

  function next() {
    if (isLast) navigation.replace("Login");
    else setPage(page + 1);
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      {/* Hero — full-bleed truck silhouette over sunset gradient */}
      <View style={styles.hero}>
        <Svg style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#1A1A24" />
              <Stop offset="55%" stopColor="#FF6B1A" stopOpacity="0.55" />
              <Stop offset="100%" stopColor="#0A0A0F" />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#sky)" />
        </Svg>
        <View style={styles.truckShade}>
          <TruckIcon size={120} color={colors.foreground} strokeWidth={1.2} />
        </View>
        <View style={styles.logoSlot}>
          <Logo size={28} />
        </View>
      </View>

      {/* Card */}
      <View style={styles.card}>
        <View style={styles.dots}>
          {slides.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === page && styles.dotActive]}
            />
          ))}
        </View>

        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.body}>{slide.body}</Text>

        <Button
          label={isLast ? "Começar" : "Próximo"}
          onPress={next}
          style={{ marginTop: spacing.xl }}
        />

        {!isLast && (
          <Pressable onPress={() => navigation.replace("Login")} style={styles.skip}>
            <Text style={styles.skipText}>Pular</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  hero: {
    flex: 1.1,
    position: "relative",
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  logoSlot: {
    position: "absolute",
    top: spacing.xl,
    left: spacing.xl,
  },
  truckShade: {
    alignSelf: "center",
    opacity: 0.92,
    marginBottom: spacing.xxxl,
    transform: [{ translateY: 20 }],
  },
  card: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  dots: { flexDirection: "row", gap: 6, marginBottom: spacing.sm },
  dot: { width: 18, height: 4, borderRadius: 2, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.primary, width: 26 },
  title: {
    fontSize: t.title,
    fontWeight: "800",
    color: colors.foreground,
    letterSpacing: -0.6,
    lineHeight: 34,
  },
  body: { fontSize: t.md, color: colors.mutedForeground, lineHeight: 22 },
  skip: { alignSelf: "center", marginTop: spacing.md, padding: spacing.sm },
  skipText: { color: colors.mutedForeground, fontSize: t.sm, fontWeight: "600" },
});
