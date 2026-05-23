import { useState } from "react";
import { Alert, Image, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "@/contexts/AuthContext";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { colors, spacing, text as t } from "@/config/theme";

export function LoginScreen() {
  const { login } = useAuth();
  const nav = useNavigation<any>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!email.trim() || !password) return Alert.alert("Atenção", "Preencha e-mail e senha.");
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (e: any) {
      Alert.alert("Erro", e?.message ?? "Não foi possível entrar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScreenContainer>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, justifyContent: "center" }}>
        <View style={styles.brand}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>F</Text>
          </View>
          <Text style={styles.appName}>Frotap Driver</Text>
          <Text style={styles.tagline}>Sua jornada, do volante à gestão.</Text>
        </View>

        <View style={styles.form}>
          <Input
            label="E-mail"
            placeholder="motorista@empresa.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
          <Input
            label="Senha"
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
          />
          <Button label="Entrar" onPress={submit} loading={loading} />
          <Button label="Esqueci minha senha" variant="ghost" onPress={() => nav.navigate("ForgotPassword")} />
        </View>

        <Text style={styles.legal}>
          Ao continuar, você concorda com o uso da localização durante viagens ativas para fins de gestão da frota.
        </Text>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  brand: { alignItems: "center", marginBottom: spacing.xxl },
  logo: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center",
    marginBottom: spacing.md,
  },
  logoText: { color: colors.gold, fontSize: 32, fontWeight: "900" },
  appName: { fontSize: t.xxl, fontWeight: "800", color: colors.foreground, letterSpacing: -0.5 },
  tagline: { fontSize: t.sm, color: colors.mutedForeground, marginTop: 4 },
  form: { gap: spacing.xs },
  legal: { textAlign: "center", fontSize: t.xs, color: colors.mutedForeground, marginTop: spacing.xl, paddingHorizontal: spacing.lg },
});
