const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export type Profile = {
  id: string;
  name: string;
  goal: string;
  level: string;
  days_per_week: number;
  streak: number;
  is_pro: boolean;
  scans_used: number;
  height_cm?: number | null;
  weight_kg?: number | null;
  gender?: string | null;
  unit_pref?: "metric" | "imperial";
  photo_b64?: string | null;
  created_at: string;
};

export type ProfileUpdate = Partial<{
  name: string;
  goal: string;
  level: string;
  days_per_week: number;
  height_cm: number | null;
  weight_kg: number | null;
  gender: string | null;
  unit_pref: "metric" | "imperial";
  photo_b64: string | null;
}>;

export type DetectedEquipment = { name: string; confidence?: string; category?: string };

export type ScanResult = {
  id: string;
  user_id: string;
  detected_equipment: DetectedEquipment[];
  created_at: string;
};

export type Exercise = {
  name: string;
  muscle_group: string;
  equipment_needed: string;
  sets: number;
  reps: number | string; // backend now returns int but old plans may have strings
  rest_seconds: number;
  instructions: string;
};

export type PlanDay = { day_index: number; day_name: string; focus: string; exercises: Exercise[] };

export type WorkoutPlan = {
  id: string;
  user_id: string;
  scan_id?: string | null;
  plan: { split_name: string; days: PlanDay[] };
  created_at: string;
};

export type MediaItem = {
  id: string;
  exercise_key: string;
  content_type: string;
  data_base64: string;
  uploaded_by?: string;
  uploaded_at: string;
};

export type CompletedSet = {
  suggested_weight: string;
  suggested_reps: string;
  actual_weight_input: string;
  actual_weight_kg: number;
  actual_reps: string;
  done: boolean;
};

export type CompletedExercise = {
  name: string;
  sets: CompletedSet[];
};

export type SessionLog = {
  id: string;
  user_id: string;
  plan_id: string;
  day_index: number;
  completed_exercises: CompletedExercise[];
  date: string;
};

export const api = {
  createProfile: (body: { name: string; goal: string; level: string; days_per_week: number; height_cm?: number | null; weight_kg?: number | null; gender?: string | null; unit_pref?: string }) =>
    request<Profile>("/profile", { method: "POST", body: JSON.stringify(body) }),
  getProfile: (id: string) => request<Profile>(`/profile/${id}`),
  updateProfile: (id: string, body: ProfileUpdate) =>
    request<Profile>(`/profile/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  scan: (body: { user_id: string; images_base64: string[] }) =>
    request<ScanResult>("/scan", { method: "POST", body: JSON.stringify(body) }),
  generatePlan: (body: { user_id: string; scan_id?: string; equipment: string[] }) =>
    request<WorkoutPlan>("/plan", { method: "POST", body: JSON.stringify(body) }),
  listPlans: (user_id: string) => request<WorkoutPlan[]>(`/plans/${user_id}`),
  getPlan: (plan_id: string) => request<WorkoutPlan>(`/plan/${plan_id}`),
  logSession: (body: { user_id: string; plan_id: string; day_index: number; completed_exercises: CompletedExercise[] }) =>
    request<SessionLog>("/session", { method: "POST", body: JSON.stringify(body) }),
  listSessions: (user_id: string) => request<SessionLog[]>(`/sessions/${user_id}`),
  getMediaByKey: (key: string) => request<{ exercise_key: string; content_type: string; data_base64: string }>(`/media/${encodeURIComponent(key)}`),
};
