import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import {
  getGetSiteMapQueryKey, getListSiteMapsQueryKey, getSiteMap, useRequestBrandingUpload, useUpdateSiteMap, type SiteMap, type SiteMapInput,
} from "@workspace/api-client-react";
import { useViewedSession as useGetSession } from "@/lib/owner-view";
import { errMsg, useWrite } from "@/lib/helpers";

const TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
type Mime = (typeof TYPES)[number];
const MAX = 10 * 1024 * 1024;
const MAX_GALLERY = 24;
const KINDS: { v: SiteMapInput["kind"]; l: string }[] = [{ v: "main", l: "Principale" }, { v: "premium", l: "Premium" }, { v: "event", l: "Événement" }];

type Img = { id: string; value: string; preview: string; blob?: boolean; uploading?: boolean; error?: string; name?: string };
type Draft = {
  name: string; kind: SiteMapInput["kind"]; blurb: string; description: string; size: string; biomes: string; difficulty: number;
  transfers: string; specials: string; creatures: string; zones: string; rules: string;
  resourcesUrl: string; dinosUrl: string;
};
const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);
const toDraft = (m: SiteMap): Draft => ({
  name: m.name, kind: m.kind, blurb: m.blurb, description: m.description, size: m.size, biomes: m.biomes, difficulty: m.difficulty,
  transfers: m.transfers, specials: m.specials, creatures: m.creatures.join("\n"), zones: m.zones.join("\n"), rules: m.rules.join("\n"),
  resourcesUrl: m.resourcesUrl ?? "", dinosUrl: m.dinosUrl ?? "",
});
let seq = 0;
const mkImg = (value: string): Img => ({ id: `i${++seq}`, value, preview: value });
const extras = (m: SiteMap) => m.gallery.filter((g) => g !== m.image).map(mkImg);

