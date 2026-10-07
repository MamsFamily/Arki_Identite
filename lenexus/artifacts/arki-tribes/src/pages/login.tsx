import { useViewedSession as useGetSession } from "@/lib/owner-view";
import { Link } from "wouter";
import { ErrorBox, PageTitle, Skeletons } from "@/components/parts";
import { errMsg, useSeo } from "@/lib/helpers";

export default function Login() {
  useSeo("Connexion", "Connectez-vous avec Discord pour gérer vos tribus ARK.");
  const s = useGetSession();
  const sp = new URLSearchParams(window.location.search);
  const joining = sp.get("retour") === "rejoindre";
  const authError = sp.get("erreur") || sp.get("error") || sp.get("error_description");
  return (
    <div className="max-w-xl mx-auto">
      <PageTitle kicker="Identité Discord" title="Connexion">
        {joining ? "Identifiez-vous avec Discord pour obtenir le lien d’invitation du serveur Arki Family." : "Votre compte Discord identifie les membres et propriétaires de chaque tribu."}
      </PageTitle>
      {authError && (
        <div className="panel border-destructive mb-4" role="alert" data-testid="status-auth-error">
          <p className="font-bold text-destructive">La connexion Discord a échoué</p>
          <p className="text-sm mt-1 break-words">{authError}</p>
        </div>
      )}
      {s.isLoading ? <Skeletons n={1} /> : s.isError ? <ErrorBox message={errMsg(s.error)} onRetry={() => s.refetch()} /> : s.data?.user ? (
        <div className="panel">
          <p>Connecté en tant que <b data-testid="text-session-user">{s.data.user.name}</b>.</p>
          <div className="flex gap-2 mt-4">
            <Link href={joining ? "/rejoindre" : "/mon-espace"} className="btn btn-primary" data-testid="link-my-tribes">{joining ? "Accéder à l’invitation" : "Mon espace"}</Link>
            <Link href="/tribus" className="btn btn-ghost">Annuaire</Link>
          </div>
        </div>
      ) : !s.data?.oauthConfigured ? (
        <div className="panel" data-testid="status-oauth-unavailable">
          <p className="font-bold">Connexion indisponible</p>
          <p className="text-sm mt-2">L'authentification Discord n'est pas encore configurée sur ce serveur. Vous pouvez toujours parcourir l'annuaire.</p>
          {s.data?.configurationMessage && <p className="text-sm mt-2 font-mono text-muted-foreground">{s.data.configurationMessage}</p>}
        </div>
      ) : (
        <div className="panel">
          <a href={joining ? "/api/auth/discord?retour=rejoindre" : "/api/auth/discord"} target="_blank" rel="noopener noreferrer" className="btn btn-primary" data-testid="link-discord-login">Continuer avec Discord</a>
          <p className="text-xs text-muted-foreground mt-3">La connexion s'ouvre dans un nouvel onglet. Après Discord, vous reviendrez sur le site.</p>
        </div>
      )}
    </div>
  );
}
