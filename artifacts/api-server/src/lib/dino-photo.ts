import * as Z from "@workspace/api-zod";
import { HttpError } from "./tribe-store";

export async function readPhoto(_actor:string,image:string):Promise<Z.DinoPhotoResult> {
  const match=image.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/);
  if(!match) throw new HttpError(400,"Envoyez une image JPG, PNG ou WEBP valide.");
  const bytes=Buffer.from(match[2],"base64");
  if(!bytes.length || bytes.length>6*1024*1024) throw new HttpError(400,"La photo doit peser au maximum 6 Mo.");
  const valid=match[1]==="jpeg"?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:
    match[1]==="png"?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):
    bytes.toString("ascii",0,4)==="RIFF"&&bytes.toString("ascii",8,12)==="WEBP";
  if(!valid) throw new HttpError(400,"Le contenu de l'image ne correspond pas au format annoncé.");
  // The owner explicitly prohibited billed AI. No proxy/provider call or fallback.
  throw new HttpError(503,"La lecture payante est désactivée. Le remplacement par une lecture locale gratuite est en attente ; saisissez les points manuellement.");
}