import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SPACING, RADII } from "@/src/constants/theme";

export default function ExerciseDetail() {
  const router = useRouter();
  const { data } = useLocalSearchParams<{ data: string }>();
  const ex = data ? JSON.parse(data) : null;

  if (!ex) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.loading}>No exercise</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} testID="exercise-detail-back">
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerLabel}>EXERCISE</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <Ionicons name="barbell" size={64} color={COLORS.primary} />
        </View>

        <View style={styles.tagsRow}>
          <View style={styles.tag}><Text style={styles.tagText}>{ex.muscle_group?.toUpperCase()}</Text></View>
          <View style={styles.tag}><Text style={styles.tagText}>{ex.equipment_needed?.toUpperCase()}</Text></View>
        </View>

        <Text style={styles.title} testID="exercise-detail-name">{ex.name}</Text>

        <View style={styles.statsRow}>
          <View style={styles.stat}><Text style={styles.statLabel}>SETS</Text><Text style={styles.statValue}>{ex.sets}</Text></View>
          <View style={styles.stat}><Text style={styles.statLabel}>REPS</Text><Text style={styles.statValue}>{ex.reps}</Text></View>
          <View style={styles.stat}><Text style={styles.statLabel}>REST</Text><Text style={styles.statValue}>{ex.rest_seconds}s</Text></View>
        </View>

        <Text style={styles.sectionTitle}>HOW TO</Text>
        <Text style={styles.instructions} testID="exercise-detail-instructions">{ex.instructions}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  loading: { color: "#fff", padding: 32 },
  header: { flexDirection: "row", alignItems: "center", gap: SPACING.md, padding: SPACING.lg },
  headerLabel: { color: COLORS.secondary, fontSize: 11, fontWeight: "800", letterSpacing: 2 },
  scroll: { padding: SPACING.lg, paddingTop: 0, paddingBottom: SPACING.xxl },
  hero: { height: 200, borderRadius: RADII.xl, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, alignItems: "center", justifyContent: "center", marginBottom: SPACING.lg },
  tagsRow: { flexDirection: "row", gap: SPACING.sm, marginBottom: SPACING.sm },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADII.pill, backgroundColor: "rgba(57,210,192,0.1)", borderWidth: 1, borderColor: "rgba(57,210,192,0.3)" },
  tagText: { color: COLORS.secondary, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  title: { color: "#fff", fontSize: 30, fontWeight: "900", letterSpacing: -1, marginBottom: SPACING.lg },
  statsRow: { flexDirection: "row", gap: SPACING.sm, marginBottom: SPACING.lg },
  stat: { flex: 1, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADII.lg, padding: SPACING.md, alignItems: "center" },
  statLabel: { color: COLORS.secondary, fontSize: 10, fontWeight: "800", letterSpacing: 1, marginBottom: 4 },
  statValue: { color: "#fff", fontSize: 22, fontWeight: "900" },
  sectionTitle: { color: COLORS.secondary, fontSize: 11, fontWeight: "800", letterSpacing: 2, marginBottom: SPACING.sm },
  instructions: { color: COLORS.textPrimary, fontSize: 15, lineHeight: 24 },
});
