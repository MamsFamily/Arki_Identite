import { Link, useLocation } from "wouter";
import { getListTribesQueryKey, useCreateTribe, useGetOptions, useListTribes } from "@workspace/api-client-react";
import { useViewedSession as useGetSession } from "@/lib/owner-view";
import { BackLink, DevNotice, Empty, ErrorBox, PageTitle, Skeletons, TribeCard } from "@/components/parts";
import { errMsg, useSeo, useWrite } from "@/lib/helpers";
import { CreationTribeForm } from "@/components/creation-tribe-form";

function LoginPrompt({ text }: { text: string }) {
  return (
    <Empty title="Connexion requise">
      <p>{text}</p>
      <Link href="/connexion" className="btn btn-primary mt-4" data-testid="link-to-login">Se connecter avec Discord</Link>
    </Empty>
  );
}

export function MyTribes() {
  useSeo("Mes tribus", "Les tribus que vous gérez avec votre identité Discord.");
  const s = useGetSession();
  const user = s.data?.user;
  const list = useListTribes({ mine: true }, { query: { enabled: !!user, queryKey: getListTribesQueryKey({ mine: true }) } });
  return (
    <>
      <PageTitle kicker="Espace personnel" title="Mes tribus">Vos tribus sont reliées automatiquement à votre compte Discord : celles dont vous êtes propriétaire ou membre apparaissent ici.</PageTitle>
      <DevNotice />
      {s.isLoading ? <Skeletons n={3} /> : s.isError ? <ErrorBox message={errMsg(s.error)} onRetry={() => s.refetch()} /> : !user ? (
        <LoginPrompt text="Identifiez-vous pour retrouver vos tribus." />
      ) : list.isLoading ? <Skeletons n={3} /> : list.isError ? <ErrorBox message={errMsg(list.error)} onRetry={() => list.refetch()} /> : !list.data?.length ? (
        <Empty title="Aucune tribu liée à votre compte">
          <p className="max-w-xl mx-auto" data-testid="text-mine-empty">Le lien se fait avec votre identifiant Discord{user?.name ? ` (${user.name})` : ""}. Si votre tribu existe déjà, cherchez-la dans l'annuaire : ne la recréez pas. Si elle manque, signalez-le au staff.</p>
          <div className="mt-4 flex flex-wrap gap-2 justify-center">
            <Link href="/tribus" className="btn btn-primary" data-testid="link-find-in-directory">Chercher dans l'annuaire</Link>
            <Link href="/creer" className="btn btn-ghost" data-testid="link-create-first">Ma tribu n'existe vraiment pas : la créer</Link>
          </div>
        </Empty>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.data.map((t) => (
            <div key={t.id} className="grid gap-2">
              <TribeCard t={t} />
              {t.canEdit && <Link href={`/tribus/${t.id}/gerer`} className="btn btn-ghost btn-sm" data-testid={`link-manage-${t.id}`}>Gérer</Link>}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export function CreateTribe() {
  useSeo("Créer une tribu", "Publiez la fiche de votre tribu ARK dans l'annuaire Arki Family.");
  const s = useGetSession();
  const [, nav] = useLocation();
  const opts = useGetOptions();
  const w = useWrite(undefined, "Tribu créée");
  const create = useCreateTribe({
    request: w.request,
    mutation: {
      onError: w.mutation.onError,
      onSuccess: (t) => {
        w.mutation.onSuccess();
        nav(`/tribus/${t.id}/gerer`);
      },
    },
  });
  return (
    <>
      <BackLink href="/mon-espace">Mon espace</BackLink>
      <PageTitle kicker="Nouvelle fiche" title="Créer une tribu">Vérifiez d'abord que votre tribu n'est pas déjà dans l'annuaire. Vous deviendrez propriétaire de la fiche.</PageTitle>
      <DevNotice />
      {s.isLoading ? <Skeletons n={2} /> : s.isError ? <ErrorBox message={errMsg(s.error)} onRetry={() => s.refetch()} /> : !s.data?.user ? (
        <LoginPrompt text="La création nécessite un compte Discord." />
      ) : !s.data.canCreate ? (
        <Empty title="Création indisponible"><span data-testid="text-config-message">{s.data.configurationMessage}</span></Empty>
      ) : (
        <div className="panel">
          <CreationTribeForm owner={s.data.user} options={opts.data} pending={create.isPending} onSubmit={(v) => create.mutate({ data: v })} />
        </div>
      )}
    </>
  );
}
