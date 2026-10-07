import { Fragment, useRef, useState, useMemo, type ReactNode } from "react";
import { Link, useLocation, useParams } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, ImagePlus, Loader2, Plus, Search, Trash2, X } from "lucide-react";
import {
  getGetGuideQueryKey, getListGuidesQueryKey, useCreateGuide, useDeleteGuide, useGetGuide, useListGuides,
  usePublishGuideImage, useRequestGuideImage, useUpdateGuide, type CommunityGuide,
} from "@workspace/api-client-react";
import { useViewedSession } from "@/lib/owner-view";
import { PageBanner } from "@/components/nexus";
import { BackLink, Empty, ErrorBox, Skeletons } from "@/components/parts";
import { IMG } from "@/data/nexus";
import { errMsg, useSeo } from "@/lib/helpers";
import { useToast } from "@/hooks/use-toast";

type Message = CommunityGuide["messages"][number];

const safeUrl = (u: string) => /^https?:\/\//i.test(u) || (u.startsWith("/") && !u.startsWith("//")) ? u : "";
const when = (s: string) => { const d = new Date(s); return isNaN(d.getTime()) ? s : d.toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" }); };
const isVideo = (m: { contentType: string; name: string; url: string }) => m.contentType.startsWith("video/") || /\.(mp4|webm|mov)$/i.test(m.name);
const isImage = (m: { contentType: string; name: string }) => m.contentType.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(m.name);

function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\[([^\]]+)\]\(([^)\s]+)\)|(https?:\/\/[^\s<>)]+)|\*\*([^*]+)\*\*|__([^_]+)__|\*([^*\n]+)\*|`([^`]+)`/g;
  let last = 0, m: RegExpExecArray | null, i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = i++;
    if (m[1]) { const u = safeUrl(m[2]); out.push(u ? <a key={k} href={u} target="_blank" rel="noopener noreferrer nofollow" className="text-primary underline underline-offset-4">{m[1]}</a> : m[0]); }
    else if (m[3]) { const u = safeUrl(m[3]); out.push(u ? <a key={k} href={u} target="_blank" rel="noopener noreferrer nofollow" className="text-primary underline underline-offset-4 break-all">{m[3]}</a> : m[3]); }
    else if (m[4] || m[5]) out.push(<strong key={k}>{m[4] || m[5]}</strong>);
    else if (m[6]) out.push(<em key={k}>{m[6]}</em>);
    else out.push(<code key={k} className="font-mono text-xs bg-white/10 rounded px-1">{m[7]}</code>);
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Md({ text }: { text: string }) {
  const blocks = text.replace(/\r/g, "").split(/\n{2,}/).filter((b) => b.trim());
  return (
    <div className="grid gap-3 leading-relaxed break-words min-w-0">
      {blocks.map((b, bi) => {
        const lines = b.split("\n");
        if (lines.every((l) => /^\s*[-*•]\s+/.test(l)))
          return <ul key={bi} className="list-disc pl-5 grid gap-1">{lines.map((l, i) => <li key={i}>{inline(l.replace(/^\s*[-*•]\s+/, ""))}</li>)}</ul>;
        const h = /^#{1,3}\s+(.*)$/.exec(b);
        if (h && lines.length === 1) return <h3 key={bi} className="text-lg uppercase tracking-[.08em] mt-2">{inline(h[1])}</h3>;
        return <p key={bi}>{lines.map((l, i) => <Fragment key={i}>{i > 0 && <br />}{inline(l)}</Fragment>)}</p>;
      })}
    </div>
  );
}

function coverOf(g: CommunityGuide): string {
  const first = g.images.map(safeUrl).find(Boolean);
  if (first) return first;
  for (const m of g.messages) for (const a of m.media) if (isImage(a) && safeUrl(a.url)) return a.url;
  return "";
}
function textOf(g: CommunityGuide) {
  return [g.title, g.content, g.authorName, ...g.messages.flatMap((m) => [m.content, m.authorName])].join(" ").toLowerCase();
}
const SourceChip = ({ g }: { g: CommunityGuide }) => <span className="chip">{g.source === "discord" ? "Archive Discord" : "Publié sur le site"}</span>;

function GuideCard({ g }: { g: CommunityGuide }) {
  const cover = coverOf(g);
  return (
    <Link href={`/guides/${g.id}`} className="glass overflow-hidden flex flex-col transition-all duration-300 hover:-translate-y-1 hover:border-[#65D8FF]/60" data-testid={`card-guide-${g.id}`}>
      <div className="h-40 bg-[#080C16] overflow-hidden">
        {cover ? <img src={cover} alt="" loading="lazy" className="w-full h-full object-cover" /> : <div className="h-full grid place-items-center text-xs text-muted-foreground">Sans visuel</div>}
      </div>
      <div className="p-4 grid gap-2 content-start flex-1">
        <SourceChip g={g} />
        <h3 className="text-base tracking-[.06em] break-words" data-testid={`text-guide-title-${g.id}`}>{g.title}</h3>
        <p className="text-sm text-[#9AEAFF] font-bold" data-testid={`text-guide-author-${g.id}`}>Par {g.authorName}</p>
        <p className="text-xs text-muted-foreground">{when(g.createdAt)}{g.messages.length ? ` · ${g.messages.length} message${g.messages.length > 1 ? "s" : ""}` : ""}</p>
      </div>
    </Link>
  );
}

function CreateButton() {
  const { data: s } = useViewedSession();
  if (s?.canCreate) return <Link href="/guides/nouveau" className="btn btn-primary mt-4" data-testid="link-create-guide"><Plus className="h-4 w-4" aria-hidden="true" /> Écrire un guide</Link>;
  if (!s?.user) return <Link href="/connexion" className="btn btn-ghost mt-4" data-testid="link-guide-login">Connexion Discord pour écrire un guide</Link>;
  return <p className="text-xs text-muted-foreground mt-4" data-testid="text-guide-members-only">Seuls les membres du serveur Discord peuvent publier un guide.</p>;
}

export function Guides() {
  useSeo("Guides", "Les guides de la communauté Arki Family : survie, bases, élevage.");
  const q = useListGuides({ query: { queryKey: getListGuidesQueryKey(), refetchInterval: 30000 } });
  const [query, setQuery] = useState("");
  const [src, setSrc] = useState<"all" | "discord" | "site">("all");
  const list = useMemo(() => {
    const t = query.trim().toLowerCase();
    return (q.data ?? []).filter((g) => (src === "all" || g.source === src) && (!t || textOf(g).includes(t)))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [q.data, query, src]);
  return (
    <>
      <PageBanner kicker="Savoir" title="Guides" sub="Conseils de survie, de base et d'élevage, écrits par les joueurs." image={IMG.highlands}><CreateButton /></PageBanner>
      <div className="flex flex-col lg:flex-row gap-3 mt-6 mb-6">
        <div className="flex flex-wrap gap-2 flex-1" role="group" aria-label="Source">
          {([["all", "Tous"], ["discord", "Archives Discord"], ["site", "Publiés sur le site"]] as const).map(([k, l]) => <button key={k} type="button" className="pill" aria-pressed={src === k} onClick={() => setSrc(k)}>{l}</button>)}
        </div>
        <div className="relative lg:w-80">
          <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input type="search" className="field !pl-10" placeholder="Titre, texte ou auteur…" aria-label="Rechercher un guide" value={query} onChange={(e) => setQuery(e.target.value)} data-testid="input-guide-search" />
        </div>
      </div>
      {q.isLoading ? <Skeletons n={6} /> : q.isError ? <ErrorBox message={errMsg(q.error)} onRetry={() => q.refetch()} /> : !list.length ? (
        <Empty title={q.data?.length ? "Aucun guide ne correspond" : "Aucun guide publié"}>{q.data?.length ? "Essayez d'autres mots ou un autre auteur." : "Les guides apparaîtront ici dès qu'ils seront publiés."}</Empty>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="list-guides">{list.map((g) => <GuideCard key={g.id} g={g} />)}</div>
      )}
    </>
  );
}

function MessageView({ m }: { m: Message }) {
  return (
    <article className="glass p-4 grid gap-3 min-w-0" data-testid={`message-guide-${m.id}`}>
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <strong className="text-[#9AEAFF]" data-testid={`text-message-author-${m.id}`}>{m.authorName}</strong>
        <time className="text-xs text-muted-foreground" dateTime={m.createdAt}>{when(m.createdAt)}</time>
        {m.system && <span className="chip">Message système</span>}
      </header>
      {m.content && <Md text={m.content} />}
      {m.embeds.map((e, i) => (
        <div key={i} className="border-l-2 border-primary/60 pl-3 grid gap-1 text-sm">
          {e.title && <strong>{safeUrl(e.url) ? <a href={safeUrl(e.url)} target="_blank" rel="noopener noreferrer nofollow" className="underline">{e.title}</a> : e.title}</strong>}
          {e.description && <Md text={e.description} />}
          {e.fields.map((f, j) => <p key={j}><b>{f.name}</b> : {f.value}</p>)}
          {safeUrl(e.image) && <img src={safeUrl(e.image)} alt="" loading="lazy" className="max-h-72 rounded-lg object-contain justify-self-start" />}
        </div>
      ))}
      {m.media.length > 0 && (
        <div className="grid sm:grid-cols-2 gap-3">
          {m.media.map((a, i) => { const u = safeUrl(a.url); if (!u) return null; return isVideo(a)
            ? <video key={i} controls preload="metadata" className="w-full rounded-lg bg-black max-h-96" data-testid={`video-guide-${m.id}-${i}`}><source src={u} type={a.contentType || "video/mp4"} />Votre navigateur ne lit pas cette vidéo. <a href={u}>{a.name}</a></video>
            : isImage(a) ? <a key={i} href={u} target="_blank" rel="noopener noreferrer" aria-label={`Ouvrir ${a.name}`}><img src={u} alt={a.name} loading="lazy" className="w-full max-h-96 object-contain rounded-lg bg-[#080C16]" data-testid={`img-guide-${m.id}-${i}`} /></a>
            : <a key={i} href={u} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm justify-self-start">{a.name || "Fichier"}</a>; })}
        </div>
      )}
    </article>
  );
}

export function GuideDetail() {
  const { id = "" } = useParams<{ id: string }>();
  const q = useGetGuide(id, { query: { queryKey: getGetGuideQueryKey(id), enabled: !!id } });
  const g = q.data;
  useSeo(g?.title ?? "Guide", g ? `Guide de ${g.authorName}` : "Guide de la communauté Arki Family.");
  const { data: s } = useViewedSession();
  const [, nav] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const del = useDeleteGuide({ request: { headers: { "X-CSRF-Token": s?.csrfToken ?? "" } } });
  const [confirm, setConfirm] = useState(false);
  const [err, setErr] = useState("");
  if (q.isLoading) return <Skeletons n={2} />;
  if (q.isError || !g) return <><BackLink href="/guides">Tous les guides</BackLink><ErrorBox message={errMsg(q.error)} onRetry={() => q.refetch()} /></>;
  const doDelete = () => del.mutate({ guideId: g.id, data: { revision: g.revision } }, {
    onSuccess: () => { void qc.invalidateQueries({ queryKey: getListGuidesQueryKey() }); qc.removeQueries({ queryKey: getGetGuideQueryKey(g.id) }); toast({ title: "Guide retiré du site" }); nav("/guides"); },
    onError: (e) => setErr(errMsg(e)),
  });
  const gallery = g.images.filter((u) => safeUrl(u));
  return (
    <article className="grid gap-6 max-w-4xl mx-auto" data-testid="page-guide">
      <BackLink href="/guides">Tous les guides</BackLink>
      <header className="grid gap-3">
        <SourceChip g={g} />
        <h1 className="nx-h1 break-words" data-testid="text-guide-title">{g.title}</h1>
        <p className="text-lg text-[#9AEAFF] font-bold" data-testid="text-guide-author">Par {g.authorName}</p>
        <p className="text-xs text-muted-foreground">Publié le {when(g.createdAt)}{g.updatedAt !== g.createdAt ? ` · modifié le ${when(g.updatedAt)}` : ""}</p>
        <div className="flex flex-wrap gap-2">
          {g.source === "discord" && safeUrl(g.sourceUrl) && <a href={safeUrl(g.sourceUrl)} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm" data-testid="link-guide-source">Voir le fil Discord d'origine <ArrowUpRight className="h-4 w-4" aria-hidden="true" /></a>}
          {g.canEdit && <Link href={`/guides/${g.id}/modifier`} className="btn btn-primary btn-sm" data-testid="link-edit-guide">Modifier</Link>}
          {g.canEdit && <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setErr(""); setConfirm(true); }} data-testid="button-delete-guide"><Trash2 className="h-4 w-4" aria-hidden="true" /> Supprimer</button>}
        </div>
      </header>
      {confirm && (
        <div className="panel grid gap-3 border-destructive" role="alertdialog" aria-labelledby="del-t" data-testid="dialog-delete-guide">
          <p id="del-t" className="font-bold">Supprimer ce guide ?</p>
          <p className="text-sm text-muted-foreground">Le guide sera retiré du site. {g.source === "discord" ? "Le fil d'origine sur Discord n'est pas supprimé." : "Cette action est définitive."}</p>
          {err && <p className="text-sm text-destructive" role="alert">{err}</p>}
          <div className="flex gap-2">
            <button type="button" className="btn btn-ghost btn-sm" disabled={del.isPending} onClick={() => setConfirm(false)} data-testid="button-delete-cancel">Annuler</button>
            <button type="button" className="btn btn-danger btn-sm" disabled={del.isPending} onClick={doDelete} data-testid="button-delete-confirm">{del.isPending ? "Suppression…" : "Supprimer du site"}</button>
          </div>
        </div>
      )}
      {g.starterMissing && <p className="panel text-sm border-dashed" data-testid="notice-starter-missing">Le message d'ouverture de ce fil Discord n'a pas pu être retrouvé. Seuls les messages conservés sont affichés ci-dessous.</p>}
      {g.content && <section className="glass p-5" data-testid="text-guide-content"><Md text={g.content} /></section>}
      {gallery.length > 0 && (
        <section className="grid grid-cols-2 md:grid-cols-3 gap-3" aria-label="Images du guide">
          {gallery.map((u, i) => <a key={u} href={u} target="_blank" rel="noopener noreferrer" aria-label={`Ouvrir l'image ${i + 1}`}><img src={u} alt={`Illustration ${i + 1}`} loading="lazy" className="w-full aspect-video object-cover rounded-xl border border-white/10" data-testid={`img-guide-gallery-${i}`} /></a>)}
        </section>
      )}
      {g.messages.length > 0 && (
        <section className="grid gap-3" aria-label="Messages d'origine" data-testid="list-guide-messages">
          <h2 className="text-xl uppercase">Discussion d'origine ({g.messages.length})</h2>
          {g.messages.map((m) => <MessageView key={m.id} m={m} />)}
        </section>
      )}
    </article>
  );
}

const TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

function GuideForm({ guide }: { guide?: CommunityGuide }) {
  const { data: s } = useViewedSession();
  const headers = { "X-CSRF-Token": s?.csrfToken ?? "" };
  const [, nav] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [title, setTitle] = useState(guide?.title ?? "");
  const [content, setContent] = useState(guide?.content ?? "");
  const [images, setImages] = useState<string[]>(guide?.images ?? []);
  const [err, setErr] = useState("");
  const [upErr, setUpErr] = useState("");
  const [up, setUp] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const create = useCreateGuide({ request: { headers } });
  const update = useUpdateGuide({ request: { headers } });
  const reqImg = useRequestGuideImage({ request: { headers } });
  const pubImg = usePublishGuideImage({ request: { headers } });
  const imported = guide?.source === "discord";
  const pending = create.isPending || update.isPending;
  const uploading = !!up;

  const upload = async (files: FileList | null) => {
    if (!files?.length || uploading) return;
    setUpErr("");
    let next = [...images];
    for (const f of Array.from(files)) {
      if (next.length >= 16) { setUpErr("16 images maximum."); break; }
      if (!(TYPES as readonly string[]).includes(f.type)) { setUpErr(`${f.name} : format refusé (PNG, JPEG ou WebP).`); continue; }
      if (f.size > 10 * 1024 * 1024) { setUpErr(`${f.name} : 10 Mo maximum.`); continue; }
      try {
        setUp(`Envoi de ${f.name}…`);
        const r = await reqImg.mutateAsync({ data: { size: f.size, contentType: f.type as (typeof TYPES)[number] } });
        const put = await fetch(r.uploadURL, { method: "PUT", headers: { "Content-Type": f.type }, body: f });
        if (!put.ok) throw new Error("L'envoi du fichier a échoué.");
        const p = await pubImg.mutateAsync({ data: { objectPath: r.objectPath } });
        if (!next.includes(p.url)) next = [...next, p.url];
        setImages(next);
      } catch (e) { setUpErr(`${f.name} : ${errMsg(e)}`); }
    }
    setUp("");
    if (file.current) file.current.value = "";
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    const t = title.trim();
    if (!t) return setErr("Le titre est obligatoire.");
    if (!guide && !content.trim() && !images.length) return setErr("Ajoutez du texte ou une image.");
    const done = (g: CommunityGuide) => {
      void qc.invalidateQueries({ queryKey: getListGuidesQueryKey() });
      qc.setQueryData(getGetGuideQueryKey(g.id), g);
      toast({ title: guide ? "Guide mis à jour" : "Guide publié" });
      nav(`/guides/${g.id}`);
    };
    const onError = (e: unknown) => setErr((e as { status?: number })?.status === 409
      ? "Le guide a été modifié entre-temps. Votre saisie est conservée : copiez-la, rechargez la page puis réappliquez vos changements."
      : errMsg(e));
    if (guide) update.mutate({ guideId: guide.id, data: { title: t, content, images, revision: guide.revision } }, { onSuccess: done, onError });
    else create.mutate({ data: { title: t, content, images, revision: 0 } }, { onSuccess: done, onError });
  };

  return (
    <form onSubmit={submit} className="grid gap-5 max-w-3xl mx-auto" data-testid="form-guide">
      <BackLink href={guide ? `/guides/${guide.id}` : "/guides"}>Retour</BackLink>
      <h1 className="nx-h1">{guide ? "Modifier le guide" : "Nouveau guide"}</h1>
      {imported && <p className="panel text-sm border-dashed" data-testid="notice-transcript-preserved">Ce guide vient d'un fil Discord. La discussion d'origine ({guide.messages.length} messages, avec leurs auteurs et médias) est conservée telle quelle et ne peut pas être modifiée. Vous pouvez changer le titre, ajouter une introduction et des images.</p>}
      <div>
        <label className="lbl" htmlFor="g-title">Titre</label>
        <input id="g-title" className="field" required maxLength={180} value={title} onChange={(e) => setTitle(e.target.value)} disabled={pending} data-testid="input-guide-title" />
      </div>
      <div>
        <label className="lbl" htmlFor="g-content">{imported ? "Introduction (facultatif)" : "Contenu"}</label>
        <textarea id="g-content" className="field !rounded-2xl" rows={12} maxLength={20000} value={content} onChange={(e) => setContent(e.target.value)} disabled={pending} data-testid="input-guide-content" />
        <p className="text-xs text-muted-foreground mt-1">{content.length}/20000 · **gras**, listes avec « - », liens https://… sont pris en charge.</p>
      </div>
      <fieldset className="grid gap-3" disabled={pending || uploading}>
        <legend className="lbl">Images ({images.length}/16)</legend>
        <div className="flex flex-wrap items-center gap-3">
          <label className={`btn btn-ghost btn-sm ${uploading || images.length >= 16 ? "opacity-50 pointer-events-none" : "cursor-pointer"}`}>
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ImagePlus className="h-4 w-4" aria-hidden="true" />} Ajouter des images
            <input ref={file} type="file" multiple accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={uploading || images.length >= 16} onChange={(e) => void upload(e.target.files)} data-testid="input-guide-upload" />
          </label>
          <span className="text-xs text-muted-foreground">PNG, JPEG ou WebP, 10 Mo maximum.</span>
        </div>
        {up && <p className="text-sm" role="status" data-testid="status-guide-upload">{up}</p>}
        {upErr && <p className="text-sm text-destructive" role="alert" data-testid="error-guide-upload">{upErr}</p>}
        {images.length > 0 && (
          <ul className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {images.map((u, i) => (
              <li key={u} className="relative">
                <img src={u} alt={`Aperçu ${i + 1}`} className="w-full aspect-video object-cover rounded-lg border border-white/10" />
                <button type="button" className="absolute top-1 right-1 h-7 w-7 grid place-items-center rounded-full bg-black/70" aria-label={`Retirer l'image ${i + 1}`} onClick={() => setImages(images.filter((x) => x !== u))} data-testid={`button-remove-image-${i}`}><X className="h-4 w-4" /></button>
              </li>
            ))}
          </ul>
        )}
      </fieldset>
      {err && <p className="panel border-destructive text-sm text-destructive" role="alert" data-testid="error-guide-form">{err}</p>}
      <div><button type="submit" className="btn btn-primary" disabled={pending || uploading} data-testid="button-save-guide">{uploading ? "Envoi des images…" : pending ? "Enregistrement…" : guide ? "Enregistrer" : "Publier le guide"}</button></div>
    </form>
  );
}

