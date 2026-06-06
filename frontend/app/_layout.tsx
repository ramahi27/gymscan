import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";

// Prewarm icon fonts before any <Icon> mounts (required for Android Expo Go).
SplashScreen.preventAutoHideAsync();

type ErrorBoundaryState = { hasError: boolean; error: Error | null };

class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={errStyles.container}>
          <Text style={errStyles.title}>Something went wrong</Text>
          <Text style={errStyles.message}>{this.state.error?.message}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

const errStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A0A0A", alignItems: "center", justifyContent: "center", padding: 24 },
  title: { color: "#fff", fontSize: 18, fontWeight: "800", marginBottom: 8 },
  message: { color: "rgba(255,255,255,0.5)", fontSize: 13, textAlign: "center" },
});

export default function RootLayout() {
  const [loaded, error] = useIconFonts();

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <AppErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#0A0A0A" }}>
        <SafeAreaProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: "#0A0A0A" },
              animation: "slide_from_right",
            }}
          />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </AppErrorBoundary>
  );
}
