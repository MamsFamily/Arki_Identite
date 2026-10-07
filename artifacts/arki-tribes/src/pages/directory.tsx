import { useEffect, useState } from "react";
import { useGetOptions, useListTribes, type ListTribesParams } from "@workspace/api-client-react";
import { Link } from "wouter";
import { DevNotice, Empty, ErrorBox, PageTitle, Skeletons, TribeCard } from "@/components/parts";
import { errMsg, useSeo } from "@/lib/helpers";

export default function Directory() {
  useSeo("Annuaire des tribus", "Retrouvez votre tribu ARK francophone : recherche par nom, carte et recrutement.");
  const [q, setQ] = useState(() => new URLSearchParams(window.location.search).get("q") ?? "");
  const [dq, setDq] = useState(() => (new URLSearchParams(window.location.search).get("q") ?? "").trim());
  const [map, setMap] = useState("");
  const [rec, setRec] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDq(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);
  const params: ListTribesParams = { ...(dq ? { q: dq } : {}), ...(map ? { map } : {}), ...(rec ? { recruiting: true } : {}) };
  const list = useListTribes(params);
  const opts = useGetOptions();
  return (
    <>
      <PageTitle kicker="Annuaire / communauté" title="Trouvez votre tribu">
        L'annuaire public de la communauté ARK francophone. Parcourez les fiches, trouvez une tribu qui recrute.
      </PageTitle>
      <DevNotice />
      <div className="panel mb-6 flex flex-wrap items-center gap-3" data-testid="panel-guide">
        <p className="flex-1 min-w-[16rem] text-sm">Pour retrouver votre tribu, tapez son nom ci-dessous. Vos propres tribus sont dans « Mon espace ».</p>
        <Link href="/mon-espace" className="btn btn-primary btn-sm" data-testid="link-guide-mine">Mon espace</Link>
        <Link href="/creer" className="btn btn-ghost btn-sm" data-testid="link-guide-create">Créer une tribu</Link>
      </div>
      <div className="panel mb-6 grid md:grid-cols-[1fr_220px_auto] gap-3 items-end">
        <div>
          <label className="lbl" htmlFor="q">Rechercher</label>
          <input id="q" type="search" data-testid="input-search" className="field" placeholder="Nom, devise, étiquette" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div>
          <label className="lbl" htmlFor="m">Carte</label>
          <select id="m" data-testid="select-filter-map" className="field" value={map} onChange={(e) => setMap(e.target.value)}>
            <option value="">Toutes</option>
            {opts.data?.maps.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 font-bold pb-2">
          <input type="checkbox" data-testid="checkbox-filter-recruiting" checked={rec} onChange={(e) => setRec(e.target.checked)} />
          Recrute
        </label>
      </div>
      {list.isLoading ? <Skeletons /> : list.isError ? (
        <ErrorBox message={errMsg(list.error)} onRetry={() => list.refetch()} />
      ) : !list.data || list.data.length === 0 ? (
        <Empty title="Aucune tribu trouvée">
          <p>Essayez un autre nom ou retirez les filtres. Vérifiez qu'elle n'existe pas avant d'en créer une.</p>
          {(q || map || rec) && <button className="btn btn-ghost btn-sm mt-3" data-testid="button-reset-filters" onClick={() => { setQ(""); setMap(""); setRec(false); }}>Effacer les filtres</button>}
        </Empty>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{list.data.map((t) => <TribeCard key={t.id} t={t} />)}</div>
      )}
    </>
  );
}
