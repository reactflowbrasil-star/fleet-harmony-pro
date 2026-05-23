import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useAuth } from "@/contexts/AuthContext";
import { fetchActiveTrip, fetchAssignedTrips, fetchMe, fetchMyVehicle, type Driver, type Trip, type Vehicle } from "@/services/driverApi";
import { AppTopBar } from "@/components/AppTopBar";
import { colors, radii, shadow, spacing, text as t } from "@/config/theme";
import {
  AlertIcon, ChevronRight, FolderIcon, FuelIcon, PlayIcon, RouteIcon, TruckIcon,
} from "@/components/Icon";

export function HomeScreen() {
  const { user } = useAuth();
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
      setAssigned(ts);
    }
  }

  useFocusEffect(useCallback(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [user?.id]));

  const upcoming = active ?? assigned[0] ?? null;
  const firstName = driver?.full_name?.split(" ")[0] ?? "motorista";
  const initials = (driver?.full_name ?? "?").split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase();

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <AppTopBar
        leftIcon="menu"
        onLeftPress={() => nav.navigate("Perfil" as never)}
        rightIcon="bell"
        onRightPress={() => nav.navigate("Notifications")}
      />

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={colors.primary}
              colors={[colors.primary]}
              onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}
            />
          }
        >
          {/* Greeting */}
          <View style={styles.greeting}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials || "M"}</Text>
            </View>
            <View>
              <Text style={styles.hello}>Olá,</Text>
              <Text style={styles.userName}>{firstName} {driver?.full_name?.split(" ").slice(1, 2)[0] ?? ""}</Text>
            </View>
          </View>

          {/* My vehicle */}
          <Text style={styles.section}>Meu Veículo</Text>
          {vehicle ? (
            <Pressable style={styles.vehicleCard} onPress={() => {}}>
              <View style={styles.vehicleIcon}>
                <TruckIcon size={28} color={colors.foreground} strokeWidth={1.5} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.vehicleModel}>{vehicle.brand} {vehicle.model} {vehicle.year ? vehicle.year : ""}</Text>
                <View style={styles.plateBadge}>
                  <Text style={styles.plateText}>{vehicle.plate}</Text>
                </View>
              </View>
              <ChevronRight size={20} color={colors.mutedForeground} />
            </Pressable>
          ) : (
            <View style={[styles.vehicleCard, { justifyContent: "center" }]}>
              <Text style={styles.muted}>Nenhum veículo vinculado</Text>
            </View>
          )}

          {/* Current trip */}
          <Text style={styles.section}>Viagem Atual</Text>
          {upcoming ? (
            <Pressable
              style={styles.tripCard}
              onPress={() => upcoming === active
                ? nav.navigate("ActiveTrip", { tripId: upcoming.id })
                : nav.navigate("TripDetails", { tripId: upcoming.id })}
            >
              <TripRow color={colors.success} label="Origem" value={upcoming.origin ?? "—"} />
              <View style={styles.divider} />
              <TripRow color={colors.primary} label="Destino" value={upcoming.destination ?? "—"} />
              <View style={styles.divider} />
              <View style={styles.statusRow}>
                <View style={styles.statusDot} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.tripLabel}>Status</Text>
                  <Text style={styles.statusValue}>
                    {active ? "Em andamento" : "Aguardando início"}
                  </Text>
                </View>
                <ChevronRight size={18} color={colors.mutedForeground} />
              </View>
            </Pressable>
          ) : (
            <View style={[styles.tripCard, { alignItems: "center", paddingVertical: spacing.xl }]}>
              <RouteIcon size={32} color={colors.subtleForeground} />
              <Text style={[styles.muted, { marginTop: spacing.sm }]}>Sem viagens no momento</Text>
            </View>
          )}

          {/* Primary actions */}
          <View style={styles.actionRow}>
            <Pressable
              style={[styles.primaryAction, !upcoming && { opacity: 0.5 }]}
              disabled={!upcoming}
              onPress={() => upcoming && (active
                ? nav.navigate("ActiveTrip", { tripId: active.id })
                : nav.navigate("TripDetails", { tripId: upcoming.id }))}
            >
              <View style={styles.playCircle}>
                <PlayIcon size={20} color="#fff" />
              </View>
              <Text style={styles.primaryActionText}>
                {active ? "Continuar Viagem" : "Iniciar Viagem"}
              </Text>
            </Pressable>

            <Pressable style={styles.secondaryAction} onPress={() => nav.navigate("Viagens")}>
              <RouteIcon size={22} color={colors.foreground} />
              <Text style={styles.secondaryActionText}>Minhas{"\n"}Viagens</Text>
            </Pressable>
          </View>

          {/* Quick actions */}
          <View style={styles.quickRow}>
            <QuickAction
              icon={<FuelIcon size={22} color={colors.foreground} />}
              label="Abastecimento"
              onPress={() => nav.navigate("Fuel", { tripId: active?.id })}
            />
            <QuickAction
              icon={<AlertIcon size={22} color={colors.foreground} />}
              label="Ocorrência"
              onPress={() => nav.navigate("Occurrence", { tripId: active?.id })}
            />
            <QuickAction
              icon={<FolderIcon size={22} color={colors.foreground} />}
              label="Documentos"
              onPress={() => nav.navigate("Documentos" as never)}
            />
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function TripRow({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <View style={styles.tripRow}>
      <View style={[styles.tripBullet, { backgroundColor: color }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.tripLabel}>{label}</Text>
        <Text style={styles.tripValue} numberOfLines={1}>{value}</Text>
      </View>
    </View>
  );
}

function QuickAction({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.quick, pressed && { opacity: 0.7 }]}>
      <View style={styles.quickIcon}>{icon}</View>
      <Text style={styles.quickLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md },

  greeting: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.sm },
  avatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: colors.cardElevated,
    borderWidth: 1, borderColor: colors.border,
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { color: colors.foreground, fontSize: t.lg, fontWeight: "700" },
  hello: { color: colors.mutedForeground, fontSize: t.sm },
  userName: { color: colors.foreground, fontSize: t.lg, fontWeight: "700", letterSpacing: -0.3 },

  section: {
    color: colors.mutedForeground,
    fontSize: t.xs,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginTop: spacing.md,
    marginBottom: -spacing.sm + 2,
  },

  vehicleCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  vehicleIcon: {
    width: 56, height: 56, borderRadius: radii.md,
    backgroundColor: colors.cardElevated,
    alignItems: "center", justifyContent: "center",
  },
  vehicleModel: { color: colors.foreground, fontSize: t.md, fontWeight: "700" },
  plateBadge: {
    alignSelf: "flex-start",
    marginTop: 6,
    paddingHorizontal: 10, paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: colors.cardElevated,
    borderWidth: 1, borderColor: colors.border,
  },
  plateText: { color: colors.foreground, fontSize: t.xs, fontWeight: "700", letterSpacing: 0.8 },

  tripCard: {
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  tripRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm + 2 },
  tripBullet: { width: 10, height: 10, borderRadius: 5 },
  tripLabel: { color: colors.mutedForeground, fontSize: t.xs },
  tripValue: { color: colors.foreground, fontSize: t.md, fontWeight: "600", marginTop: 1 },
  divider: { height: 1, backgroundColor: colors.borderSubtle, marginLeft: spacing.lg + 4 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm + 2 },
  statusDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: colors.warning },
  statusValue: { color: colors.foreground, fontSize: t.md, fontWeight: "600", marginTop: 1 },

  actionRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.sm },
  primaryAction: {
    flex: 1.4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    backgroundColor: colors.primary,
    paddingVertical: spacing.lg,
    borderRadius: radii.lg,
    ...shadow.primary,
  },
  playCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center", justifyContent: "center",
  },
  primaryActionText: { color: "#fff", fontSize: t.md, fontWeight: "700", letterSpacing: -0.2 },
  secondaryAction: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs + 2,
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
  },
  secondaryActionText: { color: colors.foreground, fontSize: t.sm, fontWeight: "700", textAlign: "center", lineHeight: 17 },

  quickRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.sm },
  quick: {
    flex: 1,
    alignItems: "center",
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  quickIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.cardElevated,
    alignItems: "center", justifyContent: "center",
  },
  quickLabel: { color: colors.foreground, fontSize: t.xs, fontWeight: "600" },

  muted: { color: colors.mutedForeground, fontSize: t.sm },
});
