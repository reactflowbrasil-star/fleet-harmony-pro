import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useAuth } from "@/contexts/AuthContext";
import { fetchMe, type Driver } from "@/services/driverApi";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Header } from "@/components/Header";
import { Button } from "@/components/Button";
import { colors, radii, spacing, text as t } from "@/config/theme";

export function ProfileScreen() {
  const { user, logout } = useAuth();
  const [d, setD] = useState<Driver | null>(null);

  useEffect(() => { (async () => { if (user) setD(await fetchMe(user.id)); })(); }, [user?.id]);

  return (
    <ScreenContainer>
      <Header title="Perfil" />
      <View style={styles.card}>
        <Row label="Nome" value={d?.full_name ?? "—"} />
        <Row label="E-mail" value={user?.email ?? "—"} />
        <Row label="CNH" value={d?.cnh ?? "—"} />
        <Row label="Validade CNH" value={d?.cnh_expiry ? new Date(d.cnh_expiry).toLocaleDateString("pt-BR") : "—"} />
        <Row label="Telefone" value={d?.phone ?? "—"} />
      </View>
      <Button label="Sair" variant="destructive" onPress={logout} />
    </ScreenContainer>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1,
    borderRadius: radii.lg, padding: spacing.lg, gap: spacing.md,
  },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  label: { color: colors.mutedForeground, fontSize: t.xs, textTransform: "uppercase", letterSpacing: 1, fontWeight: "700" },
  value: { color: colors.foreground, fontSize: t.md, fontWeight: "600", maxWidth: "60%", textAlign: "right" },
});
