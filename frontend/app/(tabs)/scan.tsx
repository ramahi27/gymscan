import { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, ActivityIndicator, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { COLORS, SPACING, RADII } from "@/src/constants/theme";
import { storage } from "@/src/utils/storage";
import { api } from "@/src/api/client";

export default function Scan() {
  const router = useRouter();
  const [images, setImages] = useState<{ uri: string; base64: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const processImage = async (uri: string): Promise<string> => {
    const out = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1024 } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );
    return out.base64 || "";
  };

  const pickFromGallery = async () => {
    setError("");
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      if (!perm.canAskAgain) {
        setError("Photo access denied. Open Settings to enable.");
      } else {
        setError("Photo access is required.");
      }
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: 5,
      quality: 0.8,
    });
    if (res.canceled) return;
    const processed = await Promise.all(res.assets.map(async (a) => ({ uri: a.uri, base64: await processImage(a.uri) })));
    setImages(prev => [...prev, ...processed].slice(0, 5));
  };

  const takePhoto = async () => {
    setError("");
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      if (!perm.canAskAgain) setError("Camera access denied. Open Settings to enable.");
      else setError("Camera access is required.");
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (res.canceled) return;
    const a = res.assets[0];
    const b64 = await processImage(a.uri);
    setImages(prev => [...prev, { uri: a.uri, base64: b64 }].slice(0, 5));
  };

  const removeImage = (idx: number) => setImages(prev => prev.filter((_, i) => i !== idx));

  const runScan = async () => {
    if (images.length === 0) { setError("Add at least one photo"); return; }
    setLoading(true);
    setError("");
    try {
      const uid = await storage.getItem("user_id", "");
      if (!uid) throw new Error("No profile");
      const result = await api.scan({ user_id: uid, images_base64: images.map(i => i.base64) });
      await storage.setItem("last_scan", JSON.stringify(result));
      setImages([]);
      router.push("/confirm-equipment");
    } catch (e: any) {
      setError(e.message || "Scan failed");
    }
    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.overline} testID="scan-screen-title">EQUIPMENT SCANNER</Text>
        <Text style={styles.title}>SCAN YOUR{"\n"}GYM</Text>
        <Text style={styles.sub}>Photograph machines & free weights. AI will detect everything available.</Text>

        <View style={styles.reticleWrap}>
          <View style={styles.reticleBox}>
            <View style={[styles.corner, styles.tl]} />
            <View style={[styles.corner, styles.tr]} />
            <View style={[styles.corner, styles.bl]} />
            <View style={[styles.corner, styles.br]} />
            <Ionicons name="scan" size={48} color="rgba(57,210,192,0.5)" />
          </View>
        </View>

        {images.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbRow}>
            {images.map((img, i) => (
              <View key={i} style={styles.thumb} testID={`scan-thumb-${i}`}>
                <Image source={{ uri: img.uri }} style={styles.thumbImg} />
                <TouchableOpacity style={styles.thumbRemove} onPress={() => removeImage(i)} testID={`thumb-remove-${i}`}>
                  <Ionicons name="close" size={14} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )}

        <View style={styles.btnRow}>
          <TouchableOpacity style={styles.iconBtn} onPress={takePhoto} testID="scan-camera-button" disabled={loading}>
            <Ionicons name="camera" size={22} color="#fff" />
            <Text style={styles.iconBtnText}>CAMERA</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={pickFromGallery} testID="scan-gallery-button" disabled={loading}>
            <Ionicons name="images" size={22} color="#fff" />
            <Text style={styles.iconBtnText}>GALLERY</Text>
          </TouchableOpacity>
        </View>

        {error ? (
          <View style={styles.errorBox} testID="scan-error">
            <Text style={styles.errorText}>{error}</Text>
            {error.includes("Settings") && (
              <TouchableOpacity onPress={() => Linking.openSettings()}>
                <Text style={styles.settingsLink}>Open Settings</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : null}

        <TouchableOpacity
          testID="scan-detect-button"
          style={[styles.cta, (loading || images.length === 0) && styles.ctaDisabled]}
          onPress={runScan}
          disabled={loading || images.length === 0}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>DETECT EQUIPMENT</Text>}
        </TouchableOpacity>

        <TouchableOpacity testID="manual-entry-link" onPress={async () => {
          await storage.setItem("last_scan", JSON.stringify({ id: "", user_id: "", detected_equipment: [], created_at: "" }));
          router.push("/confirm-equipment");
        }}>
          <Text style={styles.manual}>Or enter equipment manually →</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
  overline: { color: COLORS.secondary, fontSize: 11, fontWeight: "800", letterSpacing: 2 },
  title: { color: COLORS.textPrimary, fontSize: 36, fontWeight: "900", letterSpacing: -1, marginVertical: 6 },
  sub: { color: COLORS.textSecondary, fontSize: 14, marginBottom: SPACING.lg },
  reticleWrap: { alignItems: "center", marginVertical: SPACING.md },
  reticleBox: { width: 220, height: 220, alignItems: "center", justifyContent: "center" },
  corner: { position: "absolute", width: 32, height: 32, borderColor: COLORS.secondary },
  tl: { top: 0, left: 0, borderTopWidth: 2, borderLeftWidth: 2 },
  tr: { top: 0, right: 0, borderTopWidth: 2, borderRightWidth: 2 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 2, borderLeftWidth: 2 },
  br: { bottom: 0, right: 0, borderBottomWidth: 2, borderRightWidth: 2 },
  thumbRow: { gap: SPACING.sm, paddingVertical: SPACING.sm },
  thumb: { width: 80, height: 80, borderRadius: RADII.md, overflow: "hidden", borderWidth: 1, borderColor: COLORS.border },
  thumbImg: { width: "100%", height: "100%" },
  thumbRemove: { position: "absolute", top: 4, right: 4, backgroundColor: "rgba(0,0,0,0.7)", borderRadius: 10, width: 20, height: 20, alignItems: "center", justifyContent: "center" },
  btnRow: { flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.md },
  iconBtn: { flex: 1, height: 56, borderRadius: RADII.md, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  iconBtnText: { color: "#fff", fontWeight: "800", letterSpacing: 1, fontSize: 12 },
  errorBox: { marginTop: SPACING.md, padding: SPACING.md, borderRadius: RADII.md, backgroundColor: "rgba(255,59,48,0.1)", borderWidth: 1, borderColor: "rgba(255,59,48,0.3)" },
  errorText: { color: COLORS.error, fontSize: 13 },
  settingsLink: { color: COLORS.secondary, fontSize: 13, marginTop: 4, fontWeight: "700" },
  cta: { marginTop: SPACING.lg, height: 56, borderRadius: RADII.md, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  ctaDisabled: { backgroundColor: COLORS.surfaceActive },
  ctaText: { color: "#fff", fontWeight: "900", letterSpacing: 1.5, fontSize: 14 },
  manual: { textAlign: "center", color: COLORS.textSecondary, marginTop: SPACING.md, fontSize: 13 },
});
