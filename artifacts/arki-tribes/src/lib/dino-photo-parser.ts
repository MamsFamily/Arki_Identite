import type { DinoPhotoResult, DinoSpecies, DinoStats } from "@workspace/api-client-react";
import { norm, STAT_KEYS, STAT_LABELS, type StatKey } from "./dino";

export type LocalPhotoResult = DinoPhotoResult & { text: string; observations: string[] };
const labels: Record<StatKey, RegExp> = {
  health: /\b(health|vie|sante|pv)\b/,
  stamina: /\b(stamina|endurance)\b/,
  oxygen: /\b(oxygen|oxygene)\b/,
  food: /\b(food|nourriture)\b/,
  weight: /\b(weight|poids)\b/,
  melee: /\b(melee|degats|damage)\b/,
  speed: /\b(speed|vitesse)\b/,
};
const point = (value: string) => /^\d{1,5}$/.test(value) && Number(value) <= 65535 ? Number(value) : null;

/** Never turn raw health/percentages or ambiguous SpyGlass pairs into base points. */
export function parseDinoPhoto(text: string, catalogue: Pick<DinoSpecies, "name">[], confidence = 100): LocalPhotoResult {
  const stats = Object.fromEntries(STAT_KEYS.map(k => [k, null])) as unknown as DinoStats;
  const observations: string[] = [];
  const warnings: string[] = ["Lecture automatique à vérifier avant tout enregistrement."];
  const lines = text.split(/\r?\n/).map(norm).filter(Boolean);
  const baseRows = new Set<string>();
  let baseSection = false;
  for (const line of lines) {
    if (/^(?:points de base|base points|base stats|wild points)\s*:?\s*$/.test(line)) {
      baseSection = true;
    } else if (baseSection && STAT_KEYS.some(k => labels[k].test(line)) && /[:=]\s*\d{1,5}\s*$/.test(line)) {
      baseRows.add(line);
    } else {
      baseSection = false;
    }
  }
  for (const key of STAT_KEYS) {
    const matches = lines.filter(line => labels[key].test(line));
    const candidates: number[] = [];
    for (const line of matches) {
      if (STAT_KEYS.filter(k => labels[k].test(line)).length !== 1) continue;
      const pair = line.match(/\(\s*(\d{1,5})\s*[|/,;–-]\s*(\d{1,5})\s*\)/);
      if (pair) {
        observations.push(`${STAT_LABELS[key]} : parenthèses (${pair[1]} | ${pair[2]}). Valeur gauche et mutations à droite : conservées séparément, non assimilées aux points de base.`);
        continue;
      }
      // Only accept explicitly marked base points, or a clean row under an
      // explicit points header. A standalone "Health: 42" is NOT sufficient.
      const marked = line.match(/(?:points de base|base points|wild points)\s*[:=]?\s*(\d{1,5})(?![\d.,%])/);
      const plain = baseRows.has(line) ? line.match(/[:=]\s*(\d{1,5})\s*$/) : null;
      const value = marked?.[1] ?? plain?.[1];
      if (value && !/[%/]/.test(line) && !/\d[.,]\d/.test(line)) {
        const n = point(value);
        if (n !== null) candidates.push(n);
      }
    }
    const unique = [...new Set(candidates)];
    if (unique.length === 1 && confidence >= 65) stats[key] = unique[0];
    else if (unique.length > 1) warnings.push(`${STAT_LABELS[key]} : plusieurs valeurs différentes, champ laissé vide.`);
  }
  // SpyGlass's juvenile headers include a life stage and level, e.g.
  // "(Juvenile) Diplodocus 57". Do not strip arbitrary names or numbers:
  // "My Rex" and the pet nickname "Rex 57" are still ambiguous.
  const speciesLines = lines.map(line => {
    const staged = line.match(/^\(?\s*(?:juvenile|adolescent|baby|bebe|jeune)\s*\)?\s+(.+?)\s+(?:(?:lvl|level|niveau)\s*:?\s*)?\d{1,5}\s*$/);
    return staged?.[1] ?? line.replace(/^(?:species|espece)\s*:\s*/, "");
  });
  const speciesNames = catalogue.filter(s => lines.some(line =>
    line === norm(s.name)) || speciesLines.includes(norm(s.name)));
  const speciesName = speciesNames.length === 1 ? speciesNames[0].name : null;
  if (confidence < 65) warnings.push("Qualité de lecture insuffisante : aucun point prérempli. Recadrez une capture nette.");
  if (observations.length) warnings.push("Les parenthèses SpyGlass ne sont pas automatiquement des points transmissibles. Vérifiez leur sens avant de renseigner les champs.");
  if (!STAT_KEYS.some(k => stats[k] !== null)) warnings.push("Aucun point de base explicitement identifié. Consultez le texte lu et saisissez uniquement les points de reproduction confirmés.");
  if (!speciesName) warnings.push("Espèce non identifiée avec certitude : conservez ou vérifiez votre choix manuel.");
  return { speciesName, stats, warnings, observations: [...new Set(observations)], text };
}