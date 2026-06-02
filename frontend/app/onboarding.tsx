import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SPACING, RADII } from "@/src/constants/theme";
import { storage } from "@/src/utils/storage";
import { api } from "@/src/api/client";

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

export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [level, setLevel] = useState("");
  const [days, setDays] = useState(3);
  const [loading, setLoading] = useState(false);

  const canNext = () => {
    if (step === 0) return name.trim().length > 0;
    if (step === 1) return !!goal;
    if (step === 2) return !!level;
    return true;
  };

  const next = async () => {
    if (step < 3) { setStep(step + 1); return; }
    setLoading(true);
    try {
      const p = await api.createProfile({ name: name.trim(), goal, level, days_per_week: days });
      await storage.setItem("user_id", p.id);
      router.replace("/(tabs)/home");
    } catch (e: any) {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Text style={styles.overline} testID="onboarding-step">STEP {step + 1} / 4</Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${((step + 1) / 4) * 100}%` }]} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {step === 0 && (
          <>
            <Text style={styles.h1}>WHAT'S YOUR{"\n"}NAME?</Text>
            <Text style={styles.sub}>Let's personalize your journey.</Text>
            <TextInput
              testID="name-input"
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor="rgba(255,255,255,0.3)"
              autoFocus
            />
          </>
        )}
        {step === 1 && (
          <>
            <Text style={styles.h1}>DEFINE{"\n"}YOUR GOAL</Text>
            <Text style={styles.sub}>What's your primary focus?</Text>
            {GOALS.map(g => (
              <TouchableOpacity
                key={g.id}
                testID={`goal-${g.id}`}
                style={[styles.card, goal === g.id && styles.cardActive]}
                onPress={() => setGoal(g.id)}
              >
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
              <TouchableOpacity
                key={l.id}
                testID={`level-${l.id}`}
                style={[styles.card, level === l.id && styles.cardActive]}
                onPress={() => setLevel(l.id)}
              >
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
                <TouchableOpacity
                  key={d}
                  testID={`days-${d}`}
                  style={[styles.dayPill, days === d && styles.dayPillActive]}
                  onPress={() => setDays(d)}
                >
                  <Text style={[styles.dayText, days === d && styles.dayTextActive]}>{d}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {step > 0 && (
          <TouchableOpacity testID="back-button" style={styles.backBtn} onPress={() => setStep(step - 1)}>
            <Ionicons name="arrow-back" size={20} color={COLORS.textPrimary} />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          testID="onboarding-next-button"
          style={[styles.cta, !canNext() && styles.ctaDisabled]}
          disabled={!canNext() || loading}
          onPress={next}
        >
          <Text style={styles.ctaText}>{loading ? "CREATING..." : step === 3 ? "FINISH" : "CONTINUE"}</Text>
        </TouchableOpacity>
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
  input: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, color: COLORS.textPrimary, padding: SPACING.md, borderRadius: RADII.md, fontSize: 16, height: 56 },
  card: { flexDirection: "row", alignItems: "center", gap: SPACING.md, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, borderRadius: RADII.md, marginBottom: SPACING.sm },
  cardActive: { borderColor: COLORS.primary, backgroundColor: COLORS.surfaceActive },
  cardLabel: { color: COLORS.textPrimary, fontSize: 16, fontWeight: "700", letterSpacing: 1 },
  daysRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  dayPill: { width: 64, height: 64, borderRadius: RADII.md, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, alignItems: "center", justifyContent: "center" },
  dayPillActive: { borderColor: COLORS.primary, backgroundColor: COLORS.surfaceActive },
  dayText: { color: COLORS.textPrimary, fontSize: 22, fontWeight: "800" },
  dayTextActive: { color: COLORS.primary },
  footer: { flexDirection: "row", padding: SPACING.lg, gap: SPACING.sm },
  backBtn: { width: 56, height: 56, borderRadius: RADII.md, borderWidth: 1, borderColor: COLORS.border, alignItems: "center", justifyContent: "center" },
  cta: { flex: 1, height: 56, borderRadius: RADII.md, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  ctaDisabled: { backgroundColor: COLORS.surfaceActive },
  ctaText: { color: "#fff", fontSize: 16, fontWeight: "800", letterSpacing: 1 },
});
