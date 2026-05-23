import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Linking, StyleSheet, Text, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Header } from "@/components/Header";
import { Button } from "@/components/Button";
import { StatusBadge } from "@/components/StatusBadge";
import { fetchActiveTrip, startTrip, type Trip } from "@/services/driverApi";
import { useAuth } from "@/contexts/AuthContext";
import { requestPermissions } from "@/services/locationService";
import { api } from "@/services/api";
import { ENV } from "@/config/env";
import { colors, radii, spacing, text as t } from "@/config/theme";

export function TripDetailsScreen() {
  const route = useRoute<any>();
  const nav = useNavigation<any>();
  const { user } = useAuth();
  const tripId: string = route.params?.tripId;
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get<Trip[]>(`${ENV.SUPABASE_URL}/rest/v1/trips`, {
          params: { id: `eq.${tripId}`, select: "*" },
        });
        setTrip(r.data[0] ?? null);
      } finally {
        setLoading(false);
      }
    })();
  }, [tripId]);

  async function start() {
    if (!trip || !user) return;
    const existing = await fetchActiveTrip(trip.driver_id);
    if (existing && existing.id !== trip.id) {
      Alert.alert("Atenção", "Você já tem uma viagem em andamento.");
      nav.navigate("ActiveTrip", { tripId: existing.id });
      return;
    }
    const perms = await requestPermissions();
    if (!perms.foreground) {
      Alert.alert("Permissão necessária", "Habilite a localização para iniciar a viagem.");
      return;
    }
    setStarting(true);
    try {
      const t2 = trip.status === "scheduled"
        ? await startTrip({
            company_id: trip.company_id,
            driver_id: trip.driver_id,
            vehicle_id: trip.vehicle_id,
            origin: trip.origin,
            destination: trip.destination,
            start_km: trip.start_km,
          })
        : trip;
      nav.replace("ActiveTrip", { tripId: t2.id });
    } catch (e: any) {
      Alert.alert("Erro", e?.message ?? "Não foi possível iniciar a viagem.");
    } finally {
      setStarting(false);
    }
  }

  if (loading) {
    return (
      <ScreenContainer scroll={false}>
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      </ScreenContainer>
    );
  }
  if (!trip) {
    return (
      <ScreenContainer>
        <Text style={styles.title}>Viagem não encontrada</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Header
        title={`${trip.origin || "—"} → ${trip.destination || "—"}`}
        subtitle={trip.start_at ? new Date(trip.start_at).toLocaleString("pt-BR") : undefined}
        right={<StatusBadge label={trip.status === "scheduled" ? "Agendada" : trip.status === "in_progress" ? "Em andamento" : "Concluída"} tone={trip.status === "in_progress" ? "primary" : trip.status === "completed" ? "success" : "default"} />}
      />

      <View style={styles.section}>
        <Text style={styles.label}>Origem</Text>
        <Text style={styles.value}>{trip.origin || "—"}</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.label}>Destino</Text>
        <Text style={styles.value}>{trip.destination || "—"}</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.label}>Km inicial</Text>
        <Text style={styles.value}>{trip.start_km ?? "—"}</Text>
      </View>

      {trip.destination && (
        <Button
          label="Abrir no Google Maps"
          variant="outline"
          onPress={() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(trip.destination!)}&travelmode=driving`)}
        />
      )}

      {(trip.status === "scheduled" || trip.status === "in_progress") && (
        <Button
          label={trip.status === "in_progress" ? "Abrir viagem em andamento" : "Iniciar viagem"}
          onPress={start}
          loading={starting}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { fontSize: t.xl, color: colors.foreground, textAlign: "center", marginTop: spacing.xl },
  section: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  label: { fontSize: 10, fontWeight: "800", letterSpacing: 1, color: colors.mutedForeground, textTransform: "uppercase" },
  value: { marginTop: 4, fontSize: t.md, color: colors.foreground, fontWeight: "600" },
});
