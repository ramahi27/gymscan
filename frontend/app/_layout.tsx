import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";

// Prewarm icon fonts before any <Icon> mounts (required for Android Expo Go).
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useIconFonts();

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
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
  );
}
