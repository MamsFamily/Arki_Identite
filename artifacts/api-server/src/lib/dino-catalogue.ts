import type { DinoSpecies, DinoSpeciesInput } from "@workspace/api-zod";
import { defaultDinoSpecies } from "../data/dino-catalogue-defaults";
import { database, HttpError, type Row } from "./tribe-store";
import { dinoRows as rows, dinoRun as run, dinoTransaction, sqliteDinoTests } from "./dino-db";
import { listSiteMaps } from "./site-maps";
import { listMods } from "./site-mods";

let ready = false;
let initializing: Promise<void> | undefined;
export async function initDinos():Promise<void> {
  if (ready) return;
  if (initializing) return initializing;
  initializing = initialize();
  try {await initializing;ready=true;} finally {initializing=undefined;}
}
async function initialize() {
  // Runtime never migrates PostgreSQL. Publish applies the Drizzle dev schema.
  // Only the explicitly isolated SQLite test fixture creates its temporary tables.
  if (sqliteDinoTests()) database().exec(`
    CREATE TABLE IF NOT EXISTS site_dino_species (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL COLLATE NOCASE UNIQUE,
      origin TEXT NOT NULL, mod_id INTEGER, maps TEXT NOT NULL, source_url TEXT NOT NULL,
      active INTEGER NOT NULL, revision INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS site_dino_records (
      tribe_id INTEGER NOT NULL REFERENCES tribus(id) ON DELETE CASCADE,
      tribe_key TEXT NOT NULL,
      species_id INTEGER NOT NULL REFERENCES site_dino_species(id),
      stats TEXT NOT NULL, revision INTEGER NOT NULL, note TEXT NOT NULL,
      source TEXT NOT NULL, updated_at TEXT NOT NULL,
      PRIMARY KEY(tribe_key,species_id)
    );
    CREATE TABLE IF NOT EXISTS site_dino_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tribe_id INTEGER NOT NULL REFERENCES tribus(id) ON DELETE CASCADE,
      tribe_key TEXT NOT NULL,
      species_id INTEGER NOT NULL REFERENCES site_dino_species(id), action TEXT NOT NULL,
      before_stats TEXT, after_stats TEXT, actor TEXT NOT NULL, created_at TEXT NOT NULL
    );
  `);
  await enrichCatalogue();
}

// Add missing defaults on existing installations too. Never update an existing
// identity, map selection, revision, deactivation, or a tribe's private records.
export async function enrichCatalogue() {
  await dinoTransaction("dino-catalogue", async () => {
    const existing = await rows("SELECT name,origin,source_url FROM site_dino_species");
    const names = new Set(existing.map(s => String(s.name).toLowerCase()));
    const sources = new Set(existing.filter(s => s.origin === "official").map(s => String(s.source_url)));
    const mapSlugs = new Set(listSiteMaps().map(m => m.slug));
    for (const s of defaultDinoSpecies) {
      // Source identity also preserves the owner's renaming of an imported entry.
      if (names.has(s.name.toLowerCase()) || sources.has(s.sourceUrl)) continue;
      const maps = s.maps.filter(map => mapSlugs.has(map));
      await run("INSERT INTO site_dino_species(name,origin,mod_id,maps,source_url,active) VALUES(?,'official',NULL,?,?,?) ON CONFLICT(name) DO NOTHING",
        s.name, JSON.stringify(maps), s.sourceUrl, maps.length ? 1 : 0);
      names.add(s.name.toLowerCase());
      sources.add(s.sourceUrl);
    }
  });
}

export async function speciesById(id: number): Promise<DinoSpecies> {
  await initDinos();
  const r = (await rows("SELECT * FROM site_dino_species WHERE id=?", id))[0];
  if (!r) throw new HttpError(404, "Espèce introuvable.");
  return decodeSpecies(r);
}
export function decodeSpecies(r:Row):DinoSpecies {
  return { id: Number(r.id), name: String(r.name), origin: r.origin as DinoSpecies["origin"],
    modId: r.mod_id === null ? null : Number(r.mod_id), maps: JSON.parse(String(r.maps)),
    sourceUrl: String(r.source_url), active: !!r.active, revision: Number(r.revision) };
}

export function availableSpecies(s: DinoSpecies) {
  const maps = new Set(listSiteMaps().map(m => m.slug));
  if (!s.active || !s.maps.some(m => maps.has(m))) return false;
  // Deleting a mod never deletes private records; it only removes availability.
  return s.origin === "official" || listMods().some(m => Number(m.id) === s.modId);
}

export async function listSpecies(all = false) {
  await initDinos();
  const species = (await rows("SELECT * FROM site_dino_species ORDER BY lower(name)")).map(decodeSpecies);
  return all ? species : species.filter(availableSpecies);
}

export async function saveSpecies(input: DinoSpeciesInput, id?: number) {
  await initDinos();
  const name = input.name.trim();
  if (!name) throw new HttpError(400, "Le nom de l'espèce est obligatoire.");
  const mapSet = new Set(listSiteMaps().map(m => m.slug));
  if (input.maps.some(m => !mapSet.has(m))) throw new HttpError(400, "Choisissez des maps présentes sur le site.");
  if (input.active && !input.maps.length) throw new HttpError(400, "Une espèce active doit être associée à une map.");
  if (input.origin === "mod" && (input.modId === null || !listMods().some(m => Number(m.id) === input.modId))) {
    throw new HttpError(400, "Cette créature doit être liée à un mod renseigné sur le site.");
  }
  if (input.origin === "official" && input.modId !== null) throw new HttpError(400, "Une espèce officielle ne doit pas être liée à un mod.");
  try {
    const url = new URL(input.sourceUrl);
    if (url.protocol !== "https:" || url.username || url.password) throw new Error();
  } catch { throw new HttpError(400, "Ajoutez un lien HTTPS vers la source du catalogue de cette créature."); }
  return dinoTransaction("dino-catalogue",async () => {
    if ((await rows("SELECT id FROM site_dino_species WHERE lower(name)=lower(?) AND id<>?", name, id || 0)).length)
      throw new HttpError(400, "Une espèce de ce nom existe déjà. Précisez la variante ou le mod.");
    if (id) {
      if ((await speciesById(id)).revision !== input.revision) throw new HttpError(409, "Le catalogue a changé. Rechargez la fiche avant de confirmer.");
      await run("UPDATE site_dino_species SET name=?,origin=?,mod_id=?,maps=?,source_url=?,active=?,revision=revision+1 WHERE id=?",
        name, input.origin, input.modId, JSON.stringify([...new Set(input.maps)]), input.sourceUrl, input.active ? 1 : 0, id);
    } else {
      if (input.revision !== 0) throw new HttpError(409, "La création doit utiliser une fiche neuve.");
      id = Number((await run("INSERT INTO site_dino_species(name,origin,mod_id,maps,source_url,active) VALUES(?,?,?,?,?,?)",
        name, input.origin, input.modId, JSON.stringify([...new Set(input.maps)]), input.sourceUrl, input.active ? 1 : 0)).lastInsertRowid);
    }
    return speciesById(id);
  });
}