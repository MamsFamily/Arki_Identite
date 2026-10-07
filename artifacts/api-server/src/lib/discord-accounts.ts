import { discord } from "./discord-auth";

type Account = { name: string | null; username: string | null; avatar: string | null };
const unavailable: Account = { name: null, username: null, avatar: null };
const cache = new Map<string, { until: number; account: Account }>();
const pending = new Map<string, Promise<Account>>();

// These are display details only. A failed lookup must never hide an access
// grant, suspend it, or prevent its owner from removing it.
export async function discordAccount(userId: string): Promise<Account> {
  const cached = cache.get(userId);
  if (cached && cached.until > Date.now()) return cached.account;
  const existing = pending.get(userId);
  if (existing) return existing;
  const task = loadAccount(userId);
  pending.set(userId, task);
  try { return await task; } finally { pending.delete(userId); }
}

async function loadAccount(userId: string): Promise<Account> {
  let account = unavailable;
  if (process.env.DISCORD_TOKEN) {
    try {
      const user = await discord(`/users/${userId}`, process.env.DISCORD_TOKEN, true) as {
        id: string; username?: string; global_name?: string | null; avatar?: string | null;
      };
      if (user.id === userId && user.username) {
        account = {
          name: user.global_name || user.username,
          username: user.username,
          avatar: user.avatar ? `https://cdn.discordapp.com/avatars/${userId}/${user.avatar}.png?size=80` : null,
        };
      }
    } catch { /* An explicit unavailable state is returned alongside the grant. */ }
  }
  if (cache.size >= 2000) cache.clear();
  cache.set(userId, { account, until: Date.now() + (account.name ? 300000 : 30000) });
  return account;
}