import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { existsSync } from "node:fs";
import path from "node:path";
import { mediaUrl } from "./tribe-media";

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export type Row = Record<string, string | number | null>;
let connection: DatabaseSync | undefined;
export function database() {
  if (connection) return connection;
  const filename = process.env.SQLITE_PATH || process.env.TRIBU_BOT_DB ||
    path.resolve(import.meta.dirname, "../../../..", "tribus.db");
  // The bundled entry is in dist; both src/lib and dist resolve via a root search.
  const root = [process.cwd(), path.resolve(process.cwd(), "../..")].find(dir => existsSync(path.join(dir, "main.py")));
  const resolved = process.env.SQLITE_PATH || process.env.TRIBU_BOT_DB ||
    (root ? path.join(root, "tribus.db") : filename);
  if (!existsSync(resolved)) throw new HttpError(503, "Base SQLite introuvable. Configurez SQLITE_PATH vers la base existante.");
  const db = new DatabaseSync(resolved);
  db.exec("PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000");
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name);
  for (const name of ["tribus", "membres", "avant_postes", "bases_premium", "photos_tribu", "historique", "config", "maps", "maps_premium", "boss", "notes"]) {
    if (!tables.includes(name)) { db.close(); throw new HttpError(503, "La base SQLite ne contient pas le schéma des tribus attendu."); }
  }
  connection = db;
  return db;
}
export function rows(sql: string, ...params: SQLInputValue[]): Row[] {
  const stmt = database().prepare(sql);
  stmt.setReadBigInts(true);
  return stmt.all(...params).map(row => Object.fromEntries(Object.entries(row).map(([k,v]) =>
    [k, typeof v === "bigint" ? (v > BigInt(Number.MAX_SAFE_INTEGER) ? v.toString() : Number(v)) : v])) as Row);
}
export function run(sql: string, ...params: SQLInputValue[]) { return database().prepare(sql).run(...params); }
function hasCovers() { return rows("SELECT name FROM sqlite_master WHERE name='site_tribe_covers'").length > 0; }
export function tribeCoverUrl(id: number) {
  return hasCovers() ? String(rows("SELECT url FROM site_tribe_covers WHERE tribu_id=?", id)[0]?.url || "") : "";
}
export function setTribeCover(id: number, url: string) {
  database().exec(`CREATE TABLE IF NOT EXISTS site_tribe_covers (
    tribu_id INTEGER PRIMARY KEY REFERENCES tribus(id) ON DELETE CASCADE,
    url TEXT NOT NULL
  )`);
  if (url) run("INSERT INTO site_tribe_covers(tribu_id,url) VALUES(?,?) ON CONFLICT(tribu_id) DO UPDATE SET url=excluded.url", id, url);
  else run("DELETE FROM site_tribe_covers WHERE tribu_id=?", id);
}
export function isAttachedTribeCover(url: string) {
  return hasCovers() && rows("SELECT tribu_id FROM site_tribe_covers WHERE url=? LIMIT 1", url).length > 0;
}
export function transaction<T>(callback: () => T): T {
  database().exec("BEGIN IMMEDIATE");
  try { const result = callback(); database().exec("COMMIT"); return result; }
  catch (error) { database().exec("ROLLBACK"); throw error; }
}
export function targetGuild(): string | null {
  if (process.env.DISCORD_GUILD_ID && /^\d{17,20}$/.test(process.env.DISCORD_GUILD_ID)) return process.env.DISCORD_GUILD_ID;
  const guilds = rows("SELECT DISTINCT CAST(guild_id AS TEXT) AS id FROM tribus WHERE guild_id>0 UNION SELECT DISTINCT CAST(guild_id AS TEXT) FROM config WHERE guild_id>0");
  return guilds.length === 1 ? String(guilds[0].id) : null;
}
export function getTribeRow(id: number) {
  const tribe = rows("SELECT * FROM tribus WHERE id=?", id)[0];
  if (!tribe) throw new HttpError(404, "Tribu introuvable.");
  return tribe;
}
export function options(guild = targetGuild()) {
  const names = (table: string) => rows(`SELECT DISTINCT nom FROM ${table} WHERE guild_id IN (0,?) ORDER BY nom`, guild ? BigInt(guild) : 0).map(r => String(r.nom));
  const hasImport = rows("SELECT name FROM sqlite_master WHERE type='table' AND name='site_data_import'").length > 0;
  const imported = hasImport ? rows("SELECT source_retrieved_at,imported_at,tribe_count,member_count FROM site_data_import WHERE id=1")[0] : undefined;
  const dataImport = imported ? {
    sourceRetrievedAt: String(imported.source_retrieved_at), importedAt: String(imported.imported_at),
    tribeCount: Number(imported.tribe_count), memberCount: Number(imported.member_count),
  } : undefined;
  return { maps: names("maps"), premiumMaps: names("maps_premium"), boss: names("boss"), notes: names("notes"), dataImport };
}
export function activity(id: number) {
  return rows("SELECT id,action,details,created_at FROM historique WHERE tribu_id=? ORDER BY id DESC LIMIT 30",id)
    .map(r => ({id:Number(r.id),action:String(r.action),details:String(r.details || ""),createdAt:String(r.created_at)}));
}
export function recordActivity(id: number, user: string, action: string, details = "") {
  run("INSERT INTO historique(tribu_id,user_id,action,details,created_at) VALUES(?,?,?,?,?)",id,BigInt(user),action,details,new Date().toISOString());
}
export function tribeSummary(r: Row, canEdit = false, canManage = false) {
  return {
    id:Number(r.id),name:String(r.nom),description:String(r.description || ""),motto:String(r.devise || ""),
    objective:String(r.objectif || ""),color:Number(r.couleur || 0),logoUrl:mediaUrl(Number(r.id),"logo",String(r.logo_url || "")),coverUrl:tribeCoverUrl(Number(r.id)),
    base:String(r.base || ""),map:String(r.map_base || ""),coords:String(r.coords_base || ""),
    tags:String(r.tags || ""),recruiting:isRecruiting(r.ouvert_recrutement),
    recruitmentText:typeof r.ouvert_recrutement==="string" && !["0","1"].includes(r.ouvert_recrutement) ? r.ouvert_recrutement : "",
    createdAt:String(r.created_at),
    memberCount:Number(rows("SELECT count(*) AS n FROM membres WHERE tribu_id=?",Number(r.id))[0].n),canEdit,canManage,
  };
}
export function isRecruiting(value:Row[string]) {
  return typeof value==="string" ? !!value.trim() && value.trim()!=="0" : !!value;
}
export function tribeDetail(r: Row, canEdit = false, canManage = false) {
  const id=Number(r.id);
  const members=rows("SELECT CAST(user_id AS TEXT) AS user_id,role,manager,nom_in_game FROM membres WHERE tribu_id=? ORDER BY manager DESC,nom_in_game",id)
    .map(m=>({...canEdit ? {userId:String(m.user_id)} : {},name:String(m.nom_in_game || "Survivant"),role:String(m.role || ""),manager:!!m.manager}));
  const places=["avant_postes","bases_premium"].flatMap((table,index)=>rows(`SELECT id,nom,map,coords FROM ${table} WHERE tribu_id=? ORDER BY id`,id)
    .map(p=>({id:Number(p.id),kind:index?"premium":"outpost",name:String(p.nom),map:String(p.map || ""),coords:String(p.coords || "")})));
  const csv=(value:Row[string])=>String(value || "").split(",").map(v=>v.trim()).filter(Boolean);
  return {...tribeSummary(r,canEdit,canManage),members,places,
    gallery:rows("SELECT url FROM photos_tribu WHERE tribu_id=? ORDER BY ordre,id",id).map(p=>mediaUrl(id,"gallery",String(p.url))),
    progression:{boss:csv(r.progression_boss),notes:csv(r.progression_notes),pendingBoss:csv(r.progression_boss_non_valides),pendingNotes:csv(r.progression_notes_non_valides)},
    activity:[]};
}