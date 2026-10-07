import { useState } from "react";
import { useSaveGallery, type TribeDetail } from "@workspace/api-client-react";
import { errMsg, useWrite } from "@/lib/helpers";
import { imageAccept, ImagePreview, useTribeImageUpload, validateImage } from "./tribe-image-upload";

export function TribeGalleryEditor({t}: {t: TribeDetail}) {
  const w = useWrite(t.id, "Galerie enregistrée");
  const save = useSaveGallery(w);
  const upload = useTribeImageUpload();
  const [images, setImages] = useState<{url: string; file?: File}[]>(t.gallery.map(url => ({url})));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  async function add(files: File[]) {
    setError("");
    if (!files.length) return;
    if (images.length+files.length>10) {setError("Dix images maximum. Retirez une photo ou sélectionnez moins de fichiers."); return;}
    try {files.forEach(f => validateImage(f, "gallery"));}
    catch (e) {setError(errMsg(e)); return;}
    setBusy(true);
    try {
      for (const file of files) {
        const url = await upload(file, "gallery");
        setImages(current => [...current, {url, file}]); setDirty(true);
      }
    } catch (e) {setError(`${errMsg(e)} Les fichiers déjà envoyés restent dans la sélection.`);}
    finally {setBusy(false);}
  }
  return <section className="panel" data-testid="section-gallery">
    <h2 className="text-2xl font-bold text-primary mb-4">Galerie</h2>
    <p className="text-sm mb-3">Ajoutez des photos depuis vos fichiers ({images.length}/10). PNG, JPEG ou WebP, 10 Mo maximum par image.</p>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
      {images.map((image, i) => <div key={image.url} className="grid gap-2" data-testid={`gallery-image-${i}`}>
        <ImagePreview url={image.url} file={image.file} alt={`Photo de la tribu ${i+1}`} />
        <button type="button" className="btn btn-ghost btn-sm" disabled={busy || save.isPending} data-testid={`button-remove-image-${i}`}
          onClick={() => {setImages(current => current.filter((_, n) => n!==i)); setDirty(true);}}>Retirer la photo {i+1}</button>
      </div>)}
    </div>
    <label className="lbl" htmlFor="g-files">Ajouter des images</label>
    <input id="g-files" type="file" multiple accept={imageAccept} className="field" disabled={busy || save.isPending || images.length>=10}
      data-testid="input-gallery-files" onChange={(e) => {const files=Array.from(e.target.files ?? []); e.target.value=""; void add(files);}} />
    {busy && <p className="text-sm mt-2" role="status">Envoi et vérification des images...</p>}
    {error && <p className="text-sm text-destructive mt-2" role="alert">{error}</p>}
    {dirty && <p className="text-sm text-muted-foreground mt-2">Enregistrez la galerie pour appliquer les ajouts et les retraits.</p>}
    <button type="button" className="btn btn-primary mt-3" disabled={busy || save.isPending} data-testid="button-save-gallery"
      onClick={() => save.mutate({id: t.id, data: {urls: images.map(image => image.url)}}, {onSuccess: () => setDirty(false)})}>
      {save.isPending ? "Enregistrement..." : "Enregistrer la galerie"}
    </button>
  </section>;
}