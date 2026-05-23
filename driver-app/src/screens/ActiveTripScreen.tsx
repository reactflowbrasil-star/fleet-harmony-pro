import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import * as KeepAwake from "expo-keep-awake";
import { useNavigation, useRoute } from "@react-navigation/native";
import { AppTopBar } from "@/components/AppTopBar";
import { api } from "@/services/api";
import { ENV } from "@/config/env";
import { finishTrip, type Trip } from "@/services/driverApi";
import { useLocationTracking } from "@/hooks/useLocationTracking";
import { colors, radii, shadow, spacing, text as t } from "@/config/theme";
import { AlertIcon, ChevronRight, FuelIcon, MoreVertIcon, StopIcon } from "@/components/Icon";

// Custom dark map style matching the mockup
const DARK_MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#1d1d24" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#9a9aa5" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0a0a0f" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#2a2a35" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#33333f" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#3a3a48" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#11111a" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

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
    KeepAwake.activateKeepAwakeAsync("frotago-trip").catch(() => {});
    return () => { KeepAwake.deactivateKeepAwake("frotago-trip").catch(() => {}); };
  }, []);

  function confirmFinish() {
    Alert.alert(
      "Finalizar viagem",
      "Deseja encerrar a viagem agora?",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Finalizar", style: "destructive", onPress: doFinish },
      ],
    );
  }

  async function doFinish() {
    if (!trip) return;
    setFinishing(true);
    try {
      await finishTrip(trip.id, null, Math.round(stats.total_distance_m) || null);
      nav.goBack();
    } catch (e: any) {
      Alert.alert("Erro", e?.message ?? "Não foi possível encerrar.");
    } finally {
      setFinishing(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <AppTopBar leftIcon="back" onLeftPress={() => nav.goBack()} rightIcon="none" />
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      </SafeAreaView>
    );
  }
  if (!trip) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <AppTopBar leftIcon="back" onLeftPress={() => nav.goBack()} rightIcon="none" />
        <View style={styles.center}><Text style={{ color: colors.foreground }}>Viagem não encontrada</Text></View>
      </SafeAreaView>
    );
  }

  const lastPoint = polyline.at(-1);
  const distanceKm = (stats.total_distance_m / 1000).toFixed(1).replace(".", ",");
  const speedKmh = stats.current_speed_kmh ?? 0;
  // elapsed time
  const startedAt = trip.start_at ? new Date(trip.start_at).getTime() : Date.now();
  const elapsedMin = Math.max(0, Math.floor((Date.now() - startedAt) / 60000));

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <AppTopBar
        leftIcon="back"
        onLeftPress={() => nav.goBack()}
        rightSlot={
          <Pressable
            hitSlop={8}
            style={styles.moreBtn}
            onPress={() => {}}
          >
            <MoreVertIcon size={20} color={colors.foreground} />
          </Pressable>
        }
      />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Viagem em Andamento</Text>
        </View>

        {/* GPS active pill */}
        <View style={styles.gpsPill}>
          <View style={styles.gpsDot} />
          <Text style={styles.gpsText}>GPS ativo</Text>
        </View>

        {/* Map card */}
        <View style={styles.mapCard}>
          <MapView
            provider={PROVIDER_GOOGLE}
            style={StyleSheet.absoluteFill}
            customMapStyle={DARK_MAP_STYLE}
            initialRegion={lastPoint ? {
              latitude: lastPoint.latitude,
              longitude: lastPoint.longitude,
              latitudeDelta: 0.02, longitudeDelta: 0.02,
            } : { latitude: -23.55, longitude: -46.63, latitudeDelta: 0.5, longitudeDelta: 0.5 }}
            showsUserLocation
            followsUserLocation
            showsCompass={false}
          >
            {polyline.length > 1 && (
              <Polyline coordinates={polyline} strokeColor={colors.primary} strokeWidth={5} />
            )}
            {lastPoint && (
              <Marker coordinate={lastPoint}>
                <View style={styles.vehicleMarker}>
                  <View style={styles.vehicleMarkerInner} />
                </View>
              </Marker>
            )}
          </MapView>
        </View>

        {/* Stats card */}
        <View style={styles.statsCard}>
          <Stat label="Velocidade" value={String(Math.round(speedKmh))} unit="km/h" />
          <View style={styles.statDivider} />
          <Stat label="Distância" value={distanceKm} unit="km" />
          <View style={styles.statDivider} />
          <Stat label="Tempo" value={String(elapsedMin)} unit="min" />
        </View>

        {/* Next waypoint */}
        <View style={styles.nextPoint}>
          <View style={{ flex: 1 }}>
            <Text style={styles.nextLabel}>Próximo ponto</Text>
            <Text style={styles.nextValue}>{trip.destination ?? "Destino"}</Text>
          </View>
          <ChevronRight size={18} color={colors.mutedForeground} />
        </View>

        {/* Action buttons */}
        <Pressable
          style={styles.btnPrimary}
          onPress={() => nav.navigate("Fuel", { tripId: trip.id })}
        >
          <View style={styles.btnLeft}>
            <FuelIcon size={20} color="#fff" />
            <Text style={styles.btnPrimaryText}>Registrar Abastecimento</Text>
          </View>
          <ChevronRight size={18} color="#fff" />
        </Pressable>

        <Pressable
          style={styles.btnDark}
          onPress={() => nav.navigate("Occurrence", { tripId: trip.id })}
        >
          <View style={styles.btnLeft}>
            <AlertIcon size={20} color={colors.foreground} />
            <Text style={styles.btnDarkText}>Registrar Ocorrência</Text>
          </View>
          <ChevronRight size={18} color={colors.mutedForeground} />
        </Pressable>

        <Pressable
          style={[styles.btnDanger, finishing && { opacity: 0.6 }]}
          disabled={finishing}
          onPress={confirmFinish}
        >
          <View style={styles.btnLeft}>
            <StopIcon size={16} color="#fff" />
            <Text style={styles.btnPrimaryText}>{finishing ? "Finalizando…" : "Finalizar Viagem"}</Text>
          </View>
        </Pressable>

        <Text style={styles.notice}>
          {stats.online ? "Rastreamento ativo · sincronizando em tempo real" : `Offline · ${stats.queued} ponto(s) na fila`}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4 }}>
        <Text style={styles.statValue}>{value}</Text>
        {unit && <Text style={styles.statUnit}>{unit}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md },

  moreBtn: {
    width: 40, height: 40, borderRadius: radii.md,
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
    alignItems: "center", justifyContent: "center",
  },

  titleRow: { alignItems: "center", marginTop: spacing.xs },
  title: { color: colors.foreground, fontSize: t.lg, fontWeight: "700", letterSpacing: -0.2 },

  gpsPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.successBg,
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.3)",
  },
  gpsDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  gpsText: { color: colors.success, fontSize: t.xs, fontWeight: "700" },

  mapCard: {
    height: 280,
    borderRadius: radii.lg,
    overflow: "hidden",
    borderWidth: 1, borderColor: colors.border,
  },
  vehicleMarker: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center",
    borderWidth: 3, borderColor: "#fff",
    ...shadow.primary,
  },
  vehicleMarkerInner: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: "#fff",
  },

  statsCard: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.md,
  },
  stat: { flex: 1, alignItems: "center", gap: 4 },
  statLabel: { color: colors.mutedForeground, fontSize: t.xs },
  statValue: { color: colors.foreground, fontSize: t.xl, fontWeight: "800", letterSpacing: -0.5 },
  statUnit: { color: colors.mutedForeground, fontSize: t.sm, fontWeight: "600" },
  statDivider: { width: 1, backgroundColor: colors.border, marginVertical: 4 },

  nextPoint: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  nextLabel: { color: colors.mutedForeground, fontSize: t.xs },
  nextValue: { color: colors.foreground, fontSize: t.md, fontWeight: "600", marginTop: 1 },

  btnLeft: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  btnPrimary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
    borderRadius: radii.lg,
    ...shadow.primary,
  },
  btnPrimaryText: { color: "#fff", fontSize: t.md, fontWeight: "700" },
  btnDark: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
    borderRadius: radii.lg,
  },
  btnDarkText: { color: colors.foreground, fontSize: t.md, fontWeight: "700" },
  btnDanger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.destructive,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
    borderRadius: radii.lg,
  },

  notice: {
    textAlign: "center",
    fontSize: t.xs,
    color: colors.subtleForeground,
    marginTop: spacing.xs,
  },
});
