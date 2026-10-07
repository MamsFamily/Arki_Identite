import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetMapSettlementsQueryKey, useGetMapSettlements, useRequestBrandingUpload, useSaveMapCartography,
  type MapSettlements,
} from "@workspace/api-client-react";
import { InteractiveMap } from "@/components/interactive-map";
import { useViewedSession } from "@/lib/owner-view";
import { errMsg } from "@/lib/helpers";
import { getMapCalibration } from "@/lib/map-coordinates";
import { getMapLandmarks } from "@/lib/map-landmarks";

const TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
const MAX = 10 * 1024 * 1024;

export function useSettlements(slug: string) {
  return useGetMapSettlements(slug, { query: { queryKey: getGetMapSettlementsQueryKey(slug), enabled: !!slug, staleTime: 0, refetchInterval: 10000, refetchOnWindowFocus: true, refetchOnReconnect: true, retry: 2, retryDelay: (n: number) => Math.min(1000 * 2 ** n, 5000) } });
}

const plural = (n: number) => `${n} ${n > 1 ? "tribus déclarent" : "tribu déclare"} cette map comme base principale`;

export function SettlementCount({ slug, onOpen }: { slug: string; onOpen: () => void }) {
  const q = useSettlements(slug);
  return (
    <div className="glass p-5 mt-4 flex flex-wrap items-center justify-between gap-3" data-testid="summary-settlements">
      <div>
        <p className="eyebrow mb-1">Résidents</p>
        {q.isLoading ? <p className="text-sm text-muted-foreground" role="status">Comptage en cours…</p>
          : q.isError ? <p className="text-sm text-destructive">Le nombre de tribus n’a pas pu être chargé.</p>
          : <p className="text-sm"><b className="text-2xl font-serif mr-2" data-testid="text-settlement-count">{q.data?.count ?? 0}</b>{plural(q.data?.count ?? 0).replace(/^\d+ /, "")}</p>}
        <p className="text-xs text-muted-foreground mt-1">Base principale déclarée uniquement : ni avant-postes, ni joueurs connectés.</p>
      </div>
      <button type="button" className="btn btn-ghost btn-sm" onClick={onOpen}>Voir la carte et les résidents</button>
    </div>
  );
}

