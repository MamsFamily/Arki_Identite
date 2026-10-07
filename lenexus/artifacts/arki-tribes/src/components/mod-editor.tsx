import { useState, type FormEvent } from "react";
import type { SiteMod, SiteModInput } from "@workspace/api-client-react";
import { MOD_FILTERS } from "@/data/nexus";

export function ModEditor({ mod, busy, onSave, onCancel }: {
  mod: SiteMod | null; busy: boolean; onSave: (data: SiteModInput) => void; onCancel: () => void;
}) {
  const [data, setData] = useState<SiteModInput>({
    name: mod?.name ?? "", category: mod?.category ?? "Divers", description: mod?.description ?? "",
    image: mod?.image ?? "", sourceUrl: mod?.sourceUrl ?? "",
  });
  const update = (key: keyof SiteModInput, value: string) => setData((old) => ({ ...old, [key]: value }));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSave({ ...data, name: data.name.trim(), description: data.description.trim(), image: data.image.trim(), sourceUrl: data.sourceUrl.trim() });
  };
  return (
    <form onSubmit={submit} className="glass p-5 sm:p-7 grid gap-4 mb-6" data-testid="form-mod">
      <h2 className="text-xl">{mod ? "Modifier le mod" : "Ajouter un mod"}</h2>
      <div className="grid sm:grid-cols-2 gap-4">
        <label className="grid gap-2 text-sm">Nom du mod
          <input className="field" required maxLength={120} value={data.name} onChange={(e) => update("name", e.target.value)} data-testid="input-mod-name" />
        </label>
        <label className="grid gap-2 text-sm">Catégorie
          <select className="field" value={data.category} onChange={(e) => update("category", e.target.value)} data-testid="select-mod-category">
            {MOD_FILTERS.filter((c) => c !== "Tous").map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
      </div>
      <label className="grid gap-2 text-sm">Description
        <textarea className="field min-h-24" required maxLength={2000} value={data.description} onChange={(e) => update("description", e.target.value)} data-testid="input-mod-description" />
      </label>
      <label className="grid gap-2 text-sm">Lien de l’image (facultatif)
        <input className="field" maxLength={2048} placeholder="https://…" value={data.image} onChange={(e) => update("image", e.target.value)} data-testid="input-mod-image" />
        <span className="text-xs text-muted-foreground">URL HTTPS d’une image. Vous pouvez conserver le chemin du visuel existant.</span>
      </label>
      <label className="grid gap-2 text-sm">Page officielle du mod (facultatif)
        <input className="field" type="url" maxLength={2048} placeholder="https://www.curseforge.com/…" value={data.sourceUrl} onChange={(e) => update("sourceUrl", e.target.value)} data-testid="input-mod-source" />
      </label>
      <div className="flex flex-wrap gap-3">
        <button className="btn btn-primary" type="submit" disabled={busy} data-testid="button-save-mod">{busy ? "Enregistrement…" : "Enregistrer"}</button>
        <button className="btn btn-ghost" type="button" onClick={onCancel} disabled={busy}>Annuler</button>
      </div>
    </form>
  );
}