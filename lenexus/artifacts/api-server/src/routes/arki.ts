import { Router } from "express";
import { requireIdentity, hasSiteAdminRights } from "../lib/discord-auth";
import { HttpError, targetGuild } from "../lib/tribe-store";
import { readArki } from "../lib/arki-bridge";

const router = Router();
router.use("/arki", (req, res, next) => {
  res.set("Cache-Control", "private, no-store");
  if (req.method !== "GET") {
    res.set("Allow", "GET");
    throw new HttpError(405, "Liaison en consultation uniquement.");
  }
  requireIdentity(req);
  next();
});
function actor(req: Parameters<typeof requireIdentity>[0]) {
  const user = requireIdentity(req);
  const guild = targetGuild();
  if (!guild) throw new HttpError(503, "Serveur Discord Lenexus non configuré.");
  return { user, guild };
}
router.get("/arki/account", async (req, res) => {
  const { user, guild } = actor(req);
  res.json(await readArki("account", user.id, guild));
});
router.get("/arki/catalog", async (req, res) => {
  const { user, guild } = actor(req);
  res.json(await readArki("catalog", user.id, guild));
});
router.get("/arki/staff", async (req, res) => {
  const { user, guild } = actor(req);
  if (!await hasSiteAdminRights(user.id, guild)) throw new HttpError(403, "Accès réservé au staff autorisé sur Lenexus.");
  const page = req.query.page === undefined ? 1 : Number(req.query.page);
  if (!Number.isSafeInteger(page) || page < 1 || page > 10000) throw new HttpError(400, "Page invalide.");
  res.json(await readArki("staff", user.id, guild, page));
});
export default router;
