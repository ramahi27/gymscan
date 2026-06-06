import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SPACING, RADII } from "@/src/constants/theme";
import { storage } from "@/src/utils/storage";
import { api } from "@/src/api/client";
import { ftInToCm, lbsToKg } from "@/src/utils/units";

const GOALS = [
  { id: "muscle_gain", label: "MUSCLE GAIN", icon: "barbell-outline" },
  { id: "weight_loss", label: "WEIGHT LOSS", icon: "flame-outline" },
  { id: "endurance", label: "ENDURANCE", icon: "pulse-outline" },
];
const LEVELS = [
  { id: "beginner", label: "BEGINNER" },
  { id: "intermediate", label: "INTERMEDIATE" },
  { id: "advanced", label: "ADVANCED" },
];
const GENDERS = [
  { id: "male", label: "MALE" },
  { id: "female", label: "FEMALE" },
  { id: "unspecified", label: "PREFER NOT TO SAY" },
];

const TOTAL_STEPS = 6;

export default function Onboarding() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const isSetup = params.mode === "setup";
  const [step, setStep] = useState(isSetup ? 1 : 0);
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [level, setLevel] = useState("");
  const [days, setDays] = useState(3);
  const [gender, setGender] = useState("");
  // body metrics
  const [unitPref, setUnitPref] = useState<"metric" | "imperial">("metric");
  const [heightCm, setHeightCm] = useState("");          // metric input
  const [heightFt, setHeightFt] = useState("");          // imperial inputs
  const [heightIn, setHeightIn] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [weightLbs, setWeightLbs] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const canNext = () => {
    if (step === 0) return name.trim().length > 0;
    if (step === 1) return !!goal;
    if (step === 2) return !!level;
    if (step === 3) return true; // days
    if (step === 4) return !!gender;
    if (step === 5) {
      if (unitPref === "metric") return !!heightCm && !!weightKg;
      return !!heightFt && !!weightLbs;
    }
    return true;
  };

  const finish = async () => {
    setLoading(true);
    try {
      const h_cm = unitPref === "metric"
        ? Number(heightCm) || null
        : (heightFt ? ftInToCm(Number(heightFt) || 0, Number(heightIn) || 0) : null);
      const w_kg = unitPref === "metric"
        ? Number(weightKg) || null
        : (weightLbs ? lbsToKg(Number(weightLbs) || 0) : null);

      if (isSetup) {
        const uid = await storage.getItem("user_id", "");
        await api.updateProfile(uid, {
          goal, level, days_per_week: days,
          gender, unit_pref: unitPref,
          height_cm: h_cm, weight_kg: w_kg,
        });
      } else {
        const p = await api.createProfile({
          name: name.trim(), goal, level, days_per_week: days,
          gender, unit_pref: unitPref,
          height_cm: h_cm, weight_kg: w_kg,
        });
        await storage.setItem("user_id", p.id);
      }
      router.replace("/(tabs)/home");
    } catch (err: any) {
      setError(err?.message || "Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  const next = () => {
    if (step < TOTAL_STEPS - 1) { setStep(step + 1); return; }
    finish();
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Text style={styles.overline} testID="onboarding-step">STEP {step + 1} / {TOTAL_STEPS}</Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${((step + 1) / TOTAL_STEPS) * 100}%` }]} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {step === 0 && (
          <>
            <Text style={styles.h1}>WHAT'S YOUR{"\n"}NAME?</Text>
            <Text style={styles.sub}>Let's personalise your journey.</Text>
            <TextInput testID="name-input" style={styles.input} value={name} onChangeText={setName}
              placeholder="Your name" placeholderTextColor="rgba(255,255,255,0.3)" autoFocus />
          </>
        )}
        {step === 1 && (
          <>
            <Text style={styles.h1}>DEFINE{"\n"}YOUR GOAL</Text>
            <Text style={styles.sub}>What's your primary focus?</Text>
            {GOALS.map(g => (
              <TouchableOpacity key={g.id} testID={`goal-${g.id}`}
                style={[styles.card, goal === g.id && styles.cardActive]} onPress={() => setGoal(g.id)}>
                <Ionicons name={g.icon as any} size={28} color={goal === g.id ? COLORS.primary : COLORS.textPrimary} />
                <Text style={styles.cardLabel}>{g.label}</Text>
              </TouchableOpacity>
            ))}
          </>
        )}
        {step === 2 && (
          <>
            <Text style={styles.h1}>YOUR{"\n"}LEVEL</Text>
            <Text style={styles.sub}>How experienced are you?</Text>
            {LEVELS.map(l => (
              <TouchableOpacity key={l.id} testID={`level-${l.id}`}
                style={[styles.card, level === l.id && styles.cardActive]} onPress={() => setLevel(l.id)}>
                <Text style={styles.cardLabel}>{l.label}</Text>
              </TouchableOpacity>
            ))}
          </>
        )}
        {step === 3 && (
          <>
            <Text style={styles.h1}>DAYS PER{"\n"}WEEK</Text>
            <Text style={styles.sub}>How often can you train?</Text>
            <View style={styles.daysRow}>
              {[2, 3, 4, 5, 6].map(d => (
                <TouchableOpacity key={d} testID={`days-${d}`}
                  style={[styles.dayPill, days === d && styles.dayPillActive]} onPress={() => setDays(d)}>
                  <Text style={[styles.dayText, days === d && styles.dayTextActive]}>{d}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
        {step === 4 && (
          <>
            <Text style={styles.h1}>GENDER</Text>
            <Text style={styles.sub}>Helps tailor your starting suggestions.</Text>
            {GENDERS.map(g => (
              <TouchableOpacity key={g.id} testID={`gender-${g.id}`}
                style={[styles.card, gender === g.id && styles.cardActive]} onPress={() => setGender(g.id)}>
                <Text style={styles.cardLabel}>{g.label}</Text>
              </TouchableOpacity>
            ))}
          </>
        )}
        {step === 5 && (
          <>
            <Text style={styles.h1}>HEIGHT &{"\n"}WEIGHT</Text>
            <Text style={styles.sub}>Used to tune your plan & suggested loads.</Text>

            <View style={styles.unitToggle}>
              {(["metric", "imperial"] as const).map(u => (
                <TouchableOpacity key={u} testID={`unit-${u}`}
                  style={[styles.unitBtn, unitPref === u && styles.unitBtnActive]}
                  onPress={() => setUnitPref(u)}>
                  <Text style={[styles.unitBtnText, unitPref === u && styles.unitBtnTextActive]}>
                    {u === "metric" ? "METRIC (cm / kg)" : "IMPERIAL (ft / lbs)"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {unitPref === "metric" ? (
              <>
                <Text style={styles.fieldLabel}>HEIGHT (cm)</Text>
                <TextInput testID="height-cm-input" style={styles.input} value={heightCm} onChangeText={setHeightCm}
                  placeholder="e.g. 175" placeholderTextColor="rgba(255,255,255,0.3)" keyboardType="numeric" />
                <Text style={styles.fieldLabel}>WEIGHT (kg)</Text>
                <TextInput testID="weight-kg-input" style={styles.input} value={weightKg} onChangeText={setWeightKg}
                  placeholder="e.g. 70" placeholderTextColor="rgba(255,255,255,0.3)" keyboardType="numeric" />
              </>
            ) : (
              <>
                <Text style={styles.fieldLabel}>HEIGHT (ft / in)</Text>
                <View style={{ flexDirection: "row", gap: SPACING.sm }}>
                  <TextInput testID="height-ft-input" style={[styles.input, { flex: 1 }]} value={heightFt} onChangeText={setHeightFt}
                    placeholder="ft" placeholderTextColor="rgba(255,255,255,0.3)" keyboardType="numeric" />
                  <TextInput testID="height-in-input" style={[styles.input, { flex: 1 }]} value={heightIn} onChangeText={setHeightIn}
                    placeholder="in" placeholderTextColor="rgba(255,255,255,0.3)" keyboardType="numeric" />
                </View>
                <Text style={styles.fieldLabel}>WEIGHT (lbs)</Text>
                <TextInput testID="weight-lbs-input" style={styles.input} value={weightLbs} onChangeText={setWeightLbs}
                  placeholder="e.g. 160" placeholderTextColor="rgba(255,255,255,0.3)" keyboardType="numeric" />
              </>
            )}
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {error ? <Text style={styles.errorText} testID="onboarding-error">{error}</Text> : null}
        <View style={styles.footerBtns}>
          {step > 0 && (
            <TouchableOpacity testID="back-button" style={styles.backBtn} onPress={() => setStep(step - 1)}>
              <Ionicons name="arrow-back" size={20} color={COLORS.textPrimary} />
            </TouchableOpacity>
          )}
          <TouchableOpacity testID="onboarding-next-button" style={[styles.cta, !canNext() && styles.ctaDisabled]}
            disabled={!canNext() || loading} onPress={next}>
            <Text style={styles.ctaText}>{loading ? "CREATING..." : step === TOTAL_STEPS - 1 ? "FINISH" : "CONTINUE"}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md },
  overline: { color: COLORS.secondary, fontSize: 11, fontWeight: "800", letterSpacing: 2, marginBottom: SPACING.sm },
  progressBar: { height: 3, backgroundColor: COLORS.surface, borderRadius: 2 },
  progressFill: { height: 3, backgroundColor: COLORS.primary, borderRadius: 2 },
  body: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
  h1: { color: COLORS.textPrimary, fontSize: 40, fontWeight: "900", letterSpacing: -1, marginTop: SPACING.lg, marginBottom: SPACING.sm },
  sub: { color: COLORS.textSecondary, fontSize: 15, marginBottom: SPACING.xl },
  fieldLabel: { color: COLORS.secondary, fontSize: 10, fontWeight: "800", letterSpacing: 1.5, marginBottom: 6, marginTop: SPACING.sm },
  input: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, color: COLORS.textPrimary, padding: SPACING.md, borderRadius: RADII.md, fontSize: 16, height: 56, marginBottom: SPACING.sm },
  card: { flexDirection: "row", alignItems: "center", gap: SPACING.md, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, borderRadius: RADII.md, marginBottom: SPACING.sm },
  cardActive: { borderColor: COLORS.primary, backgroundColor: COLORS.surfaceActive },
  cardLabel: { color: COLORS.textPrimary, fontSize: 16, fontWeight: "700", letterSpacing: 1 },
  daysRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  dayPill: { width: 64, height: 64, borderRadius: RADII.md, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, alignItems: "center", justifyContent: "center" },
  dayPillActive: { borderColor: COLORS.primary, backgroundColor: COLORS.surfaceActive },
  dayText: { color: COLORS.textPrimary, fontSize: 22, fontWeight: "800" },
  dayTextActive: { color: COLORS.primary },
  unitToggle: { flexDirection: "row", backgroundColor: COLORS.surface, borderRadius: RADII.md, padding: 4, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
  unitBtn: { flex: 1, height: 44, alignItems: "center", justifyContent: "center", borderRadius: RADII.sm },
  unitBtnActive: { backgroundColor: COLORS.primary },
  unitBtnText: { color: COLORS.textSecondary, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  unitBtnTextActive: { color: "#fff" },
  footer: { padding: SPACING.lg },
  footerBtns: { flexDirection: "row", gap: SPACING.sm },
  errorText: { color: COLORS.error, fontSize: 13, marginBottom: SPACING.sm },
  backBtn: { width: 56, height: 56, borderRadius: RADII.md, borderWidth: 1, borderColor: COLORS.border, alignItems: "center", justifyContent: "center" },
  cta: { flex: 1, height: 56, borderRadius: RADII.md, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  ctaDisabled: { backgroundColor: COLORS.surfaceActive },
  ctaText: { color: "#fff", fontSize: 16, fontWeight: "800", letterSpacing: 1 },
});
