import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { HttpError, targetGuild } from "./tribe-store";
import { isSiteOwner, primaryOwnerId, siteGrant } from "./site-access";
import { isPlayerView } from "./request-view";

export type Identity = { id:string; name:string; avatar:string; csrf:string; expires:number };
const sessionsCookie = "arki_session";
const stateCookie = "arki_oauth_state";
const maxAge = 7*24*60*60*1000;
export const oauthConfigured = () => !!(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET && process.env.SESSION_SECRET);
function signature(value: string) {
  if (!process.env.SESSION_SECRET) throw new HttpError(503,"SESSION_SECRET manque.");
  return createHmac("sha256",process.env.SESSION_SECRET).update(value).digest("base64url");
}
function encode(value: unknown) { const body=Buffer.from(JSON.stringify(value)).toString("base64url"); return `${body}.${signature(body)}`; }
function decode(value?: string): unknown {
  if (!value || !process.env.SESSION_SECRET) return null;
  try {
    const [body,sig]=value.split(".");
    const a=Buffer.from(sig || ""),b=Buffer.from(signature(body));
    if (a.length!==b.length || !timingSafeEqual(a,b)) return null;
    return JSON.parse(Buffer.from(body,"base64url").toString());
  } catch { return null; }
}
function cookies(req:Request) {
  return Object.fromEntries((req.headers.cookie || "").split(";").map(v => v.trim().split("=")).filter(v => v.length===2));
}
function cookieOptions(req:Request) { return {httpOnly:true,secure:origin(req).startsWith("https:"),sameSite:"lax" as const,path:"/api"}; }
export function origin(req:Request) {
  if (process.env.PUBLIC_ORIGIN) {
    const url=new URL(process.env.PUBLIC_ORIGIN);
    if (!["https:","http:"].includes(url.protocol)) throw new HttpError(503,"PUBLIC_ORIGIN invalide.");
    return url.origin;
  }
  // Production must have an explicitly configured trusted origin, not a Host-derived redirect.
  if (process.env.NODE_ENV==="production") throw new HttpError(503,"Configurez PUBLIC_ORIGIN avec le domaine public du site.");
  const dev=process.env.REPLIT_DEV_DOMAIN;
  if (dev) return `https://${dev}`;
  return "http://localhost";
}
export function identity(req:Request):Identity | null {
  const value=decode(cookies(req)[sessionsCookie]) as Identity | null;
  if (!value || !/^\d{17,20}$/.test(value.id) || typeof value.csrf!=="string" || value.expires<Date.now()) return null;
  return value;
}
export function requireIdentity(req:Request) {
  const user=identity(req);
  if (!user) throw new HttpError(401,"Connectez-vous avec Discord.");
  return user;
}
export function checkWrite(req:Request) {
  const user=requireIdentity(req);
  const sent=req.get("X-CSRF-Token");
  if (!sent || sent!==user.csrf) throw new HttpError(403,"Session expirée ou requête non autorisée. Rechargez la page.");
  const requestOrigin=req.get("Origin");
  if (requestOrigin && requestOrigin!==origin(req)) throw new HttpError(403,"Origine non autorisée.");
  return user;
}
export async function discord(path:string,token:string,bot=false) {
  const response=await fetch(`https://discord.com/api/v10${path}`,{headers:{Authorization:`${bot?"Bot":"Bearer"} ${token}`},signal:AbortSignal.timeout(8000)});
  if (!response.ok) throw new HttpError(503,"Discord ne permet pas de vérifier les droits pour le moment.");
  return response.json();
}
const rightsCache=new Map<string,{until:number,admin:boolean,member:boolean}>();
const rightsPending=new Map<string,Promise<{until?:number,admin:boolean,member:boolean}>>();
export async function guildRights(userId:string,guild:string) {
  const key=`${guild}:${userId}`,cached=rightsCache.get(key);
  if (cached && cached.until>Date.now()) return cached;
  if (!process.env.DISCORD_TOKEN) return {admin:false,member:false};
  const pending=rightsPending.get(key);
  if (pending) return pending;
  const task=loadGuildRights(userId,guild,key);
  rightsPending.set(key,task);
  try { return await task; } finally {rightsPending.delete(key);}
}
async function loadGuildRights(userId:string,guild:string,key:string) {
  try {
    const token=process.env.DISCORD_TOKEN!;
    const [member,guildInfo,roles]=await Promise.all([
      discord(`/guilds/${guild}/members/${userId}`,token,true) as Promise<{roles:string[]}>,
      discord(`/guilds/${guild}`,token,true) as Promise<{owner_id:string}>,
      discord(`/guilds/${guild}/roles`,token,true) as Promise<{id:string,permissions:string}[]>,
    ]);
    const permissions=roles.filter((r:{id:string})=>r.id===guild || member.roles.includes(r.id))
      .reduce((p:bigint,r:{permissions:string})=>p | BigInt(r.permissions),0n);
    const result={member:true,admin:guildInfo.owner_id===userId || member.roles.includes("1157803768893689877") || !!(permissions & (8n|32n)),until:Date.now()+30000};
    if (rightsCache.size>2000) rightsCache.clear();
    rightsCache.set(key,result);return result;
  } catch {
    const denied={admin:false,member:false,until:Date.now()+5000};
    rightsCache.set(key,denied);return denied;
  }
}
export async function hasSiteAdminRights(userId:string,guild:string) {
  if (isPlayerView(userId)) return false;
  if (isSiteOwner(userId)) return true;
  const grant=siteGrant(userId);
  if (grant?.role!=="admin" || grant.guildId!==guild || guild!==targetGuild()) return false;
  // A manual grant is insufficient after the Discord admin/moderator role is lost.
  return (await guildRights(userId,guild)).admin;
}
export async function startLogin(req:Request,res:Response) {
  if (!oauthConfigured()) throw new HttpError(503,"La connexion Discord attend la configuration OAuth.");
  const nonce=randomBytes(32).toString("base64url");
  const returnTo=req.query.retour==="rejoindre"?"/rejoindre":"/mon-espace";
  res.cookie(stateCookie,encode({nonce,returnTo,expires:Date.now()+600000}),{...cookieOptions(req),maxAge:600000});
  const params=new URLSearchParams({client_id:process.env.DISCORD_CLIENT_ID!,redirect_uri:`${origin(req)}/api/auth/discord/callback`,response_type:"code",scope:"identify",state:nonce});
  res.redirect(`https://discord.com/oauth2/authorize?${params}`);
}
export async function finishLogin(req:Request,res:Response) {
  const state=decode(cookies(req)[stateCookie]) as {nonce:string,expires:number,returnTo?:string}|null;
  const returnTo=state?.returnTo==="/rejoindre"?"/rejoindre":"/mon-espace";
  const loginError=returnTo==="/rejoindre"?"/connexion?retour=rejoindre&erreur=discord":"/connexion?erreur=discord";
  res.clearCookie(stateCookie,cookieOptions(req));
  if (!state || state.expires<Date.now() || req.query.state!==state.nonce || typeof req.query.code!=="string") {
    res.redirect(loginError);return;
  }
  const response=await fetch("https://discord.com/api/v10/oauth2/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({
    client_id:process.env.DISCORD_CLIENT_ID!,client_secret:process.env.DISCORD_CLIENT_SECRET!,grant_type:"authorization_code",
    code:req.query.code,redirect_uri:`${origin(req)}/api/auth/discord/callback`,
  }),signal:AbortSignal.timeout(8000)});
  if (!response.ok) {res.redirect(loginError);return;}
  const token=await response.json() as {access_token:string};
  if (typeof token.access_token!=="string") throw new HttpError(503,"Réponse OAuth Discord invalide.");
  const profile=await discord("/users/@me",token.access_token) as {id:string,global_name?:string,username:string,avatar?:string};
  if (!/^\d{17,20}$/.test(profile.id) || typeof profile.username!=="string") throw new HttpError(503,"Identité Discord invalide.");
  const user:Identity={id:profile.id,name:profile.global_name || profile.username,avatar:profile.avatar?`https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`:"",csrf:randomBytes(32).toString("base64url"),expires:Date.now()+maxAge};
  res.cookie(sessionsCookie,encode(user),{...cookieOptions(req),maxAge});res.redirect(returnTo);
}
export function logout(req:Request,res:Response) { checkWrite(req);res.clearCookie(sessionsCookie,cookieOptions(req));res.json({status:"ok"}); }
export async function session(req:Request) {
  const user=identity(req),guild=targetGuild();
  const owner=!!user && isSiteOwner(user.id);
  const rights=user && guild && !owner ? await guildRights(user.id,guild):{admin:false,member:owner};
  const admin=owner || !!(user && guild && await hasSiteAdminRights(user.id,guild));
  return {user:user?{id:user.id,name:user.name,avatar:user.avatar}:null,oauthConfigured:oauthConfigured(),csrfToken:user?.csrf || "",
    isAdmin:admin,isOwner:owner,isPrimaryOwner:owner && !!user && user.id===primaryOwnerId(),siteRole:owner?"owner":admin?"admin":user?"member":"guest",
    canCreate:!!user && !!guild && (owner || rights.member),
    configurationMessage:!guild?"Le serveur Discord cible doit être configuré.":!oauthConfigured()?"La connexion Discord n'est pas encore configurée.":user && !rights.member?"L'appartenance au serveur Discord n'a pas pu être vérifiée.":""};
}