import { useState } from "react";
import { CalendarDays, Clock, MapPin, X } from "lucide-react";
import { EventCard, PageBanner, Reveal, Tabs } from "@/components/nexus";
import { Empty } from "@/components/parts";
import { EVENTS, IMG } from "@/data/nexus";
import { useSeo } from "@/lib/helpers";

const TABS = [{ key: "upcoming", label: "Événements à venir" }, { key: "past", label: "Anciens événements" }, { key: "calendar", label: "Calendrier" }] as const;

export default function Events() {
  useSeo("Événements", "Des aventures toute l'année avec la communauté Arki Family.");
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("upcoming");
  const [sel, setSel] = useState<string | null>(null);
  const featured = EVENTS[0];
  const chosen = EVENTS.find((e) => e.id === sel);
  const others = EVENTS.filter((e) => e.status === "upcoming" && e.id !== featured?.id);
  const past = EVENTS.filter((e) => e.status === "past");
  return (
    <>
      <PageBanner kicker="Communauté" title="Événements" sub="Les prochains événements seront annoncés ici." image={IMG.aurora} />
      {EVENTS.length === 0 && <div className="mb-6"><Empty title="Aucun événement pour le moment" /></div>}
      {chosen && (
        <section className="glass p-6 mb-8 grid md:grid-cols-[280px_1fr] gap-6 relative" aria-label={`Détails : ${chosen.title}`} data-testid="panel-event-detail">
          <button className="absolute right-3 top-3 h-9 w-9 grid place-items-center rounded-full border border-white/15" aria-label="Fermer les détails" onClick={() => setSel(null)}><X className="h-4 w-4" /></button>
          <img src={chosen.image} alt="" className="rounded-xl w-full h-48 md:h-full object-cover" />
          <div className="grid gap-3 content-start">
            <p className="eyebrow">{chosen.category}</p>
            <h2 className="text-2xl uppercase">{chosen.title}</h2>
            <p className="text-sm text-[#c9d4e4]">{chosen.description}</p>
            <ul className="text-sm grid gap-1.5 text-muted-foreground">
              <li className="flex gap-2 items-center"><CalendarDays className="h-4 w-4 text-primary" /> {chosen.date}</li>
              <li className="flex gap-2 items-center"><Clock className="h-4 w-4 text-primary" /> {chosen.time}</li>
              <li className="flex gap-2 items-center"><MapPin className="h-4 w-4 text-primary" /> {chosen.map}</li>
            </ul>
            <div><button className="btn btn-ghost btn-sm" disabled>Inscription bientôt disponible</button></div>
          </div>
        </section>
      )}
      <Tabs tabs={TABS} value={tab} onChange={setTab} label="Catalogue des événements" />
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "upcoming" && featured && (
          <div className="grid gap-8">
            <Reveal>
              <article className="relative overflow-hidden rounded-3xl border border-[#F39AC9]/40 min-h-[340px] flex items-end isolate shadow-[0_0_40px_rgba(156,124,255,.15)]" data-testid="card-event-featured">
                <img src={featured.image} alt="" className="absolute inset-0 w-full h-full object-cover -z-20" />
                <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#080C16] via-[#080C16]/70 to-transparent" />
                <div className="p-6 sm:p-10 max-w-xl">
                  <span className="chip !border-[#FFA078] !text-[#FFA078]">Événement à venir</span>
                  <h2 className="nx-h1 uppercase mt-4">{featured.title}</h2>
                  <p className="mt-3 text-[#c9d4e4]">{featured.subtitle}</p>
                  <p className="mt-3 text-sm font-bold">{featured.date} - {featured.time} - {featured.map}</p>
                  <button className="btn btn-primary mt-5" onClick={() => setSel(featured.id)} data-testid="button-event-details">Voir les détails</button>
                </div>
              </article>
            </Reveal>
            <div>
              <h2 className="text-xl uppercase mb-4">Autres événements</h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">{others.map((e) => <Reveal key={e.id}><EventCard ev={e} onOpen={setSel} /></Reveal>)}</div>
            </div>
          </div>
        )}
        {tab === "past" && <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{past.map((e) => <EventCard key={e.id} ev={e} onOpen={setSel} />)}</div>}
        {tab === "calendar" && (
          <ol className="grid gap-3">
            {EVENTS.map((e) => (
              <li key={e.id}><button type="button" onClick={() => setSel(e.id)} className="glass w-full p-4 flex flex-wrap items-center gap-x-6 gap-y-1 text-left hover:border-[#65D8FF]/60 transition-colors">
                <span className="font-bold w-48">{e.date}</span><span className="display flex-1 tracking-[.08em]">{e.title}</span><span className="text-sm text-muted-foreground">{e.time} - {e.map}</span>
              </button></li>
            ))}
          </ol>
        )}
      </div>
    </>
  );
}
