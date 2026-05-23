import { useState } from "react";
import { Alert, Text, StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { requestPasswordReset } from "@/services/auth";
import { colors, spacing, text as t } from "@/config/theme";

export function ForgotPasswordScreen() {
  const nav = useNavigation<any>();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!email.trim()) return Alert.alert("Atenção", "Informe seu e-mail.");
    setLoading(true);
    try {
      await requestPasswordReset(email.trim().toLowerCase());
      Alert.alert("Verifique seu e-mail", "Enviamos um link para redefinir sua senha.");
      nav.goBack();
    } catch (e: any) {
      Alert.alert("Erro", e?.message ?? "Não foi possível enviar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScreenContainer>
      <View style={{ flex: 1, justifyContent: "center" }}>
        <Text style={styles.title}>Recuperar senha</Text>
        <Text style={styles.desc}>Informe seu e-mail cadastrado. Enviaremos um link para você criar uma nova senha.</Text>
        <Input label="E-mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
        <Button label="Enviar link de recuperação" onPress={submit} loading={loading} />
        <Button label="Voltar" variant="ghost" onPress={() => nav.goBack()} />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: t.xxl, fontWeight: "800", color: colors.foreground, marginBottom: spacing.xs },
  desc: { fontSize: t.sm, color: colors.mutedForeground, marginBottom: spacing.lg },
});
