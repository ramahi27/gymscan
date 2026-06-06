// Single source of truth for exercise / equipment media.
//
// Resolution order:
//   1. Admin-uploaded photo/GIF  → /api/media/{key}   (data: URI, served as base64)
//   2. ExerciseDB animated GIF   → /api/exercise-gif/{name}  (https: URL)
//   3. ""  → caller renders ExerciseIllustration SVG fallback
//
// Results are cached in-memory for the session.

import { useEffect, useState } from "react";
import { api } from "@/src/api/client";

const cache = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();

export function normaliseKey(name: string): string {
  return (name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function resolveMediaUri(name: string): Promise<string> {
  const key = normaliseKey(name);
  if (!key) return "";
  if (cache.has(key)) return cache.get(key)!;
  if (inflight.has(key)) return inflight.get(key)!;

  const p = (async () => {
    // 1. Admin-uploaded media (base64 data URI)
    try {
      const m = await api.getMediaByKey(key);
      const uri = `data:${m.content_type};base64,${m.data_base64}`;
      cache.set(key, uri);
      return uri;
    } catch {}

    // 2. ExerciseDB animated GIF (https URL)
    try {
      const { gif_url } = await api.getExerciseGif(name);
      if (gif_url) {
        cache.set(key, gif_url);
        return gif_url;
      }
    } catch {}

    // 3. Nothing found — caller shows SVG illustration
    cache.set(key, "");
    return "";
  })();

  inflight.set(key, p);
  p.finally(() => inflight.delete(key));
  return p;
}

export function invalidateMediaCache(name?: string) {
  if (!name) { cache.clear(); return; }
  cache.delete(normaliseKey(name));
}

export function useExerciseMedia(name: string): string {
  const [uri, setUri] = useState<string>(() => cache.get(normaliseKey(name)) ?? "");
  useEffect(() => {
    let alive = true;
    resolveMediaUri(name).then(u => { if (alive) setUri(u); });
    return () => { alive = false; };
  }, [name]);
  return uri;
}
