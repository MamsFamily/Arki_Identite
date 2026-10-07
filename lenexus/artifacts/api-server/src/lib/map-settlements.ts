import { rows, run, database, HttpError } from "./tribe-store";
import { getSiteMap, isAttachedMapImage } from "./site-maps";
import { initialSiteMaps } from "../data/site-maps";
import { publishImage } from "./site-branding";
import { requireSiteOwner } from "./site-access";
import type { MapCartography, MapCartographyInput } from "@workspace/api-zod";

const norm=(s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
export function parseMapCoords(value:string):{latitude:number|null;longitude:number|null} {
  // Preserve unrecognised formats as text rather than guessing a position.
  const number="(\\d{1,3}(?:[.,]\\d+)?)";
  const labels=value.match(new RegExp(`^\\s*(?:lat(?:itude)?)[\\s:=]*${number}\\s*[,;/|\\s-]+(?:lon(?:g(?:itude)?)?)[\\s:=]*${number}\\s*$`,"i"));
  const pair=value.match(new RegExp(`^\\s*${number}\\s*[/;|–-]\\s*${number}\\s*$`)) ||
    value.match(/^\s*(\d{1,3}(?:\.\d+)?)\s*[, -]\s*(\d{1,3}(?:\.\d+)?)\s*$/);
  const match=labels||pair;
  if (!match) return {latitude:null,longitude:null};
  const [latitude,longitude]=[match[1],match[2]].map(n=>Number(n.replace(",",".")));
  return latitude<=100 && longitude<=100?{latitude,longitude}:{latitude:null,longitude:null};
}
export function mapResidents(slug:string) {
  getSiteMap(slug);
  const initial=initialSiteMaps.find(m=>m.slug===slug)!;
  // Display-name edits must not reassign tribes to another physical map.
  const aliases=new Set([slug,initial.name].map(norm));
  const knownAliases:Record<string,string[]>={"astraeos":["astraos","astreos"],"the-island":["theislande"],"the-center":["center"],"ragnarok":["ragnarock"],"valguero":["valgero"]};
  (knownAliases[slug]||[]).forEach(s=>aliases.add(s));
  if(slug==="genesis") ["genesis1","genesispart1"].forEach(s=>aliases.add(s));
  return rows("SELECT id,nom,map_base,coords_base FROM tribus ORDER BY nom COLLATE NOCASE")
    .filter(r=>aliases.has(norm(String(r.map_base||"").replace(/^\s*base\s+principale\s*[:=]\s*/i,""))))
    .map(r=>({id:Number(r.id),name:String(r.nom),coords:String(r.coords_base||""),...parseMapCoords(String(r.coords_base||""))}));
}
const fixture=()=>process.env.ARKI_MAP_TEST_SQLITE==="1";
// Bundled owner-supplied original. A saved empty image intentionally hides it.
const suppliedCartography:Record<string,string> = {
  ragnarok:"/map-ragnarok-cartography.webp",
  valguero:"/map-valguero-cartography.jpeg",
  astraeos:"/map-astraeos-cartography.webp",
  svartalfheim:"/map-svartalfheim-cartography.webp",
  genesis:"/map-genesis-cartography.jpeg",
  "lost-colony":"/map-lost-colony-cartography.jpeg",
  aberration:"/map-aberration-cartography.webp",
  "scorched-earth":"/map-scorched-earth-cartography.jpeg",
  "the-island":"/map-the-island-cartography.jpeg",
  "the-center":"/map-the-center-cartography.webp",
  extinction:"/map-extinction-cartography.webp",
};
const defaultCartography=(slug:string):MapCartography=>({image:suppliedCartography[slug]??"",revision:0});
function fixtureTable() {
  database().exec("CREATE TABLE IF NOT EXISTS site_map_cartography(slug TEXT PRIMARY KEY,image TEXT NOT NULL,revision INTEGER NOT NULL)");
}
export async function getCartography(slug:string):Promise<MapCartography> {
  if(fixture()) {
    fixtureTable();const row=rows("SELECT image,revision FROM site_map_cartography WHERE slug=?",slug)[0];
    return row?{image:String(row.image),revision:Number(row.revision)}:defaultCartography(slug);
  }
  const {pool}=await import("@workspace/db");
  const {rows:result}=await pool.query("SELECT image,revision FROM site_map_cartography WHERE slug=$1",[slug]);
   return result[0]||defaultCartography(slug);
}
export async function saveCartography(actor:string,slug:string,input:MapCartographyInput):Promise<MapCartography> {
  requireSiteOwner(actor);
  getSiteMap(slug);
  const previous=await getCartography(slug);
  if(previous.revision!==input.revision) throw new HttpError(409,"La carte a changé. Rechargez avant de confirmer.");
  let image=input.image.trim();
  if(/^\/objects\/uploads\/[a-f0-9-]{36}$/.test(image)) image=`/api/storage${await publishImage(actor,"cover",image)}`;
   else if(image && image!==previous.image && image!==defaultCartography(slug).image && !(image.startsWith("/api/storage/") && isAttachedMapImage(image.replace("/api/storage","")))) {
    try {const url=new URL(image);if(url.protocol!=="https:" || url.username || url.password) throw Error();}
    catch {throw new HttpError(400,"Envoyez une image ou indiquez un lien HTTPS valide.");}
  }
  if(fixture()) {
    // No awaits within this SQLite fixture transaction.
    database().exec("BEGIN IMMEDIATE");
    try {
      const current=rows("SELECT revision FROM site_map_cartography WHERE slug=?",slug)[0];
      if(Number(current?.revision||0)!==input.revision) throw new HttpError(409,"La carte a changé. Rechargez avant de confirmer.");
      requireSiteOwner(actor);
      run("INSERT INTO site_map_cartography(slug,image,revision) VALUES(?,?,?) ON CONFLICT(slug) DO UPDATE SET image=excluded.image,revision=excluded.revision",slug,image,input.revision+1);
      database().exec("COMMIT");
    } catch(e) {database().exec("ROLLBACK");throw e;}
  } else {
    const {pool}=await import("@workspace/db");
    const client=await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[`map-cartography:${slug}`]);
      const current=await client.query("SELECT revision FROM site_map_cartography WHERE slug=$1",[slug]);
      if(Number(current.rows[0]?.revision||0)!==input.revision) throw new HttpError(409,"La carte a changé. Rechargez avant de confirmer.");
      requireSiteOwner(actor);
      await client.query("INSERT INTO site_map_cartography(slug,image,revision) VALUES($1,$2,$3) ON CONFLICT(slug) DO UPDATE SET image=excluded.image,revision=excluded.revision",[slug,image,input.revision+1]);
      await client.query("COMMIT");
    } catch(e) {await client.query("ROLLBACK");throw e;}
    finally{client.release();}
  }
  return {image,revision:input.revision+1};
}
export async function attachedCartography(objectPath:string) {
  if(!/^\/objects\/site-branding\/[a-f0-9-]{36}$/.test(objectPath)) return false;
  if(fixture()){fixtureTable();return !!rows("SELECT slug FROM site_map_cartography WHERE image=?",`/api/storage${objectPath}`).length;}
  const {pool}=await import("@workspace/db");
  return !!(await pool.query("SELECT slug FROM site_map_cartography WHERE image=$1 LIMIT 1",[`/api/storage${objectPath}`])).rows.length;
}