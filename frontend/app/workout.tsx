import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle as SvgCircle } from "react-native-svg";
import { storage } from "@/src/utils/storage";
import { api, Profile, WorkoutPlan, Exercise } from "@/src/api/client";
import { suggestReps, suggestStartingWeightKg, suggestedRestSeconds } from "@/src/utils/suggestions";
import { displayWeight, inputWeightToKg, weightUnitLabel } from "@/src/utils/units";
import { getImageForName } from "@/src/utils/exerciseImages";

// Screen colour palette — matches the attached screenshot (light theme).
const C = {
  bg: "#FFFFFF",
  text: "#0F0F12",
  muted: "#9CA3AF",
  primary: "#2EB6F4",
  primarySoft: "#EAF7FE",
  success: "#22C55E",
  surface: "#F4F5F7",
  border: "#EEF0F3",
};

type SetLog = {
  weight: string;      // displayed unit value
  reps: string;        // single integer
  suggestedWeight: string;
  suggestedReps: string;
  done: boolean;
};

const TIMER_SIZE = 240;
const TIMER_STROKE = 8;
const TIMER_RADIUS = (TIMER_SIZE - TIMER_STROKE) / 2;
const TIMER_CIRC = 2 * Math.PI * TIMER_RADIUS;

function formatMMSS(s: number): string {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

function CircleTimer({ remaining, total, paused }: { remaining: number; total: number; paused: boolean }) {
  const progress = total > 0 ? remaining / total : 0;
  const dashOffset = TIMER_CIRC * (1 - progress);
  return (
    <View style={{ width: TIMER_SIZE, height: TIMER_SIZE, alignItems: "center", justifyContent: "center" }}>
      <Svg width={TIMER_SIZE} height={TIMER_SIZE}>
        <SvgCircle cx={TIMER_SIZE / 2} cy={TIMER_SIZE / 2} r={TIMER_RADIUS} stroke={C.surface} strokeWidth={TIMER_STROKE} fill="none" />
        <SvgCircle
          cx={TIMER_SIZE / 2}
          cy={TIMER_SIZE / 2}
          r={TIMER_RADIUS}
          stroke={C.primary}
          strokeWidth={TIMER_STROKE}
          fill="none"
          strokeDasharray={`${TIMER_CIRC} ${TIMER_CIRC}`}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${TIMER_SIZE / 2} ${TIMER_SIZE / 2})`}
        />
      </Svg>
      <View style={styles.timerCenter} pointerEvents="none">
        <Text style={styles.timerHint}>{formatMMSS(total)}</Text>
        <Text style={styles.timerBig}>{formatMMSS(remaining)}</Text>
        {paused ? <Text style={styles.timerPaused}>PAUSED</Text> : null}
      </View>
    </View>
  );
}

export default function Workout() {
  const { day } = useLocalSearchParams<{ day: string }>();
  const router = useRouter();
  const dayIdx = parseInt(day || "0", 10);

  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [exerciseIdx, setExerciseIdx] = useState(0);
  const [logs, setLogs] = useState<Record<number, SetLog[]>>({});
  const [mediaUriByIdx, setMediaUriByIdx] = useState<Record<number, string>>({});
  // Rest timer state
  const [timerTotal, setTimerTotal] = useState(90);
  const [timerRemaining, setTimerRemaining] = useState(0);
  const [timerPaused, setTimerPaused] = useState(false);
  const tickRef = useRef<any>(null);
  const [saving, setSaving] = useState(false);

  // initial load
  useEffect(() => {
    (async () => {
      const uid = await storage.getItem("user_id", "");
      if (!uid) return;
      const [plans, prof] = await Promise.all([api.listPlans(uid), api.getProfile(uid)]);
      const p = plans[0];
      if (!p || !prof) return;
      const init: Record<number, SetLog[]> = {};
      const d = p.plan.days[dayIdx];
      const pref = (prof.unit_pref || "metric") as "metric" | "imperial";
      d?.exercises.forEach((ex, i) => {
        const reps = Number.isFinite(ex.reps as any) ? Number(ex.reps) : suggestReps(prof.level, prof.goal);
        const wkg = suggestStartingWeightKg(prof.level, prof.goal, ex.equipment_needed);
        const wDisp = wkg > 0 ? String(displayWeight(wkg, pref)) : "";
        init[i] = Array.from({ length: ex.sets }, () => ({
          weight: wDisp,
          reps: String(reps),
          suggestedWeight: wDisp,
          suggestedReps: String(reps),
          done: false,
        }));
      });
      // Render immediately with fallback images, then load admin media in background.
      const fallback: Record<number, string> = {};
      (d?.exercises || []).forEach((ex, i) => {
        fallback[i] = getImageForName(`${ex.name} ${ex.muscle_group}`);
      });
      setPlan(p);
      setProfile(prof);
      setLogs(init);
      setMediaUriByIdx(fallback);

      // Background-load admin GIFs / photos and patch them in as they arrive.
      (d?.exercises || []).forEach(async (ex, i) => {
        const key = ex.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        try {
          const m = await api.getMediaByKey(key);
          setMediaUriByIdx(prev => ({ ...prev, [i]: `data:${m.content_type};base64,${m.data_base64}` }));
        } catch { /* keep fallback */ }
      });
    })();
  }, [dayIdx]);

  // timer tick
  useEffect(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    if (timerRemaining > 0 && !timerPaused) {
      tickRef.current = setInterval(() => setTimerRemaining(r => Math.max(0, r - 1)), 1000);
    }
    return () => tickRef.current && clearInterval(tickRef.current);
  }, [timerRemaining > 0, timerPaused]);

  if (!plan || !profile) {
    return (
      <SafeAreaView style={[styles.safe, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={C.primary} />
      </SafeAreaView>
    );
  }
  const dayObj = plan.plan.days[dayIdx];
  if (!dayObj) return <SafeAreaView style={styles.safe}><Text style={styles.muted}>Day not found</Text></SafeAreaView>;

  const ex: Exercise = dayObj.exercises[exerciseIdx];
  const sets = logs[exerciseIdx] || [];
  const doneCount = sets.filter(s => s.done).length;
  const totalCount = sets.length;
  const pref = (profile.unit_pref || "metric") as "metric" | "imperial";
  const unitLabel = weightUnitLabel(pref);

  const updateSet = (setIdx: number, patch: Partial<SetLog>) => {
    setLogs(prev => {
      const arr = [...(prev[exerciseIdx] || [])];
      arr[setIdx] = { ...arr[setIdx], ...patch };
      return { ...prev, [exerciseIdx]: arr };
    });
  };
  const toggleSetDone = (setIdx: number) => {
    const s = sets[setIdx];
    if (!s) return;
    updateSet(setIdx, { done: !s.done });
  };
  const addSet = () => {
    setLogs(prev => {
      const arr = [...(prev[exerciseIdx] || [])];
      const last = arr[arr.length - 1];
      arr.push({
        weight: last?.weight || "",
        reps: last?.reps || String(suggestReps(profile.level, profile.goal)),
        suggestedWeight: last?.suggestedWeight || "",
        suggestedReps: last?.suggestedReps || String(suggestReps(profile.level, profile.goal)),
        done: false,
      });
      return { ...prev, [exerciseIdx]: arr };
    });
  };
  const removeSet = (setIdx: number) => {
    setLogs(prev => {
      const arr = [...(prev[exerciseIdx] || [])];
      arr.splice(setIdx, 1);
      return { ...prev, [exerciseIdx]: arr };
    });
  };

  // "LOG SET" — mark the next undone set as done and start rest timer.
  const logNextSet = () => {
    const nextIdx = sets.findIndex(s => !s.done);
    if (nextIdx === -1) return;
    updateSet(nextIdx, { done: true });
    const restSec = suggestedRestSeconds(profile.goal, ex.rest_seconds || 90);
    setTimerTotal(restSec);
    setTimerRemaining(restSec);
    setTimerPaused(false);
  };

  const adjustTimer = (delta: number) => {
    setTimerTotal(t => Math.max(10, t + delta));
    setTimerRemaining(r => Math.max(0, r + delta));
  };
  const resetTimer = () => { setTimerRemaining(timerTotal); setTimerPaused(false); };

  const finishWorkout = async () => {
    setSaving(true);
    try {
      const uid = await storage.getItem("user_id", "");
      if (!uid) return;
      const completed = dayObj.exercises.map((exi, i) => ({
        name: exi.name,
        sets: (logs[i] || []).map(s => ({
          suggested_weight: s.suggestedWeight,
          suggested_reps: s.suggestedReps,
          actual_weight_input: s.weight,
          actual_weight_kg: s.weight ? inputWeightToKg(Number(s.weight) || 0, pref) : 0,
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

  const progressDots = dayObj.exercises.map((_, i) => i);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} testID="workout-back" style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={22} color={C.text} />
          </TouchableOpacity>
          <View style={styles.charts} testID="workout-day-focus">
            <Ionicons name="stats-chart" size={14} color={C.text} />
            <Text style={styles.chartsText}>{dayObj.focus?.toUpperCase()}</Text>
          </View>
          <TouchableOpacity testID="finish-workout-button" onPress={finishWorkout} style={styles.iconBtn} disabled={saving}>
            <Ionicons name="ellipsis-horizontal" size={22} color={C.text} />
          </TouchableOpacity>
        </View>

        {/* Hero image / GIF */}
        <Image
          source={{ uri: mediaUriByIdx[exerciseIdx] || getImageForName(`${ex.name} ${ex.muscle_group}`) }}
          style={styles.hero}
          contentFit="cover"
          testID={`workout-hero-${exerciseIdx}`}
        />

        {/* Exercise stepper dots */}
        <View style={styles.dots}>
          {progressDots.map(i => (
            <View key={i} style={[styles.dot, i === exerciseIdx && styles.dotActive, i < exerciseIdx && styles.dotDone]} />
          ))}
        </View>

        {/* Title row */}
        <View style={styles.titleRow}>
          <Text style={styles.exName} numberOfLines={2} testID="workout-exercise-name">{ex.name}</Text>
          <Text style={styles.counter} testID="workout-set-counter">{doneCount}/{totalCount}</Text>
        </View>

        {/* Set rows */}
        {sets.map((s, setIdx) => (
          <View key={setIdx} style={styles.setRow} testID={`set-row-${setIdx}`}>
            <Text style={[styles.setCell, styles.setIdx, s.done && styles.cellDone]}>{setIdx + 1}</Text>
            <TextInput
              testID={`weight-input-${setIdx}`}
              style={[styles.setInput, !s.done && styles.setInputEditable, s.done && styles.cellDone]}
              value={s.weight}
              onChangeText={t => updateSet(setIdx, { weight: t.replace(/[^0-9.]/g, "") })}
              keyboardType="numeric"
              editable={!s.done}
              placeholder="0"
              placeholderTextColor={C.muted}
            />
            <Text style={[styles.unit, s.done && styles.cellDone]}>{unitLabel}</Text>
            <TextInput
              testID={`reps-input-${setIdx}`}
              style={[styles.setInput, !s.done && styles.setInputEditable, s.done && styles.cellDone]}
              value={s.reps}
              onChangeText={t => updateSet(setIdx, { reps: t.replace(/[^0-9]/g, "") })}
              keyboardType="numeric"
              editable={!s.done}
              placeholder="0"
              placeholderTextColor={C.muted}
            />
            <Text style={[styles.unit, s.done && styles.cellDone]}>reps</Text>
            <TouchableOpacity testID={`toggle-set-${setIdx}`} style={styles.checkBtn} onPress={() => toggleSetDone(setIdx)}>
              <Ionicons name="checkmark" size={22} color={s.done ? C.success : "#D1D5DB"} />
            </TouchableOpacity>
            <TouchableOpacity testID={`remove-set-${setIdx}`} style={styles.removeBtn} onPress={() => removeSet(setIdx)}>
              <Ionicons name="close" size={16} color={C.muted} />
            </TouchableOpacity>
          </View>
        ))}

        {/* Add set + Log Set */}
        <View style={styles.actionsRow}>
          <TouchableOpacity testID="add-set-button" style={styles.addSetBtn} onPress={addSet}>
            <Ionicons name="grid" size={18} color={C.muted} />
          </TouchableOpacity>
          <View style={styles.editBubble}><Ionicons name="create-outline" size={16} color="#fff" /></View>
          <TouchableOpacity testID="log-set-button" style={styles.logSetBtn} onPress={logNextSet} disabled={doneCount >= totalCount}>
            <Text style={styles.logSetText}>LOG SET</Text>
          </TouchableOpacity>
        </View>

        {/* Rest timer */}
        <View style={styles.timerWrap}>
          <View style={styles.timerControlsRow}>
            <TouchableOpacity testID="timer-minus" onPress={() => adjustTimer(-15)} style={styles.timerSideBtn}>
              <Text style={styles.timerSideText}>- 15s</Text>
            </TouchableOpacity>
            <CircleTimer remaining={timerRemaining} total={timerTotal} paused={timerPaused} />
            <TouchableOpacity testID="timer-plus" onPress={() => adjustTimer(15)} style={styles.timerSideBtn}>
              <Text style={styles.timerSideText}>+ 15s</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.timerBottomRow}>
            <TouchableOpacity testID="timer-reset" onPress={resetTimer} style={styles.timerBottomBtn}>
              <Ionicons name="refresh" size={20} color={C.text} />
            </TouchableOpacity>
            <Text style={styles.restLabel}>Rest Timer: <Text style={styles.restLabelOn}>{timerRemaining > 0 ? (timerPaused ? "PAUSED" : "ON") : "OFF"}</Text></Text>
            <TouchableOpacity testID="timer-pause" onPress={() => setTimerPaused(p => !p)} style={styles.timerBottomBtn}>
              <Ionicons name={timerPaused ? "play" : "pause"} size={20} color={C.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Exercise navigation */}
        <View style={styles.exNav}>
          <TouchableOpacity testID="ex-prev" disabled={exerciseIdx === 0} onPress={() => setExerciseIdx(i => Math.max(0, i - 1))} style={[styles.exNavBtn, exerciseIdx === 0 && { opacity: 0.4 }]}>
            <Ionicons name="arrow-back" size={16} color={C.text} />
            <Text style={styles.exNavText}>PREV</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="ex-next" disabled={exerciseIdx >= dayObj.exercises.length - 1} onPress={() => setExerciseIdx(i => Math.min(dayObj.exercises.length - 1, i + 1))} style={[styles.exNavBtn, exerciseIdx >= dayObj.exercises.length - 1 && { opacity: 0.4 }]}>
            <Text style={styles.exNavText}>NEXT</Text>
            <Ionicons name="arrow-forward" size={16} color={C.text} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingBottom: 32 },
  muted: { color: C.muted, padding: 32 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: C.surface },
  charts: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: C.surface },
  chartsText: { color: C.text, fontWeight: "800", fontSize: 11, letterSpacing: 1 },
  hero: { width: "100%", height: 260, backgroundColor: C.surface },
  dots: { flexDirection: "row", justifyContent: "center", gap: 4, paddingVertical: 12 },
  dot: { width: 24, height: 3, borderRadius: 2, backgroundColor: C.surface },
  dotActive: { backgroundColor: C.primary },
  dotDone: { backgroundColor: "#BFEAFA" },
  titleRow: { flexDirection: "row", paddingHorizontal: 16, alignItems: "flex-end", marginBottom: 8 },
  exName: { flex: 1, color: C.text, fontSize: 22, fontWeight: "900", letterSpacing: -0.5, lineHeight: 26 },
  counter: { color: C.muted, fontSize: 14, fontWeight: "700" },
  setRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, gap: 10 },
  setCell: { color: C.text, fontSize: 22, fontWeight: "900" },
  setIdx: { width: 24, textAlign: "left" },
  cellDone: { color: C.muted },
  setInput: { width: 70, fontSize: 24, fontWeight: "900", color: C.text, paddingVertical: 4, textAlign: "left" },
  setInputEditable: { color: C.primary },
  unit: { color: C.muted, fontSize: 14, fontWeight: "600", width: 40 },
  checkBtn: { marginLeft: "auto", width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  removeBtn: { width: 24, height: 24, alignItems: "center", justifyContent: "center" },
  actionsRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16, gap: 10 },
  addSetBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: C.surface },
  editBubble: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: C.primary },
  logSetBtn: { flex: 1, height: 44, borderRadius: 22, backgroundColor: C.primary, alignItems: "center", justifyContent: "center" },
  logSetText: { color: "#fff", fontWeight: "900", letterSpacing: 1.5, fontSize: 13 },
  timerWrap: { paddingTop: 16, alignItems: "center" },
  timerControlsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%", paddingHorizontal: 16 },
  timerSideBtn: { paddingHorizontal: 8, paddingVertical: 8 },
  timerSideText: { color: C.text, fontWeight: "800", fontSize: 14 },
  timerCenter: { position: "absolute", alignItems: "center", justifyContent: "center" },
  timerHint: { color: C.muted, fontSize: 12, fontWeight: "700", marginBottom: 4 },
  timerBig: { color: C.text, fontSize: 44, fontWeight: "900", letterSpacing: -1 },
  timerPaused: { color: C.muted, fontSize: 10, fontWeight: "800", letterSpacing: 2, marginTop: 4 },
  timerBottomRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%", paddingHorizontal: 24, marginTop: 12 },
  timerBottomBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: C.surface },
  restLabel: { color: C.muted, fontSize: 12, fontWeight: "700" },
  restLabelOn: { color: C.primary, fontWeight: "900" },
  exNav: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 16 },
  exNavBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 22, backgroundColor: C.surface },
  exNavText: { color: C.text, fontWeight: "800", fontSize: 12, letterSpacing: 1 },
});
