import { Router } from "express";
import * as Z from "@workspace/api-zod";
import { checkWrite } from "../lib/discord-auth";
import { requireSiteOwner } from "../lib/site-access";
import { deleteMod, listMods, saveMod } from "../lib/site-mods";

const router = Router();
router.get("/site-mods", (_req, res) => {
  res.json(Z.ListSiteModsResponse.parse(listMods()));
});
router.post("/site-mods", (req, res) => {
  const actor = checkWrite(req); requireSiteOwner(actor.id);
  res.status(201).json(Z.CreateSiteModResponse.parse(saveMod(Z.CreateSiteModBody.parse(req.body))));
});
router.put("/site-mods/:id", (req, res) => {
  const actor = checkWrite(req); requireSiteOwner(actor.id);
  const { id } = Z.UpdateSiteModParams.parse(req.params);
  res.json(Z.UpdateSiteModResponse.parse(saveMod(Z.UpdateSiteModBody.parse(req.body), id)));
});
router.delete("/site-mods/:id", (req, res) => {
  const actor = checkWrite(req); requireSiteOwner(actor.id);
  const { id } = Z.DeleteSiteModParams.parse(req.params);
  deleteMod(id);
  res.json({ status: "ok" });
});
export default router;