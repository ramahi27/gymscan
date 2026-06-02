import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, FlatList } from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { COLORS, SPACING, RADII } from "@/src/constants/theme";
import { authApi } from "@/src/api/auth";
import { adminApi } from "@/src/api/admin";

type MediaRow = { id: string; exercise_key: string; content_type: string; data_base64: string; uploaded_at: string };

export default function AdminScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [items, setItems] = useState<MediaRow[]>([]);
  const [exerciseKey, setExerciseKey] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const me = await authApi.me();
      if (!me || !me.is_admin) { setDenied(true); setLoading(false); return; }
      const list = await adminApi.listMedia();
      setItems(list);
    } catch (e: any) {
      setError(e.message || "Failed to load");
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const pickAndUpload = async () => {
    setError("");
    if (!exerciseKey.trim()) { setError("Enter an exercise name first"); return; }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { setError("Photo access denied"); return; }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8, base64: true,
    });
    if (res.canceled || !res.assets?.[0]?.base64) return;
    const asset = res.assets[0];
    const mime = (asset as any).mimeType || (asset.uri?.endsWith(".gif") ? "image/gif" : "image/jpeg");
    setUploading(true);
    try {
      await adminApi.uploadMedia({
        exercise_key: exerciseKey.trim(),
        content_type: mime,
        data_base64: asset.base64,
      });
      setExerciseKey("");
      await load();
    } catch (e: any) {
      setError(e.message || "Upload failed");
    }
    setUploading(false);
  };

  const remove = async (id: string) => {
    await adminApi.deleteMedia(id);
    await load();
  };

  if (loading) {
    return <SafeAreaView style={styles.safe}><ActivityIndicator color={COLORS.primary} style={{ marginTop: 64 }} /></SafeAreaView>;
  }
  if (denied) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={{ padding: 32 }}>
          <Text style={styles.title}>ADMIN ONLY</Text>
          <Text style={styles.sub}>You don't have permission to view this page.</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.backCta}>
            <Text style={styles.backCtaText}>BACK</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} testID="admin-back"><Ionicons name="arrow-back" size={24} color="#fff" /></TouchableOpacity>
        <Text style={styles.headerTitle}>ADMIN · MEDIA</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.uploadCard}>
        <Text style={styles.section}>UPLOAD EXERCISE GIF / PHOTO</Text>
        <Text style={styles.help}>Exercise name will be normalised to a key, e.g. "Bench Press" → "bench-press".</Text>
        <TextInput
          testID="admin-exercise-key"
          style={styles.input}
          value={exerciseKey}
          onChangeText={setExerciseKey}
          placeholder="Exercise name (e.g. Dumbbell Bench Press)"
          placeholderTextColor="rgba(255,255,255,0.3)"
        />
        <TouchableOpacity testID="admin-upload" style={[styles.cta, uploading && { opacity: 0.6 }]} onPress={pickAndUpload} disabled={uploading}>
          {uploading ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>PICK & UPLOAD</Text>}
        </TouchableOpacity>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      <Text style={styles.section}>UPLOADED MEDIA · {items.length}</Text>
      <FlatList
        data={items}
        keyExtractor={i => i.id}
        contentContainerStyle={{ paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxl }}
        renderItem={({ item }) => (
          <View style={styles.mediaRow} testID={`media-row-${item.exercise_key}`}>
            <Image source={{ uri: `data:${item.content_type};base64,${item.data_base64}` }} style={styles.thumb} contentFit="cover" />
            <View style={{ flex: 1 }}>
              <Text style={styles.mediaKey}>{item.exercise_key}</Text>
              <Text style={styles.mediaType}>{item.content_type}</Text>
            </View>
            <TouchableOpacity testID={`media-delete-${item.id}`} onPress={() => remove(item.id)} style={styles.deleteBtn}>
              <Ionicons name="trash-outline" size={18} color={COLORS.error} />
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={<Text style={[styles.sub, { textAlign: "center", paddingVertical: 32 }]}>No uploads yet.</Text>}
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
  section: { color: COLORS.secondary, fontSize: 10, fontWeight: "800", letterSpacing: 1.5, marginHorizontal: SPACING.lg, marginTop: SPACING.md, marginBottom: SPACING.sm },
  help: { color: COLORS.textSecondary, fontSize: 12, marginBottom: SPACING.sm },
  uploadCard: { marginHorizontal: SPACING.lg, padding: SPACING.md, borderRadius: RADII.lg, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  input: { backgroundColor: COLORS.surfaceActive, borderRadius: RADII.md, color: "#fff", paddingHorizontal: SPACING.md, height: 48, fontSize: 15, marginBottom: SPACING.sm },
  cta: { height: 48, borderRadius: RADII.md, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  ctaText: { color: "#fff", fontWeight: "900", letterSpacing: 1.5, fontSize: 13 },
  error: { color: COLORS.error, marginTop: SPACING.sm, fontSize: 12 },
  mediaRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, padding: SPACING.sm, borderRadius: RADII.md, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, marginBottom: SPACING.sm },
  thumb: { width: 56, height: 56, borderRadius: RADII.sm, backgroundColor: COLORS.surfaceActive },
  mediaKey: { color: "#fff", fontSize: 14, fontWeight: "800" },
  mediaType: { color: COLORS.textSecondary, fontSize: 11, marginTop: 2 },
  deleteBtn: { padding: SPACING.sm },
  backCta: { marginTop: SPACING.lg, height: 52, borderRadius: RADII.md, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  backCtaText: { color: "#fff", fontWeight: "900", letterSpacing: 1.5, fontSize: 13 },
});
