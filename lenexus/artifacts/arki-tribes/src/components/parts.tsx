import { type ReactNode, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { getGetSessionQueryKey, getGetSiteBrandingQueryKey, useGetSiteBranding, useGetOptions, useLogout, type Tribe, type Options } from "@workspace/api-client-react";
import { useViewedSession as useGetSession, useOwnerView } from "@/lib/owner-view";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { initials, inkOn, intToHex, hexToInt, useWrite } from "@/lib/helpers";
import { LogoFilePicker, CoverFilePicker } from "./tribe-image-upload";
import { Menu, Search, UserRound, X } from "lucide-react";
import { PlayerSearchDialog } from "./player-search";
import { BRAND } from "@/data/nexus";

export function Shell({ children }: { children: ReactNode }) {
  const { data: s } = useGetSession();
  const { isOwner } = useOwnerView();
  const [loc, navigate] = useLocation();
  const qc = useQueryClient();
  const w = useWrite();
  const branding = useGetSiteBranding({ query: { queryKey: getGetSiteBrandingQueryKey(), refetchInterval: 30000 } });
  const logoUrl = branding.data?.logoUrl || "/server-logo.png";
  useEffect(() => {
    const icon=document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (icon) icon.href=logoUrl;
  },[logoUrl]);
  const logout = useLogout({
    request: w.request,
    mutation: {
      onError: w.mutation.onError,
      onSuccess: () => {
        qc.setQueryData(getGetSessionQueryKey(), {
          ...s, user: null, csrfToken: "", isAdmin: false, isOwner: false, isPrimaryOwner: false, siteRole: "guest", canCreate: false,
        });
        navigate("/");
        qc.resetQueries();
      },
    },
  });
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [loc]);
  const [searching, setSearching] = useState(false);
  const links = [
    { href: "/", label: "Accueil" },
    { href: "/cluster", label: "Le Cluster" },
    { href: "/maps", label: "Maps" },
    { href: "/mods", label: "Mods" },
    { href: "/tribus", label: "Tribus" },
    { href: "/evenements", label: "Événements" },
    { href: "/guides", label: "Guides" },
    ...(s?.user ? [{ href: "/shop", label: "Shop" }] : []),
    ...(s?.user ? [{ href: "/mes-informations", label: "Mes informations" }, { href: "/catalogue-arkifamily", label: "Catalogue ArkiFamily" }] : []),
    ...(s?.isAdmin || isOwner ? [{ href: "/administration", label: "Administration" }] : []),
  ];
  const active = (h: string) => (h === "/" ? loc === "/" : loc === h || loc.startsWith(h + "/") || (h === "/tribus" && (loc === "/mes-tribus" || loc === "/creer")));
  const mySpaceOn = loc === "/mon-espace" || loc === "/mes-tribus";
  const guidesOn = loc === "/guides" || loc.startsWith("/guides/");
  return (
    <div className={`min-h-[100dvh] flex flex-col${guidesOn ? " guides-shell" : ""}`}>
      <a href="#contenu" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-2 focus:bg-primary focus:text-primary-foreground">Aller au contenu</a>
      <header className="portal-header sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3 xl:gap-5">
          <Link href="/" className="flex items-center gap-2.5 shrink-0" data-testid="link-home">
            <img src={logoUrl} alt="Logo Arki Family" data-testid="img-site-logo" className="h-10 w-10 object-contain drop-shadow-[0_0_12px_rgba(101,216,255,.4)]" onError={(e) => { if (!e.currentTarget.src.endsWith("/server-logo.png")) e.currentTarget.src = "/server-logo.png"; }} />
            <span className="grid gap-1"><span className="wordmark">ARKI’ FAMILY</span><span className="hidden sm:block text-[.55rem] tracking-[.5em] text-[#9AEAFF]">LE NEXUS</span></span>
          </Link>
          <nav aria-label="Navigation principale" className="hidden xl:flex gap-0.5 flex-1 justify-center">
            {links.map((l) => (
              <Link key={l.href} href={l.href} aria-current={active(l.href) ? "page" : undefined} data-testid={`link-nav-${l.href.replace(/\W/g, "") || "home"}`}
                className={`nav-link ${active(l.href) ? "nav-link-on" : ""}`}>{l.label}</Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2 text-sm">
            <button type="button" className="h-9 w-9 grid place-items-center rounded-full text-muted-foreground hover:text-primary hover:bg-white/5 transition-colors" aria-label="Rechercher" aria-haspopup="dialog" data-testid="button-search" onClick={() => setSearching(true)}><Search className="h-[18px] w-[18px]" /></button>
            <PlayerSearchDialog open={searching} onOpenChange={setSearching} />
            {s?.user ? (
              <>
                <span className="hidden 2xl:inline font-mono text-xs max-w-32 truncate" data-testid="text-username">{s.user.name}</span>
                {s.isAdmin && <span className="chip hidden 2xl:inline-flex">{s.isPrimaryOwner?"Propriétaire principal":s.isOwner?"Propriétaire":"Administrateur"}</span>}
                <Link href="/mon-espace" className={`btn btn-sm ${mySpaceOn ? "btn-primary" : "btn-ghost"} whitespace-nowrap !px-3 sm:!px-4 shrink-0`} aria-label="Mon espace" data-testid="link-nav-myspace"><UserRound className="h-4 w-4 sm:hidden" aria-hidden="true" /><span className="hidden sm:inline">Mon espace</span></Link>
                <button className="btn btn-ghost btn-sm hidden sm:inline-flex" data-testid="button-logout" disabled={logout.isPending} onClick={() => logout.mutate()}>Déconnexion</button>
              </>
            ) : (
              <>
                <Link href="/mon-espace" className="btn btn-ghost btn-sm whitespace-nowrap hidden sm:inline-flex" data-testid="link-nav-myspace">Mon espace</Link>
                <Link href="/connexion" aria-label="Connexion Discord" className="btn btn-primary btn-sm whitespace-nowrap" data-testid="link-login"><span className="sm:hidden">Discord</span><span className="hidden sm:inline">Connexion Discord</span></Link>
              </>
            )}
            <button type="button" className="h-10 w-10 grid place-items-center rounded-full border border-white/15 xl:hidden" aria-label={open ? "Fermer le menu" : "Ouvrir le menu"} aria-expanded={open} aria-controls="menu-mobile" data-testid="button-menu" onClick={() => setOpen((o) => !o)}>{open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
          </div>
        </div>
        {open && (
          <nav id="menu-mobile" aria-label="Navigation mobile" className="xl:hidden px-4 pb-4 grid gap-1 sm:grid-cols-2">
            {links.map((l) => (
              <Link key={l.href} href={l.href} aria-current={active(l.href) ? "page" : undefined} className={`nav-link !py-3 ${active(l.href) ? "nav-link-on" : ""}`}>{l.label}</Link>
            ))}
            <Link href="/mon-espace" className={`nav-link !py-3 ${mySpaceOn ? "nav-link-on" : ""}`}>Mon espace</Link>
            {s?.user && <button className="nav-link !py-3 text-left sm:hidden" onClick={() => logout.mutate()}>Déconnexion</button>}
          </nav>
        )}
      </header>
      <main id="contenu" className={loc === "/" ? "flex-1 w-full" : "flex-1 max-w-7xl w-full mx-auto px-4 py-8"}>{children}</main>
      <footer className="border-t border-white/10 mt-12 py-10 px-4 text-center grid justify-items-center gap-3">
        <span className="wordmark text-lg">ARKI’ FAMILY</span>
        <span className="text-[.6rem] tracking-[.5em] text-[#9AEAFF]">LE NEXUS</span>
        <p className="text-xs text-muted-foreground max-w-md">Portail des joueurs ARK francophones. Projet communautaire indépendant, sans affiliation officielle.</p>
        <p className="text-xs italic text-muted-foreground">{BRAND.quote}</p>
      </footer>
    </div>
  );
}

export function PageTitle({ kicker, title, children }: { kicker: string; title: string; children?: ReactNode }) {
  return (
    <div className="page-heading mb-8 rise">
      <p className="lbl !mb-1 text-muted-foreground">{kicker}</p>
      <h1 className="display text-4xl md:text-5xl font-black leading-tight">{title}</h1>
      {children && <p className="mt-3 max-w-2xl text-muted-foreground leading-relaxed">{children}</p>}
    </div>
  );
}

export function Logo({ t, size = 56 }: { t: Pick<Tribe, "name" | "logoUrl" | "color">; size?: number }) {
  const [bad, setBad] = useState(false);
  useEffect(() => setBad(false), [t.logoUrl]);
  let logoUrl = "";
  if (/^\/api\/tribes\/\d+\/images\/[a-f0-9]{64}$/.test(t.logoUrl) || /^\/api\/storage\/objects\/tribe-uploads\/[a-f0-9-]{36}$/.test(t.logoUrl)) logoUrl = t.logoUrl;
  try {
    const url = new URL(t.logoUrl);
    if (url.protocol === "https:" && !url.username && !url.password) logoUrl = url.href;
  } catch { /* Legacy local file references cannot be displayed on the website. */ }
  return logoUrl && !bad ? (
    <img src={logoUrl} alt={`Logo ${t.name}`} onError={() => setBad(true)} style={{ width: size, height: size }} className="object-cover rounded border-2 border-foreground/20 shrink-0" />
  ) : (
    <div style={{ width: size, height: size, background: intToHex(t.color), color: inkOn(t.color) }} className="display font-black rounded grid place-items-center shrink-0" aria-hidden>
      {initials(t.name)}
    </div>
  );
}

export function TribeCard({ t }: { t: Tribe }) {
  return (
    <Link href={`/tribus/${t.id}`} data-testid={`card-tribe-${t.id}`} className="panel tribe-card block p-5 rise" style={{ borderTop: `3px solid ${intToHex(t.color)}` }}>
      <div className="flex gap-4 items-start relative z-[1]">
        <div className="p-1 rounded-xl bg-white/[.035] ring-1 ring-white/10"><Logo t={t} size={64} /></div>
        <div className="min-w-0">
          <p className="eyebrow !text-[.61rem] mb-1">{t.map || "Tribu ARK"}</p>
          <h3 className="display text-xl sm:text-2xl font-bold truncate">{t.name}</h3>
          <p className="text-sm italic text-muted-foreground line-clamp-2 mt-1">{t.motto || "Sans devise"}</p>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-1.5 relative z-[1]">
                <span className="chip">{t.memberCount} membre{t.memberCount > 1 ? "s" : ""}</span>
        <span className="chip">{t.recruiting ? "Recrutement ouvert" : "Recrutement fermé"}</span>
      </div>
    </Link>
  );
}

export function Skeletons({ n = 6 }: { n?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: n }).map((_, i) => <div key={i} className="panel h-36 animate-pulse bg-muted" />)}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="panel border-destructive" role="alert" data-testid="status-error">
      <p className="font-bold text-destructive">Chargement impossible</p>
      <p className="text-sm mt-1">{message || "Le serveur ne répond pas."}</p>
      {onRetry && <button className="btn btn-ghost btn-sm mt-3" onClick={onRetry} data-testid="button-retry">Réessayer</button>}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="panel text-center py-10 border-dashed" data-testid="status-empty">
      <p className="display text-2xl font-bold text-primary">{title}</p>
      {children && <div className="mt-2 text-muted-foreground">{children}</div>}
    </div>
  );
}

export function Confirm({ label, title, description, confirmLabel, onConfirm, className = "btn btn-ghost btn-sm", testid, disabled }: {
  label: string; title: string; description: string; confirmLabel: string; onConfirm: () => void; className?: string; testid: string; disabled?: boolean;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button type="button" className={className} data-testid={testid} disabled={disabled}>{label}</button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid={`${testid}-cancel`}>Annuler</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} data-testid={`${testid}-confirm`}>{confirmLabel}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export type TribeFormValue = {
  coverUrl?: string;
  name: string; description: string; motto: string; objective: string; color: number;
  logoUrl: string; base: string; map: string; coords: string; tags: string; recruiting: boolean; recruitmentText: string;
};
export const emptyTribe: TribeFormValue = {
  coverUrl: "",
  name: "", description: "", motto: "", objective: "", color: 0x1d5c58, logoUrl: "", base: "", map: "", coords: "", tags: "", recruiting: false, recruitmentText: "",
};

export function TribeForm({ initial, options, pending, submitLabel, onSubmit, children }: {
  initial: TribeFormValue; options?: Options; pending: boolean; submitLabel: string; onSubmit: (v: TribeFormValue) => void; children?: ReactNode;
}) {
  const [v, setV] = useState(initial);
  const [logoUploading, setLogoUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const uploading = logoUploading || coverUploading;
  const set = <K extends keyof TribeFormValue>(k: K, val: TribeFormValue[K]) => setV((p) => ({ ...p, [k]: val }));
  const maps = Array.from(new Set([...(options?.maps ?? []), ...(v.map ? [v.map] : [])]));
  const txt = (k: keyof TribeFormValue, label: string, max: number) => (
    <div>
      <label className="lbl" htmlFor={`f-${k}`}>{label}</label>
      <input id={`f-${k}`} data-testid={`input-${k}`} className="field" maxLength={max} value={String(v[k])} onChange={(e) => set(k, e.target.value as never)} />
    </div>
  );
  const hasOptional = !!(v.motto || v.objective || v.base || v.coords || v.logoUrl || v.tags || v.recruiting || v.recruitmentText);
  return (
    <form className="grid gap-6" onSubmit={(e) => { e.preventDefault(); if (!pending && !uploading) onSubmit(v); }}>
      <fieldset id="images" className="grid gap-4 scroll-mt-24" data-testid="section-tribe-images">
        <legend className="display text-xl font-bold text-primary mb-1">Images de la tribu</legend>
        <div className="grid md:grid-cols-2 gap-5 min-w-0">
          <LogoFilePicker value={v.logoUrl} disabled={pending || uploading} onChange={(url) => set("logoUrl", url)} onBusy={setLogoUploading} />
          <CoverFilePicker value={v.coverUrl ?? ""} disabled={pending || uploading} onChange={(url) => set("coverUrl", url)} onBusy={setCoverUploading} />
        </div>
        <p className="text-xs text-muted-foreground">La photo de profil et le fond sont indépendants des photos de la galerie. Enregistrez la fiche pour appliquer vos modifications.</p>
      </fieldset>
      <fieldset className="grid gap-4">
        <legend className="display text-xl font-bold text-primary mb-1">L'essentiel</legend>
        <p className="text-sm text-muted-foreground -mt-2">Le nom suffit pour publier. Le reste peut être complété plus tard.</p>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="lbl" htmlFor="f-name">Nom de la tribu</label>
            <input id="f-name" data-testid="input-name" required minLength={1} maxLength={80} className="field" value={v.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div>
            <label className="lbl" htmlFor="f-map">Carte principale</label>
            <select id="f-map" data-testid="select-map" className="field" value={v.map} onChange={(e) => set("map", e.target.value)}>
              <option value="">Non précisée</option>
              {maps.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="lbl" htmlFor="f-description">Description</label>
          <textarea id="f-description" data-testid="input-description" rows={5} maxLength={3000} className="field" placeholder="Qui êtes-vous, comment jouez-vous ?" value={v.description} onChange={(e) => set("description", e.target.value)} />
        </div>
        <div className="grid md:grid-cols-[auto_1fr] gap-4 items-end">
          <div>
            <label className="lbl" htmlFor="f-color">Couleur de la tribu</label>
            <input id="f-color" data-testid="input-color" type="color" className="field !p-1 h-[42px] w-24" value={intToHex(v.color)} onChange={(e) => set("color", hexToInt(e.target.value))} />
          </div>
          <label className="flex items-center gap-2 font-bold pb-2">
            <input type="checkbox" data-testid="checkbox-recruiting" checked={v.recruiting} onChange={(e) => set("recruiting", e.target.checked)} />
            La tribu recrute
          </label>
        </div>
        {v.recruiting && txt("recruitmentText", "Message de recrutement (facultatif)", 300)}
      </fieldset>
      <details className="panel !p-4" open={hasOptional} data-testid="group-optional">
        <summary className="cursor-pointer font-bold text-primary">Plus de détails (facultatif)</summary>
        <div className="grid gap-4 mt-4">
          <div className="grid md:grid-cols-2 gap-4">
            {txt("motto", "Devise", 200)}
            {txt("tags", "Étiquettes (séparées par des virgules)", 300)}
          </div>
          <div>
            <label className="lbl" htmlFor="f-objective">Objectif</label>
            <textarea id="f-objective" data-testid="input-objective" rows={2} maxLength={1000} className="field" value={v.objective} onChange={(e) => set("objective", e.target.value)} />
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {txt("base", "Base", 120)}
            {txt("coords", "Coordonnées", 80)}
          </div>
        </div>
      </details>
      {children}
      <div><button className="btn btn-primary" type="submit" disabled={pending || uploading} data-testid="button-submit-tribe">{uploading ? "Envoi du logo..." : pending ? "Envoi..." : submitLabel}</button></div>
    </form>
  );
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="inline-block text-sm font-bold underline mb-4" data-testid={`link-back${href.replace(/\W/g, "-")}`}>&larr; {children}</Link>;
}

export function DevNotice() {
  const { data } = useGetOptions();
  const imported = data?.dataImport;
  if (imported) {
    const date = new Date(imported.sourceRetrievedAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
    return (
      <p className="panel !py-2 text-xs mb-6 border-dashed" data-testid="notice-data-import">
        Données Discord récupérées le {date}.
        {" "}Copie ponctuelle : les changements ultérieurs du bot ne sont pas synchronisés automatiquement.
      </p>
    );
  }
  if (!import.meta.env.DEV) return null;
  return (
    <p className="panel !py-2 text-xs font-mono mb-6 border-dashed" data-testid="notice-dev">
      Aperçu du site : cette copie locale n’est pas encore synchronisée avec les tribus du serveur Discord. Si votre tribu manque, ne la recréez pas.
    </p>
  );
}
