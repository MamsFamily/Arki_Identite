import { createContext, useContext, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient, useIsMutating } from "@tanstack/react-query";
import { getGetSessionQueryKey, setRequestHeadersGetter, useGetSession, type GetSessionQueryResult } from "@workspace/api-client-react";

type SessionResult = ReturnType<typeof useGetSession<GetSessionQueryResult>>;
type View = { session: SessionResult; isOwner: boolean; playerView: boolean; switching: boolean; focusToggle: { current: boolean }; toggle: () => Promise<void> };
const Context = createContext<View | null>(null);
const storageKey = (id: string) => `arki-player-view:${id}`;
function storedPlayer(id: string) {
  try { return sessionStorage.getItem(storageKey(id)) === "player"; } catch { return false; }
}
function setHeaders(player: boolean) {
  setRequestHeadersGetter(player ? () => ({ "X-Arki-View": "player" }) : null);
}

export function OwnerViewProvider({ children }: { children: ReactNode }) {
  const realSession = useGetSession({
    query: { queryKey: getGetSessionQueryKey(), refetchInterval: 30000 },
    request: { headers: { "X-Arki-View": "owner" } },
  });
  const qc = useQueryClient();
  const id = realSession.data?.user?.id ?? "";
  const isOwner = !!realSession.data?.isOwner && !!id;
  const [choice, setChoice] = useState<{ id: string; player: boolean } | null>(null);
  const [switching, setSwitching] = useState(false);
  const focusToggle = useRef(false);
  const playerView = isOwner && (choice?.id === id ? choice.player : storedPlayer(id));
  const playerSession = useGetSession({
    query: {
      queryKey: [getGetSessionQueryKey()[0], "player", id], enabled: isOwner && playerView, refetchInterval: 30000,
      // Keep the authenticated identity while permissions load; fail closed.
      placeholderData: () => realSession.data ? { ...realSession.data, isAdmin: false, isOwner: false, isPrimaryOwner: false, siteRole: "member" as const, canCreate: false } : undefined,
    },
    request: { headers: { "X-Arki-View": "player" } },
  });
  const session = playerView ? playerSession : realSession;
  useLayoutEffect(() => { setHeaders(playerView); return () => setHeaders(false); }, [playerView]);
  const toggle = async () => {
    if (!isOwner || switching) return;
    const next = !playerView;
    focusToggle.current = true;
    setSwitching(true);
    setHeaders(next);
    // Abort privileged reads, discard their cached results, then remount the
    // current page. Player mode must never reuse an owner response.
    try {
      const sessionKey = getGetSessionQueryKey()[0];
      const predicate = (query: { queryKey: readonly unknown[] }) => query.queryKey[0] !== sessionKey || query.queryKey.length !== 1;
      await qc.cancelQueries({ predicate });
      qc.removeQueries({ predicate });
      try { sessionStorage.setItem(storageKey(id), next ? "player" : "owner"); } catch { /* The switch still works without browser storage. */ }
      setChoice({ id, player: next });
    } finally { setSwitching(false); }
  };
  const value = useMemo(() => ({ session, isOwner, playerView, switching, focusToggle, toggle }), [session, isOwner, playerView, switching]);
  return (
    <Context.Provider value={value}>
      {realSession.isLoading ? <p className="p-8 text-center text-muted-foreground" role="status">Chargement du site…</p> :
        <div key={`${id}:${playerView ? "player" : "owner"}`}>{children}</div>}
    </Context.Provider>
  );
}

export function useOwnerView() {
  const view = useContext(Context);
  if (!view) throw new Error("OwnerViewProvider manquant.");
  return view;
}

export function useViewedSession(): SessionResult {
  return useOwnerView().session;
}

export function OwnerViewToggle() {
  const { session, isOwner, playerView, switching, focusToggle, toggle } = useOwnerView();
  const button = useRef<HTMLButtonElement>(null);
  const mutations = useIsMutating();
  useLayoutEffect(() => {
    if (isOwner && focusToggle.current && button.current) { button.current.focus(); focusToggle.current = false; }
  }, [isOwner, playerView]);
  if (!isOwner) return null;
  return (
    <section className="panel mb-6 grid gap-3" data-testid="section-owner-view">
      <div>
        <h2 className="text-xl font-bold text-primary">Vision du site</h2>
        <p className="text-sm text-muted-foreground mt-2">
          {playerView ? "Vous voyez le site avec vos droits de joueur, sans les outils d’administration. Vos droits de propriétaire sont conservés." :
            "Passez en vision joueur pour voir le site sans vos droits de gestion. Les formulaires de gestion ouverts seront fermés sans enregistrer leurs brouillons."}
        </p>
        {playerView && session.isFetching && <p className="text-xs text-muted-foreground mt-2" role="status">Vérification de vos droits de joueur…</p>}
        {playerView && session.isError && <p className="text-sm text-destructive mt-2" role="alert">La vision joueur n’a pas pu être vérifiée. Vous pouvez revenir en vision propriétaire.</p>}
      </div>
      <button ref={button} type="button" className="btn btn-primary justify-self-start" aria-pressed={playerView}
        disabled={switching || mutations > 0} onClick={() => void toggle()} data-testid="button-owner-view">
        {switching ? "Changement de vision…" : playerView ? "Vision propriétaire" : "Vision joueur"}
      </button>
    </section>
  );
}