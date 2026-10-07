import { useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Power, Search } from "lucide-react";
import {
  getListDinoSpeciesQueryKey, getListSiteMapsQueryKey, getListSiteModsQueryKey, useCreateDinoSpecies, useListDinoSpecies, useListSiteMaps, useListSiteMods, useUpdateDinoSpecies,
  type DinoSpecies, type DinoSpeciesInput,
} from "@workspace/api-client-react";
import { useViewedSession } from "@/lib/owner-view";
import { Empty, ErrorBox, Skeletons } from "@/components/parts";
import { PageBanner } from "@/components/nexus";
import { CatalogueNotice } from "@/pages/mes-dinos";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { IMG } from "@/data/nexus";
import { errMsg, useSeo } from "@/lib/helpers";
import { isConflict, norm } from "@/lib/dino";
import { DinoVariantFilter, dinoVariant, type DinoVariant } from "@/components/dino-variant-filter";

type Form = { id: number | null; name: string; origin: "official" | "mod"; modId: number | null; maps: string[]; sourceUrl: string; active: boolean; revision: number };
const blank: Form = { id: null, name: "", origin: "official", modId: null, maps: [], sourceUrl: "", active: true, revision: 0 };

export default function MesDinosCatalogue() {
  useSeo("Catalogue des espèces", "Ajout d'espèces et de variantes par les administrateurs et propriétaires du site.");
  const s = useViewedSession();
  const owner = !!s.data?.isOwner;
  const staff = owner || !!s.data?.isAdmin;
  const csrf = s.data?.csrfToken ?? "";
  const qc = useQueryClient();
  const { toast } = useToast();
  const params = { all: true };
  const key = getListDinoSpeciesQueryKey(params);
  const speciesQ = useListDinoSpecies(params, { query: { enabled: staff, queryKey: key, staleTime: 15000, refetchInterval: 30000 } });
  const modsQ = useListSiteMods({ query: { enabled: staff, queryKey: getListSiteModsQueryKey(), staleTime: 15000 }, request: { headers: { "X-CSRF-Token": csrf } } });
  const mapsQ = useListSiteMaps({ query: { enabled: staff, queryKey: getListSiteMapsQueryKey(), staleTime: 15000 } });
  const create = useCreateDinoSpecies({ request: { headers: { "X-CSRF-Token": csrf } } });
  const update = useUpdateDinoSpecies({ request: { headers: { "X-CSRF-Token": csrf } } });
  const [q, setQ] = useState("");
  const [variant, setVariant] = useState<DinoVariant>("all");
  const [form, setForm] = useState<Form | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const busy = create.isPending || update.isPending;

  const refresh = () => { void qc.invalidateQueries({ queryKey: key }); void qc.invalidateQueries({ queryKey: getListDinoSpeciesQueryKey({}) }); };
  const fail = (e: unknown) => {
    if (isConflict(e)) { refresh(); setErr("Cette espèce a été modifiée entre-temps. La liste est rechargée : rouvrez la fiche."); }
    else setErr(errMsg(e));
    toast({ title: "Action impossible", description: isConflict(e) ? "Conflit de révision." : errMsg(e), variant: "destructive" });
  };
  const toInput = (f: Form | DinoSpecies): DinoSpeciesInput => ({ name: f.name.trim(), origin: f.origin, modId: f.origin === "mod" ? f.modId : null, maps: f.maps, sourceUrl: f.sourceUrl.trim(), active: f.active, revision: f.revision });

  const submit = () => {
    if (!form || !staff || (form.id !== null && !owner)) return;
    const input = toInput(form);
    if (!input.name) return setErr("Le nom est obligatoire.");
    if (!/^https:\/\/\S+$/.test(input.sourceUrl)) return setErr("La source doit être une URL https.");
    if (input.active && !input.maps.length) return setErr("Une espèce active doit être présente sur au moins une map.");
    if (input.origin === "mod" && input.modId === null) return setErr("Une espèce de mod doit être liée à un mod existant.");
    setErr(null);
    const onSuccess = () => { refresh(); setForm(null); if (form.id === null) { setQ(""); setVariant("all"); } toast({ title: form.id === null ? "Espèce ajoutée" : "Espèce mise à jour" }); };
    if (form.id === null) create.mutate({ data: { ...input, revision: 0 } }, { onSuccess, onError: fail });
    else update.mutate({ speciesId: form.id, data: input }, { onSuccess, onError: fail });
  };
  const toggle = (sp: DinoSpecies) => update.mutate({ speciesId: sp.id, data: { ...toInput(sp), active: !sp.active } }, {
    onSuccess: () => { refresh(); toast({ title: sp.active ? "Espèce désactivée" : "Espèce réactivée", description: "Les fiches des tribus sont conservées." }); },
    onError: fail,
  });

  const list = (speciesQ.data ?? []).filter((x) => (!q || norm(x.name).includes(norm(q))) && (variant === "all" || dinoVariant(x.name) === variant)).sort((a, b) => a.name.localeCompare(b.name, "fr"));
  const modName = (id: number | null) => modsQ.data?.find((m) => m.id === id)?.name ?? (id === null ? "—" : `Mod #${id}`);

  let body;
  if (s.isLoading) body = <Skeletons n={3} />;
  else if (!staff) body = (
    <Empty title="Réservé au staff">
      <p data-testid="text-catalogue-forbidden">{s.data?.user ? "Les administrateurs et propriétaires du site peuvent ajouter des espèces." : "Connectez-vous pour continuer."}</p>
      <Link href="/mes-dinos" className="btn btn-primary mt-4" data-testid="link-back-dinos">Retour au suivi</Link>
    </Empty>
  );
  else body = (
    <div className="grid gap-5">
      <CatalogueNotice />
      {!owner && <p className="text-sm text-muted-foreground">Vous pouvez ajouter une espèce ou une variante. Les propriétaires peuvent modifier ou désactiver les entrées existantes.</p>}
      <DinoVariantFilter id="select-catalogue-variant" value={variant} onChange={setVariant} />
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[14rem]">
          <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input type="search" className="field !pl-10" placeholder="Filtrer les espèces…" aria-label="Filtrer les espèces" value={q} onChange={(e) => setQ(e.target.value)} data-testid="input-catalogue-search" />
        </div>
        <button type="button" className="btn btn-primary" onClick={() => { setErr(null); setForm(blank); }} data-testid="button-species-add"><Plus className="h-4 w-4" aria-hidden /> Ajouter une espèce</button>
        <Link href="/mes-dinos" className="btn btn-ghost" data-testid="link-back-dinos">Retour au suivi</Link>
      </div>
      {speciesQ.isLoading ? <Skeletons n={4} /> : speciesQ.isError ? <ErrorBox message={errMsg(speciesQ.error)} onRetry={() => speciesQ.refetch()} /> : !list.length ? (
        <Empty title={speciesQ.data?.length ? "Aucune correspondance" : "Catalogue vide"}><p>{speciesQ.data?.length ? "Modifiez le filtre." : "Ajoutez une première espèce vérifiée."}</p></Empty>
      ) : (
        <ul className="grid gap-2" data-testid="list-catalogue">
          {list.map((x) => (
            <li key={x.id} className={`panel !p-3 flex flex-wrap items-center gap-3 ${x.active ? "" : "opacity-70"}`} data-testid={`row-species-${x.id}`}>
              <div className="flex-1 min-w-[12rem]">
                <b>{x.name}</b>
                <p className="text-xs text-muted-foreground">{x.origin === "mod" ? `Mod : ${modName(x.modId)}` : "Officielle"} · {x.maps.length ? x.maps.join(", ") : "aucune map"}</p>
              </div>
              <span className={`chip ${x.active ? "" : "!border-red-300/60"}`}>{x.active ? "Active" : "Désactivée"}</span>
              {owner && <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => { setErr(null); setForm({ ...x }); }} data-testid={`button-species-edit-${x.id}`}><Pencil className="h-3.5 w-3.5" aria-hidden /> Modifier</button>}
              {owner && <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => toggle(x)} data-testid={`button-species-toggle-${x.id}`}><Power className="h-3.5 w-3.5" aria-hidden /> {x.active ? "Désactiver" : "Réactiver"}</button>}
            </li>
          ))}
        </ul>
      )}
      <Dialog open={!!form} onOpenChange={(o) => { if (!o && !busy) setForm(null); }}>
        <DialogContent className="max-w-xl max-h-[90dvh] overflow-y-auto" data-testid="dialog-species">
          <DialogHeader>
            <DialogTitle>{form?.id === null ? "Ajouter une espèce" : "Modifier l'espèce"}</DialogTitle>
            <DialogDescription>{owner ? "Une espèce désactivée conserve les fiches privées des tribus." : "Vérifiez le nom, la source et les maps avant d'ajouter cette espèce au choix des joueurs."}</DialogDescription>
          </DialogHeader>
          {form && (
            <div className="grid gap-3">
              <div><label className="lbl" htmlFor="sp-name">Nom de l'espèce ou de la variante</label><input id="sp-name" className="field" maxLength={120} placeholder="Ex. Tek Rex, Aberrant Raptor, X-Argentavis…" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="input-species-name" /><p className="text-xs text-muted-foreground mt-1">Chaque variante doit avoir son propre nom pour garder des records distincts.</p></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="lbl" htmlFor="sp-origin">Origine</label>
                  <select id="sp-origin" className="field" value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value as Form["origin"], modId: null })} data-testid="select-species-origin"><option value="official">Officielle</option><option value="mod">Mod</option></select></div>
                {form.origin === "mod" && (
                  <div><label className="lbl" htmlFor="sp-mod">Mod lié</label>
                    <select id="sp-mod" className="field" value={form.modId ?? ""} onChange={(e) => setForm({ ...form, modId: e.target.value ? Number(e.target.value) : null })} data-testid="select-species-mod">
                      <option value="">Choisir…</option>{modsQ.data?.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                    {modsQ.isError && <p className="text-xs text-destructive mt-1">Liste des mods indisponible.</p>}
                  </div>
                )}
              </div>
              <div><label className="lbl" htmlFor="sp-src">Source (https)</label><input id="sp-src" className="field" maxLength={600} inputMode="url" placeholder="https://www.dododex.com/…" value={form.sourceUrl} onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })} data-testid="input-species-source" /></div>
              <fieldset>
                <legend className="lbl">Maps où l'espèce est présente</legend>
                {mapsQ.isLoading ? <Skeletons n={1} /> : mapsQ.isError ? <ErrorBox message={errMsg(mapsQ.error)} onRetry={() => mapsQ.refetch()} /> : (
                  <div className="flex flex-wrap gap-2">
                    {mapsQ.data?.map((m) => {
                      const on = form.maps.includes(m.slug);
                      return (
                        <label key={m.slug} className={`pill ${on ? "!border-primary" : ""}`}>
                          <input type="checkbox" className="accent-[#65D8FF]" checked={on} onChange={() => setForm({ ...form, maps: on ? form.maps.filter((x) => x !== m.slug) : [...form.maps, m.slug] })} data-testid={`checkbox-map-${m.slug}`} />{m.name}
                        </label>
                      );
                    })}
                  </div>
                )}
              </fieldset>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-[#65D8FF]" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} data-testid="checkbox-species-active" /> Active (proposée aux joueurs)</label>
              {err && <p className="text-sm text-destructive" role="alert" data-testid="text-species-error">{err}</p>}
            </div>
          )}
          <DialogFooter className="gap-2">
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setForm(null)} data-testid="button-species-cancel">Annuler</button>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={submit} data-testid="button-species-save">{busy ? "Enregistrement…" : "Enregistrer"}</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
  return (
    <>
      <PageBanner kicker="Staff" title="Catalogue des espèces" sub="Ajout manuel d'espèces et de variantes · édition par les propriétaires." image={IMG.mySpace} />
      {body}
    </>
  );
}
