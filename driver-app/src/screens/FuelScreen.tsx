import { useState } from "react";
import { Alert } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useAuth } from "@/contexts/AuthContext";
import { fetchMe, createFuelLog } from "@/services/driverApi";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Header } from "@/components/Header";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";

export function FuelScreen() {
  const { user } = useAuth();
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const tripId: string | undefined = route.params?.tripId;
  const [station, setStation] = useState("");
  const [liters, setLiters] = useState("");
  const [ppl, setPpl] = useState("");
  const [km, setKm] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!user) return;
    const l = Number(liters); const p = Number(ppl);
    if (!l || !p) return Alert.alert("Atenção", "Informe litros e R$/litro.");
    setLoading(true);
    try {
      const me = await fetchMe(user.id);
      if (!me?.vehicle_id) { Alert.alert("Erro", "Sem veículo vinculado."); return; }
      await createFuelLog({
        company_id: me.company_id,
        vehicle_id: me.vehicle_id,
        driver_id: me.id,
        trip_id: tripId ?? null,
        station: station || null,
        liters: l,
        price_per_liter: p,
        total_value: Math.round(l * p * 100) / 100,
        current_km: km ? Number(km) : null,
        notes: notes || null,
      });
      Alert.alert("Enviado", "Abastecimento enviado para aprovação.");
      nav.goBack();
    } catch (e: any) {
      Alert.alert("Erro", e?.message ?? "Falha ao enviar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScreenContainer>
      <Header title="Abastecimento" subtitle="Registre os dados do posto" />
      <Input label="Posto" value={station} onChangeText={setStation} />
      <Input label="Litros" value={liters} onChangeText={setLiters} keyboardType="decimal-pad" />
      <Input label="R$/litro" value={ppl} onChangeText={setPpl} keyboardType="decimal-pad" />
      <Input label="Km atual" value={km} onChangeText={setKm} keyboardType="number-pad" />
      <Input label="Observações" value={notes} onChangeText={setNotes} multiline />
      <Button label="Enviar" onPress={submit} loading={loading} />
    </ScreenContainer>
  );
}
