import type { Progression } from "@workspace/api-zod";
import { HttpError, options, run } from "./tribe-store";

export function writeProgression(tribeId: number, guild: string, data: Progression) {
  const allowed = options(guild);
  for (const [key, values] of Object.entries(data)) {
    const choices = key.toLowerCase().includes("boss") ? allowed.boss : allowed.notes;
    if (values.some((v: string) => !choices.includes(v))) throw new HttpError(400, "Une progression contient un choix inconnu.");
  }
  if (data.boss.some(v => data.pendingBoss.includes(v)) || data.notes.some(v => data.pendingNotes.includes(v)))
    throw new HttpError(400, "Un objectif ne peut pas être validé et non validé en même temps.");
  run("UPDATE tribus SET progression_boss=?,progression_notes=?,progression_boss_non_valides=?,progression_notes_non_valides=? WHERE id=?",
    [...new Set(data.boss)].join(","), [...new Set(data.notes)].join(","), [...new Set(data.pendingBoss)].join(","), [...new Set(data.pendingNotes)].join(","), tribeId);
}