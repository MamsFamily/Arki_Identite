import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { getListSiteModsQueryKey, useListSiteMods, useCreateSiteMod, useUpdateSiteMod, useDeleteSiteMod, type SiteMod, type SiteModInput } from "@workspace/api-client-react";
import { useViewedSession as useGetSession } from "@/lib/owner-view";
import { FilterBar, ModCard, PageBanner, Reveal } from "@/components/nexus";
import { Confirm, Empty, ErrorBox, Skeletons } from "@/components/parts";
import { ModEditor } from "@/components/mod-editor";
import { IMG, MOD_FILTERS } from "@/data/nexus";
import { errMsg, useSeo, useWrite } from "@/lib/helpers";

export default function Mods() {
  useSeo("Nos Mods", "Les mods qui enrichissent l'expérience du cluster Arki Family.");
  const [f, setF] = useState("Tous");
  const [q, setQ] = useState("");
  const s = useGetSession();
  const owner = !!s.data?.isOwner;
  const mods = useListSiteMods({ query: { queryKey: getListSiteModsQueryKey(), refetchInterval: 30000, staleTime: 0 } });
  const qc = useQueryClient();
  const w = useWrite(undefined, "Catalogue des mods mis à jour");
  const options = { request: w.request, mutation: { onError: w.mutation.onError } };
  const create = useCreateSiteMod(options);
  const update = useUpdateSiteMod(options);
  const remove = useDeleteSiteMod(options);
  const [editing, setEditing] = useState<SiteMod | "new" | null>(null);
  const busy = create.isPending || update.isPending || remove.isPending;
  const list = useMemo(() => (mods.data ?? []).filter((m) => (f === "Tous" || m.category === f) && m.name.toLowerCase().includes(q.trim().toLowerCase())), [mods.data, f, q]);
  const saved = () => {
    qc.invalidateQueries({ queryKey: getListSiteModsQueryKey() });
    setEditing(null);
    w.mutation.onSuccess();
  };
  const save = (data: SiteModInput) => {
    if (editing && editing !== "new") update.mutate({ id: editing.id, data }, { onSuccess: saved });
    else create.mutate({ data }, { onSuccess: saved });
  };
  return (
    <>
      <PageBanner kicker="Le Nexus" title="Nos Mods" sub="Les mods qui enrichissent l’expérience du cluster Arki Family." image={IMG.crystal} />
      {owner && <div className="glass p-4 mb-6 flex flex-wrap items-center justify-between gap-3"><p className="text-sm">En tant que propriétaire, vous pouvez ajouter, modifier et supprimer les mods.</p><button type="button" className="btn btn-primary" onClick={() => setEditing("new")} disabled={busy} data-testid="button-add-mod">Ajouter un mod</button></div>}
      {owner && editing && <ModEditor key={editing === "new" ? "new" : editing.id} mod={editing === "new" ? null : editing} busy={busy} onSave={save} onCancel={() => setEditing(null)} />}
      <FilterBar filters={MOD_FILTERS.map((k) => ({ key: k, label: k }))} value={f} onChange={setF} query={q} onQuery={setQ} placeholder="Rechercher un mod…" />
      {mods.isLoading ? <Skeletons n={3} /> : mods.isError ? <ErrorBox message={errMsg(mods.error)} onRetry={() => mods.refetch()} /> : list.length === 0 ? <Empty title={mods.data?.length ? "Aucun mod trouvé" : "Aucun mod enregistré"}><button className="btn btn-ghost btn-sm" onClick={() => { setF("Tous"); setQ(""); }}>Réinitialiser les filtres</button></Empty> : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{list.map((m, i) => <Reveal key={m.id} delay={(i % 3) * 70}>
          <div className="grid gap-2">
            <ModCard mod={{ ...m, badge: m.category, sourceUrl: m.sourceUrl || undefined }} />
            {owner && <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(m)} disabled={busy} data-testid={`button-edit-mod-${m.id}`}>Modifier</button>
              <Confirm label="Supprimer" title={`Supprimer ${m.name} ?`} description="Ce mod sera retiré du catalogue du site. Cela ne désinstalle rien sur le serveur de jeu." confirmLabel="Supprimer le mod" onConfirm={() => remove.mutate({ id: m.id }, { onSuccess: saved })} disabled={busy} testid={`button-delete-mod-${m.id}`} />
            </div>}
          </div>
        </Reveal>)}</div>
      )}
      <p className="mt-6 text-xs text-muted-foreground">Les modifications concernent uniquement le catalogue du site, pas les mods installés sur le serveur. Les anciennes fiches sont conservées pour correction.</p>
    </>
  );
}
