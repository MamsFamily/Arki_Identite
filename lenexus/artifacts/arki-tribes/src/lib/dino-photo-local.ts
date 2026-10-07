import type { DinoSpecies } from "@workspace/api-client-react";
import { parseDinoPhoto } from "./dino-photo-parser";
import { dinoPhotoViews } from "./dino-photo-image";
import { spyglassCells,readSpyglassCells } from "./dino-photo-spyglass";
import { STAT_KEYS,STAT_LABELS } from "./dino";

/** CPU-only OCR; all engine assets and dictionaries come from our own site. */
export async function readLocalDinoPhoto(image: string, catalogue: Pick<DinoSpecies, "name">[],
  progress: (value: string) => void, signal: AbortSignal) {
  const { createWorker, OEM, PSM } = await import("tesseract.js");
  if (signal.aborted) throw new Error("Lecture annulée.");
  const base = new URL(import.meta.env.BASE_URL, window.location.origin).href;
  let worker: Awaited<ReturnType<typeof createWorker>> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let abort: () => void = () => {};
  const stopped = new Promise<never>((_, reject) => {
    abort = () => reject(new Error("Lecture annulée."));
    signal.addEventListener("abort", abort, { once: true });
    timer = setTimeout(() => reject(new Error("Lecture trop longue. Essayez une capture plus petite, centrée sur les statistiques.")), 90000);
  });
  let finished = false;
  try {
    progress("Agrandissement du texte de la capture…");
    const views = await Promise.race([dinoPhotoViews(image),stopped]);
    progress("Chargement du lecteur gratuit…");
    const pending = createWorker("eng+fra", OEM.LSTM_ONLY, {
      workerPath: `${base}ocr/worker.min.js`, corePath: `${base}ocr/core`,
      langPath: `${base}ocr/lang`, workerBlobURL: false,
      // Progress contains no private photo data.
      logger: m => progress(m.status === "recognizing text" ?
        `Lecture locale : ${Math.round(m.progress * 100)} %` : "Préparation du lecteur gratuit…"),
      errorHandler: () => {}, // createWorker/recognize reject; the UI displays the error.
    });
    void pending.then(w => { if (finished) void w.terminate(); }, () => {});
    worker = await Promise.race([pending, stopped]);
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
    const result = await Promise.race([worker.recognize(views.colour,{}, {blocks:true}), stopped]);
    if (signal.aborted) throw new Error("Lecture annulée.");
    const first = parseDinoPhoto(result.data.text,catalogue,result.data.confidence);
    if (first.speciesName && Object.values(first.stats).some(v => v!==null)) return first;
    const lines = result.data.blocks?.flatMap(b=>b.paragraphs.flatMap(p=>p.lines)) ?? [];
    const cells = spyglassCells(lines,views.width,views.height);
    if (cells) {
      progress("Lecture ciblée des groupes de points SpyGlass…");
      const reader = worker;
      await reader.setParameters({tessedit_pageseg_mode:PSM.SINGLE_LINE});
      const targeted = await readSpyglassCells(cells,result.data.text,async(cell,contrast)=>{
        const r = await Promise.race([reader.recognize(contrast ? views.contrast : views.colour,{rectangle:cell.rectangle}),stopped]);
        if (signal.aborted) throw new Error("Lecture annulée.");
        return {text:r.data.text,confidence:r.data.confidence};
      });
      const photo = {...first,stats:{...first.stats},observations:[...first.observations,...targeted.observations],
        warnings:[...first.warnings,...targeted.warnings],text:`${first.text}\n\nLecture ciblée SpyGlass :\n${targeted.text}`};
      if (targeted.stats) {
        for (const key of STAT_KEYS) {
          const old = photo.stats[key], value=targeted.stats[key];
          photo.stats[key] = old!==null && old!==value ? null : value;
          if (old!==null && old!==value) photo.warnings.push(`${STAT_LABELS[key]} : lectures contradictoires, champ laissé vide.`);
        }
        if (Object.values(photo.stats).some(v=>v!==null)) photo.warnings = photo.warnings.filter(w=>!w.startsWith("Aucun point") && !w.startsWith("Qualité de lecture insuffisante"));
      }
      return photo;
    }
    progress("Vérification du texte en contraste renforcé…");
    const contrast = await Promise.race([worker.recognize(views.contrast),stopped]);
    if (signal.aborted) throw new Error("Lecture annulée.");
    const second = parseDinoPhoto(contrast.data.text,catalogue,contrast.data.confidence);
    // Each pass applies its own confidence guard. Conflicts stay empty, never
    // silently prefer the more optimistic reading.
    const merged = {...first,stats:{...first.stats},warnings:[...new Set([...first.warnings,...second.warnings])],
      observations:[...new Set([...first.observations,...second.observations])],
      text:`Lecture couleur :\n${first.text}\n\nLecture contrastée :\n${second.text}`};
    if (!first.speciesName) merged.speciesName = second.speciesName;
    else if (second.speciesName && second.speciesName!==first.speciesName) {
      merged.speciesName = null;
      merged.warnings.push("Les deux lectures indiquent des espèces différentes : choix manuel nécessaire.");
    }
    for (const key of Object.keys(first.stats) as (keyof typeof first.stats)[]) {
      const a = first.stats[key],b = second.stats[key];
      merged.stats[key] = a===null ? b : b===null || a===b ? a : null;
      if (a!==null && b!==null && a!==b) merged.warnings.push(`${key} : lectures contradictoires, champ laissé vide.`);
    }
    if (merged.speciesName) merged.warnings = merged.warnings.filter(w => !w.startsWith("Espèce non identifiée"));
    if (Object.values(merged.stats).some(v=>v!==null)) merged.warnings = merged.warnings.filter(w => !w.startsWith("Aucun point") && !w.startsWith("Qualité de lecture insuffisante"));
    return merged;
  } finally {
    finished = true;
    clearTimeout(timer);
    signal.removeEventListener("abort", abort);
    if (worker) await worker.terminate();
  }
}