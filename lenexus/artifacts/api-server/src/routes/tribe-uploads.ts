import { Router } from "express";
import * as Z from "@workspace/api-zod";
import { checkWrite } from "../lib/discord-auth";
import { publishUpload, requestImageUpload } from "../lib/tribe-uploads";

const router = Router();
router.post("/tribe-images/uploads", async (req, res) => {
  const actor = checkWrite(req);
  const input = Z.RequestTribeImageUploadBody.parse(req.body);
  res.set("Cache-Control", "no-store").json(Z.RequestTribeImageUploadResponse.parse(await requestImageUpload(actor.id, input)));
});
router.post("/tribe-images/publish", async (req, res) => {
  const actor = checkWrite(req);
  const input = Z.PublishTribeImageBody.parse(req.body);
  res.set("Cache-Control", "no-store").json(Z.PublishTribeImageResponse.parse(await publishUpload(actor.id, input.objectPath)));
});
export default router;