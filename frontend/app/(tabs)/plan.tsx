import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SPACING, RADII } from "@/src/constants/theme";
import { storage } from "@/src/utils/storage";
import { api, WorkoutPlan } from "@/src/api/client";
import { getImageForName } from "@/src/utils/exerciseImages";

import { Image } from "expo-image";
import { useExerciseMedia } from "@/src/utils/media";

function PlanExerciseRow({ ex, i, onPress }: { ex: any; i: number; onPress: () => void }) {
  const uri = useExerciseMedia(ex.name, ex.muscle_group);
  return (
    <TouchableOpacity testID={`plan-exercise-${i}`} style={styles.exCard} onPress={onPress}>
      <Image source={{ uri }} style={styles.exImg} contentFit="cover" testID={`plan-exercise-image-${i}`} />
      <View style={{ flex: 1 }}>
        <View style={styles.tag}><Text style={styles.tagText}>{ex.muscle_group?.toUpperCase()}</Text></View>
        <Text style={styles.exName}>{ex.name}</Text>
        <Text style={styles.exMeta}>{ex.sets} × {ex.reps}  ·  {ex.rest_seconds}s rest</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
    </TouchableOpacity>
  );
}

export default function PlanScreen() {
  const router = useRouter();
  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [selectedDay, setSelectedDay] = useState(0);

  const load = useCallback(async () => {
    const uid = await storage.getItem("user_id", "");
    if (!uid) return;
    try {
      const plans = await api.listPlans(uid);
      setPlan(plans[0] || null);
      setSelectedDay(0);
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!plan) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.empty}>
          <Ionicons name="barbell-outline" size={48} color={COLORS.textSecondary} />
          <Text style={styles.emptyTitle}>NO PLAN YET</Text>
          <Text style={styles.emptySub}>Scan equipment to generate your weekly split</Text>
          <TouchableOpacity testID="plan-empty-cta" style={styles.cta} onPress={() => router.push("/(tabs)/scan")}>
            <Text style={styles.ctaText}>START SCAN</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const day = plan.plan.days[selectedDay];

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.overline} testID="plan-split-name">{plan.plan.split_name?.toUpperCase()}</Text>
        <Text style={styles.title}>WEEKLY PLAN</Text>
      </View>
      <View style={styles.chipsWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          {plan.plan.days.map((d, i) => (
            <TouchableOpacity
              key={d.day_index}
              testID={`plan-chip-${i}`}
              style={[styles.chip, selectedDay === i && styles.chipActive]}
              onPress={() => setSelectedDay(i)}
            >
              <Text style={[styles.chipText, selectedDay === i && styles.chipTextActive]}>D{i + 1} · {d.focus?.toUpperCase()}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        <Text style={styles.dayName}>{day.day_name}</Text>
        <Text style={styles.dayFocus}>{day.exercises.length} exercises</Text>
        {day.exercises.map((ex, i) => (
          <PlanExerciseRow
            key={`${ex.name}-${i}`}
            ex={ex}
            i={i}
            onPress={() => router.push({ pathname: "/exercise-detail", params: { data: JSON.stringify(ex) } })}
          />
        ))}

        <TouchableOpacity
          testID="plan-start-day-button"
          style={styles.cta}
          onPress={() => router.push(`/workout?day=${selectedDay}`)}
        >
          <Text style={styles.ctaText}>START THIS WORKOUT</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md },
  overline: { color: COLORS.secondary, fontSize: 11, fontWeight: "800", letterSpacing: 2 },
  title: { color: COLORS.textPrimary, fontSize: 32, fontWeight: "900", letterSpacing: -1 },
  chipsWrap: { height: 56, paddingVertical: SPACING.sm },
  chipsRow: { paddingHorizontal: SPACING.lg, gap: SPACING.sm, alignItems: "center" },
  chip: { height: 36, paddingHorizontal: 16, borderRadius: RADII.pill, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  chipActive: { borderColor: COLORS.primary, backgroundColor: "rgba(111,97,239,0.15)" },
  chipText: { color: COLORS.textSecondary, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  chipTextActive: { color: COLORS.primary },
  list: { padding: SPACING.lg, paddingBottom: SPACING.xxl, paddingTop: SPACING.sm },
  dayName: { color: COLORS.textPrimary, fontSize: 22, fontWeight: "900", letterSpacing: -0.5 },
  dayFocus: { color: COLORS.textSecondary, fontSize: 13, marginBottom: SPACING.md },
  exCard: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, borderRadius: RADII.lg, marginBottom: SPACING.sm, gap: SPACING.sm },
  exImg: { width: 64, height: 64, borderRadius: RADII.md, backgroundColor: COLORS.surfaceActive },
  tag: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADII.pill, backgroundColor: "rgba(57,210,192,0.1)", borderWidth: 1, borderColor: "rgba(57,210,192,0.3)", marginBottom: 6 },
  tagText: { color: COLORS.secondary, fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  exName: { color: "#fff", fontSize: 16, fontWeight: "800" },
  exMeta: { color: COLORS.textSecondary, fontSize: 12, marginTop: 4 },
  cta: { marginTop: SPACING.lg, height: 56, borderRadius: RADII.md, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  ctaText: { color: "#fff", fontWeight: "900", letterSpacing: 1.5, fontSize: 14 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: SPACING.xl, gap: SPACING.sm },
  emptyTitle: { color: "#fff", fontSize: 20, fontWeight: "900", letterSpacing: 1 },
  emptySub: { color: COLORS.textSecondary, fontSize: 13, textAlign: "center", marginBottom: SPACING.md },
});
