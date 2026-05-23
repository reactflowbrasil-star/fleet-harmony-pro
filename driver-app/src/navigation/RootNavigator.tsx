import { useEffect } from "react";
import { ActivityIndicator, View, StyleSheet } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useAuth } from "@/contexts/AuthContext";
import { colors, spacing } from "@/config/theme";

import { WelcomeScreen } from "@/screens/WelcomeScreen";
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
import { DocumentsScreen } from "@/screens/DocumentsScreen";
import { MapScreen } from "@/screens/MapScreen";

import {
  FolderIcon, HomeIcon, MapIcon, RouteIcon, UserIcon,
} from "@/components/Icon";

export type AppStackParamList = {
  Tabs: undefined;
  TripDetails: { tripId: string };
  ActiveTrip: { tripId: string };
  Fuel: { tripId?: string } | undefined;
  Occurrence: { tripId?: string } | undefined;
  Notifications: undefined;
  Settings: undefined;
};

export type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  ForgotPassword: undefined;
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>();
const Tabs = createBottomTabNavigator();

function tabIcon(name: "home" | "trips" | "map" | "docs" | "user") {
  return ({ color, size = 22 }: { color: string; size?: number }) => {
    switch (name) {
      case "home":  return <HomeIcon size={size} color={color} />;
      case "trips": return <RouteIcon size={size} color={color} />;
      case "map":   return <MapIcon size={size} color={color} />;
      case "docs":  return <FolderIcon size={size} color={color} />;
      case "user":  return <UserIcon size={size} color={color} />;
    }
  };
}

function AppTabs() {
  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.navActive,
        tabBarInactiveTintColor: colors.navInactive,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.borderSubtle,
          borderTopWidth: 1,
          height: 64 + spacing.sm,
          paddingTop: 8,
          paddingBottom: 8 + spacing.xs,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600", marginTop: 2 },
        tabBarItemStyle: { paddingTop: 4 },
      }}
    >
      <Tabs.Screen name="Início" component={HomeScreen} options={{ tabBarIcon: tabIcon("home") }} />
      <Tabs.Screen name="Viagens" component={TripsScreen} options={{ tabBarIcon: tabIcon("trips") }} />
      <Tabs.Screen name="Mapa" component={MapScreen} options={{ tabBarIcon: tabIcon("map") }} />
      <Tabs.Screen name="Documentos" component={DocumentsScreen} options={{ tabBarIcon: tabIcon("docs") }} />
      <Tabs.Screen name="Perfil" component={ProfileScreen} options={{ tabBarIcon: tabIcon("user") }} />
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
      <AuthStack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: "fade",
        }}
      >
        <AuthStack.Screen name="Welcome" component={WelcomeScreen} />
        <AuthStack.Screen name="Login" component={LoginScreen} />
        <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      </AuthStack.Navigator>
    );
  }

  return (
    <AppStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { color: colors.foreground, fontWeight: "700" },
        headerTintColor: colors.primary,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <AppStack.Screen name="Tabs" component={AppTabs} options={{ headerShown: false }} />
      <AppStack.Screen name="TripDetails" component={TripDetailsScreen} options={{ title: "Detalhes da viagem" }} />
      <AppStack.Screen name="ActiveTrip" component={ActiveTripScreen} options={{ headerShown: false }} />
      <AppStack.Screen name="Fuel" component={FuelScreen} options={{ title: "Abastecimento" }} />
      <AppStack.Screen name="Occurrence" component={OccurrenceScreen} options={{ title: "Ocorrência" }} />
      <AppStack.Screen name="Notifications" component={NotificationsScreen} options={{ title: "Notificações" }} />
      <AppStack.Screen name="Settings" component={SettingsScreen} options={{ title: "Ajustes" }} />
    </AppStack.Navigator>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
});
