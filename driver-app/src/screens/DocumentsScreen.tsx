import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { AppTopBar } from "@/components/AppTopBar";
import { Button } from "@/components/Button";
import { colors, radii, spacing, text as t } from "@/config/theme";
import {
  CameraIcon, FileIcon, HomeIcon, UploadIcon, UserIcon,
} from "@/components/Icon";

type DocStatus = "approved" | "pending" | "reviewing" | "rejected";

interface DocItem {
  id: string;
  title: string;
  icon: "user" | "file" | "home";
  uploadedAt?: string;
  status: DocStatus;
}

const statusMeta: Record<DocStatus, { label: string; color: string; bg: string }> = {
  approved:  { label: "Aprovado",  color: colors.success,     bg: colors.successBg },
  pending:   { label: "Pendente",  color: colors.destructive, bg: colors.destructiveBg },
  reviewing: { label: "Em análise", color: colors.warning,    bg: colors.warningBg },
  rejected:  { label: "Rejeitado", color: colors.destructive, bg: colors.destructiveBg },
};

// Mock until real document storage is wired
const mockDocs: DocItem[] = [
  { id: "1", title: "Foto de Perfil",        icon: "user", uploadedAt: "15/05/2025", status: "approved" },
  { id: "2", title: "CNH",                   icon: "file", uploadedAt: "12/05/2025", status: "reviewing" },
  { id: "3", title: "Comprovante de Residência", icon: "home", uploadedAt: "10/05/2025", status: "pending" },
  { id: "4", title: "RG e CPF",              icon: "file", uploadedAt: "08/05/2025", status: "approved" },
];

export function DocumentsScreen() {
  const nav = useNavigation<any>();
  const [docs] = useState<DocItem[]>(mockDocs);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <AppTopBar
        leftIcon="back"
        onLeftPress={() => nav.goBack()}
        rightIcon="bell"
        onRightPress={() => nav.navigate("Notifications")}
      />

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.pageTitle}>Meus Documentos</Text>

        <View style={styles.avatarWrap}>
          <View style={styles.avatar}>
            <UserIcon size={42} color={colors.foreground} strokeWidth={1.4} />
          </View>
          <Pressable style={styles.cameraBtn} onPress={() => Alert.alert("Em breve", "Upload de foto de perfil em breve.")}>
            <CameraIcon size={16} color="#fff" />
          </Pressable>
        </View>

        <View style={{ gap: spacing.md, marginTop: spacing.md }}>
          {docs.map((d) => (
            <DocumentRow key={d.id} doc={d} />
          ))}
        </View>

        <Button
          label="Enviar Documento"
          onPress={() => Alert.alert("Em breve", "Envio de documentos em breve.")}
          style={{ marginTop: spacing.xl }}
          leftIcon={<UploadIcon size={18} color="#fff" />}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function DocumentRow({ doc }: { doc: DocItem }) {
  const meta = statusMeta[doc.status];
  const Icon = doc.icon === "user" ? UserIcon : doc.icon === "home" ? HomeIcon : FileIcon;
  return (
    <Pressable style={styles.row} onPress={() => {}}>
      <View style={styles.docIcon}>
        <Icon size={20} color={colors.foreground} strokeWidth={1.6} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.rowTop}>
          <Text style={styles.docTitle}>{doc.title}</Text>
          <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
            <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
          </View>
        </View>
        {doc.uploadedAt && (
          <Text style={styles.docMeta}>Enviado em {doc.uploadedAt}</Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.lg },

  pageTitle: { color: colors.foreground, fontSize: t.title, fontWeight: "800", letterSpacing: -0.5, textAlign: "center", marginTop: spacing.xs },

  avatarWrap: { alignSelf: "center", position: "relative", marginTop: spacing.xs },
  avatar: {
    width: 110, height: 110, borderRadius: 55,
    backgroundColor: colors.card,
    borderWidth: 2, borderColor: colors.border,
    alignItems: "center", justifyContent: "center",
  },
  cameraBtn: {
    position: "absolute", right: 4, bottom: 4,
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center",
    borderWidth: 3, borderColor: colors.background,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  docIcon: {
    width: 44, height: 44, borderRadius: radii.md,
    backgroundColor: colors.cardElevated,
    alignItems: "center", justifyContent: "center",
  },
  rowTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  docTitle: { color: colors.foreground, fontSize: t.md, fontWeight: "600", flex: 1 },
  docMeta: { color: colors.mutedForeground, fontSize: t.xs, marginTop: 4 },

  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  statusText: { fontSize: t.xs, fontWeight: "700" },
});