export function GuideNew() {
  useSeo("Nouveau guide", "Écrire un guide pour la communauté Arki Family.");
  const { data: s, isLoading } = useViewedSession();
  if (isLoading) return <Skeletons n={1} />;
  if (!s?.user) return <Empty title="Connexion requise"><p>Connectez-vous avec Discord pour écrire un guide.</p><Link href="/connexion" className="btn btn-primary mt-4" data-testid="link-guide-login">Connexion Discord</Link></Empty>;
  if (!s.canCreate) return <Empty title="Réservé aux membres du serveur"><p>Rejoignez le serveur Discord pour publier un guide.</p><Link href="/guides" className="btn btn-ghost mt-4">Retour aux guides</Link></Empty>;
  return <GuideForm />;
}

export function GuideEdit() {
  const { id = "" } = useParams<{ id: string }>();
  useSeo("Modifier le guide", "Modifier un guide de la communauté.");
  const q = useGetGuide(id, { query: { queryKey: getGetGuideQueryKey(id), enabled: !!id } });
  if (q.isLoading) return <Skeletons n={1} />;
  if (q.isError || !q.data) return <ErrorBox message={errMsg(q.error)} onRetry={() => q.refetch()} />;
  if (!q.data.canEdit) return <Empty title="Modification non autorisée"><p>Seul l'auteur ou le staff peut modifier ce guide.</p><Link href={`/guides/${id}`} className="btn btn-ghost mt-4">Lire le guide</Link></Empty>;
  return <GuideForm guide={q.data} />;
}
