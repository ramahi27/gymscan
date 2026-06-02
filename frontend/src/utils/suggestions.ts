// Pre-fill weight & rep suggestions based on level + goal.
export type Level = "beginner" | "intermediate" | "advanced";
export type Goal = "muscle_gain" | "weight_loss" | "endurance";

export function suggestForExercise(level: string, goal: string, exerciseDefaultReps: string): { reps: string; weight: string } {
  const l = (level || "beginner").toLowerCase() as Level;
  const g = (goal || "muscle_gain").toLowerCase() as Goal;

  if (g === "weight_loss") return { reps: "15-20", weight: "" };
  if (g === "endurance") return { reps: "20-30", weight: "" };

  // muscle_gain branch by level
  if (l === "beginner") return { reps: "12-15", weight: "" };
  if (l === "intermediate") return { reps: "8-12", weight: "" };
  if (l === "advanced") return { reps: "4-6", weight: "" };

  return { reps: exerciseDefaultReps, weight: "" };
}

// Returns suggested rest in seconds based on goal.
export function suggestedRest(goal: string, fallback: number): number {
  const g = (goal || "muscle_gain").toLowerCase();
  if (g === "weight_loss") return 30;
  if (g === "endurance") return 20;
  return fallback || 60;
}
