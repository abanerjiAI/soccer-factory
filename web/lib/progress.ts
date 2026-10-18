import { useEffect, useState } from "react";

/** Everything the student writes or ticks stays in THIS browser (localStorage). Nothing is sent to the server. */
const VISITED = "ie_visited";
const NOTES = "ie_notebook_v1";

const readJson = <T,>(k: string, d: T): T => {
  try {
    const s = localStorage.getItem(k);
    return s ? (JSON.parse(s) as T) : d;
  } catch {
    return d;
  }
};
const writeJson = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* private mode / quota: progress is a convenience only */
  }
};

export function markVisited(path: string) {
  const v = new Set(readJson<string[]>(VISITED, []));
  if (!v.has(path)) {
    v.add(path);
    writeJson(VISITED, [...v]);
    window.dispatchEvent(new Event("ie-progress"));
  }
}
export function useVisited(): Set<string> {
  const [s, setS] = useState(() => new Set(readJson<string[]>(VISITED, [])));
  useEffect(() => {
    const h = () => setS(new Set(readJson<string[]>(VISITED, [])));
    window.addEventListener("ie-progress", h);
    return () => window.removeEventListener("ie-progress", h);
  }, []);
  return s;
}

export interface NoteEntry {
  result: string;
  surprise: string;
  limit: string;
  ownWords: string;
  done: boolean;
}
export type Notebook = Record<string, NoteEntry>;
export const emptyNote = (): NoteEntry => ({ result: "", surprise: "", limit: "", ownWords: "", done: false });
export const loadNotebook = (): Notebook => readJson<Notebook>(NOTES, {});
export const saveNotebook = (n: Notebook) => {
  writeJson(NOTES, n);
  window.dispatchEvent(new Event("ie-progress"));
};
