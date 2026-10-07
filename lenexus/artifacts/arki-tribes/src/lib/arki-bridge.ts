import { useQuery } from "@tanstack/react-query";

export type ArkiOrder = {
  id: string; status: string; createdAt: number; discountPercent: number; ticketUrl: string | null;
  discordUserId?: string; customerName?: string;
  items: { name: string; type: string; quantity: number; variant: string; sex: string; stat: string; diamonds: number; strawberries: number }[];
};
export type ArkiAccount = {
  schemaVersion: number; guildId: string; fetchedAt: string; discordUserId: string;
  inventory: { id: string; name: string; category: string; quantity: number }[];
  orders: ArkiOrder[];
  tickets: { id: string; kind: string; status: string; createdAt: number; url: string | null }[];
  activity: { action: string; itemId: string; quantity: number; timestamp: string }[];
};
export type ArkiCatalog = {
  fetchedAt: string; pricingNotice: string;
  products: { id: string; name: string; type: string; category: string; description: string; noReduction: boolean;
    prices: { label: string; diamonds: number; strawberries: number }[] }[];
};
export type ArkiStaff = { fetchedAt: string; page: number; hasMore: boolean; orders: ArkiOrder[] };
async function get<T>(path: string): Promise<T> {
  const response = await fetch(`${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/arki/${path}`,
    { credentials: "include", cache: "no-store" });
  if (!response.ok) {
    let message = "Les informations ArkiFamily sont indisponibles.";
    try { const body = await response.json(); if (typeof body.error === "string") message = body.error; } catch { /* explicit generic error */ }
    throw new Error(message);
  }
  return response.json();
}
export const useArkiAccount = (userId?: string) => useQuery({
  queryKey: ["arki", "account", userId], queryFn: () => get<ArkiAccount>("account"), enabled: !!userId, staleTime: 0, retry: false,
});
export const useArkiCatalog = (userId?: string) => useQuery({
  queryKey: ["arki", "catalog", userId], queryFn: () => get<ArkiCatalog>("catalog"), enabled: !!userId, staleTime: 0, retry: false,
});
export const useArkiStaff = (userId: string | undefined, allowed: boolean, page: number) => useQuery({
  queryKey: ["arki", "staff", userId, page], queryFn: () => get<ArkiStaff>(`staff?page=${page}`),
  enabled: !!userId && allowed, staleTime: 0, retry: false,
});
