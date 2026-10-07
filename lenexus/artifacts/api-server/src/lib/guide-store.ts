import { randomUUID } from "node:crypto";
import { pool } from "@workspace/db";
import type * as Z from "@workspace/api-zod";
import { HttpError } from "./tribe-store";
import imported from "../data/discord-guides.json";
export type CommunityGuide = ReturnType<typeof Z.GetGuideResponse.parse>;
export type GuideInput = ReturnType<typeof Z.CreateGuideBody.parse>;
export type GuideMessage = CommunityGuide["messages"][number];

export type GuideActor = { id: string; name: string; staff: boolean };
let initialized: Promise<void> | undefined;
export function initGuides() {
  if (!initialized) initialized = initialize().catch(e => { initialized = undefined; throw e; });
  return initialized;
}
async function initialize() {
  // Only new guide tables. The historical tribes SQLite database is untouched.
  await pool.query(`CREATE TABLE IF NOT EXISTS site_guides (
    id TEXT PRIMARY KEY, title TEXT NOT NULL, content TEXT NOT NULL,
    author_id TEXT NOT NULL, author_name TEXT NOT NULL,
    images JSONB NOT NULL, messages JSONB NOT NULL, media_paths TEXT[] NOT NULL,
    source_url TEXT NOT NULL, source TEXT NOT NULL, starter_missing BOOLEAN NOT NULL,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, revision INTEGER NOT NULL,
    deleted_at TEXT
  );
  CREATE TABLE IF NOT EXISTS site_guide_uploads (
    object_path TEXT PRIMARY KEY, actor_id TEXT NOT NULL, size INTEGER NOT NULL,
    content_type TEXT NOT NULL, created_at TEXT NOT NULL, published_path TEXT
  )`);
  for (const g of imported as CommunityGuide[]) {
    await pool.query(`INSERT INTO site_guides
      (id,title,content,author_id,author_name,images,messages,media_paths,source_url,source,starter_missing,created_at,updated_at,revision)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,1) ON CONFLICT(id) DO NOTHING`,
      [g.id,g.title,g.content,g.authorId,g.authorName,JSON.stringify(g.images),JSON.stringify(g.messages),
        mediaPaths(g.images,g.messages),g.sourceUrl,"discord",g.starterMissing,g.createdAt,g.updatedAt]);
  }
}
function dto(r: Record<string, any>, actor: GuideActor | null): CommunityGuide {
  return {id:r.id,title:r.title,content:r.content,authorId:r.author_id,authorName:r.author_name,
    images:r.images,messages:r.messages,sourceUrl:r.source_url,source:r.source,
    starterMissing:r.starter_missing,createdAt:r.created_at,updatedAt:r.updated_at,
    revision:r.revision,canEdit:!!actor && (actor.id===r.author_id || actor.staff)};
}
export function mediaPaths(images: string[], messages: GuideMessage[]) {
  return [...new Set([...images,...messages.flatMap(m => [
    ...m.media.map(a => a.url),...m.embeds.map(e => e.image),
  ])].filter(u => u.startsWith("/api/storage/objects/guide-")).map(u => u.slice("/api/storage".length)))];
}
export async function listGuides(actor: GuideActor | null) {
  await initGuides();
  const result = await pool.query("SELECT * FROM site_guides WHERE deleted_at IS NULL ORDER BY created_at DESC,id");
  return result.rows.map(r => dto(r,actor));
}
export async function getGuide(id: string, actor: GuideActor | null) {
  await initGuides();
  const {rows} = await pool.query("SELECT * FROM site_guides WHERE id=$1 AND deleted_at IS NULL",[id]);
  if (!rows[0]) throw new HttpError(404,"Guide introuvable.");
  return dto(rows[0],actor);
}
export function validateGuide(input: GuideInput, existing?: CommunityGuide) {
  const title = input.title.trim(), content = input.content.trim();
  if (!title) throw new HttpError(400,"Le titre du guide est obligatoire.");
  if (!content && !input.images.length && !existing?.messages.length)
    throw new HttpError(400,"Ajoutez du texte ou une photo à votre guide.");
  if (existing && !existing.canEdit) throw new HttpError(403,"Vous ne pouvez pas modifier ce guide.");
  if (existing && existing.revision!==input.revision) throw new HttpError(409,"Ce guide a changé. Rechargez-le avant de le modifier.");
  return {title,content};
}
async function validateImages(actor: GuideActor, input: GuideInput, existing?: CommunityGuide) {
  for (const image of input.images) {
    // Retaining an existing image is allowed even for staff; swapping ownership is not.
    if (existing?.images.includes(image)) continue;
    const path = image.startsWith("/api/storage") ? image.slice("/api/storage".length) : "";
    if (!/^\/objects\/guide-images\/[a-f0-9-]{36}$/.test(path))
      throw new HttpError(400,"Utilisez les photos envoyées depuis ce formulaire.");
    const found = await pool.query("SELECT 1 FROM site_guide_uploads WHERE actor_id=$1 AND published_path=$2",[actor.id,path]);
    if (!found.rowCount) throw new HttpError(403,"Cette image n'appartient pas à votre compte.");
  }
}
export async function createGuide(actor: GuideActor, input: GuideInput) {
  await initGuides();
  const {title,content} = validateGuide(input);
  await validateImages(actor,input);
  const id = randomUUID(), now = new Date().toISOString();
  const conn = await pool.connect();
  try {
    await conn.query("BEGIN");
    await conn.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",["guide-create:"+actor.id]);
    const quota = await conn.query("SELECT count(*)::int AS n FROM site_guides WHERE source='site' AND author_id=$1 AND created_at>$2",[actor.id,new Date(Date.now()-600000).toISOString()]);
    if (quota.rows[0].n>=10) throw new HttpError(429,"Trop de guides publiés. Réessayez dans quelques minutes.");
    await conn.query(`INSERT INTO site_guides
      (id,title,content,author_id,author_name,images,messages,media_paths,source_url,source,starter_missing,created_at,updated_at,revision)
      VALUES($1,$2,$3,$4,$5,$6,'[]',$7,'','site',false,$8,$8,1)`,
      [id,title,content,actor.id,actor.name,JSON.stringify(input.images),mediaPaths(input.images,[]),now]);
    await conn.query("COMMIT");
  } catch(e) {await conn.query("ROLLBACK");throw e;} finally {conn.release();}
  return getGuide(id,actor);
}
export async function updateGuide(id: string, actor: GuideActor, input: GuideInput) {
  const existing = await getGuide(id,actor);
  const {title,content} = validateGuide(input,existing);
  await validateImages(actor,input,existing);
  // Transcript and credited author are immutable. Revision guards concurrent writes.
  const result = await pool.query(`UPDATE site_guides SET title=$1,content=$2,images=$3,media_paths=$4,updated_at=$5,revision=revision+1
    WHERE id=$6 AND revision=$7 AND deleted_at IS NULL`,
    [title,content,JSON.stringify(input.images),mediaPaths(input.images,existing.messages),new Date().toISOString(),id,input.revision]);
  if (!result.rowCount) throw new HttpError(409,"Ce guide a changé. Rechargez-le avant de le modifier.");
  return getGuide(id,actor);
}
export async function deleteGuide(id: string, actor: GuideActor, revision: number) {
  const existing = await getGuide(id,actor);
  if (!existing.canEdit) throw new HttpError(403,"Vous ne pouvez pas retirer ce guide.");
  const result = await pool.query("UPDATE site_guides SET deleted_at=$1,revision=revision+1 WHERE id=$2 AND revision=$3 AND deleted_at IS NULL",[new Date().toISOString(),id,revision]);
  if (!result.rowCount) throw new HttpError(409,"Ce guide a changé. Rechargez-le avant de le retirer.");
  // Tombstone prevents an imported guide from reappearing after server restarts.
  return {status:"ok"};
}
export async function canReadGuideMedia(path: string, actorId?: string) {
  if (!/^\/objects\/guide-(media\/[a-f0-9]{64}|images\/[a-f0-9-]{36})$/.test(path)) return false;
  await initGuides();
  const attached = await pool.query("SELECT 1 FROM site_guides WHERE deleted_at IS NULL AND $1=ANY(media_paths) LIMIT 1",[path]);
  if (attached.rowCount) return true;
  if (!actorId) return false;
  const pending = await pool.query("SELECT 1 FROM site_guide_uploads WHERE actor_id=$1 AND published_path=$2",[actorId,path]);
  return !!pending.rowCount;
}