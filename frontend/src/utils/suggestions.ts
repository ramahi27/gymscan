// Pre-fill weight & rep suggestions based on level + goal.
// Returns single-integer reps and a baseline starting weight in kg.
export type Level = "beginner" | "intermediate" | "advanced";
export type Goal = "muscle_gain" | "weight_loss" | "endurance";

export function suggestReps(level: string, goal: string): number {
  const l = (level || "beginner").toLowerCase();
  const g = (goal || "muscle_gain").toLowerCase();
  if (g === "weight_loss") return 15;
  if (g === "endurance") return 20;
  if (l === "beginner") return 12;
  if (l === "intermediate") return 10;
  if (l === "advanced") return 6;
  return 10;
}

// Baseline starting weight in kg. A rough heuristic — user always edits live.
export function suggestStartingWeightKg(level: string, goal: string, equipment: string): number {
  const eq = (equipment || "").toLowerCase();
  const isBodyweight = eq.includes("body") || eq.includes("pull-up") || eq.includes("dip");
  if (isBodyweight) return 0;
  const l = (level || "beginner").toLowerCase();
  const g = (goal || "muscle_gain").toLowerCase();
  const base = eq.includes("dumbbell") ? 8 : eq.includes("barbell") || eq.includes("smith") ? 30 : 15;
  const goalMult = g === "weight_loss" ? 0.7 : g === "endurance" ? 0.5 : 1.0;
  const lvlMult = l === "beginner" ? 0.7 : l === "intermediate" ? 1.0 : 1.4;
  return Math.round(base * goalMult * lvlMult);
}

export function suggestedRestSeconds(goal: string, fallback: number): number {
  const g = (goal || "muscle_gain").toLowerCase();
  if (g === "weight_loss") return 30;
  if (g === "endurance") return 20;
  return fallback || 90;
}
