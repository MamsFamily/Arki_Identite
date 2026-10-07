import { pool } from "@workspace/db";
import type * as Z from "@workspace/api-zod";
import { HttpError, targetGuild } from "./tribe-store";
import { logger } from "./logger";
import { buildShopProducts } from "./shop-products";

export const SHOP_SECTIONS = [
  { id: "infos", title: "Infos Shop", channel: "1485051049654878379" },
  { id: "petit-shop", title: "Le p’tit shop", channel: "1485051177845657771" },
  { id: "packs", title: "Les packs", channel: "1485051269977739334" },
  { id: "dinos", title: "Dino Shop", channel: "1485051399589855382" },
  { id: "dons", title: "Dons", channel: "1160538476224196628" },
] as const;
const DAY = 24 * 60 * 60 * 1000;
type ShopCatalog = ReturnType<typeof Z.GetShopResponse.parse>;
type ShopMessage = ShopCatalog["sections"][number]["messages"][number];
export type DiscordShopMessage = {
  id: string; content?: string; timestamp: string; edited_timestamp?: string | null;
  author?: { username?: string; global_name?: string };
  attachments?: { id: string; url: string; filename: string; content_type?: string }[];
  embeds?: { title?: string; description?: string; fields?: { name: string; value: string }[];
    image?: { url: string; proxy_url?: string; content_type?: string }; thumbnail?: { url: string; proxy_url?: string; content_type?: string }; footer?: { text: string } }[];
};
type CacheRow = { section_id: string; data: DiscordShopMessage[]; synced_at: string | null; next_attempt_at: string; error: string | null };
let initialized: Promise<void> | undefined;
let syncing: Promise<void> | undefined;

