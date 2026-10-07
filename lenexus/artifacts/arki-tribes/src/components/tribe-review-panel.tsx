import { Link } from "wouter";
import { getGetTribeReviewQueryKey, useGetTribeReview, type ReviewTribe } from "@workspace/api-client-react";
import { ErrorBox, Skeletons } from "@/components/parts";
import { errMsg } from "@/lib/helpers";

function TribeLinks({ tribe }: { tribe: ReviewTribe }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href={`/tribus/${tribe.id}`} className="text-sm text-primary underline break-words min-w-0">{tribe.name}</Link>
      <Link href={`/tribus/${tribe.id}/gerer`} className="btn btn-ghost btn-sm shrink-0" data-testid={`link-review-manage-${tribe.id}`}>Gérer la fiche</Link>
    </div>
  );
}

export function TribeReviewPanel() {
  const review = useGetTribeReview({
    query: { queryKey: getGetTribeReviewQueryKey(), staleTime: 0, refetchInterval: 60000 },
  });
  const data = review.data;
  return (
    <section id="controle-tribus" className="panel mb-8 scroll-mt-24" data-testid="section-tribe-review">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold text-primary">Contrôle des tribus</h2>
          <p className="text-sm text-muted-foreground mt-2">Vérifier la présence des joueurs sur Discord et leurs associations aux fiches tribu.</p>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" disabled={review.isFetching} onClick={() => review.refetch()} data-testid="button-refresh-tribe-review">
          {review.isFetching ? "Vérification…" : "Actualiser"}
        </button>
      </div>
      {review.isLoading ? <Skeletons n={2} /> : review.isError || !data ? <ErrorBox message={errMsg(review.error)} onRetry={() => review.refetch()} /> : (
        <>
          <div className="text-xs text-muted-foreground grid gap-1 mb-5">
            <p>{data.tribeCount} tribu{data.tribeCount !== 1 ? "s" : ""} examinée{data.tribeCount !== 1 ? "s" : ""}.
              {data.checkedAt && data.discordAvailable && ` Présence Discord vérifiée le ${new Date(data.checkedAt).toLocaleString("fr-FR")}.`}
            </p>
            <p>La liste des membres Discord est conservée jusqu’à 5 minutes entre deux vérifications. Le propriétaire de chaque tribu est également pris en compte.</p>
            {data.uncheckedCount > 0 && <p data-testid="text-tribes-unchecked">{data.uncheckedCount} fiche{data.uncheckedCount > 1 ? "s" : ""} non vérifiable{data.uncheckedCount > 1 ? "s" : ""} : aucune conclusion de départ n’est tirée pour ces fiches.</p>}
          </div>
          {!data.discordAvailable && <p className="p-4 mb-5 border border-amber-400/40 rounded-xl text-sm text-amber-200" role="status" data-testid="warning-discord-review">
            {data.message || "Discord est indisponible. Impossible de confirmer quels joueurs ont quitté le serveur."}
          </p>}
          <div className="grid lg:grid-cols-2 gap-5">
            <section className="min-w-0 border border-white/10 rounded-xl p-4" data-testid="section-absent-tribes">
              <h3 className="text-lg font-bold mb-2">Tribus sans joueur présent sur Discord</h3>
              <p className="text-xs text-muted-foreground mb-4">Aucun des joueurs référencés dans ces fiches n’est présent sur le serveur Discord. Vérifiez chaque fiche avant de décider de sa suppression.</p>
              {data.removable.length > 0 && <>
                <p className="text-xs text-muted-foreground mb-4">Dates des dernières annonces de départ retrouvées dans le salon ♦au-revoir. Les correspondances par pseudo sont à vérifier : un pseudo peut changer ou être réutilisé. Les dates sont affichées à l’heure de Paris.
                  {data.departureChannelUrl && <> <a href={data.departureChannelUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">Voir le salon des départs</a></>}
                </p>
                {data.departureLogsMessage && <p className="text-xs text-amber-200 mb-4" role="status">{data.departureLogsMessage}</p>}
              </>}
              {!data.discordAvailable ? <p className="text-sm text-muted-foreground">Liste non disponible : présence Discord non vérifiable.</p> : data.removable.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune tribu vérifiée dans ce cas.</p>
              ) : (
                <ul className="grid gap-4">
                  {data.removable.map((tribe) => <li key={tribe.id} className="grid gap-2" data-testid={`review-absent-tribe-${tribe.id}`}>
                    <TribeLinks tribe={tribe} />
                    <p className="text-xs text-muted-foreground">{tribe.memberCount} joueur{tribe.memberCount > 1 ? "s" : ""} référencé{tribe.memberCount > 1 ? "s" : ""}.</p>
                    <ul className="grid gap-2">
                      {tribe.departedPlayers?.map(player => <li key={player.userId} className="text-sm border-l-2 border-white/10 pl-3" data-testid={`departure-player-${tribe.id}-${player.userId}`}>
                        <p className="font-semibold break-words">{player.name}</p>
                        <p className="text-xs text-muted-foreground break-all">Discord : {player.userId}</p>
                        {player.departedAt ? <>
                          <p className="mt-1">Départ signalé le <time dateTime={player.departedAt}>{new Date(player.departedAt).toLocaleString("fr-FR", {timeZone:"Europe/Paris", day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit"})}</time>.</p>
                          {player.match === "pseudo" && <p className="text-xs text-amber-200">Correspondance par pseudo — à vérifier.</p>}
                          {player.sourceUrl && <a href={player.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline">Vérifier le message de départ</a>}
                        </> : <p className="mt-1 text-xs text-muted-foreground">{data.departureLogsAvailable ?
                          data.departureLogsComplete ? "Date de départ introuvable : aucun message ne peut être relié clairement à ce compte." : "Date de départ non retrouvée pour le moment : recherche dans l’historique en cours." :
                          "Date de départ non vérifiable : historique Discord indisponible."}</p>}
                      </li>)}
                    </ul>
                  </li>)}
                </ul>
              )}
            </section>
            <section className="min-w-0 border border-white/10 rounded-xl p-4" data-testid="section-multiple-tribes">
              <h3 className="text-lg font-bold mb-2">Joueurs associés à plusieurs tribus</h3>
              <p className="text-xs text-muted-foreground mb-4">Associations enregistrées dans les fiches, à vérifier au cas par cas. Elles restent consultables même si Discord est indisponible.</p>
              {data.duplicates.length === 0 ? <p className="text-sm text-muted-foreground">Aucun joueur associé à plusieurs tribus.</p> : (
                <ul className="grid gap-5">
                  {data.duplicates.map((player) => <li key={player.userId} className="grid gap-2" data-testid={`review-player-${player.userId}`}>
                    <div className="min-w-0">
                      <p className="font-bold break-words">{player.name}</p>
                      <p className="text-xs text-muted-foreground break-all">Discord : {player.userId} · {player.tribes.length} tribus</p>
                    </div>
                    <ul className="grid gap-2">{player.tribes.map((tribe) => <li key={tribe.id}><TribeLinks tribe={tribe} /></li>)}</ul>
                  </li>)}
                </ul>
              )}
            </section>
          </div>
          <p className="text-xs text-muted-foreground mt-5">Aucune suppression automatique. « Gérer la fiche » permet de corriger les membres ou, avec les droits nécessaires, de supprimer la tribu après confirmation.</p>
        </>
      )}
    </section>
  );
}