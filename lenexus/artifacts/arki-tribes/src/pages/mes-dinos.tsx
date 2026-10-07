import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, History, Info, Loader2, Search, Trash2, TriangleAlert, X } from "lucide-react";
import {
  getListDinoHistoryQueryKey, getListDinoRecordsQueryKey, getListDinoSpeciesQueryKey, getListTribesQueryKey,
  useDeleteDinoRecord, useListDinoHistory, useListDinoRecords, useListDinoSpecies, useListTribes, useSaveDinoRecord,
  type DinoRecord, type DinoSpecies, type DinoStats,
} from "@workspace/api-client-react";
import { useViewedSession } from "@/lib/owner-view";
import { Empty, ErrorBox, Skeletons } from "@/components/parts";
import { PageBanner } from "@/components/nexus";
import { CompareTable, DirBadge, StatGrid } from "@/components/dino-compare";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { IMG } from "@/data/nexus";
import { errMsg, fmtDate, useSeo } from "@/lib/helpers";
import { STAT_KEYS, STAT_LABELS, direction, draftToStats, emptyDraft, hasAnyStat, isConflict, norm, show, type Draft } from "@/lib/dino";
import { DinoVariantFilter, dinoVariant, type DinoVariant } from "@/components/dino-variant-filter";
import { readLocalDinoPhoto } from "@/lib/dino-photo-local";
import type { LocalPhotoResult } from "@/lib/dino-photo-parser";

export function CatalogueNotice() {
  return (
    <p className="flex gap-2 text-xs text-muted-foreground rounded-xl border border-dashed border-border p-3" data-testid="text-catalogue-notice">
      <Info className="h-4 w-4 shrink-0 text-primary" aria-hidden />
      <span>Catalogue vérifié le 04/10/2026 avec Dododex et ARK Wiki : espèces de base et variantes Tek, A (aberrantes), X et R, avec des fiches distinctes. Les associations aux maps restent indicatives, héritées de l'espèce de base pour les variantes : à vérifier selon les spawns et mods du serveur. Le staff peut ajouter une espèce manquante.</span>
    </p>
  );
}

function fileToImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error("Lecture du fichier impossible."));
    r.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Image illisible."));
      img.onload = () => {
        const scale = Math.min(1, 2200 / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
        const ctx = c.getContext("2d");
        if (!ctx) return reject(new Error("Conversion impossible."));
        ctx.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/jpeg", 0.9));
      };
      img.src = String(r.result);
    };
    r.readAsDataURL(file);
  });
}

type Confirm = { stats: DinoStats; existing: DinoRecord | null };

