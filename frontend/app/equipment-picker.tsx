import { useMemo, useState } from "react";
import { View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SPACING, RADII } from "@/src/constants/theme";
import { EQUIPMENT_CATALOG } from "@/src/utils/equipmentCatalog";
import { getImageForName } from "@/src/utils/exerciseImages";
import { storage } from "@/src/utils/storage";

export default function EquipmentPicker() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const flat = useMemo(() => {
    const rows: { category?: string; name?: string; isHeader: boolean }[] = [];
    const q = query.trim().toLowerCase();
    EQUIPMENT_CATALOG.forEach(cat => {
      const items = q ? cat.items.filter(i => i.toLowerCase().includes(q)) : cat.items;
      if (items.length === 0) return;
      rows.push({ category: cat.category, isHeader: true });
      items.forEach(name => rows.push({ name, isHeader: false }));
    });
    return rows;
  }, [query]);

  const toggle = (name: string) => setSelected(prev => ({ ...prev, [name]: !prev[name] }));

  const selectedCount = Object.values(selected).filter(Boolean).length;

  const confirm = async () => {
    const names = Object.keys(selected).filter(k => selected[k]);
    if (names.length === 0) { router.back(); return; }
    const raw = await storage.getItem("last_scan", "");
    const scan = raw ? JSON.parse(raw) : { id: "", user_id: "", detected_equipment: [], created_at: "" };
    const existing = new Set((scan.detected_equipment || []).map((e: any) => e.name.toLowerCase()));
    const additions = names
      .filter(n => !existing.has(n.toLowerCase()))
      .map(n => ({ name: n, category: "machine", confidence: "high" }));
    scan.detected_equipment = [...(scan.detected_equipment || []), ...additions];
    await storage.setItem("last_scan", JSON.stringify(scan));
    router.back();
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} testID="picker-back">
          <Ionicons name="close" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>ADD EQUIPMENT</Text>
        <View style={{ width: 26 }} />
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={COLORS.textSecondary} />
        <TextInput
          testID="picker-search"
          style={styles.search}
          placeholder="Search equipment..."
          placeholderTextColor="rgba(255,255,255,0.3)"
          value={query}
          onChangeText={setQuery}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery("")}>
            <Ionicons name="close-circle" size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={flat}
        keyExtractor={(item, idx) => (item.isHeader ? `h-${item.category}` : `i-${item.name}-${idx}`)}
        renderItem={({ item }) => {
          if (item.isHeader) return <Text style={styles.catHeader}>{item.category?.toUpperCase()}</Text>;
          const name = item.name!;
          const isSel = !!selected[name];
          return (
            <TouchableOpacity
              testID={`picker-item-${name}`}
              style={[styles.itemRow, isSel && styles.itemRowActive]}
              onPress={() => toggle(name)}
            >
              <Image source={{ uri: getImageForName(name) }} style={styles.thumb} />
              <Text style={styles.itemName}>{name}</Text>
              <View style={[styles.check, isSel && styles.checkActive]}>
                {isSel && <Ionicons name="checkmark" size={16} color="#fff" />}
              </View>
            </TouchableOpacity>
          );
        }}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
      />

      <View style={styles.footer}>
        <TouchableOpacity testID="picker-confirm" style={styles.cta} onPress={confirm}>
          <Text style={styles.ctaText}>{selectedCount > 0 ? `ADD ${selectedCount} ITEM${selectedCount === 1 ? "" : "S"}` : "DONE"}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
  title: { color: "#fff", fontSize: 16, fontWeight: "900", letterSpacing: 2 },
  searchWrap: { flexDirection: "row", alignItems: "center", marginHorizontal: SPACING.lg, marginBottom: SPACING.sm, paddingHorizontal: SPACING.md, height: 48, borderRadius: RADII.md, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, gap: 10 },
  search: { flex: 1, color: "#fff", fontSize: 15 },
  list: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.lg },
  catHeader: { color: COLORS.secondary, fontSize: 11, fontWeight: "800", letterSpacing: 2, marginTop: SPACING.md, marginBottom: SPACING.sm },
  itemRow: { flexDirection: "row", alignItems: "center", gap: SPACING.md, padding: SPACING.sm, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADII.md, marginBottom: 8 },
  itemRowActive: { borderColor: COLORS.primary, backgroundColor: "rgba(111,97,239,0.1)" },
  thumb: { width: 48, height: 48, borderRadius: RADII.sm, backgroundColor: COLORS.surfaceActive },
  itemName: { flex: 1, color: "#fff", fontSize: 14, fontWeight: "700" },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: COLORS.border, alignItems: "center", justifyContent: "center" },
  checkActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  footer: { padding: SPACING.lg },
  cta: { height: 56, borderRadius: RADII.md, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  ctaText: { color: "#fff", fontWeight: "900", letterSpacing: 1.5, fontSize: 14 },
});
