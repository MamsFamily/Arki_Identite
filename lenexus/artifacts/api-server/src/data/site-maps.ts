// Initial catalogue preserved from the existing public pages. Persisted owner edits take precedence.
import type { SiteMap } from "@workspace/api-zod";
type MapKind = SiteMap["kind"];
const IMG = {
  "landscape": "/nexus-landscape.jpg",
  "home": "/nexus-home.webp",
  "cluster": "/nexus-cluster.webp",
  "mySpace": "/nexus-my-space.webp",
  "homeLogo": "/nexus-home-logo.webp",
  "otter": "/nexus-mascot.webp",
  "highlands": "/map-highlands.jpg",
  "ragnarok": "/map-ragnarok.webp",
  "ragnarokEvent": "/map-ragnarok-event.webp",
  "valguero": "/map-valguero.webp",
  "astraeos": "/map-astraeos.webp",
  "svartalfheim": "/map-svartalfheim.webp",
  "genesis": "/map-genesis-1.webp",
  "aberration": "/map-aberration.webp",
  "scorchedEarth": "/map-scorched-earth.webp",
  "theIsland": "/map-the-island.webp",
  "theCenter": "/map-the-center.webp",
  "lostColony": "/map-lost-colony.webp",
  "extinction": "/map-extinction.webp",
  "crystal": "/map-crystal-cavern.jpg",
  "desert": "/map-desert.jpg",
  "aurora": "/map-aurora.jpg"
};

const m = (
  slug: string, name: string, kind: MapKind, image: string, size: string, biomes: string,
  difficulty: number, transfers: string, specials: string, blurb: string,
  creatures: string[], zones: string[], rules: string[],
): SiteMap => ({ slug, name, kind, image, size, biomes, difficulty, transfers, specials, blurb, creatures, zones, rules, resourcesUrl: "", dinosUrl: "", description: blurb, gallery: [IMG.highlands, IMG.aurora, IMG.crystal, IMG.desert].filter(g => g !== image), revision: 0, updatedAt: null });

const stdRules = [
  "Les règles générales du cluster s'appliquent sur cette map.",
  "Les règles propres à la map sont à confirmer auprès du staff sur Discord.",
];

export const initialSiteMaps: SiteMap[] = [
  m("ragnarok", "Ragnarok", "main", IMG.ragnarok, "Grande", "Multiples", 3, "Autorisés", "Oui",
    "Une map immense et variée, entre montagnes, forêts, déserts et côtes. Un terrain d'aventure idéal pour poser une première base.",
    ["Prédateurs des crêtes", "Troupeaux des plaines", "Créatures des grottes"], ["Plateaux centraux", "Côte nord", "Vallées boisées"], stdRules),
  m("valguero", "Valguero", "main", IMG.valguero, "Moyenne", "Prairies et canyons", 2, "Autorisés", "Oui",
    "Des plaines ouvertes, des falaises et des ruines à explorer. Une map lisible pour les tribus qui démarrent.",
    ["Herbivores des prairies", "Rôdeurs de canyon", "Créatures aériennes"], ["Plaines ouvertes", "Canyons", "Ruines anciennes"], stdRules),
  m("astraeos", "Astraeos", "premium", IMG.astraeos, "Grande", "Îles flottantes et ciel", 4, "Autorisés", "Oui",
    "Un monde de lumière froide et de reliefs suspendus. Le ciel y compte autant que le sol.",
    ["Créatures des hauteurs", "Prédateurs nocturnes", "Faune lumineuse"], ["Terrasses célestes", "Lacs miroirs", "Pics isolés"], stdRules),
  m("svartalfheim", "Svartalfheim", "premium", IMG.svartalfheim, "Grande", "Forêts sombres et aurores", 4, "Autorisés", "Oui",
    "Des forêts profondes sous un ciel d'aurores. Une ambiance nordique pour les explorateurs patients.",
    ["Meutes des forêts", "Créatures glaciales", "Esprits des sous-bois"], ["Forêts profondes", "Lacs glacés", "Cols de montagne"], stdRules),
  m("genesis", "Genesis 1", "premium", IMG.genesis, "Moyenne", "Biomes simulés", 5, "Autorisés", "Oui",
    "Des biomes aux ambiances très marquées, entre cristaux et technologie. Réservé aux joueurs aguerris.",
    ["Créatures exotiques", "Gardiens mécaniques", "Faune cristalline"], ["Biome lumineux", "Grottes cristallines", "Installations"], stdRules),
  m("lost-colony", "Lost Colony", "premium", IMG.lostColony, "Moyenne", "Ruines et terres arides", 4, "Autorisés", "Oui",
    "Une colonie abandonnée au milieu de terres arides. Les vestiges racontent ce qui s'est passé.",
    ["Charognards des ruines", "Créatures des dunes", "Prédateurs solitaires"], ["Colonie abandonnée", "Plaines sèches", "Falaises"], stdRules),
  m("aberration", "Aberration", "premium", IMG.aberration, "Moyenne", "Souterrains luminescents", 5, "Autorisés", "Oui",
    "Un monde souterrain luminescent, beau et hostile. La verticalité y est reine.",
    ["Faune luminescente", "Grimpeurs des parois", "Prédateurs des profondeurs"], ["Cavernes lumineuses", "Zones de surface", "Gouffres"], stdRules),
  m("scorched-earth", "Scorched Earth", "main", IMG.scorchedEarth, "Moyenne", "Déserts et oasis", 4, "Autorisés", "Oui",
    "Un désert brûlant où chaque oasis compte. L'eau et l'ombre deviennent des ressources stratégiques.",
    ["Créatures des dunes", "Prédateurs du désert", "Faune des oasis"], ["Oasis", "Dunes", "Canyons rouges"], stdRules),
  m("the-island", "The Island", "main", IMG.theIsland, "Moyenne", "Jungle, plages, volcans", 2, "Autorisés", "Oui",
    "La map d'origine : jungle, plages et montagnes. Idéale pour s'initier ou revenir aux sources.",
    ["Faune des plages", "Prédateurs de jungle", "Créatures des rivières"], ["Plages du sud", "Jungle", "Sommet volcanique"], stdRules),
  m("the-center", "The Center", "main", IMG.theCenter, "Grande", "Îles, cascades, grottes", 3, "Autorisés", "Oui",
    "Des îles monumentales et des cascades vertigineuses. Une map pour les bâtisseurs.",
    ["Faune des îles", "Prédateurs des falaises", "Créatures aquatiques"], ["Grande cascade", "Îles du centre", "Grottes"], stdRules),
  m("extinction", "Extinction", "main", IMG.extinction, "Grande", "Ruines futuristes", 5, "Autorisés", "Oui",
    "Un monde en ruine où la nature reprend ses droits face aux machines. La map des défis.",
    ["Créatures corrompues", "Gardiens colossaux", "Faune des ruines"], ["Cité en ruine", "Zones corrompues", "Forêts reprises"], stdRules),
  m("ragnarok-event", "Ragnarok Event", "event", IMG.ragnarokEvent, "Grande", "Multiples", 3, "Selon l'événement", "Selon l'événement",
    "La map spéciale événements : ouverte pour les rendez-vous de la communauté.",
    ["Selon l'événement"], ["Zone de rassemblement", "Terrains d'épreuves"], ["Règles précisées pour chaque événement.", ...stdRules]),
];

