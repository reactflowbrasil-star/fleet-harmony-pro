import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { LogoMark } from "@/components/Logo";
import { UserIcon } from "@/components/Icon";
import { colors, radii, spacing, text as t } from "@/config/theme";

export function LoginScreen() {
  const { login } = useAuth();
  const nav = useNavigation<any>();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!identifier.trim() || !password) return Alert.alert("Atenção", "Preencha CPF/e-mail e senha.");
    setLoading(true);
    try {
      await login(identifier.trim().toLowerCase(), password);
    } catch (e: any) {
      Alert.alert("Erro", e?.message ?? "Não foi possível entrar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <LogoMark size={56} />
            <Text style={styles.brandText}>
              Frota<Text style={styles.accent}>Go</Text>
            </Text>
          </View>

          <View style={styles.heading}>
            <Text style={styles.title}>Entrar no App</Text>
            <Text style={styles.subtitle}>Acesse sua conta para continuar</Text>
          </View>

          <View>
            <Input
              label="CPF ou E-mail"
              placeholder="Digite seu CPF ou e-mail"
              value={identifier}
              onChangeText={setIdentifier}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              leftIcon={<UserIcon size={20} color={colors.mutedForeground} />}
            />
            <Input
              label="Senha"
              placeholder="Digite sua senha"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
            />

            <Pressable onPress={() => setRemember((v) => !v)} style={styles.remember}>
              <View style={[styles.checkbox, remember && styles.checkboxOn]}>
                {remember && <View style={styles.checkboxDot} />}
              </View>
              <Text style={styles.rememberText}>Lembrar meu acesso</Text>
            </Pressable>

            <Button label="Acessar Conta" onPress={submit} loading={loading} style={{ marginTop: spacing.lg }} />

            <Pressable onPress={() => nav.navigate("ForgotPassword")} style={styles.forgot}>
              <Text style={styles.forgotText}>Esqueci minha senha</Text>
            </Pressable>
          </View>

          <Text style={styles.legal}>
            Ao continuar, você concorda com o uso da localização durante viagens ativas para fins de gestão da frota.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, padding: spacing.xl, paddingTop: spacing.xxxl, gap: spacing.xl },
  brand: { alignItems: "center", gap: spacing.md, marginBottom: spacing.lg },
  brandText: {
    fontSize: 30,
    fontWeight: "800",
    color: colors.foreground,
    letterSpacing: -0.6,
  },
  accent: { color: colors.primary },
  heading: { gap: 4 },
  title: { fontSize: t.title, fontWeight: "800", color: colors.foreground, letterSpacing: -0.5 },
  subtitle: { fontSize: t.md, color: colors.mutedForeground },
  remember: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    marginTop: -spacing.xs,
  },
  checkbox: {
    width: 20, height: 20, borderRadius: 6,
    borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: "center", justifyContent: "center",
  },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkboxDot: { width: 10, height: 10, borderRadius: 3, backgroundColor: "#fff" },
  rememberText: { color: colors.foreground, fontSize: t.sm, fontWeight: "500" },
  forgot: { alignSelf: "center", marginTop: spacing.md, padding: spacing.sm },
  forgotText: { color: colors.primary, fontSize: t.sm, fontWeight: "600", textDecorationLine: "underline" },
  legal: { textAlign: "center", fontSize: t.xs, color: colors.subtleForeground, paddingHorizontal: spacing.md, lineHeight: 16 },
});
