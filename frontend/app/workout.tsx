import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SPACING, RADII } from "@/src/constants/theme";
import { storage } from "@/src/utils/storage";
import { api, Profile, WorkoutPlan } from "@/src/api/client";
import { suggestForExercise, suggestedRest } from "@/src/utils/suggestions";
import { getImageForName } from "@/src/utils/exerciseImages";

type SetLog = {
  // Suggested by app (read-only target shown above input)
  suggestedWeight: string;
  suggestedReps: string;
  // Actual values logged by user (default to suggestion but editable)
  weight: string;
  reps: string;
  done: boolean;
};

export default function Workout() {
  const { day } = useLocalSearchParams<{ day: string }>();
  const router = useRouter();
  const dayIdx = parseInt(day || "0", 10);
  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [logs, setLogs] = useState<Record<number, SetLog[]>>({});
  const [restRemaining, setRestRemaining] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const uid = await storage.getItem("user_id", "");
      if (!uid) return;
      const [plans, prof] = await Promise.all([api.listPlans(uid), api.getProfile(uid)]);
      const p = plans[0];
      setPlan(p);
      setProfile(prof);
      if (p && prof) {
        const init: Record<number, SetLog[]> = {};
        p.plan.days[dayIdx]?.exercises.forEach((ex, i) => {
          const sug = suggestForExercise(prof.level, prof.goal, ex.reps);
          init[i] = Array.from({ length: ex.sets }, () => ({
            suggestedWeight: sug.weight,
            suggestedReps: sug.reps,
            weight: sug.weight,
            reps: sug.reps,
            done: false,
          }));
        });
        setLogs(init);
      }
    })();
  }, [dayIdx]);

  useEffect(() => {
    if (restRemaining <= 0) return;
    const t = setTimeout(() => setRestRemaining(r => r - 1), 1000);
    return () => clearTimeout(t);
  }, [restRemaining]);

  if (!plan || !profile) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.loading}>Loading...</Text>
      </SafeAreaView>
    );
  }

  const dayObj = plan.plan.days[dayIdx];
  if (!dayObj) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.loading}>Day not found</Text>
      </SafeAreaView>
    );
  }

  const updateSet = (exIdx: number, setIdx: number, patch: Partial<SetLog>) => {
    setLogs(prev => {
      const arr = [...(prev[exIdx] || [])];
      arr[setIdx] = { ...arr[setIdx], ...patch };
      return { ...prev, [exIdx]: arr };
    });
  };

  const addSet = (exIdx: number) => {
    const ex = dayObj.exercises[exIdx];
    const sug = suggestForExercise(profile.level, profile.goal, ex.reps);
    setLogs(prev => {
      const arr = [...(prev[exIdx] || [])];
      arr.push({
        suggestedWeight: sug.weight,
        suggestedReps: sug.reps,
        weight: sug.weight,
        reps: sug.reps,
        done: false,
      });
      return { ...prev, [exIdx]: arr };
    });
  };

  const removeSet = (exIdx: number, setIdx: number) => {
    setLogs(prev => {
      const arr = [...(prev[exIdx] || [])];
      arr.splice(setIdx, 1);
      return { ...prev, [exIdx]: arr };
    });
  };

  const completeSet = (exIdx: number, setIdx: number) => {
    updateSet(exIdx, setIdx, { done: true });
    setRestRemaining(suggestedRest(profile.goal, dayObj.exercises[exIdx].rest_seconds || 60));
  };

  const finishWorkout = async () => {
    setSaving(true);
    try {
      const uid = await storage.getItem("user_id", "");
      if (!uid) return;
      const completed = dayObj.exercises.map((ex, i) => ({
        name: ex.name,
        sets: (logs[i] || []).map(s => ({
          suggested_weight: s.suggestedWeight,
          suggested_reps: s.suggestedReps,
          actual_weight: s.weight,
          actual_reps: s.reps,
          done: s.done,
        })),
      }));
      await api.logSession({ user_id: uid, plan_id: plan.id, day_index: dayIdx, completed_exercises: completed });
      router.replace("/(tabs)/home");
    } finally {
      setSaving(false);
    }
  };

  const totalSets = Object.values(logs).reduce((a, arr) => a + arr.length, 0);
  const doneSets = Object.values(logs).reduce((acc, arr) => acc + arr.filter(s => s.done).length, 0);
  const progress = totalSets > 0 ? doneSets / totalSets : 0;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} testID="workout-back">
          <Ionicons name="close" size={26} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: SPACING.md }}>
          <Text style={styles.overline} testID="workout-day-focus">{dayObj.focus?.toUpperCase()}</Text>
          <View style={styles.progressBar}><View style={[styles.progressFill, { width: `${progress * 100}%` }]} /></View>
        </View>
        <Text style={styles.progressText}>{doneSets}/{totalSets}</Text>
      </View>

      {restRemaining > 0 && (
        <View style={styles.restBanner} testID="rest-timer">
          <Ionicons name="time" size={18} color={COLORS.secondary} />
          <Text style={styles.restText}>REST · {restRemaining}s</Text>
          <TouchableOpacity onPress={() => setRestRemaining(0)} style={styles.skipBtn} testID="skip-rest">
            <Text style={styles.skipText}>SKIP</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{dayObj.day_name}</Text>
        <Text style={styles.suggestNote}>Weights & reps are suggestions based on your level. Edit freely.</Text>

        {dayObj.exercises.map((ex, exIdx) => (
          <View key={`${ex.name}-${exIdx}`} style={styles.exCard} testID={`workout-exercise-${exIdx}`}>
            <Image
              source={{ uri: getImageForName(`${ex.name} ${ex.muscle_group}`) }}
              style={styles.exHero}
              testID={`workout-exercise-image-${exIdx}`}
            />

            <View style={styles.exHeader}>
              <View style={{ flex: 1 }}>
                <View style={styles.tag}><Text style={styles.tagText}>{ex.muscle_group?.toUpperCase()}</Text></View>
                <Text style={styles.exName}>{ex.name}</Text>
                <Text style={styles.exMeta}>Target: {ex.sets} × {ex.reps} · {ex.equipment_needed}</Text>
              </View>
              <TouchableOpacity
                onPress={() => router.push({ pathname: "/exercise-detail", params: { data: JSON.stringify(ex) } })}
                testID={`exercise-info-${exIdx}`}
              >
                <Ionicons name="information-circle-outline" size={24} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.setsHeader}>
              <Text style={[styles.setsHeaderCell, { flex: 0.5 }]}>SET</Text>
              <Text style={styles.setsHeaderCell}>WEIGHT</Text>
              <Text style={styles.setsHeaderCell}>REPS</Text>
              <Text style={[styles.setsHeaderCell, { flex: 0.6 }]}>✓</Text>
              <Text style={[styles.setsHeaderCell, { flex: 0.4 }]} />
            </View>

            {(logs[exIdx] || []).map((s, setIdx) => (
              <View key={setIdx} style={[styles.setRow, s.done && styles.setRowDone]} testID={`set-row-${exIdx}-${setIdx}`}>
                <Text style={[styles.setIdx, { flex: 0.5 }]}>{setIdx + 1}</Text>
                <TextInput
                  testID={`weight-input-${exIdx}-${setIdx}`}
                  style={styles.setInput}
                  value={s.weight}
                  onChangeText={t => updateSet(exIdx, setIdx, { weight: t })}
                  placeholder={s.suggestedWeight || "kg"}
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  keyboardType="numeric"
                  editable={!s.done}
                />
                <TextInput
                  testID={`reps-input-${exIdx}-${setIdx}`}
                  style={styles.setInput}
                  value={s.reps}
                  onChangeText={t => updateSet(exIdx, setIdx, { reps: t })}
                  placeholder={s.suggestedReps || ex.reps}
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  editable={!s.done}
                />
                <TouchableOpacity
                  testID={`complete-set-${exIdx}-${setIdx}`}
                  style={[styles.checkBox, s.done && styles.checkBoxDone, { flex: 0.6 }]}
                  onPress={() => completeSet(exIdx, setIdx)}
                  disabled={s.done}
                >
                  <Ionicons name={s.done ? "checkmark" : "ellipse-outline"} size={20} color={s.done ? "#fff" : COLORS.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity
                  testID={`delete-set-${exIdx}-${setIdx}`}
                  style={[styles.deleteSet, { flex: 0.4 }]}
                  onPress={() => removeSet(exIdx, setIdx)}
                >
                  <Ionicons name="remove-circle-outline" size={18} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity
              testID={`add-set-${exIdx}`}
              style={styles.addSetBtn}
              onPress={() => addSet(exIdx)}
            >
              <Ionicons name="add" size={16} color={COLORS.primary} />
              <Text style={styles.addSetText}>ADD SET</Text>
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity testID="finish-workout-button" style={styles.cta} onPress={finishWorkout} disabled={saving}>
          <Text style={styles.ctaText}>{saving ? "SAVING..." : "FINISH WORKOUT"}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  loading: { color: "#fff", padding: 32 },
  header: { flexDirection: "row", alignItems: "center", padding: SPACING.lg, gap: SPACING.sm },
  overline: { color: COLORS.secondary, fontSize: 10, fontWeight: "800", letterSpacing: 2, marginBottom: 4 },
  progressBar: { height: 4, backgroundColor: COLORS.surface, borderRadius: 2 },
  progressFill: { height: 4, backgroundColor: COLORS.primary, borderRadius: 2 },
  progressText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  restBanner: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, backgroundColor: "rgba(57,210,192,0.1)", borderBottomWidth: 1, borderBottomColor: "rgba(57,210,192,0.3)" },
  restText: { color: COLORS.secondary, fontWeight: "800", letterSpacing: 1, fontSize: 13, flex: 1 },
  skipBtn: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: RADII.pill, borderWidth: 1, borderColor: COLORS.secondary },
  skipText: { color: COLORS.secondary, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  scroll: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
  title: { color: "#fff", fontSize: 28, fontWeight: "900", letterSpacing: -1 },
  suggestNote: { color: COLORS.textSecondary, fontSize: 12, marginBottom: SPACING.lg, marginTop: 4 },
  exCard: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADII.lg, marginBottom: SPACING.md, overflow: "hidden" },
  exHero: { width: "100%", height: 140, backgroundColor: COLORS.surfaceActive },
  exHeader: { flexDirection: "row", padding: SPACING.md, paddingBottom: SPACING.sm },
  tag: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADII.pill, backgroundColor: "rgba(57,210,192,0.1)", borderWidth: 1, borderColor: "rgba(57,210,192,0.3)" },
  tagText: { color: COLORS.secondary, fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  exName: { color: "#fff", fontSize: 18, fontWeight: "900", marginTop: 4 },
  exMeta: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },
  setsHeader: { flexDirection: "row", paddingVertical: 6, paddingHorizontal: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border, marginBottom: 6 },
  setsHeaderCell: { flex: 1, color: COLORS.textSecondary, fontSize: 10, fontWeight: "800", letterSpacing: 1, textAlign: "center" },
  setRow: { flexDirection: "row", alignItems: "center", paddingVertical: 6, paddingHorizontal: SPACING.md, gap: SPACING.sm },
  setRowDone: { opacity: 0.5 },
  setIdx: { color: "#fff", fontWeight: "800", textAlign: "center" },
  setInput: { flex: 1, height: 40, backgroundColor: COLORS.surfaceActive, borderRadius: RADII.sm, color: "#fff", textAlign: "center", paddingHorizontal: 4, fontSize: 14 },
  checkBox: { height: 40, alignItems: "center", justifyContent: "center", borderRadius: RADII.sm, borderWidth: 1, borderColor: COLORS.border },
  checkBoxDone: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  deleteSet: { alignItems: "center", justifyContent: "center", padding: 4 },
  addSetBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: SPACING.sm, marginBottom: SPACING.md, marginHorizontal: SPACING.md, paddingVertical: 10, borderRadius: RADII.md, borderWidth: 1, borderColor: COLORS.primary, borderStyle: "dashed", backgroundColor: "rgba(111,97,239,0.05)" },
  addSetText: { color: COLORS.primary, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  cta: { marginTop: SPACING.md, height: 56, borderRadius: RADII.md, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  ctaText: { color: "#fff", fontWeight: "900", letterSpacing: 1.5, fontSize: 14 },
});
