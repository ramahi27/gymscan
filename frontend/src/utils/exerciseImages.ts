// Curated keyword → image URL map for exercises and equipment.
// Uses free Unsplash images so it works without any API key.
// To upgrade: swap getImageForName with a call to ExerciseDB API.

const IMAGE_MAP: { keywords: string[]; url: string }[] = [
  { keywords: ["dumbbell", "db "], url: "https://images.unsplash.com/photo-1638536532686-d610adfc8e5c?w=400&q=60" },
  { keywords: ["barbell", "bench press", "deadlift"], url: "https://images.unsplash.com/photo-1532029837206-abbe2b7620e3?w=400&q=60" },
  { keywords: ["squat", "leg press", "lunge"], url: "https://images.unsplash.com/photo-1574680096145-d05b474e2155?w=400&q=60" },
  { keywords: ["cable", "crossover", "pulldown", "lat"], url: "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=400&q=60" },
  { keywords: ["pull-up", "pull up", "pullup", "chin"], url: "https://images.unsplash.com/photo-1599058917212-d750089bc07e?w=400&q=60" },
  { keywords: ["treadmill", "run"], url: "https://images.unsplash.com/photo-1605296867424-35fc25c9212a?w=400&q=60" },
  { keywords: ["bike", "cycle", "spin"], url: "https://images.unsplash.com/photo-1591741535018-d042766c62eb?w=400&q=60" },
  { keywords: ["row", "rower"], url: "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=400&q=60" },
  { keywords: ["kettlebell"], url: "https://images.unsplash.com/photo-1517344884509-a0c97ec11bcc?w=400&q=60" },
  { keywords: ["bench"], url: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&q=60" },
  { keywords: ["smith machine"], url: "https://images.unsplash.com/photo-1652385282080-77c7f1e1cab9?w=400&q=60" },
  { keywords: ["chest", "pec", "fly"], url: "https://images.unsplash.com/photo-1532384748853-8f54a8f476e2?w=400&q=60" },
  { keywords: ["shoulder", "overhead press", "lateral"], url: "https://images.unsplash.com/photo-1532029837206-abbe2b7620e3?w=400&q=60" },
  { keywords: ["bicep", "curl"], url: "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=400&q=60" },
  { keywords: ["tricep", "dip", "pushdown"], url: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&q=60" },
  { keywords: ["abs", "plank", "crunch", "core"], url: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=400&q=60" },
  { keywords: ["band", "resistance"], url: "https://images.unsplash.com/photo-1598971639058-fab3c3109a00?w=400&q=60" },
  { keywords: ["medicine ball", "med ball"], url: "https://images.unsplash.com/photo-1518310383802-640c2de311b2?w=400&q=60" },
  { keywords: ["mat", "yoga"], url: "https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=400&q=60" },
  { keywords: ["elliptical"], url: "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=400&q=60" },
  { keywords: ["stair", "climber"], url: "https://images.unsplash.com/photo-1605296867424-35fc25c9212a?w=400&q=60" },
];

const PLACEHOLDER = "https://images.unsplash.com/photo-1576678927484-cc907957088c?w=400&q=60";

export function getImageForName(name: string): string {
  const n = name.toLowerCase();
  for (const entry of IMAGE_MAP) {
    if (entry.keywords.some(k => n.includes(k))) return entry.url;
  }
  return PLACEHOLDER;
}
