import { Link, useParams } from "wouter";
import { useState } from "react";
import { Tabs } from "@/components/nexus";
import { IMG } from "@/data/nexus";
import { useGetTribe } from "@workspace/api-client-react";
import { ErrorBox, Logo, Skeletons } from "@/components/parts";
import { errMsg, fmtDate, intToHex, useSeo } from "@/lib/helpers";
import { TribeHistory } from "@/components/tribe-history";

function GalleryImage({ url, name, index }: { url: string; name: string; index: number }) {
  const [unavailable, setUnavailable] = useState(false);
  let safeUrl = "";
  if (/^\/api\/tribes\/\d+\/images\/[a-f0-9]{64}$/.test(url) || /^\/api\/storage\/objects\/tribe-uploads\/[a-f0-9-]{36}$/.test(url)) safeUrl = url;
  try {
    const parsed = new URL(url);
    if (["http:", "https:"].includes(parsed.protocol)) safeUrl = parsed.href;
  } catch { /* Legacy invalid URLs remain visible as unavailable rather than clickable. */ }
  const image = unavailable || !safeUrl ? (
    <span className="flex items-center justify-center w-full aspect-video rounded border-2 border-border text-xs text-muted-foreground text-center p-2">
      Image indisponible
    </span>
  ) : (
    <img src={safeUrl} alt={`Galerie ${name} ${index + 1}`} loading="lazy" onError={() => setUnavailable(true)} className="w-full aspect-video object-cover rounded border-2 border-border" />
  );
  return safeUrl ? <a href={safeUrl} target="_blank" rel="noreferrer" data-testid={`link-gallery-${index}`}>{image}</a> : image;
}

const TABS = [
  { key: "overview", label: "Aperçu" }, { key: "members", label: "Membres" }, { key: "bases", label: "Bases & créations" },
  { key: "gallery", label: "Galerie" }, { key: "history", label: "Historique" }, { key: "recruit", label: "Recrutement" },
] as const;

