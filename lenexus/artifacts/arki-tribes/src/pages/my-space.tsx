import { useState } from "react";
import { Link } from "wouter";
import { CalendarDays, Dna, Map as MapIcon, PackageOpen, Settings2, Shield, Users } from "lucide-react";
import { getListTribesQueryKey, useListTribes } from "@workspace/api-client-react";
import { useViewedSession as useGetSession } from "@/lib/owner-view";
import { DevNotice, Empty, ErrorBox, Skeletons, TribeCard } from "@/components/parts";
import { ComingSoon, PageBanner, Tabs } from "@/components/nexus";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { IMG } from "@/data/nexus";
import { errMsg, initials, useSeo } from "@/lib/helpers";
import { MyTribeName, LeaveTribeButton } from "@/components/tribe-self-service";

const TABS = [
  { key: "overview", label: "Aperçu" }, { key: "tribe", label: "Tribu" }, { key: "dinos", label: "Suivi de mes dinos" }, { key: "stats", label: "Statistiques" },
  { key: "events", label: "Événements" }, { key: "badges", label: "Badges" }, { key: "gallery", label: "Galerie" },
] as const;

export default function MySpace() {
  useSeo("Mon espace", "Votre passeport survivant Arki Family : tribus reliées à votre compte Discord.");
  const s = useGetSession();
  const user = s.data?.user;
  const list = useListTribes({ mine: true }, { query: { enabled: !!user, queryKey: getListTribesQueryKey({ mine: true }) } });
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("overview");
  const n = list.data?.length ?? 0;
  const manageable = list.data?.find((t) => t.canEdit);
  const role = s.data?.isAdmin ? (s.data.isPrimaryOwner ? "Propriétaire principal" : s.data.isOwner ? "Propriétaire" : "Administrateur") : "Survivant";
  const tribes = () => list.isLoading ? <Skeletons n={3} /> : list.isError ? <ErrorBox message={errMsg(list.error)} onRetry={() => list.refetch()} /> : !n ? (
    <Empty title="Aucune tribu liée à votre compte">
      <p className="max-w-xl mx-auto" data-testid="text-mine-empty">Le lien se fait uniquement avec votre identifiant Discord, jamais avec un nom. Si votre tribu existe, cherchez-la dans l'annuaire sans la recréer ; si elle manque, signalez-le au staff.</p>
      <div className="mt-4 flex flex-wrap gap-2 justify-center">
        <Link href="/tribus" className="btn btn-primary" data-testid="link-find-in-directory">Parcourir les tribus</Link>
        <Link href="/creer" className="btn btn-ghost" data-testid="link-create-first">Créer une tribu</Link>
      </div>
    </Empty>
  ) : (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {list.data!.map((t) => (
        <div key={t.id} className="grid gap-2 content-start">
          <TribeCard t={t} />
          <div className="flex flex-wrap gap-2">
            {t.canEdit && !t.canManage && <Link href={`/tribus/${t.id}/gerer`} className="btn btn-ghost btn-sm" data-testid={`link-edit-${t.id}`}>Modifier la fiche</Link>}
            {t.canManage && <Link href={`/tribus/${t.id}/gerer`} className="btn btn-ghost btn-sm" data-testid={`link-manage-${t.id}`}>Gérer la tribu</Link>}
            <LeaveTribeButton id={t.id} name={t.name} />
          </div>
        </div>
      ))}
    </div>
  );
  return (
    <>
      <PageBanner kicker="Mon profil" title={user ? "Mon espace" : "Mon espace"} sub="Votre passeport survivant." image={IMG.mySpace} />
      <DevNotice />
      {s.isLoading ? <Skeletons n={3} /> : s.isError ? <ErrorBox message={errMsg(s.error)} onRetry={() => s.refetch()} /> : !user ? (
        <Empty title="Connexion requise">
          <p>Identifiez-vous avec Discord pour accéder à votre espace.</p>
          <Link href="/connexion" className="btn btn-primary mt-4" data-testid="link-to-login">Se connecter avec Discord</Link>
        </Empty>
      ) : (
        <div className="grid gap-6">
          <section className="glass p-5 sm:p-7 flex flex-wrap items-center gap-5" data-testid="card-passport">
            <Avatar className="h-24 w-24 ring-2 ring-[#65D8FF] shadow-[0_0_28px_rgba(101,216,255,.35)]" data-testid="avatar-passport">
              <AvatarImage src={user.avatar || undefined} alt={`Photo de profil Discord de ${user.name}`} className="object-cover" />
              <AvatarFallback className="display text-3xl bg-gradient-to-br from-[#1b2a4a] to-[#2a1f5c]" aria-label={`Profil de ${user.name}`}>{initials(user.name)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-[200px]">
              <p className="eyebrow mb-1">Bonjour</p>
              <h2 className="text-2xl sm:text-4xl tracking-[.08em]" data-testid="text-passport-name">{user.name}</h2>
              <div className="flex flex-wrap gap-2 mt-3"><span className="chip"><Shield className="h-3 w-3" /> {role}</span><span className="chip">Compte Discord</span></div>
            </div>
            <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
              <div><dt className="lbl !mb-0">Tribus liées</dt><dd className="font-bold" data-testid="text-tribe-count">{list.data ? n : "-"}</dd></div>
              <div><dt className="lbl !mb-0">Tribu principale</dt><dd className="font-bold truncate max-w-40">{list.data?.[0]?.name ?? "-"}</dd></div>
            </dl>
          </section>
          <Tabs tabs={TABS} value={tab} onChange={setTab} label="Sections du profil" />
          <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
            {tab === "overview" && (
              <div className="grid gap-8">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <Link href="/mes-dinos" className="glass p-4 grid gap-2 border-[#65D8FF]/50 hover:border-[#65D8FF] transition-colors" data-testid="link-shortcut-dinos"><Dna className="h-5 w-5 text-primary" /><b className="text-sm">Suivi de mes dinos</b></Link>
                  <Link href="/mes-informations" className="glass p-4 grid gap-2 hover:border-[#65D8FF]/60 transition-colors" data-testid="link-shortcut-arki-account"><PackageOpen className="h-5 w-5 text-primary" /><b className="text-sm">Inventaire et commandes</b><span className="text-xs text-muted-foreground">Données ArkiFamily</span></Link>
                  <Link href="/catalogue-arkifamily" className="glass p-4 grid gap-2 hover:border-[#65D8FF]/60 transition-colors" data-testid="link-shortcut-arki-catalog"><span className="display text-xl font-bold text-primary">AF</span><b className="text-sm">Catalogue ArkiFamily</b><span className="text-xs text-muted-foreground">Tarifs de base</span></Link>
                  {manageable && <Link href={`/tribus/${manageable.id}/gerer`} className="glass p-4 grid gap-2 hover:border-[#65D8FF]/60 transition-colors" data-testid="link-shortcut-manage"><Settings2 className="h-5 w-5 text-primary" /><b className="text-sm">Gérer ma tribu</b></Link>}
                  <Link href="/evenements" className="glass p-4 grid gap-2 hover:border-[#65D8FF]/60 transition-colors"><CalendarDays className="h-5 w-5 text-primary" /><b className="text-sm">Voir les événements</b></Link>
                  <Link href="/maps" className="glass p-4 grid gap-2 hover:border-[#65D8FF]/60 transition-colors"><MapIcon className="h-5 w-5 text-primary" /><b className="text-sm">Consulter les maps</b></Link>
                  <Link href="/tribus" className="glass p-4 grid gap-2 hover:border-[#65D8FF]/60 transition-colors"><Users className="h-5 w-5 text-primary" /><b className="text-sm">Annuaire des tribus</b></Link>
                </div>
                <section><h2 className="text-xl uppercase mb-4">Mes tribus</h2>{tribes()}</section>
              </div>
            )}
            {tab === "tribe" && <section><h2 className="text-xl uppercase mb-4">Mes tribus</h2>{n > 0 && <MyTribeName />}{tribes()}</section>}
            {tab === "dinos" && <section className="glass p-5 grid gap-3 justify-items-start"><h2 className="text-xl uppercase">Suivi de mes dinos</h2><p className="text-sm text-muted-foreground max-w-xl">Une fiche de points de base par espèce et par tribu, avec comparaison avant enregistrement.</p><Link href="/mes-dinos" className="btn btn-primary" data-testid="link-dinos-tab">Ouvrir le suivi</Link>{(s.data?.isOwner || s.data?.isAdmin) && <Link href="/mes-dinos/catalogue" className="btn btn-ghost btn-sm" data-testid="link-dinos-catalogue">Catalogue des espèces · ajout manuel</Link>}</section>}
            {tab === "stats" && <ComingSoon title="Statistiques">Le suivi des statistiques de jeu n'est pas encore relié au serveur. Aucune donnée n'est affichée.</ComingSoon>}
            {tab === "events" && <ComingSoon title="Mes événements">Les inscriptions aux événements ne sont pas encore disponibles.</ComingSoon>}
            {tab === "badges" && <ComingSoon title="Badges">Les badges ne sont pas encore attribués. Rien n'est affiché pour votre compte.</ComingSoon>}
            {tab === "gallery" && <ComingSoon title="Mes captures">Le dépôt de captures n'est pas encore disponible.</ComingSoon>}
          </div>
        </div>
      )}
    </>
  );
}
