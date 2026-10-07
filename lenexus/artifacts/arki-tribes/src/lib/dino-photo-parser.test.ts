import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDinoPhoto } from "./dino-photo-parser";
const catalogue = [{ name: "Rex" }, { name: "Tek Rex" }];
const parse = (text: string, confidence = 100) => parseDinoPhoto(text, catalogue, confidence);

test("explicit base points fill all seven stats, including zero", () => {
  const result = parse("Espèce : Tek Rex\nPoints de base\nVie : 42\nEndurance : 0\nOxygène : 12\nNourriture : 31\nPoids : 29\nDégâts mêlée : 40\nVitesse : 0");
  assert.equal(result.speciesName, "Tek Rex");
  assert.deepEqual(result.stats, { health: 42, stamina: 0, oxygen: 12, food: 31, weight: 29, melee: 40, speed: 0 });
});
test("English marked points and missing values", () => {
  const result = parse("Health base points: 55\nStamina base points: 30");
  assert.equal(result.stats.health, 55);
  assert.equal(result.stats.stamina, 30);
  assert.equal(result.stats.oxygen, null);
});
test("raw stats and percentages never become points", () => {
  const result = parse("Health: 42000\nStamina: 2000.0\nMelee: 350%\nWeight: 150 / 500\nFood: 2,300");
  assert.ok(Object.values(result.stats).every(v => v === null));
});
test("SpyGlass left/right values stay separate, even under base header", () => {
  const result = parse("Base points\nHealth: 42000 (42 | 10)\nMelee: 300% (50/12)");
  assert.equal(result.stats.health, null);
  assert.equal(result.stats.melee, null);
  assert.equal(result.observations.length, 2);
  assert.match(result.observations[0], /\(42 \| 10\)/);
});
test("conflicting OCR values remain unknown", () => {
  assert.equal(parse("Health base points: 42\nHealth base points: 43").stats.health, null);
});
test("duplicate identical readings do not conflict", () => {
  assert.equal(parse("Health base points: 42\nHealth base points: 42").stats.health, 42);
});
test("low confidence leaves every base point blank", () => {
  assert.equal(parse("Health base points: 42", 50).stats.health, null);
});
test("nickname and multiple species never force a species", () => {
  assert.equal(parse("My Rex\nNickname: Rex").speciesName, null);
  assert.equal(parse("Rex\nTek Rex").speciesName, null);
});
test("bad numbers are not corrected or clamped", () => {
  for (const value of ["65536", "100000", "-3", "4.2", "4,2", "42%"]) {
    assert.equal(parse(`Health base points: ${value}`).stats.health, null, value);
  }
});
test("a base section ends before raw stat rows", () => {
  const result = parse("Base points\nStamina: 12\nRaw stats\nHealth: 1000");
  assert.equal(result.stats.stamina, 12);
  assert.equal(result.stats.health, null);
});
test("mixed stat rows remain ambiguous", () => {
  assert.equal(parse("Health Weight base points: 42").stats.health, null);
});
test("empty OCR gives explicit guidance, never zeros", () => {
  const result = parse("");
  assert.ok(Object.values(result.stats).every(v => v === null));
  assert.ok(result.warnings.some(w => w.includes("Aucun point")));
});
test("the reported Diplodocus juvenile header is recognized without inventing points", () => {
  const text = "(Juvenile) Diplodocus 57\nFal\nTeach\nTamed (57)\nMW 36K (560-0) @ 800 (0-0-0)";
  const result = parseDinoPhoto(text,[{name:"Diplodocus"},{name:"Rex"}]);
  assert.equal(result.speciesName,"Diplodocus");
  assert.ok(Object.values(result.stats).every(v=>v===null));
});
test("French and English life stages preserve exact variant identification", () => {
  for (const header of ["(Adolescent) Tek Rex 57","Baby Tek Rex Level 42","(Bébé) Tek Rex niveau 12"]) {
    assert.equal(parse(header).speciesName,"Tek Rex",header);
  }
  assert.equal(parse("Nickname: Baby Rex 57").speciesName,null);
  assert.equal(parse("Rex 57").speciesName,null);
  assert.equal(parse("(Juvenile) My Rex 57").speciesName,null);
});
test("SpyGlass hyphenated pairs are retained as observations, not base points", () => {
  const result = parse("Health: 487.6/487.6 (1-22)\nFood: 501/517.5 (0-0)");
  assert.equal(result.observations.length,2);
  assert.equal(result.stats.health,null);
  assert.equal(result.stats.food,null);
});