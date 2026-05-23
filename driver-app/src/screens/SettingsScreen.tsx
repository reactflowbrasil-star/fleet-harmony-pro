import { Linking, StyleSheet, Switch, Text, View } from "react-native";
import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Header } from "@/components/Header";
import { Button } from "@/components/Button";
import { offlineLocationQueue } from "@/storage/offlineLocationQueue";
import { colors, radii, spacing, text as t } from "@/config/theme";

const PREF_KEY = "frotap.prefs.v1";

export function SettingsScreen() {
  const [highAccuracy, setHighAccuracy] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [queueSize, setQueueSize] = useState(0);

  useEffect(() => {
    (async () => {
      const raw = await AsyncStorage.getItem(PREF_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        setHighAccuracy(p.highAccuracy ?? true);
        setPushEnabled(p.pushEnabled ?? true);
      }
      setQueueSize(await offlineLocationQueue.size());
    })();
  }, []);

  async function save(next: Partial<{ highAccuracy: boolean; pushEnabled: boolean }>) {
    const raw = await AsyncStorage.getItem(PREF_KEY);
    const current = raw ? JSON.parse(raw) : {};
    await AsyncStorage.setItem(PREF_KEY, JSON.stringify({ ...current, ...next }));
  }

  return (
    <ScreenContainer>
      <Header title="Ajustes" />
      <View style={styles.card}>
        <Row label="Alta precisão GPS" right={<Switch value={highAccuracy} onValueChange={(v) => { setHighAccuracy(v); save({ highAccuracy: v }); }} />} />
        <Row label="Notificações push" right={<Switch value={pushEnabled} onValueChange={(v) => { setPushEnabled(v); save({ pushEnabled: v }); }} />} />
        <Row label="Pontos na fila offline" right={<Text style={styles.value}>{queueSize}</Text>} />
      </View>
      <Button label="Abrir permissões do app" variant="outline" onPress={() => Linking.openSettings()} />
      <Text style={styles.legal}>
        Sua localização é utilizada apenas durante viagens ativas, para fins de segurança e gestão operacional da frota.
        Você pode revogar a permissão a qualquer momento nas configurações do dispositivo.
      </Text>
    </ScreenContainer>
  );
}

function Row({ label, right }: { label: string; right: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: radii.lg, padding: spacing.md, gap: spacing.md },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  label: { color: colors.foreground, fontSize: t.md, fontWeight: "600" },
  value: { color: colors.foreground, fontSize: t.md, fontWeight: "700", fontVariant: ["tabular-nums"] },
  legal: { color: colors.mutedForeground, fontSize: t.xs, lineHeight: 18, marginTop: spacing.md },
});
