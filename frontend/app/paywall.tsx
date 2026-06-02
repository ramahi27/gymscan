import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ImageBackground } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SPACING, RADII } from "@/src/constants/theme";
import { authApi, AuthUser } from "@/src/api/auth";

const FEATURES = [
  "Unlimited equipment scans",
  "Full plan history & versioning",
  "Progress tracking & analytics",
  "Custom plan editing",
  "Priority generation",
];

const BG = "https://images.pexels.com/photos/13084972/pexels-photo-13084972.jpeg";

export default function Paywall() {
  const router = useRouter();
  const [plan, setPlan] = useState<"monthly" | "yearly">("yearly");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checking, setChecking] = useState(true);

  // Require auth at the paywall moment. If not signed in, redirect to /login.
  useEffect(() => {
    (async () => {
      const u = await authApi.me();
      if (!u) {
        router.replace({ pathname: "/login", params: { redirect: "/paywall" } });
        return;
      }
      setUser(u);
      setChecking(false);
    })();
  }, []);

  if (checking) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: "#fff" }}>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ImageBackground source={{ uri: BG }} style={styles.hero} imageStyle={{ opacity: 0.5 }}>
        <View style={styles.heroOverlay}>
          <TouchableOpacity onPress={() => router.back()} testID="paywall-close" style={styles.close}>
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>
          <View style={styles.heroContent}>
            <Text style={styles.overline}>GYMSCAN</Text>
            <Text style={styles.title}>UNLOCK{"\n"}PRO</Text>
            <Text style={styles.sub}>Train smarter with unlimited AI scans, history, and custom plans.</Text>
          </View>
        </View>
      </ImageBackground>

      <ScrollView contentContainerStyle={styles.body}>
        {FEATURES.map((f, i) => (
          <View key={i} style={styles.featureRow} testID={`paywall-feature-${i}`}>
            <View style={styles.check}><Ionicons name="checkmark" size={14} color="#000" /></View>
            <Text style={styles.featureText}>{f}</Text>
          </View>
        ))}

        <View style={styles.plansRow}>
          <TouchableOpacity
            testID="paywall-plan-monthly"
            style={[styles.planCard, plan === "monthly" && styles.planCardActive]}
            onPress={() => setPlan("monthly")}
          >
            <Text style={styles.planLabel}>MONTHLY</Text>
            <Text style={styles.planPrice}>$9.99</Text>
            <Text style={styles.planNote}>/ month</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="paywall-plan-yearly"
            style={[styles.planCard, plan === "yearly" && styles.planCardActive]}
            onPress={() => setPlan("yearly")}
          >
            <View style={styles.bestBadge}><Text style={styles.bestBadgeText}>SAVE 50%</Text></View>
            <Text style={styles.planLabel}>YEARLY</Text>
            <Text style={styles.planPrice}>$59.99</Text>
            <Text style={styles.planNote}>/ year</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          testID="paywall-subscribe-button"
          style={styles.cta}
          onPress={() => router.back()}
        >
          <Text style={styles.ctaText}>START 7-DAY FREE TRIAL</Text>
        </TouchableOpacity>
        <Text style={styles.disclaimer}>Demo paywall — subscriptions not active. Cancel anytime.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  hero: { height: 280 },
  heroOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", padding: SPACING.lg, justifyContent: "space-between" },
  close: { alignSelf: "flex-end" },
  heroContent: {},
  overline: { color: COLORS.secondary, fontSize: 11, fontWeight: "800", letterSpacing: 2 },
  title: { color: "#fff", fontSize: 48, fontWeight: "900", letterSpacing: -2, marginVertical: 4 },
  sub: { color: "rgba(255,255,255,0.8)", fontSize: 14 },
  body: { padding: SPACING.lg },
  featureRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, marginBottom: SPACING.sm },
  check: { width: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.secondary, alignItems: "center", justifyContent: "center" },
  featureText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  plansRow: { flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.lg },
  planCard: { flex: 1, padding: SPACING.md, borderRadius: RADII.lg, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, position: "relative" },
  planCardActive: { borderColor: COLORS.primary, borderWidth: 2, backgroundColor: "rgba(111,97,239,0.1)" },
  planLabel: { color: COLORS.secondary, fontSize: 10, fontWeight: "800", letterSpacing: 1.5 },
  planPrice: { color: "#fff", fontSize: 26, fontWeight: "900", marginTop: 4 },
  planNote: { color: COLORS.textSecondary, fontSize: 12 },
  bestBadge: { position: "absolute", top: -10, right: 8, backgroundColor: COLORS.secondary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADII.pill },
  bestBadgeText: { color: "#000", fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  cta: { marginTop: SPACING.lg, height: 56, borderRadius: RADII.md, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  ctaText: { color: "#fff", fontWeight: "900", letterSpacing: 1.5, fontSize: 14 },
  disclaimer: { color: COLORS.textSecondary, fontSize: 11, textAlign: "center", marginTop: SPACING.sm },
});