function initShop() {
  // Publish applies the development schema to the managed production database.
  // Startup must check it, not attempt production DDL.
  return initialized ??= pool.query("SELECT section_id FROM site_shop_cache LIMIT 0")
    .then(() => {}).catch(e => { initialized = undefined; throw e; });
}

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
export async function shopDiscord(path: string): Promise<any> {
  if (!process.env.DISCORD_TOKEN) throw new HttpError(503, "Le bot Discord n’est pas configuré.");
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(`https://discord.com/api/v10${path}`, {
      headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` }, signal: AbortSignal.timeout(15000),
    });
    if (response.status === 429) {
      const body = await response.json() as { retry_after?: number };
      const delay = Number(body.retry_after);
      if (!Number.isFinite(delay) || delay > 60 || attempt === 3) throw new HttpError(503, "Discord limite temporairement les lectures. Nouvelle tentative dans une heure.");
      await wait(Math.max(1000, delay * 1000 + 200));
      continue;
    }
    if (!response.ok) throw new HttpError(503, response.status === 403
      ? "Le bot n’a pas accès au salon ou à son historique."
      : response.status === 404 ? "Le salon ou le message Discord est introuvable."
        : "Discord est temporairement indisponible.");
    return response.json();
  }
  throw new HttpError(503, "Discord est temporairement indisponible.");
}

export async function readShopHistory(channel: string, client: (path: string) => Promise<any> = shopDiscord): Promise<DiscordShopMessage[]> {
  const messages: DiscordShopMessage[] = [];
  let before = "";
  for (let page = 0; page < 100; page++) {
    const batch = await client(`/channels/${channel}/messages?limit=100${before ? `&before=${before}` : ""}`);
    if (!Array.isArray(batch)) throw new HttpError(503, "Historique Discord non reconnu.");
    messages.push(...batch);
    if (batch.length < 100) return messages.sort((a, b) => BigInt(a.id) < BigInt(b.id) ? -1 : 1);
    const next = batch.at(-1)?.id;
    if (!next || next === before) throw new HttpError(503, "Pagination Discord interrompue ; l’ancienne version est conservée.");
    before = next;
  }
  throw new HttpError(503, "Historique trop volumineux ; l’ancienne version est conservée.");
}

export function shopMedia(message: DiscordShopMessage) {
  const result = (message.attachments ?? []).map(a => ({ id: a.id, name: a.filename, contentType: a.content_type ?? "application/octet-stream", url: a.url }));
  (message.embeds ?? []).forEach((embed, index) => {
    for (const [kind, image] of [["image", embed.image], ["thumbnail", embed.thumbnail]] as const) {
      const url = image && (safeDiscordMedia(image.url) ? image.url : image.proxy_url);
      if (url && safeDiscordMedia(url)) result.push({ id: `embed-${index}-${kind}`, name: embed.title ?? "Visuel Discord", contentType: image?.content_type ?? "image/jpeg", url });
    }
  });
  return result;
}
export function safeDiscordMedia(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password &&
      ["cdn.discordapp.com", "media.discordapp.net", "images-ext-1.discordapp.net", "images-ext-2.discordapp.net"].includes(url.hostname);
  } catch { return false; }
}
export function shopMessageDto(message: DiscordShopMessage, section: string, channel: string, guild: string): ShopMessage {
  const embedText = (message.embeds ?? []).map(e =>
    [e.title ? `## ${e.title}` : "", e.description, ...(e.fields ?? []).map(f => `**${f.name}**\n${f.value}`), e.footer?.text].filter(Boolean).join("\n\n"));
  const content = [message.content, ...embedText].filter(Boolean).join("\n\n");
  return { id: message.id, content, authorName: message.author?.global_name ?? message.author?.username ?? "Discord",
    createdAt: message.timestamp, updatedAt: message.edited_timestamp ?? message.timestamp,
    sourceUrl: `https://discord.com/channels/${guild}/${channel}/${message.id}`,
    media: shopMedia(message).filter(m => safeDiscordMedia(m.url)).map(m => ({
      ...m, url: `/api/shop/media/${section}/${message.id}/${m.id}`,
    })) };
}

export function synchronizeShop() {
  if (syncing) return syncing;
  syncing = synchronize().finally(() => { syncing = undefined; });
  return syncing;
}
async function synchronize() {
  await initShop();
  const guild = targetGuild();
  if (!guild) throw new HttpError(503, "Le serveur Discord du Shop n’est pas configuré.");
  const rows = (await pool.query<CacheRow>("SELECT * FROM site_shop_cache")).rows;
  for (const section of SHOP_SECTIONS) {
    const cached = rows.find(row => row.section_id === section.id);
    if (cached && Date.parse(cached.next_attempt_at) > Date.now()) continue;
    try {
      const channel = await shopDiscord(`/channels/${section.channel}`);
      if (channel.guild_id !== guild) throw new HttpError(503, "Ce salon n’appartient pas au serveur Discord configuré.");
      if (![0, 5].includes(channel.type)) throw new HttpError(503, "Ce salon n’est pas un salon de messages accessible au Shop.");
      const messages = await readShopHistory(section.channel);
      // Never erase a known catalogue because Discord hid content from the bot.
      if (messages.length && messages.every(m => !m.content && !(m.embeds?.length) && !(m.attachments?.length))) {
        throw new HttpError(503, "Discord masque le contenu des messages : vérifiez l’accès et l’intention Message Content du bot.");
      }
      const now = new Date().toISOString(), next = new Date(Date.now() + DAY).toISOString();
      await pool.query(`INSERT INTO site_shop_cache(section_id,data,synced_at,next_attempt_at,error)
        VALUES($1,$2,$3,$4,NULL) ON CONFLICT(section_id) DO UPDATE SET data=EXCLUDED.data,
        synced_at=EXCLUDED.synced_at,next_attempt_at=EXCLUDED.next_attempt_at,error=NULL`,
        [section.id, JSON.stringify(messages), now, next]);
      logger.info({ section: section.id, messages: messages.length }, "Discord Shop synchronized");
    } catch (error) {
      const message = error instanceof HttpError ? error.message : "La synchronisation a échoué. Dernière version conservée.";
      await pool.query(`INSERT INTO site_shop_cache(section_id,data,synced_at,next_attempt_at,error)
        VALUES($1,'[]',NULL,$2,$3) ON CONFLICT(section_id) DO UPDATE SET next_attempt_at=EXCLUDED.next_attempt_at,error=EXCLUDED.error`,
        [section.id, new Date(Date.now() + 3600000).toISOString(), message]);
      logger.warn({ section: section.id, reason: message }, "Discord Shop synchronization failed");
    }
  }
}

async function getShopSections() {
  await synchronizeShop();
  const guild = targetGuild()!;
  const rows = (await pool.query<CacheRow>("SELECT * FROM site_shop_cache")).rows;
  const sections = SHOP_SECTIONS.map(section => {
    const row = rows.find(r => r.section_id === section.id);
    const messages = (row?.data ?? []).map(m => shopMessageDto(m, section.id, section.channel, guild)).filter(m => m.content || m.media.length);
    return { id: section.id, title: section.title, channelUrl: `https://discord.com/channels/${guild}/${section.channel}`,
      messages, products: buildShopProducts(messages, section.id),
      lastSyncedAt: row?.synced_at ?? null, nextSyncAt: row?.next_attempt_at ?? null, error: row?.error ?? null };
  });
  return sections;
}
export async function getShopCatalog(): Promise<ShopCatalog> {
  const sections = await getShopSections();
  return { sections: sections.slice(0, 4), shopTicketUrl: `https://discord.com/channels/${targetGuild()}/1156938232244752494` };
}
export async function getDonationsCatalog(): Promise<ReturnType<typeof Z.GetDonationsResponse.parse>> {
  const sections = await getShopSections();
  return { section: sections[4], ticketUrl: `https://discord.com/channels/${targetGuild()}/1156938293586427934` };
}

// Only source-referenced custom emojis can be read through this authenticated proxy.
export async function getShopEmoji(id: string, format: string) {
  if (!/^\d{17,20}$/.test(id) || !["png", "gif"].includes(format)) throw new HttpError(404, "Emoji introuvable.");
  await initShop();
  const rows = (await pool.query<CacheRow>("SELECT * FROM site_shop_cache")).rows;
  const referenced = rows.some(row => new RegExp(`<${format === "gif" ? "a" : ""}:[a-zA-Z0-9_]+:${id}>`).test(JSON.stringify(row.data)));
  if (!referenced) throw new HttpError(404, "Emoji introuvable.");
  return `https://cdn.discordapp.com/emojis/${id}.${format}?size=32&quality=lossless`;
}

// Resolve fresh Discord URLs when viewing a media file: signed CDN links expire.
const mediaMessages = new Map<string, { until: number; task: Promise<DiscordShopMessage> }>();
export async function getShopMedia(sectionId: string, messageId: string, mediaId: string) {
  const section = SHOP_SECTIONS.find(s => s.id === sectionId);
  if (!section || !/^\d{17,20}$/.test(messageId) || !/^(?:\d{17,20}|embed-\d+-(?:image|thumbnail))$/.test(mediaId)) throw new HttpError(404, "Média introuvable.");
  await initShop();
  const row = (await pool.query<CacheRow>("SELECT * FROM site_shop_cache WHERE section_id=$1", [sectionId])).rows[0];
  if (!row?.data.some(m => m.id === messageId)) throw new HttpError(404, "Média introuvable.");
  const snapshot = row.data.find(m => m.id === messageId)!;
  const cached = shopMedia(snapshot).find(m => m.id === mediaId);
  // External embed proxies do not use expiring attachment signatures. They
  // follow the daily snapshot without one Discord API request per pack card.
  if (cached && safeDiscordMedia(cached.url) && new URL(cached.url).hostname.startsWith("images-ext-")) return cached;
  const key = `${sectionId}/${messageId}`;
  let item = mediaMessages.get(key);
  if (!item || item.until < Date.now()) {
    if (mediaMessages.size > 500) mediaMessages.clear();
    const task = shopDiscord(`/channels/${section.channel}/messages/${messageId}`);
    item = { until: Date.now() + 600000, task };
    mediaMessages.set(key, item);
    void task.catch(() => mediaMessages.delete(key));
  }
  const media = shopMedia(await item.task).find(m => m.id === mediaId);
  if (!media || !safeDiscordMedia(media.url)) throw new HttpError(404, "Média introuvable.");
  return media;
}

export function startShopSync() {
  const run = () => void synchronizeShop().catch(error => logger.warn({ errorType: error instanceof Error ? error.name : "unknown" }, "Shop synchronization will retry"));
  run();
  const timer = setInterval(run, 3600000);
  timer.unref();
}
