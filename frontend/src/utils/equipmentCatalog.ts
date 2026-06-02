// Master equipment catalog used by the manual picker.
export type EquipCategory =
  | "Cardio"
  | "Free Weights"
  | "Machines"
  | "Benches & Racks"
  | "Cables & Attachments"
  | "Bodyweight";

export const EQUIPMENT_CATALOG: { category: EquipCategory; items: string[] }[] = [
  { category: "Cardio", items: ["Treadmill", "Stationary Bike", "Rowing Machine", "Elliptical", "Stair Climber", "Air Bike"] },
  { category: "Free Weights", items: ["Dumbbells", "Barbell", "EZ Curl Bar", "Kettlebell", "Weight Plates", "Medicine Ball"] },
  { category: "Machines", items: ["Smith Machine", "Leg Press", "Hack Squat", "Chest Press Machine", "Shoulder Press Machine", "Lat Pulldown", "Seated Row", "Leg Curl", "Leg Extension", "Hip Abductor", "Hip Adductor", "Pec Deck", "Cable Crossover", "Assisted Pull-up Machine"] },
  { category: "Benches & Racks", items: ["Flat Bench", "Incline Bench", "Decline Bench", "Squat Rack", "Power Rack", "Preacher Curl Bench"] },
  { category: "Cables & Attachments", items: ["Cable Tower", "Functional Trainer", "Resistance Bands", "TRX Suspension"] },
  { category: "Bodyweight", items: ["Pull-up Bar", "Dip Station", "Ab Wheel", "Jump Rope", "Foam Roller", "Yoga Mat"] },
];
