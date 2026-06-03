// Single source of truth for exercise / equipment media.
// Always hits the backend at /api/media/{key} (which serves admin-uploaded
// photos/GIFs). On miss, falls back to the keyword-matched Unsplash mapper.
// Caches results in-memory for the session so multiple screens don't refetch.

import { useEffect, useState } from "react";
import { api } from "@/src/api/client";
import { getImageForName } from "@/src/utils/exerciseImages";

const cache = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();

export function normaliseKey(name: string): string {
  return (name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function resolveMediaUri(name: string, fallbackHint = ""): Promise<string> {
  const key = normaliseKey(name);
  if (!key) return getImageForName(fallbackHint || name);
  if (cache.has(key)) return cache.get(key)!;
  if (inflight.has(key)) return inflight.get(key)!;
  const p = (async () => {
    try {
      const m = await api.getMediaByKey(key);
      const uri = `data:${m.content_type};base64,${m.data_base64}`;
      cache.set(key, uri);
      return uri;
    } catch {
      const uri = getImageForName(`${name} ${fallbackHint}`);
      cache.set(key, uri);
      return uri;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

// Clear cache when admin updates media so other screens refetch on focus.
export function invalidateMediaCache(name?: string) {
  if (!name) { cache.clear(); return; }
  cache.delete(normaliseKey(name));
}

export function useExerciseMedia(name: string, fallbackHint = ""): string {
  const [uri, setUri] = useState<string>(() => {
    const k = normaliseKey(name);
    return cache.get(k) || getImageForName(`${name} ${fallbackHint}`);
  });
  useEffect(() => {
    let alive = true;
    resolveMediaUri(name, fallbackHint).then(u => { if (alive) setUri(u); });
    return () => { alive = false; };
  }, [name, fallbackHint]);
  return uri;
}
