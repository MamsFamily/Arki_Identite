import { useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import { getGetSiteMapQueryKey, getListSiteMapsQueryKey, useGetSiteMap, useListSiteMaps } from "@workspace/api-client-react";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { DemoTag, FilterBar, Gallery, MapCard, PageBanner, Reveal, Tabs } from "@/components/nexus";
import { Empty, ErrorBox, Skeletons } from "@/components/parts";
import { MapCartography, SettlementCount } from "@/components/map-cartography";
import { MapBosses } from "@/components/map-bosses";
import { MapEditButton } from "@/components/map-editor";
import { IMG, KIND_LABEL, MAP_FILTERS, type MapKind } from "@/data/nexus";
import { initialMapTab } from "@/lib/map-coordinates";
import { errMsg, useSeo } from "@/lib/helpers";

export function MapsPage() {
  useSeo("Nos Maps", "Les univers du cluster Arki Family : maps principales, premium et événement.");
  const [f, setF] = useState<"all" | MapKind>("all");
  const [q, setQ] = useState("");
  const q0 = useListSiteMaps({ query: { queryKey: getListSiteMapsQueryKey(), staleTime: 15000, refetchInterval: 30000 } });
  const list = useMemo(() => (q0.data ?? []).filter((m) => (f === "all" || m.kind === f) && m.name.toLowerCase().includes(q.trim().toLowerCase())), [q0.data, f, q]);
  return (
    <>
      <PageBanner kicker="Le cluster" title="Nos Maps" sub={`${q0.data ? q0.data.length + " univers" : "Des univers"} à explorer. Chaque map offre une ambiance unique, ses propres défis et ses règles spécifiques.`} image={IMG.landscape} />
      <FilterBar filters={MAP_FILTERS} value={f} onChange={setF} query={q} onQuery={setQ} placeholder="Rechercher une map…" />
      {q0.isLoading ? <Skeletons n={4} /> : q0.isError ? <ErrorBox message={errMsg(q0.error)} onRetry={() => q0.refetch()} /> : list.length === 0 ? (
        <Empty title="Aucune map trouvée"><button className="btn btn-ghost btn-sm mt-2" onClick={() => { setF("all"); setQ(""); }}>Réinitialiser</button></Empty>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
          {list.map((m, i) => <Reveal key={m.slug} delay={(i % 4) * 60}><MapCard map={m} /></Reveal>)}
        </div>
      )}
      <p className="mt-6 flex items-center gap-2 text-xs text-muted-foreground"><DemoTag>Illustration</DemoTag> Visuels et fiches d’illustration. Statuts et joueurs connectés non reliés au serveur.</p>
    </>
  );
}

const TABS = [
  { key: "overview", label: "Aperçu" }, { key: "bosses", label: "Boss" }, { key: "creatures", label: "Créatures" }, { key: "zones", label: "Zones clés" },
  { key: "rules", label: "Règles spécifiques" }, { key: "gallery", label: "Galerie" }, { key: "residents", label: "Carte et résidents" },
] as const;

export function MapDetail() {
  const { slug } = useParams();
  const q = useGetSiteMap(slug ?? "", { query: { queryKey: getGetSiteMapQueryKey(slug ?? ""), enabled: !!slug, staleTime: 15000, refetchInterval: 30000 } });
  const map = q.data;
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>(() => initialMapTab(window.location.search));
  useSeo(map ? map.name : "Map introuvable", map ? map.blurb : "Cette map n'existe pas.");
  if (q.isLoading) return <Skeletons n={3} />;
  if (q.isError && (q.error as { status?: number }).status !== 404) return <ErrorBox message={errMsg(q.error)} onRetry={() => q.refetch()} />;
  if (!map) return <Empty title="Map introuvable"><Link href="/maps" className="btn btn-primary mt-3">Toutes les maps</Link></Empty>;
  const facts: [string, React.ReactNode][] = [
    ["Taille", map.size], ["Biomes", map.biomes],
    ["Difficulté", <span key="d" className="dots" aria-label={`${map.difficulty} sur 5`}>{[1, 2, 3, 4, 5].map((n) => <i key={n} className={n <= map.difficulty ? "on" : ""} />)}</span>],
    ["Transferts", map.transfers], ["Créatures spéciales", map.specials],
  ];
  const listOf = (items: string[]) => <ul className="grid sm:grid-cols-2 gap-3">{items.map((x) => <li key={x} className="glass p-4 text-sm">{x}</li>)}</ul>;
  return (
    <>
      <Link href="/maps" className="inline-flex items-center gap-2 text-sm font-bold text-primary mb-4" data-testid="link-back-maps"><ArrowLeft className="h-4 w-4" /> Toutes les maps</Link>
      <div className="grid lg:grid-cols-[1fr_320px] gap-5 mb-8">
        <div className="nx-banner !mb-0 !min-h-[300px] lg:!min-h-[380px]">
          {map.image && <img src={map.image} alt="" />}
          <div className="p-6 sm:p-10">
            <span className={`chip ${map.kind === "event" ? "!border-[#FFA078] !text-[#FFA078]" : ""}`}>{KIND_LABEL[map.kind]}</span>
            <h1 className="nx-h1 uppercase mt-3" data-testid="text-map-name">{map.name}</h1>
            <p className="mt-3 text-sm text-[#c9d4e4] max-w-lg">{map.blurb}</p>
            <div className="mt-4"><MapEditButton map={map} /></div>
          </div>
        </div>
        <aside className="glass p-5">
          <h2 className="eyebrow mb-3 !font-sans">Caractéristiques</h2>
          <dl className="grid gap-3">
            {facts.map(([k, v]) => <div key={k} className="flex justify-between gap-3 border-b border-white/5 pb-2 text-sm"><dt className="text-muted-foreground">{k}</dt><dd className="font-bold text-right">{v}</dd></div>)}
          </dl>
          <p className="text-[.7rem] text-muted-foreground mt-3">25 places par map (réglage du cluster).</p>
        </aside>
      </div>
       <section className="glass p-4 mb-5 flex flex-wrap items-center gap-3" aria-label="Localisation des ressources et dinos" data-testid="map-location-links">
         <h2 className="text-sm font-bold mr-auto">Ressources et dinos de la map</h2>
         {map.resourcesUrl && <a href={map.resourcesUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm" data-testid="link-map-resources">Localiser les ressources <ExternalLink className="h-4 w-4" aria-hidden="true" /><span className="sr-only"> — nouvel onglet</span></a>}
         {map.dinosUrl && <a href={map.dinosUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm" data-testid="link-map-dinos">Localiser les dinos <ExternalLink className="h-4 w-4" aria-hidden="true" /><span className="sr-only"> — nouvel onglet</span></a>}
         {!map.resourcesUrl && !map.dinosUrl && <p className="text-xs text-muted-foreground">Aucun lien de localisation renseigné.</p>}
       </section>
       <Tabs tabs={TABS} value={tab} onChange={setTab} label="Sections de la map" />
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "overview" && <div className="glass p-6 grid gap-3"><h2 className="text-xl uppercase">À propos de {map.name}</h2><p className="text-[#c9d4e4] max-w-3xl whitespace-pre-line">{map.description || "Aucune description renseignée."}</p></div>}
        {tab === "overview" && <SettlementCount slug={map.slug} onOpen={() => setTab("residents")} />}
        {tab === "residents" && <MapCartography key={map.slug} slug={map.slug} mapName={map.name} />}
        {tab === "bosses" && <MapBosses key={map.slug} slug={map.slug} mapName={map.name} />}
        {tab === "creatures" && listOf(map.creatures)}
        {tab === "zones" && listOf(map.zones)}
        {tab === "rules" && <ul className="glass p-6 grid gap-3 list-disc pl-10 text-sm text-[#c9d4e4]">{map.rules.map((r) => <li key={r}>{r}</li>)}</ul>}
        {tab === "gallery" && (map.image || map.gallery.length ? <Gallery images={Array.from(new Set([map.image, ...map.gallery].filter(Boolean)))} labels={map.name} /> : <p className="glass p-6 text-muted-foreground">Aucune photo dans cette galerie.</p>)}
      </div>
    </>
  );
}
