import { Pressable, Text, View, StyleSheet } from "react-native";
import { colors, radii, spacing, text as t } from "@/config/theme";
import { StatusBadge } from "./StatusBadge";
import type { Trip } from "@/services/driverApi";

const statusLabel: Record<Trip["status"], string> = {
  scheduled: "Agendada",
  in_progress: "Em andamento",
  completed: "Concluída",
  cancelled: "Cancelada",
};
const statusTone: Record<Trip["status"], "default" | "primary" | "success" | "destructive"> = {
  scheduled: "default",
  in_progress: "primary",
  completed: "success",
  cancelled: "destructive",
};

export function TripCard({ trip, onPress }: { trip: Trip & { vehicle?: { plate?: string } | null }; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.route}>{trip.origin || "—"} → {trip.destination || "—"}</Text>
          <Text style={styles.meta}>
            {trip.vehicle?.plate ? `${trip.vehicle.plate} · ` : ""}
            {trip.start_at ? new Date(trip.start_at).toLocaleDateString("pt-BR") : "Sem data"}
          </Text>
        </View>
        <StatusBadge label={statusLabel[trip.status]} tone={statusTone[trip.status]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  row: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  route: { fontSize: t.md, fontWeight: "700", color: colors.foreground },
  meta: { marginTop: 4, fontSize: t.xs, color: colors.mutedForeground },
});
