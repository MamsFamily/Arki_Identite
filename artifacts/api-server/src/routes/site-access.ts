import { Router } from "express";
import * as Z from "@workspace/api-zod";
import { checkWrite, discord, guildRights, requireIdentity } from "../lib/discord-auth";
import { changeSiteAccess, isSiteOwner, primaryOwnerId, requireSiteOwner, siteGrants } from "../lib/site-access";
import { HttpError, targetGuild } from "../lib/tribe-store";
import { discordAccount } from "../lib/discord-accounts";

const router=Router();
async function list(actor:string) {
  if (!isSiteOwner(actor)) return [];
  const primary=primaryOwnerId();
  const grants=siteGrants().filter(g=>g.userId!==primary);
  const result=await Promise.all(grants.map(async g=>({
    userId:g.userId,role:g.role,primary:false,grantedAt:g.grantedAt,
    eligible:g.role==="owner" || !!(g.guildId && g.guildId===targetGuild() && (await guildRights(g.userId,g.guildId)).admin),
  })));
  if (primary) result.unshift({userId:primary,role:"owner",primary:true,eligible:true,grantedAt:""});
  const accounts = [];
  // Bound Discord lookup bursts; cached identities also serve mutation results.
  for (let i = 0; i < result.length; i += 5) {
    accounts.push(...await Promise.all(result.slice(i, i + 5).map(async grant => ({
      ...grant, ...await discordAccount(grant.userId),
    }))));
  }
  return Z.ListSiteAccessResponse.parse(accounts);
}
router.get("/",async(req,res)=>{
  const actor=requireIdentity(req);requireSiteOwner(actor.id);
  res.json(await list(actor.id));
});
router.put("/",async(req,res)=>{
  const actor=checkWrite(req);requireSiteOwner(actor.id);
  const input=Z.GrantSiteAccessBody.parse(req.body);
  if (input.userId===primaryOwnerId()) throw new HttpError(403,"Le propriétaire principal ne peut pas être modifié.");
  const guild=targetGuild();
  if (input.role==="admin") {
    if (!guild || !(await guildRights(input.userId,guild)).admin) throw new HttpError(403,"Ce compte doit être administrateur ou modérateur sur votre serveur Discord.");
  } else {
    if (!process.env.DISCORD_TOKEN) throw new HttpError(503,"Discord n'est pas configuré pour vérifier ce compte.");
    const account=await discord(`/users/${input.userId}`,process.env.DISCORD_TOKEN,true) as {id?:string,bot?:boolean};
    if (account.id!==input.userId || account.bot) throw new HttpError(400,"Sélectionnez un compte Discord humain valide.");
  }
  changeSiteAccess(actor.id,input.userId,input.role,guild);
  res.json(await list(actor.id));
});
router.delete("/:userId",async(req,res)=>{
  const actor=checkWrite(req);requireSiteOwner(actor.id);
  const params=Z.RevokeSiteAccessParams.parse(req.params);
  changeSiteAccess(actor.id,params.userId,null,null);
  res.json(await list(actor.id));
});
export default router;