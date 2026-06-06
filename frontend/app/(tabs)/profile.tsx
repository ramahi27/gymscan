import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SPACING, RADII } from "@/src/constants/theme";
import { storage } from "@/src/utils/storage";
import { api, Profile } from "@/src/api/client";
import { authApi, AuthUser } from "@/src/api/auth";

function SkeletonBox({ w, h, radius = 8, style }: { w?: any; h: number; radius?: number; style?: object }) {
  return <View style={[{ width: w ?? "100%", height: h, backgroundColor: COLORS.surface, borderRadius: radius }, style]} />;
}

export default function ProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sessionCount, setSessionCount] = useState(0);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Resolve auth state first (never crashes — `me()` returns null on 401/no-token)
      const me = await authApi.me();
      setAuthUser(me);
      setAuthChecked(true);

      const uid = await storage.getItem("user_id", "");
      if (!uid) return;
      try {
        const [p, s] = await Promise.all([api.getProfile(uid), api.listSessions(uid)]);
        setProfile(p);
        setSessionCount(s.length);
      } catch {}
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const logout = async () => {
    if (authUser) {
      await authApi.logout();
      router.replace("/login");
      return;
    }
    // Anonymous reset
    await storage.removeItem("user_id");
    await storage.removeItem("last_scan");
    router.replace("/onboarding");
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.overline} testID="profile-title">PROFILE</Text>

        {loading ? (
          <View style={{ marginTop: SPACING.lg }}>
            <SkeletonBox w={200} h={32} radius={6} style={{ marginBottom: SPACING.lg }} />
            <View style={{ flexDirection: "row", gap: SPACING.sm, marginBottom: SPACING.lg }}>
              <SkeletonBox w={undefined} h={64} radius={12} style={{ flex: 1 }} />
              <SkeletonBox w={undefined} h={64} radius={12} style={{ flex: 1 }} />
              <SkeletonBox w={undefined} h={64} radius={12} style={{ flex: 1 }} />
            </View>
            <SkeletonBox h={160} radius={12} style={{ marginBottom: SPACING.lg }} />
            <SkeletonBox h={52} radius={12} style={{ marginBottom: SPACING.sm }} />
          </View>
        ) : null}

        {!loading && (authChecked && !authUser && !profile ? (
          <View style={styles.emptyState} testID="profile-empty-state">
            <Ionicons name="person-circle-outline" size={64} color={COLORS.textSecondary} />
            <Text style={styles.emptyTitle}>SIGN IN TO VIEW{"\n"}YOUR PROFILE</Text>
            <Text style={styles.emptySub}>Track streaks, history, and progress across devices.</Text>
            <TouchableOpacity testID="profile-empty-signin" style={styles.emptyCta} onPress={() => router.push("/login")}>
              <Text style={styles.emptyCtaText}>SIGN IN OR CREATE ACCOUNT</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={styles.title}>{authUser?.name?.toUpperCase() || profile?.name?.toUpperCase() || "—"}</Text>

            {authUser?.is_admin && (
              <TouchableOpacity testID="profile-admin-button" style={styles.adminCard} onPress={() => router.push("/admin")}>
                <Ionicons name="shield-checkmark" size={20} color={COLORS.secondary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.adminTitle}>ADMIN · MEDIA PANEL</Text>
                  <Text style={styles.adminSub}>Upload exercise GIFs and photos</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#fff" />
              </TouchableOpacity>
            )}

            <TouchableOpacity testID="profile-edit-button" style={styles.editCard} onPress={() => router.push("/profile-edit")}>
              <Ionicons name="create-outline" size={20} color={COLORS.secondary} />
              <Text style={styles.editCardText}>EDIT PROFILE</Text>
              <Ionicons name="chevron-forward" size={20} color="#fff" />
            </TouchableOpacity>

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
          </>
        ))}
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
  emptyState: { alignItems: "center", paddingTop: SPACING.xxl, paddingHorizontal: SPACING.md, gap: SPACING.sm },
  emptyTitle: { color: "#fff", fontSize: 24, fontWeight: "900", letterSpacing: -0.5, textAlign: "center", marginTop: SPACING.md },
  emptySub: { color: COLORS.textSecondary, fontSize: 14, textAlign: "center", marginBottom: SPACING.lg },
  emptyCta: { paddingHorizontal: SPACING.lg, height: 52, borderRadius: RADII.md, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  emptyCtaText: { color: "#fff", fontWeight: "900", letterSpacing: 1.5, fontSize: 13 },
  adminCard: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, padding: SPACING.md, borderRadius: RADII.lg, borderWidth: 2, borderColor: COLORS.secondary, backgroundColor: "rgba(57,210,192,0.1)", marginBottom: SPACING.sm },
  adminTitle: { color: "#fff", fontWeight: "900", letterSpacing: 1, fontSize: 13 },
  adminSub: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },
  editCard: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, padding: SPACING.md, borderRadius: RADII.lg, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, marginBottom: SPACING.md },
  editCardText: { flex: 1, color: "#fff", fontWeight: "800", letterSpacing: 1, fontSize: 13 },
});
