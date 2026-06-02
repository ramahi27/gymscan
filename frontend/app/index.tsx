import { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { storage } from "@/src/utils/storage";

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const userId = await storage.getItem("user_id", "");
      if (userId) {
        router.replace("/(tabs)/home");
      } else {
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
