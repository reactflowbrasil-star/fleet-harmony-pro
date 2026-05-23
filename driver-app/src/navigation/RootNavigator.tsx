import { useEffect } from "react";
import { ActivityIndicator, View, StyleSheet } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useAuth } from "@/contexts/AuthContext";
import { colors } from "@/config/theme";

import { LoginScreen } from "@/screens/LoginScreen";
import { ForgotPasswordScreen } from "@/screens/ForgotPasswordScreen";
import { HomeScreen } from "@/screens/HomeScreen";
import { TripsScreen } from "@/screens/TripsScreen";
import { TripDetailsScreen } from "@/screens/TripDetailsScreen";
import { ActiveTripScreen } from "@/screens/ActiveTripScreen";
import { FuelScreen } from "@/screens/FuelScreen";
import { OccurrenceScreen } from "@/screens/OccurrenceScreen";
import { ProfileScreen } from "@/screens/ProfileScreen";
import { SettingsScreen } from "@/screens/SettingsScreen";
import { NotificationsScreen } from "@/screens/NotificationsScreen";

export type AppStackParamList = {
  Tabs: undefined;
  TripDetails: { tripId: string };
  ActiveTrip: { tripId: string };
  Fuel: { tripId?: string } | undefined;
  Occurrence: { tripId?: string } | undefined;
  Notifications: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  ForgotPassword: undefined;
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>();
const Tabs = createBottomTabNavigator();

function AppTabs() {
  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          height: 64,
          paddingTop: 6,
          paddingBottom: 10,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen name="Início" component={HomeScreen} />
      <Tabs.Screen name="Viagens" component={TripsScreen} />
      <Tabs.Screen name="Perfil" component={ProfileScreen} />
      <Tabs.Screen name="Ajustes" component={SettingsScreen} />
    </Tabs.Navigator>
  );
}

export function RootNavigator() {
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    // hook here later to register push token, etc.
  }, []);

  if (isLoading) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return (
      <AuthStack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <AuthStack.Screen name="Login" component={LoginScreen} />
        <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      </AuthStack.Navigator>
    );
  }

  return (
    <AppStack.Navigator screenOptions={{
      headerStyle: { backgroundColor: colors.background },
      headerTitleStyle: { color: colors.foreground, fontWeight: "700" },
      headerTintColor: colors.primary,
      contentStyle: { backgroundColor: colors.background },
    }}>
      <AppStack.Screen name="Tabs" component={AppTabs} options={{ headerShown: false }} />
      <AppStack.Screen name="TripDetails" component={TripDetailsScreen} options={{ title: "Detalhes da viagem" }} />
      <AppStack.Screen name="ActiveTrip" component={ActiveTripScreen} options={{ title: "Viagem em andamento", headerBackVisible: false }} />
      <AppStack.Screen name="Fuel" component={FuelScreen} options={{ title: "Abastecimento" }} />
      <AppStack.Screen name="Occurrence" component={OccurrenceScreen} options={{ title: "Ocorrência" }} />
      <AppStack.Screen name="Notifications" component={NotificationsScreen} options={{ title: "Notificações" }} />
    </AppStack.Navigator>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
});
