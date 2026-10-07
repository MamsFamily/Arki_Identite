import raw from "./map-bosses.json";

export type BossDifficulty = "gamma" | "beta" | "alpha";
export const BOSS_DIFFICULTIES: Record<BossDifficulty, string> = { gamma: "Gamma", beta: "Bêta", alpha: "Alpha" };
export const ASCENSION_LEVELS: Record<BossDifficulty, number> = { gamma: 5, beta: 10, alpha: 15 };
export const ASCENSION_RULE = "Seul le bonus le plus élevé obtenu sur une même ascension compte : ses difficultés ne se cumulent pas. Les ascensions de maps différentes se cumulent. Le bonus augmente le niveau maximum du survivant ; il n’accorde pas ces niveaux immédiatement.";
export const ASTRAEOS_ASCENSION = {
  title: "Ascension Astraeos",
  requirement: "Abyssalus ET Shallocis doivent tous les deux être vaincus dans la difficulté correspondante pour valider l’Ascension. Battre seulement l’un des deux ne valide pas l’Ascension.",
  note: "Le bonus est accordé une seule fois pour l’Ascension Astraeos, et non une fois par kraken. Cette Ascension ne déclenche pas de cinématique d’Ascension ni d’upload automatique du personnage.",
};
export type BossItem = { name: string; quantity: number };
export type BossRequirements = {
  playerLevel: number | null;
  artifacts: BossItem[];
  tributes: BossItem[];
  bossTrophies: BossItem[];
  specialRequirements: string[];
  ascensionLevels: number | null;
};
export type MapBoss = {
  id: string;
  mapId: string;
  name: string;
  type: string;
  difficulties: BossDifficulty[] | null;
  requirements: Partial<Record<BossDifficulty | "default", BossRequirements>>;
  ascension: boolean;
  ascensionGroup: string | null;
  notes: string[];
  tributeStatus: "known" | "none" | "unverified";
};

/** User-supplied ASA data: quantities are never substituted from ASE sources. */
export const mapBosses = raw as MapBoss[];
export function bossesForMap(slug: string): MapBoss[] {
  // This event fiche is the standard Ragnarok map; share one source, not copies.
  const mapId = slug === "ragnarok-event" ? "ragnarok" : slug;
  return mapBosses.filter(b => b.mapId === mapId);
}

// Keep the official English name alongside known French item translations.
const itemNames: Record<string, string> = {
  "Artifact of the Clever": "Artéfact de la Sagesse",
  "Artifact of the Hunter": "Artéfact du Chasseur",
  "Artifact of the Massive": "Artéfact du Massif",
  "Artifact of the Brute": "Artéfact de la Brute",
  "Artifact of the Devourer": "Artéfact du Dévoreur",
  "Artifact of the Pack": "Artéfact de la Meute",
  "Artifact of the Cunning": "Artéfact de la Ruse",
  "Artifact of the Immune": "Artéfact de l’Immunité",
  "Artifact of the Skylord": "Artéfact du Seigneur des Cieux",
  "Artifact of the Strong": "Artéfact de la Puissance",
  "Artifact of the Gatekeeper": "Artéfact du Gardien",
  "Artifact of the Crag": "Artéfact des Montagnes",
  "Artifact of the Destroyer": "Artéfact du Destructeur",
  "Artifact of the Depths": "Artéfact des Profondeurs",
  "Artifact of the Shadows": "Artéfact des Ombres",
  "Artifact of the Stalker": "Artéfact du Traqueur",
  "Artifact of Chaos": "Artéfact du Chaos",
  "Artifact of Growth": "Artéfact de la Croissance",
  "Artifact of the Void": "Artéfact du Vide",
  "Argentavis Talon": "Serre d’Argentavis",
  "Sarcosuchus Skin": "Peau de Sarcosuchus",
  "Sauropod Vertebra": "Vertèbre de Sauropode",
  "Titanoboa Venom": "Venin de Titanoboa",
  "Megalania Toxin": "Toxine de Megalania",
  "Megalodon Tooth": "Dent de Mégalodon",
  "Spinosaurus Sail": "Voile de Spinosaure",
  "Giganotosaurus Heart": "Cœur de Giganotosaure",
  "Tusoteuthis Tentacle": "Tentacule de Tusoteuthis",
};
export const bossItemName = (name: string) => itemNames[name] ?? name;