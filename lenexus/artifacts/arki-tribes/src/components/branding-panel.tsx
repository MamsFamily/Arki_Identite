import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetSiteBrandingQueryKey, useGetSiteBranding, useRequestBrandingUpload, useUpdateSiteBranding, type SiteBranding,
} from "@workspace/api-client-react";
import { Confirm, ErrorBox, Skeletons } from "@/components/parts";
import { errMsg, useWrite } from "@/lib/helpers";

type Kind = "logo" | "cover";
const TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
type Mime = (typeof TYPES)[number];
const MAX: Record<Kind, number> = { logo: 5 * 1024 * 1024, cover: 10 * 1024 * 1024 };

function Slot({ kind, branding }: { kind: Kind; branding: SiteBranding }) {
  const qc = useQueryClient();
  const w = useWrite();
  const requestUpload = useRequestBrandingUpload({ request: w.request });
  const update = useUpdateSiteBranding({ request: w.request });
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!file) { setPreview(""); return; }
    const u = URL.createObjectURL(file);
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  const isLogo = kind === "logo";
  const title = isLogo ? "Logo du site" : "Image de couverture";
  const field = isLogo ? "logoPath" : "coverPath";
  const hasCustom = isLogo ? !!branding.logoPath : !!branding.coverPath;
  const current = isLogo ? branding.logoUrl : branding.coverUrl;

  const done = (b: SiteBranding, msg: string) => {
    qc.setQueryData(getGetSiteBrandingQueryKey(), b);
    qc.invalidateQueries({ queryKey: getGetSiteBrandingQueryKey() });
    setOk(msg);
  };

  const pick = (f: File | undefined) => {
    setError(""); setOk("");
    setFile(null);
    if (!f) return;
    if (!(TYPES as readonly string[]).includes(f.type)) { setError("Format refusé : PNG, JPEG ou WebP uniquement."); return; }
    if (!f.size) { setError("Le fichier est vide."); return; }
    if (f.size > MAX[kind]) { setError(`Fichier trop lourd : ${isLogo ? "5" : "10"} Mio maximum.`); return; }
    setFile(f);
  };
  const clear = () => { setFile(null); if (input.current) input.current.value = ""; };

  const save = async () => {
    if (!file) return;
    setBusy(true); setError(""); setOk("");
    try {
      const up = await requestUpload.mutateAsync({ data: { kind, name: file.name, size: file.size, contentType: file.type as Mime } });
      const put = await fetch(up.uploadURL, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      if (!put.ok) throw new Error(`Envoi du fichier échoué (${put.status}).`);
      const b = await update.mutateAsync({ data: { [field]: up.objectPath } });
      done(b, isLogo ? "Logo mis à jour." : "Couverture mise à jour.");
      w.mutation.onSuccess();
      clear();
    } catch (e) {
      setError(errMsg(e));
    } finally { setBusy(false); }
  };

  const remove = async () => {
    setBusy(true); setError(""); setOk("");
    try {
      const b = await update.mutateAsync({ data: { [field]: null } });
      done(b, isLogo ? "Logo d'origine rétabli." : "Couverture retirée.");
      w.mutation.onSuccess();
    } catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  };

  return (
    <div className="grid gap-3" data-testid={`branding-${kind}`}>
      <h3 className="text-xl font-bold text-primary">{title}</h3>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <p className="lbl">Actuel</p>
          {current ? (
            <img src={current} alt={title} data-testid={`img-branding-${kind}-current`} className={`rounded border-2 border-foreground/20 bg-muted w-full ${isLogo ? "h-32 object-contain" : "h-32 object-cover"}`} />
          ) : (
            <div className="h-32 rounded border-2 border-dashed border-border grid place-items-center text-sm text-muted-foreground">Aucune couverture</div>
          )}
        </div>
        <div>
          <p className="lbl">Aperçu avant enregistrement</p>
          {preview ? (
            <img src={preview} alt="Aperçu" data-testid={`img-branding-${kind}-preview`} className={`rounded border-2 border-accent bg-muted w-full ${isLogo ? "h-32 object-contain" : "h-32 object-cover"}`} />
          ) : (
            <div className="h-32 rounded border-2 border-dashed border-border grid place-items-center text-sm text-muted-foreground">Aucun fichier choisi</div>
          )}
        </div>
      </div>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="field" aria-label={`Choisir ${title}`} data-testid={`input-branding-${kind}`} disabled={busy} onChange={(e) => pick(e.target.files?.[0])} />
      <p className="text-xs text-muted-foreground">PNG, JPEG ou WebP, {isLogo ? "5" : "10"} Mio maximum.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary btn-sm" disabled={!file || busy} onClick={save} data-testid={`button-branding-${kind}-save`}>
          {busy ? "Envoi..." : hasCustom ? "Remplacer" : "Enregistrer"}
        </button>
        {file && <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={clear} data-testid={`button-branding-${kind}-cancel`}>Annuler le choix</button>}
        {hasCustom && (
          <Confirm label={isLogo ? "Rétablir le logo d'origine" : "Retirer la couverture"} title={isLogo ? "Rétablir le logo d'origine ?" : "Retirer la couverture ?"}
            description={isLogo ? "Le logo personnalisé ne sera plus affiché sur le site." : "L'annuaire n'affichera plus d'image de couverture."}
            confirmLabel={isLogo ? "Rétablir" : "Retirer"} testid={`button-branding-${kind}-reset`} disabled={busy} onConfirm={remove} />
        )}
      </div>
      {error && <p role="alert" className="text-sm font-bold text-destructive" data-testid={`status-branding-${kind}-error`}>{error} L'image actuelle est conservée.</p>}
      {ok && <p role="status" className="text-sm font-bold text-primary" data-testid={`status-branding-${kind}-ok`}>{ok}</p>}
    </div>
  );
}

export function BrandingPanel() {
  const q = useGetSiteBranding({ query: { queryKey: getGetSiteBrandingQueryKey(), refetchInterval: 30000 } });
  return (
    <section className="panel mb-6" data-testid="section-branding">
      <h2 className="text-2xl font-bold text-primary mb-1">Identité du site</h2>
      <p className="text-sm text-muted-foreground mb-4">Logo affiché dans l'en-tête et image de couverture facultative de l'annuaire.</p>
      {q.isLoading ? <Skeletons n={1} /> : q.isError || !q.data ? (
        <ErrorBox message={errMsg(q.error)} onRetry={() => q.refetch()} />
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          <Slot kind="logo" branding={q.data} />
          <Slot kind="cover" branding={q.data} />
        </div>
      )}
    </section>
  );
}
