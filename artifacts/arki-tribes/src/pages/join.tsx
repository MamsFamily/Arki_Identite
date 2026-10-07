import { Link, Redirect } from "wouter";
import { getGetCommunityInviteQueryKey, useGetCommunityInvite } from "@workspace/api-client-react";
import { useViewedSession as useGetSession } from "@/lib/owner-view";
import { ErrorBox, PageTitle, Skeletons } from "@/components/parts";
import { errMsg, useSeo } from "@/lib/helpers";

export default function JoinCommunity() {
  useSeo("Nous rejoindre", "Identifiez-vous avec Discord pour accéder à l’invitation de la communauté Arki Family.");
  const session = useGetSession();
  const user = session.data?.user;
  const invite = useGetCommunityInvite({
    query: {
      queryKey: [...getGetCommunityInviteQueryKey(), user?.id ?? null],
      enabled: !!user,
      retry: false,
      staleTime: 0,
      gcTime: 0,
    },
  });

  if (session.isLoading) return <Skeletons n={1} />;
  if (session.isError) return <ErrorBox message={errMsg(session.error)} onRetry={() => session.refetch()} />;
  if (!user) return <Redirect to="/connexion?retour=rejoindre" />;

  return (
    <div className="max-w-xl mx-auto">
      <PageTitle kicker="La communauté" title="Nous rejoindre">
        Votre identité Discord est confirmée. Vous pouvez maintenant rejoindre le serveur Arki Family.
      </PageTitle>
      <div className="panel grid gap-4" data-testid="panel-community-invite">
        <p>Connecté en tant que <b data-testid="text-join-user">{user.name}</b>.</p>
        {invite.isFetching ? <Skeletons n={1} /> : invite.isError ? (
          <div>
            <ErrorBox message={errMsg(invite.error)} onRetry={() => invite.refetch()} />
            <Link href="/connexion?retour=rejoindre" className="btn btn-ghost mt-3">Se reconnecter avec Discord</Link>
          </div>
        ) : invite.data ? (
          <>
            <a href={invite.data.url} target="_blank" rel="noopener noreferrer" className="btn btn-primary justify-self-start" data-testid="link-community-discord">
              Rejoindre le serveur Discord
            </a>
            <p className="text-xs text-muted-foreground">
              Discord s’ouvre dans un nouvel onglet pour vous permettre d’accepter l’invitation.
              La recherche de joueurs sera accessible une fois membre du serveur.
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
}