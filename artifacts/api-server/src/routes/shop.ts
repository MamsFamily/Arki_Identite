import { Router } from "express";
import { GetShopResponse, GetDonationsResponse } from "@workspace/api-zod";
import { requireIdentity } from "../lib/discord-auth";
import { getShopCatalog, getShopMedia, getDonationsCatalog, getShopEmoji } from "../lib/shop-discord";
import { HttpError } from "../lib/tribe-store";

const router = Router();
router.use(["/shop", "/donations"], (req, res, next) => {
  res.set("Cache-Control", "private, no-store");
  requireIdentity(req);
  next();
});
router.get("/shop", async (_req, res) => {
  res.json(GetShopResponse.parse(await getShopCatalog()));
});
router.get("/donations", async (_req, res) => {
  res.json(GetDonationsResponse.parse(await getDonationsCatalog()));
});
router.get("/shop/emoji/:id/:format", async (req, res) => {
  const url = await getShopEmoji(String(req.params.id), String(req.params.format));
  const response = await fetch(url, { signal: AbortSignal.timeout(10000), redirect: "error" });
  if (!response.ok) throw new HttpError(404, "Cet emoji Discord n’est plus disponible.");
  const data = Buffer.from(await response.arrayBuffer());
  if (data.length > 1024 * 1024) throw new HttpError(413, "Emoji trop volumineux.");
  res.set("Content-Type", req.params.format === "gif" ? "image/gif" : "image/png");
  res.send(data);
});
router.get("/shop/media/:section/:message/:media", async (req, res) => {
  const media = await getShopMedia(String(req.params.section), String(req.params.message), String(req.params.media));
  const response = await fetch(media.url, { signal: AbortSignal.timeout(30000), redirect: "error" });
  if (!response.ok) throw new HttpError(503, "Ce média Discord est indisponible.");
  const max = 25 * 1024 * 1024;
  if (Number(response.headers.get("content-length")) > max) { await response.body?.cancel(); throw new HttpError(413, "Consultez ce fichier volumineux directement sur Discord."); }
  const reader = response.body?.getReader();
  if (!reader) throw new HttpError(503, "Ce média Discord est indisponible.");
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > max) { await reader.cancel(); throw new HttpError(413, "Consultez ce fichier volumineux directement sur Discord."); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const contentType = response.headers.get("content-type")?.split(";")[0] ?? "";
  const inline = /^(image\/(png|jpeg|webp|gif)|video\/(mp4|webm))$/.test(contentType);
  res.set("Content-Type", inline ? contentType : "application/octet-stream");
  res.set("Content-Disposition", inline ? "inline" : "attachment");
  res.send(Buffer.concat(chunks));
});
export default router;
