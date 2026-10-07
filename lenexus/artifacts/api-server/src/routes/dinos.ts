import { Router, type Request } from "express";
import * as Z from "@workspace/api-zod";
import { checkWrite, requireIdentity, hasSiteAdminRights } from "../lib/discord-auth";
import { requireSiteOwner } from "../lib/site-access";
import { HttpError, getTribeRow, rows, targetGuild } from "../lib/tribe-store";
import { requireCurrentServerMember } from "../lib/discord-players";
import { listSpecies, saveSpecies } from "../lib/dino-catalogue";
import { listRecords, saveRecord, deleteRecord, recordHistory } from "../lib/dino-records";
import { readPhoto } from "../lib/dino-photo";
import { createHash } from "node:crypto";

const router = Router();
async function requireCatalogueStaff(userId: string) {
  if (!await hasSiteAdminRights(userId, targetGuild() ?? ""))
    throw new HttpError(403, "Seuls les administrateurs et propriétaires du site peuvent ajouter des espèces.");
}
function id(value:unknown) {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 1) throw new HttpError(400,"Identifiant invalide.");
  return n;
}
function body<T>(schema:{parse:(input:unknown)=>T},req:Request):T {
  try {return schema.parse(req.body);} catch {throw new HttpError(400,"Vérifiez les champs et les nombres de points.");}
}
async function tribeAccess(req:Request,write=false) {
  const actor = write ? checkWrite(req) : requireIdentity(req), tribeId = id(req.params.id);
  const tribe = getTribeRow(tribeId), guild = targetGuild();
  if (!guild || String(tribe.guild_id) !== guild) throw new HttpError(403,"Cette tribu ne fait pas partie du serveur.");
  // Private breeding data: staff permissions alone do not grant tribe membership.
  if (String(tribe.proprietaire_id) !== actor.id &&
      !rows("SELECT 1 FROM membres WHERE tribu_id=? AND user_id=?",tribeId,BigInt(actor.id)).length)
    throw new HttpError(403,"Le suivi des dinos est réservé aux membres de cette tribu.");
  await requireCurrentServerMember(guild,actor.id);
  // Recheck after asynchronous Discord lookup; revoked membership cannot race a write.
  const current = getTribeRow(tribeId);
  if (String(current.guild_id) !== guild || (String(current.proprietaire_id) !== actor.id &&
      !rows("SELECT 1 FROM membres WHERE tribu_id=? AND user_id=?",tribeId,BigInt(actor.id)).length))
    throw new HttpError(403,"Vous n'êtes plus membre de cette tribu.");
  const tribeKey = createHash("sha256").update(`${guild}:${tribeId}:${String(current.created_at)}`).digest("hex");
  return {actor,tribeId,tribeKey};
}
router.get("/dino-catalogue",async(req,res) => {
  const actor = requireIdentity(req);
  const all = req.query.all === "true";
  if (all) await requireCatalogueStaff(actor.id);
  else {
    const guild = targetGuild();
    if (!guild) throw new HttpError(503,"Serveur Discord non configuré.");
    await requireCurrentServerMember(guild,actor.id);
  }
  res.json(Z.ListDinoSpeciesResponse.parse(await listSpecies(all)));
});
router.post("/dino-catalogue",async(req,res) => {
  const actor = checkWrite(req); await requireCatalogueStaff(actor.id);
  res.status(201).json(Z.CreateDinoSpeciesResponse.parse(await saveSpecies(body(Z.CreateDinoSpeciesBody,req))));
});
router.put("/dino-catalogue/:speciesId",async(req,res) => {
  const actor = checkWrite(req); requireSiteOwner(actor.id);
  res.json(Z.UpdateDinoSpeciesResponse.parse(await saveSpecies(body(Z.UpdateDinoSpeciesBody,req),id(req.params.speciesId))));
});
router.get("/tribes/:id/dino-records",async(req,res) => {
  const {tribeId,tribeKey}=await tribeAccess(req);
  res.json(Z.ListDinoRecordsResponse.parse(await listRecords(tribeId,tribeKey)));
});
router.put("/tribes/:id/dino-records/:speciesId",async(req,res) => {
  const {actor,tribeId,tribeKey}=await tribeAccess(req,true);
  res.json(Z.SaveDinoRecordResponse.parse(await saveRecord(tribeId,tribeKey,id(req.params.speciesId),actor.id,body(Z.SaveDinoRecordBody,req))));
});
router.delete("/tribes/:id/dino-records/:speciesId",async(req,res) => {
  const {actor,tribeId,tribeKey}=await tribeAccess(req,true), input=body(Z.DeleteDinoRecordBody,req);
  await deleteRecord(tribeId,tribeKey,id(req.params.speciesId),actor.id,input.revision,input.confirmed);
  res.json({status:"ok"});
});
router.get("/tribes/:id/dino-history",async(req,res) => {
  const {tribeId,tribeKey}=await tribeAccess(req);
  res.json(Z.ListDinoHistoryResponse.parse(await recordHistory(tribeId,tribeKey)));
});
router.post("/tribes/:id/dino-photo",async(req,res) => {
  const {actor}=await tribeAccess(req,true);
  const input=body(Z.ReadDinoPhotoBody,req);
  res.json(Z.ReadDinoPhotoResponse.parse(await readPhoto(actor.id,input.image)));
});
export default router;