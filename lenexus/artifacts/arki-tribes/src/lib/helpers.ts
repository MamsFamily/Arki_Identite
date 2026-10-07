import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetOverviewQueryKey,
  getGetTribeQueryKey,
  getListTribesQueryKey,
} from "@workspace/api-client-react";
import { useViewedSession as useGetSession } from "@/lib/owner-view";
import { useToast } from "@/hooks/use-toast";

export const intToHex = (n: number) => "#" + (n >>> 0).toString(16).padStart(6, "0").slice(-6);
export const hexToInt = (h: string) => parseInt(h.replace("#", ""), 16) || 0;
export const inkOn = (n: number) => {
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#14231f" : "#f6f0e1";
};
export const fmtDate = (s: string) => {
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
};
export const errMsg = (e: unknown) => {
  const x = e as { data?: { error?: string; message?: string } | string; message?: string };
  if (x && typeof x.data === "object" && x.data) return x.data.error || x.data.message || x.message || "Erreur inconnue";
  return x?.message || "Erreur inconnue";
};
export const initials = (s: string) => s.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

export function useSeo(title: string, description: string) {
  useEffect(() => {
    document.title = title + " | Arki Family";
    let m = document.querySelector('meta[name="description"]');
    if (!m) {
      m = document.createElement("meta");
      m.setAttribute("name", "description");
      document.head.appendChild(m);
    }
    m.setAttribute("content", description);
    for (const [property, content] of Object.entries({
      "og:title": title + " | Arki Family",
      "og:description": description,
      "og:type": "website",
    })) {
      let tag = document.querySelector(`meta[property="${property}"]`);
      if (!tag) {
        tag = document.createElement("meta");
        tag.setAttribute("property", property);
        document.head.appendChild(tag);
      }
      tag.setAttribute("content", content);
    }
  }, [title, description]);
}

/** Options shared by every write: CSRF header, refresh and error toast. */
export function useWrite(tribeId?: number, successMsg = "Modifications enregistrées") {
  const { data: session } = useGetSession();
  const qc = useQueryClient();
  const { toast } = useToast();
  const refresh = () => {
    if (tribeId !== undefined) qc.invalidateQueries({ queryKey: getGetTribeQueryKey(tribeId) });
    qc.invalidateQueries({ queryKey: getListTribesQueryKey() });
    qc.invalidateQueries({ queryKey: getGetOverviewQueryKey() });
    // Refresh every affected map, including the former map after a move/deletion.
    qc.invalidateQueries({ predicate: query => typeof query.queryKey[0] === "string" && /^\/api\/site-maps\/[^/]+\/settlements$/.test(query.queryKey[0]) });
  };
  return {
    request: { headers: { "X-CSRF-Token": session?.csrfToken ?? "" } },
    mutation: {
      onSuccess: () => {
        refresh();
        toast({ title: successMsg });
      },
      onError: (e: unknown) => toast({ title: "Action impossible", description: errMsg(e), variant: "destructive" }),
    },
  };
}