function Editor({ map, onClose }: { map: SiteMap; onClose: () => void }) {
  const qc = useQueryClient();
  const w = useWrite(undefined, "Map enregistrée");
  const upload = useRequestBrandingUpload({ request: w.request });
  const update = useUpdateSiteMap({ request: w.request });
  const [base, setBase] = useState(map);
  const [d, setD] = useState<Draft>(() => toDraft(map));
  const [cover, setCover] = useState<Img>(() => mkImg(map.image));
  const [gal, setGal] = useState<Img[]>(() => extras(map));
  const [url, setUrl] = useState("");
  const [err, setErr] = useState("");
  const [conflict, setConflict] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reloading, setReloading] = useState(false);
  const blobs = useRef(new Set<string>());
  const dialog = useRef<HTMLDivElement>(null);
  const live = useRef({ cover, gal });
  live.current = { cover, gal };

  useEffect(() => () => { blobs.current.forEach((u) => URL.revokeObjectURL(u)); blobs.current.clear(); }, []);
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.querySelector<HTMLElement>("input, select, textarea")?.focus();
    return () => {
      document.body.style.overflow = overflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);
  const drop = (im: Img) => { if (im.blob) { URL.revokeObjectURL(im.preview); blobs.current.delete(im.preview); } };

  const uploading = cover.uploading || gal.some((g) => g.uploading);
  const input = useMemo<SiteMapInput>(() => ({
    name: d.name.trim(), kind: d.kind, image: cover.value, blurb: d.blurb.trim(), description: d.description.trim(), size: d.size.trim(), biomes: d.biomes.trim(),
    difficulty: d.difficulty, transfers: d.transfers.trim(), specials: d.specials.trim(), creatures: lines(d.creatures), zones: lines(d.zones), rules: lines(d.rules),
    gallery: Array.from(new Set(gal.map((g) => g.value).filter((v) => v && v !== cover.value))), revision: base.revision,
    resourcesUrl: d.resourcesUrl.trim(), dinosUrl: d.dinosUrl.trim(),
  }), [d, cover, gal, base]);
  const norm = (x: SiteMapInput) => JSON.stringify(Object.entries({ ...x, revision: 0 }).sort(([k], [l]) => k.localeCompare(l)));
  const dirty = norm(input) !== norm(toInput(base)) || Boolean(cover.blob || uploading) || gal.some(g => !g.value);
  function toInput(m: SiteMap): SiteMapInput {
    const { slug: _s, updatedAt: _u, ...rest } = m; void _s; void _u;
    return { ...rest, gallery: m.gallery.filter((g) => g !== m.image) };
  }
  const stale = !conflict && map.revision !== base.revision;
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));

  const doUpload = async (file: File, target: "cover" | string) => {
    const patch = (p: Partial<Img>) => target === "cover" ? setCover((c) => ({ ...c, ...p })) : setGal((g) => g.map((x) => x.id === target ? { ...x, ...p } : x));
    try {
      const up = await upload.mutateAsync({ data: { kind: "cover", name: file.name, size: file.size, contentType: file.type as Mime } });
      const put = await fetch(up.uploadURL, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      if (!put.ok) throw new Error(`Envoi du fichier échoué (${put.status}).`);
      patch({ value: up.objectPath, uploading: false, error: undefined });
    } catch (e) {
      patch({ uploading: false, error: errMsg(e) });
    }
  };
  const check = (f: File): string => !(TYPES as readonly string[]).includes(f.type) ? "Format refusé : PNG, JPEG ou WebP uniquement." : !f.size ? "Le fichier est vide." : f.size > MAX ? "Fichier trop lourd : 10 Mio maximum." : "";
  const blobFor = (f: File) => { const u = URL.createObjectURL(f); blobs.current.add(u); return u; };

  const pickCover = (f?: File) => {
    if (!f) return;
    const e = check(f);
    if (e) { setCover((c) => ({ ...c, error: e })); return; }
    const old = live.current.cover; 
    const next: Img = { id: old.id, value: old.value, preview: blobFor(f), blob: true, uploading: true, name: f.name };
    setCover(next); drop(old);
    void doUpload(f, "cover");
  };
  const pickGallery = (files: FileList | null) => {
    if (!files) return;
    const room = MAX_GALLERY - live.current.gal.length;
    const list = Array.from(files).slice(0, Math.max(room, 0));
    if (files.length > list.length) setErr(`La galerie est limitée à ${MAX_GALLERY} images en plus de la couverture.`);
    const items = list.map((f) => ({ f, e: check(f) }));
    const created: Img[] = items.map(({ f, e }) => ({ id: `i${++seq}`, value: "", preview: e ? "" : blobFor(f), blob: !e, uploading: !e, error: e || undefined, name: f.name }));
    setGal((g) => [...g, ...created]);
    created.forEach((c, i) => { if (!c.error) void doUpload(items[i].f, c.id); });
  };
  const addUrl = () => {
    const u = url.trim();
    if (!/^https:\/\/\S+$/i.test(u)) { setErr("L'adresse doit commencer par https://"); return; }
    if (gal.length >= MAX_GALLERY) { setErr(`La galerie est limitée à ${MAX_GALLERY} images.`); return; }
    setErr(""); setGal((g) => [...g, mkImg(u)]); setUrl("");
  };
  const removeGal = (im: Img) => { drop(im); setGal((g) => g.filter((x) => x.id !== im.id)); };

  const validate = () => {
    if (!input.name) return "Le nom est obligatoire.";
    for (const value of [input.resourcesUrl, input.dinosUrl]) {
      if (!value) continue;
      try {
        const link = new URL(value);
        if (!["http:", "https:"].includes(link.protocol) || link.username || link.password) throw new Error();
      } catch { return "Les liens ressources et dinos doivent commencer par http:// ou https:// et ne pas contenir d’identifiants."; }
    }
    if (cover.error || gal.some((g) => g.error || !g.value)) return "Retirez ou corrigez les images en erreur avant d'enregistrer.";
    if (cover.value && !/^(\/map-|https:\/\/|\/objects\/uploads\/)/.test(cover.value) && !cover.value.startsWith("/")) return "Adresse d'image invalide.";
    return "";
  };
  const save = async () => {
    const v = validate();
    if (v) { setErr(v); return; }
    setSaving(true); setErr("");
    try {
      const r = await update.mutateAsync({ slug: map.slug, data: input });
      qc.setQueryData(getGetSiteMapQueryKey(map.slug), r);
      qc.setQueryData(getListSiteMapsQueryKey(), (old: SiteMap[] | undefined) => old?.map((x) => x.slug === r.slug ? r : x));
      qc.invalidateQueries({ queryKey: getGetSiteMapQueryKey(map.slug) });
      qc.invalidateQueries({ queryKey: getListSiteMapsQueryKey() });
      w.mutation.onSuccess();
      onClose();
    } catch (e) {
      const status = (e as { status?: number }).status;
      if (status === 409) setConflict(true);
      setErr(status === 409 ? "Un autre propriétaire a modifié cette map. Votre brouillon est conservé. Recharger la dernière version remplacera votre brouillon." : errMsg(e));
    } finally { setSaving(false); }
  };
  const reload = async () => {
    if (dirty && !window.confirm("Recharger la dernière version et abandonner votre brouillon ?")) return;
    setReloading(true);
    try {
      const latest = await getSiteMap(map.slug);
      blobs.current.forEach((u) => URL.revokeObjectURL(u)); blobs.current.clear();
      setBase(latest); setD(toDraft(latest)); setCover(mkImg(latest.image)); setGal(extras(latest));
      setConflict(false); setErr("");
      qc.setQueryData(getGetSiteMapQueryKey(map.slug), latest);
      requestAnimationFrame(() => dialog.current?.querySelector<HTMLElement>("input, select, textarea")?.focus());
    } catch (e) { setErr(errMsg(e)); } finally { setReloading(false); }
  };
  const close = () => { if (!saving && (!dirty || window.confirm("Abandonner les modifications non enregistrées ?"))) onClose(); };
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key !== "Tab") return;
      const controls = Array.from(dialog.current?.querySelectorAll<HTMLElement>("button, input, select, textarea, a[href], [tabindex='0']") ?? [])
        .filter(el => !el.hasAttribute("disabled") && el.offsetParent !== null);
      const first = controls[0], last = controls[controls.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && (document.activeElement === first || !dialog.current?.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !dialog.current?.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  });

  const busy = saving || reloading;
  const T = (k: keyof Draft, label: string, max: number) => (
    <label className="grid gap-1"><span className="lbl">{label}</span>
      <input className="field" maxLength={max} value={String(d[k])} disabled={busy} onChange={(e) => set(k, e.target.value as never)} data-testid={`input-map-${k}`} /></label>
  );
  const L = (k: "creatures" | "zones" | "rules", label: string, hint: string) => (
    <label className="grid gap-1"><span className="lbl">{label} <span className="font-normal text-muted-foreground">({lines(d[k]).length}) — {hint}</span></span>
      <textarea className="field min-h-[90px]" rows={4} value={d[k]} disabled={busy} onChange={(e) => set(k, e.target.value)} data-testid={`input-map-${k}`} /></label>
  );
  const Thumb = ({ im, onRemove }: { im: Img; onRemove?: () => void }) => (
    <div className="grid gap-1">
      <div className={`relative aspect-video rounded-lg overflow-hidden border ${im.error ? "border-destructive" : "border-white/15"} bg-black/30`}>
        {im.preview && <img src={im.preview} alt="" className="w-full h-full object-cover" />}
        {im.uploading && <span className="absolute inset-0 grid place-items-center bg-black/60 text-xs font-bold" role="status">Envoi en cours…</span>}
        {onRemove && <button type="button" onClick={onRemove} disabled={busy} aria-label="Retirer cette image" className="absolute top-1 right-1 rounded bg-black/70 p-1" data-testid={`button-map-gallery-remove-${im.id}`}><Trash2 className="h-4 w-4" /></button>}
        {im.blob && !im.uploading && !im.error && <span className="absolute bottom-1 left-1 chip !text-[.65rem]">Envoyée — non publiée</span>}
      </div>
      {im.error && <p role="alert" className="text-xs font-bold text-destructive">{im.name ? `${im.name} : ` : ""}{im.error}</p>}
    </div>
  );

  return (
    <div ref={dialog} className="fixed inset-0 z-[100] bg-black/75 overflow-y-auto" role="dialog" aria-modal="true" aria-label={`Modifier ${map.name}`} data-testid="dialog-map-editor">
      <div className="min-h-full grid place-items-start sm:place-items-center p-0 sm:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
        <div className="glass w-full max-w-4xl p-4 sm:p-6 grid gap-5 !rounded-none sm:!rounded-2xl">
          <div className="flex items-start justify-between gap-3">
            <div><p className="eyebrow mb-1">Propriétaire</p><h2 className="text-xl sm:text-2xl uppercase">Modifier {map.name}</h2>
              <p className="text-xs text-muted-foreground mt-1">Révision {base.revision}{base.updatedAt ? ` — mise à jour le ${new Date(base.updatedAt).toLocaleString("fr-FR")}` : ""}</p></div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={close} aria-label="Fermer" data-testid="button-map-close"><X className="h-4 w-4" /></button>
          </div>

          {(stale || conflict) && (
            <div role="alert" className="panel border-destructive grid gap-2" data-testid="status-map-conflict">
              <p className="text-sm font-bold text-destructive">{conflict ? "Conflit de modification : une version plus récente existe." : "Une version plus récente de cette map est disponible."}</p>
              <p className="text-xs text-muted-foreground">Votre brouillon est conservé. Le recharger remplace vos modifications par la dernière version.</p>
              <div><button type="button" className="btn btn-ghost btn-sm" onClick={reload} disabled={busy} data-testid="button-map-reload">{reloading ? "Chargement…" : "Recharger la dernière version"}</button></div>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-3">
            {T("name", "Nom", 80)}
            <label className="grid gap-1"><span className="lbl">Type</span>
              <select className="field" value={d.kind} disabled={busy} onChange={(e) => set("kind", e.target.value as Draft["kind"])} data-testid="select-map-kind">
                {KINDS.map((k) => <option key={k.v} value={k.v}>{k.l}</option>)}</select></label>
            {T("size", "Taille", 200)}
            <label className="grid gap-1"><span className="lbl">Difficulté (1 à 5)</span>
              <select className="field" value={d.difficulty} disabled={busy} onChange={(e) => set("difficulty", Number(e.target.value))} data-testid="select-map-difficulty">
                {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} sur 5</option>)}</select></label>
            {T("biomes", "Biomes", 400)}
            {T("transfers", "Transferts", 400)}
            <div className="sm:col-span-2">{T("specials", "Créatures spéciales", 400)}</div>
          </div>
          <label className="grid gap-1"><span className="lbl">Résumé (cartes et bannière) — {d.blurb.length}/1000</span>
            <textarea className="field" rows={2} maxLength={1000} value={d.blurb} disabled={busy} onChange={(e) => set("blurb", e.target.value)} data-testid="input-map-blurb" /></label>
          <label className="grid gap-1"><span className="lbl">Description longue (onglet Aperçu) — {d.description.length}/10000</span>
            <textarea className="field" rows={6} maxLength={10000} value={d.description} disabled={busy} onChange={(e) => set("description", e.target.value)} data-testid="input-map-description" /></label>
          <div className="grid md:grid-cols-3 gap-3">
            {L("creatures", "Créatures", "une par ligne")}
            {L("zones", "Zones clés", "une par ligne")}
            {L("rules", "Règles", "une par ligne")}
          </div>

          <section className="grid gap-2" aria-label="Liens de localisation">
            <h3 className="text-lg font-bold text-primary">Localisation des ressources et dinos</h3>
            <p className="text-xs text-muted-foreground">Une ou deux adresses de sites de localisation. Chaque lien est facultatif ; videz le champ pour le retirer. Les visiteurs les ouvriront dans un nouvel onglet.</p>
            <div className="grid sm:grid-cols-2 gap-3">
              {T("resourcesUrl", "Lien de localisation des ressources", 2048)}
              {T("dinosUrl", "Lien de localisation des dinos", 2048)}
            </div>
          </section>

          <section className="grid gap-2">
            <h3 className="text-lg font-bold text-primary">Image de couverture</h3>
            <div className="grid sm:grid-cols-[260px_1fr] gap-3 items-start">
              <Thumb im={cover} />
              <div className="grid gap-2">
                <input type="file" accept="image/png,image/jpeg,image/webp" className="field" aria-label="Choisir une image de couverture" disabled={busy || cover.uploading} onChange={(e) => { pickCover(e.target.files?.[0]); e.target.value = ""; }} data-testid="input-map-cover-file" />
                <input className="field" maxLength={2048} placeholder="…ou adresse https:// de l'image" value={cover.blob ? "" : cover.value} disabled={busy || cover.uploading} aria-label="Adresse de l'image de couverture"
                  onChange={(e) => { const old = live.current.cover; drop(old); setCover({ id: old.id, value: e.target.value.trim(), preview: e.target.value.trim() }); }} data-testid="input-map-cover-url" />
                <p className="text-xs text-muted-foreground">PNG, JPEG ou WebP, 10 Mio maximum. La couverture apparaît toujours en premier dans la galerie.</p>
                {cover.blob && <button type="button" className="btn btn-ghost btn-sm justify-self-start" disabled={busy || cover.uploading} onClick={() => { drop(cover); setCover(mkImg(base.image)); }} data-testid="button-map-cover-cancel">Annuler le nouveau fichier</button>}
              </div>
            </div>
          </section>

          <section className="grid gap-2">
            <h3 className="text-lg font-bold text-primary">Galerie ({gal.length}/{MAX_GALLERY})</h3>
            {gal.length === 0 ? <p className="text-sm text-muted-foreground">Aucune image supplémentaire.</p> : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">{gal.map((g) => <Thumb key={g.id} im={g} onRemove={() => removeGal(g)} />)}</div>
            )}
            <div className="flex flex-col sm:flex-row gap-2">
              <input type="file" multiple accept="image/png,image/jpeg,image/webp" className="field sm:flex-1" aria-label="Ajouter des fichiers à la galerie" disabled={busy || gal.length >= MAX_GALLERY} onChange={(e) => { pickGallery(e.target.files); e.target.value = ""; }} data-testid="input-map-gallery-file" />
              <div className="flex gap-2 sm:flex-1">
                <input className="field" maxLength={2048} placeholder="Adresse https://" value={url} disabled={busy} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addUrl(); } }} aria-label="Adresse d'une image de galerie" data-testid="input-map-gallery-url" />
                <button type="button" className="btn btn-ghost btn-sm" onClick={addUrl} disabled={busy || !url.trim()} data-testid="button-map-gallery-add-url"><Plus className="h-4 w-4" /> Ajouter</button>
              </div>
            </div>
          </section>

          {err && <p role="alert" className="text-sm font-bold text-destructive" data-testid="status-map-error">{err}</p>}
          <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
            <button type="button" className="btn btn-primary" onClick={save} disabled={busy || uploading || !dirty} data-testid="button-map-save">
              {saving ? "Enregistrement…" : uploading ? "Envoi des images…" : "Enregistrer"}
            </button>
            <button type="button" className="btn btn-ghost" onClick={close} disabled={saving} data-testid="button-map-cancel">{dirty ? "Annuler les modifications" : "Fermer"}</button>
            <span className="text-xs text-muted-foreground" role="status" data-testid="status-map-dirty">{uploading ? "Envoi d'images en cours…" : dirty ? "Modifications non enregistrées." : "Aucune modification."}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MapEditButton({ map, className = "btn btn-ghost btn-sm", label = "Modifier cette map" }: { map: SiteMap; className?: string; label?: string }) {
  const s = useGetSession();
  const [open, setOpen] = useState(false);
  if (!s.data?.isOwner) return null;
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)} data-testid={`button-edit-map-${map.slug}`}><Pencil className="h-4 w-4" /> {label}</button>
      {open && createPortal(<Editor map={map} onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}
