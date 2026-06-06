// Single source of truth for exercise / equipment media.
// Hits /api/media/{key} (admin-uploaded photos/GIFs).
// When no admin media exists, returns "" — callers render ExerciseIllustration instead.
// Caches results in-memory for the session.

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
    try {
      const m = await api.getMediaByKey(key);
      const uri = `data:${m.content_type};base64,${m.data_base64}`;
      cache.set(key, uri);
      return uri;
    } catch {
      cache.set(key, "");
      return "";
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
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
