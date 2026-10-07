import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Search, X, ChevronDown, Maximize2 } from "lucide-react";
import { getGetShopQueryKey, useGetShop, type ShopProduct, type ShopSection } from "@workspace/api-client-react";
import { useViewedSession } from "@/lib/owner-view";
import { PageBanner } from "@/components/nexus";
import { Empty, ErrorBox, Skeletons } from "@/components/parts";
import { IMG } from "@/data/nexus";
import { errMsg, useSeo } from "@/lib/helpers";
import { Lightbox, Prices, ShopMd, Tags, norm, safeUrl, when } from "@/components/shop-parts";

const isDino = (s: ShopSection) => /dino/i.test(s.id + " " + s.title);
const isInfo = (s: ShopSection) => /info/i.test(s.id + " " + s.title);

function Thumb({ p, onOpen, className = "" }: { p: ShopProduct; onOpen: (p: ShopProduct, i: number) => void; className?: string }) {
  const m = p.media.find((x) => safeUrl(x.url) && !x.contentType.startsWith("video/"));
  if (!m) return null;
  return (
    <button type="button" onClick={() => onOpen(p, p.media.indexOf(m))} aria-label={`Agrandir l'image de ${p.name}`} className={`group relative block overflow-hidden rounded-xl bg-[#080C16] ${className}`}>
      <img src={safeUrl(m.url)} alt={p.name} loading="lazy" className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-[1.04]" />
      <Maximize2 className="absolute right-2 top-2 h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true" />
    </button>
  );
}

function OfferGrid({ items, onOpen }: { items: ShopProduct[]; onOpen: (p: ShopProduct, i: number) => void }) {
  if (!items.length) return <Empty title="Rien ici pour l'instant">Cette catégorie ne contient aucune offre.</Empty>;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((p) => (
        <article key={p.id} className={`glass overflow-hidden grid content-start transition-transform hover:-translate-y-1 ${p.available ? "" : "opacity-75"}`} data-testid={`card-offer-${p.id}`}>
          <Thumb p={p} onOpen={onOpen} className="aspect-[4/3] rounded-none" />
          <div className="p-4 grid gap-3">
            <h3 className="text-lg tracking-wide leading-tight">{p.name}</h3>
            <div className="flex flex-wrap gap-1.5 empty:hidden"><Tags tags={p.tags} available={p.available} /></div>
            <Prices p={p} />
            {p.description && <ShopMd text={p.description} className="text-muted-foreground" />}
          </div>
        </article>
      ))}
    </div>
  );
}

function InfoGroups({ items }: { items: ShopProduct[] }) {
  if (!items.length) return <Empty title="Aucune règle publiée">Les règles du shop apparaîtront ici.</Empty>;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {items.map((p, i) => (
        <details key={p.id} open={i < 2} className="glass p-4 group" data-testid={`info-${p.id}`}>
          <summary className="cursor-pointer list-none flex items-center justify-between gap-3 font-bold">
            <span className="display text-base tracking-wide">{p.name}</span>
            <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="mt-3"><ShopMd text={p.description} /></div>
        </details>
      ))}
    </div>
  );
}

type Avail = "all" | "yes" | "no";
const PAGE = 48;

