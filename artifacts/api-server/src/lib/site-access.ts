import { database, HttpError, rows, run, transaction } from "./tribe-store";
import { isPlayerView } from "./request-view";

export type SiteGrant = { userId:string; role:"admin"|"owner"; guildId:string|null; grantedAt:string };
export function primaryOwnerId() {
  const value=process.env.SITE_OWNER_DISCORD_ID || "";
  return /^\d{17,20}$/.test(value)?value:null;
}
function hasTable() { return rows("SELECT name FROM sqlite_master WHERE type='table' AND name='site_access'").length>0; }
export function siteGrants():SiteGrant[] {
  if (!hasTable()) return [];
  return rows("SELECT user_id,role,guild_id,granted_at FROM site_access ORDER BY role DESC,granted_at")
    .map(r=>({userId:String(r.user_id),role:r.role as "admin"|"owner",guildId:r.guild_id===null?null:String(r.guild_id),grantedAt:String(r.granted_at)}));
}
export function siteGrant(userId:string) { return siteGrants().find(g=>g.userId===userId); }
export function isSiteOwner(userId:string) { return !isPlayerView(userId) && (userId===primaryOwnerId() || siteGrant(userId)?.role==="owner"); }
export function requireSiteOwner(userId:string) {
  if (!isSiteOwner(userId)) throw new HttpError(403,"Seul un propriétaire du site peut gérer les accès.");
}
function initTables() {
  database().exec(`
    CREATE TABLE IF NOT EXISTS site_access (
      user_id TEXT PRIMARY KEY,
      role TEXT NOT NULL CHECK(role IN ('admin','owner')),
      guild_id TEXT,
      granted_by TEXT NOT NULL,
      granted_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS site_access_audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_id TEXT NOT NULL,
      target_id TEXT NOT NULL,
      action TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
}
export function changeSiteAccess(actorId:string,userId:string,role:"admin"|"owner"|null,guildId:string|null) {
  transaction(()=>{
    // Recheck inside the write transaction in case another owner revoked the actor.
    requireSiteOwner(actorId);
    if (userId===primaryOwnerId()) throw new HttpError(403,"Le propriétaire principal ne peut pas être modifié ni retiré.");
    initTables();
    if (role) {
      run("INSERT INTO site_access(user_id,role,guild_id,granted_by,granted_at) VALUES(?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET role=excluded.role,guild_id=excluded.guild_id,granted_by=excluded.granted_by,granted_at=excluded.granted_at",
        userId,role,role==="admin"?guildId:null,actorId,new Date().toISOString());
    } else {
      if (!run("DELETE FROM site_access WHERE user_id=?",userId).changes) throw new HttpError(404,"Ce compte n'a pas d'accès attribué.");
    }
    run("INSERT INTO site_access_audit(actor_id,target_id,action,created_at) VALUES(?,?,?,?)",
      actorId,userId,role?`grant:${role}`:"revoke",new Date().toISOString());
  });
}