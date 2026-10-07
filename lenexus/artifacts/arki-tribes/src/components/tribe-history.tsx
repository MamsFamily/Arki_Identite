import { useState } from "react";
import { getGetTribeHistoryQueryKey, useGetTribeHistory } from "@workspace/api-client-react";
import { useViewedSession as useGetSession } from "@/lib/owner-view";
import { ErrorBox, Skeletons } from "@/components/parts";
import { errMsg } from "@/lib/helpers";

export function TribeHistory({ id, canEdit }: { id: number; canEdit: boolean }) {
  const session = useGetSession();
  const [cursors, setCursors] = useState<number[]>([]);
  const params = cursors.length ? { before: cursors[cursors.length - 1] } : undefined;
  const history = useGetTribeHistory(id, params, { query: {
    queryKey: [...getGetTribeHistoryQueryKey(id, params), session.data?.user?.id ?? null],
    enabled: canEdit && !!session.data?.user, staleTime: 0, gcTime: 0, retry: false,
  } });
  if (!canEdit) return <p className="text-sm text-muted-foreground">L’historique des modifications est réservé au propriétaire, aux responsables et au staff autorisé.</p>;
  if (history.isLoading || history.isFetching) return <Skeletons n={1} />;
  if (history.isError) return <ErrorBox message={errMsg(history.error)} onRetry={() => history.refetch()} />;
  if (!history.data) return null;
  return <div data-testid="tribe-history">
    {!history.data.entries.length ? <p className="text-sm text-muted-foreground">Aucune action enregistrée.</p> :
      <ol className="grid gap-4">{history.data.entries.map(entry => <li key={entry.id} className="border-b border-border pb-3" data-testid={`history-entry-${entry.id}`}>
        <p className="font-bold">{entry.action}</p>
        <p className="text-sm whitespace-pre-wrap break-words">{entry.details}</p>
        <p className="text-xs text-muted-foreground mt-1">
          <time dateTime={entry.createdAt}>{new Date(entry.createdAt).toLocaleString("fr-FR")}</time>
          {" · Compte Discord "}{entry.actorId}
        </p>
      </li>)}</ol>}
    <div className="flex flex-wrap items-center gap-3 mt-4">
      <button className="btn btn-ghost btn-sm" disabled={!cursors.length} onClick={() => setCursors(c => c.slice(0, -1))} data-testid="button-history-previous">Précédent</button>
      <span className="text-sm">Page {cursors.length + 1}</span>
      <button className="btn btn-ghost btn-sm" disabled={history.data.nextBefore === null} onClick={() => {
        if (history.data?.nextBefore != null) setCursors(c => [...c, history.data!.nextBefore!]);
      }} data-testid="button-history-next">Suivant</button>
    </div>
  </div>;
}