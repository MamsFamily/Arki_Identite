import { useState, type ReactNode } from "react";
import { Link, useLocation, useParams } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetTribeQueryKey, useAddPlace, useDeleteTribe, useGetOptions, useGetTribe, useRemoveMember, useRemovePlace,
  useSaveMember, useSaveProgression, useTransferOwnership, useUpdateTribe,
  type Progression, type TribeDetail,
} from "@workspace/api-client-react";
import { BackLink, Confirm, ErrorBox, PageTitle, Skeletons, TribeForm } from "@/components/parts";
import { errMsg, useSeo, useWrite } from "@/lib/helpers";
import { TribeGalleryEditor as Gallery } from "@/components/tribe-gallery-editor";
import { DiscordPlayerPicker } from "@/components/discord-player-picker";

const Sect = ({ title, children, id }: { title: string; children: ReactNode; id: string }) => (
  <section className="panel" data-testid={`section-${id}`}>
    <h2 className="text-2xl font-bold text-primary mb-4">{title}</h2>
    {children}
  </section>
);

function Members({ t }: { t: TribeDetail }) {
  const w = useWrite(t.id, "Membre enregistré");
  const rw = useWrite(t.id, "Membre retiré");
  const [f, setF] = useState({ userId: "", name: "", role: "", manager: false });
  const save = useSaveMember(w);
  const remove = useRemoveMember(rw);
  const valid = /^[0-9]{17,20}$/.test(f.userId);
  return (
    <Sect id="members" title="Membres">
      <ul className="divide-y divide-border mb-5">
        {t.members.map((m, i) => (
          <li key={m.userId ?? i} className="py-2 flex flex-wrap items-center gap-2" data-testid={`row-member-${i}`}>
            <span className="font-bold">{m.name}</span>
            <span className="text-sm text-muted-foreground flex-1">{m.role}{m.manager ? " - gérant" : ""}</span>
            {m.userId && (
              <>
                <button className="btn btn-ghost btn-sm" data-testid={`button-edit-member-${i}`} onClick={() => setF({ userId: m.userId!, name: m.name, role: m.role, manager: m.manager })}>Modifier</button>
                <Confirm label="Retirer" title={`Retirer ${m.name} ?`} description="Ce membre perdra son accès à la tribu." confirmLabel="Retirer" testid={`button-remove-member-${i}`} onConfirm={() => remove.mutate({ id: t.id, userId: m.userId! })} />
              </>
            )}
          </li>
        ))}
      </ul>
      <form className="grid md:grid-cols-4 gap-3 items-end" onSubmit={(e) => {
        e.preventDefault();
        const existing = t.members.find((m) => m.userId === f.userId);
        save.mutate({ id: t.id, data: { ...f, manager: t.canManage ? f.manager : existing?.manager ?? false } }, { onSuccess: () => setF({ userId: "", name: "", role: "", manager: false }) });
      }}>
        <DiscordPlayerPicker tribeId={t.id} value={f.userId} selectedName={f.name} disabled={save.isPending} onSelect={(player) => {
          const existing=t.members.find(member=>member.userId===player.id);
          setF({userId:player.id,name:existing?.name || player.name,role:existing?.role || "",manager:existing?.manager || false});
        }} />
        <div><label className="lbl" htmlFor="m-name">Nom</label><input id="m-name" maxLength={80} className="field" data-testid="input-member-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div><label className="lbl" htmlFor="m-role">Rôle</label><input id="m-role" maxLength={80} className="field" data-testid="input-member-role" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} /></div>
        <div className="flex items-center gap-3">
          {t.canManage && <label className="flex items-center gap-1 text-sm font-bold"><input type="checkbox" data-testid="checkbox-member-manager" checked={f.manager} onChange={(e) => setF({ ...f, manager: e.target.checked })} />Gérant</label>}
          <button className="btn btn-primary" disabled={!valid || !f.name.trim() || save.isPending} data-testid="button-save-member">Enregistrer</button>
        </div>
      </form>
    </Sect>
  );
}

