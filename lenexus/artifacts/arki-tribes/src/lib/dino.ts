import type { DinoStats } from "@workspace/api-client-react";

export const STAT_KEYS = ["health", "stamina", "oxygen", "food", "weight", "melee", "speed"] as const;
export type StatKey = (typeof STAT_KEYS)[number];
export const STAT_LABELS: Record<StatKey, string> = {
  health: "Vie", stamina: "Endurance", oxygen: "Oxygène", food: "Nourriture", weight: "Poids", melee: "Dégâts mêlée", speed: "Vitesse",
};
export type Draft = Record<StatKey, string>;
export const emptyDraft = (): Draft => ({ health: "", stamina: "", oxygen: "", food: "", weight: "", melee: "", speed: "" });

export const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
export const show = (n: number | null | undefined) => (n === null || n === undefined ? "—" : String(n));

/** Empty -> null (unknown, never zero). Returns an error message for invalid fields. */
export function draftToStats(d: Draft): { stats: DinoStats; error: string | null } {
  const stats = {} as DinoStats;
  let error: string | null = null;
  for (const k of STAT_KEYS) {
    const raw = d[k].trim();
    if (raw === "") { stats[k] = null; continue; }
    const n = Number(raw);
    if (!/^\d+$/.test(raw) || !Number.isInteger(n) || n < 0 || n > 65535) {
      error = `${STAT_LABELS[k]} : entrez un entier de points de base entre 0 et 65535.`;
      stats[k] = null;
    } else stats[k] = n;
  }
  return { stats, error };
}

export type Direction = "higher" | "lower" | "equal" | "new" | "skip";
export function direction(oldV: number | null | undefined, newV: number | null): Direction {
  if (newV === null) return "skip";
  if (oldV === null || oldV === undefined) return "new";
  return newV > oldV ? "higher" : newV < oldV ? "lower" : "equal";
}
export const hasAnyStat = (s: DinoStats) => STAT_KEYS.some((k) => s[k] !== null);
export const statsToDraft = (s: DinoStats): Draft => {
  const d = emptyDraft();
  for (const k of STAT_KEYS) if (s[k] !== null) d[k] = String(s[k]);
  return d;
};
export const isConflict = (e: unknown) => (e as { status?: number } | null)?.status === 409;
