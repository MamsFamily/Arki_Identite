import { Router } from "express";
import * as Z from "@workspace/api-zod";
import { checkWrite } from "../lib/discord-auth";
import { requireSiteOwner } from "../lib/site-access";
import { getSiteMap, listSiteMaps, updateSiteMap } from "../lib/site-maps";
import { mapResidents, getCartography, saveCartography } from "../lib/map-settlements";

const router = Router();
router.get("/site-maps/:slug/settlements",async(req,res)=>{
  const {slug}=Z.GetMapSettlementsParams.parse(req.params);
  const tribes=mapResidents(slug);
  res.set("Cache-Control","no-store").json(Z.GetMapSettlementsResponse.parse({count:tribes.length,tribes,cartography:await getCartography(slug)}));
});
router.put("/site-maps/:slug/cartography",async(req,res)=>{
  const actor=checkWrite(req);requireSiteOwner(actor.id);
  const {slug}=Z.SaveMapCartographyParams.parse(req.params);
  res.set("Cache-Control","no-store").json(Z.SaveMapCartographyResponse.parse(await saveCartography(actor.id,slug,Z.SaveMapCartographyBody.parse(req.body))));
});
router.get("/site-maps", (_req, res) => {
  res.set("Cache-Control", "no-store").json(Z.ListSiteMapsResponse.parse(listSiteMaps()));
});
router.get("/site-maps/:slug", (req, res) => {
  const { slug } = Z.GetSiteMapParams.parse(req.params);
  res.set("Cache-Control", "no-store").json(Z.GetSiteMapResponse.parse(getSiteMap(slug)));
});
router.put("/site-maps/:slug", async (req, res): Promise<void> => {
  const actor = checkWrite(req);
  requireSiteOwner(actor.id);
  const { slug } = Z.UpdateSiteMapParams.parse(req.params);
  const input = Z.UpdateSiteMapBody.parse(req.body);
  res.set("Cache-Control", "no-store").json(Z.UpdateSiteMapResponse.parse(await updateSiteMap(actor.id, slug, input)));
});
export default router;