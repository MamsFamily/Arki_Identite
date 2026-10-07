import { useEffect, useState } from "react";
import { useListDiscordPlayers, type DiscordPlayer } from "@workspace/api-client-react";
import { errMsg } from "@/lib/helpers";

export function DiscordPlayerPicker({tribeId, value, selectedName, disabled, onSelect}: {
  tribeId?: number; value: string; selectedName?: string; disabled?: boolean; onSelect: (player: DiscordPlayer)=>void;
}) {
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [after, setAfter] = useState<string>();
  useEffect(() => {const timer=setTimeout(() => {setQ(search.trim()); setAfter(undefined);}, 350); return () => clearTimeout(timer);}, [search]);
  const list = useListDiscordPlayers({tribeId, q, after});
  return <div className="min-w-0">
    <label className="lbl" htmlFor="discord-player-search">Joueur du serveur Discord</label>
    <input id="discord-player-search" className="field" maxLength={80} value={search} disabled={disabled}
      placeholder="Rechercher un pseudo Discord..." data-testid="input-member-search" onChange={e => setSearch(e.target.value)} />
    {value && <p className="text-xs mt-2" data-testid="text-selected-player">Sélectionné : {selectedName || value}</p>}
    {list.isLoading || search.trim()!==q ? <p className="text-sm mt-2" role="status">Recherche des joueurs...</p> :
      list.isError ? <div className="text-sm mt-2" role="alert"><p>{errMsg(list.error)}</p><button type="button" className="btn btn-ghost btn-sm" onClick={() => list.refetch()}>Réessayer</button></div> :
      <div className="mt-2">
        <ul className="max-h-56 overflow-y-auto grid gap-1" aria-label="Joueurs Discord">
          {list.data?.players.map(player => <li key={player.id}>
            <button type="button" className={`w-full text-left rounded-lg p-2 flex gap-2 items-center ${value===player.id ? "bg-primary/20" : "hover:bg-muted"}`}
              disabled={disabled} aria-pressed={value===player.id} data-testid={`player-${player.id}`} onClick={() => onSelect(player)}>
              {player.avatar && <img src={player.avatar} alt="" className="h-8 w-8 rounded-full shrink-0" />}
              <span className="min-w-0"><b className="block text-sm truncate">{player.name}</b><span className="block text-xs text-muted-foreground truncate">@{player.username}</span></span>
            </button>
          </li>)}
        </ul>
        {!list.data?.players.length && <p className="text-sm text-muted-foreground">Aucun joueur trouvé.</p>}
        <div className="flex flex-wrap gap-2 mt-2">
          {after && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAfter(undefined)}>Début de la liste</button>}
          {list.data?.nextAfter && <button type="button" className="btn btn-ghost btn-sm" data-testid="button-next-players" onClick={() => setAfter(list.data!.nextAfter!)}>Joueurs suivants</button>}
        </div>
        {q && list.data?.players.length===100 && <p className="text-xs">Affinez votre recherche pour trouver le joueur.</p>}
      </div>}
  </div>;
}