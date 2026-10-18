/**
 * Client for the live-Coach gate. One arithmetic question unlocks the paid AI in THIS browser for 24 hours.
 * Nothing about the person is sent: the server signs an expiry plus a salted hash of the visitor address and
 * returns an HMAC token, which is stored here. Clearing site data simply means answering one more sum.
 */
const KEY = "ie_coach_gate";
const API_URL = "api/index.php";

export interface StoredGate {
  token: string;
  expiresAt: number;
}

export function storedGate(): StoredGate | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const j = JSON.parse(raw) as StoredGate;
    if (!j || typeof j.token !== "string" || typeof j.expiresAt !== "number") return null;
    if (j.expiresAt * 1000 <= Date.now()) {
      localStorage.removeItem(KEY);
      return null;
    }
    return j;
  } catch {
    return null;
  }
}

export function clearGate() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* private mode: nothing to clear */
  }
}

function store(token: string, expiresAt: number) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ token, expiresAt }));
  } catch {
    /* private mode: the unlock lasts for this page only */
  }
}

/** Hours left on the current unlock, or 0 when locked. */
export function gateHoursLeft(): number {
  const g = storedGate();
  return g ? Math.max(0, Math.round((g.expiresAt * 1000 - Date.now()) / 3600000)) : 0;
}

export interface Challenge {
  required: boolean;
  a: number;
  b: number;
  exp: number;
  sig: string;
  seconds: number;
}

async function post(route: string, body?: unknown, method = "POST") {
  const res = await fetch(`${API_URL}?r=${route}`, {
    method: body ? method : "GET",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok) {
    const err = new Error((j?.error as string) ?? res.statusText) as Error & { code?: string; status?: number };
    err.code = (j?.code as string) ?? undefined;
    err.status = res.status;
    throw err;
  }
  return j as unknown as Challenge & { token?: string; expiresAt?: number; required?: boolean };
}

/** Ask the server for a sum. `required: false` means this server has no key, so there is nothing to unlock. */
export async function fetchChallenge(): Promise<Challenge> {
  return post("gate/challenge");
}

/** Answer the sum. Stores the token and returns the hours it is good for. */
export async function answerChallenge(c: Challenge, answer: string): Promise<number> {
  const r = await post("gate/verify", { a: c.a, b: c.b, exp: c.exp, sig: c.sig, answer: Number(answer) });
  if (typeof r.token !== "string" || typeof r.expiresAt !== "number") throw new Error("The server did not return an unlock token.");
  store(r.token, r.expiresAt);
  return Math.max(1, Math.round((r.expiresAt * 1000 - Date.now()) / 3600000));
}
