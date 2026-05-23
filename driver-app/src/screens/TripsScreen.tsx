import { useCallback, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useAuth } from "@/contexts/AuthContext";
import { fetchAssignedTrips, fetchMe, type Trip } from "@/services/driverApi";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Header } from "@/components/Header";
import { TripCard } from "@/components/TripCard";
import { EmptyState } from "@/components/EmptyState";
import { colors, spacing } from "@/config/theme";

export function TripsScreen() {
  const { user } = useAuth();
  const nav = useNavigation<any>();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    if (!user) return;
    const me = await fetchMe(user.id);
    if (me?.id) setTrips(await fetchAssignedTrips(me.id));
  }

  useFocusEffect(useCallback(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [user?.id]));

  return (
    <ScreenContainer scroll={false}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      >
        <Header title="Viagens" subtitle={`${trips.length} viagem${trips.length === 1 ? "" : "s"}`} />
        {loading ? (
          <View style={{ alignItems: "center", paddingVertical: spacing.xxl }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : trips.length === 0 ? (
          <EmptyState title="Sem viagens" description="Você não tem viagens atribuídas ou em andamento." />
        ) : (
          trips.map((t) => (
            <TripCard key={t.id} trip={t} onPress={() => nav.navigate(t.status === "in_progress" ? "ActiveTrip" : "TripDetails", { tripId: t.id })} />
          ))
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
