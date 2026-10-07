import { useState } from "react";
import { UserRound } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListSiteAccess, useGrantSiteAccess, useRevokeSiteAccess, getListSiteAccessQueryKey,
  type SiteAccessInput,
} from "@workspace/api-client-react";
import { Confirm, ErrorBox, Skeletons } from "@/components/parts";
import { errMsg, useWrite } from "@/lib/helpers";

export function SiteAccessPanel() {
  const list=useListSiteAccess({query:{queryKey:getListSiteAccessQueryKey(),refetchInterval:30000}});
  const qc=useQueryClient();
  const w=useWrite(undefined,"Accès mis à jour");
  const [draft,setDraft]=useState<SiteAccessInput>({userId:"",role:"admin"});
  const config={
    request:w.request,
    mutation:{
      onError:w.mutation.onError,
      onSuccess:(data:NonNullable<typeof list.data>)=>{
        qc.setQueryData(getListSiteAccessQueryKey(),data);
        qc.invalidateQueries();
        w.mutation.onSuccess();
      },
    },
  };
  const grant=useGrantSiteAccess(config);
  const revoke=useRevokeSiteAccess(config);
  const pending=grant.isPending || revoke.isPending;
  const valid=/^\d{17,20}$/.test(draft.userId);
  const selectedAccount=list.data?.find(g=>g.userId===draft.userId);
  const selectedName=selectedAccount?.name || draft.userId;
  return (
    <section className="panel mb-8" data-testid="section-site-access">
      <h2 className="text-2xl font-bold text-primary mb-3">Propriétaires et administrateurs du site</h2>
      <p className="text-sm mb-4">Les propriétaires ont tous les droits, y compris celui de gérer les accès. Les administrateurs gèrent toutes les tribus du serveur et les listes, mais ne peuvent pas attribuer de droits.</p>
      <p className="text-sm text-muted-foreground mb-5">L’accès administrateur est manuel : le compte doit aussi être administrateur ou modérateur sur Discord. Si ce rôle Discord disparaît, l’accès administrateur au site est suspendu.</p>
      {list.isLoading?<Skeletons n={1}/>:list.isError?<ErrorBox message={errMsg(list.error)} onRetry={()=>list.refetch()}/>:(
        <ul className="divide-y divide-border mb-5">
          {list.data?.map(g=>(
            <li key={g.userId} className="py-3 flex flex-wrap items-center gap-3" data-testid={`site-access-${g.userId}`}>
              <div className="flex items-center gap-3 min-w-0 max-w-full">
                {g.avatar ? <img src={g.avatar} alt="" loading="lazy" referrerPolicy="no-referrer" className="w-10 h-10 shrink-0 rounded-full object-cover" /> :
                  <span className="w-10 h-10 shrink-0 rounded-full bg-muted grid place-items-center"><UserRound className="w-5 h-5" aria-hidden="true" /></span>}
                <div className="min-w-0">
                  <p className="font-semibold break-words">{g.name || "Compte Discord indisponible"}</p>
                  {g.username ? <p className="text-xs text-muted-foreground break-all">@{g.username}</p> :
                    <p className="text-xs text-muted-foreground break-all">Nom non récupérable · ID : {g.userId}</p>}
                </div>
              </div>
              <span className="chip">{g.primary?"Propriétaire principal":g.role==="owner"?"Propriétaire":"Administrateur"}</span>
              {!g.eligible && <span className="text-sm text-destructive">Suspendu : rôle Discord absent ou non vérifiable</span>}
              {g.primary?<span className="text-xs text-muted-foreground">Accès protégé</span>:(
                <div className="flex gap-2 ml-auto">
                  <button className="btn btn-ghost btn-sm" disabled={pending} onClick={()=>setDraft({userId:g.userId,role:g.role})}>Modifier</button>
                  <Confirm label="Retirer l’accès" title="Retirer cet accès au site ?" description={`Le compte ${g.name ? `${g.name} (@${g.username})` : g.userId} perdra ses droits ${g.role==="owner"?"de propriétaire du site":"d’administrateur du site"}. Ses droits propres sur ses tribus seront conservés.`} confirmLabel="Retirer" disabled={pending} testid={`revoke-site-access-${g.userId}`} onConfirm={()=>revoke.mutate({userId:g.userId})}/>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <form className="grid md:grid-cols-[1fr_220px_auto] gap-3 items-end" onSubmit={e=>e.preventDefault()}>
        <div>
          <label className="lbl" htmlFor="site-account">Identifiant du compte Discord</label>
          <input id="site-account" className="field font-mono" inputMode="numeric" maxLength={20} value={draft.userId} onChange={e=>setDraft({...draft,userId:e.target.value.trim()})} placeholder="17 à 20 chiffres" data-testid="input-site-access-id"/>
          {selectedAccount?.name && <p className="text-xs text-muted-foreground mt-2">Compte sélectionné : {selectedAccount.name}{selectedAccount.username && ` (@${selectedAccount.username})`}</p>}
        </div>
        <div>
          <label className="lbl" htmlFor="site-role">Droits sur le site</label>
          <select id="site-role" className="field" value={draft.role} onChange={e=>setDraft({...draft,role:e.target.value as SiteAccessInput["role"]})} data-testid="select-site-access-role">
            <option value="admin">Administrateur</option>
            <option value="owner">Propriétaire — tous les droits</option>
          </select>
        </div>
        <Confirm label="Accorder l’accès" title={draft.role==="owner"?"Accorder tous les droits ?":"Accorder l’accès administrateur ?"} description={draft.role==="owner"?`Le compte ${selectedName} pourra modifier ou supprimer toutes les tribus et accorder ou retirer des droits à d’autres comptes. Votre accès principal restera protégé.`:`Le compte ${selectedName} pourra gérer les tribus du serveur après vérification de son rôle Discord.`} confirmLabel="Confirmer l’accès" disabled={!valid || pending} testid="button-grant-site-access" onConfirm={()=>grant.mutate({data:draft},{onSuccess:()=>setDraft({userId:"",role:"admin"})})}/>
      </form>
    </section>
  );
}