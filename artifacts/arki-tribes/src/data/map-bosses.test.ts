import { test } from "node:test";
import assert from "node:assert/strict";
import { ASCENSION_LEVELS, bossesForMap, mapBosses, type BossDifficulty } from "./map-bosses";
const get = (map: string, name: string) => {
  const boss = bossesForMap(map).find(b => b.name === name);
  assert.ok(boss, `${map}: ${name}`);
  return boss;
};
const requirement = (map: string, name: string, difficulty: BossDifficulty | "default") => {
  const req = get(map, name).requirements[difficulty];
  assert.ok(req);
  return req;
};
const qty = (map: string, name: string, d: BossDifficulty | "default", item: string) => {
  const r = requirement(map, name, d);
  return [...r.artifacts, ...r.tributes, ...r.bossTrophies].find(i => i.name === item)?.quantity;
};

test("35 unique source fights; no new map and Ragnarok Event shares its source", () => {
  assert.equal(mapBosses.length, 35);
  assert.equal(new Set(mapBosses.map(b => b.id)).size, 35);
  assert.deepEqual(bossesForMap("ragnarok-event"), bossesForMap("ragnarok"));
  assert.equal(bossesForMap("unknown").length, 0);
  assert.equal(bossesForMap("ragnarok")[0], bossesForMap("ragnarok-event")[0]);
});
test("all difficulty requirements are complete and have no zero items", () => {
  for (const b of mapBosses) {
    for (const d of b.difficulties ?? ["default" as const]) {
      const r = b.requirements[d];
      assert.ok(r, `${b.id}/${d}`);
      for (const i of [...r.artifacts, ...r.tributes, ...r.bossTrophies]) {
        assert.ok(Number.isInteger(i.quantity) && i.quantity > 0);
      }
      if (b.ascension && !b.ascensionGroup) {
        assert.notEqual(d, "default");
        assert.equal(r.ascensionLevels, ASCENSION_LEVELS[d as BossDifficulty]);
      } else assert.equal(r.ascensionLevels, null);
    }
  }
});
test("ASA Ragnarok uses Nunatak and preserves shared ten artifacts", () => {
  assert.equal(get("ragnarok", "NUNATAK").ascension, false);
  for (const d of ["gamma", "beta", "alpha"] as const) assert.equal(requirement("ragnarok", "NUNATAK", d).artifacts.length, 10);
  assert.equal(requirement("ragnarok", "NUNATAK", "gamma").tributes.length, 0);
  assert.equal(qty("ragnarok", "NUNATAK", "beta", "Basilosaurus Blubber"), 5);
  assert.equal(qty("ragnarok", "NUNATAK", "alpha", "Basilosaurus Blubber"), 10);
  assert.ok(!bossesForMap("ragnarok").some(b => /Dragon|Manticore/i.test(b.name)));
});
test("ASA Grendel changes artifacts and exact unusual tribute counts per difficulty", () => {
  assert.deepEqual(requirement("valguero", "GRENDEL", "gamma").artifacts.map(i => i.name), ["Artifact of the Devourer", "Artifact of the Pack", "Artifact of the Skylord"]);
  assert.deepEqual(requirement("valguero", "GRENDEL", "alpha").artifacts.map(i => i.name), ["Artifact of the Brute", "Artifact of the Crag", "Artifact of the Destroyer", "Artifact of the Gatekeeper"]);
  assert.equal(qty("valguero", "GRENDEL", "beta", "Argentavis Talon"), 8);
  assert.equal(qty("valguero", "GRENDEL", "beta", "Titanoboa Venom"), 5);
  assert.equal(qty("valguero", "GRENDEL", "alpha", "Giganotosaurus Heart"), 2);
});
test("Overseer entry items and non-consumption note remain distinct", () => {
  assert.equal(requirement("the-island", "OVERSEER / TEK CAVE", "gamma").bossTrophies.length, 3);
  assert.equal(requirement("the-island", "OVERSEER / TEK CAVE", "alpha").tributes.length, 7);
  assert.match(get("the-island", "OVERSEER / TEK CAVE").notes.join(" "), /pas consommés/);
});
test("King Titan level and previous difficulty trophy dependency", () => {
  assert.equal(get("extinction", "KING TITAN").ascension, true);
  assert.equal(requirement("extinction", "KING TITAN", "alpha").playerLevel, 1);
  assert.equal(qty("extinction", "KING TITAN", "beta", "Gamma King Titan Trophy"), 1);
  assert.equal(qty("extinction", "KING TITAN", "alpha", "Beta King Titan Trophy"), 1);
  assert.equal(qty("extinction", "KING TITAN", "gamma", "Corrupt Heart"), 150);
  assert.equal(qty("extinction", "KING TITAN", "alpha", "Spinosaurus Sail"), 20);
});
test("Astraeos has exactly one joint ascension; its Manticore never ascends", () => {
  const paired = bossesForMap("astraeos").filter(b => b.ascension);
  assert.equal(paired.length, 2);
  assert.deepEqual([...new Set(paired.map(b => b.ascensionGroup))], ["astraeos"]);
  assert.equal(get("astraeos", "MANTICORE — ASTRAEOS").ascension, false);
  assert.equal(get("scorched-earth", "MANTICORE").ascension, true);
  assert.equal(qty("astraeos", "ABYSSALUS, THE VOID BENEATH", "alpha", "Astral Soul"), 100);
  assert.equal(qty("astraeos", "SHALLOCIS, THE VOID ABOVE", "beta", "Hex Coins"), 150);
});
test("Genesis missions retain exact requirements with no physical tribute", () => {
  for (const [difficulty, count] of [["gamma", 58], ["beta", 116], ["alpha", 168]] as const) {
    const r = requirement("genesis", "CORRUPTED MASTER CONTROLLER", difficulty);
    assert.ok(r.specialRequirements.some(s => s.includes(String(count))));
    assert.equal(r.tributes.length, 0);
  }
  assert.match(requirement("genesis", "MOEDER, MASTER OF THE OCEAN", "gamma").specialRequirements.join(" "), /One Tough Moeder/);
});
test("Red-Handed is one complete fight with one cost per difficulty", () => {
  const bosses = bossesForMap("lost-colony");
  assert.equal(bosses.length, 1);
  assert.match(bosses[0].notes.join(" "), /Phase Lost King, puis Lost Queen/);
  assert.equal(qty("lost-colony", bosses[0].name, "alpha", "Prime Crimson Sigil"), 200);
});
test("unverified Svartalfheim never imports Island prices or levels", () => {
  for (const b of bossesForMap("svartalfheim")) {
    assert.equal(b.tributeStatus, "unverified");
    for (const r of Object.values(b.requirements)) {
      assert.equal(r.playerLevel, null);
      assert.equal(r.artifacts.length + r.tributes.length + r.bossTrophies.length, 0);
      assert.match(r.specialRequirements.join(" "), /quantités en cours de vérification/);
    }
  }
});
test("natural encounters state no tribute explicitly without fake difficulty selectors", () => {
  for (const [map, name] of [["ragnarok", "ICEWORM QUEEN"], ["valguero", "BROODMOTHER LYSRIX SAUVAGE"], ["astraeos", "THANATOS"]]) {
    const b = get(map, name);
    assert.equal(b.difficulties, null);
    assert.match(b.requirements.default!.specialRequirements.join(" "), /Aucun tribut nécessaire/);
  }
});