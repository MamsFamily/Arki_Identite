import { getListSiteMapsQueryKey, useListSiteMaps } from "@workspace/api-client-react";
import { ErrorBox, Skeletons } from "@/components/parts";
import { MapEditButton } from "@/components/map-editor";
import { KIND_LABEL } from "@/data/nexus";
import { errMsg } from "@/lib/helpers";

export function MapsPanel() {
  const q = useListSiteMaps({ query: { queryKey: getListSiteMapsQueryKey(), staleTime: 15000, refetchInterval: 30000 } });
  return (
    <section className="panel mb-6" data-testid="section-site-maps">
      <h2 className="text-2xl font-bold text-primary mb-1">Maps du cluster</h2>
      <p className="text-sm text-muted-foreground mb-4">Modifiez les descriptions, zones, créatures, règles et galeries des maps existantes.</p>
      {q.isLoading ? <Skeletons n={2} /> : q.isError || !q.data ? <ErrorBox message={errMsg(q.error)} onRetry={() => q.refetch()} /> : q.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune map disponible.</p>
      ) : (
        <ul className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {q.data.map((m) => (
            <li key={m.slug} className="glass p-3 flex items-center gap-3" data-testid={`row-site-map-${m.slug}`}>
              <img src={m.image} alt="" className="h-14 w-24 rounded object-cover shrink-0" />
              <div className="min-w-0 flex-1"><p className="font-bold truncate">{m.name}</p><p className="text-xs text-muted-foreground">{KIND_LABEL[m.kind]} · rév. {m.revision}</p></div>
              <MapEditButton map={m} label="Modifier" />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