function Places({ t, maps, premiumMaps }: { t: TribeDetail; maps: string[]; premiumMaps: string[] }) {
  const w = useWrite(t.id, "Lieu ajouté");
  const rw = useWrite(t.id, "Lieu retiré");
  const add = useAddPlace(w);
  const remove = useRemovePlace(rw);
  const [f, setF] = useState({ kind: "outpost" as "outpost" | "premium", name: "", map: "", coords: "" });
  const list = f.kind === "outpost" ? maps : premiumMaps;
  return (
    <Sect id="places" title="Avant-postes et lieux premium">
      <ul className="divide-y divide-border mb-5">
        {t.places.length === 0 && <li className="text-sm text-muted-foreground">Aucun lieu enregistré.</li>}
        {t.places.map((p) => (
          <li key={`${p.kind}-${p.id}`} className="py-2 flex flex-wrap items-center gap-2" data-testid={`row-place-${p.kind}-${p.id}`}>
            <span className="chip">{p.kind === "outpost" ? "Avant-poste" : "Premium"}</span>
            <b>{p.name}</b><span className="text-sm text-muted-foreground flex-1">{p.map} <span className="font-mono">{p.coords}</span></span>
            <Confirm label="Retirer" title={`Retirer ${p.name} ?`} description="Ce lieu sera supprimé de la fiche." confirmLabel="Retirer" testid={`button-remove-place-${p.id}`} onConfirm={() => remove.mutate({ id: t.id, kind: p.kind, placeId: p.id })} />
          </li>
        ))}
      </ul>
      <form className="grid md:grid-cols-5 gap-3 items-end" onSubmit={(e) => {
        e.preventDefault();
        add.mutate({ id: t.id, data: f }, { onSuccess: () => setF({ ...f, name: "", coords: "" }) });
      }}>
        <div><label className="lbl" htmlFor="p-kind">Type</label>
          <select id="p-kind" className="field" data-testid="select-place-kind" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as "outpost" | "premium", map: "" })}>
            <option value="outpost">Avant-poste</option><option value="premium">Premium</option>
          </select></div>
        <div><label className="lbl" htmlFor="p-name">Nom</label><input id="p-name" required maxLength={80} className="field" data-testid="input-place-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div><label className="lbl" htmlFor="p-map">Carte</label>
          <select id="p-map" className="field" data-testid="select-place-map" value={f.map} onChange={(e) => setF({ ...f, map: e.target.value })}>
            <option value="">Non précisée</option>{list.map((m) => <option key={m} value={m}>{m}</option>)}
          </select></div>
        <div><label className="lbl" htmlFor="p-co">Coordonnées</label><input id="p-co" maxLength={80} className="field" data-testid="input-place-coords" value={f.coords} onChange={(e) => setF({ ...f, coords: e.target.value })} /></div>
        <button className="btn btn-primary" disabled={add.isPending || !f.name.trim()} data-testid="button-add-place">Ajouter</button>
      </form>
    </Sect>
  );
}

function ProgressionEditor({ t, boss, notes }: { t: TribeDetail; boss: string[]; notes: string[] }) {
  const w = useWrite(t.id, "Progression enregistrée");
  const save = useSaveProgression(w);
  const [p, setP] = useState<Progression>(t.progression);
  const toggle = (k: keyof Progression, v: string) =>
    setP((o) => {
      const opposite: Record<keyof Progression, keyof Progression> = {
        boss: "pendingBoss", pendingBoss: "boss", notes: "pendingNotes", pendingNotes: "notes",
      };
      const selected = o[k].includes(v);
      return {
        ...o,
        [k]: selected ? o[k].filter((x) => x !== v) : [...o[k], v],
        [opposite[k]]: selected ? o[opposite[k]] : o[opposite[k]].filter((x) => x !== v),
      };
    });
  const group = (k: keyof Progression, title: string, base: string[]) => {
    const all = Array.from(new Set([...base, ...p[k]]));
    return (
      <fieldset>
        <legend className="lbl">{title}</legend>
        <div className="flex flex-wrap gap-2">
          {all.length === 0 && <span className="text-sm text-muted-foreground">Aucune option disponible.</span>}
          {all.map((v) => (
            <label key={v} className={`chip cursor-pointer ${p[k].includes(v) ? "bg-primary text-primary-foreground" : ""}`}>
              <input type="checkbox" className="sr-only" data-testid={`check-${k}-${v}`} checked={p[k].includes(v)} onChange={() => toggle(k, v)} />{v}
            </label>
          ))}
        </div>
      </fieldset>
    );
  };
  return (
    <Sect id="progression" title="Progression">
      <div className="grid md:grid-cols-2 gap-5">
        {group("boss", "Boss vaincus", boss)}
        {group("pendingBoss", "Boss en cours", boss)}
        {group("notes", "Notes obtenues", notes)}
        {group("pendingNotes", "Notes en cours", notes)}
      </div>
      <button className="btn btn-primary mt-4" disabled={save.isPending} data-testid="button-save-progression" onClick={() => save.mutate({ id: t.id, data: p })}>Enregistrer la progression</button>
    </Sect>
  );
}

