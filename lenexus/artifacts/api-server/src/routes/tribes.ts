import { Router, type Request, type Response, type NextFunction } from "express";
import * as Z from "@workspace/api-zod";
import {
  HttpError, rows, run, transaction, targetGuild, getTribeRow, options,
  tribeSummary, tribeDetail, recordActivity, isRecruiting, tribeCoverUrl, setTribeCover, type Row,
} from "../lib/tribe-store";
import { identity, requireIdentity, checkWrite, guildRights, hasSiteAdminRights, session, startLogin, finishLogin, logout } from "../lib/discord-auth";
import { isSiteOwner, siteGrant } from "../lib/site-access";
import siteAccessRouter from "./site-access";
import siteModsRouter from "./site-mods";
import siteMapsRouter from "./site-maps";
import siteBrandingRouter from "./site-branding";
import { Readable } from "node:stream";
import { mediaUrl, originalGalleryUrl, publishedImage } from "../lib/tribe-media";
import { brandingStorage } from "../lib/site-branding";
import tribeUploadsRouter from "./tribe-uploads";
import { ownedImageUrl } from "../lib/tribe-uploads";
import { discordPlayers, verifyPlayer, requireCurrentServerMember } from "../lib/discord-players";
import { writeProgression } from "../lib/tribe-progression";
import { reviewTribes } from "../lib/tribe-review";
import { runInPlayerView } from "../lib/request-view";
import dinosRouter from "./dinos";
import guidesRouter from "./guides";
import shopRouter from "./shop";
import arkiRouter from "./arki";

