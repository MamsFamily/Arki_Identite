import { Router } from "express";
import { Readable } from "node:stream";
import * as Z from "@workspace/api-zod";
import { checkWrite, identity } from "../lib/discord-auth";
import { canReadGuideMedia } from "../lib/guide-store";
import { requireSiteOwner } from "../lib/site-access";
import { branding, brandingStorage, logoLimit, registerUpload, updateBranding, uploadQuota } from "../lib/site-branding";
import { HttpError } from "../lib/tribe-store";
import { isAttachedUpload } from "../lib/tribe-uploads";
import { isAttachedMapImage } from "../lib/site-maps";
import { attachedCartography } from "../lib/map-settlements";

const router=Router();
router.get("/site-branding",(_req,res)=>{
  res.set("Cache-Control","no-store").json(Z.GetSiteBrandingResponse.parse(branding()));
});
router.post("/site-branding/uploads",async(req,res)=>{
  const actor=checkWrite(req);requireSiteOwner(actor.id);
  const input=Z.RequestBrandingUploadBody.parse(req.body);
  if (input.kind==="logo" && input.size>logoLimit) throw new HttpError(400,"Le logo doit faire moins de 5 Mo.");
  uploadQuota(actor.id);
  let uploadURL:string;
  try {uploadURL=await brandingStorage.getObjectEntityUploadURL();}
  catch {throw new HttpError(503,"Le stockage d'images est momentanément indisponible.");}
  const objectPath=brandingStorage.normalizeObjectEntityPath(uploadURL);
  if (!/^\/objects\/uploads\/[a-f0-9-]{36}$/.test(objectPath)) throw new HttpError(503,"Le stockage n'a pas fourni un emplacement valide.");
  registerUpload(actor.id,objectPath,input.kind,input.size,input.contentType);
  res.set("Cache-Control","no-store").json(Z.RequestBrandingUploadResponse.parse({uploadURL,objectPath}));
});
router.patch("/site-branding",async(req,res)=>{
  const actor=checkWrite(req);requireSiteOwner(actor.id);
  const input=Z.UpdateSiteBrandingBody.parse(req.body);
  if (!Object.keys(input).length) throw new HttpError(400,"Sélectionnez un logo ou une couverture à modifier.");
  res.json(Z.UpdateSiteBrandingResponse.parse(await updateBranding(actor.id,input)));
});
router.get("/storage/objects/*path",async(req,res)=>{
  const raw=req.params.path;
  const objectPath=`/objects/${Array.isArray(raw)?raw.join("/"):raw}`;
  const current=branding();
  // Never expose pending uploads or unrelated private files through this route.
  if (!isAttachedUpload(objectPath) && !isAttachedMapImage(objectPath) && (!/^\/objects\/site-branding\/[a-f0-9-]{36}$/.test(objectPath) || ![current.logoPath,current.coverPath].includes(objectPath)) && !await attachedCartography(objectPath) && !await canReadGuideMedia(objectPath,identity(req)?.id)) {
    throw new HttpError(404,"Image introuvable.");
  }
  const file=await brandingStorage.getObjectEntityFile(objectPath);
  const response=await brandingStorage.downloadObject(file);
  response.headers.forEach((v,k)=>res.set(k,v));
  res.set("X-Content-Type-Options","nosniff");
  if (response.body) Readable.fromWeb(response.body as ReadableStream<Uint8Array>).pipe(res);
  else res.end();
});
router.get("/storage/public-objects/*path",async(req,res)=>{
  const raw=req.params.path,path=Array.isArray(raw)?raw.join("/"):String(raw);
  if (path.includes("..")) throw new HttpError(400,"Chemin invalide.");
  const file=await brandingStorage.searchPublicObject(path);
  if (!file) throw new HttpError(404,"Image introuvable.");
  const response=await brandingStorage.downloadObject(file);
  response.headers.forEach((v,k)=>res.set(k,v));res.set("X-Content-Type-Options","nosniff");
  if (response.body) Readable.fromWeb(response.body as ReadableStream<Uint8Array>).pipe(res);
  else res.end();
});
export default router;