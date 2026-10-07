import { useState } from "react";
import { Link } from "wouter";
import { useAddOption, useGetOptions, useRemoveOption, type OptionInput } from "@workspace/api-client-react";
import { useViewedSession as useGetSession, useOwnerView, OwnerViewToggle } from "@/lib/owner-view";
import { useQueryClient } from "@tanstack/react-query";
import { getGetOptionsQueryKey } from "@workspace/api-client-react";
import { Empty, ErrorBox, PageTitle, Skeletons, Confirm } from "@/components/parts";
import { errMsg, useSeo, useWrite } from "@/lib/helpers";
import { BrandingPanel } from "@/components/branding-panel";
import { MapsPanel } from "@/components/maps-panel";
import { SiteAccessPanel } from "@/components/site-access-panel";
import { TribeReviewPanel } from "@/components/tribe-review-panel";

const KINDS: { kind: OptionInput["kind"]; title: string }[] = [
  { kind: "maps", title: "Cartes" },
  { kind: "premiumMaps", title: "Cartes premium" },
  { kind: "boss", title: "Boss" },
  { kind: "notes", title: "Notes" },
];

export default function Admin() {
  useSeo("Administration", "Gestion des listes de cartes, boss et notes.");
  const s = useGetSession();
  const view = useOwnerView();
  const opts = useGetOptions();
  const qc = useQueryClient();
  const w = useWrite(undefined, "Liste mise à jour");
  const mut = {
    request: w.request,
    mutation: {
      onError: w.mutation.onError,
      onSuccess: () => {
        w.mutation.onSuccess();
        qc.invalidateQueries({ queryKey: getGetOptionsQueryKey() });
        qc.invalidateQueries({ predicate: (q) => String(q.queryKey[0]) === "/api/options" });
      },
    },
  };
  const add = useAddOption(mut);
  const remove = useRemoveOption(mut);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  if (s.isLoading) return <Skeletons n={2} />;
  if (view.isOwner && view.playerView) return (
    <>
      <PageTitle kicker="Aperçu joueur" title="Administration">Les outils de gestion sont masqués dans cette vision.</PageTitle>
      <OwnerViewToggle />
      <Link href="/" className="btn btn-ghost">Voir le site en vision joueur</Link>
    </>
  );
  if (!s.data?.isAdmin)
    return <Empty title="Accès réservé">Cette section est réservée aux administrateurs.</Empty>;
  return (
    <>
      <PageTitle kicker="Réservé" title="Administration">Contrôle des tribus et gestion du site.</PageTitle>
      <OwnerViewToggle />
      <div className="mb-6 flex flex-wrap gap-2">
        <Link href="/administration/commandes" className="btn btn-ghost btn-sm">Commandes ArkiFamily · lecture seule</Link>
        <Link href="/catalogue-arkifamily" className="btn btn-ghost btn-sm">Catalogue ArkiFamily</Link>
      </div>
      <TribeReviewPanel />
      {s.data.isOwner && <BrandingPanel />}
      {s.data.isOwner && <MapsPanel />}
      {s.data.isOwner && <SiteAccessPanel />}
      {opts.isLoading ? <Skeletons n={4} /> : opts.isError || !opts.data ? <ErrorBox message={errMsg(opts.error)} onRetry={() => opts.refetch()} /> : (
        <div className="grid md:grid-cols-2 gap-6">
          {KINDS.map(({ kind, title }) => (
            <section key={kind} className="panel" data-testid={`section-${kind}`}>
              <h2 className="text-2xl font-bold text-primary mb-3">{title}</h2>
              <div className="flex flex-wrap gap-2 mb-4">
                {opts.data[kind].length === 0 && <p className="text-sm text-muted-foreground">Liste vide.</p>}
                {opts.data[kind].map((n) => (
                  <span key={n} className="chip !text-sm">
                    {n}
                    <Confirm label="Retirer" title={`Retirer « ${n} » ?`} description="Cette valeur ne sera plus proposée dans les fiches." confirmLabel="Retirer" testid={`button-remove-${kind}-${n}`} className="underline text-destructive" onConfirm={() => remove.mutate({ data: { kind, name: n } })} />
                  </span>
                ))}
              </div>
              <form className="flex gap-2" onSubmit={(e) => {
                e.preventDefault();
                const name = (drafts[kind] ?? "").trim();
                if (!name) return;
                add.mutate({ data: { kind, name } }, { onSuccess: () => setDrafts((d) => ({ ...d, [kind]: "" })) });
              }}>
                <input className="field" maxLength={80} placeholder="Nouvelle valeur" aria-label={`Ajouter ${title}`} data-testid={`input-add-${kind}`} value={drafts[kind] ?? ""} onChange={(e) => setDrafts((d) => ({ ...d, [kind]: e.target.value }))} />
                <button className="btn btn-primary" disabled={add.isPending} data-testid={`button-add-${kind}`}>Ajouter</button>
              </form>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