function DinoCatalogue({ items, onOpen }: { items: ShopProduct[]; onOpen: (p: ShopProduct, i: number) => void }) {
  const [q, setQ] = useState("");
  const [avail, setAvail] = useState<Avail>("all");
  const [tag, setTag] = useState("");
  const [variant, setVariant] = useState("");
  const [grouped, setGrouped] = useState(true);
  const [limit, setLimit] = useState(PAGE);
  const [openId, setOpenId] = useState("");

  const tags = useMemo(() => Array.from(new Set(items.flatMap((p) => p.tags))).sort((a, b) => a.localeCompare(b, "fr")), [items]);
  const variants = useMemo(() => Array.from(new Set(items.flatMap((p) => p.prices.map((x) => x.variant)))), [items]);
  const index = useMemo(() => items.map((p) => ({ p, k: norm(p.name) })).sort((a, b) => a.k.localeCompare(b.k, "fr")), [items]);
  const nq = norm(q);
  const list = useMemo(() => index.filter(({ p, k }) =>
    (!nq || k.includes(nq)) && (avail === "all" || (avail === "yes") === p.available) && (!tag || p.tags.includes(tag)) && (!variant || p.prices.some((x) => x.variant === variant))
  ).map((x) => x.p), [index, nq, avail, tag, variant]);
  useEffect(() => setLimit(PAGE), [nq, avail, tag, variant, grouped]);
  const shown = list.slice(0, limit);
  const letter = (p: ShopProduct) => { const c = norm(p.name).charAt(0).toUpperCase(); return /[A-Z]/.test(c) ? c : "#"; };
  const letters = useMemo(() => Array.from(new Set(list.map(letter))), [list]);
  const reset = () => { setQ(""); setAvail("all"); setTag(""); setVariant(""); };
  const filtered = !!(q || tag || variant || avail !== "all");

  const row = (p: ShopProduct) => {
    const open = openId === p.id;
    const hasMore = !!p.description || p.media.length > 0;
    return (
      <li key={p.id} className={`rounded-2xl border transition-colors ${p.available ? "border-[#9AEAFF]/15 bg-[#0f192a]/70 hover:border-[#65D8FF]/50" : "border-dashed border-white/10 bg-[#0b1220]/60"}`} data-testid={`row-dino-${p.id}`}>
        <div className="p-3 sm:p-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="min-w-0 grid gap-1.5">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
              <h3 className={`font-sans font-extrabold text-base tracking-normal break-words ${p.available ? "" : "text-muted-foreground line-through decoration-white/25"}`}>{p.name}</h3>
              <Tags tags={p.tags} available={p.available} />
            </div>
          </div>
          <Prices p={p} compact />
        </div>
        {hasMore && (
          <>
            <button type="button" aria-expanded={open} onClick={() => setOpenId(open ? "" : p.id)} className="w-full flex items-center gap-1.5 px-4 pb-3 text-xs text-muted-foreground hover:text-[#9AEAFF]">
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" /> {open ? "Masquer les détails" : "Conditions et détails"}
            </button>
            {open && (
               <div className={`px-4 pb-4 grid gap-3 ${p.media.length ? "sm:grid-cols-[8rem_1fr]" : ""} rise`}>
                <Thumb p={p} onOpen={onOpen} className="aspect-square w-32" />
                {p.description && <ShopMd text={p.description} className="text-muted-foreground" />}
              </div>
            )}
          </>
        )}
      </li>
    );
  };

  return (
    <div className="grid gap-4">
      <div className="glass p-3 sm:p-4 grid gap-3 sticky top-16 z-20">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher un dino : rex, therizino, giga…" aria-label="Rechercher un dino" className="field !pl-11 !pr-10" data-testid="input-dino-search" />
          {q && <button type="button" onClick={() => setQ("")} aria-label="Effacer la recherche" className="absolute right-3 top-1/2 -translate-y-1/2 p-1"><X className="h-4 w-4" aria-hidden="true" /></button>}
        </div>
        <div className="flex flex-wrap gap-2 items-center" role="group" aria-label="Filtres">
          {([["all", "Tous"], ["yes", "Disponibles"], ["no", "Indisponibles"]] as const).map(([v, l]) => (
            <button key={v} type="button" className="pill !py-1.5" aria-pressed={avail === v} onClick={() => setAvail(v)} data-testid={`filter-avail-${v}`}>{l}</button>
          ))}
          {variants.length > 1 && <select aria-label="Variante" value={variant} onChange={(e) => setVariant(e.target.value)} className="field !w-auto !py-1.5 text-sm" data-testid="select-variant"><option value="">Toutes variantes</option>{variants.map((v) => <option key={v} value={v}>{v}</option>)}</select>}
          {tags.length > 0 && <select aria-label="Catégorie" value={tag} onChange={(e) => setTag(e.target.value)} className="field !w-auto !py-1.5 text-sm" data-testid="select-tag"><option value="">Toutes catégories</option>{tags.map((v) => <option key={v} value={v}>{v}</option>)}</select>}
          <button type="button" className="pill !py-1.5 ml-auto" aria-pressed={grouped} onClick={() => setGrouped(!grouped)} data-testid="toggle-group">Grouper A–Z</button>
        </div>
        <p className="text-xs text-muted-foreground" aria-live="polite">{list.length} sur {items.length} dinos{filtered && <button type="button" className="underline ml-2" onClick={reset}>Tout réinitialiser</button>}</p>
      </div>

      {grouped && letters.length > 1 && (
        <nav aria-label="Index alphabétique" className="flex flex-wrap gap-1">
           {letters.map((l) => <a key={l} href={`#dino-${l}`} onClick={(event) => {
             event.preventDefault();
             setLimit(list.length);
             requestAnimationFrame(() => document.getElementById(`dino-${l}`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
           }} className="h-8 w-8 grid place-items-center rounded-lg border border-white/10 text-xs font-bold hover:border-[#65D8FF] hover:text-[#9AEAFF]">{l}</a>)}
        </nav>
      )}

      {!list.length ? (
        <Empty title="Aucun dino ne correspond"><p>Essayez un autre nom ou retirez un filtre.</p>{filtered && <button type="button" className="btn btn-ghost btn-sm mt-3" onClick={reset}>Réinitialiser</button>}</Empty>
      ) : grouped ? (
        <div className="grid gap-5">
          {letters.map((l) => { const g = shown.filter((p) => letter(p) === l); if (!g.length) return null;
             return <section key={l} id={`dino-${l}`} className="grid gap-2 scroll-mt-[22rem] sm:scroll-mt-56" aria-label={`Lettre ${l}`}>
              <h2 className="display text-2xl text-[#9AEAFF] flex items-center gap-3">{l}<span className="rule-glow flex-1" /></h2>
              <ul className="grid gap-2 lg:grid-cols-2 items-start">{g.map(row)}</ul>
            </section>; })}
        </div>
      ) : <ul className="grid gap-2 lg:grid-cols-2 items-start">{shown.map(row)}</ul>}

      {list.length > limit && <button type="button" className="btn btn-ghost justify-self-center" onClick={() => setLimit(limit + PAGE)} data-testid="button-more-dinos">Afficher {Math.min(PAGE, list.length - limit)} dinos de plus</button>}
    </div>
  );
}

export default function Shop() {
  useSeo("Shop", "Le catalogue de la communauté Arki Family : dinos, packs et petit shop.");
  const { data: s, isLoading: sl } = useViewedSession();
  const uid = s?.user?.id ?? "";
  const qc = useQueryClient();
  const [category, setCategory] = useState("");
  const [light, setLight] = useState<{ src: string; title: string } | null>(null);
  const q = useGetShop({ query: { queryKey: [...getGetShopQueryKey(), uid], enabled: !!uid, staleTime: 60000, refetchInterval: 300000, refetchOnWindowFocus: true, retry: (n, e) => { const st = (e as { status?: number } | null)?.status; return st !== 401 && st !== 403 && n < 1; } } });
  useEffect(() => { if (!sl && !uid) qc.removeQueries({ queryKey: getGetShopQueryKey() }); }, [uid, sl, qc]);
  const d = q.data;
  const sections = d?.sections ?? [];
  const current = sections.find((x) => x.id === category) ?? sections.find((x) => !isInfo(x)) ?? sections[0];
  const open = (p: ShopProduct, i: number) => { const m = p.media[i]; const u = m && safeUrl(m.url); if (u) setLight({ src: u, title: p.name }); };

  if (sl) return <Skeletons n={2} />;
  if (!uid) return <Empty title="Connexion requise"><p>Le catalogue est réservé aux membres connectés.</p><Link href="/connexion" className="btn btn-primary mt-4" data-testid="link-shop-login">Connexion Discord</Link></Empty>;
  const denied = (q.error as { status?: number } | null)?.status;
  const cachedErr = q.isError && !!d;
  const partial = current?.error;

  return (
    <>
       <PageBanner kicker="Communauté" title="Shop" sub="Dinos, packs et petites offres : trouvez votre bonheur et commandez auprès du staff." image={IMG.highlands}>
        <div className="mt-4">
          <a href={safeUrl(d?.shopTicketUrl ?? "")} target="_blank" rel="noopener noreferrer" className={`btn btn-primary ${d ? "" : "opacity-50 pointer-events-none"}`} aria-disabled={!d} data-testid="link-shop-order">Passer commande au shop <ArrowUpRight className="h-4 w-4" aria-hidden="true" /></a>
          <p className="mt-2 text-xs text-muted-foreground">Ouvre le salon de tickets Discord pour passer votre commande.</p>
        </div>
      </PageBanner>
      <div className="grid gap-6 mt-6 min-w-0">
        {q.isLoading ? <Skeletons n={3} /> : denied === 401 || denied === 403 ? (
          <Empty title="Accès refusé"><p>Votre compte n'a pas accès au shop.</p></Empty>
        ) : !d ? <ErrorBox message={errMsg(q.error)} onRetry={() => q.refetch()} /> : (
          <>
            {cachedErr && <p className="panel text-sm border-destructive" role="alert" data-testid="warning-shop-cache">Actualisation impossible : ces données peuvent être dépassées. <button type="button" className="underline ml-1" onClick={() => q.refetch()}>Réessayer</button></p>}
            {sections.length && current ? (
              <>
                 <div className="flex items-start gap-3 border-b border-white/10 pb-3">
                   <div className="flex flex-wrap gap-2 flex-1 min-w-0" role="tablist" aria-label="Catégories du shop">
                     {sections.map((x) => <button key={x.id} type="button" role="tab" id={`tab-shop-${x.id}`} aria-selected={current.id === x.id} aria-controls={`panel-shop-${x.id}`} className="pill shrink-0" onClick={() => setCategory(x.id)} data-testid={`tab-shop-${x.id}`}>{x.title}<span className="opacity-70 text-xs">{x.products.length || ""}</span></button>)}
                   </div>
                   <Link href="/dons" className="pill !text-xs !px-3 !py-2 mt-0.5 shrink-0" data-testid="link-dons">Dons</Link>
                </div>
                <div role="tabpanel" id={`panel-shop-${current.id}`} aria-labelledby={`tab-shop-${current.id}`} key={current.id} className="rise grid gap-4" data-testid={`section-shop-${current.id}`}>
                  {partial && <p className="panel text-sm border-destructive" role="alert">Cette catégorie n'a pas pu être actualisée ; les informations affichées peuvent être légèrement anciennes.</p>}
                  {isDino(current) ? <DinoCatalogue items={current.products} onOpen={open} /> : isInfo(current) ? <InfoGroups items={current.products} /> : <OfferGrid items={current.products} onOpen={open} />}
                  <p className="text-xs text-muted-foreground/80">Catalogue mis à jour chaque jour · dernière synchro {when(current.lastSyncedAt)}</p>
                </div>
              </>
             ) : <Empty title="Catalogue vide">Aucune catégorie n'est disponible pour le moment.</Empty>}
          </>
        )}
      </div>
      {light && <Lightbox src={light.src} title={light.title} onClose={() => setLight(null)} />}
    </>
  );
}
