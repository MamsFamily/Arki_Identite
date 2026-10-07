import { readFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { objectStorageClient, ObjectStorageService } from "../lib/objectStorage";

const root = path.resolve(import.meta.dirname, "../../../..");
const manifest = JSON.parse(readFileSync(path.join(root, ".local/tribe-media-recovery/manifest.json"), "utf8"));
const images = manifest.assets.filter((image: any) => image.status === "recovered");
const storage = new ObjectStorageService();
const directory = storage.getPrivateObjectDir().replace(/^\/+/, "");
const slash = directory.indexOf("/");
if (slash < 1) throw new Error("Private image storage is not configured.");
const bucket = objectStorageClient.bucket(directory.slice(0, slash));
const prefix = directory.slice(slash + 1);
const saved: { asset: any; objectPath: string }[] = [];
for (const asset of images) {
  const bytes = readFileSync(path.join(root, asset.file));
  if (createHash("sha256").update(bytes).digest("hex") !== asset.digest) throw new Error("Recovered image digest mismatch.");
  const objectPath = `/objects/tribe-media/${asset.digest}`;
  const file = bucket.file(`${prefix}/tribe-media/${asset.digest}`);
  try {
    await file.save(bytes, { resumable: false, preconditionOpts: { ifGenerationMatch: 0 },
      metadata: { contentType: asset.contentType } });
  } catch (error: any) {
    if (Number(error.code) !== 412) throw new Error("Image storage failed; no tribe links were changed.");
  }
  const [stored] = await file.download();
  if (createHash("sha256").update(stored).digest("hex") !== asset.digest) throw new Error("Stored image verification failed.");
  saved.push({ asset, objectPath });
}
const backups = path.join(root, ".local/tribe-media-recovery/backups");
mkdirSync(backups, { recursive: true });
const db = new DatabaseSync(path.join(root, "tribus.db"));
db.exec("PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000");
db.exec(`VACUUM INTO '${path.join(backups, Date.now() + ".db").replaceAll("'", "''")}'`);
db.exec("BEGIN IMMEDIATE");
try {
  db.exec(`CREATE TABLE IF NOT EXISTS site_tribe_media (
    tribu_id INTEGER NOT NULL REFERENCES tribus(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK(kind IN ('logo','base','gallery')),
    source_url TEXT NOT NULL, object_path TEXT NOT NULL, digest TEXT NOT NULL,
    content_type TEXT NOT NULL, PRIMARY KEY(tribu_id,kind,source_url)
  )`);
  const insert = db.prepare(`INSERT INTO site_tribe_media VALUES(?,?,?,?,?,?)
    ON CONFLICT(tribu_id,kind,source_url) DO UPDATE SET
    object_path=excluded.object_path,digest=excluded.digest,content_type=excluded.content_type`);
  for (const { asset, objectPath } of saved) {
    const current = asset.kind === "gallery"
      ? db.prepare("SELECT url AS source FROM photos_tribu WHERE id=? AND tribu_id=?").get(asset.photoId, asset.tribeId)
      : db.prepare(`SELECT ${asset.kind === "logo" ? "logo_url" : "photo_base"} AS source FROM tribus WHERE id=?`).get(asset.tribeId);
    if (current?.source !== asset.source) throw new Error("A tribe image changed during recovery; no links were changed.");
    insert.run(asset.tribeId, asset.kind, asset.source, objectPath, asset.digest, asset.contentType);
  }
  db.exec("COMMIT");
  console.log(JSON.stringify({ published: saved.length, tribes: saved.map(({ asset }) => ({ id: asset.tribeId, name: asset.tribeName, kind: asset.kind })) }));
} catch (error) { db.exec("ROLLBACK"); throw error; }
finally { db.close(); }