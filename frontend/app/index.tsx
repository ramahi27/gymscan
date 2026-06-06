import { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { storage } from "@/src/utils/storage";
import { authApi } from "@/src/api/auth";

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      try {
        // 1) If an auth token exists, validate it. If invalid → show login (logged-out returning user).
        const token = await authApi.getToken();
        if (token) {
          const me = await authApi.me();
          if (me) {
            router.replace("/(tabs)/home");
            return;
          }
          // Token present but invalid/expired
          router.replace("/login");
          return;
        }
        // 2) No token. Anonymous mode — keep using local profile if any, else onboard.
        const userId = await storage.getItem("user_id", "");
        if (userId) router.replace("/(tabs)/home");
        else router.replace("/onboarding");
      } catch (err) {
        console.error("[index] Auth check failed:", err);
        router.replace("/onboarding");
      }
    })();
  }, []);

  return (
    <View style={styles.container} testID="splash-screen">
      <ActivityIndicator color="#6F61EF" size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A0A0A", alignItems: "center", justifyContent: "center" },
});
