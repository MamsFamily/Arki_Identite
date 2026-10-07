import { HttpError } from "./tribe-store";

/** Server-only credentials. Never use a VITE_ variable for this configuration. */
export async function readArki(path: "account" | "catalog" | "staff", actor: string, guild: string, page = 1) {
  const base = process.env.ARKI_BRIDGE_URL;
  const token = process.env.ARKI_BRIDGE_TOKEN;
  if (!base || !token || token.length < 32) throw new HttpError(503, "La liaison ArkiFamily n’est pas encore configurée.");
  let origin: URL;
  try { origin = new URL(base); }
  catch { throw new HttpError(503, "Adresse de la liaison ArkiFamily invalide."); }
  if (origin.protocol !== "https:" || origin.username || origin.password || origin.search || origin.hash || origin.pathname !== "/") {
    throw new HttpError(503, "La liaison doit utiliser une origine HTTPS sans identifiants ni chemin.");
  }
  const url = new URL(`/api/nexus/v1/${path}`, origin);
  if (path === "staff") url.searchParams.set("page", String(page));
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, "X-Arki-Actor-Id": actor, "X-Arki-Guild-Id": guild },
      signal: AbortSignal.timeout(15000), redirect: "error",
    });
  } catch { throw new HttpError(503, "La source ArkiFamily ne répond pas. Réessayez plus tard."); }
  if (!response.ok) {
    // Do not forward upstream payloads, credentials, or internal error details.
    throw new HttpError(response.status === 403 ? 403 : 503,
      response.status === 403 ? "Votre compte n’a pas les droits requis dans ArkiFamily." : "La source ArkiFamily est indisponible ou la liaison est mal configurée.");
  }
  let raw: unknown;
  try { raw = await response.json(); }
  catch { throw new HttpError(503, "La source ArkiFamily a renvoyé une réponse invalide."); }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new HttpError(503, "Réponse ArkiFamily invalide.");
  const data = raw as Record<string, unknown>;
  if (data.schemaVersion !== 1 || data.guildId !== guild || (path === "account" && data.discordUserId !== actor)) {
    throw new HttpError(503, "La réponse ArkiFamily ne correspond pas au compte ou au serveur demandé.");
  }
  const arrays = path === "account" ? ["inventory", "orders", "tickets", "activity"] : path === "catalog" ? ["products"] : ["orders"];
  if (arrays.some(key => !Array.isArray(data[key]))) throw new HttpError(503, "La réponse ArkiFamily est incomplète.");
  return data;
}
