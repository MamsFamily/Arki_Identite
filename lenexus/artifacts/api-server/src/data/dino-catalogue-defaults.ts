import seed from "./dino-species.json";

// Curated against Dododex and the creature pages on ark.wiki.gg, 2026-10-04.
// Do not generate every prefix for every species: most combinations do not exist.
// The maps inherited below are catalogue associations, NOT verified cluster spawns.
const base = new Map(seed.species.map(s => [s.name, s]));
const groups = [
  {
    prefix: "Tek ", names: [
      "Giganotosaurus", "Parasaur", "Quetzal", "Raptor", "Rex", "Stegosaurus", "Triceratops",
    ],
  },
  {
    prefix: "Aberrant ", names: [
      "Achatina", "Angler", "Ankylosaurus", "Araneo", "Arthropluera", "Baryonyx",
      "Beelzebufo", "Carbonemys", "Carnotaurus", "Coelacanth", "Concavenator",
      "Dimetrodon", "Dimorphodon", "Diplocaulus", "Diplodocus", "Dire Bear",
      "Dodo", "Doedicurus", "Dung Beetle", "Electrophorus", "Equus", "Fasolasuchus",
      "Gigantopithecus", "Gigantoraptor", "Iguanodon", "Lystrosaurus", "Manta",
      "Megalania", "Megalosaurus", "Moschops", "Otter", "Oviraptor", "Ovis",
      "Paraceratherium", "Parasaur", "Piranha", "Pulmonoscorpius", "Purlovia",
      "Raptor", "Sabertooth Salmon", "Sarco", "Spinosaurus", "Stegosaurus",
      "Titanoboa", "Triceratops", "Trilobite",
    ],
  },
  {
    prefix: "X-", names: [
      "Acrocanthosaurus", "Allosaurus", "Ankylosaurus", "Archelon", "Argentavis",
      "Basilosaurus", "Concavenator", "Cryolophosaurus", "Deinosuchus",
      "Dunkleosteus", "Helicoprion", "Ichthyosaurus", "Megalodon", "Mosasaurus",
      "Otter", "Paraceratherium", "Parasaur", "Raptor", "Rex", "Rock Elemental",
      "Sabertooth", "Sabertooth Salmon", "Spinosaurus", "Tapejara", "Triceratops",
      "Woolly Rhino", "Xiphactinus", "Yutyrannus",
    ],
  },
  {
    prefix: "R-", names: [
      "Allosaurus", "Brontosaurus", "Carbonemys", "Carnotaurus", "Daeodon",
      "Dilophosaur", "Direwolf", "Equus", "Gasbags", "Giganotosaurus",
      "Megatherium", "Parasaur", "Procoptodon", "Quetzal", "Snow Owl",
      "Thylacoleo", "Velonasaur",
    ],
  },
];

// Wiki aliases differ from the canonical names used by the base catalogue.
const wikiName: Record<string, string> = {
  Angler: "Anglerfish", Spinosaurus: "Spino", "Sabertooth Salmon": "Salmon",
};
function variant(name: string, baseName: string, page = name) {
  const species = base.get(baseName);
  if (!species) throw new Error(`Missing base species for catalogue variant: ${name}`);
  return { name, maps: [...species.maps], sourceUrl: `https://ark.wiki.gg/wiki/${page.replaceAll(" ", "_")}` };
}

const variants = groups.flatMap(group => group.names.map(name => variant(
  group.prefix + name, name,
  group.prefix + (group.prefix === "Aberrant " ? wikiName[name] ?? name : name === "Spinosaurus" ? "Spino" : name),
)));
const otherVariants = [
  ...["Fire", "Lightning", "Poison", "Ice"].map(type => variant(`${type} Wyvern`, "Wyvern")),
  ...["Blood", "Ember", "Tropical"].map(type => variant(`${type} Crystal Wyvern`, "Wyvern")),
  variant("Astral Deinosuchus", "Deinosuchus"),
  variant("R-Reaper King", "Reaper"),
];

export const defaultDinoSpecies = [...seed.species, ...variants, ...otherVariants];
export const catalogueVerifiedAt = seed.retrievedAt;