import { database, rows, run, transaction, HttpError } from "./tribe-store";

// Curated from the 31 CurseForge project IDs supplied by the site owner.
const initialMods = [
  ["Klinger Additional Structures", "Construction", "Rangements dédiés, éclairages et structures pour aménager votre base.", "https://83374.media.forgecdn.net/avatars/thumbnails/900/106/256/256/638346438679783701.png", "https://www.curseforge.com/ark-survival-ascended/mods/additional-dedicate-storage"],
  ["RR-AdminStuff", "Administration", "Des outils et objets d’administration destinés à l’équipe.", "https://83374.media.forgecdn.net/avatars/thumbnails/943/264/256/256/638426397161856090.png", "https://www.curseforge.com/ark-survival-ascended/mods/rr-adminstuff"],
  ["Wall'n'Floor Decor", "Construction", "Des décorations et statues pour personnaliser vos espaces.", "https://83374.media.forgecdn.net/avatars/thumbnails/908/734/256/256/638361044971064639.png", "https://www.curseforge.com/ark-survival-ascended/mods/wallnfloor-decor"],
  ["Admin Commands | Gaia Studios", "Administration", "Une interface réservée à l’administration pour les commandes du serveur.", "https://83374.media.forgecdn.net/avatars/thumbnails/1086/740/256/256/638629013651848612.jpeg", "https://www.curseforge.com/ark-survival-ascended/mods/admin-commands"],
  ["Randi's Emporium", "Divers", "Un ensemble d’objets et d’options pour enrichir l’aventure.", "https://83374.media.forgecdn.net/avatars/thumbnails/900/148/256/256/638346498042780147.octet-stream", "https://www.curseforge.com/ark-survival-ascended/mods/randis-emporium"],
  ["Additional Creatures Standalones: Cornusaurus", "Créatures", "Ajoute le Cornusaurus, une créature originale à découvrir dans le jeu.", "https://83374.media.forgecdn.net/avatars/thumbnails/903/66/256/256/638351905241246222.png", "https://www.curseforge.com/ark-survival-ascended/mods/additional-creatures-standalones-cornusaurus"],
  ["Myrm's Custom Creations: Draconis Glaucus", "Créatures", "Ajoute le Glaucus, un dragon aquatique doté d’un souffle électrique.", "https://83374.media.forgecdn.net/avatars/thumbnails/926/43/256/256/638395354542517944.png", "https://www.curseforge.com/ark-survival-ascended/mods/draconis-glaucus"],
  ["Klinger Additional Rustic Building", "Construction", "Des structures rustiques et des matériaux supplémentaires pour vos constructions.", "https://83374.media.forgecdn.net/avatars/thumbnails/915/493/256/256/638373473836473709.png", "https://www.curseforge.com/ark-survival-ascended/mods/klinger-additional-rustic-building"],
  ["Awesome Spyglass!", "Interface", "Identifiez dinos, joueurs, œufs et structures avec des informations détaillées.", "https://83374.media.forgecdn.net/avatars/thumbnails/915/889/256/256/638374185412464094.octet-stream", "https://www.curseforge.com/ark-survival-ascended/mods/awesomespyglass"],
  ["Pelayori's Cryo Storage (Crossplay!)", "Qualité de vie", "Cryopods, cryogun, cryoterminal et outils de gestion des créatures.", "https://83374.media.forgecdn.net/avatars/thumbnails/972/618/256/256/638474922382511261.png", "https://www.curseforge.com/ark-survival-ascended/mods/cryopods"],
  ["Greenhouse Glass Fix", "Qualité de vie", "Améliore l’opacité du verre de serre pour lui donner un rendu plus réaliste.", "https://83374.media.forgecdn.net/avatars/thumbnails/909/120/256/256/638361890410033750.png", "https://www.curseforge.com/ark-survival-ascended/mods/greenhouse-glass-fix"],
  ["ASA-Bot Companion", "Interface", "Relie certaines fonctions du serveur ASA au bot Discord.", "https://83374.media.forgecdn.net/avatars/thumbnails/904/454/256/256/638354666312504622.png", "https://www.curseforge.com/ark-survival-ascended/mods/asa-bot-companion"],
  ["Runic Wyverns", "Créatures", "Des wyvernes runiques lumineuses avec un vol retravaillé.", "https://83374.media.forgecdn.net/avatars/thumbnails/948/378/256/256/638435552953854899.png", "https://www.curseforge.com/ark-survival-ascended/mods/runic-wyverns"],
  ["Visual Storage (Cross Platform)", "Construction", "Des conteneurs de stockage dont le contenu s’actualise visuellement.", "https://83374.media.forgecdn.net/avatars/thumbnails/965/420/256/256/638464123145362058.png", "https://www.curseforge.com/ark-survival-ascended/mods/visual-storage"],
  ["AP+ Manticores", "Créatures", "Ajoute des manticores à l’univers du jeu.", "https://83374.media.forgecdn.net/avatars/thumbnails/1060/293/256/256/638591909424758258.jpg", "https://www.curseforge.com/ark-survival-ascended/mods/ap-manticore"],
  ["Shiny! Dinos Ascended", "Créatures", "Des dinosaures Shiny aux variations colorées à repérer et apprivoiser.", "https://83374.media.forgecdn.net/avatars/thumbnails/895/831/256/256/638340791557646005.png", "https://www.curseforge.com/ark-survival-ascended/mods/shiny-ascended"],
  ["Sparky (Freemium)", "Créatures", "Un dragon doté de capacités spéciales pour votre aventure.", "https://83374.media.forgecdn.net/avatars/thumbnails/1078/880/256/256/638617598407590446.png", "https://www.curseforge.com/ark-survival-ascended/mods/sparky_premium"],
  ["Outdoor Decor", "Construction", "Des éléments de décoration extérieure pour vos bases.", "https://83374.media.forgecdn.net/avatars/thumbnails/1039/971/256/256/638565751583074442.png", "https://www.curseforge.com/ark-survival-ascended/mods/outdoor-decor-mod"],
  ["ARKomatic", "Qualité de vie", "Des structures et fonctions pour simplifier la fabrication et le quotidien.", "https://83374.media.forgecdn.net/avatars/thumbnails/906/762/256/256/638357174956440109.png", "https://www.curseforge.com/ark-survival-ascended/mods/arkomatic"],
  ["Relevant Incubator", "Qualité de vie", "Automatise l’incubation des œufs.", "https://83374.media.forgecdn.net/avatars/thumbnails/1081/647/256/256/638621594108187200.png", "https://www.curseforge.com/ark-survival-ascended/mods/relevant-incubator"],
  ["RhynioSpeedNerfFix", "Qualité de vie", "Rétablit la vitesse du Rhyniognatha lorsqu’il transporte une créature.", "https://83374.media.forgecdn.net/avatars/thumbnails/917/470/256/256/638377580927491246.png", "https://www.curseforge.com/ark-survival-ascended/mods/rhyniospeednerffix"],
  ["Nitrado Transfers Fix", "Qualité de vie", "Un correctif de transfert pour les déplacements entre maps.", "https://83374.media.forgecdn.net/avatars/thumbnails/1447/160/256/256/638938852896229694.png", "https://www.curseforge.com/ark-survival-ascended/mods/nitrado-transfers-fix"],
  ["Awesome ARK Tools", "Administration", "Des outils d’administration et des fonctions pratiques pour les joueurs.", "https://83374.media.forgecdn.net/avatars/thumbnails/2014/298/256/256/639236021748757129.png", "https://www.curseforge.com/ark-survival-ascended/mods/awesome-admin-tools"],
  ["Rhythmbox", "Divers", "Un jukebox personnalisable avec une sélection de morceaux intégrée.", "https://83374.media.forgecdn.net/avatars/thumbnails/917/961/256/256/638378377539263455.png", "https://www.curseforge.com/ark-survival-ascended/mods/rhythmbox"],
  ["Structure Management Tools (Quick Stack, Pickup Structures, Transfer Inventory etc.)", "Qualité de vie", "Des outils pour gérer structures et inventaires selon les permissions de tribu.", "https://83374.media.forgecdn.net/avatars/thumbnails/1101/972/256/256/638649867172407923.png", "https://www.curseforge.com/ark-survival-ascended/mods/structure-management-tool"],
  ["Inventory Backup Saver", "Qualité de vie", "Sauvegarde les inventaires après une mort pour permettre leur récupération par le staff.", "https://83374.media.forgecdn.net/avatars/thumbnails/921/62/256/256/638385177518176255.png", "https://www.curseforge.com/ark-survival-ascended/mods/inventory-backup-saver"],
  ["Ez's Engram Unlocker (PC/Xbox/PS)", "Qualité de vie", "Débloque automatiquement les engrammes au fil de la progression.", "https://83374.media.forgecdn.net/avatars/thumbnails/900/135/256/256/638346473849502674.png", "https://www.curseforge.com/ark-survival-ascended/mods/ez-engram-unlocker"],
  ["Arki'Family Mod", "Construction", "Le mod officiel Arki'Family, avec des structures et des skins dédiés.", "https://83374.media.forgecdn.net/avatars/thumbnails/1353/31/256/256/638879149918361921.png", "https://www.curseforge.com/ark-survival-ascended/mods/arkifamily-mod"],
  ["Moro's Indomitable Duo", "Créatures", "Ajoute le Moro Rex et le Moro Raptor.", "https://83374.media.forgecdn.net/avatars/thumbnails/1499/12/256/256/638973674909556374.png", "https://www.curseforge.com/ark-survival-ascended/mods/moros-indomitable-duo"],
  ["Alfa Oceanic Platforms", "Construction", "Des plateformes océaniques de plusieurs formes, compatibles avec les consoles.", "https://83374.media.forgecdn.net/avatars/thumbnails/1425/703/256/256/638923491486060467.png", "https://www.curseforge.com/ark-survival-ascended/mods/alfaoceanicplataforms"],
  ["Summer Bash", "Divers", "Un événement estival avec décorations et activités de saison.", "https://83374.media.forgecdn.net/avatars/thumbnails/1339/764/256/256/638870882527128201.png", "https://www.curseforge.com/ark-survival-ascended/mods/summer-bash"],
];

