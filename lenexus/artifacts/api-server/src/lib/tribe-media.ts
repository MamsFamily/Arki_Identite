import { rows, type Row } from "./tribe-store";

type MediaKind = "logo" | "base" | "gallery";
function available() {
  return rows("SELECT name FROM sqlite_master WHERE type='table' AND name='site_tribe_media'").length > 0;
}
export function mediaUrl(tribeId: number, kind: MediaKind, source: string) {
  if (!source || !available()) return source;
  const image = rows("SELECT digest FROM site_tribe_media WHERE tribu_id=? AND kind=? AND source_url=?", tribeId, kind, source)[0];
  return image ? `/api/tribes/${tribeId}/images/${image.digest}` : source;
}
export function originalGalleryUrl(tribeId: number, input: string) {
  const sources = rows("SELECT url FROM photos_tribu WHERE tribu_id=?", tribeId);
  const original = sources.find(row => mediaUrl(tribeId, "gallery", String(row.url)) === input);
  return original ? String(original.url) : undefined;
}
export function publishedImage(tribe: Row, digest: string) {
  if (!available()) return undefined;
  const images = rows("SELECT * FROM site_tribe_media WHERE tribu_id=? AND digest=?", Number(tribe.id), digest);
  return images.find(image => {
    if (image.kind === "logo") return image.source_url === tribe.logo_url;
    if (image.kind === "base") return image.source_url === tribe.photo_base;
    return rows("SELECT id FROM photos_tribu WHERE tribu_id=? AND url=?", Number(tribe.id), image.source_url).length > 0;
  });
}