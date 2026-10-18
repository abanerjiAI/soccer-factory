/** Seeded pseudo-random utilities. Every stochastic quantity in the project is derived from a recorded integer seed. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Mix several integers into one 32-bit seed (pure function: same inputs -> same seed). */
export function hashSeed(...n: number[]): number {
  let h = 2166136261 >>> 0;
  for (const v of n) {
    h ^= Math.floor(v) >>> 0;
    h = Math.imul(h, 16777619) >>> 0;
    h ^= h >>> 13;
    h = Math.imul(h, 0x5bd1e995) >>> 0;
  }
  return h >>> 0;
}

export function gaussian(rng: () => number): number {
  const u = Math.max(rng(), 1e-12);
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function hashString(s: string): string {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/** Hash of any JSON-able value with numbers rounded to 5 decimals (tolerates last-ulp differences between JS engines). */
export function stableHash(value: unknown): string {
  const s = JSON.stringify(value, (_k, v) => {
    if (typeof v === "number") return Number.isFinite(v) ? Math.round(v * 1e5) / 1e5 : String(v);
    if (v instanceof Float32Array || v instanceof Uint8Array) return undefined;
    return v;
  });
  return hashString(s ?? "");
}
