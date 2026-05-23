import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import * as KeepAwake from "expo-keep-awake";
import { useNavigation, useRoute } from "@react-navigation/native";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Header } from "@/components/Header";
import { Button } from "@/components/Button";
import { StatusBadge } from "@/components/StatusBadge";
import { api } from "@/services/api";
import { ENV } from "@/config/env";
import { finishTrip, type Trip } from "@/services/driverApi";
import { useLocationTracking } from "@/hooks/useLocationTracking";
import { colors, radii, spacing, text as t } from "@/config/theme";

export function ActiveTripScreen() {
  const route = useRoute<any>();
  const nav = useNavigation<any>();
  const tripId: string = route.params?.tripId;
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [polyline, setPolyline] = useState<{ latitude: number; longitude: number }[]>([]);
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get<Trip[]>(`${ENV.SUPABASE_URL}/rest/v1/trips`, { params: { id: `eq.${tripId}`, select: "*" } });
        setTrip(r.data[0] ?? null);
        const p = await api.get<Array<{ lat: number; lng: number }>>(
          `${ENV.SUPABASE_URL}/rest/v1/gps_points`,
          { params: { trip_id: `eq.${tripId}`, select: "lat,lng", order: "recorded_at.asc", limit: 2000 } },
        );
        setPolyline(p.data.map((x) => ({ latitude: x.lat, longitude: x.lng })));
      } finally {
        setLoading(false);
      }
    })();
  }, [tripId]);

  const stats = useLocationTracking(!!trip && trip.status === "in_progress", trip ? { trip_id: trip.id, company_id: trip.company_id } : null);

  useEffect(() => {
    KeepAwake.activateKeepAwakeAsync("frotap-trip").catch(() => {});
    return () => { KeepAwake.deactivateKeepAwake("frotap-trip").catch(() => {}); };
  }, []);

  async function finish() {
    if (!trip) return;
    Alert.prompt?.(
      "Finalizar viagem",
      "Km final (opcional):",
      async (val) => {
        const endKm = val ? Number(val) : null;
        setFinishing(true);
        try {
          await finishTrip(trip.id, isNaN(endKm as number) ? null : endKm, Math.round(stats.total_distance_m) || null);
          nav.goBack();
        } catch (e: any) {
          Alert.alert("Erro", e?.message ?? "Não foi possível encerrar.");
        } finally {
          setFinishing(false);
        }
      },
      "plain-text",
    ) ?? (async () => {
      setFinishing(true);
      try {
        await finishTrip(trip.id, null, Math.round(stats.total_distance_m) || null);
        nav.goBack();
      } finally { setFinishing(false); }
    })();
  }

  if (loading) {
    return (
      <ScreenContainer scroll={false}>
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      </ScreenContainer>
    );
  }
  if (!trip) {
    return <ScreenContainer><Text>Viagem não encontrada</Text></ScreenContainer>;
  }

  const lastPoint = polyline.at(-1);

  return (
    <ScreenContainer scroll={false}>
      <View style={styles.wrap}>
        <Header
          title="Em rota"
          subtitle={`${trip.origin || "—"} → ${trip.destination || "—"}`}
          right={<StatusBadge label="GPS ativo" tone="success" />}
        />

        <View style={styles.mapWrap}>
          <MapView
            provider={PROVIDER_GOOGLE}
            style={StyleSheet.absoluteFill}
            initialRegion={lastPoint ? {
              latitude: lastPoint.latitude,
              longitude: lastPoint.longitude,
              latitudeDelta: 0.02, longitudeDelta: 0.02,
            } : { latitude: -23.55, longitude: -46.63, latitudeDelta: 0.5, longitudeDelta: 0.5 }}
            showsUserLocation
            followsUserLocation
          >
            {polyline.length > 1 && (
              <Polyline coordinates={polyline} strokeColor={colors.primary} strokeWidth={4} />
            )}
            {lastPoint && <Marker coordinate={lastPoint} title={trip.origin ?? ""} />}
          </MapView>
        </View>

        <View style={styles.statsRow}>
          <Stat label="Velocidade" value={stats.current_speed_kmh != null ? `${stats.current_speed_kmh} km/h` : "—"} />
          <Stat label="Distância" value={`${(stats.total_distance_m / 1000).toFixed(2)} km`} />
          <Stat label="Precisão" value={stats.accuracy_m != null ? `±${stats.accuracy_m}m` : "—"} />
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.metaText}>{stats.online ? "Online" : `Offline · ${stats.queued} pendente(s)`}</Text>
          <Text style={styles.metaText}>Última atualização: {stats.last_fix_at ? new Date(stats.last_fix_at).toLocaleTimeString("pt-BR") : "—"}</Text>
        </View>

        <View style={styles.actions}>
          <Button label="Abastecimento" variant="outline" onPress={() => nav.navigate("Fuel", { tripId: trip.id })} style={{ flex: 1 }} />
          <Button label="Ocorrência" variant="outline" onPress={() => nav.navigate("Occurrence", { tripId: trip.id })} style={{ flex: 1 }} />
        </View>
        <Button label="Finalizar viagem" variant="destructive" onPress={finish} loading={finishing} />
        <Text style={styles.notice}>Rastreamento GPS ativo durante esta viagem.</Text>
      </View>
    </ScreenContainer>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: spacing.md, gap: spacing.md },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  mapWrap: {
    flex: 1,
    minHeight: 220,
    borderRadius: radii.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
  },
  statsRow: { flexDirection: "row", gap: spacing.sm },
  stat: {
    flex: 1, backgroundColor: colors.card, borderRadius: radii.md,
    borderWidth: 1, borderColor: colors.border, padding: spacing.sm, alignItems: "center",
  },
  statLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 1, color: colors.mutedForeground, textTransform: "uppercase" },
  statValue: { marginTop: 4, fontSize: t.lg, fontWeight: "800", color: colors.foreground },
  metaRow: { flexDirection: "row", justifyContent: "space-between" },
  metaText: { fontSize: t.xs, color: colors.mutedForeground },
  actions: { flexDirection: "row", gap: spacing.sm },
  notice: { textAlign: "center", fontSize: 10, color: colors.mutedForeground, letterSpacing: 1, textTransform: "uppercase" },
});
