import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { useNavigation } from "@react-navigation/native";
import { AppTopBar } from "@/components/AppTopBar";
import { useAuth } from "@/contexts/AuthContext";
import { fetchActiveTrip, fetchMe, type Trip } from "@/services/driverApi";
import { api } from "@/services/api";
import { ENV } from "@/config/env";
import { colors, radii, spacing, text as t } from "@/config/theme";

const DARK_MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#1d1d24" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#9a9aa5" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0a0a0f" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#2a2a35" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#11111a" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

export function MapScreen() {
  const { user } = useAuth();
  const nav = useNavigation<any>();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [polyline, setPolyline] = useState<{ latitude: number; longitude: number }[]>([]);

  useEffect(() => {
    (async () => {
      if (!user) return;
      const d = await fetchMe(user.id);
      if (!d?.id) return;
      const t2 = await fetchActiveTrip(d.id);
      setTrip(t2);
      if (t2) {
        const p = await api.get<Array<{ lat: number; lng: number }>>(
          `${ENV.SUPABASE_URL}/rest/v1/gps_points`,
          { params: { trip_id: `eq.${t2.id}`, select: "lat,lng", order: "recorded_at.asc", limit: 2000 } },
        );
        setPolyline(p.data.map((x) => ({ latitude: x.lat, longitude: x.lng })));
      }
    })();
  }, [user?.id]);

  const last = polyline.at(-1);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <AppTopBar
        leftIcon="menu"
        onLeftPress={() => nav.navigate("Perfil" as never)}
        rightIcon="bell"
        onRightPress={() => nav.navigate("Notifications")}
      />

      <View style={styles.container}>
        <Text style={styles.title}>Mapa</Text>

        <View style={styles.mapCard}>
          <MapView
            provider={PROVIDER_GOOGLE}
            style={StyleSheet.absoluteFill}
            customMapStyle={DARK_MAP_STYLE}
            initialRegion={last ? {
              latitude: last.latitude,
              longitude: last.longitude,
              latitudeDelta: 0.04, longitudeDelta: 0.04,
            } : { latitude: -23.55, longitude: -46.63, latitudeDelta: 0.5, longitudeDelta: 0.5 }}
            showsUserLocation
            showsCompass={false}
          >
            {polyline.length > 1 && (
              <Polyline coordinates={polyline} strokeColor={colors.primary} strokeWidth={5} />
            )}
            {last && <Marker coordinate={last} />}
          </MapView>
        </View>

        {!trip && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Inicie uma viagem para acompanhar sua rota no mapa.</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, padding: spacing.lg, gap: spacing.md },
  title: { color: colors.foreground, fontSize: t.title, fontWeight: "800", letterSpacing: -0.5 },
  mapCard: {
    flex: 1,
    borderRadius: radii.lg,
    overflow: "hidden",
    borderWidth: 1, borderColor: colors.border,
  },
  empty: {
    position: "absolute",
    left: spacing.lg, right: spacing.lg, bottom: spacing.xl,
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  emptyText: { color: colors.mutedForeground, fontSize: t.sm, textAlign: "center" },
});
