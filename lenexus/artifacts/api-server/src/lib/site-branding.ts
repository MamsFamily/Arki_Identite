import { randomUUID } from "node:crypto";
import { ObjectStorageService } from "./objectStorage";
import { database, HttpError, rows, run, transaction } from "./tribe-store";
import { requireSiteOwner } from "./site-access";

export const brandingStorage=new ObjectStorageService();
export const logoLimit=5*1024*1024,coverLimit=10*1024*1024;
function exists(name:string) { return rows("SELECT name FROM sqlite_master WHERE type='table' AND name=?",name).length>0; }
function init() {
  database().exec(`
    CREATE TABLE IF NOT EXISTS site_branding (
      id INTEGER PRIMARY KEY CHECK(id=1),
      logo_path TEXT,
      cover_path TEXT,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS site_branding_uploads (
      object_path TEXT PRIMARY KEY,
      actor_id TEXT NOT NULL,
      kind TEXT NOT NULL CHECK(kind IN ('logo','cover')),
      size INTEGER NOT NULL,
      content_type TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      published_path TEXT
    );
  `);
}
export function branding() {
  const saved=exists("site_branding")?rows("SELECT * FROM site_branding WHERE id=1")[0]:undefined;
  const logoPath=saved?.logo_path?String(saved.logo_path):null;
  const coverPath=saved?.cover_path?String(saved.cover_path):null;
  return {logoPath,coverPath,logoUrl:logoPath?`/api/storage${logoPath}`:"/server-logo.png",
    coverUrl:coverPath?`/api/storage${coverPath}`:"",updatedAt:String(saved?.updated_at || "")};
}
export function uploadQuota(actor:string) {
  if (exists("site_branding_uploads") && Number(rows("SELECT count(*) AS n FROM site_branding_uploads WHERE actor_id=? AND created_at>?",actor,Date.now()-600000)[0].n)>=20) {
    throw new HttpError(429,"Trop d'envois d'images. Réessayez dans quelques minutes.");
  }
}
export function registerUpload(actor:string,objectPath:string,kind:"logo"|"cover",size:number,contentType:string) {
  transaction(()=>{
    requireSiteOwner(actor);init();uploadQuota(actor);
    run("INSERT INTO site_branding_uploads(object_path,actor_id,kind,size,content_type,created_at) VALUES(?,?,?,?,?,?)",
      objectPath,actor,kind,size,contentType,Date.now());
  });
}
function imageType(bytes:Buffer) {
  if (bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return "image/png";
  if (bytes[0]===255 && bytes[1]===216 && bytes[2]===255) return "image/jpeg";
  if (bytes.subarray(0,4).toString()==="RIFF" && bytes.subarray(8,12).toString()==="WEBP") return "image/webp";
  return "";
}
export async function publishImage(actor:string,kind:"logo"|"cover",objectPath:string) {
  if (!exists("site_branding_uploads")) throw new HttpError(400,"Envoyez l'image avant de l'enregistrer.");
  const ticket=rows("SELECT * FROM site_branding_uploads WHERE object_path=? AND actor_id=? AND kind=?",objectPath,actor,kind)[0];
  if (!ticket) throw new HttpError(400,"Cet envoi d'image n'appartient pas à votre compte ou au bon emplacement.");
  if (ticket.published_path) return String(ticket.published_path);
  if (Date.now()-Number(ticket.created_at)>900000) throw new HttpError(400,"L'envoi a expiré. Sélectionnez à nouveau l'image.");
  try {
    const file=await brandingStorage.getObjectEntityFile(objectPath);
    const [metadata]=await file.getMetadata();
    const limit=kind==="logo"?logoLimit:coverLimit;
    if (Number(metadata.size)!==Number(ticket.size) || Number(metadata.size)>limit || metadata.contentType!==ticket.content_type) {
      throw new HttpError(400,"Le fichier envoyé ne correspond pas à une image valide de la taille autorisée.");
    }
    // Pin the source generation and publish an immutable copy: the signed upload
    // URL cannot later overwrite the file being displayed on the public site.
    const source=file.bucket.file(file.name,{generation:metadata.generation});
    const [header]=await source.download({start:0,end:15});
    if (imageType(header)!==ticket.content_type) throw new HttpError(400,"Le contenu du fichier n'est pas une image PNG, JPEG ou WebP valide.");
    const publishedPath=`/objects/site-branding/${randomUUID()}`;
    const destination=file.bucket.file(file.name.replace(/uploads\/[^/]+$/,publishedPath.slice("/objects/".length)));
    await source.copy(destination,{preconditionOpts:{ifGenerationMatch:0}});
    await brandingStorage.trySetObjectEntityAclPolicy(publishedPath,{owner:actor,visibility:"public"});
    transaction(()=>{
      requireSiteOwner(actor);
      run("UPDATE site_branding_uploads SET published_path=? WHERE object_path=? AND published_path IS NULL",publishedPath,objectPath);
    });
    return publishedPath;
  } catch(error) {
    if (error instanceof HttpError) throw error;
    if (error instanceof Error && error.name==="ObjectNotFoundError") throw new HttpError(400,"L'image n'a pas encore été envoyée.");
    throw new HttpError(503,"Le stockage d'images est momentanément indisponible. L'image actuelle n'a pas été changée.");
  }
}
export async function updateBranding(actor:string,input:{logoPath?:string|null;coverPath?:string|null}) {
  const changed:Partial<Record<"logoPath"|"coverPath",string|null>>={};
  for (const kind of ["logo","cover"] as const) {
    const key=kind==="logo"?"logoPath":"coverPath";
    if (input[key]!==undefined) changed[key]=input[key]===null?null:await publishImage(actor,kind,input[key]!);
  }
  return transaction(()=>{
    requireSiteOwner(actor);const current=branding();init();
    run("INSERT INTO site_branding(id,logo_path,cover_path,updated_at) VALUES(1,?,?,?) ON CONFLICT(id) DO UPDATE SET logo_path=excluded.logo_path,cover_path=excluded.cover_path,updated_at=excluded.updated_at",
      changed.logoPath===undefined?current.logoPath:changed.logoPath,changed.coverPath===undefined?current.coverPath:changed.coverPath,new Date().toISOString());
    return branding();
  });
}