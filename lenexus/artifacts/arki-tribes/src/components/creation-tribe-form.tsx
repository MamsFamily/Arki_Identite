import { useState } from "react";
import type { MemberInput, Options, PlaceInput, Progression, TribeCreationInput } from "@workspace/api-client-react";
import { emptyTribe, TribeForm } from "./parts";
import { DiscordPlayerPicker } from "./discord-player-picker";
import { imageAccept, ImagePreview, useTribeImageUpload, validateImage } from "./tribe-image-upload";
import { errMsg } from "@/lib/helpers";

const blankMember: MemberInput = {userId: "", name: "", role: "", manager: false};
const blankPlace: PlaceInput = {kind: "outpost", name: "", map: "", coords: ""};
const blankProgression: Progression = {boss: [], notes: [], pendingBoss: [], pendingNotes: []};

export function CreationTribeForm({owner, options, pending, onSubmit}: {
  owner: {id: string; name: string}; options?: Options; pending: boolean; onSubmit: (value: TribeCreationInput)=>void;
}) {
  const [members, setMembers] = useState<MemberInput[]>([{userId: owner.id, name: owner.name, role: "Propriétaire", manager: true}]);
  const [member, setMember] = useState<MemberInput>(blankMember);
  const [places, setPlaces] = useState<PlaceInput[]>([]);
  const [place, setPlace] = useState<PlaceInput>(blankPlace);
  const [images, setImages] = useState<{url: string; file: File}[]>([]);
  const [progression, setProgression] = useState<Progression>(blankProgression);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const upload = useTribeImageUpload();
  const disabled = pending || uploading;
  const maps = place.kind==="premium" ? options?.premiumMaps : options?.maps;
  async function addImages(files: File[]) {
    setError("");
    if (!files.length) return;
    if (images.length+files.length>10) {setError("Dix photos maximum."); return;}
    try {files.forEach(file => validateImage(file, "gallery"));} catch(e) {setError(errMsg(e)); return;}
    setUploading(true);
    try {
      for (const file of files) {
        const url = await upload(file, "gallery");
        setImages(current => [...current, {url, file}]);
      }
    } catch(e) {setError(`${errMsg(e)} Les images déjà prêtes sont conservées.`);}
    finally {setUploading(false);}
  }
  const toggleProgression = (key: keyof Progression, value: string) => {
    const opposite: Record<keyof Progression,keyof Progression> = {boss:"pendingBoss",pendingBoss:"boss",notes:"pendingNotes",pendingNotes:"notes"};
    setProgression(current => {
      const selected=current[key].includes(value);
      return {...current,[key]:selected ? current[key].filter(x=>x!==value) : [...current[key],value],
        [opposite[key]]:selected ? current[opposite[key]] : current[opposite[key]].filter(x=>x!==value)};
    });
  };
  return <TribeForm initial={emptyTribe} options={options} pending={disabled} submitLabel="Créer la fiche complète"
    onSubmit={value => {
      setError("");
      if (members.some(m=>!m.name.trim())) {setError("Indiquez un nom en jeu pour chaque membre."); return;}
      onSubmit({...value, members, places, gallery:images.map(image=>image.url), progression});
    }}>
    <section className="panel" data-testid="section-creation-members">
      <h2 className="text-xl font-bold text-primary mb-3">Membres et noms en jeu</h2>
      <p className="text-sm text-muted-foreground mb-3">Vous êtes le référent de la tribu. Choisissez les autres joueurs dans le serveur Discord, puis ajoutez-les à la fiche.</p>
      <div className="grid gap-3 mb-4">
        {members.map((m,i) => <div key={m.userId} className="grid md:grid-cols-4 gap-2 items-end">
          <div><label className="lbl" htmlFor={`draft-member-name-${i}`}>{m.userId===owner.id ? "Votre nom en jeu" : "Nom en jeu"}</label>
            <input id={`draft-member-name-${i}`} className="field" maxLength={80} value={m.name} disabled={disabled}
              onChange={e => setMembers(current=>current.map((v,n)=>n===i ? {...v,name:e.target.value} : v))} /></div>
          <div><label className="lbl" htmlFor={`draft-member-role-${i}`}>Rôle dans la tribu</label>
            <input id={`draft-member-role-${i}`} className="field" maxLength={80} value={m.role} disabled={disabled}
              onChange={e => setMembers(current=>current.map((v,n)=>n===i ? {...v,role:e.target.value} : v))} /></div>
          <label className="flex gap-2 items-center text-sm pb-2"><input type="checkbox" checked={m.manager} disabled={disabled || m.userId===owner.id}
            onChange={e=>setMembers(current=>current.map((v,n)=>n===i ? {...v,manager:e.target.checked} : v))} />Peut modifier la fiche</label>
          {m.userId!==owner.id && <button type="button" className="btn btn-ghost btn-sm" disabled={disabled} onClick={()=>setMembers(current=>current.filter(v=>v.userId!==m.userId))}>Retirer {m.name}</button>}
        </div>)}
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        <DiscordPlayerPicker value={member.userId} selectedName={member.name} disabled={disabled} onSelect={player=>setMember({...blankMember,userId:player.id,name:player.name})} />
        <div className="grid gap-3 content-start">
          <div><label className="lbl" htmlFor="draft-new-member-name">Nom en jeu</label><input id="draft-new-member-name" data-testid="input-member-name" className="field" maxLength={80} disabled={disabled} value={member.name} onChange={e=>setMember({...member,name:e.target.value})} /></div>
          <div><label className="lbl" htmlFor="draft-new-member-role">Rôle dans la tribu</label><input id="draft-new-member-role" className="field" maxLength={80} disabled={disabled} value={member.role} onChange={e=>setMember({...member,role:e.target.value})} /></div>
          <label className="flex gap-2 items-center text-sm"><input type="checkbox" data-testid="checkbox-member-manager" disabled={disabled} checked={member.manager} onChange={e=>setMember({...member,manager:e.target.checked})} />Peut modifier la fiche</label>
          <button type="button" className="btn btn-ghost" data-testid="button-add-draft-member" disabled={disabled || !member.userId || !member.name.trim() || members.some(m=>m.userId===member.userId) || members.length>=100}
            onClick={()=>{setMembers(current=>[...current,member]); setMember(blankMember);}}>Ajouter ce membre à la fiche</button>
          {members.some(m=>m.userId===member.userId) && <p className="text-sm">Ce joueur figure déjà dans la tribu.</p>}
        </div>
      </div>
    </section>
    <section className="panel" data-testid="section-creation-places">
      <h2 className="text-xl font-bold text-primary mb-3">Avant-postes et bases premium</h2>
      <ul className="grid gap-2 mb-4">{places.map((p,i)=><li key={i} className="flex flex-wrap gap-2 items-center">
        <span className="chip">{p.kind==="premium" ? "Premium" : "Avant-poste"}</span><b>{p.name}</b><span className="text-sm flex-1">{p.map} {p.coords}</span>
        <button type="button" className="btn btn-ghost btn-sm" disabled={disabled} onClick={()=>setPlaces(current=>current.filter((_,n)=>n!==i))}>Retirer</button>
      </li>)}</ul>
      <div className="grid md:grid-cols-4 gap-3">
        <div><label className="lbl" htmlFor="draft-place-kind">Type</label><select id="draft-place-kind" data-testid="select-place-kind" className="field" disabled={disabled} value={place.kind}
          onChange={e=>setPlace({...place,kind:e.target.value as PlaceInput["kind"],map:""})}><option value="outpost">Avant-poste</option><option value="premium">Base premium</option></select></div>
        <div><label className="lbl" htmlFor="draft-place-name">Nom du lieu</label><input id="draft-place-name" data-testid="input-place-name" className="field" maxLength={80} disabled={disabled} value={place.name} onChange={e=>setPlace({...place,name:e.target.value})} /></div>
        <div><label className="lbl" htmlFor="draft-place-map">Carte</label><select id="draft-place-map" data-testid="select-place-map" className="field" disabled={disabled} value={place.map}
          onChange={e=>setPlace({...place,map:e.target.value})}><option value="">Non précisée</option>{maps?.map(map=><option key={map}>{map}</option>)}</select></div>
        <div><label className="lbl" htmlFor="draft-place-coords">Coordonnées</label><input id="draft-place-coords" className="field" maxLength={80} disabled={disabled} value={place.coords} onChange={e=>setPlace({...place,coords:e.target.value})} /></div>
      </div>
      <button type="button" className="btn btn-ghost mt-3" data-testid="button-add-draft-place" disabled={disabled || !place.name.trim() || places.length>=100}
        onClick={()=>{setPlaces(current=>[...current,place]); setPlace(blankPlace);}}>Ajouter ce lieu à la fiche</button>
    </section>
    <section className="panel" data-testid="section-creation-gallery">
      <h2 className="text-xl font-bold text-primary mb-3">Galerie ({images.length}/10)</h2>
      <p className="text-sm mb-3">PNG, JPEG ou WebP, 10 Mo maximum par photo. La première photo illustre la base principale.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-3">{images.map((image,i)=><div key={image.url} className="grid gap-2">
        <ImagePreview url={image.url} file={image.file} alt={`Photo ${i+1}`} /><button type="button" className="btn btn-ghost btn-sm" disabled={disabled} onClick={()=>setImages(current=>current.filter((_,n)=>n!==i))}>Retirer la photo {i+1}</button>
      </div>)}</div>
      <label className="lbl" htmlFor="draft-gallery-files">Ajouter des fichiers</label>
      <input id="draft-gallery-files" data-testid="input-gallery-files" className="field" type="file" multiple accept={imageAccept} disabled={disabled || images.length>=10}
        onChange={e=>{const files=Array.from(e.target.files || []); e.target.value=""; void addImages(files);}} />
      {uploading && <p role="status" className="mt-2 text-sm">Envoi et vérification des photos...</p>}
    </section>
    <section className="panel" data-testid="section-creation-progression">
      <h2 className="text-xl font-bold text-primary mb-3">Progression</h2>
      <div className="grid md:grid-cols-2 gap-4">
        {(["boss","pendingBoss","notes","pendingNotes"] as const).map(key=><fieldset key={key}>
          <legend className="lbl">{{boss:"Boss vaincus",pendingBoss:"Boss en cours",notes:"Notes obtenues",pendingNotes:"Notes en cours"}[key]}</legend>
          <div className="flex flex-wrap gap-2">
            {(key.toLowerCase().includes("boss") ? options?.boss : options?.notes)?.map(value=><label key={value} className={`chip cursor-pointer ${progression[key].includes(value) ? "bg-primary text-primary-foreground" : ""}`}>
              <input type="checkbox" data-testid={`check-${key}-${value}`} disabled={disabled} checked={progression[key].includes(value)} onChange={()=>toggleProgression(key,value)} />{value}
            </label>)}
            {!(key.toLowerCase().includes("boss") ? options?.boss : options?.notes)?.length && <p className="text-sm text-muted-foreground">Aucune option disponible.</p>}
          </div>
        </fieldset>)}
      </div>
    </section>
    {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
    <p className="text-sm text-muted-foreground">Tous ces éléments seront enregistrés ensemble lors de la création. Vous pourrez les modifier ensuite.</p>
  </TribeForm>;
}