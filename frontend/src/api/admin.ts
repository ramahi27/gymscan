import { Platform } from "react-native";
import { storage } from "@/src/utils/storage";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;
const TOKEN_KEY = "auth_token";

export async function getAuthToken(): Promise<string | null> {
  if (Platform.OS === "web") {
    try { return globalThis.localStorage?.getItem(TOKEN_KEY) || null; } catch { return null; }
  }
  return await storage.secureGet<string>(TOKEN_KEY, "");
}

export async function adminAuthedFetch(path: string, options: RequestInit = {}) {
  const token = await getAuthToken();
  const res = await fetch(`${BASE}/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json();
}

export const adminApi = {
  listMedia: () => adminAuthedFetch("/admin/media"),
  uploadMedia: (body: { exercise_key: string; content_type: string; data_base64: string }) =>
    adminAuthedFetch("/admin/media", { method: "POST", body: JSON.stringify(body) }),
  deleteMedia: (id: string) => adminAuthedFetch(`/admin/media/${id}`, { method: "DELETE" }),
};
