// Unit conversion helpers
export function cmToFtIn(cm: number): { ft: number; inches: number } {
  const totalIn = cm / 2.54;
  const ft = Math.floor(totalIn / 12);
  const inches = Math.round(totalIn - ft * 12);
  return { ft, inches };
}

export function ftInToCm(ft: number, inches: number): number {
  return Math.round((ft * 12 + inches) * 2.54);
}

export function kgToLbs(kg: number): number {
  return Math.round(kg * 2.20462);
}

export function lbsToKg(lbs: number): number {
  return Math.round(lbs / 2.20462);
}

export function formatHeight(cm: number | null | undefined, pref: "metric" | "imperial"): string {
  if (!cm) return "—";
  if (pref === "metric") return `${Math.round(cm)} cm`;
  const { ft, inches } = cmToFtIn(cm);
  return `${ft}' ${inches}"`;
}

export function formatWeight(kg: number | null | undefined, pref: "metric" | "imperial"): string {
  if (!kg) return "—";
  if (pref === "metric") return `${Math.round(kg)} kg`;
  return `${kgToLbs(kg)} lbs`;
}

export function weightUnitLabel(pref: "metric" | "imperial"): string {
  return pref === "imperial" ? "lbs" : "kg";
}

// Convert a stored kg value into the display number for the user's preference.
export function displayWeight(kg: number | null | undefined, pref: "metric" | "imperial"): number | null {
  if (kg == null) return null;
  return pref === "imperial" ? kgToLbs(kg) : Math.round(kg);
}

// Convert a user-entered display value back into kg for storage.
export function inputWeightToKg(value: number, pref: "metric" | "imperial"): number {
  return pref === "imperial" ? lbsToKg(value) : value;
}
