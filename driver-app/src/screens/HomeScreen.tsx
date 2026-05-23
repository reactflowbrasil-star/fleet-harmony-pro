import { useEffect, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchActiveTrip, fetchAssignedTrips, fetchMe, fetchMyVehicle, type Driver, type Trip, type Vehicle } from "@/services/driverApi";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Header } from "@/components/Header";
import { Button } from "@/components/Button";
import { TripCard } from "@/components/TripCard";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { colors, radii, spacing, text as t } from "@/config/theme";

export function HomeScreen() {
  const { user, logout } = useAuth();
  const nav = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [active, setActive] = useState<Trip | null>(null);
  const [assigned, setAssigned] = useState<Trip[]>([]);

  async function load() {
    if (!user) return;
    const d = await fetchMe(user.id);
    setDriver(d);
    if (d?.vehicle_id) setVehicle(await fetchMyVehicle(d.vehicle_id));
    if (d?.id) {
      const [a, ts] = await Promise.all([fetchActiveTrip(d.id), fetchAssignedTrips(d.id)]);
      setActive(a);
      setAssigned(ts.filter((tt) => tt.status === "scheduled"));
    }
  }

  useFocusEffect(useCallback(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [user?.id]));

  if (loading) {
    return (
      <ScreenContainer scroll={false}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll={false}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      >
        <Header
          title={`Olá, ${driver?.full_name?.split(" ")[0] ?? "motorista"}`}
          subtitle={user?.email ?? undefined}
        />

        {vehicle ? (
          <View style={styles.vehicleCard}>
            <Text style={styles.eyebrow}>Meu veículo</Text>
            <Text style={styles.plate}>{vehicle.plate}</Text>
            <Text style={styles.vehicleMeta}>{vehicle.brand} {vehicle.model} {vehicle.year ? `· ${vehicle.year}` : ""}</Text>
          </View>
        ) : (
          <EmptyState title="Sem veículo vinculado" description="Solicite ao gestor para vincular um veículo ao seu cadastro." />
        )}

        {active && (
          <View style={styles.activeBox}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={styles.eyebrow}>Viagem em andamento</Text>
              <StatusBadge label="Em andamento" tone="primary" />
            </View>
            <Text style={styles.activeRoute}>{active.origin ?? "—"} → {active.destination ?? "—"}</Text>
            <Button label="Abrir viagem ativa" onPress={() => nav.navigate("ActiveTrip", { tripId: active.id })} style={{ marginTop: spacing.md }} />
          </View>
        )}

        <Text style={styles.sectionLabel}>Viagens atribuídas</Text>
        {assigned.length === 0 ? (
          <EmptyState title="Nada agendado" description="Você não tem viagens pendentes no momento." />
        ) : (
          assigned.map((tr) => (
            <TripCard key={tr.id} trip={tr} onPress={() => nav.navigate("TripDetails", { tripId: tr.id })} />
          ))
        )}

        <View style={styles.row}>
          <Button label="Abastecimento" variant="outline" onPress={() => nav.navigate("Fuel", { tripId: active?.id })} style={{ flex: 1 }} />
          <Button label="Ocorrência" variant="outline" onPress={() => nav.navigate("Occurrence", { tripId: active?.id })} style={{ flex: 1 }} />
        </View>

        <Button label="Sair" variant="ghost" onPress={logout} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, gap: spacing.md },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  eyebrow: { fontSize: 10, fontWeight: "800", letterSpacing: 1.2, color: colors.mutedForeground, textTransform: "uppercase" },
  vehicleCard: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  plate: { fontSize: t.xxl, fontWeight: "800", color: colors.foreground, marginTop: 4, letterSpacing: -0.5 },
  vehicleMeta: { fontSize: t.sm, color: colors.mutedForeground, marginTop: 2 },
  activeBox: {
    backgroundColor: "#e6f0eb",
    borderColor: colors.primary,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
  activeRoute: { fontSize: t.lg, fontWeight: "700", color: colors.primary, marginTop: spacing.sm },
  sectionLabel: { fontSize: t.sm, fontWeight: "700", color: colors.foreground, marginTop: spacing.sm },
  row: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
});
