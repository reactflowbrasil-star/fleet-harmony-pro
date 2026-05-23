import { useState } from "react";
import { Alert, View, StyleSheet, Text, Pressable } from "react-native";
import * as Location from "expo-location";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useAuth } from "@/contexts/AuthContext";
import { fetchMe, createOccurrence } from "@/services/driverApi";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Header } from "@/components/Header";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { colors, radii, spacing, text as t } from "@/config/theme";

const TYPES = [
  "Acidente", "Avaria", "Problema mecânico", "Fiscalização",
  "Atraso", "Pneu furado", "Multa recebida", "Outro",
];

export function OccurrenceScreen() {
  const { user } = useAuth();
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const tripId: string | undefined = route.params?.tripId;
  const [type, setType] = useState<string | null>(null);
  const [desc, setDesc] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!user || !type) return Alert.alert("Atenção", "Selecione o tipo.");
    setLoading(true);
    try {
      const me = await fetchMe(user.id);
      if (!me?.id) throw new Error("Motorista não encontrado");
      if (!me.vehicle_id) throw new Error("Sem veículo vinculado");
      let lat: number | null = null, lng: number | null = null;
      try {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        lat = loc.coords.latitude; lng = loc.coords.longitude;
      } catch { /* ignore */ }
      await createOccurrence({
        company_id: me.company_id,
        trip_id: tripId ?? null,
        driver_id: me.id,
        vehicle_id: me.vehicle_id,
        occurrence_type: type,
        description: desc || null,
        lat, lng,
      });
      Alert.alert("Registrado", "Ocorrência enviada ao gestor.");
      nav.goBack();
    } catch (e: any) {
      Alert.alert("Erro", e?.message ?? "Falha ao registrar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScreenContainer>
      <Header title="Ocorrência" subtitle="Selecione o tipo e descreva o ocorrido" />
      <View style={styles.grid}>
        {TYPES.map((tp) => (
          <Pressable key={tp} onPress={() => setType(tp)} style={[styles.chip, type === tp && styles.chipSel]}>
            <Text style={[styles.chipText, type === tp && styles.chipTextSel]}>{tp}</Text>
          </Pressable>
        ))}
      </View>
      <Input label="Descrição" value={desc} onChangeText={setDesc} multiline numberOfLines={4} style={{ minHeight: 100, textAlignVertical: "top" }} />
      <Button label="Registrar ocorrência" onPress={submit} loading={loading} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.md },
  chip: {
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: radii.xl, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipSel: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.foreground, fontSize: t.sm, fontWeight: "600" },
  chipTextSel: { color: colors.primaryForeground },
});
