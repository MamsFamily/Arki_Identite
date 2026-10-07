import { randomUUID } from "node:crypto";
import { brandingStorage } from "./site-branding";
import { database, HttpError, rows, run, transaction, isAttachedTribeCover } from "./tribe-store";

export const imageLimits = { logo: 5 * 1024 * 1024, cover: 10 * 1024 * 1024, gallery: 10 * 1024 * 1024 };
function exists() {
  return rows("SELECT name FROM sqlite_master WHERE name='site_tribe_uploads'").length > 0;
}
function init() {
  database().exec(`CREATE TABLE IF NOT EXISTS site_tribe_uploads (
    object_path TEXT PRIMARY KEY, actor_id TEXT NOT NULL, kind TEXT NOT NULL,
    size INTEGER NOT NULL, content_type TEXT NOT NULL, created_at INTEGER NOT NULL,
    published_path TEXT UNIQUE
  )`);
}
export async function requestImageUpload(actor: string, input: {kind: "logo"|"cover"|"gallery"; size: number; contentType: string}) {
  if (input.size > imageLimits[input.kind]) throw new HttpError(400, input.kind === "logo" ? "Logo : 5 Mo maximum." : "Photo : 10 Mo maximum.");
  init();
  const quota = () => {
    if (Number(rows("SELECT count(*) AS n FROM site_tribe_uploads WHERE actor_id=? AND created_at>?", actor, Date.now()-600000)[0].n) >= 40)
      throw new HttpError(429, "Trop d'envois d'images. Réessayez dans quelques minutes.");
  };
  quota();
  let uploadURL: string;
  try { uploadURL = await brandingStorage.getObjectEntityUploadURL(); }
  catch { throw new HttpError(503, "Le stockage d'images est momentanément indisponible."); }
  const objectPath = brandingStorage.normalizeObjectEntityPath(uploadURL);
  if (!/^\/objects\/uploads\/[a-f0-9-]{36}$/.test(objectPath)) throw new HttpError(503, "Emplacement d'image invalide.");
  transaction(() => {
    quota();
    run("INSERT INTO site_tribe_uploads(object_path,actor_id,kind,size,content_type,created_at) VALUES(?,?,?,?,?,?)",
      objectPath, actor, input.kind, input.size, input.contentType, Date.now());
  });
  return {uploadURL, objectPath};
}
function imageType(bytes: Buffer) {
  if (bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return "image/png";
  if (bytes[0]===255 && bytes[1]===216 && bytes[2]===255) return "image/jpeg";
  if (bytes.subarray(0,4).toString()==="RIFF" && bytes.subarray(8,12).toString()==="WEBP") return "image/webp";
  return "";
}
export async function publishUpload(actor: string, objectPath: string) {
  const ticket = exists() ? rows("SELECT * FROM site_tribe_uploads WHERE object_path=? AND actor_id=?", objectPath, actor)[0] : undefined;
  if (!ticket) throw new HttpError(400, "Cet envoi d'image n'appartient pas à votre compte.");
  if (ticket.published_path) return {url: `/api/storage${ticket.published_path}`};
  if (Date.now()-Number(ticket.created_at)>900000) throw new HttpError(400, "L'envoi a expiré. Sélectionnez à nouveau le fichier.");
  try {
    const file = await brandingStorage.getObjectEntityFile(objectPath);
    const [metadata] = await file.getMetadata();
    if (Number(metadata.size)!==Number(ticket.size) || metadata.contentType!==ticket.content_type)
      throw new HttpError(400, "La taille ou le format du fichier envoyé ne correspond pas.");
    const source = file.bucket.file(file.name, {generation: metadata.generation});
    const [header] = await source.download({start: 0, end: 15});
    if (imageType(header)!==ticket.content_type) throw new HttpError(400, "Le fichier n'est pas une image PNG, JPEG ou WebP valide.");
    const publishedPath = `/objects/tribe-uploads/${randomUUID()}`;
    const destination = file.bucket.file(file.name.replace(/uploads\/[^/]+$/, publishedPath.slice("/objects/".length)));
    await source.copy(destination, {preconditionOpts: {ifGenerationMatch: 0}});
    await brandingStorage.trySetObjectEntityAclPolicy(publishedPath, {owner: actor, visibility: "public"});
    transaction(() => run("UPDATE site_tribe_uploads SET published_path=? WHERE object_path=? AND published_path IS NULL", publishedPath, objectPath));
    return {url: `/api/storage${rows("SELECT published_path FROM site_tribe_uploads WHERE object_path=?", objectPath)[0].published_path}`};
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(503, "Impossible de vérifier l'image envoyée. Réessayez ; vos images enregistrées n'ont pas été modifiées.");
  }
}
export function ownedImageUrl(url: string, actor: string, kind: "logo"|"cover"|"gallery") {
  if (!/^\/api\/storage\/objects\/tribe-uploads\/[a-f0-9-]{36}$/.test(url)) return false;
  if (!exists() || !rows("SELECT object_path FROM site_tribe_uploads WHERE published_path=? AND actor_id=? AND kind=?", url.slice("/api/storage".length), actor, kind).length)
    throw new HttpError(400, "Sélectionnez un fichier envoyé par votre compte pour cet emplacement.");
  return true;
}
export function isAttachedUpload(objectPath: string) {
  if (!/^\/objects\/tribe-uploads\/[a-f0-9-]{36}$/.test(objectPath) || !exists()) return false;
  const url = `/api/storage${objectPath}`;
  return isAttachedTribeCover(url) || rows("SELECT id FROM tribus WHERE logo_url=? OR photo_base=? UNION SELECT tribu_id AS id FROM photos_tribu WHERE url=? LIMIT 1", url, url, url).length > 0;
}