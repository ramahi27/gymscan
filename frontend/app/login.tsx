import { useState } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Platform, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import * as ExpoLinking from "expo-linking";
import { COLORS, SPACING, RADII } from "@/src/constants/theme";
import { authApi } from "@/src/api/auth";

type Mode = "signin" | "signup";

export default function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ redirect?: string; mode?: string }>();
  const [mode, setMode] = useState<Mode>((params.mode as Mode) || "signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resetSent, setResetSent] = useState(false);

  const goNext = () => {
    if (params.redirect) router.replace(params.redirect as any);
    else router.replace("/(tabs)/home");
  };

  const submit = async () => {
    setError("");
    if (!email.trim() || !password) { setError("Email and password required"); return; }
    if (mode === "signup" && !name.trim()) { setError("Name is required"); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    setLoading(true);
    try {
      if (mode === "signup") {
        await authApi.signup(name.trim(), email.trim(), password);
        router.replace("/onboarding?mode=setup");
      } else {
        await authApi.signin(email.trim(), password);
        goNext();
      }
    } catch (e: any) {
      setError(e.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const onForgot = async () => {
    if (!email.trim()) { setError("Enter your email above first"); return; }
    setError("");
    setLoading(true);
    try {
      await authApi.requestPasswordReset(email.trim());
      setResetSent(true);
    } finally {
      setLoading(false);
    }
  };

  const onGoogle = async () => {
    setError("");
    setLoading(true);
    try {
      const redirectUrl = Platform.OS === "web"
        ? window.location.origin + "/"
        : ExpoLinking.createURL("auth");
      const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
      if (Platform.OS === "web") {
        window.location.href = authUrl;
        return;
      }
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
      if (result.type !== "success" || !result.url) {
        setLoading(false);
        return;
      }
      const url = result.url;
      const hashMatch = url.match(/[#?&]session_id=([^&]+)/);
      const sessionId = hashMatch?.[1];
      if (!sessionId) {
        setError("No session id returned from Google");
        setLoading(false);
        return;
      }
      await authApi.googleExchange(sessionId);
      goNext();
    } catch (e: any) {
      setError(e.message || "Google sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  const onSocialUnavailable = (label: string) => {
    setError(`${label} sign-in requires a native build. Use Google or email/password for now.`);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn} testID="login-close">
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>

        <Text style={styles.brand}>GYMSCAN</Text>
        <Text style={styles.title} testID="login-title">
          {mode === "signup" ? "CREATE\nACCOUNT" : "WELCOME\nBACK"}
        </Text>
        <Text style={styles.sub}>
          {mode === "signup" ? "Save your plans, sync progress across devices." : "Sign in to sync your gym plans and history."}
        </Text>

        <View style={styles.toggle}>
          <TouchableOpacity
            testID="toggle-signin"
            style={[styles.toggleBtn, mode === "signin" && styles.toggleBtnActive]}
            onPress={() => { setMode("signin"); setError(""); setResetSent(false); }}
          >
            <Text style={[styles.toggleText, mode === "signin" && styles.toggleTextActive]}>SIGN IN</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="toggle-signup"
            style={[styles.toggleBtn, mode === "signup" && styles.toggleBtnActive]}
            onPress={() => { setMode("signup"); setError(""); setResetSent(false); }}
          >
            <Text style={[styles.toggleText, mode === "signup" && styles.toggleTextActive]}>SIGN UP</Text>
          </TouchableOpacity>
        </View>

        {mode === "signup" && (
          <TextInput
            testID="login-name-input"
            style={styles.input}
            placeholder="Full name"
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
        )}
        <TextInput
          testID="login-email-input"
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="rgba(255,255,255,0.3)"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
        <TextInput
          testID="login-password-input"
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="rgba(255,255,255,0.3)"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        {mode === "signin" && (
          <TouchableOpacity testID="login-forgot" onPress={onForgot} style={styles.forgotWrap}>
            <Text style={styles.forgot}>{resetSent ? "Reset link sent (if email exists)" : "Forgot password?"}</Text>
          </TouchableOpacity>
        )}

        {error ? <Text style={styles.error} testID="login-error">{error}</Text> : null}

        <TouchableOpacity
          testID="login-submit"
          style={[styles.cta, loading && styles.ctaDisabled]}
          onPress={submit}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : (
            <Text style={styles.ctaText}>{mode === "signup" ? "CREATE ACCOUNT" : "SIGN IN"}</Text>
          )}
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity testID="login-google" style={styles.socialBtn} onPress={onGoogle} disabled={loading}>
          <Ionicons name="logo-google" size={20} color="#fff" />
          <Text style={styles.socialText}>CONTINUE WITH GOOGLE</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="login-apple" style={styles.socialBtn} onPress={() => onSocialUnavailable("Apple")}>
          <Ionicons name="logo-apple" size={20} color="#fff" />
          <Text style={styles.socialText}>CONTINUE WITH APPLE</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="login-facebook" style={styles.socialBtn} onPress={() => onSocialUnavailable("Facebook")}>
          <Ionicons name="logo-facebook" size={20} color="#fff" />
          <Text style={styles.socialText}>CONTINUE WITH FACEBOOK</Text>
        </TouchableOpacity>

        <Text style={styles.legal}>
          By continuing you agree to our <Text style={styles.legalLink} onPress={() => Linking.openURL("https://example.com/terms")}>Terms</Text> & <Text style={styles.legalLink} onPress={() => Linking.openURL("https://example.com/privacy")}>Privacy</Text>.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
  closeBtn: { alignSelf: "flex-end", padding: 4 },
  brand: { color: COLORS.secondary, fontSize: 11, fontWeight: "800", letterSpacing: 2, marginTop: SPACING.sm },
  title: { color: "#fff", fontSize: 38, fontWeight: "900", letterSpacing: -1, marginTop: 4, marginBottom: 8 },
  sub: { color: COLORS.textSecondary, fontSize: 14, marginBottom: SPACING.lg },
  toggle: { flexDirection: "row", backgroundColor: COLORS.surface, borderRadius: RADII.md, padding: 4, marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.border },
  toggleBtn: { flex: 1, height: 44, alignItems: "center", justifyContent: "center", borderRadius: RADII.sm },
  toggleBtnActive: { backgroundColor: COLORS.primary },
  toggleText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: "800", letterSpacing: 1.5 },
  toggleTextActive: { color: "#fff" },
  input: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, color: "#fff", paddingHorizontal: SPACING.md, height: 52, borderRadius: RADII.md, fontSize: 15, marginBottom: SPACING.sm },
  forgotWrap: { alignSelf: "flex-end", paddingVertical: 8 },
  forgot: { color: COLORS.secondary, fontSize: 12, fontWeight: "700" },
  error: { color: COLORS.error, fontSize: 13, marginVertical: SPACING.sm },
  cta: { height: 56, borderRadius: RADII.md, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center", marginTop: SPACING.sm },
  ctaDisabled: { opacity: 0.6 },
  ctaText: { color: "#fff", fontWeight: "900", letterSpacing: 1.5, fontSize: 14 },
  divider: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, marginVertical: SPACING.lg },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  dividerText: { color: COLORS.textSecondary, fontSize: 11, fontWeight: "800", letterSpacing: 2 },
  socialBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACING.sm, height: 52, borderRadius: RADII.md, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, marginBottom: SPACING.sm },
  socialText: { color: "#fff", fontWeight: "800", letterSpacing: 1.5, fontSize: 12 },
  legal: { color: COLORS.textSecondary, fontSize: 11, textAlign: "center", marginTop: SPACING.lg, lineHeight: 16 },
  legalLink: { color: COLORS.secondary, textDecorationLine: "underline" },
});
