import { useState } from "react";
import { Link } from "wouter";
import { Archive, ArrowDownUp, BadgeCheck, Boxes, ChevronLeft, ChevronRight, Clock3, ExternalLink, PackageOpen, ReceiptText, ShieldAlert, TicketCheck } from "lucide-react";
import { useArkiAccount, useArkiCatalog, useArkiStaff, type ArkiOrder } from "@/lib/arki-bridge";
import { useOwnerView, useViewedSession } from "@/lib/owner-view";
import { Empty, ErrorBox, PageTitle, Skeletons } from "@/components/parts";
import { errMsg, useSeo } from "@/lib/helpers";

function dateLabel(value: string | number) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date inconnue" : date.toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });
}

function freshness(value?: string) {
  if (!value) return "Actualisation inconnue";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Actualisation inconnue" : `Données reçues le ${date.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}`;
}

function statusLabel(status: string) {
  const key = status.trim().toLocaleLowerCase("fr-FR");
  const known: Record<string, string> = {
    pending: "En attente", open: "Ouvert", processing: "En cours", in_progress: "En cours",
    paid: "Payée", completed: "Terminée", fulfilled: "Livrée", delivered: "Livrée",
    closed: "Fermé", cancelled: "Annulée", canceled: "Annulée", rejected: "Refusée",
    resolved: "Résolu", waiting: "En attente", awaiting_payment: "En attente de paiement",
    awaiting_ticket: "En attente d’un ticket", ticket_open: "Ticket ouvert", deleted: "Supprimé",
    expired: "Expiré", refunded: "Remboursée", approved: "Approuvée", active: "Actif",
  };
  return known[key] ?? (status.trim() || "Statut non précisé").replace(/[_-]+/g, " ");
}

function statusTone(status: string) {
  const key = status.toLocaleLowerCase("fr-FR");
  if (/complete|paid|deliver|resolv|termin|livr/.test(key)) return "border-emerald-300/30 bg-emerald-300/10 text-emerald-100";
  if (/cancel|reject|error|fail|annul|refus/.test(key)) return "border-rose-300/30 bg-rose-300/10 text-rose-100";
  return "border-[#65D8FF]/25 bg-[#65D8FF]/10 text-[#bcefff]";
}

function TicketAnchor({ url, children }: { url: string | null; children: string }) {
  let safeUrl: string | null = null;
  if (url) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === "https:") safeUrl = parsed.href;
    } catch { /* A malformed historical URL is shown without a link. */ }
  }
  return safeUrl
    ? <a className="underline underline-offset-4 text-primary hover:text-[#bcefff] inline-flex items-center gap-1" href={safeUrl} target="_blank" rel="noreferrer">{children}<ExternalLink className="h-3 w-3" aria-hidden="true" /></a>
    : <span>{children}</span>;
}

function BridgeError({ error, retry }: { error: unknown; retry: () => void }) {
  const message = errMsg(error);
  const unconfigured = /non configur|not configur|configuration manquante|service.*configur/i.test(message);
  return (
    <div className="panel border border-amber-200/25 bg-amber-200/[.035]" role="alert" data-testid={unconfigured ? "status-arki-unconfigured" : "status-arki-error"}>
      <p className="font-bold flex items-center gap-2 text-amber-100"><ShieldAlert className="h-4 w-4" />{unconfigured ? "Service ArkiFamily non configuré" : "Service ArkiFamily indisponible"}</p>
      <p className="text-sm mt-2 text-muted-foreground">{unconfigured ? "La connexion aux données de la boutique n’est pas configurée pour le moment." : "La lecture des données n’a pas abouti. Aucune donnée locale ou fictive n’est affichée."}</p>
      <p className="text-xs mt-2 break-words">{message}</p>
      <button className="btn btn-ghost btn-sm mt-3" type="button" onClick={retry}>Réessayer</button>
    </div>
  );
}

