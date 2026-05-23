import { ScreenContainer } from "@/components/ScreenContainer";
import { Header } from "@/components/Header";
import { EmptyState } from "@/components/EmptyState";

export function NotificationsScreen() {
  return (
    <ScreenContainer>
      <Header title="Notificações" />
      <EmptyState title="Sem notificações" description="Você receberá aqui novas viagens, mudanças de rota e alertas do gestor." />
    </ScreenContainer>
  );
}