const legacySeedNames = [
  "Shiny! Dinos Ascended", "S-Dino Variants", "Moro’s Indomitable Duo", "Admin Panel",
  "Awesome Admin Tools", "Inventory Saver", "Visual Storage", "SpyGlass", "ASA Bot",
];

let ready = false;
function init() {
  if (ready) return;
  transaction(() => {
    database().exec(`CREATE TABLE IF NOT EXISTS site_mods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL COLLATE NOCASE UNIQUE,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      image TEXT NOT NULL DEFAULT '',
      source_url TEXT NOT NULL DEFAULT ''
    )`);
    database().exec("CREATE TABLE IF NOT EXISTS site_mods_migrations (migration TEXT PRIMARY KEY)");
    const migration = "curseforge-catalogue-31";
    if (!rows("SELECT migration FROM site_mods_migrations WHERE migration=?", migration).length) {
      for (const name of legacySeedNames) run("DELETE FROM site_mods WHERE name=?", name);
      for (const [name, category, description, image, sourceUrl] of initialMods) {
        run("INSERT OR IGNORE INTO site_mods(name,category,description,image,source_url) VALUES(?,?,?,?,?)",
          name, category, description, image, sourceUrl);
      }
      run("INSERT INTO site_mods_migrations(migration) VALUES(?)", migration);
    }
  });
  ready = true;
}

