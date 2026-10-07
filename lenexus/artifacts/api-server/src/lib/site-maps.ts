import * as Z from "@workspace/api-zod";
import type { SiteMap, SiteMapInput } from "@workspace/api-zod";
import { initialSiteMaps } from "../data/site-maps";
import { database, HttpError, rows, run, transaction } from "./tribe-store";
import { requireSiteOwner } from "./site-access";
import { publishImage } from "./site-branding";

const uploadPath = /^\/objects\/uploads\/[a-f0-9-]{36}$/;
const publishedUrl = /^\/api\/storage(\/objects\/site-branding\/[a-f0-9-]{36})$/;
const staticImages = new Set(initialSiteMaps.flatMap(m => [m.image, ...m.gallery]));
const hasEdits = () => rows("SELECT name FROM sqlite_master WHERE type='table' AND name='site_maps'").length > 0;

export function listSiteMaps(): SiteMap[] {
  const edited = new Map<string, SiteMap>();
  if (hasEdits()) {
    for (const row of rows("SELECT slug, document FROM site_maps")) {
      try {
        const data = Z.GetSiteMapResponse.parse(JSON.parse(String(row.document)));
        if (data.slug !== row.slug) throw new Error("Map identity mismatch");
        edited.set(data.slug, { resourcesUrl: "", dinosUrl: "", ...data });
      } catch {
        throw new HttpError(503, "Une fiche map enregistrée est invalide. Contactez un propriétaire.");
      }
    }
  }
  return initialSiteMaps.map(m => edited.get(m.slug) ?? structuredClone(m));
}

export function getSiteMap(slug: string): SiteMap {
  const map = listSiteMaps().find(m => m.slug === slug);
  if (!map) throw new HttpError(404, "Map introuvable.");
  return map;
}

function checkImage(value: string, allowEmpty: boolean) {
  if (!value && allowEmpty) return;
  if (staticImages.has(value) || uploadPath.test(value)) return;
  const stored = value.match(publishedUrl);
  if (stored) {
    // Only an image validated and published by our upload pipeline is reusable.
    if (rows("SELECT name FROM sqlite_master WHERE type='table' AND name='site_branding_uploads'").length &&
        rows("SELECT published_path FROM site_branding_uploads WHERE published_path=? AND kind='cover'", stored[1]).length) return;
    throw new HttpError(400, "Cette image n'a pas été validée par le stockage du site.");
  }
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) throw new Error();
  } catch {
    throw new HttpError(400, "Utilisez une image du site, un fichier envoyé ou un lien HTTPS valide.");
  }
}

function cleanInput(input: SiteMapInput): SiteMapInput {
  const clean = { ...input };
  for (const key of ["name", "image", "blurb", "description", "size", "biomes", "transfers", "specials"] as const) {
    clean[key] = clean[key].trim();
  }
  if (!clean.name) throw new HttpError(400, "Le nom de la map est obligatoire.");
  for (const key of ["creatures", "zones", "rules", "gallery"] as const) {
    clean[key] = [...new Set(clean[key].map(x => x.trim()))];
    if (clean[key].some(x => !x)) throw new HttpError(400, "Retirez les éléments vides des listes.");
  }
  checkImage(clean.image, true);
  clean.gallery.forEach(image => checkImage(image, false));
  for (const key of ["resourcesUrl", "dinosUrl"] as const) {
    clean[key] = (clean[key] ?? "").trim();
    if (!clean[key]) continue;
    try {
      const url = new URL(clean[key]);
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error();
    } catch {
      throw new HttpError(400, "Les liens ressources et dinos doivent être des adresses HTTP ou HTTPS valides, sans identifiants.");
    }
  }
  return clean;
}

async function resolveImage(actor: string, value: string) {
  return uploadPath.test(value) ? `/api/storage${await publishImage(actor, "cover", value)}` : value;
}

export async function updateSiteMap(actor: string, slug: string, input: SiteMapInput): Promise<SiteMap> {
  requireSiteOwner(actor);
  const current = getSiteMap(slug);
  if (current.revision !== input.revision) throw new HttpError(409, "Cette map a été modifiée par un autre propriétaire. Vos changements ne sont pas enregistrés ; rechargez la dernière version avant de réessayer.");
  const clean = cleanInput({ ...input, resourcesUrl: input.resourcesUrl ?? current.resourcesUrl ?? "", dinosUrl: input.dinosUrl ?? current.dinosUrl ?? "" });
  // Do not create a database record until every image has been securely validated.
  clean.image = await resolveImage(actor, clean.image);
  const gallery: string[] = [];
  for (const image of clean.gallery) gallery.push(await resolveImage(actor, image));
  clean.gallery = [...new Set(gallery)];
  return transaction(() => {
    requireSiteOwner(actor);
    const latest = getSiteMap(slug);
    if (latest.revision !== input.revision) throw new HttpError(409, "Cette map a été modifiée pendant votre envoi. Vos changements ne sont pas enregistrés ; rechargez la dernière version.");
    const result = Z.UpdateSiteMapResponse.parse({
      ...clean, slug, revision: latest.revision + 1, updatedAt: new Date().toISOString(),
    });
    database().exec("CREATE TABLE IF NOT EXISTS site_maps (slug TEXT PRIMARY KEY, document TEXT NOT NULL)");
    run("INSERT INTO site_maps(slug,document) VALUES(?,?) ON CONFLICT(slug) DO UPDATE SET document=excluded.document", slug, JSON.stringify(result));
    return result;
  });
}

export function isAttachedMapImage(objectPath: string) {
  if (!/^\/objects\/site-branding\/[a-f0-9-]{36}$/.test(objectPath) || !hasEdits()) return false;
  const url = `/api/storage${objectPath}`;
  return listSiteMaps().some(map => map.image === url || map.gallery.includes(url));
}