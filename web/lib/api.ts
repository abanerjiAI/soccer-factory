/** Client for the PHP API (api/index.php). Same-origin, relative URL, so the site works from any sub-folder. */
import { clearGate, storedGate } from "./gate";

export interface SavePayload {
  kind: string;
  mode: string;
  title: string;
  config: unknown;
  summary: unknown;
  hash: string;
  seed: number;
  trials: number;
  stage?: string;
  uncertainty?: string;
  notes?: string;
}

const KEY = "ie_client_id";
/** Random id that keeps this browser's saved runs apart from other visitors'. Not a login. */
export function clientId(): string {
  try {
    let id = localStorage.getItem(KEY);
    if (!id || !/^[A-Za-z0-9_-]{16,64}$/.test(id)) {
      const a = new Uint8Array(18);
      crypto.getRandomValues(a);
      id = "c_" + Array.from(a, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 30);
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return "c_session_only_" + Math.random().toString(36).slice(2, 12);
  }
}

export const API_URL = "api/index.php";
const url = (route: string) => `${API_URL}?r=${route}`;

/** A failed API call. `code` lets the UI react to `gate_required` without matching on the message text. */
export class ApiError extends Error {
  code?: string;
  status: number;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export async function api<T = unknown>(route: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const gate = storedGate();
  let res: Response;
  try {
    res = await fetch(url(route), {
      method: init.method ?? (init.body ? "POST" : "GET"),
      headers: {
        "Content-Type": "application/json",
        "X-Client-Id": clientId(),
        ...(gate ? { "X-Gate-Token": gate.token } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiError("Cannot reach the server API. Saving and the Coach need the PHP part of the site (see Help).", 0);
  }
  const text = await res.text();
  let j: unknown = null;
  try {
    j = JSON.parse(text);
  } catch {
    /* not JSON: the PHP part is probably not running */
  }
  if (j === null) throw new ApiError("The server API is not available here (this looks like a static preview without PHP).", res.status);
  if (!res.ok) {
    const body = j as { error?: string; code?: string };
    if (body.code === "gate_required") clearGate();
    throw new ApiError(body.error ?? res.statusText, res.status, body.code);
  }
  return j as T;
}

export async function saveExperiment(p: SavePayload): Promise<string> {
  const { MODEL_VERSION, SOFTWARE_VERSION } = await import("@/engine/types");
  const r = await api<{ id: string }>("experiments", {
    body: { kind: p.kind, mode: p.mode, title: p.title, config: p.config, summary: p.summary, resultHash: p.hash, seed: p.seed, trials: p.trials, stage: p.stage ?? "analysis-output", uncertainty: p.uncertainty, notes: p.notes, modelVersion: MODEL_VERSION, softwareVersion: SOFTWARE_VERSION },
  });
  return r.id;
}
