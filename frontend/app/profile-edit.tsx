import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SPACING, RADII } from "@/src/constants/theme";
import { storage } from "@/src/utils/storage";
import { api, Profile, ProfileUpdate } from "@/src/api/client";
import { cmToFtIn, ftInToCm, kgToLbs, lbsToKg } from "@/src/utils/units";

export default function ProfileEdit() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // local edit state
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("muscle_gain");
  const [level, setLevel] = useState("beginner");
  const [days, setDays] = useState(3);
  const [gender, setGender] = useState("unspecified");
  const [unitPref, setUnitPref] = useState<"metric" | "imperial">("metric");
  // unified height/weight stored in metric in state; rendered/parsed per unitPref
  const [heightCm, setHeightCm] = useState<string>("");
  const [weightKg, setWeightKg] = useState<string>("");

  useEffect(() => {
    (async () => {
      const uid = await storage.getItem("user_id", "");
      if (!uid) { router.replace("/onboarding"); return; }
      const p = await api.getProfile(uid);
      setProfile(p);
      setName(p.name || "");
      setGoal(p.goal || "muscle_gain");
      setLevel(p.level || "beginner");
      setDays(p.days_per_week || 3);
      setGender(p.gender || "unspecified");
      setUnitPref((p.unit_pref as any) || "metric");
      setHeightCm(p.height_cm ? String(Math.round(p.height_cm)) : "");
      setWeightKg(p.weight_kg ? String(Math.round(p.weight_kg)) : "");
    })();
  }, []);

  const save = async () => {
    if (!profile) return;
    setSaving(true);
    setError("");
    try {
      const body: ProfileUpdate = {
        name: name.trim(),
        goal, level, days_per_week: days,
        gender, unit_pref: unitPref,
        height_cm: heightCm ? Number(heightCm) : null,
        weight_kg: weightKg ? Number(weightKg) : null,
      };
      const updated = await api.updateProfile(profile.id, body);
      setProfile(updated);
      router.back();
    } catch (e: any) {
      setError(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (!profile) {
    return <SafeAreaView style={styles.safe}><ActivityIndicator color={COLORS.primary} style={{ marginTop: 64 }} /></SafeAreaView>;
  }

  // imperial display values
  const heightImp = heightCm ? cmToFtIn(Number(heightCm)) : { ft: 0, inches: 0 };
  const weightImp = weightKg ? kgToLbs(Number(weightKg)) : 0;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} testID="edit-back"><Ionicons name="arrow-back" size={24} color="#fff" /></TouchableOpacity>
        <Text style={styles.headerTitle}>EDIT PROFILE</Text>
        <TouchableOpacity onPress={save} disabled={saving} testID="edit-save">
          {saving ? <ActivityIndicator color={COLORS.primary} /> : <Text style={styles.saveText}>SAVE</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.section}>NAME</Text>
        <TextInput testID="edit-name" style={styles.input} value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor="rgba(255,255,255,0.3)" />

        <Text style={styles.section}>GOAL</Text>
        <View style={styles.row}>
          {[["muscle_gain", "Muscle"], ["weight_loss", "Loss"], ["endurance", "Endure"]].map(([id, label]) => (
            <TouchableOpacity key={id} testID={`edit-goal-${id}`} style={[styles.chip, goal === id && styles.chipActive]} onPress={() => setGoal(id)}>
              <Text style={[styles.chipText, goal === id && styles.chipTextActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.section}>LEVEL</Text>
        <View style={styles.row}>
          {["beginner", "intermediate", "advanced"].map(id => (
            <TouchableOpacity key={id} testID={`edit-level-${id}`} style={[styles.chip, level === id && styles.chipActive]} onPress={() => setLevel(id)}>
              <Text style={[styles.chipText, level === id && styles.chipTextActive]}>{id.charAt(0).toUpperCase() + id.slice(1)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.section}>DAYS / WEEK</Text>
        <View style={styles.row}>
          {[2, 3, 4, 5, 6].map(d => (
            <TouchableOpacity key={d} testID={`edit-days-${d}`} style={[styles.chip, days === d && styles.chipActive]} onPress={() => setDays(d)}>
              <Text style={[styles.chipText, days === d && styles.chipTextActive]}>{d}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.section}>GENDER</Text>
        <View style={styles.row}>
          {[["male", "Male"], ["female", "Female"], ["unspecified", "—"]].map(([id, label]) => (
            <TouchableOpacity key={id} testID={`edit-gender-${id}`} style={[styles.chip, gender === id && styles.chipActive]} onPress={() => setGender(id)}>
              <Text style={[styles.chipText, gender === id && styles.chipTextActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.section}>UNITS</Text>
        <View style={styles.row}>
          {(["metric", "imperial"] as const).map(u => (
            <TouchableOpacity key={u} testID={`edit-unit-${u}`} style={[styles.chip, unitPref === u && styles.chipActive]} onPress={() => setUnitPref(u)}>
              <Text style={[styles.chipText, unitPref === u && styles.chipTextActive]}>{u === "metric" ? "kg / cm" : "lbs / ft"}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.section}>HEIGHT</Text>
        {unitPref === "metric" ? (
          <TextInput testID="edit-height-cm" style={styles.input} value={heightCm} onChangeText={t => setHeightCm(t.replace(/[^0-9]/g, ""))} placeholder="cm" placeholderTextColor="rgba(255,255,255,0.3)" keyboardType="numeric" />
        ) : (
          <View style={{ flexDirection: "row", gap: SPACING.sm }}>
            <TextInput testID="edit-height-ft" style={[styles.input, { flex: 1 }]}
              value={String(heightImp.ft || "")}
              onChangeText={t => {
                const ft = Number(t.replace(/[^0-9]/g, "")) || 0;
                setHeightCm(String(ftInToCm(ft, heightImp.inches)));
              }}
              placeholder="ft" placeholderTextColor="rgba(255,255,255,0.3)" keyboardType="numeric" />
            <TextInput testID="edit-height-in" style={[styles.input, { flex: 1 }]}
              value={String(heightImp.inches || "")}
              onChangeText={t => {
                const inches = Number(t.replace(/[^0-9]/g, "")) || 0;
                setHeightCm(String(ftInToCm(heightImp.ft, inches)));
              }}
              placeholder="in" placeholderTextColor="rgba(255,255,255,0.3)" keyboardType="numeric" />
          </View>
        )}

        <Text style={styles.section}>WEIGHT</Text>
        {unitPref === "metric" ? (
          <TextInput testID="edit-weight-kg" style={styles.input} value={weightKg} onChangeText={t => setWeightKg(t.replace(/[^0-9]/g, ""))} placeholder="kg" placeholderTextColor="rgba(255,255,255,0.3)" keyboardType="numeric" />
        ) : (
          <TextInput testID="edit-weight-lbs" style={styles.input}
            value={String(weightImp || "")}
            onChangeText={t => {
              const lbs = Number(t.replace(/[^0-9]/g, "")) || 0;
              setWeightKg(String(lbsToKg(lbs)));
            }}
            placeholder="lbs" placeholderTextColor="rgba(255,255,255,0.3)" keyboardType="numeric" />
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: SPACING.lg },
  headerTitle: { color: "#fff", fontWeight: "900", letterSpacing: 2, fontSize: 14 },
  saveText: { color: COLORS.primary, fontWeight: "900", letterSpacing: 1.5, fontSize: 13 },
  scroll: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxl },
  section: { color: COLORS.secondary, fontSize: 10, fontWeight: "800", letterSpacing: 1.5, marginTop: SPACING.lg, marginBottom: SPACING.sm },
  input: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, color: "#fff", paddingHorizontal: SPACING.md, height: 52, borderRadius: RADII.md, fontSize: 15 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  chipActive: { borderColor: COLORS.primary, backgroundColor: "rgba(111,97,239,0.15)" },
  chipText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: "800", letterSpacing: 1 },
  chipTextActive: { color: COLORS.primary },
  error: { color: COLORS.error, marginTop: SPACING.md, fontSize: 13 },
});