export default function MesDinos() {
  useSeo("Suivi de mes dinos", "Fiche de points de base par espèce pour votre tribu ARK Survival Ascended.");
  const s = useViewedSession();
  const user = s.data?.user;
  const csrf = s.data?.csrfToken ?? "";
  const headers = { "X-CSRF-Token": csrf };
  const qc = useQueryClient();
  const { toast } = useToast();

  const tribes = useListTribes({ mine: true }, { query: { enabled: !!user, queryKey: [...getListTribesQueryKey({ mine: true }), user?.id] } });
  const [tribeId, setTribeId] = useState<number | null>(null);
  const [speciesId, setSpeciesId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [variant, setVariant] = useState<DinoVariant>("all");
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [note, setNote] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoRes, setPhotoRes] = useState<LocalPhotoResult | null>(null);
  const [photoProgress, setPhotoProgress] = useState("");
  const [photoErr, setPhotoErr] = useState<string | null>(null);
  const [photoPreparing, setPhotoPreparing] = useState(false);
  const [fromPhoto, setFromPhoto] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [mode, setMode] = useState<"best" | "replace">("best");
  const [conflict, setConflict] = useState(false);
  const [pending, setPending] = useState<(() => void) | null>(null);
  const [delOpen, setDelOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const photoToken = useRef(0);
  const photoAbort = useRef<AbortController | null>(null);
  useEffect(() => () => { photoToken.current++; photoAbort.current?.abort(); }, []);
  useEffect(() => {
    // A local OCR job is not a React Query mutation: explicitly cancel it and
    // clear its private draft when the signed-in identity changes.
    photoToken.current++;
    photoAbort.current?.abort();
    setPhotoPreparing(false); setPhotoProgress(""); setPhotoUrl(null);
    setPhotoRes(null); setPhotoErr(null); setFromPhoto(false);
    setDraft(emptyDraft()); setNote(null); setConfirm(null);
    setTribeId(null); setSpeciesId(null); setPending(null);
  }, [user?.id]);

  useEffect(() => {
    if (tribeId === null && tribes.data?.length) setTribeId(tribes.data[0].id);
  }, [tribes.data, tribeId]);

  const speciesQ = useListDinoSpecies({}, { query: { enabled: !!user, queryKey: getListDinoSpeciesQueryKey({}), staleTime: 15000, refetchInterval: 30000 } });
  const recordsQ = useListDinoRecords(tribeId ?? 0, { query: { enabled: !!tribeId && !!user, queryKey: [...getListDinoRecordsQueryKey(tribeId ?? 0), user?.id], staleTime: 15000, refetchInterval: 30000 } });
  const historyQ = useListDinoHistory(tribeId ?? 0, { query: { enabled: !!tribeId && !!user && showHistory, queryKey: [...getListDinoHistoryQueryKey(tribeId ?? 0), user?.id], staleTime: 15000, refetchInterval: 30000 } });

  const save = useSaveDinoRecord({ request: { headers } });
  const del = useDeleteDinoRecord({ request: { headers } });
  const photoBusy = photoPreparing;
  const busy = photoBusy || save.isPending || del.isPending;

  const records = recordsQ.data ?? [];
  const recordOf = (id: number) => records.find((r) => r.species.id === id) ?? null;
  const rows = useMemo(() => {
    const map = new Map<number, DinoSpecies>();
    (speciesQ.data ?? []).forEach((x) => map.set(x.id, x));
    (recordsQ.data ?? []).forEach((r) => map.set(r.species.id, r.species));
    const q = norm(search);
    return [...map.values()].filter((x) => (!q || norm(x.name).includes(q)) && (variant === "all" || dinoVariant(x.name) === variant)).sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }, [speciesQ.data, recordsQ.data, search, variant]);

  const species = speciesId === null ? null : recordOf(speciesId)?.species ?? speciesQ.data?.find((x) => x.id === speciesId) ?? null;
  const record = speciesId === null ? null : recordOf(speciesId);
  const tribe = tribes.data?.find((t) => t.id === tribeId);
  const dirty = STAT_KEYS.some((k) => draft[k].trim() !== "") || !!photoUrl || (note !== null && note !== (record?.note ?? ""));

  const resetDraft = () => {
    photoToken.current++;
    photoAbort.current?.abort();
    setDraft(emptyDraft()); setNote(null); setPhotoUrl(null); setPhotoRes(null); setPhotoErr(null); setPhotoPreparing(false); setFromPhoto(false); setFormErr(null); setConflict(false);
  };
  const guard = (fn: () => void) => {
    if (busy) return;
    if (dirty) setPending(() => fn); else { resetDraft(); fn(); }
  };

  const onPhoto = async (file: File | undefined) => {
    if (busy || !file || !tribeId || speciesId === null) return;
    setPhotoErr(null);
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return setPhotoErr("Format refusé : JPG, PNG ou WEBP uniquement.");
    if (file.size > 6 * 1024 * 1024) return setPhotoErr("Photo trop lourde : 6 Mo maximum.");
    const token = ++photoToken.current;
    photoAbort.current?.abort();
    const controller = new AbortController();
    photoAbort.current = controller;
    setPhotoPreparing(true);
    setPhotoProgress("Préparation de la photo…");
    try {
      const url = await fileToImage(file);
      if (token !== photoToken.current) return;
      setPhotoUrl(url); setPhotoRes(null);
      // Read the original file, not the compressed JPEG kept for the preview.
      const original = URL.createObjectURL(file);
      let res: LocalPhotoResult;
      try {
        res = await readLocalDinoPhoto(original, speciesQ.data ?? [], value => {
          if (token === photoToken.current) setPhotoProgress(value);
        }, controller.signal);
      } finally { URL.revokeObjectURL(original); }
      if (token !== photoToken.current) return;
      setPhotoRes(res);
      // Preserve manual entries; the OCR fills only empty fields.
      const filled = STAT_KEYS.filter(k => res.stats[k] !== null && !draft[k].trim());
      setDraft(d => { const n = { ...d }; for (const k of filled) n[k] = String(res.stats[k]); return n; });
      if (filled.length) setFromPhoto(true);
    } catch (e) {
      if (token === photoToken.current) setPhotoErr(errMsg(e));
    } finally {
      if (token === photoToken.current) setPhotoPreparing(false);
    }
  };

  const askSave = () => {
    const { stats, error } = draftToStats(draft);
    if (error) return setFormErr(error);
    if (!hasAnyStat(stats)) return setFormErr("Renseignez au moins un stat : un champ vide reste inconnu, il n'est jamais enregistré à 0.");
    setFormErr(null); setMode("best"); setConfirm({ stats, existing: record });
  };

  const doSave = () => {
    if (!confirm || !tribeId || speciesId === null) return;
    save.mutate({ id: tribeId, speciesId, data: { stats: confirm.stats, revision: confirm.existing?.revision ?? 0, confirmed: true, mode: confirm.existing ? mode : "replace", note: note ?? record?.note ?? "", source: fromPhoto ? "photo" : "manual" } }, {
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: getListDinoRecordsQueryKey(tribeId) });
        void qc.invalidateQueries({ queryKey: getListDinoHistoryQueryKey(tribeId) });
        setConfirm(null); resetDraft();
        toast({ title: "Fiche enregistrée", description: species?.name });
      },
      onError: (e) => {
        setConfirm(null);
        if (isConflict(e)) {
          setConflict(true);
          void qc.invalidateQueries({ queryKey: getListDinoRecordsQueryKey(tribeId) });
          toast({ title: "Fiche modifiée entre-temps", description: "Votre saisie est conservée. Rechargez la comparaison puis confirmez à nouveau.", variant: "destructive" });
        } else toast({ title: "Enregistrement impossible", description: errMsg(e), variant: "destructive" });
      },
    });
  };

  const doDelete = () => {
    if (!tribeId || speciesId === null || !record) return;
    del.mutate({ id: tribeId, speciesId, data: { revision: record.revision, confirmed: true } }, {
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: getListDinoRecordsQueryKey(tribeId) });
        void qc.invalidateQueries({ queryKey: getListDinoHistoryQueryKey(tribeId) });
        setDelOpen(false); resetDraft();
        toast({ title: "Fiche supprimée", description: "L'espèce reste dans le catalogue." });
      },
      onError: (e) => { setDelOpen(false); toast({ title: "Suppression impossible", description: errMsg(e), variant: isConflict(e) ? "default" : "destructive" }); if (isConflict(e)) void qc.invalidateQueries({ queryKey: getListDinoRecordsQueryKey(tribeId) }); },
    });
  };

  const draftStats = draftToStats(draft).stats;
  const unavailable = !!species && !species.active;

  const body = s.isLoading || tribes.isLoading ? <Skeletons n={3} /> : s.isError ? <ErrorBox message={errMsg(s.error)} onRetry={() => s.refetch()} /> : !user ? (
    <Empty title="Connexion requise">
      <p>Connectez-vous avec Discord pour consulter les fiches de votre tribu.</p>
      <Link href="/connexion" className="btn btn-primary mt-4" data-testid="link-dinos-login">Se connecter avec Discord</Link>
    </Empty>
  ) : tribes.isError ? <ErrorBox message={errMsg(tribes.error)} onRetry={() => tribes.refetch()} /> : !tribes.data?.length ? (
    <Empty title="Aucune tribu liée à votre compte">
      <p className="max-w-lg mx-auto" data-testid="text-dinos-no-tribe">Les fiches appartiennent à une tribu. Retrouvez la vôtre dans l'annuaire ou signalez-le au staff si elle manque.</p>
      <Link href="/tribus" className="btn btn-primary mt-4" data-testid="link-dinos-directory">Parcourir les tribus</Link>
    </Empty>
  ) : (
    <div className="grid gap-5">
      <div className="panel grid gap-3 sm:grid-cols-[minmax(0,18rem)_1fr] items-end">
        <div>
          <label className="lbl" htmlFor="dino-tribe">Tribu</label>
          <select id="dino-tribe" className="field" value={tribeId ?? ""} disabled={busy} data-testid="select-dino-tribe"
            onChange={(e) => { const v = Number(e.target.value); guard(() => { setTribeId(v); setSpeciesId(null); }); }}>
            {tribes.data.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <p className="text-sm text-muted-foreground">Une fiche par espèce et par tribu. Seuls les <b className="text-foreground">points de base</b> comptent pour l'élevage : les points gagnés par le niveau d'entraînement ne se transmettent pas.</p>
      </div>
      <CatalogueNotice />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,22rem)_1fr] items-start">
        <section className="panel grid gap-3 min-w-0" aria-label="Espèces">
          <DinoVariantFilter id="select-dino-variant" value={variant} onChange={setVariant} />
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input type="search" className="field !pl-10" placeholder="Rechercher une espèce…" aria-label="Rechercher une espèce" value={search} onChange={(e) => setSearch(e.target.value)} data-testid="input-dino-search" />
          </div>
          {speciesQ.isLoading || recordsQ.isLoading ? <Skeletons n={3} /> : speciesQ.isError ? <ErrorBox message={errMsg(speciesQ.error)} onRetry={() => speciesQ.refetch()} /> : recordsQ.isError ? <ErrorBox message={errMsg(recordsQ.error)} onRetry={() => recordsQ.refetch()} /> : !rows.length ? (
            <p className="text-sm text-muted-foreground py-6 text-center" data-testid="text-dino-none">{speciesQ.data?.length ? "Aucune espèce ne correspond." : "Le catalogue est encore vide : le staff doit y ajouter des espèces vérifiées."}</p>
          ) : (
            <ul className="grid gap-1.5 min-w-0 max-h-[28rem] overflow-y-auto overflow-x-hidden pr-1" data-testid="list-dino-species">
              {rows.map((x) => {
                const r = recordOf(x.id);
                return (
                  <li key={x.id} className="min-w-0">
                    <button type="button" disabled={busy} aria-current={x.id === speciesId} data-testid={`button-species-${x.id}`}
                      onClick={() => guard(() => setSpeciesId(x.id))}
                      className={`w-full min-w-0 max-w-full text-left rounded-xl border px-3 py-2 transition-all hover:-translate-y-0.5 disabled:opacity-50 ${x.id === speciesId ? "border-primary bg-primary/10" : "border-border bg-background/40"}`}>
                      <span className="flex items-center justify-between gap-2">
                        <b className="min-w-0 flex-1 truncate">{x.name}</b>
                        <span className="flex gap-1 shrink-0">
                          {x.origin === "mod" && <span className="chip">Mod</span>}
                          {!x.active && <span className="chip !border-red-300/60">Hors catalogue</span>}
                          <span className={`chip ${r ? "" : "!border-border text-muted-foreground"}`}>{r ? "Fiche" : "Vide"}</span>
                        </span>
                      </span>
                      {r && <span className="block mt-1 font-mono text-[.7rem] text-muted-foreground truncate">{STAT_KEYS.map((k) => `${STAT_LABELS[k].slice(0, 3)} ${show(r.stats[k])}`).join(" · ")}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="grid gap-4" aria-live="polite">
          {!species ? (
            <Empty title="Choisissez une espèce"><p>Sélectionnez une espèce pour voir les meilleurs points de base de {tribe?.name ?? "votre tribu"} et les mettre à jour.</p></Empty>
          ) : (
            <>
              <div className="panel grid gap-4" data-testid="card-dino-record">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="eyebrow">{tribe?.name}</p>
                    <h2 className="text-2xl tracking-[.08em]" data-testid="text-species-name">{species.name}</h2>
                  </div>
                  {record && <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setDelOpen(true)} data-testid="button-delete-record"><Trash2 className="h-4 w-4" aria-hidden /> Supprimer la fiche</button>}
                </div>
                {unavailable && <p className="text-sm rounded-xl border border-red-300/50 bg-red-300/10 p-3" data-testid="text-species-inactive"><TriangleAlert className="inline h-4 w-4 mr-1" aria-hidden />Cette espèce n'est plus active dans le catalogue. Votre fiche est conservée : vous pouvez la modifier ou la supprimer.</p>}
                {record ? (
                  <>
                    <p className="lbl !mb-0">Meilleurs points de base · mis à jour le {fmtDate(record.updatedAt)} · {record.source === "photo" ? "photo" : "saisie manuelle"}</p>
                    <StatGrid stats={record.stats} />
                    {record.note && <p className="text-sm text-muted-foreground">Note : {record.note}</p>}
                  </>
                ) : <p className="text-sm text-muted-foreground" data-testid="text-no-record">Aucune fiche pour cette espèce dans cette tribu. Les stats inconnues s'affichent « — ».</p>}
              </div>

              <div className="panel grid gap-4" data-testid="card-dino-form">
                <h3 className="text-lg uppercase">{record ? "Comparer une nouvelle saisie" : "Créer la fiche"}</h3>
                {conflict && <p className="text-sm rounded-xl border border-red-300/50 bg-red-300/10 p-3" role="alert" data-testid="text-conflict">La fiche a changé pendant votre saisie. Votre brouillon est intact : cliquez sur « Comparer et enregistrer » pour recharger la comparaison avec la version actuelle.</p>}
                <div className="grid gap-2 rounded-xl border border-dashed border-border p-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <label className={`btn btn-ghost btn-sm ${busy ? "opacity-50 pointer-events-none" : "cursor-pointer"}`} aria-disabled={busy}>
                      {photoBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Camera className="h-4 w-4" aria-hidden />}
                      {photoBusy ? "Lecture en cours…" : "Remplir depuis une photo"}
                      <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={busy} data-testid="input-dino-photo"
                        onChange={(e) => { void onPhoto(e.target.files?.[0]); e.target.value = ""; }} />
                    </label>
                    <span className="text-xs text-muted-foreground">Lecture gratuite sur votre appareil, sans IA payante ni envoi de la photo. JPG, PNG ou WEBP, 6 Mo maximum. Préférez une capture nette, recadrée sur les statistiques. Vérifiez les résultats avant d’enregistrer.</span>
                  </div>
                  {photoErr && <p className="text-sm text-destructive" role="alert" data-testid="text-photo-error">{photoErr}</p>}
                  {photoUrl && (
                    <div className="flex gap-3 items-start">
                      <img src={photoUrl} alt="Aperçu local de la photo" className="h-24 w-24 sm:h-32 sm:w-32 rounded-xl object-cover border border-border" data-testid="img-photo-preview" />
                      <div className="grid gap-1 text-sm min-w-0">
                        {photoBusy && <p className="text-muted-foreground" role="status" aria-live="polite" data-testid="text-photo-progress">{photoProgress || "Préparation de la photo…"} Le premier chargement peut être plus long.</p>}
                        {photoRes && (
                          <>
                            <p data-testid="text-photo-species">Espèce lue : <b>{photoRes.speciesName ?? "inconnue : choix manuel nécessaire"}</b>{photoRes.speciesName && species && norm(photoRes.speciesName) !== norm(species.name) ? " — différente de l'espèce choisie : vérifiez avant d'enregistrer." : ""}</p>
                            <p className="text-muted-foreground">Seuls les points de base lus ont rempli la saisie ; les stats absentes restent vides. Vérifiez chaque valeur.</p>
                            {photoRes.warnings.map((w, i) => <p key={i} className="text-amber-200" data-testid={`text-photo-warning-${i}`}><TriangleAlert className="inline h-3.5 w-3.5 mr-1" aria-hidden />{w}</p>)}
                            {photoRes.observations.map((o, i) => <p key={i} data-testid={`text-photo-observation-${i}`}>{o}</p>)}
                            <details className="min-w-0">
                              <summary className="cursor-pointer text-primary">Voir le texte reconnu</summary>
                              <pre className="mt-2 whitespace-pre-wrap break-words text-xs max-h-56 overflow-y-auto" data-testid="text-photo-ocr">{photoRes.text || "Aucun texte lisible."}</pre>
                            </details>
                          </>
                        )}
                        <button type="button" className="btn btn-ghost btn-sm justify-self-start" disabled={save.isPending || del.isPending} onClick={() => { photoToken.current++; photoAbort.current?.abort(); setPhotoPreparing(false); setPhotoUrl(null); setPhotoRes(null); setFromPhoto(false); setPhotoErr(null); }} data-testid="button-photo-discard"><X className="h-3.5 w-3.5" aria-hidden /> {photoBusy ? "Annuler la lecture" : "Écarter la photo"}</button>
                      </div>
                    </div>
                  )}
                </div>

                <fieldset className="grid grid-cols-2 sm:grid-cols-4 gap-3" disabled={busy}>
                  <legend className="sr-only">Points de base</legend>
                  {STAT_KEYS.map((k) => {
                    const d = direction(record?.stats[k], draftStats[k]);
                    return (
                      <div key={k}>
                        <label className="lbl" htmlFor={`stat-${k}`}>{STAT_LABELS[k]}</label>
                        <input id={`stat-${k}`} className="field font-mono" inputMode="numeric" autoComplete="off" placeholder={record ? show(record.stats[k]) : "—"} value={draft[k]}
                          onChange={(e) => setDraft((p) => ({ ...p, [k]: e.target.value }))} data-testid={`input-stat-${k}`} />
                        <p className="text-xs mt-1 min-h-4">{record && draft[k] !== "" && <DirBadge d={d} />}</p>
                      </div>
                    );
                  })}
                </fieldset>
                <p className="text-xs text-muted-foreground">Entrez les points de base (pas les PV bruts ni des pourcentages). Un champ vide = inconnu ; 0 est une valeur valide. La torpeur est déduite, elle n'est pas saisie.</p>
                <div>
                  <label className="lbl" htmlFor="dino-note">Note (facultatif)</label>
                  <textarea id="dino-note" className="field" rows={2} maxLength={1000} disabled={busy} value={note ?? record?.note ?? ""} onChange={(e) => setNote(e.target.value)} data-testid="input-dino-note" />
                </div>
                {formErr && <p className="text-sm text-destructive" role="alert" data-testid="text-form-error">{formErr}</p>}
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn btn-primary" disabled={busy || !dirty} onClick={askSave} data-testid="button-dino-save">{save.isPending ? "Enregistrement…" : "Comparer et enregistrer"}</button>
                  <button type="button" className="btn btn-ghost" disabled={busy || !dirty} onClick={resetDraft} data-testid="button-dino-reset">Vider la saisie</button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      <section className="panel grid gap-3">
        <button type="button" className="flex items-center gap-2 text-left font-bold" aria-expanded={showHistory} onClick={() => setShowHistory((v) => !v)} data-testid="button-toggle-history">
          <History className="h-4 w-4 text-primary" aria-hidden /> Historique des 100 dernières modifications
        </button>
        {showHistory && (historyQ.isLoading ? <Skeletons n={2} /> : historyQ.isError ? <ErrorBox message={errMsg(historyQ.error)} onRetry={() => historyQ.refetch()} /> : !historyQ.data?.length ? <p className="text-sm text-muted-foreground" data-testid="text-history-empty">Aucune modification enregistrée.</p> : (
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-sm" data-testid="table-history">
              <thead><tr className="lbl !table-row text-left"><th className="pr-3 py-1">Date</th><th className="pr-3">Espèce</th><th className="pr-3">Action</th><th>Changements</th></tr></thead>
              <tbody>
                {historyQ.data.slice(0, 100).map((h) => {
                  const changes = STAT_KEYS.filter((k) => (h.before?.[k] ?? null) !== (h.after?.[k] ?? null)).map((k) => `${STAT_LABELS[k]} ${show(h.before?.[k])} → ${show(h.after?.[k])}`);
                  return (
                    <tr key={h.id} className="border-t border-border/60 align-top" data-testid={`row-history-${h.id}`}>
                      <td className="pr-3 py-1.5 whitespace-nowrap">{new Date(h.createdAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</td>
                      <td className="pr-3 font-semibold">{h.speciesName}</td><td className="pr-3">{h.action}</td>
                      <td className="font-mono text-xs">{changes.length ? changes.join(" · ") : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
      </section>

      <Dialog open={!!confirm} onOpenChange={(o) => { if (!o && !save.isPending) setConfirm(null); }}>
        <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto" data-testid="dialog-confirm-save">
          <DialogHeader>
            <DialogTitle>{confirm?.existing ? "Confirmer la mise à jour" : "Valider la nouvelle fiche"}</DialogTitle>
            <DialogDescription>{species?.name} · {tribe?.name}. Vérifiez que ce sont bien des points de base, pas des points d'entraînement.</DialogDescription>
          </DialogHeader>
          {confirm && <CompareTable old={confirm.existing?.stats ?? null} next={confirm.stats} mode={confirm.existing ? mode : "replace"} />}
          {confirm?.existing && (
            <div className="grid gap-2" role="radiogroup" aria-label="Mode d'enregistrement">
              <button type="button" role="radio" aria-checked={mode === "best"} className={`text-left rounded-xl border p-3 ${mode === "best" ? "border-primary bg-primary/10" : "border-border"}`} onClick={() => setMode("best")} data-testid="button-mode-best">
                <b>Conserver les meilleurs</b><span className="block text-sm text-muted-foreground">Chaque stat garde la plus haute valeur. Les stats vides gardent l'ancienne.</span>
              </button>
              <button type="button" role="radio" aria-checked={mode === "replace"} className={`text-left rounded-xl border p-3 ${mode === "replace" ? "border-red-300 bg-red-300/10" : "border-border"}`} onClick={() => setMode("replace")} data-testid="button-mode-replace">
                <b>Remplacer par la saisie</b><span className="block text-sm text-muted-foreground">Les stats saisies écrasent l'ancien, même plus basses. Les stats vides gardent l'ancienne.</span>
              </button>
              {mode === "replace" && confirm.existing && STAT_KEYS.some((k) => direction(confirm.existing!.stats[k], confirm.stats[k]) === "lower") && <p className="text-sm text-red-300" role="alert" data-testid="text-replace-warning"><TriangleAlert className="inline h-4 w-4 mr-1" aria-hidden />Certaines valeurs plus basses vont écraser les meilleures actuelles.</p>}
            </div>
          )}
          <DialogFooter className="gap-2">
            <button type="button" className="btn btn-ghost" disabled={save.isPending} onClick={() => setConfirm(null)} data-testid="button-confirm-cancel">Annuler</button>
            <button type="button" className="btn btn-primary" disabled={save.isPending} onClick={doSave} data-testid="button-confirm-save">{save.isPending ? "Enregistrement…" : confirm?.existing ? "Confirmer" : "Valider la fiche"}</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={delOpen} onOpenChange={(o) => { if (!del.isPending) setDelOpen(o); }}>
        <DialogContent data-testid="dialog-confirm-delete">
          <DialogHeader>
            <DialogTitle>Supprimer la fiche ?</DialogTitle>
            <DialogDescription>Fiche « {species?.name} » de la tribu « {tribe?.name} ». Seule cette fiche privée est supprimée ; l'espèce reste dans le catalogue.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <button type="button" className="btn btn-ghost" disabled={del.isPending} onClick={() => setDelOpen(false)} data-testid="button-delete-cancel">Annuler</button>
            <button type="button" className="btn btn-danger" disabled={del.isPending} onClick={doDelete} data-testid="button-delete-confirm">{del.isPending ? "Suppression…" : "Supprimer"}</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!pending} onOpenChange={(o) => { if (!o) setPending(null); }}>
        <DialogContent data-testid="dialog-discard">
          <DialogHeader>
            <DialogTitle>Abandonner la saisie en cours ?</DialogTitle>
            <DialogDescription>Changer de tribu ou d'espèce efface les valeurs non enregistrées et la photo analysée.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => setPending(null)} data-testid="button-discard-keep">Continuer la saisie</button>
            <button type="button" className="btn btn-primary" onClick={() => { const f = pending; setPending(null); resetDraft(); f?.(); }} data-testid="button-discard-confirm">Abandonner</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  return (
    <>
      <PageBanner kicker="Élevage" title="Suivi de mes dinos" sub="Une fiche de points de base par espèce, partagée par la tribu." image={IMG.mySpace} />
      {(s.data?.isOwner || s.data?.isAdmin) && <Link href="/mes-dinos/catalogue" className="btn btn-ghost btn-sm mb-4" data-testid="link-dinos-catalogue">Catalogue des espèces · ajouter un dino</Link>}
      {body}
    </>
  );
}