export type ModInput = { name: string; category: string; description: string; image: string; sourceUrl: string };
export function validateMod(data: ModInput): ModInput {
  const clean = { ...data, name: data.name.trim(), description: data.description.trim(), image: data.image.trim(), sourceUrl: data.sourceUrl.trim() };
  if (!clean.name || !clean.description) throw new HttpError(400, "Le nom et la description sont obligatoires.");
  for (const [field, value] of [["image", clean.image], ["lien", clean.sourceUrl]]) {
    if (!value) continue;
    if (field === "image" && /^\/(?:mod-[a-z0-9-]+\.webp|map-[a-z0-9-]+\.jpg)$/.test(value)) continue;
    try {
      const url = new URL(value);
      if (url.protocol !== "https:" || url.username || url.password) throw new Error();
    } catch { throw new HttpError(400, `L’URL du ${field} doit être un lien HTTPS valide.`); }
  }
  return clean;
}
const select = "SELECT id,name,category,description,image,source_url AS sourceUrl FROM site_mods";
export function listMods() { init(); return rows(`${select} ORDER BY id`); }
export function saveMod(data: ModInput, id?: number) {
  init();
  return transaction(() => {
    const p = validateMod(data);
    let key = id;
    if (key) {
      if (!rows(`${select} WHERE id=?`, key).length) throw new HttpError(404, "Mod introuvable.");
      run("UPDATE site_mods SET name=?,category=?,description=?,image=?,source_url=? WHERE id=?", p.name,p.category,p.description,p.image,p.sourceUrl,key);
    } else {
      key = Number(run("INSERT INTO site_mods(name,category,description,image,source_url) VALUES(?,?,?,?,?)", p.name,p.category,p.description,p.image,p.sourceUrl).lastInsertRowid);
    }
    return rows(`${select} WHERE id=?`, key)[0];
  });
}
export function deleteMod(id: number) {
  init();
  if (!run("DELETE FROM site_mods WHERE id=?", id).changes) throw new HttpError(404, "Mod introuvable.");
}