export default function TribePage() {
  const id = Number(useParams().id);
  const { data: t, isLoading, isError, error, refetch } = useGetTribe(id);
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("overview");
  useSeo(t ? t.name : "Fiche tribu", t ? t.motto || t.description.slice(0, 150) || `Fiche de la tribu ${t.name}` : "Fiche détaillée d'une tribu ARK.");
  if (isLoading) return <Skeletons n={2} />;
  if (isError || !t) return <ErrorBox message={errMsg(error)} onRetry={() => refetch()} />;
  const tags = t.tags.split(",").map((x) => x.trim()).filter(Boolean);
  const color = intToHex(t.color);
  const Sect = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section className="panel p-5 sm:p-7"><h2 className="text-xl uppercase mb-4">{title}</h2>{children}</section>
  );
  const List = ({ items, empty }: { items: string[]; empty: string }) =>
    items.length ? <div className="flex flex-wrap gap-1.5">{items.map((x) => <span key={x} className="chip">{x}</span>)}</div> : <p className="text-sm text-muted-foreground">{empty}</p>;
  const facts: [string, string][] = [["Map principale", t.map || "-"], ["Base", t.base || "-"], ["Coordonnées", t.coords || "-"], ["Membres", String(t.members.length)]];
  return (
    <div className="grid gap-6">
      <header className="relative overflow-hidden rounded-3xl border isolate rise" style={{ borderColor: `${color}99` }}>
        <img src={t.coverUrl || IMG.aurora} alt="" className="absolute inset-0 w-full h-full object-cover -z-30" data-testid="img-tribe-cover" />
        <div className="absolute inset-0 -z-20" style={{ background: `linear-gradient(115deg, ${color}cc, ${color}33 55%, transparent)` }} />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[#080C16] via-[#080C16]/55 to-[#080C16]/10" />
        <div className="px-5 sm:px-10 pt-28 sm:pt-40 pb-7 flex flex-wrap items-end gap-5">
          <div className="rounded-full p-1.5 bg-[#080C16]/70 ring-2 shrink-0" style={{ boxShadow: `0 0 28px ${color}88`, ["--tw-ring-color" as string]: color }}>
            <div className="rounded-full overflow-hidden"><Logo t={t} size={96} /></div>
          </div>
          <div className="flex-1 min-w-[220px]">
            <div className="flex flex-wrap gap-2 mb-2">
              <span className="chip">Tribu</span>
              <span className="chip" style={t.recruiting ? { borderColor: "#35E6A4", color: "#35E6A4" } : undefined}>{t.recruiting ? "Recrutement ouvert" : "Recrutement fermé"}</span>
            </div>
            <h1 className="text-3xl md:text-5xl uppercase tracking-[.1em]" data-testid="text-tribe-name">{t.name}</h1>
            {t.motto && <p className="italic text-lg mt-2 text-[#d6e0ee]">« {t.motto} »</p>}
          </div>
          {t.canEdit && <div className="flex flex-wrap gap-3">
            <Link href={`/tribus/${t.id}/gerer`} className="btn btn-primary" data-testid="link-manage">Gérer la tribu</Link>
            <Link href={`/tribus/${t.id}/gerer#images`} className="btn btn-ghost" data-testid="link-manage-images">Modifier les images</Link>
          </div>}
        </div>
      </header>
      <dl className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {facts.map(([k, v]) => <div key={k} className="glass p-4"><dt className="lbl !mb-1">{k}</dt><dd className="font-bold truncate">{v}</dd></div>)}
      </dl>
      <Tabs tabs={TABS} value={tab} onChange={setTab} label="Sections de la tribu" />
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="grid gap-6">
        {tab === "overview" && (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 grid gap-6 content-start">
              <Sect title="À propos"><p className="whitespace-pre-line text-[#d6e0ee]">{t.description || "Aucune description."}</p>
                {tags.length > 0 && <div className="flex flex-wrap gap-2 mt-4">{tags.map((x) => <span key={x} className="chip">{x}</span>)}</div>}</Sect>
              <Sect title="Objectif"><p className="whitespace-pre-line">{t.objective || "Aucun objectif communiqué."}</p></Sect>
            </div>
            <Sect title="Progression">
              <div className="grid gap-4">
                <div><p className="lbl">Boss vaincus</p><List items={t.progression.boss} empty="Aucun" /></div>
                <div><p className="lbl">Boss en cours</p><List items={t.progression.pendingBoss} empty="Aucun" /></div>
                <div><p className="lbl">Notes obtenues</p><List items={t.progression.notes} empty="Aucune" /></div>
                <div><p className="lbl">Notes en cours</p><List items={t.progression.pendingNotes} empty="Aucune" /></div>
              </div>
            </Sect>
          </div>
        )}
        {tab === "members" && (
          <Sect title="Membres">
            {t.members.length === 0 ? <p className="text-sm text-muted-foreground">Aucun membre.</p> : (
              <ul className="divide-y divide-border">
                {t.members.map((m, i) => (
                  <li key={i} className="py-2 flex justify-between gap-2 text-sm" data-testid={`row-member-${i}`}>
                    <span className="font-bold">{m.name}</span>
                    <span className="text-muted-foreground">{m.role}{m.manager ? " - gérant" : ""}</span>
                  </li>
                ))}
              </ul>
            )}
          </Sect>
        )}
        {tab === "bases" && (
          <div className="grid md:grid-cols-2 gap-6">
            <Sect title="Base"><dl className="text-sm grid gap-2">
              <div><dt className="lbl !mb-0">Lieu</dt><dd>{t.base || "-"}</dd></div>
              <div><dt className="lbl !mb-0">Carte</dt><dd>{t.map || "-"}</dd></div>
              <div><dt className="lbl !mb-0">Coordonnées</dt><dd className="font-mono">{t.coords || "-"}</dd></div>
            </dl></Sect>
            {(["outpost", "premium"] as const).map((k) => {
              const ps = t.places.filter((p) => p.kind === k);
              return (
                <Sect key={k} title={k === "outpost" ? "Avant-postes" : "Lieux premium"}>
                  {ps.length === 0 ? <p className="text-sm text-muted-foreground">Aucun.</p> : (
                    <ul className="text-sm grid gap-1">{ps.map((p) => <li key={p.id}><b>{p.name}</b> <span className="text-muted-foreground">{p.map} <span className="font-mono">{p.coords}</span></span></li>)}</ul>
                  )}
                </Sect>
              );
            })}
          </div>
        )}
        {tab === "gallery" && (
          <Sect title="Galerie">
            {t.gallery.length === 0 ? <p className="text-sm text-muted-foreground">Aucune image pour le moment.</p> : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">{t.gallery.map((u, i) => <GalleryImage key={u + i} url={u} name={t.name} index={i} />)}</div>
            )}
          </Sect>
        )}
        {tab === "history" && (
          <Sect title="Historique">
            <p className="text-sm">Tribu fondée le <b>{fmtDate(t.createdAt)}</b>.</p>
            <div className="mt-4"><TribeHistory key={t.id} id={t.id} canEdit={t.canEdit} /></div>
          </Sect>
        )}
        {tab === "recruit" && (
          <Sect title="Recrutement">
            <p className="font-bold" style={{ color: t.recruiting ? "#35E6A4" : undefined }}>{t.recruiting ? "Recrutement ouvert" : "Recrutement fermé"}</p>
            <p className="mt-2 text-sm text-[#d6e0ee] whitespace-pre-line">{t.recruiting ? (t.recruitmentText || "Contactez la tribu via Discord pour la rejoindre.") : "Cette tribu ne recrute pas actuellement."}</p>
          </Sect>
        )}
      </div>
    </div>
  );
}
