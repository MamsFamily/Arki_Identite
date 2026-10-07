import { discord } from "./discord-auth";
import { HttpError } from "./tribe-store";

type GuildMember = {nick?: string; joined_at?: string; user: {id: string; username: string; global_name?: string; avatar?: string; bot?: boolean}};
const cache = new Map<string, {until: number; page: {players: {id:string;name:string;username:string;avatar:string;joinedAt:string|null}[];nextAfter:string|null;hasMore:boolean}}>();
function token() {
  if (!process.env.DISCORD_TOKEN) throw new HttpError(503, "Le bot Discord doit être configuré pour afficher les joueurs du serveur.");
  return process.env.DISCORD_TOKEN;
}
export async function discordPlayers(guild: string, q: string, after?: string) {
  const key = `${guild}:${q}:${after || ""}`, cached = cache.get(key);
  if (cached && cached.until>Date.now()) return cached.page;
  const params = new URLSearchParams({limit: "100"});
  if (q) params.set("query", q); else if (after) params.set("after", after);
  let members: GuildMember[];
  try {members = await discord(`/guilds/${guild}/members${q ? "/search" : ""}?${params}`, token(), true) as GuildMember[];}
  catch {throw new HttpError(503, "La liste des joueurs Discord est indisponible. Le bot doit avoir accès aux membres du serveur. Réessayez dans un instant.");}
  const page = {
    players: members.filter(m => !m.user.bot).map(m => ({
      id: m.user.id, name: m.nick || m.user.global_name || m.user.username, username: m.user.username,
      avatar: m.user.avatar ? `https://cdn.discordapp.com/avatars/${m.user.id}/${m.user.avatar}.png` : "",
      joinedAt: m.joined_at && Number.isFinite(Date.parse(m.joined_at)) ? m.joined_at : null,
    })),
    nextAfter: !q && members.length===100 ? members[members.length-1].user.id : null,
    hasMore: members.length===100,
  };
  if (cache.size>1000) cache.clear();
  cache.set(key, {until: Date.now()+30000, page});
  return page;
}
// This check deliberately has no site-owner exception or positive membership cache.
// A Discord login alone must never grant access to the private player search.
export async function requireCurrentServerMember(guild: string, userId: string) {
  let response: Response;
  try {
    response = await fetch(`https://discord.com/api/v10/guilds/${guild}/members/${userId}`, {
      headers: {Authorization: `Bot ${token()}`}, signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new HttpError(503, "Impossible de vérifier votre présence sur le serveur Discord pour le moment.");
  }
  if (response.status === 404) throw new HttpError(403, "Cette recherche est réservée aux membres du serveur Discord.");
  if (!response.ok) throw new HttpError(503, "Impossible de vérifier votre présence sur le serveur Discord pour le moment.");
  const member = await response.json() as GuildMember;
  if (member.user?.id !== userId || member.user.bot) {
    throw new HttpError(403, "Cette recherche est réservée aux membres du serveur Discord.");
  }
}
export async function verifyPlayer(guild: string, userId: string) {
  const member = await discord(`/guilds/${guild}/members/${userId}`, token(), true) as GuildMember;
  if (!member.user || member.user.id!==userId || member.user.bot) throw new HttpError(400, "Choisissez un joueur membre du serveur Discord, pas un bot.");
}