import type { DinoStats, DinoRecord, DinoRecordInput } from "@workspace/api-zod";
import { HttpError } from "./tribe-store";
import { dinoRows as rows, dinoRun as run, dinoTransaction } from "./dino-db";
import { initDinos, speciesById, availableSpecies, decodeSpecies } from "./dino-catalogue";

export const statKeys = ["health", "stamina", "oxygen", "food", "weight", "melee", "speed"] as const;
export const emptyStats = (): DinoStats => ({ health:null, stamina:null, oxygen:null, food:null, weight:null, melee:null, speed:null });
export function mergeStats(old: DinoStats, proposed: DinoStats, mode: "best" | "replace"): DinoStats {
  const merged = emptyStats();
  for (const key of statKeys) merged[key] = proposed[key] === null ? old[key] :
    mode === "best" && old[key] !== null ? Math.max(old[key]!, proposed[key]!) : proposed[key];
  return merged;
}
export async function listRecords(tribeId: number,tribeKey:string): Promise<DinoRecord[]> {
  await initDinos();
  return (await rows(`SELECT r.*,s.name AS species_name,s.origin,s.mod_id,s.maps,s.source_url,s.active,s.revision AS species_revision
    FROM site_dino_records r JOIN site_dino_species s ON s.id=r.species_id
    WHERE r.tribe_key=? ORDER BY r.updated_at DESC`, tribeKey)).map(r => ({
    species: (() => { const species = decodeSpecies({...r,id:r.species_id,name:r.species_name,revision:r.species_revision}); return { ...species, active: availableSpecies(species) }; })(),
    tribeId, stats: JSON.parse(String(r.stats)),
    revision: Number(r.revision), updatedAt: String(r.updated_at), note: String(r.note), source: r.source as DinoRecord["source"],
  }));
}
async function log(tribeId:number,tribeKey:string, speciesId:number, actor:string, action:string, before:DinoStats|null, after:DinoStats|null) {
  await run("INSERT INTO site_dino_history(tribe_id,tribe_key,species_id,actor,action,before_stats,after_stats,created_at) VALUES(?,?,?,?,?,?,?,?)",
    tribeId,tribeKey,speciesId,actor,action,before && JSON.stringify(before),after && JSON.stringify(after),new Date().toISOString());
}
export async function saveRecord(tribeId: number,tribeKey:string, speciesId: number, actor: string, input: DinoRecordInput) {
  await initDinos();
  if (!input.confirmed) throw new HttpError(400, "La comparaison doit être confirmée avant l'enregistrement.");
  if (statKeys.some(k => input.stats[k] !== null && (!Number.isSafeInteger(input.stats[k]) || input.stats[k]! < 0 || input.stats[k]! > 65535)))
    throw new HttpError(400, "Les points doivent être des nombres entiers positifs ou zéro.");
  if (statKeys.every(k => input.stats[k] === null)) throw new HttpError(400, "Renseignez au moins un nombre de points de base.");
  return dinoTransaction(`dino-record:${tribeKey}:${speciesId}`,async () => {
    const species = await speciesById(speciesId);
    const previous = (await listRecords(tribeId,tribeKey)).find(r => r.species.id === speciesId);
    // Keep revision monotonic across delete/recreate, preventing stale drafts (ABA).
    const latest = Number((await rows("SELECT id FROM site_dino_history WHERE tribe_key=? AND species_id=? ORDER BY id DESC LIMIT 1",tribeKey,speciesId))[0]?.id || 0);
    if ((previous?.revision || 0) !== input.revision) throw new HttpError(409, "Ces records ont été modifiés par un autre joueur. Rechargez et vérifiez la nouvelle comparaison.");
    if (!previous && !availableSpecies(species)) throw new HttpError(400, "Cette espèce n'est pas active sur les maps et mods du site.");
    const stats = mergeStats(previous?.stats || emptyStats(), input.stats, input.mode);
    await log(tribeId,tribeKey,speciesId,actor,previous ? input.mode : "create",previous?.stats || null,stats);
    const revision = Math.max(previous?.revision || 0,latest) + 1;
    await run(`INSERT INTO site_dino_records(tribe_id,tribe_key,species_id,stats,revision,note,source,updated_at) VALUES(?,?,?,?,?,?,?,?)
      ON CONFLICT(tribe_key,species_id) DO UPDATE SET stats=excluded.stats,revision=excluded.revision,note=excluded.note,source=excluded.source,updated_at=excluded.updated_at`,
      tribeId,tribeKey,speciesId,JSON.stringify(stats),revision,input.note.trim(),input.source,new Date().toISOString());
    return (await listRecords(tribeId,tribeKey)).find(r => r.species.id === speciesId)!;
  });
}
export async function deleteRecord(tribeId:number,tribeKey:string,speciesId:number,actor:string,revision:number,confirmed:boolean) {
  await initDinos();
  if (!confirmed) throw new HttpError(400, "Confirmez la suppression de cette fiche.");
  await dinoTransaction(`dino-record:${tribeKey}:${speciesId}`,async () => {
    const previous = (await listRecords(tribeId,tribeKey)).find(r => r.species.id === speciesId);
    if (!previous) throw new HttpError(404, "Fiche introuvable.");
    if (previous.revision !== revision) throw new HttpError(409, "La fiche a changé. Rechargez avant de supprimer.");
    await log(tribeId,tribeKey,speciesId,actor,"delete",previous.stats,null);
    await run("DELETE FROM site_dino_records WHERE tribe_key=? AND species_id=?",tribeKey,speciesId);
  });
}
export async function recordHistory(_tribeId:number,tribeKey:string) {
  await initDinos();
  return (await rows(`SELECT h.*,s.name FROM site_dino_history h JOIN site_dino_species s ON s.id=h.species_id
    WHERE h.tribe_key=? ORDER BY h.id DESC LIMIT 100`,tribeKey)).map(r => ({
      id:Number(r.id),speciesName:String(r.name),action:String(r.action),
      before:r.before_stats ? JSON.parse(String(r.before_stats)) : null,
      after:r.after_stats ? JSON.parse(String(r.after_stats)) : null,createdAt:String(r.created_at),
    }));
}