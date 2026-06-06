import { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ImageBackground, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SPACING, RADII } from "@/src/constants/theme";
import { storage } from "@/src/utils/storage";
import { api, Profile, WorkoutPlan } from "@/src/api/client";

const HERO_IMG = "https://images.pexels.com/photos/13106808/pexels-photo-13106808.jpeg";

export default function Home() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const uid = await storage.getItem("user_id", "");
    if (!uid) { router.replace("/onboarding"); return; }
    try {
      const [p, plans] = await Promise.all([api.getProfile(uid), api.listPlans(uid)]);
      setProfile(p);
      setPlan(plans[0] || null);
    } catch (err) {
      console.error("[home] Failed to load profile/plans:", err);
    }
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const today = plan?.plan?.days?.[0];

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={COLORS.primary} />}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.overline} testID="home-greeting">HELLO</Text>
            <Text style={styles.title}>{profile?.name?.toUpperCase() || "ATHLETE"}</Text>
          </View>
          <TouchableOpacity testID="home-paywall-button" onPress={() => router.push("/paywall")} style={styles.proBadge}>
            <Ionicons name="star" size={12} color={COLORS.secondary} />
            <Text style={styles.proBadgeText}>{profile?.is_pro ? "PRO" : "GO PRO"}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.metricsRow}>
          <View style={styles.metric} testID="metric-streak">
            <Text style={styles.metricLabel}>STREAK</Text>
            <Text style={styles.metricValue}>{profile?.streak ?? 0}<Text style={styles.metricUnit}> days</Text></Text>
          </View>
          <View style={styles.metric} testID="metric-level">
            <Text style={styles.metricLabel}>LEVEL</Text>
            <Text style={styles.metricValue}>{profile?.level?.[0]?.toUpperCase() + (profile?.level?.slice(1) || "")}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>TODAY'S WORKOUT</Text>
        {today ? (
          <TouchableOpacity testID="todays-workout-card" onPress={() => router.push(`/workout?day=0`)}>
            <ImageBackground source={{ uri: HERO_IMG }} style={styles.heroCard} imageStyle={{ borderRadius: RADII.xl }}>
              <View style={styles.heroOverlay}>
                <Text style={styles.heroFocus}>{today.focus?.toUpperCase()}</Text>
                <Text style={styles.heroDay}>{today.day_name}</Text>
                <Text style={styles.heroMeta}>{today.exercises?.length || 0} exercises</Text>
                <View style={styles.heroBtn}>
                  <Text style={styles.heroBtnText}>START</Text>
                  <Ionicons name="arrow-forward" size={16} color="#fff" />
                </View>
              </View>
            </ImageBackground>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity testID="home-empty-cta" style={styles.emptyCard} onPress={() => router.push("/(tabs)/scan")}>
            <Ionicons name="scan-outline" size={32} color={COLORS.primary} />
            <Text style={styles.emptyTitle}>NO PLAN YET</Text>
            <Text style={styles.emptySub}>Scan gym equipment to build your plan</Text>
            <View style={styles.emptyBtn}>
              <Text style={styles.emptyBtnText}>START SCAN</Text>
            </View>
          </TouchableOpacity>
        )}

        {plan && (
          <>
            <Text style={styles.sectionTitle}>WEEKLY SPLIT</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SPACING.sm }}>
              {plan.plan.days.map((d, i) => (
                <TouchableOpacity
                  key={d.day_index}
                  testID={`week-day-${i}`}
                  style={styles.dayCard}
                  onPress={() => router.push(`/workout?day=${i}`)}
                >
                  <Text style={styles.dayCardIdx}>D{i + 1}</Text>
                  <Text style={styles.dayCardFocus}>{d.focus?.toUpperCase()}</Text>
                  <Text style={styles.dayCardCount}>{d.exercises?.length} ex.</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: SPACING.lg },
  overline: { color: COLORS.secondary, fontSize: 11, fontWeight: "800", letterSpacing: 2 },
  title: { color: COLORS.textPrimary, fontSize: 32, fontWeight: "900", letterSpacing: -1 },
  proBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADII.pill, backgroundColor: "rgba(57,210,192,0.1)", borderWidth: 1, borderColor: "rgba(57,210,192,0.3)" },
  proBadgeText: { color: COLORS.secondary, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  metricsRow: { flexDirection: "row", gap: SPACING.sm, marginBottom: SPACING.lg },
  metric: { flex: 1, backgroundColor: COLORS.surface, padding: SPACING.md, borderRadius: RADII.lg, borderWidth: 1, borderColor: COLORS.border },
  metricLabel: { color: COLORS.secondary, fontSize: 10, fontWeight: "800", letterSpacing: 1, marginBottom: 6 },
  metricValue: { color: COLORS.textPrimary, fontSize: 24, fontWeight: "900" },
  metricUnit: { fontSize: 14, color: COLORS.textSecondary, fontWeight: "500" },
  sectionTitle: { color: COLORS.textPrimary, fontSize: 12, fontWeight: "800", letterSpacing: 2, marginTop: SPACING.md, marginBottom: SPACING.sm },
  heroCard: { height: 200, justifyContent: "flex-end", overflow: "hidden", borderRadius: RADII.xl },
  heroOverlay: { backgroundColor: "rgba(0,0,0,0.55)", padding: SPACING.lg, height: "100%", justifyContent: "flex-end", borderRadius: RADII.xl },
  heroFocus: { color: COLORS.secondary, fontSize: 11, fontWeight: "800", letterSpacing: 2 },
  heroDay: { color: "#fff", fontSize: 28, fontWeight: "900", letterSpacing: -1, marginVertical: 4 },
  heroMeta: { color: "rgba(255,255,255,0.7)", fontSize: 13, marginBottom: SPACING.sm },
  heroBtn: { flexDirection: "row", alignSelf: "flex-start", alignItems: "center", gap: 6, backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: RADII.md },
  heroBtnText: { color: "#fff", fontWeight: "800", letterSpacing: 1, fontSize: 13 },
  emptyCard: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.xl, borderRadius: RADII.xl, alignItems: "center", gap: SPACING.sm },
  emptyTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: "900", letterSpacing: 1 },
  emptySub: { color: COLORS.textSecondary, fontSize: 13, textAlign: "center" },
  emptyBtn: { marginTop: SPACING.sm, paddingHorizontal: 20, paddingVertical: 12, backgroundColor: COLORS.primary, borderRadius: RADII.md },
  emptyBtnText: { color: "#fff", fontWeight: "800", letterSpacing: 1, fontSize: 13 },
  dayCard: { width: 120, padding: SPACING.md, borderRadius: RADII.lg, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  dayCardIdx: { color: COLORS.primary, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  dayCardFocus: { color: COLORS.textPrimary, fontSize: 14, fontWeight: "800", marginVertical: 4 },
  dayCardCount: { color: COLORS.textSecondary, fontSize: 11 },
});