function InventorySection({ data }: { data: NonNullable<ReturnType<typeof useArkiAccount>["data"]> }) {
  return (
    <section className="panel !p-0 overflow-hidden" aria-labelledby="inventory-heading">
      <div className="flex flex-wrap items-end justify-between gap-3 p-5 sm:p-6 border-b border-white/10">
        <div><p className="eyebrow">Mon compte de jeu</p><h2 id="inventory-heading" className="display text-2xl font-bold mt-1">Inventaire ArkiFamily</h2></div>
        <span className="chip">{data.inventory.length} référence{data.inventory.length === 1 ? "" : "s"}</span>
      </div>
      {data.inventory.length === 0 ? <Empty title="Inventaire vide"><p>Aucun objet ArkiFamily n’est actuellement associé à votre compte.</p></Empty> : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground"><tr><th className="px-5 py-3">Objet</th><th className="px-5 py-3">Catégorie</th><th className="px-5 py-3 text-right">Quantité</th></tr></thead>
            <tbody>{data.inventory.map((item) => <tr key={item.id} className="border-t border-white/[.07]">
              <td className="px-5 py-4 font-semibold">{item.name}</td><td className="px-5 py-4 text-muted-foreground">{item.category || "Non classé"}</td><td className="px-5 py-4 text-right font-mono tabular-nums">{item.quantity.toLocaleString("fr-FR")}</td>
            </tr>)}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function OrderCard({ order, staff = false }: { order: ArkiOrder; staff?: boolean }) {
  return (
    <article className="panel !p-5 grid gap-4" data-testid={`arki-order-${order.id}`}>
      <div className="flex flex-wrap gap-3 items-start justify-between">
        <div className="min-w-0">
          <p className="eyebrow">Commande · {dateLabel(order.createdAt)}</p>
          <h3 className="display text-xl font-bold mt-1">Référence {order.id}</h3>
          {staff && <p className="text-sm text-muted-foreground mt-1">{order.customerName || order.discordUserId || "Joueur non identifié"}</p>}
        </div>
        <span className={`chip border ${statusTone(order.status)}`}>{statusLabel(order.status)}</span>
      </div>
      <div className="grid gap-2">
        {order.items.map((item, index) => (
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 border-t border-white/[.07] pt-3 text-sm" key={`${order.id}-${index}`}>
            <div><span className="font-semibold">{item.name}</span><span className="text-muted-foreground"> · {item.quantity} × {item.variant}</span>
              {(item.sex || item.stat) && <p className="text-xs text-muted-foreground mt-1">{[item.sex, item.stat].filter(Boolean).join(" · ")}</p>}
            </div>
            <span className="font-mono text-xs text-muted-foreground">{item.diamonds} diamants · {item.strawberries} fraises</span>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap justify-between items-center gap-2 border-t border-white/[.07] pt-3 text-xs text-muted-foreground">
        <span>Réduction appliquée : {order.discountPercent}% · calculée avec le staff dans Discord.</span>
        <TicketAnchor url={order.ticketUrl}>{order.ticketUrl ? "Ouvrir le ticket" : "Aucun lien de ticket"}</TicketAnchor>
      </div>
    </article>
  );
}

export function MesInformations() {
  useSeo("Mes informations ArkiFamily", "Inventaire, commandes et tickets liés à votre compte.");
  const session = useViewedSession();
  const user = session.data?.user;
  const account = useArkiAccount(user?.id);
  if (session.isLoading) return <Skeletons n={2} />;
  if (session.isError) return <ErrorBox message={errMsg(session.error)} onRetry={() => session.refetch()} />;
  if (!user) return <><PageTitle kicker="Espace joueur" title="Mes informations">Consultez les données ArkiFamily reliées à votre compte Discord.</PageTitle><Empty title="Connexion requise"><p>Connectez-vous pour consulter vos données privées.</p><Link href="/connexion" className="btn btn-primary mt-4">Se connecter avec Discord</Link></Empty></>;
  return (
    <>
      <PageTitle kicker="Espace joueur" title="Mes informations">Vos données ArkiFamily, en lecture seule. Les changements de commande se poursuivent dans Discord.</PageTitle>
      <div className="flex flex-wrap gap-2 mb-6">
        <Link href="/catalogue-arkifamily" className="btn btn-ghost btn-sm"><Boxes className="h-4 w-4" />Catalogue ArkiFamily</Link>
        <Link href="/mon-espace" className="btn btn-ghost btn-sm">Retour à mon espace</Link>
      </div>
      {account.isLoading ? <Skeletons n={3} /> : account.isError ? <BridgeError error={account.error} retry={() => void account.refetch()} /> : !account.data ? <Empty title="Aucune donnée reçue"><p>Le service n’a retourné aucune donnée pour ce compte.</p></Empty> : (
        <div className="grid gap-6">
          <p className="text-xs text-muted-foreground flex items-center gap-2"><Clock3 className="h-3.5 w-3.5" />{freshness(account.data.fetchedAt)} · synchronisation en lecture seule</p>
          <InventorySection data={account.data} />
          <section className="grid gap-4" aria-labelledby="orders-heading">
            <div className="flex items-end justify-between gap-3"><div><p className="eyebrow">Suivi</p><h2 id="orders-heading" className="display text-2xl font-bold mt-1">Mes commandes</h2></div><ReceiptText className="h-5 w-5 text-primary" /></div>
            {account.data.orders.length ? account.data.orders.map((order) => <OrderCard key={order.id} order={order} />) : <Empty title="Aucune commande"><p>Vos commandes ArkiFamily apparaîtront ici lorsqu’elles seront reliées à votre compte.</p></Empty>}
          </section>
          <section className="grid gap-4" aria-labelledby="tickets-heading">
            <div className="flex items-end justify-between gap-3"><div><p className="eyebrow">Assistance</p><h2 id="tickets-heading" className="display text-2xl font-bold mt-1">Mes tickets</h2></div><TicketCheck className="h-5 w-5 text-primary" /></div>
            {account.data.tickets.length ? <div className="grid gap-3">{account.data.tickets.map((ticket) => {
              const historical = /closed|deleted|fermé|supprim/i.test(ticket.status);
              return <article key={ticket.id} className="panel flex flex-wrap items-center justify-between gap-3">
                <div><p className="font-semibold">{ticket.kind || "Assistance"} · {ticket.id}</p><p className="text-xs text-muted-foreground mt-1">{dateLabel(ticket.createdAt)}</p>
                  {historical && <p className="text-xs text-muted-foreground mt-2">Enregistrement historique : le salon Discord peut être fermé ou inaccessible.</p>}</div>
                <div className="flex items-center gap-3"><span className={`chip border ${statusTone(ticket.status)}`}>{statusLabel(ticket.status)}</span><TicketAnchor url={ticket.url}>{ticket.url ? "Voir le ticket" : "Aucun lien de ticket"}</TicketAnchor></div>
              </article>;
            })}</div> : <Empty title="Aucun ticket"><p>Il n’y a aucun ticket relié à votre compte.</p></Empty>}
          </section>
          <section className="grid gap-4" aria-labelledby="activity-heading">
            <div className="flex items-end justify-between gap-3"><div><p className="eyebrow">Historique personnel</p><h2 id="activity-heading" className="display text-2xl font-bold mt-1">Activité récente d’inventaire</h2></div><ArrowDownUp className="h-5 w-5 text-primary" /></div>
            {account.data.activity.length ? <div className="panel !p-0 divide-y divide-white/[.07]">{account.data.activity.map((entry, index) => <div key={`${entry.timestamp}-${entry.itemId}-${index}`} className="p-4 sm:px-5 flex flex-wrap justify-between gap-2">
              <div><p className="font-semibold">{entry.action} <span className="text-muted-foreground font-normal">· {entry.itemId}</span></p><p className="text-xs text-muted-foreground mt-1">Quantité : {entry.quantity}</p></div><time className="text-xs text-muted-foreground">{dateLabel(entry.timestamp)}</time>
            </div>)}</div> : <Empty title="Aucune activité récente"><p>Aucun mouvement d’inventaire n’est disponible pour le moment.</p></Empty>}
          </section>
        </div>
      )}
    </>
  );
}

export function ArkiCatalogPage() {
  useSeo("Catalogue ArkiFamily", "Catalogue ArkiFamily authentifié avec ses tarifs de base.");
  const session = useViewedSession();
  const user = session.data?.user;
  const catalog = useArkiCatalog(user?.id);
  if (session.isLoading) return <Skeletons n={2} />;
  if (session.isError) return <ErrorBox message={errMsg(session.error)} onRetry={() => session.refetch()} />;
  if (!user) return <><PageTitle kicker="Boutique" title="Catalogue ArkiFamily">Catalogue authentifié des articles et tarifs de base.</PageTitle><Empty title="Connexion requise"><p>Le catalogue est réservé aux membres connectés.</p><Link href="/connexion" className="btn btn-primary mt-4">Se connecter avec Discord</Link></Empty></>;
  return (
    <>
      <PageTitle kicker="Boutique authentifiée" title="Catalogue ArkiFamily">Consultez les tarifs de base actuels. Les promotions et réductions sont calculées dans les tickets Discord.</PageTitle>
      <div className="mb-6"><Link href="/mes-informations" className="btn btn-ghost btn-sm"><PackageOpen className="h-4 w-4" />Mon inventaire et mes commandes</Link></div>
      {catalog.isLoading ? <Skeletons n={4} /> : catalog.isError ? <BridgeError error={catalog.error} retry={() => void catalog.refetch()} /> : !catalog.data ? <Empty title="Catalogue indisponible"><p>Aucune donnée de catalogue n’a été reçue.</p></Empty> : (
        <div className="grid gap-6">
          <div className="panel border-[#65D8FF]/20 flex flex-wrap justify-between gap-3"><p className="max-w-3xl text-sm">{catalog.data.pricingNotice}</p><span className="text-xs text-muted-foreground whitespace-nowrap">{freshness(catalog.data.fetchedAt)}</span></div>
          {catalog.data.products.length === 0 ? <Empty title="Catalogue vide"><p>Aucun produit n’est actuellement publié dans le catalogue ArkiFamily.</p></Empty> : (
            <div className="grid md:grid-cols-2 gap-4">{catalog.data.products.map((product) => <article className="panel grid content-start gap-4" key={product.id}>
              <div className="flex items-start justify-between gap-3"><div><p className="eyebrow">{product.category} · {product.type}</p><h2 className="display text-xl font-bold mt-1">{product.name}</h2></div><BadgeCheck className="h-5 w-5 text-primary shrink-0" /></div>
              {product.description && <p className="text-sm text-muted-foreground leading-relaxed">{product.description}</p>}
              <div className="grid gap-2 border-t border-white/10 pt-3">
                <p className="text-[.65rem] uppercase tracking-[.16em] text-muted-foreground">Tarifs de base</p>
                {product.prices.map((price, index) => <div className="flex justify-between gap-3 text-sm" key={`${price.label}-${index}`}><span>{price.label}</span><span className="font-mono text-right">{price.diamonds} diamants · {price.strawberries} fraises</span></div>)}
              </div>
              {product.noReduction && <p className="text-xs text-muted-foreground">Cet article ne bénéficie pas de réduction.</p>}
            </article>)}</div>
          )}
        </div>
      )}
    </>
  );
}

export function ArkiStaffOrdersPage() {
  useSeo("Commandes ArkiFamily", "Consultation en lecture seule des commandes ArkiFamily pour le staff.");
  const session = useViewedSession();
  const view = useOwnerView();
  const user = session.data?.user;
  const allowed = !view.playerView && session.data?.isAdmin === true;
  const [page, setPage] = useState(1);
  const staff = useArkiStaff(user?.id, allowed, page);
  if (session.isLoading) return <Skeletons n={2} />;
  if (session.isError) return <ErrorBox message={errMsg(session.error)} onRetry={() => session.refetch()} />;
  if (!user) return <><PageTitle kicker="Administration · boutique" title="Commandes">Vue de consultation des commandes ArkiFamily.</PageTitle><Empty title="Connexion requise"><p>Connectez-vous avec un compte staff autorisé.</p><Link href="/connexion" className="btn btn-primary mt-4">Se connecter avec Discord</Link></Empty></>;
  if (view.playerView || !session.data?.isAdmin) return <><PageTitle kicker="Administration · boutique" title="Commandes">Vue de consultation, sans modification de commande.</PageTitle><Empty title="Accès réservé"><p>Cette vue est réservée aux comptes staff autorisés. La vision joueur ne présente aucune donnée ni commande staff.</p><Link href="/mon-espace" className="btn btn-ghost mt-4">Retour à mon espace</Link></Empty></>;
  return (
    <>
      <PageTitle kicker="Administration · boutique" title="Commandes ArkiFamily">Vue staff en lecture seule. Les validations et échanges restent dans les tickets Discord.</PageTitle>
      <div className="panel mb-5 flex flex-wrap justify-between gap-3 items-center">
        <p className="text-sm text-muted-foreground flex items-center gap-2"><Archive className="h-4 w-4 text-primary" />Consultation uniquement · aucune commande ne peut être modifiée ici.</p>
        {staff.data && <span className="text-xs text-muted-foreground">{freshness(staff.data.fetchedAt)}</span>}
      </div>
      {staff.isLoading ? <Skeletons n={4} /> : staff.isError ? <BridgeError error={staff.error} retry={() => void staff.refetch()} /> : !staff.data ? <Empty title="Aucune donnée reçue"><p>Le service n’a retourné aucune page de commandes.</p></Empty> : (
        <>
          {staff.data.orders.length ? <div className="grid gap-4">{staff.data.orders.map((order) => <OrderCard key={order.id} order={order} staff />)}</div> : <Empty title="Aucune commande sur cette page"><p>Il n’y a aucune commande à afficher ici.</p></Empty>}
          <nav aria-label="Pagination des commandes" className="flex justify-between items-center mt-5">
            <button type="button" className="btn btn-ghost btn-sm" disabled={page <= 1 || staff.isFetching} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft className="h-4 w-4" />Page précédente</button>
            <span className="text-sm text-muted-foreground">Page {staff.data.page}</span>
            <button type="button" className="btn btn-ghost btn-sm" disabled={!staff.data.hasMore || staff.isFetching} onClick={() => setPage((current) => current + 1)}>Page suivante<ChevronRight className="h-4 w-4" /></button>
          </nav>
        </>
      )}
    </>
  );
}
