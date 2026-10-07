import { useEffect, useState } from "react";
import { usePublishTribeImage, useRequestTribeImageUpload } from "@workspace/api-client-react";
import { errMsg, useWrite } from "@/lib/helpers";

export const imageAccept = "image/png,image/jpeg,image/webp";
export function validateImage(file: File, kind: "logo"|"cover"|"gallery") {
  if (!imageAccept.split(",").includes(file.type)) throw new Error("Choisissez une image PNG, JPEG ou WebP.");
  if (!file.size || file.size > (kind === "logo" ? 5 : 10)*1024*1024)
    throw new Error(kind === "logo" ? "Logo : 5 Mo maximum." : "Photo : 10 Mo maximum.");
}
export function useTribeImageUpload() {
  const w = useWrite();
  const request = useRequestTribeImageUpload({request: w.request});
  const publish = usePublishTribeImage({request: w.request});
  return async (file: File, kind: "logo"|"cover"|"gallery") => {
    validateImage(file, kind);
    const ticket = await request.mutateAsync({data: {kind, size: file.size, contentType: file.type as "image/png"|"image/jpeg"|"image/webp"}});
    const response = await fetch(ticket.uploadURL, {method: "PUT", headers: {"Content-Type": file.type}, body: file});
    if (!response.ok) throw new Error("L'envoi du fichier a échoué. Réessayez.");
    const image = await publish.mutateAsync({data: {objectPath: ticket.objectPath}});
    return image.url;
  };
}
export function ImagePreview({url, file, alt}: {url: string; file?: File|null; alt: string}) {
  const [local, setLocal] = useState("");
  useEffect(() => {
    if (!file) {setLocal(""); return;}
    const value = URL.createObjectURL(file);
    setLocal(value);
    return () => URL.revokeObjectURL(value);
  }, [file]);
  const source = file ? local : url;
  if (!source) return <div className="w-full h-32 rounded-lg bg-black/20" role="img" aria-label={alt} />;
  return <img src={source} alt={alt} className="w-full h-32 object-contain rounded-lg bg-black/20" />;
}
function TribeFilePicker({value, disabled, onChange, onBusy, kind}: {
  kind: "logo" | "cover";
  value: string; disabled: boolean; onChange: (url: string)=>void; onBusy: (busy: boolean)=>void;
}) {
  const upload = useTribeImageUpload();
  const [file, setFile] = useState<File|null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const title = kind === "logo" ? "Photo de profil de la tribu" : "Image de fond de la tribu";
  const item = kind === "logo" ? "Photo de profil" : "Image de fond";
  async function pick(next?: File) {
    if (!next) return;
    setError("");
    try {validateImage(next, kind);} catch (e) {setError(errMsg(e)); return;}
    const previous = file;
    setFile(next); setBusy(true); onBusy(true); setReady(false);
    try {onChange(await upload(next, kind)); setReady(true);}
    catch (e) {setFile(previous); setError(errMsg(e));}
    finally {setBusy(false); onBusy(false);}
  }
  return <div className="grid gap-2">
    <label className="lbl" htmlFor={`f-${kind}-file`}>{title}</label>
    {(value || file) && <div className={kind === "logo" ? "max-w-48" : "max-w-md"}><ImagePreview url={value} file={file} alt={`Aperçu : ${title}`} /></div>}
    <input id={`f-${kind}-file`} type="file" accept={imageAccept} disabled={disabled || busy} className="field min-w-0" data-testid={`input-${kind}-file`}
      onChange={(e) => {const next=e.target.files?.[0]; e.target.value=""; void pick(next);}} />
    <p className="text-xs text-muted-foreground">Depuis votre ordinateur ou téléphone. PNG, JPEG ou WebP, {kind === "logo" ? 5 : 10} Mo maximum.</p>
    {busy && <p role="status">Envoi de l’image...</p>}
    {ready && <p role="status" className="text-sm">{item} prête. Enregistrez la fiche pour appliquer ce changement.</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {value && <button type="button" className="btn btn-ghost btn-sm justify-self-start" disabled={disabled || busy} data-testid={`button-remove-${kind}`}
      onClick={() => {onChange(""); setFile(null); setReady(false); setError("");}}>Retirer {kind === "logo" ? "la photo de profil" : "l’image de fond"}</button>}
  </div>;
}
type PickerProps = { value: string; disabled: boolean; onChange: (url: string) => void; onBusy: (busy: boolean) => void };
export function LogoFilePicker(props: PickerProps) { return <TribeFilePicker {...props} kind="logo" />; }
export function CoverFilePicker(props: PickerProps) { return <TribeFilePicker {...props} kind="cover" />; }