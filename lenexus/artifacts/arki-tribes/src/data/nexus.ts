// Données d'illustration du portail. Aucune de ces valeurs ne vient du serveur de jeu :
// elles sont séparées des composants pour pouvoir être remplacées plus tard par une API.

export const asset = (name: string) => `${import.meta.env.BASE_URL}${name}`;

export const IMG = {
  landscape: asset("nexus-landscape.jpg"),
  home: asset("nexus-home.webp"),
  cluster: asset("nexus-cluster.webp"),
  mySpace: asset("nexus-my-space.webp"),
  homeLogo: asset("nexus-home-logo.webp"),
  otter: asset("nexus-mascot.webp"),
  highlands: asset("map-highlands.jpg"),
  ragnarok: asset("map-ragnarok.webp"),
  ragnarokEvent: asset("map-ragnarok-event.webp"),
  valguero: asset("map-valguero.webp"),
  astraeos: asset("map-astraeos.webp"),
  svartalfheim: asset("map-svartalfheim.webp"),
  genesis: asset("map-genesis-1.webp"),
  aberration: asset("map-aberration.webp"),
  scorchedEarth: asset("map-scorched-earth.webp"),
  theIsland: asset("map-the-island.webp"),
  theCenter: asset("map-the-center.webp"),
  lostColony: asset("map-lost-colony.webp"),
  extinction: asset("map-extinction.webp"),
  crystal: asset("map-crystal-cavern.jpg"),
  desert: asset("map-desert.jpg"),
  aurora: asset("map-aurora.jpg"),
};

export const BRAND = {
  name: "ARKI’ FAMILY",
  subtitle: "LE NEXUS",
  slogan: "Votre aventure. Votre tribu. Votre histoire.",
  tags: ["PvE", "FR", "+18", "Crossplay"],
  quote: "Plus qu’un serveur, une communauté de survivants.",
};

// Réglages de cluster fournis par l'équipe (valeurs statiques, pas du temps réel).
export const CLUSTER_SETTINGS = [
  { key: "maps", icon: "map", value: "12", label: "maps" },
  { key: "slots", icon: "users", value: "25", label: "places / map" },
  { key: "wild", icon: "skull", value: "300", label: "Niveau sauvage" },
  { key: "xp", icon: "sparkles", value: "×1.25", label: "XP" },
  { key: "farm", icon: "sprout", value: "×3", label: "Farm" },
  { key: "tame", icon: "paw", value: "×10", label: "Tame" },
  { key: "incub", icon: "egg", value: "×40", label: "Incubation" },
  { key: "mature", icon: "hourglass", value: "×80", label: "Maturation" },
  { key: "diff", icon: "gauge", value: "×3.5", label: "Difficulté" },
] as const;

export type MapKind = "main" | "premium" | "event";
export type MapEntry = {
  slug: string; name: string; kind: MapKind; image: string; size: string; biomes: string;
  difficulty: number; transfers: string; specials: string; blurb: string;
  creatures: string[]; zones: string[]; rules: string[];
};

const m = (
  slug: string, name: string, kind: MapKind, image: string, size: string, biomes: string,
  difficulty: number, transfers: string, specials: string, blurb: string,
  creatures: string[], zones: string[], rules: string[],
): MapEntry => ({ slug, name, kind, image, size, biomes, difficulty, transfers, specials, blurb, creatures, zones, rules });

const stdRules = [
  "Les règles générales du cluster s'appliquent sur cette map.",
  "Les règles propres à la map sont à confirmer auprès du staff sur Discord.",
];

export const MAPS: MapEntry[] = [
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

export const MAP_FILTERS: { key: "all" | MapKind; label: string }[] = [
  { key: "all", label: "Toutes les maps" },
  { key: "main", label: "Maps principales" },
  { key: "premium", label: "Maps premium" },
  { key: "event", label: "Map événement" },
];

export const KIND_LABEL: Record<MapKind, string> = { main: "Principale", premium: "Premium", event: "Événement" };

export type ModEntry = { name: string; category: string; badge: string; image: string; description: string; sourceUrl?: string };
export const MOD_FILTERS = ["Tous", "Créatures", "Construction", "Qualité de vie", "Interface", "Administration", "Divers"];

export type EventEntry = {
  id: string; title: string; subtitle: string; date: string; time: string; map: string;
  image: string; description: string; status: "upcoming" | "past"; category: string;
};
export const EVENTS: EventEntry[] = [];

export const GALLERY_SHOTS = [IMG.highlands, IMG.aurora, IMG.crystal, IMG.desert];
