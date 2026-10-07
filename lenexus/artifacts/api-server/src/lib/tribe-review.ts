import type { TribeReview, ReviewTribe } from "@workspace/api-zod";
import { discord } from "./discord-auth";
import { rows } from "./tribe-store";
import { discordAccount } from "./discord-accounts";
import { departureChannelId, departureHistory, departureNameKey, matchDeparture } from "./discord-departures";

type Snapshot = { names: Map<string,string>; checkedAt: string };
const snapshots = new Map<string, { until: number; value: Snapshot | null }>();
const pending = new Map<string, Promise<Snapshot | null>>();
const validId = (id: string) => /^\d{17,20}$/.test(id);

/** Only absence from a successfully completed, paginated guild list is evidence of departure. */
async function loadSnapshot(guild: string): Promise<Snapshot | null> {
  const cached = snapshots.get(guild);
  if (cached && cached.until > Date.now()) return cached.value;
  const existing = pending.get(guild);
  if (existing) return existing;
  const task = (async () => {
    try {
      if (!process.env.DISCORD_TOKEN) throw new Error("Discord unavailable");
      const names = new Map<string,string>();
      let after = "";
      const started = Date.now();
      for (let page = 0; page < 50; page++) {
        if (Date.now() - started > 20000) throw new Error("Incomplete guild list");
        const params = new URLSearchParams({limit:"1000"});
        if (after) params.set("after", after);
        const members = await discord(`/guilds/${guild}/members?${params}`, process.env.DISCORD_TOKEN, true) as
          {nick?:string;user:{id:string;username:string;global_name?:string}}[];
        if (!Array.isArray(members) || members.some(m => !m.user || !validId(m.user.id))) throw new Error("Invalid guild list");
        for (const m of members) names.set(m.user.id, m.nick || m.user.global_name || m.user.username);
        if (members.length < 1000) {
          const value = {names, checkedAt:new Date().toISOString()};
          snapshots.set(guild, {until:Date.now()+300000, value});
          return value;
        }
        const next = members[members.length-1].user.id;
        if (BigInt(next) <= BigInt(after || "0")) throw new Error("Invalid pagination");
        after = next;
      }
      throw new Error("Incomplete guild list");
    } catch {
      // Never reuse a stale successful snapshot after a failed refresh.
      snapshots.set(guild, {until:Date.now()+30000, value:null});
      return null;
    }
  })();
  pending.set(guild, task);
  try { return await task; } finally { pending.delete(guild); }
}

export async function reviewTribes(guild: string): Promise<TribeReview> {
  const tribes = rows("SELECT id,nom,CAST(proprietaire_id AS TEXT) AS owner FROM tribus WHERE guild_id=? ORDER BY nom COLLATE NOCASE", BigInt(guild));
  const references = rows("SELECT m.tribu_id,CAST(m.user_id AS TEXT) AS user_id,m.nom_in_game FROM membres m JOIN tribus t ON t.id=m.tribu_id WHERE t.guild_id=?", BigInt(guild));
  const players = new Map<string, {name:string; tribes:Map<number,ReviewTribe>}>();
  const tribePlayers = new Map<number,Set<string>>();
  const invalid = new Set<number>();
  const summaries = new Map<number,ReviewTribe>();
  for (const t of tribes) {
    const id = Number(t.id);
    summaries.set(id, {id, name:String(t.nom), memberCount:0});
    tribePlayers.set(id, new Set());
  }
  function add(id:number, userId:string, name:string) {
    if (!validId(userId)) {invalid.add(id); return;}
    tribePlayers.get(id)!.add(userId);
    const player = players.get(userId) || {name:name || "Référent", tribes:new Map<number,ReviewTribe>()};
    player.tribes.set(id, summaries.get(id)!);
    players.set(userId, player);
  }
  for (const r of references) add(Number(r.tribu_id), String(r.user_id), String(r.nom_in_game || ""));
  // An owner absent from the membership table is still a referenced player.
  for (const t of tribes) if (String(t.owner) !== "0") add(Number(t.id), String(t.owner), "Référent");
  for (const [id, ids] of tribePlayers) summaries.get(id)!.memberCount = ids.size;
  const snapshot = await loadSnapshot(guild);
  const duplicates = [...players].filter(([,p]) => p.tribes.size > 1).map(([userId,p]) => ({
    userId, name:snapshot?.names.get(userId) || p.name, tribes:[...p.tribes.values()],
  }));
  const removable: ReviewTribe[] = [];
  let uncheckedCount = 0;
  for (const [id, ids] of tribePlayers) {
    if (!snapshot || !ids.size || invalid.has(id)) {uncheckedCount++; continue;}
    if (![...ids].some(userId => snapshot.names.has(userId))) removable.push(summaries.get(id)!);
  }
  const absentIds = [...new Set(removable.flatMap(tribe => [...tribePlayers.get(tribe.id)!]))];
  const history = absentIds.length ? await departureHistory(guild) : null;
  const accounts = new Map<string, Awaited<ReturnType<typeof discordAccount>>>();
  for (let i = 0; i < absentIds.length; i += 5) {
    await Promise.all(absentIds.slice(i, i + 5).map(async id => accounts.set(id, await discordAccount(id))));
  }
  const nameOwners = new Map<string, Set<string>>();
  const alias = (id: string, value: string | null | undefined) => {
    if (!value) return;
    const key = departureNameKey(value), owners = nameOwners.get(key) || new Set<string>();
    owners.add(id); nameOwners.set(key, owners);
  };
  for (const [id, name] of snapshot?.names || []) alias(id, name);
  for (const [id, account] of accounts) { alias(id, account.username); alias(id, account.name); }
  for (const tribe of removable) {
    tribe.departedPlayers = [...tribePlayers.get(tribe.id)!].map(userId => {
      const account = accounts.get(userId);
      const event = history && matchDeparture(userId, [account?.username || "", account?.name || ""], history, nameOwners);
      return { userId, name: account?.name || players.get(userId)?.name || "Compte Discord non identifiable",
        departedAt: event?.departedAt || null, sourceUrl: event?.sourceUrl || null, match: event?.match || null };
    });
  }
  return {tribeCount:tribes.length, duplicates, removable, uncheckedCount,
    departureLogsAvailable: history?.available ?? false, departureLogsComplete: history?.complete ?? false,
    departureLogsMessage: history?.message || "", departureChannelUrl: `https://discord.com/channels/${guild}/${departureChannelId}`,
    discordAvailable:!!snapshot, checkedAt:snapshot?.checkedAt || null,
    message:snapshot ? "" : "Présence Discord non vérifiable pour le moment. Aucune tribu n'est signalée comme supprimable sur cette base."};
}