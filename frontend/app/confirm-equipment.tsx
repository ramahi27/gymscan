import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, ImageErrorEventData, NativeSyntheticEvent } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SPACING, RADII } from "@/src/constants/theme";
import { storage } from "@/src/utils/storage";
import { api, DetectedEquipment, ScanResult } from "@/src/api/client";
import { useExerciseMedia } from "@/src/utils/media";

function EquipmentRow({ name, category, idx, onRemove }: { name: string; category?: string; idx: number; onRemove: () => void }) {
  const uri = useExerciseMedia(name, category || "");
  const [imgFailed, setImgFailed] = useState(false);
  return (
    <View style={styles.itemRow} testID={`equipment-row-${idx}`}>
      {!imgFailed && uri ? (
        <Image
          source={{ uri }}
          style={styles.itemThumb}
          testID={`equipment-thumb-${idx}`}
          onError={() => setImgFailed(true)}
        />
      ) : (
        <View style={[styles.itemThumb, styles.itemThumbFallback]} testID={`equipment-thumb-${idx}`} />
      )}
      <View style={{ flex: 1 }}>
        <Text style={styles.itemName}>{name}</Text>
        {category ? <Text style={styles.itemCat}>{category.toUpperCase()}</Text> : null}
      </View>
      <TouchableOpacity testID={`equipment-remove-${idx}`} onPress={onRemove} style={styles.removeBtn}>
        <Ionicons name="trash-outline" size={18} color={COLORS.error} />
      </TouchableOpacity>
    </View>
  );
}

export default function ConfirmEquipment() {
  const router = useRouter();
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [items, setItems] = useState<DetectedEquipment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Re-read scan storage every time screen is focused so additions from the
  // equipment picker show up immediately.
  useFocusEffect(useCallback(() => {
    (async () => {
      const raw = await storage.getItem("last_scan", "");
      if (raw) {
        const s = JSON.parse(raw) as ScanResult;
        setScan(s);
        setItems(s.detected_equipment || []);
      }
    })();
  }, []));

  const removeItem = (idx: number) => {
    const next = items.filter((_, i) => i !== idx);
    setItems(next);
    // persist for picker round-trip
    (async () => {
      const raw = await storage.getItem("last_scan", "");
      const s = raw ? JSON.parse(raw) : { id: "", user_id: "", detected_equipment: [], created_at: "" };
      s.detected_equipment = next;
      await storage.setItem("last_scan", JSON.stringify(s));
    })();
  };

  const generate = async () => {
    if (items.length === 0) { setError("Add at least one piece of equipment"); return; }
    setLoading(true);
    setError("");
    try {
      const uid = await storage.getItem("user_id", "");
      if (!uid) throw new Error("No profile");
      await api.generatePlan({
        user_id: uid,
        scan_id: scan?.id || undefined,
        equipment: items.map(i => i.name),
      });
      await storage.removeItem("last_scan");
      router.replace("/(tabs)/plan");
    } catch (e: any) {
      setError(e.message || "Plan generation failed");
    }
    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} testID="confirm-back">
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.overline}>STEP 2 / 2</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>CONFIRM{"\n"}EQUIPMENT</Text>
        <Text style={styles.sub}>{items.length} item{items.length === 1 ? "" : "s"} detected. Add or remove anything before we build your plan.</Text>

        <View style={styles.addRow}>
          <TouchableOpacity
            testID="add-missing-button"
            style={styles.addMissing}
            onPress={() => router.push("/equipment-picker")}
          >
            <Ionicons name="add-circle" size={22} color={COLORS.primary} />
            <Text style={styles.addMissingText}>ADD MISSING EQUIPMENT</Text>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>

        {items.map((it, i) => (
          <EquipmentRow key={`${it.name}-${i}`} name={it.name} category={it.category || undefined} idx={i} onRemove={() => removeItem(i)} />
        ))}

        {items.length === 0 && (
          <View style={styles.emptyHint}>
            <Text style={styles.emptyHintText}>No equipment yet. Tap "Add Missing Equipment" above.</Text>
          </View>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          testID="generate-plan-button"
          style={[styles.cta, (loading || items.length === 0) && styles.ctaDisabled]}
          onPress={generate}
          disabled={loading || items.length === 0}
        >
          {loading ? (
            <>
              <ActivityIndicator color="#fff" />
              <Text style={styles.ctaSub}>Building your plan…</Text>
            </>
          ) : (
            <Text style={styles.ctaText}>GENERATE PLAN</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: "row", alignItems: "center", gap: SPACING.md, padding: SPACING.lg },
  overline: { color: COLORS.secondary, fontSize: 11, fontWeight: "800", letterSpacing: 2 },
  body: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxl },
  title: { color: "#fff", fontSize: 36, fontWeight: "900", letterSpacing: -1, marginBottom: 8 },
  sub: { color: COLORS.textSecondary, fontSize: 14, marginBottom: SPACING.lg },
  addRow: { marginBottom: SPACING.md },
  addMissing: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, paddingHorizontal: SPACING.md, height: 52, borderRadius: RADII.md, borderWidth: 1, borderColor: COLORS.primary, backgroundColor: "rgba(111,97,239,0.08)" },
  addMissingText: { flex: 1, color: "#fff", fontSize: 13, fontWeight: "800", letterSpacing: 1 },
  itemRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.sm, borderRadius: RADII.md, marginBottom: SPACING.sm },
  itemThumb: { width: 48, height: 48, borderRadius: RADII.sm, backgroundColor: COLORS.surfaceActive },
  itemThumbFallback: { alignItems: "center", justifyContent: "center" },
  itemName: { color: "#fff", fontSize: 15, fontWeight: "700" },
  itemCat: { color: COLORS.secondary, fontSize: 10, fontWeight: "800", letterSpacing: 1, marginTop: 2 },
  removeBtn: { padding: SPACING.sm },
  emptyHint: { padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.border, borderStyle: "dashed", borderRadius: RADII.md, alignItems: "center" },
  emptyHintText: { color: COLORS.textSecondary, fontSize: 13 },
  error: { color: COLORS.error, fontSize: 13, marginTop: SPACING.sm },
  footer: { padding: SPACING.lg },
  cta: { height: 56, borderRadius: RADII.md, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: SPACING.sm },
  ctaDisabled: { backgroundColor: COLORS.surfaceActive },
  ctaText: { color: "#fff", fontWeight: "900", letterSpacing: 1.5, fontSize: 14 },
  ctaSub: { color: "#fff", fontSize: 12, fontWeight: "700" },
});