export function MapCartography({ slug, mapName }: { slug: string; mapName: string }) {
  const q = useSettlements(slug);
  const session = useViewedSession();
  const isOwner = !!session.data?.isOwner;
  const [active, setActive] = useState<number | null>(null);
  const [broken, setBroken] = useState(false);
  const data = q.data;
  const image = data?.cartography.image ?? "";
  useEffect(() => setBroken(false), [image]);

  if (q.isLoading) return <div className="glass p-6 text-muted-foreground" role="status">Chargement de la cartographie…</div>;
  if (q.isError || !data) return (
    <div className="glass p-6 grid gap-3" role="alert"><p className="text-destructive font-bold">Impossible de charger les résidents.</p>
      <div><button className="btn btn-ghost btn-sm" onClick={() => q.refetch()}>Réessayer</button></div></div>
  );
  const showMarkers = !!image && !broken;
  return (
    <div className="grid gap-5">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-5 items-start">
        <section className="glass p-4 sm:p-5 min-w-0" aria-label={`Carte de ${mapName}`}>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3"><h2 className="text-xl uppercase">Carte officielle</h2><button type="button" className="btn btn-ghost btn-sm" onClick={() => void q.refetch()} disabled={q.isFetching} data-testid="button-refresh-settlements">Actualiser</button></div>
          <p className="text-xs text-muted-foreground mb-3" data-testid="text-auto-refresh">Actualisation automatique toutes les 10 secondes tant que cette page est visible, d’après les bases principales déclarées uniquement : ni avant-postes, ni joueurs connectés.</p>
          {showMarkers ? (
            <InteractiveMap key={`${slug}|${image}`} image={image} mapName={mapName} tribes={data.tribes} landmarks={getMapLandmarks(slug)} activeId={active} onActive={setActive} onBroken={() => setBroken(true)} />
          ) : (
            <div className="rounded-xl border border-dashed border-white/20 p-6 text-sm grid gap-1" data-testid="cartography-empty">
              <p className="font-bold">{broken ? "L’image de carte n’a pas pu être affichée." : "Aucune carte officielle n’est publiée pour cette map."}</p>
              <p className="text-muted-foreground">{isOwner ? "Vous pouvez ajouter la carte officielle ci-dessous." : "Le propriétaire du site peut ajouter la carte officielle. La liste des résidents reste disponible à droite."} L’image de couverture de la page est une illustration, pas une carte.</p>
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-3">{getMapCalibration(image) ? "Les pins reprennent les coordonnées déclarées par les tribus, alignées sur les graduations imprimées de la carte." : "Les pins reprennent les coordonnées déclarées par les tribus, lues sur la même grille indicative de 0 à 100."}</p>
        </section>
        <aside className="glass p-4 sm:p-5 min-w-0" aria-label="Tribus résidentes">
          <p className="eyebrow mb-1">Base principale</p>
          <h2 className="text-lg uppercase mb-1" data-testid="text-residents-count">{plural(data.count)}</h2>
          {data.tribes.length === 0 ? <p className="text-sm text-muted-foreground mt-3">Aucune tribu n’a encore déclaré cette map comme base principale.</p> : (
            <ol className="grid gap-2 mt-3">
              {data.tribes.map((t) => {
                const known = t.latitude !== null && t.longitude !== null;
                return (
                  <li key={t.id} className={`flex gap-3 items-start rounded-lg border p-2 ${active === t.id ? "border-[#9C7CFF]" : "border-white/10"}`}
                    onMouseEnter={() => setActive(t.id)} onMouseLeave={() => setActive(null)}>
                    <span className={`grid place-items-center h-6 w-6 shrink-0 rounded-full border text-xs font-bold ${known && showMarkers ? "border-[#65D8FF] text-[#9AEAFF]" : "border-white/20 text-muted-foreground"}`} aria-hidden="true">{known && showMarkers ? <span className="h-1.5 w-1.5 rounded-full bg-current" /> : "–"}</span>
                    <div className="min-w-0">
                      <Link href={`/tribus/${t.id}`} className="font-bold text-primary break-words">{t.name}</Link>
                      <p className="text-xs text-muted-foreground break-words">{t.coords?.trim() ? t.coords : "Coordonnées non renseignées"}{t.coords?.trim() && !known ? " (non placée sur la carte)" : ""}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </aside>
      </div>
      {isOwner ? <CartographyEditor key={slug} slug={slug} data={data} refetch={async () => { const result = await q.refetch(); if (result.error) throw result.error; return result; }} /> : null}
    </div>
  );
}

function CartographyEditor({ slug, data, refetch }: { slug: string; data: MapSettlements; refetch: () => Promise<unknown> }) {
  const session = useViewedSession();
  const qc = useQueryClient();
  const upload = useRequestBrandingUpload({ request: { headers: { "X-CSRF-Token": session.data?.csrfToken ?? "" } } });
  const save = useSaveMapCartography({ request: { headers: { "X-CSRF-Token": session.data?.csrfToken ?? "" } } });
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [url, setUrl] = useState("");
  const [uploaded, setUploaded] = useState<{ name: string; path: string } | null>(null);
  const [rev, setRev] = useState(data.cartography.revision);
  const [err, setErr] = useState("");
  const [conflict, setConflict] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [requiresOverwrite, setRequiresOverwrite] = useState(false);
  const [busy, setBusy] = useState<"" | "upload" | "save" | "refetch">("");
  const [ok, setOk] = useState("");
  const alive = useRef(true);
  const blob = useRef("");
  useEffect(() => { alive.current = true; return () => { alive.current = false; if (blob.current) URL.revokeObjectURL(blob.current); }; }, []);

  const setBlob = (f: File | null) => {
    if (blob.current) URL.revokeObjectURL(blob.current);
    blob.current = f ? URL.createObjectURL(f) : "";
    setPreview(blob.current);
  };
  const pick = (f?: File) => {
    if (!f) return;
    const e = !(TYPES as readonly string[]).includes(f.type) ? "Format refusé : PNG, JPEG ou WebP uniquement." : !f.size ? "Le fichier est vide." : f.size > MAX ? "Fichier trop lourd : 10 Mio maximum." : "";
    if (e) { setErr(e); return; }
    setErr(""); setOk(""); setFile(f); setUploaded(null); setUrl(""); setBlob(f); setRev(data.cartography.revision); setConflict(false); setConfirmed(false); setRequiresOverwrite(false);
  };
  const cancel = () => { setFile(null); setBlob(null); setUploaded(null); setErr(""); setConflict(false); setConfirmed(false); setRequiresOverwrite(false); };

  const commit = async (image: string) => {
    setBusy("save");
    try {
      const r = await save.mutateAsync({ slug, data: { image, revision: rev } });
      qc.setQueryData(getGetMapSettlementsQueryKey(slug), (old: MapSettlements | undefined) => old ? { ...old, cartography: r } : old);
      void qc.invalidateQueries({ queryKey: getGetMapSettlementsQueryKey(slug) });
      if (!alive.current) return;
      setRev(r.revision); cancel(); setUrl(""); setOk(image ? "Carte officielle publiée." : "Carte officielle retirée. Le fichier d’origine reste conservé.");
    } catch (e) {
      if (!alive.current) return;
      if ((e as { status?: number }).status === 409) { setConflict(true); setRequiresOverwrite(true); setConfirmed(false); setErr("Conflit : la cartographie a été modifiée ailleurs. Votre brouillon est conservé. Actualisez la dernière version, puis confirmez à nouveau."); }
      else setErr(errMsg(e));
    } finally { if (alive.current) setBusy(""); }
  };
  const publish = async () => {
    setErr(""); setOk("");
    try {
      let image = uploaded?.path ?? "";
      if (file && !image) {
        setBusy("upload");
        const up = await upload.mutateAsync({ data: { kind: "cover", name: file.name, size: file.size, contentType: file.type as (typeof TYPES)[number] } });
        const put = await fetch(up.uploadURL, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
        if (!put.ok) throw new Error(`Envoi du fichier échoué (${put.status}).`);
        if (!alive.current) return;
        image = up.objectPath; setUploaded({ name: file.name, path: image });
      } else if (!file) {
        image = url.trim();
        if (!/^https:\/\/\S+$/i.test(image)) { setErr("L’adresse doit commencer par https://"); return; }
      }
      if (!alive.current) return;
      await commit(image);
    } catch (e) { if (alive.current) { setErr(errMsg(e)); setBusy(""); } }
  };
  const refresh = async () => {
    setBusy("refetch");
    try { await refetch(); const fresh = qc.getQueryData<MapSettlements>(getGetMapSettlementsQueryKey(slug)); if (alive.current && fresh) { setRev(fresh.cartography.revision); setConflict(false); setErr("Version actualisée. Confirmez explicitement pour publier votre brouillon par-dessus."); setConfirmed(false); } }
    catch (e) { if (alive.current) setErr(errMsg(e)); } finally { if (alive.current) setBusy(""); }
  };
  const remove = () => {
    if (!window.confirm("Retirer la carte officielle ? Le fichier d’origine n’est pas supprimé du stockage.")) return;
    void commit("");
  };

  const hasDraft = !!file || !!url.trim();
  const needConfirm = requiresOverwrite || rev !== data.cartography.revision || conflict;
  const disabled = !!busy;
  return (
    <section className="glass p-4 sm:p-5 grid gap-3" aria-label="Gérer la carte officielle" data-testid="section-cartography-editor">
      <div><p className="eyebrow mb-1">Propriétaire</p><h2 className="text-xl uppercase">Carte officielle</h2>
        <p className="text-sm text-muted-foreground mt-1">{data.cartography.image ? "Une carte est actuellement publiée (carte fournie par défaut ou carte personnalisée)." : "Aucune carte n’est actuellement publiée : elle peut être envoyée ici."} Révision actuelle : {data.cartography.revision}.</p></div>
      {preview && <img src={preview} alt="Aperçu de la carte choisie" className="w-full max-w-xl h-auto rounded-lg border border-white/15" />}
      <input type="file" accept="image/png,image/jpeg,image/webp" className="field" aria-label="Choisir une carte officielle" disabled={disabled}
        onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} data-testid="input-cartography-file" />
      <input className="field" maxLength={2048} placeholder="…ou adresse https:// de la carte" aria-label="Adresse HTTPS de la carte" value={url} disabled={disabled || !!file}
        onChange={(e) => setUrl(e.target.value)} />
      <p className="text-xs text-muted-foreground">PNG, JPEG ou WebP, 10 Mio maximum. Image alignée 0-100, nord en haut, sans bordure autour de la grille. Elle n’est jamais recadrée.</p>
      {uploaded && <p className="text-xs text-muted-foreground" role="status">Fichier envoyé, non encore publié : {uploaded.name}.</p>}
      {err && <p role="alert" className="text-sm font-bold text-destructive" data-testid="status-cartography-error">{err}</p>}
      {conflict && <div><button type="button" className="btn btn-ghost btn-sm" onClick={refresh} disabled={disabled}>{busy === "refetch" ? "Actualisation…" : "Actualiser la dernière version"}</button></div>}
      {needConfirm && !conflict && hasDraft && (
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} disabled={disabled} className="mt-1" />
          <span>Je confirme le remplacement de la version actuelle par mon brouillon.</span></label>
      )}
      <div className="flex flex-wrap gap-2 items-center">
        <button type="button" className="btn btn-primary" onClick={publish} disabled={disabled || !hasDraft || conflict || (needConfirm && !confirmed)} data-testid="button-cartography-save">
          {busy === "upload" ? "Envoi du fichier…" : busy === "save" ? "Enregistrement…" : uploaded ? "Réessayer la publication" : "Publier la carte"}
        </button>
        {hasDraft && <button type="button" className="btn btn-ghost" onClick={() => { cancel(); setUrl(""); }} disabled={disabled}>Abandonner le brouillon</button>}
        {data.cartography.image && <button type="button" className="btn btn-ghost" onClick={remove} disabled={disabled || conflict}>Retirer la carte officielle</button>}
        <span className="text-xs text-muted-foreground" role="status">{ok}</span>
      </div>
    </section>
  );
}
