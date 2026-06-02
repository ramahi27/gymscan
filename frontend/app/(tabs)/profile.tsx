import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SPACING, RADII } from "@/src/constants/theme";
import { storage } from "@/src/utils/storage";
import { api, Profile } from "@/src/api/client";

export default function ProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sessionCount, setSessionCount] = useState(0);

  const load = useCallback(async () => {
    const uid = await storage.getItem("user_id", "");
    if (!uid) return;
    try {
      const [p, s] = await Promise.all([api.getProfile(uid), api.listSessions(uid)]);
      setProfile(p);
      setSessionCount(s.length);
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const logout = async () => {
    await storage.removeItem("user_id");
    await storage.removeItem("last_scan");
    router.replace("/onboarding");
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.overline} testID="profile-title">PROFILE</Text>
        <Text style={styles.title}>{profile?.name?.toUpperCase() || "—"}</Text>

        <View style={styles.metricsRow}>
          <View style={styles.metric}><Text style={styles.metricLabel}>STREAK</Text><Text style={styles.metricValue}>{profile?.streak ?? 0}</Text></View>
          <View style={styles.metric}><Text style={styles.metricLabel}>WORKOUTS</Text><Text style={styles.metricValue}>{sessionCount}</Text></View>
          <View style={styles.metric}><Text style={styles.metricLabel}>SCANS</Text><Text style={styles.metricValue}>{profile?.scans_used ?? 0}</Text></View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SETTINGS</Text>
          <View style={styles.row}><Text style={styles.rowLabel}>Goal</Text><Text style={styles.rowValue}>{profile?.goal?.replace("_", " ")}</Text></View>
          <View style={styles.row}><Text style={styles.rowLabel}>Level</Text><Text style={styles.rowValue}>{profile?.level}</Text></View>
          <View style={styles.row}><Text style={styles.rowLabel}>Days / week</Text><Text style={styles.rowValue}>{profile?.days_per_week}</Text></View>
          <View style={styles.row}><Text style={styles.rowLabel}>Plan</Text><Text style={[styles.rowValue, { color: profile?.is_pro ? COLORS.secondary : COLORS.textSecondary }]}>{profile?.is_pro ? "PRO" : "FREE"}</Text></View>
        </View>

        {!profile?.is_pro && (
          <TouchableOpacity testID="profile-upgrade-button" style={styles.upgradeCard} onPress={() => router.push("/paywall")}>
            <Ionicons name="star" size={20} color={COLORS.secondary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.upgradeTitle}>UPGRADE TO PRO</Text>
              <Text style={styles.upgradeSub}>Unlimited scans, history & progress tracking</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#fff" />
          </TouchableOpacity>
        )}

        {!authUser && (
          <TouchableOpacity testID="profile-signin-button" style={styles.signinCard} onPress={() => router.push("/login")}>
            <Ionicons name="log-in-outline" size={20} color={COLORS.secondary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.signinTitle}>SIGN IN OR CREATE ACCOUNT</Text>
              <Text style={styles.signinSub}>Sync plans, history & progress across devices</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#fff" />
          </TouchableOpacity>
        )}

        {authUser && (
          <View style={styles.accountRow} testID="profile-account-row">
            <Ionicons name="person-circle-outline" size={20} color={COLORS.secondary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.accountLabel}>SIGNED IN AS</Text>
              <Text style={styles.accountEmail}>{authUser.email}</Text>
            </View>
          </View>
        )}

        <TouchableOpacity testID="profile-logout" style={styles.logout} onPress={logout}>
          <Text style={styles.logoutText}>{authUser ? "SIGN OUT" : "RESET PROFILE"}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
  overline: { color: COLORS.secondary, fontSize: 11, fontWeight: "800", letterSpacing: 2 },
  title: { color: "#fff", fontSize: 32, fontWeight: "900", letterSpacing: -1, marginBottom: SPACING.lg },
  metricsRow: { flexDirection: "row", gap: SPACING.sm, marginBottom: SPACING.lg },
  metric: { flex: 1, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, borderRadius: RADII.lg, alignItems: "center" },
  metricLabel: { color: COLORS.secondary, fontSize: 10, fontWeight: "800", letterSpacing: 1, marginBottom: 4 },
  metricValue: { color: "#fff", fontSize: 22, fontWeight: "900" },
  section: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADII.lg, padding: SPACING.md, marginBottom: SPACING.lg },
  sectionTitle: { color: COLORS.secondary, fontSize: 10, fontWeight: "800", letterSpacing: 2, marginBottom: SPACING.sm },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderTopWidth: 1, borderTopColor: COLORS.border },
  rowLabel: { color: COLORS.textSecondary, fontSize: 14, textTransform: "capitalize" },
  rowValue: { color: "#fff", fontSize: 14, fontWeight: "700", textTransform: "capitalize" },
  upgradeCard: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, padding: SPACING.md, borderRadius: RADII.lg, borderWidth: 2, borderColor: COLORS.primary, backgroundColor: "rgba(111,97,239,0.1)", marginBottom: SPACING.md },
  upgradeTitle: { color: "#fff", fontWeight: "900", letterSpacing: 1, fontSize: 13 },
  upgradeSub: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },
  logout: { padding: SPACING.md, alignItems: "center" },
  logoutText: { color: COLORS.error, fontWeight: "800", letterSpacing: 1, fontSize: 13 },
  signinCard: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, padding: SPACING.md, borderRadius: RADII.lg, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, marginBottom: SPACING.md },
  signinTitle: { color: "#fff", fontWeight: "900", letterSpacing: 1, fontSize: 12 },
  signinSub: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },
  accountRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, padding: SPACING.md, borderRadius: RADII.lg, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, marginBottom: SPACING.md },
  accountLabel: { color: COLORS.secondary, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  accountEmail: { color: "#fff", fontSize: 14, fontWeight: "700", marginTop: 2 },
});
