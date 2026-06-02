import { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, SectionList } from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { COLORS, SPACING, RADII } from "@/src/constants/theme";
import { authApi } from "@/src/api/auth";
import { adminApi } from "@/src/api/admin";
import { EQUIPMENT_CATALOG } from "@/src/utils/equipmentCatalog";

type Media = { id: string; content_type: string; data_base64: string };
type ItemRow = { name: string; key: string; muscle_group?: string; equipment_needed?: string; category?: string; media: null | Media; group: "Exercises" | "Equipment" };

export default function AdminScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [exercises, setExercises] = useState<ItemRow[]>([]);
  const [equipment, setEquipment] = useState<ItemRow[]>([]);
  const [query, setQuery] = useState("");
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>("");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const me = await authApi.me();
      if (!me || !me.is_admin) { setDenied(true); setLoading(false); return; }
      const data = await adminApi.listItems();
      const ex = (data.exercises || []).map(e => ({ ...e, group: "Exercises" as const }));
      // Merge static equipment catalog with discovered items
      const catalogKeys = new Set(EQUIPMENT_CATALOG.flatMap(c => c.items).map(n => n.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")));
      const discoveredKeys = new Set((data.equipment || []).map((e: any) => e.key));
      const fromCatalog: ItemRow[] = EQUIPMENT_CATALOG.flatMap(c =>
        c.items
          .filter(name => {
            const k = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
            return !discoveredKeys.has(k);
          })
          .map(name => ({
            name,
            key: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
            category: c.category,
            media: null,
            group: "Equipment" as const,
          }))
      );
      const eq = [...(data.equipment || []).map((e: any) => ({ ...e, group: "Equipment" as const })), ...fromCatalog]
        .sort((a, b) => a.name.localeCompare(b.name));
      setExercises(ex);
      setEquipment(eq);
    } catch (e: any) {
      setError(e.message || "Failed to load");
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filter = (rows: ItemRow[]) => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r => r.name.toLowerCase().includes(q));
  };

  const sections = [
    { title: "EXERCISES", data: filter(exercises) },
    { title: "EQUIPMENT", data: filter(equipment) },
  ];

  const pickAndUploadFor = async (row: ItemRow) => {
    setError("");
    setEditingKey(null);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { setError("Photo access denied"); return; }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8, base64: true,
    });
    if (res.canceled || !res.assets?.[0]?.base64) return;
    const asset = res.assets[0];
    const mime = (asset as any).mimeType || (asset.uri?.toLowerCase().endsWith(".gif") ? "image/gif" : "image/jpeg");
    setBusyKey(row.key);
    try {
      const updated = await adminApi.uploadMedia({
        exercise_key: row.key,
        content_type: mime,
        data_base64: asset.base64,
      });
      // patch local state
      const patch = (rows: ItemRow[]) => rows.map(r => r.key === row.key
        ? { ...r, media: { id: updated.id, content_type: updated.content_type, data_base64: updated.data_base64 } }
        : r);
      setExercises(prev => patch(prev));
      setEquipment(prev => patch(prev));
    } catch (e: any) {
      setError(e.message || "Upload failed");
    }
    setBusyKey(null);
  };

  const remove = async (row: ItemRow) => {
    if (!row.media) return;
    setBusyKey(row.key);
    try {
      await adminApi.deleteMedia(row.media.id);
      const patch = (rows: ItemRow[]) => rows.map(r => r.key === row.key ? { ...r, media: null } : r);
      setExercises(prev => patch(prev));
      setEquipment(prev => patch(prev));
    } catch (e: any) {
      setError(e.message || "Delete failed");
    }
    setBusyKey(null);
  };

  if (loading) return <SafeAreaView style={styles.safe}><ActivityIndicator color={COLORS.primary} style={{ marginTop: 64 }} /></SafeAreaView>;
  if (denied) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={{ padding: 32 }}>
          <Text style={styles.title}>ADMIN ONLY</Text>
          <Text style={styles.sub}>You don't have permission to view this page.</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.backCta}><Text style={styles.backCtaText}>BACK</Text></TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} testID="admin-back"><Ionicons name="arrow-back" size={24} color="#fff" /></TouchableOpacity>
        <Text style={styles.headerTitle}>ADMIN · MEDIA</Text>
        <TouchableOpacity onPress={load} testID="admin-refresh"><Ionicons name="refresh" size={22} color="#fff" /></TouchableOpacity>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={COLORS.textSecondary} />
        <TextInput
          testID="admin-search"
          style={styles.search}
          placeholder="Search items..."
          placeholderTextColor="rgba(255,255,255,0.3)"
          value={query}
          onChangeText={setQuery}
        />
        {query ? <TouchableOpacity onPress={() => setQuery("")}><Ionicons name="close-circle" size={18} color={COLORS.textSecondary} /></TouchableOpacity> : null}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <SectionList
        sections={sections}
        keyExtractor={(item, idx) => `${item.group}-${item.key}-${idx}`}
        stickySectionHeadersEnabled
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title} · {section.data.length}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <View style={styles.row} testID={`admin-item-${item.key}`}>
            <View style={styles.thumbWrap}>
              {item.media ? (
                <Image source={{ uri: `data:${item.media.content_type};base64,${item.media.data_base64}` }} style={styles.thumb} contentFit="cover" />
              ) : (
                <View style={[styles.thumb, styles.thumbEmpty]}>
                  <Ionicons name="image-outline" size={22} color={COLORS.textSecondary} />
                </View>
              )}
              {item.media?.content_type === "image/gif" && (
                <View style={styles.gifBadge}><Text style={styles.gifBadgeText}>GIF</Text></View>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowName}>{item.name}</Text>
              <Text style={styles.rowSub}>{item.muscle_group || item.equipment_needed || item.category || item.key}</Text>
            </View>
            {busyKey === item.key ? (
              <ActivityIndicator color={COLORS.primary} />
            ) : (
              <>
                <TouchableOpacity testID={`admin-edit-${item.key}`} style={styles.editBtn} onPress={() => pickAndUploadFor(item)}>
                  <Ionicons name="cloud-upload-outline" size={16} color="#fff" />
                  <Text style={styles.editText}>EDIT</Text>
                </TouchableOpacity>
                {item.media && (
                  <TouchableOpacity testID={`admin-clear-${item.key}`} style={styles.trashBtn} onPress={() => remove(item)}>
                    <Ionicons name="trash-outline" size={16} color={COLORS.error} />
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        )}
        ListEmptyComponent={<Text style={[styles.sub, { textAlign: "center", paddingVertical: 32 }]}>Nothing to show.</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: SPACING.lg },
  headerTitle: { color: "#fff", fontWeight: "900", letterSpacing: 2, fontSize: 14 },
  title: { color: "#fff", fontWeight: "900", fontSize: 32, letterSpacing: -1, marginBottom: SPACING.sm },
  sub: { color: COLORS.textSecondary, fontSize: 14 },
  searchWrap: { flexDirection: "row", alignItems: "center", marginHorizontal: SPACING.lg, marginBottom: SPACING.sm, paddingHorizontal: SPACING.md, height: 48, borderRadius: RADII.md, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, gap: 10 },
  search: { flex: 1, color: "#fff", fontSize: 15 },
  error: { color: COLORS.error, marginHorizontal: SPACING.lg, fontSize: 12 },
  sectionHeader: { backgroundColor: COLORS.background, paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.sm },
  sectionTitle: { color: COLORS.secondary, fontSize: 11, fontWeight: "800", letterSpacing: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, padding: SPACING.sm, marginHorizontal: SPACING.lg, marginBottom: 8, borderRadius: RADII.md, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  thumbWrap: { width: 56, height: 56 },
  thumb: { width: 56, height: 56, borderRadius: RADII.sm, backgroundColor: COLORS.surfaceActive },
  thumbEmpty: { alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: COLORS.border, borderStyle: "dashed" },
  gifBadge: { position: "absolute", top: 2, right: 2, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, backgroundColor: COLORS.secondary },
  gifBadgeText: { color: "#000", fontSize: 9, fontWeight: "900" },
  rowName: { color: "#fff", fontSize: 14, fontWeight: "800" },
  rowSub: { color: COLORS.textSecondary, fontSize: 11, marginTop: 2, textTransform: "capitalize" },
  editBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, backgroundColor: COLORS.primary },
  editText: { color: "#fff", fontWeight: "800", fontSize: 10, letterSpacing: 1 },
  trashBtn: { padding: 6 },
  backCta: { marginTop: SPACING.lg, height: 52, borderRadius: RADII.md, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  backCtaText: { color: "#fff", fontWeight: "900", letterSpacing: 1.5, fontSize: 13 },
});
