import { Router, type Request } from "express";
import * as Z from "@workspace/api-zod";
import { checkWrite, identity, hasSiteAdminRights } from "../lib/discord-auth";
import { isSiteOwner } from "../lib/site-access";
import { requireCurrentServerMember } from "../lib/discord-players";
import { targetGuild, HttpError } from "../lib/tribe-store";
import { listGuides, getGuide, createGuide, updateGuide, deleteGuide, type GuideActor } from "../lib/guide-store";
import { requestGuideUpload, publishGuideUpload } from "../lib/guide-uploads";

const router = Router();
router.use((_req,res,next) => {res.set("Cache-Control","no-store");next();});
async function actor(req: Request, write=false): Promise<GuideActor | null> {
  const user = write ? checkWrite(req) : identity(req);
  if (!user) return null;
  const guild = targetGuild();
  if (write) {
    if (!guild) throw new HttpError(503,"Le serveur Discord n'est pas configuré.");
    if (!isSiteOwner(user.id)) await requireCurrentServerMember(guild,user.id);
  }
  return {id:user.id,name:user.name,staff:!!guild && await hasSiteAdminRights(user.id,guild)};
}
router.get("/guides",async(req,res) => res.json(Z.ListGuidesResponse.parse(await listGuides(await actor(req)))));
router.get("/guides/:guideId",async(req,res) => res.json(Z.GetGuideResponse.parse(await getGuide(String(req.params.guideId),await actor(req)))));
router.post("/guides",async(req,res) => {
  const user = (await actor(req,true))!;
  res.status(201).json(Z.CreateGuideResponse.parse(await createGuide(user,Z.CreateGuideBody.parse(req.body))));
});
router.put("/guides/:guideId",async(req,res) => {
  const user = (await actor(req,true))!;
  res.json(Z.UpdateGuideResponse.parse(await updateGuide(String(req.params.guideId),user,Z.UpdateGuideBody.parse(req.body))));
});
router.delete("/guides/:guideId",async(req,res) => {
  const user = (await actor(req,true))!, input = Z.DeleteGuideBody.parse(req.body);
  res.json(Z.DeleteGuideResponse.parse(await deleteGuide(String(req.params.guideId),user,input.revision)));
});
router.post("/guide-uploads/request-url",async(req,res) => {
  const user = (await actor(req,true))!;
  res.json(Z.RequestGuideImageResponse.parse(await requestGuideUpload(user.id,Z.RequestGuideImageBody.parse(req.body))));
});
router.post("/guide-uploads/publish",async(req,res) => {
  const user = (await actor(req,true))!, input = Z.PublishGuideImageBody.parse(req.body);
  res.json(Z.PublishGuideImageResponse.parse(await publishGuideUpload(user.id,input.objectPath)));
});
export default router;