import type { DinoStats } from "@workspace/api-client-react";
import { STAT_KEYS, STAT_LABELS, type StatKey } from "./dino";

type Box = { x0:number; y0:number; x1:number; y1:number };
export type SpyglassLine = { text:string; confidence:number; bbox:Box; words?: {text:string;bbox:Box}[] };
export type SpyglassCell = { key:StatKey; rectangle:{left:number;top:number;width:number;height:number} };
type Reading = {text:string;confidence:number};
type Triple = [number,number,number];

/** Only complete three-number groups: never fix a missing dash or guess digits. */
export function spyglassTriple(text:string): Triple|null {
  const matches = [...text.matchAll(/\(\s*(\d{1,5})\s*[-–]\s*(\d{1,5})\s*[-–]\s*(\d{1,5})\s*\)/g)];
  if (matches.length!==1) return null;
  const numbers = matches[0].slice(1).map(Number);
  return numbers.every(n=>n<=65535) ? numbers as Triple : null;
}

/** Recognize the supported two-column HUD using named Health/Torpor anchors,
 * three regularly spaced stat rows, and six parenthesized groups. Colours,
 * maturation and numeric amounts cannot establish this layout.
 */
export function spyglassCells(lines:SpyglassLine[],width:number,height:number):SpyglassCell[]|null {
  const health = lines.filter(l=>/\b(?:health|vie|santé)\b/i.test(l.text) && spyglassTriple(l.text) && l.confidence>=65);
  if (health.length!==1 || !lines.some(l=>/\btorpor\b/i.test(l.text) && l.bbox.y0>health[0].bbox.y1 && spyglassTriple(l.text))) return null;
  const rows = lines.filter(l=>l.bbox.y1<health[0].bbox.y0 &&
    health[0].bbox.y0-l.bbox.y0<height*.4 && l.bbox.x0<width*.55 &&
    l.bbox.x1>width*.78 && /\(\s*\d/.test(l.text) &&
    /\(\s*\d+\s*[-–]\s*\d+\s*[-–]\s*\d+\s*\)/.test(l.text))
    .sort((a,b)=>a.bbox.y0-b.bbox.y0);
  if (rows.length!==3) return null;
  const centres = rows.map(l=>(l.bbox.y0+l.bbox.y1)/2);
  const a = centres[1]-centres[0], b = centres[2]-centres[1];
  if (a<=0 || b/a<.65 || b/a>1.55) return null;
  const cells:SpyglassCell[]=[];
  const keys:StatKey[][] = [["stamina","weight"],["oxygen","melee"],["food","speed"]];
  const rectangle = (box:Box) => {
    const left=Math.max(0,Math.floor(box.x0)),top=Math.max(0,Math.floor(box.y0));
    return {left,top,width:Math.min(width-left,Math.ceil(box.x1)-left),height:Math.min(height-top,Math.ceil(box.y1)-top)};
  };
  for (const [index,row] of rows.entries()) {
    const words = row.words?.filter(w=>/\(\s*\d/.test(w.text)) ?? [];
    const fontHeight = words.length ? Math.min(...words.map(w=>w.bbox.y1-w.bbox.y0)) : health[0].bbox.y1-health[0].bbox.y0;
    if (fontHeight<=0 || fontHeight>a*.85) return null;
    for (const [column,key] of keys[index].entries()) {
      const word = words.find(w=>column===0 ? w.bbox.x0<width*.55 : w.bbox.x0>width*.65);
      const middle = word ? (word.bbox.y0+word.bbox.y1)/2 : centres[index];
      cells.push({key,rectangle:rectangle({
        x0:width*(column===0 ? .28 : .76), x1:width*(column===0 ? .515 : .99),
        y0:middle-fontHeight*.75,y1:middle+fontHeight*.75,
      })});
    }
  }
  const h=health[0].bbox;
  cells.push({key:"health",rectangle:rectangle({x0:h.x0-6,y0:h.y0-6,x1:h.x1+6,y1:h.y1+6})});
  return cells;
}

/** Conservative support for the unmodified ASA three-number format.
 * Populate only when every cell is legible, the last two counters are zero,
 * and all base points sum to the explicitly printed Tamed level minus one.
 * Nonzero added/mutation counters and old two-number formats stay manual.
 */
export async function readSpyglassCells(cells:SpyglassCell[],text:string,
  recognize:(cell:SpyglassCell,contrast:boolean)=>Promise<Reading>) {
  const triples = new Map<StatKey,Triple>();
  const observations:string[]=[];
  const transcript:string[]=[];
  for (const cell of cells) {
    let reading = await recognize(cell,false);
    let triple = reading.confidence>=70 ? spyglassTriple(reading.text) : null;
    if (!triple) {
      const extra = await recognize(cell,true);
      transcript.push(`${STAT_LABELS[cell.key]} — contraste : ${extra.text.trim()}`);
      triple = extra.confidence>=70 ? spyglassTriple(extra.text) : null;
    }
    transcript.push(`${STAT_LABELS[cell.key]} : ${reading.text.trim()}`);
    if (triple) {
      triples.set(cell.key,triple);
      observations.push(`${STAT_LABELS[cell.key]} : groupe SpyGlass (${triple.join("-")}).`);
    }
  }
  const levels = [...text.matchAll(/\bTamed\s*\(\s*(\d{1,6})\s*\)/gi)].map(m=>Number(m[1]));
  const level = levels.length===1 ? levels[0] : null;
  const total = [...triples.values()].reduce((sum,t)=>sum+t[0],0);
  const compatible = cells.length===7 && triples.size===7 && level!==null && total+1===level &&
    [...triples.values()].every(t=>t[1]===0 && t[2]===0);
  const stats = compatible ? Object.fromEntries(STAT_KEYS.map(k=>[k,triples.get(k)![0]])) as unknown as DinoStats : null;
  const warnings = compatible ? ["Groupes SpyGlass lus et total cohérent avec le niveau apprivoisé. Vérifiez chaque point avant d'enregistrer."] :
    ["Groupes SpyGlass repérés, mais lecture incomplète, niveaux ajoutés, mutations ou total non vérifiable : aucun point déduit automatiquement."];
  return {stats,observations,warnings,text:transcript.join("\n")};
}