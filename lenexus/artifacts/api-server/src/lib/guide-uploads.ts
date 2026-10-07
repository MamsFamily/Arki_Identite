import { randomUUID } from "node:crypto";
import { pool } from "@workspace/db";
import { brandingStorage } from "./site-branding";
import { HttpError } from "./tribe-store";
import { initGuides } from "./guide-store";

const uploadPath = /^\/objects\/uploads\/[a-f0-9-]{36}$/;
export function guideImageType(bytes: Buffer) {
  if (bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return "image/png";
  if (bytes[0]===255 && bytes[1]===216 && bytes[2]===255) return "image/jpeg";
  if (bytes.subarray(0,4).toString()==="RIFF" && bytes.subarray(8,12).toString()==="WEBP") return "image/webp";
  return "";
}
export async function requestGuideUpload(actorId: string, input: {size:number;contentType:string}) {
  await initGuides();
  const url = await brandingStorage.getObjectEntityUploadURL();
  const objectPath = brandingStorage.normalizeObjectEntityPath(url);
  if (!uploadPath.test(objectPath)) throw new HttpError(503,"Emplacement d'image invalide.");
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",["guide-upload:"+actorId]);
    const count = await c.query("SELECT count(*)::int AS n FROM site_guide_uploads WHERE actor_id=$1 AND created_at>$2",[actorId,new Date(Date.now()-600000).toISOString()]);
    if (count.rows[0].n>=40) throw new HttpError(429,"Trop d'images envoyées. Réessayez dans quelques minutes.");
    await c.query("INSERT INTO site_guide_uploads(object_path,actor_id,size,content_type,created_at) VALUES($1,$2,$3,$4,$5)",[objectPath,actorId,input.size,input.contentType,new Date().toISOString()]);
    await c.query("COMMIT");
  } catch(e) {await c.query("ROLLBACK");throw e;} finally {c.release();}
  return {objectPath,uploadURL:url};
}
export async function publishGuideUpload(actorId: string, path: string) {
  if (!uploadPath.test(path)) throw new HttpError(400,"Emplacement d'image invalide.");
  await initGuides();
  const {rows} = await pool.query("SELECT * FROM site_guide_uploads WHERE actor_id=$1 AND object_path=$2",[actorId,path]);
  const ticket = rows[0];
  if (!ticket) throw new HttpError(403,"Cet envoi d'image n'appartient pas à votre compte.");
  if (ticket.published_path) return {url:`/api/storage${ticket.published_path}`};
  if (Date.now()-Date.parse(ticket.created_at)>900000) throw new HttpError(400,"L'envoi a expiré. Sélectionnez à nouveau l'image.");
  try {
    const file = await brandingStorage.getObjectEntityFile(path);
    const [metadata] = await file.getMetadata();
    if (Number(metadata.size)!==ticket.size || metadata.contentType!==ticket.content_type)
      throw new HttpError(400,"La taille ou le format de l'image ne correspond pas.");
    const source = file.bucket.file(file.name,{generation:metadata.generation});
    const [header] = await source.download({start:0,end:15});
    if (guideImageType(header)!==ticket.content_type) throw new HttpError(400,"Le fichier doit être une vraie image PNG, JPEG ou WebP.");
    const publishedPath = `/objects/guide-images/${randomUUID()}`;
    const destination = file.bucket.file(file.name.replace(/uploads\/[^/]+$/,publishedPath.slice("/objects/".length)));
    await source.copy(destination,{preconditionOpts:{ifGenerationMatch:0}});
    // Serving is gated by guide attachment or the ticket owner, not a blanket public ACL.
    await pool.query("UPDATE site_guide_uploads SET published_path=$1 WHERE object_path=$2 AND published_path IS NULL",[publishedPath,path]);
    const current = await pool.query("SELECT published_path FROM site_guide_uploads WHERE object_path=$1",[path]);
    return {url:`/api/storage${current.rows[0].published_path}`};
  } catch(e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(503,"Impossible de vérifier l'image envoyée. Réessayez.");
  }
}