function Danger({ t }: { t: TribeDetail }) {
  const [, nav] = useLocation();
  const qc = useQueryClient();
  const tw = useWrite(t.id, "Propriété transférée");
  const dw = useWrite(t.id, "Tribu supprimée");
  const transfer = useTransferOwnership(tw);
  const del = useDeleteTribe({
    request: dw.request,
    mutation: {
      onError: dw.mutation.onError,
      onSuccess: () => {
        qc.removeQueries({ queryKey: getGetTribeQueryKey(t.id) });
        dw.mutation.onSuccess();
        nav("/mon-espace");
      },
    },
  });
  const [uid, setUid] = useState("");
  return (
    <Sect id="danger" title="Zone sensible">
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <p className="text-sm mb-2">Transférer la propriété à un autre membre. Vous perdrez le rôle de propriétaire.</p>
          <label className="lbl" htmlFor="tr">Identifiant Discord du nouveau propriétaire</label>
          <input id="tr" className="field font-mono mb-3" inputMode="numeric" data-testid="input-transfer" value={uid} onChange={(e) => setUid(e.target.value.trim())} />
          <Confirm label="Transférer la propriété" title="Transférer la propriété ?" description={`La propriété de ${t.name} passera au compte ${uid}. Cette action est difficile à annuler.`} confirmLabel="Transférer" testid="button-transfer" className="btn btn-ghost" disabled={!/^[0-9]{17,20}$/.test(uid) || transfer.isPending} onConfirm={() => transfer.mutate({ id: t.id, data: { userId: uid } }, { onSuccess: () => setUid("") })} />
        </div>
        <div>
          <p className="text-sm mb-2">Supprimer définitivement la fiche, ses membres, lieux, galerie et progression.</p>
          <Confirm label="Supprimer la tribu" title={`Supprimer ${t.name} ?`} description="Suppression définitive. Toutes les données de la fiche seront perdues." confirmLabel="Supprimer définitivement" testid="button-delete-tribe" className="btn btn-danger" disabled={del.isPending} onConfirm={() => del.mutate({ id: t.id })} />
        </div>
      </div>
    </Sect>
  );
}

export default function Manage() {
  const id = Number(useParams().id);
  const { data: t, isLoading, isError, error, refetch } = useGetTribe(id);
  const opts = useGetOptions({ tribeId: id });
  const pw = useWrite(id, "Profil enregistré");
  const update = useUpdateTribe(pw);
  useSeo(t ? `Gérer ${t.name}` : "Gérer la tribu", "Modifier le profil, les membres, les lieux et la progression de votre tribu.");
  if (isLoading) return <Skeletons n={3} />;
  if (isError || !t) return <ErrorBox message={errMsg(error)} onRetry={() => refetch()} />;
  if (!t.canEdit)
    return (
      <div className="panel" data-testid="status-forbidden">
        <p className="font-bold">Accès refusé</p>
        <p className="text-sm mt-1">Vous n'avez pas les droits d'édition sur cette tribu.</p>
        <Link href={`/tribus/${t.id}`} className="btn btn-ghost mt-3">Voir la fiche publique</Link>
      </div>
    );
  return (
    <div className="grid gap-6">
      <div><BackLink href="/mon-espace">Mon espace</BackLink></div>
      <PageTitle kicker="Gestion" title={t.name}>
        <Link href={`/tribus/${t.id}`} className="underline" data-testid="link-public-sheet">Voir la fiche publique</Link>
      </PageTitle>
      <Sect id="profile" title="Profil">
        <TribeForm
          key={t.id}
          initial={{ name: t.name, description: t.description, motto: t.motto, objective: t.objective, color: t.color, logoUrl: t.logoUrl, coverUrl: t.coverUrl ?? "", base: t.base, map: t.map, coords: t.coords, tags: t.tags, recruiting: t.recruiting, recruitmentText: t.recruitmentText }}
          options={opts.data} pending={update.isPending} submitLabel="Enregistrer le profil"
          onSubmit={(v) => update.mutate({ id: t.id, data: v })}
        />
      </Sect>
      <Members key={"m" + t.id} t={t} />
      <Places key={"p" + t.id} t={t} maps={opts.data?.maps ?? []} premiumMaps={opts.data?.premiumMaps ?? []} />
      <Gallery key={"g" + t.id} t={t} />
      <ProgressionEditor key={"b" + t.id} t={t} boss={opts.data?.boss ?? []} notes={opts.data?.notes ?? []} />
      {t.canManage && <Danger key={"d" + t.id} t={t} />}
    </div>
  );
}
