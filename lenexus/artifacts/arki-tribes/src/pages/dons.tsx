import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowUpRight, Maximize2 } from "lucide-react";
import { getGetDonationsQueryKey, useGetDonations, type ShopProduct } from "@workspace/api-client-react";
import { useViewedSession } from "@/lib/owner-view";
import { PageBanner } from "@/components/nexus";
import { Empty, ErrorBox, Skeletons } from "@/components/parts";
import { IMG } from "@/data/nexus";
import { errMsg, useSeo } from "@/lib/helpers";
import { Lightbox, ShopMd, Tags, safeUrl, when } from "@/components/shop-parts";

export default function Dons() {
  useSeo("Dons", "Soutenir le serveur Arki Family.");
  const { data: s, isLoading: sl } = useViewedSession();
  const uid = s?.user?.id ?? "";
  const qc = useQueryClient();
  const [light, setLight] = useState<{ src: string; title: string } | null>(null);
  const q = useGetDonations({ query: { queryKey: [...getGetDonationsQueryKey(), uid], enabled: !!uid, staleTime: 60000, refetchOnWindowFocus: true, retry: (n, e) => { const st = (e as { status?: number } | null)?.status; return st !== 401 && st !== 403 && n < 1; } } });
  useEffect(() => { if (!sl && !uid) qc.removeQueries({ queryKey: getGetDonationsQueryKey() }); }, [uid, sl, qc]);

  if (sl) return <Skeletons n={2} />;
  if (!uid) return <Empty title="Connexion requise"><p>Cette page est réservée aux membres connectés.</p><Link href="/connexion" className="btn btn-primary mt-4" data-testid="link-dons-login">Connexion Discord</Link></Empty>;
  const denied = (q.error as { status?: number } | null)?.status;
  const d = q.data;
  const items: ShopProduct[] = d?.section.products ?? [];
  const open = (p: ShopProduct) => { const m = p.media.find((x) => safeUrl(x.url)); if (m) setLight({ src: safeUrl(m.url), title: p.name }); };

  return (
    <>
      <PageBanner kicker="Communauté" title="Dons" sub="Un coup de pouce au serveur, sans obligation." image={IMG.highlands}>
        <div className="flex flex-wrap gap-3 mt-4">
           <a href={safeUrl(d?.ticketUrl ?? "")} target="_blank" rel="noopener noreferrer" className={`btn btn-primary ${d ? "" : "opacity-50 pointer-events-none"}`} aria-disabled={!d} data-testid="link-donation-ticket">Ouvrir le salon de tickets de don <ArrowUpRight className="h-4 w-4" aria-hidden="true" /></a>
          <Link href="/shop" className="btn btn-ghost" data-testid="link-back-shop"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Retour au shop</Link>
        </div>
      </PageBanner>
      <div className="mt-6 grid gap-5 min-w-0">
        {q.isLoading ? <Skeletons n={3} /> : denied === 401 || denied === 403 ? <Empty title="Accès refusé"><p>Votre compte n'a pas accès à cette page.</p></Empty>
          : !d ? <ErrorBox message={errMsg(q.error)} onRetry={() => q.refetch()} /> : (
            <>
              {(q.isError || d.section.error) && <p className="panel text-sm border-destructive" role="alert">Les informations affichées peuvent être légèrement anciennes. <button type="button" className="underline ml-1" onClick={() => q.refetch()}>Réessayer</button></p>}
              {items.length ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((p) => (
                    <article key={p.id} className="glass overflow-hidden grid content-start" data-testid={`card-don-${p.id}`}>
                      {p.media.some((m) => safeUrl(m.url)) && (
                        <button type="button" onClick={() => open(p)} aria-label={`Agrandir l'offre ${p.name}`} className="group relative block bg-[#080C16] p-2">
                          <img src={safeUrl(p.media.find((m) => safeUrl(m.url))!.url)} alt={p.name} loading="lazy" className="w-full max-h-[26rem] object-contain" />
                          <span className="absolute right-3 top-3 rounded-full bg-[#080C16]/80 border border-[#65D8FF]/60 p-1.5"><Maximize2 className="h-4 w-4" aria-hidden="true" /></span>
                        </button>
                      )}
                      <div className="p-4 grid gap-2">
                        <h2 className="text-lg tracking-wide">{p.name}</h2>
                        <div className="flex flex-wrap gap-1.5 empty:hidden"><Tags tags={p.tags} available={p.available} /></div>
                        {p.description && <ShopMd text={p.description} className="text-muted-foreground" />}
                      </div>
                    </article>
                  ))}
                </div>
              ) : <Empty title="Rien à afficher">Aucune offre n'est disponible pour le moment.</Empty>}
              <p className="text-xs text-muted-foreground">Les dons se font par ticket Discord, aucun paiement n'a lieu sur ce site. Dernière synchro {when(d.section.lastSyncedAt)}.</p>
            </>
          )}
      </div>
      {light && <Lightbox src={light.src} title={light.title} onClose={() => setLight(null)} />}
    </>
  );
}
