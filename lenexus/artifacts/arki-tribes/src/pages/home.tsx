import { getGetSiteBrandingQueryKey, getListSiteMapsQueryKey, useGetSiteBranding, useListSiteMaps, useListTribes } from "@workspace/api-client-react";
import { useViewedSession as useGetSession } from "@/lib/owner-view";
import { Link } from "wouter";
import { ArrowRight, ChevronDown } from "lucide-react";
import { DevNotice, Empty, ErrorBox, Skeletons, TribeCard } from "@/components/parts";
import { DemoTag, MapCard, Reveal, SectionHead, StatCard } from "@/components/nexus";
import { BRAND, CLUSTER_SETTINGS, IMG } from "@/data/nexus";
import { errMsg, useSeo } from "@/lib/helpers";

export default function Home() {
  useSeo("Arki Family - portail des joueurs", "Le portail de la communauté ARK francophone : tribus, maps, mods, événements et espace joueur.");
  const s = useGetSession();
  const branding = useGetSiteBranding({ query: { queryKey: getGetSiteBrandingQueryKey(), refetchInterval: 30000 } });
  const maps = useListSiteMaps({ query: { queryKey: getListSiteMapsQueryKey(), staleTime: 15000, refetchInterval: 30000 } });
  const rec = useListTribes({ recruiting: true });
  const user = s.data?.user;
  return (
    <div>
      <section className="nx-hero">
        <img src={branding.data?.coverUrl || IMG.home} alt="" data-testid="img-site-cover" className="nx-hero-img" />
        <img src={IMG.homeLogo} alt="Arki’ Family — Le Nexus" className="nx-emblem rise" />
        <h1 className="nx-title rise" style={{ animationDelay: ".1s" }}>{BRAND.name}</h1>
        <p className="nx-sub rise" style={{ animationDelay: ".2s" }}>{BRAND.subtitle}</p>
        <p className="nx-slogan rise" style={{ animationDelay: ".3s" }}>{BRAND.slogan}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-x-4 gap-y-2 rise" style={{ animationDelay: ".4s" }}>
          {BRAND.tags.map((t) => <span key={t} className="nx-tag">{t}</span>)}
        </div>
        <div className="mt-9 flex flex-wrap items-start justify-center gap-3 rise" style={{ animationDelay: ".5s" }}>
          <div className="grid gap-3 justify-items-center">
            <Link href="/rejoindre" className="btn btn-primary btn-lg" data-testid="link-hero-join">Nous rejoindre</Link>
            {user && <Link href="/mon-espace" className="btn btn-ghost btn-lg" data-testid="link-hero-space">Ouvrir mon espace</Link>}
            <Link href="/creer" className="btn btn-ghost btn-lg" data-testid="link-hero-create-tribe">Créer ma fiche tribu</Link>
          </div>
          <Link href="/cluster" className="btn btn-ghost btn-lg" data-testid="link-hero-directory">Découvrir le cluster</Link>
        </div>
        <img src={IMG.otter} alt="" className="nx-otter hidden sm:block" />
        <ChevronDown className="absolute bottom-24 h-5 w-5 text-[#9AEAFF]/70 animate-bounce" aria-hidden="true" />
      </section>

      <div className="max-w-7xl mx-auto px-4 grid gap-20 pb-10">
        <section className="stat-wrap" aria-labelledby="stats-title">
          <Reveal>
            <div className="glass px-4 py-6 sm:px-8">
              <h2 id="stats-title" className="text-center text-sm sm:text-base uppercase tracking-[.3em] text-[#c9d4e4] mb-4">Le cluster en quelques chiffres</h2>
              <div className="rule-glow mb-4" />
              <div className="grid grid-cols-3 md:grid-cols-5 xl:grid-cols-9 gap-y-2">
                {CLUSTER_SETTINGS.map((c) => <StatCard key={c.key} icon={c.icon} value={c.value} label={c.label} />)}
              </div>
              <p className="text-center text-[.7rem] text-muted-foreground mt-4">Réglages du cluster communiqués par l’équipe.</p>
            </div>
          </Reveal>
        </section>
        <DevNotice />

        <section>
          <Reveal>
            <SectionHead kicker="Nos mondes" title="Nos Maps" sub={maps.data ? `${maps.data.length} univers à explorer` : "Univers à explorer"} action={<Link href="/maps" className="btn btn-ghost btn-sm" data-testid="link-all-maps">Voir toutes les maps <ArrowRight className="h-4 w-4" /></Link>} />
          </Reveal>
          {maps.isLoading ? <Skeletons n={4} /> : maps.isError || !maps.data ? <ErrorBox message={errMsg(maps.error)} onRetry={() => maps.refetch()} /> : maps.data.length === 0 ? <Empty title="Aucune map disponible" /> : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {maps.data.map((m, i) => <Reveal key={m.slug} delay={(i % 4) * 70}><MapCard map={m} /></Reveal>)}
            </div>
          )}
          <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"><DemoTag>Illustration</DemoTag> Visuels d’illustration. Le statut en direct des maps n’est pas encore relié au serveur.</p>
        </section>

        <section>
          <Reveal>
            <SectionHead kicker="Nouveaux horizons" title="Tribus en recrutement" action={<Link href="/tribus" className="btn btn-ghost btn-sm" data-testid="link-all-tribes">Toutes les tribus <ArrowRight className="h-4 w-4" /></Link>} />
          </Reveal>
          {rec.isLoading ? <Skeletons n={3} /> : rec.isError ? <ErrorBox message={errMsg(rec.error)} onRetry={() => rec.refetch()} /> : !rec.data?.length ? (
            <Empty title="Aucun recrutement ouvert">Consultez l'annuaire complet pour trouver une tribu.</Empty>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{rec.data.slice(0, 6).map((t) => <TribeCard key={t.id} t={t} />)}</div>
          )}
        </section>

        <section className="grid lg:grid-cols-3 gap-4">
          {[
            { t: "Mods du serveur", d: "Découvrez la liste des mods qui enrichissent votre aventure.", img: IMG.crystal, href: "/mods", cta: "Voir les mods", id: "link-mods-card" },
            { t: "Événements", d: "Rendez-vous, concours et nuits de légende avec la communauté.", img: IMG.aurora, href: "/evenements", cta: "Voir les événements", id: "link-events-card" },
            { t: "Votre espace joueur", d: "Retrouvez vos tribus liées à votre compte Discord.", img: IMG.highlands, href: "/mon-espace", cta: "Mon espace", id: "link-space-card" },
          ].filter((c) => c.id !== "link-mods-card" || s.data?.isAdmin).map((c, i) => (
            <Reveal key={c.id} delay={i * 90}>
              <div className="glass overflow-hidden relative min-h-[260px] flex flex-col justify-end p-6 group">
                <img src={c.img} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover opacity-60 transition-transform duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#080C16] via-[#080C16]/60 to-transparent" />
                <div className="relative">
                  <h3 className="text-lg uppercase tracking-[.12em]">{c.t}</h3>
                  <p className="text-sm text-[#c9d4e4] mt-2 max-w-xs">{c.d}</p>
                  <Link href={c.href} className="btn btn-ghost btn-sm mt-4" data-testid={c.id}>{c.cta} <ArrowRight className="h-4 w-4" /></Link>
                </div>
              </div>
            </Reveal>
          ))}
        </section>

        <Reveal>
          <section className="text-center grid justify-items-center gap-4 py-6">
            <img src={IMG.otter} alt="" className="w-24 sm:w-32 drop-shadow-[0_0_18px_rgba(156,124,255,.35)]" loading="lazy" />
            <p className="eyebrow">Bienvenue dans la famille</p>
            <p className="display text-xl sm:text-3xl max-w-2xl normal-case tracking-[.04em]">« {BRAND.quote} »</p>
            <p className="text-sm text-muted-foreground">Votre tribu manque ? <Link href="/creer" className="underline text-primary" data-testid="link-create-card">Créer une tribu</Link></p>
          </section>
        </Reveal>
      </div>
    </div>
  );
}
