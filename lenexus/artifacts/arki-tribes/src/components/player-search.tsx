import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { getSearchPlayerProfilesQueryKey, useSearchPlayerProfiles, type PlayerProfile } from "@workspace/api-client-react";
import { useViewedSession as useGetSession } from "@/lib/owner-view";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { fmtDate, initials } from "@/lib/helpers";
import { Search } from "lucide-react";

const PLAYER_KEY = "/api/player-search";

function tenure(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  let months = (now.getFullYear() - d.getFullYear()) * 12 + now.getMonth() - d.getMonth();
  if (now.getDate() < d.getDate()) months--;
  if (months < 1) return "moins d'un mois";
  const y = Math.floor(months / 12), m = months % 12;
  const parts = [];
  if (y) parts.push(`${y} an${y > 1 ? "s" : ""}`);
  if (m) parts.push(`${m} mois`);
  return parts.join(" et ");
}

function PlayerDetail({ p, onNavigate }: { p: PlayerProfile; onNavigate: () => void }) {
  return (
    <article className="panel !p-4 grid gap-3" data-testid={`card-player-${p.id}`}>
      <div className="flex items-center gap-3">
        {p.avatar ? <img src={p.avatar} alt="" className="h-11 w-11 rounded-full object-cover" /> : <div className="h-11 w-11 rounded-full grid place-items-center bg-secondary display text-sm" aria-hidden>{initials(p.name)}</div>}
        <div className="min-w-0">
          <h3 className="display !text-base font-bold truncate">{p.name}</h3>
          <p className="font-mono text-xs text-muted-foreground truncate">@{p.username}</p>
        </div>
      </div>
      <p className="text-sm" data-testid={`text-player-joined-${p.id}`}>
        <span className="lbl !inline">Sur le serveur depuis le </span>
        {p.joinedAt && !isNaN(new Date(p.joinedAt).getTime()) ? <>{fmtDate(p.joinedAt)} <span className="text-muted-foreground">({tenure(p.joinedAt)})</span></> : <span className="text-muted-foreground">Non disponible</span>}
        <span className="block text-xs text-muted-foreground mt-0.5">Date d'arrivée actuelle sur le serveur Discord (dernier retour).</span>
      </p>
      <div>
        <p className="lbl">Tribus sur le site</p>
        {p.tribes.length ? (
          <ul className="grid gap-1.5">
            {p.tribes.map((t) => (
              <li key={t.id}>
                <Link href={`/tribus/${t.id}`} onClick={onNavigate} data-testid={`link-player-tribe-${p.id}-${t.id}`} className="flex flex-wrap items-center gap-2 rounded-lg border border-white/10 px-3 py-2 hover:border-primary/60 transition-colors">
                  <span className="font-bold text-sm">{t.name}</span>
                  {t.role && <span className="chip">{t.role}</span>}
                  {t.isOwner ? <span className="chip">Propriétaire</span> : t.manager ? <span className="chip">Gestionnaire</span> : null}
                </Link>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted-foreground">Aucune association enregistrée sur le site.</p>}
        <p className="text-xs text-muted-foreground mt-2">Ces informations viennent des fiches du site, pas du serveur de jeu : une absence de tribu ici ne prouve pas qu'il n'en a pas en jeu.</p>
      </div>
    </article>
  );
}

export function PlayerSearchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { data: s } = useGetSession();
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const userId = s?.user?.id ?? null;
  const trimmed = term.trim();

  useEffect(() => {
    const h = setTimeout(() => setDebounced(trimmed), 350);
    return () => clearTimeout(h);
  }, [trimmed]);

  useEffect(() => {
    if (!open) { setTerm(""); setDebounced(""); }
    if (!open) qc.removeQueries({ queryKey: [PLAYER_KEY] });
  }, [open, qc]);
  useEffect(() => {
    qc.removeQueries({ queryKey: [PLAYER_KEY] });
  }, [userId, qc]);

  const params = { q: debounced };
  const enabled = open && !!userId && debounced.length >= 2 && debounced === trimmed;
  const query = useSearchPlayerProfiles(params, {
    query: { queryKey: [...getSearchPlayerProfilesQueryKey(params), userId], enabled, retry: false, staleTime: 0, gcTime: 0, refetchInterval: 30000, refetchIntervalInBackground: false },
  });

  const close = () => onOpenChange(false);
  const status = (query.error as { status?: number } | null)?.status;
  const waiting = trimmed.length >= 2 && (trimmed !== debounced || query.isFetching);

  let body;
  if (trimmed.length < 2) body = <p className="text-sm text-muted-foreground" data-testid="status-player-hint">Saisissez au moins 2 caractères pour chercher un joueur ou une tribu.</p>;
  else if (!userId) body = <p className="text-sm" data-testid="status-player-login">Connectez-vous avec Discord pour rechercher un joueur. <Link href="/connexion" onClick={close} className="underline font-bold text-primary">Connexion Discord</Link></p>;
  else if (waiting) body = <div className="grid gap-2" data-testid="status-player-loading" aria-busy="true"><div className="panel h-20 animate-pulse bg-muted" /><div className="panel h-20 animate-pulse bg-muted" /></div>;
  else if (query.isError) {
    const msg = status === 401 ? "Votre session a expiré. Reconnectez-vous avec Discord pour chercher un joueur."
      : status === 403 ? "La recherche de joueurs est réservée aux personnes actuellement membres du serveur Discord Arki Family."
      : status === 503 ? "Discord est momentanément indisponible. Impossible de vérifier votre accès, réessayez dans un instant."
      : "La recherche de joueurs a échoué.";
    body = (
      <div role="alert" className="panel !p-4 border-destructive" data-testid="status-player-error">
        <p className="font-bold text-destructive">Recherche impossible</p>
        <p className="text-sm mt-1">{msg}</p>
        {status === 401 ? <Link href="/connexion" onClick={close} className="btn btn-ghost btn-sm mt-3">Connexion Discord</Link>
          : status !== 403 && <button type="button" className="btn btn-ghost btn-sm mt-3" onClick={() => query.refetch()} data-testid="button-player-retry">Réessayer</button>}
      </div>
    );
  } else if (query.data) {
    body = query.data.players.length === 0 ? (
      <p className="text-sm" data-testid="status-player-empty">Aucun joueur ne correspond à « {debounced} ».</p>
    ) : (
      <div className="grid gap-3" data-testid="list-players">
        {query.data.players.map((p) => <PlayerDetail key={p.id} p={p} onNavigate={close} />)}
        {query.data.hasMore && <p className="text-sm text-muted-foreground" data-testid="status-player-more">D'autres joueurs correspondent. Affinez votre recherche pour les voir.</p>}
      </div>
    );
  } else body = null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[6dvh] translate-y-0 max-h-[88dvh] overflow-y-auto w-[calc(100vw-1.5rem)] max-w-xl p-4 sm:p-6 gap-4" data-testid="dialog-search">
        <DialogTitle className="display !text-lg">Rechercher</DialogTitle>
        <DialogDescription className="text-xs text-muted-foreground -mt-2">Un joueur du serveur (membres Discord) ou une tribu.</DialogDescription>
        <form role="search" className="grid gap-2" onSubmit={(e) => { e.preventDefault(); navigate(`/tribus${trimmed ? `?q=${encodeURIComponent(trimmed)}` : ""}`); close(); }}>
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input autoFocus type="search" maxLength={80} aria-label="Nom de joueur ou de tribu" placeholder="Nom d'un joueur ou d'une tribu" data-testid="input-nav-search" className="field !pl-10" value={term} onChange={(e) => setTerm(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-ghost btn-sm justify-self-start" data-testid="button-search-tribes">{trimmed ? `Voir les tribus pour « ${trimmed} »` : "Parcourir les tribus"}</button>
        </form>
        <div className="rule-glow" />
        <div aria-live="polite" data-testid="region-player-results">{body}</div>
      </DialogContent>
    </Dialog>
  );
}