const router = Router();
router.use((req, _res, next) => {
  // Only lower this caller's privileges for this request; never edit grants.
  const actor = identity(req);
  if (req.get("X-Arki-View") === "player" && actor) {
    runInPlayerView(actor.id, next);
  } else next();
});
router.use(siteModsRouter);
router.use(siteMapsRouter);
router.use("/site-access",siteAccessRouter);
router.use(siteBrandingRouter);
router.use(tribeUploadsRouter);
router.use(dinosRouter);
router.use(guidesRouter);
router.use(shopRouter);
router.use(arkiRouter);
const now = () => new Date().toISOString();
const text = (value:unknown) => String(value || "").trim();
function id(req:Request) {
  const value=Number(req.params.id);
  if (!Number.isSafeInteger(value) || value<1) throw new HttpError(400,"Identifiant de tribu invalide.");
  return value;
}
function positive(value:unknown) {
  const n=Number(value);if (!Number.isSafeInteger(n) || n<1) throw new HttpError(400,"Identifiant invalide.");return n;
}
function body<T>(schema:{parse:(input:unknown)=>T},req:Request):T {
  try {return schema.parse(req.body);} catch {throw new HttpError(400,"Vérifiez les champs du formulaire.");}
}
function imageUrl(value:string,actor:string,kind:"logo"|"cover"|"gallery") {
  if (!value) return "";
  if (ownedImageUrl(value,actor,kind)) return value;
  try { const url=new URL(value);if (url.protocol!=="https:" || url.username || url.password) throw new Error();return url.toString(); }
  catch {throw new HttpError(400,"Les images doivent utiliser une URL HTTPS valide.");}
}
function permissions(row:Row,userId:string|null,admin:boolean) {
  const owner=userId!==null && String(row.proprietaire_id)===userId;
  const manager=userId!==null && !!rows("SELECT manager FROM membres WHERE tribu_id=? AND user_id=?",Number(row.id),BigInt(userId))[0]?.manager;
  const grant=userId?siteGrant(userId):undefined;
  const elevated=!!userId && admin && (isSiteOwner(userId) || (grant?.role==="admin" && grant.guildId===String(row.guild_id)));
  return {canManage:owner || elevated,canEdit:owner || elevated || manager};
}
async function access(req:Request,row:Row) {
  const user=identity(req);
  // Normal tribe owner/manager editing does not depend on Discord availability.
  const admin=user ? await hasSiteAdminRights(user.id,String(row.guild_id)) : false;
  return permissions(row,user?.id || null,admin);
}
async function mutation(req:Request,callback:(row:Row,userId:string,p:{canEdit:boolean,canManage:boolean})=>void,manage=false) {
  const user=checkWrite(req),tribeId=id(req),initial=getTribeRow(tribeId);
  const admin=await hasSiteAdminRights(user.id,String(initial.guild_id));
  return transaction(()=>{
    const row=getTribeRow(tribeId),p=permissions(row,user.id,admin);
    if (!p.canEdit || (manage && !p.canManage)) throw new HttpError(403,"Vous n'avez pas les droits pour cette action.");
    callback(row,user.id,p);
    const updated=getTribeRow(tribeId),newP=permissions(updated,user.id,admin);
    return Z.GetTribeResponse.parse(tribeDetail(updated,newP.canEdit,newP.canManage));
  });
}
function writeProfile(tribeId:number,data:Z.TribeInput,actor:string) {
  if (!data.name.trim()) throw new HttpError(400,"Le nom de la tribu est obligatoire.");
  const existing=getTribeRow(tribeId),guild=existing.guild_id;
  // Unchanged legacy images must not prevent editing unrelated profile fields.
  // New or modified URLs still require valid HTTPS.
  const original=String(existing.logo_url || "");
  const logo=data.logoUrl===original || data.logoUrl===mediaUrl(tribeId,"logo",original)?original:imageUrl(data.logoUrl,actor,"logo");
  if (data.coverUrl !== undefined) {
    const currentCover = tribeCoverUrl(tribeId);
    setTribeCover(tribeId, data.coverUrl === currentCover ? currentCover : imageUrl(data.coverUrl,actor,"cover"));
  }
  if (rows("SELECT id FROM tribus WHERE guild_id=? AND lower(nom)=lower(?) AND id<>?",BigInt(String(guild)),data.name.trim(),tribeId).length)
    throw new HttpError(409,"Ce nom existe déjà sur le serveur.");
  run("UPDATE tribus SET nom=?,description=?,devise=?,objectif=?,couleur=?,logo_url=?,base=?,map_base=?,coords_base=?,tags=?,ouvert_recrutement=? WHERE id=?",
    data.name.trim(),data.description,data.motto,data.objective,data.color,logo,data.base,data.map,data.coords,data.tags,
    data.recruiting?(data.recruitmentText.trim() || 1):0,tribeId);
}
router.get("/auth/discord",async(req,res)=>{await startLogin(req,res);});
router.get("/auth/discord/callback",async(req,res)=>{await finishLogin(req,res);});
router.get("/session",async(req,res)=>{res.set("Cache-Control","no-store");res.json(Z.GetSessionResponse.parse(await session(req)));});
router.get("/community-invite",(req,res)=>{
  res.set("Cache-Control","private, no-store");
  res.set("Vary","Cookie");
  requireIdentity(req);
  // A newcomer must be able to join; guild membership is not required here.
  res.json(Z.GetCommunityInviteResponse.parse({url:"https://discord.gg/Bt4ht8fMzA"}));
});
router.post("/logout",(req,res)=>{logout(req,res);});
router.put("/my-tribes/name",(req,res)=>{
  const user=checkWrite(req),data=body(Z.UpdateMyTribeNameBody,req);
  const name=data.name.trim(),guild=targetGuild();
  if (!name) throw new HttpError(400,"Le nom en jeu est obligatoire.");
  if (!guild) throw new HttpError(503,"Serveur Discord non identifié.");
  transaction(()=>{
    const tribes=rows("SELECT m.tribu_id FROM membres m JOIN tribus t ON t.id=m.tribu_id WHERE m.user_id=? AND t.guild_id=?",BigInt(user.id),BigInt(guild));
    if (!tribes.length) throw new HttpError(404,"Vous n'êtes membre d'aucune tribu.");
    for (const tribe of tribes) {
      run("UPDATE membres SET nom_in_game=? WHERE tribu_id=? AND user_id=?",name,Number(tribe.tribu_id),BigInt(user.id));
      recordActivity(Number(tribe.tribu_id),user.id,"Nom en jeu","Le membre a modifié son nom en jeu.");
    }
  });
  res.json({status:"ok"});
});
router.post("/tribes/:id/leave",(req,res)=>{
  const user=checkWrite(req),tribeId=id(req);
  transaction(()=>{
    const row=getTribeRow(tribeId);
    if (String(row.guild_id)!==targetGuild()) throw new HttpError(403,"Cette tribu appartient à un autre serveur.");
    if (String(row.proprietaire_id)===user.id) throw new HttpError(400,"Transférez d'abord la propriété de votre tribu.");
    if (!rows("SELECT user_id FROM membres WHERE tribu_id=? AND user_id=?",tribeId,BigInt(user.id)).length) throw new HttpError(404,"Vous n'êtes pas membre de cette tribu.");
    run("DELETE FROM membres WHERE tribu_id=? AND user_id=?",tribeId,BigInt(user.id));
    recordActivity(tribeId,user.id,"Quitter tribu","Un membre a quitté la tribu.");
  });
  res.json({status:"ok"});
});
router.get("/tribes/:id/history",async(req,res)=>{
  res.set("Cache-Control","private, no-store");res.set("Vary","Cookie");
  const user=requireIdentity(req),tribeId=id(req),row=getTribeRow(tribeId);
  const before=req.query.before===undefined?null:positive(req.query.before);
  if (String(row.guild_id)!==targetGuild()) throw new HttpError(403,"Cette tribu appartient à un autre serveur.");
  if (!(await access(req,row)).canEdit) throw new HttpError(403,"L'historique est réservé aux gestionnaires de la tribu.");
  const entries=rows("SELECT id,CAST(user_id AS TEXT) AS actor_id,action,details,created_at FROM historique WHERE tribu_id=? AND (? IS NULL OR id<?) ORDER BY id DESC LIMIT 21",tribeId,before,before)
    .map(r=>({id:Number(r.id),actorId:String(r.actor_id),action:String(r.action),details:String(r.details || ""),createdAt:String(r.created_at)}));
  res.json(Z.GetTribeHistoryResponse.parse({entries:entries.slice(0,20),nextBefore:entries.length>20?entries[19].id:null}));
});
router.get("/options",async(req,res)=>{
  const query=Z.GetOptionsQueryParams.parse(req.query);
  const guild=query.tribeId?String(getTribeRow(positive(query.tribeId)).guild_id):undefined;
  res.json(Z.GetOptionsResponse.parse(options(guild)));
});
router.get("/tribe-review",async(req,res)=>{
  const user=requireIdentity(req),guild=targetGuild();
  if (!guild || !await hasSiteAdminRights(user.id,guild)) throw new HttpError(403,"Droits administrateur requis.");
  res.set("Cache-Control","no-store").json(Z.GetTribeReviewResponse.parse(await reviewTribes(guild)));
});
router.get("/overview",async(req,res)=>{
  const user=requireIdentity(req),guild=targetGuild();
  if (!guild || !await hasSiteAdminRights(user.id,guild)) throw new HttpError(403,"Droits administrateur requis.");
  const counts=rows("SELECT COUNT(*) AS n, COUNT(DISTINCT NULLIF(map_base,'')) AS maps FROM tribus")[0];
  const recruiting=rows("SELECT ouvert_recrutement FROM tribus").filter(r=>isRecruiting(r.ouvert_recrutement)).length;
  res.json(Z.GetOverviewResponse.parse({tribes:Number(counts.n),members:Number(rows("SELECT COUNT(*) AS n FROM membres")[0].n),
     recruiting,maps:Number(counts.maps),recentActivity:[]}));
});
router.get("/discord-players",async(req,res)=>{
  const actor=requireIdentity(req),query=Z.ListDiscordPlayersQueryParams.parse(req.query);
  const row=query.tribeId?getTribeRow(query.tribeId):undefined;
  const guild=row?String(row.guild_id):targetGuild();
  if (!guild) throw new HttpError(503,"Le serveur Discord cible doit être configuré.");
  if (row) {
    if (!(await access(req,row)).canEdit) throw new HttpError(403,"Vous ne pouvez pas modifier cette tribu.");
  } else if (!isSiteOwner(actor.id) && !(await guildRights(actor.id,guild)).member) {
    throw new HttpError(403,"Vous devez être membre du serveur Discord.");
  }
  res.set("Cache-Control","no-store").json(Z.ListDiscordPlayersResponse.parse(await discordPlayers(guild,(query.q || "").trim(),query.after)));
});
router.get("/player-search",async(req,res)=>{
  res.set("Cache-Control","private, no-store");
  res.set("Vary","Cookie");
  const actor=requireIdentity(req),guild=targetGuild();
  if (!guild) throw new HttpError(503,"Le serveur Discord cible doit être configuré.");
  await requireCurrentServerMember(guild,actor.id);
  const {q}=Z.SearchPlayerProfilesQueryParams.parse(req.query);
  const query=q.trim();
  if (query.length<2) throw new HttpError(400,"Saisissez au moins deux caractères pour rechercher un joueur.");
  const result=await discordPlayers(guild,query);
  const players=result.players.map(player=>{
    const userId=BigInt(player.id);
    const tribes=rows(
      `SELECT t.id,t.nom,t.proprietaire_id,m.role,m.manager
       FROM tribus t LEFT JOIN membres m ON m.tribu_id=t.id AND m.user_id=?
       WHERE t.guild_id=? AND (m.user_id=? OR t.proprietaire_id=?)
       ORDER BY t.nom COLLATE NOCASE`,
      userId,BigInt(guild),userId,userId,
    ).map(t=>({id:Number(t.id),name:String(t.nom),role:String(t.role || ""),
      manager:!!t.manager,isOwner:String(t.proprietaire_id)===player.id}));
    return {...player,tribes};
  });
  // Discord caps name searches at 100 members (including bots).
  res.json(Z.SearchPlayerProfilesResponse.parse({players,hasMore:result.hasMore}));
});
router.get("/tribes",async(req,res)=>{
  // Zod boolean coercion treats the string "false" as true. Normalize explicitly.
  const q={...req.query};
  for (const key of ["mine","recruiting"]) {
    if (q[key]!==undefined && !["true","false"].includes(String(q[key]))) throw new HttpError(400,"Filtre invalide.");
  }
  const parsed=Z.ListTribesQueryParams.parse({...q,mine:q.mine===undefined?undefined:q.mine==="true",recruiting:q.recruiting===undefined?undefined:q.recruiting==="true"});
  const user=identity(req);if (parsed.mine && !user) requireIdentity(req);
  let result=rows("SELECT * FROM tribus ORDER BY nom COLLATE NOCASE");
  if (parsed.mine && user) {
    const memberships=new Set(rows("SELECT tribu_id FROM membres WHERE user_id=?",BigInt(user.id)).map(r=>Number(r.tribu_id)));
    result=result.filter(r=>String(r.proprietaire_id)===user.id || memberships.has(Number(r.id)));
  }
  if (parsed.q) {
    const search=parsed.q.toLocaleLowerCase("fr");
    result=result.filter(r=>[r.nom,r.description,r.devise,r.tags].some(v=>text(v).toLocaleLowerCase("fr").includes(search)));
  }
  if (parsed.map) result=result.filter(r=>r.map_base===parsed.map);
  if (parsed.recruiting!==undefined) result=result.filter(r=>isRecruiting(r.ouvert_recrutement)===parsed.recruiting);
  const summary=await Promise.all(result.map(async r=>{const p=await access(req,r);return tribeSummary(r,p.canEdit,p.canManage);}));
  res.json(Z.ListTribesResponse.parse(summary));
});
router.get("/tribes/:id",async(req,res)=>{
  const row=getTribeRow(id(req)),p=await access(req,row);
  res.json(Z.GetTribeResponse.parse(tribeDetail(row,p.canEdit,p.canManage)));
});
router.get("/tribes/:id/images/:digest",async(req,res)=>{
  const digest=String(req.params.digest);
  if (!/^[a-f0-9]{64}$/.test(digest)) throw new HttpError(404,"Image introuvable.");
  const image=publishedImage(getTribeRow(id(req)),digest);
  if (!image || !/^\/objects\/tribe-media\/[a-f0-9]{64}$/.test(String(image.object_path))) throw new HttpError(404,"Image introuvable.");
  const file=await brandingStorage.getObjectEntityFile(String(image.object_path));
  const response=await brandingStorage.downloadObject(file,3600);
  response.headers.forEach((v,k)=>res.set(k,v));
  res.set("Content-Type",String(image.content_type));res.set("X-Content-Type-Options","nosniff");
  if (response.body) Readable.fromWeb(response.body as ReadableStream<Uint8Array>).pipe(res);
  else res.end();
});
router.post("/tribes",async(req,res)=>{
  const user=checkWrite(req),data=body(Z.CreateTribeBody,req),guild=targetGuild();
  if (!guild) throw new HttpError(503,"Configurez le serveur Discord cible avant de créer une tribu.");
  if (!isSiteOwner(user.id) && !(await guildRights(user.id,guild)).member) throw new HttpError(403,"L'appartenance au serveur Discord n'a pas pu être vérifiée.");
  const members=data.members || [];
  if (new Set(members.map(m=>m.userId)).size!==members.length) throw new HttpError(400,"Un joueur ne peut être ajouté qu'une seule fois.");
  if (members.some(m=>!m.name.trim())) throw new HttpError(400,"Le nom en jeu de chaque membre est obligatoire.");
  for (let i=0;i<members.length;i+=5) await Promise.all(members.slice(i,i+5).filter(m=>m.userId!==user.id).map(m=>verifyPlayer(guild,m.userId)));
  const result=transaction(()=>{
    const created=run("INSERT INTO tribus(guild_id,nom,proprietaire_id,created_at) VALUES(?,?,?,?)",BigInt(guild),data.name.trim(),BigInt(user.id),now());
    const tribeId=Number(created.lastInsertRowid);
    writeProfile(tribeId,data,user.id);
    run("INSERT INTO membres(tribu_id,user_id,role,manager,nom_in_game) VALUES(?,?,?,1,?)",tribeId,BigInt(user.id),"Propriétaire",user.name);
    for (const member of members) run("INSERT INTO membres(tribu_id,user_id,nom_in_game,role,manager) VALUES(?,?,?,?,?) ON CONFLICT(tribu_id,user_id) DO UPDATE SET nom_in_game=excluded.nom_in_game,role=excluded.role,manager=excluded.manager",
      tribeId,BigInt(member.userId),member.name.trim(),member.role,member.userId===user.id || member.manager?1:0);
    for (const place of data.places || []) {
      if (!place.name.trim()) throw new HttpError(400,"Le nom de chaque lieu est obligatoire.");
      const table=place.kind==="premium"?"bases_premium":"avant_postes";
      run(`INSERT INTO ${table}(tribu_id,user_id,nom,map,coords,created_at) VALUES(?,?,?,?,?,?)`,tribeId,BigInt(user.id),place.name.trim(),place.map,place.coords,now());
    }
    const gallery=(data.gallery || []).map(url=>imageUrl(url,user.id,"gallery")).filter(Boolean);
    gallery.forEach((url,i)=>run("INSERT INTO photos_tribu(tribu_id,url,ordre,created_at) VALUES(?,?,?,?)",tribeId,url,i,now()));
    if (gallery.length) run("UPDATE tribus SET photo_base=? WHERE id=?",gallery[0],tribeId);
    if (data.progression) writeProgression(tribeId,guild,data.progression);
    recordActivity(tribeId,user.id,"Création","Tribu créée depuis le site.");
    return Z.CreateTribeResponse.parse(tribeDetail(getTribeRow(tribeId),true,true));
  });
  res.status(201).json(result);
});
router.patch("/tribes/:id",async(req,res)=>{
  const data=body(Z.UpdateTribeBody,req);
  res.json(await mutation(req,(r,user)=>{writeProfile(Number(r.id),data,user);recordActivity(Number(r.id),user,"Modification","Profil de tribu mis à jour.");}));
});
router.delete("/tribes/:id",async(req,res)=>{
  const user=checkWrite(req),tribeId=id(req),initial=getTribeRow(tribeId),admin=await hasSiteAdminRights(user.id,String(initial.guild_id));
  transaction(()=>{
    if (!permissions(getTribeRow(tribeId),user.id,admin).canManage) throw new HttpError(403,"Seul le propriétaire ou un administrateur peut supprimer cette tribu.");
    for (const table of ["membres","avant_postes","bases_premium","photos_tribu","historique"]) run(`DELETE FROM ${table} WHERE tribu_id=?`,tribeId);
    run("DELETE FROM tribus WHERE id=?",tribeId);
  });
  res.json({status:"ok"});
});
router.put("/tribes/:id/members",async(req,res)=>{
  const data=body(Z.SaveMemberBody,req);
  checkWrite(req);
  const initial=getTribeRow(id(req));
  if (!(await access(req,initial)).canEdit) throw new HttpError(403,"Vous n'avez pas les droits pour cette action.");
  if (!data.name.trim()) throw new HttpError(400,"Le nom en jeu du membre est obligatoire.");
  if (!rows("SELECT user_id FROM membres WHERE tribu_id=? AND user_id=?",Number(initial.id),BigInt(data.userId)).length) await verifyPlayer(String(initial.guild_id),data.userId);
  res.json(await mutation(req,(r,user,p)=>{
    const old=rows("SELECT manager FROM membres WHERE tribu_id=? AND user_id=?",Number(r.id),BigInt(data.userId))[0];
    const owner=String(r.proprietaire_id)===data.userId;
    if (!p.canManage && (owner || !!old?.manager!==data.manager)) throw new HttpError(403,"Seul le propriétaire peut modifier les responsables.");
    if (owner && !data.manager) throw new HttpError(400,"Le propriétaire doit rester responsable.");
    run("INSERT INTO membres(tribu_id,user_id,nom_in_game,role,manager) VALUES(?,?,?,?,?) ON CONFLICT(tribu_id,user_id) DO UPDATE SET nom_in_game=excluded.nom_in_game,role=excluded.role,manager=excluded.manager",
      Number(r.id),BigInt(data.userId),data.name,data.role,data.manager?1:0);
    recordActivity(Number(r.id),user,"Membre","Liste des membres mise à jour.");
  }));
});
router.delete("/tribes/:id/members/:userId",async(req,res)=>{
  const userId=String(req.params.userId);if (!/^\d{17,20}$/.test(userId)) throw new HttpError(400,"Identifiant Discord invalide.");
  res.json(await mutation(req,(r,user,p)=>{
    if (String(r.proprietaire_id)===userId) throw new HttpError(400,"Transférez d'abord la propriété.");
    const member=rows("SELECT manager FROM membres WHERE tribu_id=? AND user_id=?",Number(r.id),BigInt(userId))[0];
    if (!member) throw new HttpError(404,"Membre introuvable.");
    if (!p.canManage && member.manager) throw new HttpError(403,"Seul le propriétaire peut retirer un responsable.");
    run("DELETE FROM membres WHERE tribu_id=? AND user_id=?",Number(r.id),BigInt(userId));
    recordActivity(Number(r.id),user,"Membre","Membre retiré de la tribu.");
  }));
});
router.post("/tribes/:id/places",async(req,res)=>{
  const data=body(Z.AddPlaceBody,req);
  if (!data.name.trim()) throw new HttpError(400,"Le nom est obligatoire.");
  res.status(201).json(await mutation(req,(r,user)=>{
    const table=data.kind==="premium"?"bases_premium":"avant_postes";
    run(`INSERT INTO ${table}(tribu_id,user_id,nom,map,coords,created_at) VALUES(?,?,?,?,?,?)`,Number(r.id),BigInt(user),data.name,data.map,data.coords,now());
    recordActivity(Number(r.id),user,"Lieu","Lieu ajouté.");
  }));
});
router.delete("/tribes/:id/places/:kind/:placeId",async(req,res)=>{
  const params=Z.RemovePlaceParams.parse(req.params),placeId=positive(params.placeId);
  res.json(await mutation(req,(r,user)=>{
    const table=params.kind==="premium"?"bases_premium":"avant_postes";
    if (!run(`DELETE FROM ${table} WHERE id=? AND tribu_id=?`,placeId,Number(r.id)).changes) throw new HttpError(404,"Lieu introuvable.");
    recordActivity(Number(r.id),user,"Lieu","Lieu retiré.");
  }));
});
router.put("/tribes/:id/gallery",async(req,res)=>{
  const data=body(Z.SaveGalleryBody,req);
  res.json(await mutation(req,(r,user)=>{
    const urls=data.urls.map(url=>originalGalleryUrl(Number(r.id),url) ?? imageUrl(url,user,"gallery")).filter(Boolean);
    run("DELETE FROM photos_tribu WHERE tribu_id=?",Number(r.id));
    urls.forEach((url,i)=>run("INSERT INTO photos_tribu(tribu_id,url,ordre,created_at) VALUES(?,?,?,?)",Number(r.id),url,i,now()));
    run("UPDATE tribus SET photo_base=? WHERE id=?",urls[0] || "",Number(r.id));
    recordActivity(Number(r.id),user,"Galerie","Photos mises à jour.");
  }));
});
router.put("/tribes/:id/progression",async(req,res)=>{
  const data=body(Z.SaveProgressionBody,req);
  res.json(await mutation(req,(r,user)=>{
    writeProgression(Number(r.id),String(r.guild_id),data);
    recordActivity(Number(r.id),user,"Progression","Progression mise à jour.");
  }));
});
router.put("/tribes/:id/owner",async(req,res)=>{
  checkWrite(req);
  const data=body(Z.TransferOwnershipBody,req);
  // Verify the recipient belongs to the tribe's Discord server before transferring.
  const initial=getTribeRow(id(req));
  if (!(await guildRights(data.userId,String(initial.guild_id))).member) throw new HttpError(400,"Le nouveau propriétaire doit être membre du serveur Discord.");
  res.json(await mutation(req,(r,user)=>{
    if (!rows("SELECT user_id FROM membres WHERE tribu_id=? AND user_id=?",Number(r.id),BigInt(data.userId)).length) throw new HttpError(400,"Le nouveau propriétaire doit être membre de la tribu.");
    run("UPDATE tribus SET proprietaire_id=? WHERE id=?",BigInt(data.userId),Number(r.id));
    // The former owner remains a member but does not retain management by default.
    run("UPDATE membres SET manager=0 WHERE tribu_id=? AND user_id=?",Number(r.id),BigInt(String(r.proprietaire_id)));
    run("UPDATE membres SET manager=1 WHERE tribu_id=? AND user_id=?",Number(r.id),BigInt(data.userId));
    recordActivity(Number(r.id),user,"Propriété","Propriété transférée.");
  },true));
});
const optionTables={maps:"maps",premiumMaps:"maps_premium",boss:"boss",notes:"notes"} as const;
async function changeOption(req:Request,res:Response,remove:boolean) {
  const user=checkWrite(req),data=body(Z.AddOptionBody,req),guild=targetGuild();
  if (!guild || !await hasSiteAdminRights(user.id,guild)) throw new HttpError(403,"Droits administrateur requis.");
  const name=data.name.trim();if (!name || name.includes(",")) throw new HttpError(400,"Un nom non vide, sans virgule, est requis.");
  const table=optionTables[data.kind];
  if (remove) {
    transaction(()=>{
      const otherGuilds=rows("SELECT guild_id FROM tribus WHERE guild_id NOT IN (0,?) UNION SELECT guild_id FROM config WHERE guild_id NOT IN (0,?)",BigInt(guild),BigInt(guild));
      const own=run(`DELETE FROM ${table} WHERE guild_id=? AND nom=?`,BigInt(guild),name).changes;
      const global=rows(`SELECT id FROM ${table} WHERE guild_id=0 AND nom=?`,name);
      if (global.length && otherGuilds.length) throw new HttpError(400,"Ce choix est partagé par plusieurs serveurs. Supprimez-le depuis l'administration Discord.");
      const shared=global.length?run(`DELETE FROM ${table} WHERE guild_id=0 AND nom=?`,name).changes:0;
      if (!own && !shared) throw new HttpError(404,"Choix introuvable.");
    });
  } else run(`INSERT INTO ${table}(guild_id,nom,created_at) VALUES(?,?,?)`,BigInt(guild),name,now());
  res.status(remove?200:201).json(Z.GetOptionsResponse.parse(options(guild)));
}
router.post("/options",async(req,res)=>{await changeOption(req,res,false);});
router.delete("/options",async(req,res)=>{await changeOption(req,res,true);});
router.use((error:unknown,req:Request,res:Response,_next:NextFunction)=>{
  if (error instanceof HttpError) {res.status(error.status).json({error:error.message});return;}
  if (error && typeof error==="object" && "name" in error && error.name==="ZodError") {res.status(400).json({error:"Requête invalide."});return;}
  if (error instanceof Error && error.message.includes("UNIQUE constraint")) {res.status(409).json({error:"Ce nom existe déjà sur le serveur."});return;}
  req.log.error({errorType:error instanceof Error?error.name:"unknown"},"Tribe request failed");
  res.status(500).json({error:"Une erreur interne est survenue. Aucune modification partielle n'a été conservée."});
});
export default router;