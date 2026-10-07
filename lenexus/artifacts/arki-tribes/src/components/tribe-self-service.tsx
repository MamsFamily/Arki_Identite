import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLeaveTribe, useUpdateMyTribeName } from "@workspace/api-client-react";
import { Confirm } from "@/components/parts";
import { useWrite } from "@/lib/helpers";

export function MyTribeName() {
  const [name, setName] = useState("");
  const qc = useQueryClient();
  const write = useWrite(undefined, "Nom en jeu enregistré dans vos tribus");
  const save = useUpdateMyTribeName({
    ...write,
    mutation: {
      ...write.mutation,
      onSuccess: () => {
        write.mutation.onSuccess();
        qc.invalidateQueries({ predicate: q => typeof q.queryKey[0] === "string" &&
          (q.queryKey[0].startsWith("/api/tribes/") || q.queryKey[0].startsWith("/api/player-search")) });
        setName("");
      },
    },
  });
  return (
    <form className="panel grid gap-3 mb-6" onSubmit={e => {
      e.preventDefault();
      if (name.trim()) save.mutate({ data: { name: name.trim() } });
    }} data-testid="form-my-ingame-name">
      <label htmlFor="my-ingame-name" className="font-bold">Mon nom en jeu</label>
      <p className="text-sm text-muted-foreground">Ce nom sera mis à jour dans toutes vos tribus, sans changer votre rôle ni vos droits.</p>
      <input id="my-ingame-name" className="field" value={name} onChange={e => setName(e.target.value)}
        required maxLength={100} disabled={save.isPending} placeholder="Votre nouveau nom en jeu" data-testid="input-my-ingame-name" />
      <button className="btn btn-primary justify-self-start" disabled={!name.trim() || save.isPending} data-testid="button-save-my-ingame-name">
        {save.isPending ? "Enregistrement…" : "Enregistrer mon nom"}
      </button>
    </form>
  );
}

export function LeaveTribeButton({ id, name }: { id: number; name: string }) {
  const write = useWrite(id, "Vous avez quitté la tribu");
  const qc = useQueryClient();
  const leave = useLeaveTribe({
    ...write,
    mutation: {
      ...write.mutation,
      onSuccess: () => {
        write.mutation.onSuccess();
        qc.invalidateQueries({ predicate: q => typeof q.queryKey[0] === "string" && q.queryKey[0].startsWith("/api/player-search") });
      },
    },
  });
  return <Confirm label="Quitter la tribu" title={`Quitter ${name} ?`}
    description="Vous perdrez votre appartenance et vos éventuels droits de gestion. Le propriétaire doit d’abord transférer sa tribu."
    confirmLabel="Quitter la tribu" testid={`button-leave-tribe-${id}`} className="btn btn-ghost btn-sm"
    disabled={leave.isPending} onConfirm={() => leave.mutate({ id })} />;
}