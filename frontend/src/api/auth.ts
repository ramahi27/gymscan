import { Platform } from "react-native";
import { storage } from "@/src/utils/storage";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;
const TOKEN_KEY = "auth_token";

export type AuthUser = {
  user_id: string;
  email: string;
  name: string;
  picture?: string | null;
  profile_id?: string | null;
};

async function readToken(): Promise<string | null> {
  if (Platform.OS === "web") {
    try {
      return globalThis.localStorage?.getItem(TOKEN_KEY) || null;
    } catch {
      return null;
    }
  }
  return await storage.secureGet<string>(TOKEN_KEY, "");
}

async function writeToken(token: string) {
  if (Platform.OS === "web") {
    try { globalThis.localStorage?.setItem(TOKEN_KEY, token); } catch {}
    return;
  }
  await storage.secureSet(TOKEN_KEY, token);
}

async function clearToken() {
  if (Platform.OS === "web") {
    try { globalThis.localStorage?.removeItem(TOKEN_KEY); } catch {}
    return;
  }
  await storage.secureRemove(TOKEN_KEY);
}

async function authedFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = await readToken();
  return fetch(`${BASE}/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
}

export const authApi = {
  getToken: readToken,

  async signup(name: string, email: string, password: string): Promise<AuthUser> {
    const r = await fetch(`${BASE}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.detail || "Signup failed");
    await writeToken(data.token);
    await storage.setItem("user_id", data.user.profile_id);
    return data.user as AuthUser;
  },

  async signin(email: string, password: string): Promise<AuthUser> {
    const r = await fetch(`${BASE}/api/auth/signin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.detail || "Sign in failed");
    await writeToken(data.token);
    await storage.setItem("user_id", data.user.profile_id);
    return data.user as AuthUser;
  },

  async googleExchange(sessionToken: string): Promise<AuthUser> {
    const r = await fetch(`${BASE}/api/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_token: sessionToken }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.detail || "Google sign-in failed");
    await writeToken(data.token);
    await storage.setItem("user_id", data.user.profile_id);
    return data.user as AuthUser;
  },

  async me(): Promise<AuthUser | null> {
    const r = await authedFetch("/auth/me");
    if (r.status === 401) {
      await clearToken();
      return null;
    }
    if (!r.ok) return null;
    return (await r.json()) as AuthUser;
  },

  async logout(): Promise<void> {
    try { await authedFetch("/auth/logout", { method: "POST" }); } catch {}
    await clearToken();
    await storage.removeItem("user_id");
  },

  async requestPasswordReset(email: string): Promise<void> {
    await fetch(`${BASE}/api/auth/reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
  },
};
