// User-provided departure channel. It is checked against the tribe guild before
// reading its history; no messages are sent, edited, or removed.
export const departureChannelId = "1156934394586611843";
export type Departure = { userId: string | null; name: string | null; departedAt: string; sourceUrl: string };
type Embed = {
  title?: string; description?: string; fields?: { name: string; value: string }[];
  footer?: { text?: string }; thumbnail?: { url?: string }; author?: { icon_url?: string };
};
export type DepartureMessage = { id: string; timestamp: string; content?: string; author?: { bot?: boolean }; embeds?: Embed[] };
export type DepartureHistory = { available: boolean; complete: boolean; events: Departure[]; message: string };
type HistoryState = { until: number; oldest: string; newest: string; complete: boolean; events: Map<string, Departure>; result: DepartureHistory };
const histories = new Map<string, HistoryState>();
const pending = new Map<string, Promise<DepartureHistory>>();
let nextRequestAt = 0;
class HistoryBudgetExceeded extends Error {}
const validId = (value: string) => /^\d{17,20}$/.test(value);
export const departureNameKey = (value: string) => value.normalize("NFKC").trim().toLocaleLowerCase("fr-FR");

export function parseDepartureMessage(message: DepartureMessage, guild: string): Departure | null {
  if (!message.author?.bot || !validId(message.id) || !Number.isFinite(Date.parse(message.timestamp))) return null;
  for (const embed of message.embeds || []) {
    if (!/^(?:Goodbye my friends? 👋🏼|Un membre vient de partir… 😢)$/.test(embed.title || "")) continue;
    const description = embed.description || "";
    const name = description.match(/^À plus sous l[’']bus \*\*(.+?)\*\* ! Merci/m)?.[1] ||
      description.match(/^À plus sur Vénus\s+(?:<a?:[^>]+>\s*)?([^\n]+)/m)?.[1] || null;
    // Do not interpret emoji IDs, channel IDs, or "Depuis <t:...>" (arrival)
    // as player IDs or departure dates.
    const text = [message.content || "", description, embed.footer?.text || "",
      ...(embed.fields || []).map(f => `${f.name}: ${f.value}`)].join("\n");
    const ids = new Set([...text.matchAll(/<@!?(\d{17,20})>/g)].map(m => m[1]));
    for (const match of text.matchAll(/(?:user\s*id|identifiant|ID)\s*[:：]\s*[`*]*(\d{17,20})/gi)) ids.add(match[1]);
    for (const url of [embed.thumbnail?.url, embed.author?.icon_url]) {
      const id = url?.match(/^https:\/\/cdn\.discordapp\.com\/avatars\/(\d{17,20})\//)?.[1];
      if (id) ids.add(id);
    }
    if (ids.size > 1 || (!name && ids.size !== 1)) return null;
    return {
      userId: ids.size === 1 ? [...ids][0] : null, name: name?.trim() || null,
      departedAt: new Date(message.timestamp).toISOString(),
      sourceUrl: `https://discord.com/channels/${guild}/${departureChannelId}/${message.id}`,
    };
  }
  return null;
}

export async function departureHistory(guild: string): Promise<DepartureHistory> {
  const state = histories.get(guild);
  if (state && state.until > Date.now()) return state.result;
  const existing = pending.get(guild);
  if (existing) return existing;
  const task = loadHistory(guild, state);
  pending.set(guild, task);
  try { return await task; } finally { pending.delete(guild); }
}

async function loadHistory(guild: string, previous?: HistoryState): Promise<DepartureHistory> {
  const state: HistoryState = previous || { until: 0, oldest: "", newest: "", complete: false, events: new Map(),
    result: { available: false, complete: false, events: [], message: "" } };
  const started = Date.now();
  const deadline = started + 20000;
  let recentSynced = !state.newest;
  const ingest = (messages: DepartureMessage[]) => {
    for (const message of messages) {
      const event = parseDepartureMessage(message, guild);
      if (event) state.events.set(message.id, event);
    }
  };
  try {
    if (!process.env.DISCORD_TOKEN) throw new Error("Discord unavailable");
    const token = process.env.DISCORD_TOKEN;
    const channel = await logRequest(`/channels/${departureChannelId}`, token, deadline) as { guild_id?: string };
    if (channel.guild_id !== guild) throw new Error("Wrong guild");
    // The same channel's requests are sequential and shared by all callers.
    // Catch up with recent messages, including bursts longer than one page.
    let newest = state.newest;
    if (state.newest) {
      for (let page = 0; page < 30; page++) {
        if (Date.now() - started > 20000) throw new Error("Recent history incomplete");
        const messages = await messagePage(`after=${newest}`, token, deadline);
        ingest(messages);
        if (messages.length) newest = messages.reduce((max, m) => BigInt(m.id) > BigInt(max) ? m.id : max, newest);
        if (messages.length < 100) { state.newest = newest; recentSynced = true; break; }
        if (page === 29) throw new Error("Recent history incomplete");
      }
    }
    // Backfill older pages; bounded passes continue from the saved cursor.
    // No retention limit silently discards older departure dates.
    for (let page = 0; !state.complete && page < 30 && Date.now() - started < 20000; page++) {
      const messages = await messagePage(state.oldest ? `before=${state.oldest}` : "", token, deadline);
      ingest(messages);
      if (messages.length) {
        if (!state.newest) state.newest = messages.reduce((max, m) => BigInt(m.id) > BigInt(max) ? m.id : max, messages[0].id);
        const oldest = messages.reduce((min, m) => BigInt(m.id) < BigInt(min) ? m.id : min, messages[0].id);
        if (state.oldest && BigInt(oldest) >= BigInt(state.oldest)) throw new Error("Invalid history pagination");
        state.oldest = oldest;
      }
      if (messages.length < 100) state.complete = true;
    }
    state.result = { available: true, complete: state.complete, events: [...state.events.values()],
      message: state.complete ? "" : "L’historique ancien est encore en cours de lecture. Les prochaines vérifications poursuivront la recherche des dates manquantes." };
    state.until = Date.now() + (state.complete ? 300000 : 30000);
  } catch (error) {
    if (error instanceof HistoryBudgetExceeded && recentSynced && state.newest && !state.complete) {
      state.result = { available: true, complete: false, events: [...state.events.values()],
        message: "Lecture de l’historique en cours, dans les limites autorisées par Discord. Les prochaines vérifications poursuivront la recherche des dates manquantes." };
      state.until = Date.now() + 30000;
      histories.set(guild, state);
      return state.result;
    }
    // Keep the cursor for a later retry, but never report a stale date as
    // freshly verified when Discord refuses access.
    state.result = { available: false, complete: false, events: [],
      message: "Historique des départs momentanément non vérifiable. Vérifiez que le bot peut voir le salon ♦au-revoir et lire son historique, puis actualisez." };
    state.until = Date.now() + 30000;
  }
  histories.set(guild, state);
  return state.result;
}

async function messagePage(cursor: string, token: string, deadline: number): Promise<DepartureMessage[]> {
  const messages = await logRequest(`/channels/${departureChannelId}/messages?limit=100${cursor ? `&${cursor}` : ""}`, token, deadline) as DepartureMessage[];
  if (!Array.isArray(messages) || messages.some(m => !validId(m.id))) throw new Error("Invalid messages");
  return messages;
}

async function logRequest(path: string, token: string, deadline: number): Promise<unknown> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const wait = Math.max(0, nextRequestAt - Date.now());
    if (Date.now() + wait + 100 >= deadline) throw new HistoryBudgetExceeded();
    if (wait) await new Promise(resolve => setTimeout(resolve, wait));
    const response = await fetch(`https://discord.com/api/v10${path}`, {
      headers: { Authorization: `Bot ${token}`, "User-Agent": "ArkiNexus (departure history reader)" },
      signal: AbortSignal.timeout(Math.min(8000, deadline - Date.now())),
    });
    const resetAfter = Number(response.headers.get("x-ratelimit-reset-after"));
    if (response.headers.get("x-ratelimit-remaining") === "0" && Number.isFinite(resetAfter)) {
      nextRequestAt = Date.now() + Math.ceil(resetAfter * 1000) + 100;
    }
    if (response.status === 429) {
      const body = await response.json() as { retry_after?: number };
      const retry = Number(body.retry_after ?? response.headers.get("retry-after") ?? 1);
      nextRequestAt = Date.now() + Math.max(1000, Number.isFinite(retry) ? Math.ceil(retry * 1000) + 100 : 1000);
      continue;
    }
    if (!response.ok) throw new Error("Departure history unavailable");
    return response.json();
  }
  throw new Error("Departure history rate limited");
}

export function matchDeparture(userId: string, aliases: string[], history: DepartureHistory, nameOwners: Map<string, Set<string>>) {
  if (!history.available) return null;
  const byId = history.events.filter(event => event.userId === userId);
  const keys = new Set(aliases.filter(Boolean).map(departureNameKey).filter(key => nameOwners.get(key)?.size === 1 && nameOwners.get(key)?.has(userId)));
  const byName = history.events.filter(event => !event.userId && event.name && keys.has(departureNameKey(event.name)));
  const matches = (byId.length ? byId : byName).sort((a, b) => Date.parse(b.departedAt) - Date.parse(a.departedAt));
  return matches.length ? { ...matches[0], match: byId.length ? "id" as const : "pseudo" as const } : null;
}