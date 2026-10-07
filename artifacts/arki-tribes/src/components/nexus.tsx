import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { ArrowUpRight, Egg, Gauge, Hourglass, Map as MapIcon, PawPrint, Search, Skull, Sparkles, Sprout, Users } from "lucide-react";
import { IMG, KIND_LABEL, type EventEntry, type MapEntry, type ModEntry } from "@/data/nexus";

export function Reveal({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) { setOn(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setOn(true); io.disconnect(); } }, { threshold: 0.1 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <div ref={ref} className={`reveal ${on ? "in" : ""} ${className}`} style={{ transitionDelay: `${delay}ms` }}>{children}</div>;
}

const ICONS = { map: MapIcon, users: Users, skull: Skull, sparkles: Sparkles, sprout: Sprout, paw: PawPrint, egg: Egg, hourglass: Hourglass, gauge: Gauge };
export function StatCard({ icon, value, label }: { icon: keyof typeof ICONS; value: string; label: string }) {
  const I = ICONS[icon];
  return (
    <div className="stat-cell" data-testid={`stat-${label}`}>
      <I className="stat-ico h-7 w-7" strokeWidth={1.5} aria-hidden="true" />
      <strong className="stat-val">{value}</strong>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

export function DemoTag({ children = "Illustration" }: { children?: ReactNode }) {
  return <span className="demo-tag">{children}</span>;
}

export function SectionHead({ kicker, title, sub, action }: { kicker?: string; title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
      <div>
        {kicker && <p className="eyebrow mb-2">{kicker}</p>}
        <h2 className="text-2xl sm:text-4xl uppercase">{title}</h2>
        {sub && <p className="text-xs sm:text-sm tracking-[.2em] uppercase text-muted-foreground mt-2">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageBanner({ kicker, title, sub, image = IMG.landscape, children }: { kicker?: string; title: string; sub?: string; image?: string; children?: ReactNode }) {
  return (
    <header className="nx-banner rise">
      <img src={image} alt="" />
      <div className="p-6 sm:p-10 max-w-2xl">
        {kicker && <p className="eyebrow mb-3">{kicker}</p>}
        <h1 className="nx-h1 uppercase">{title}</h1>
        {sub && <p className="mt-3 text-sm sm:text-base text-[#c9d4e4] max-w-xl">{sub}</p>}
        {children}
      </div>
    </header>
  );
}

export function MapCard({ map }: { map: MapEntry }) {
  return (
    <Link href={`/maps/${map.slug}`} className={`media-card ${map.kind === "event" ? "is-event" : ""}`} data-testid={`card-map-${map.slug}`}>
      {map.image ? <img src={map.image} alt="" loading="lazy" /> : <span className="absolute inset-0 grid place-items-center text-muted-foreground text-xs">Aucun visuel</span>}
      <span className="mc-cta">Découvrir</span>
      <div className="mc-body">
        <h3 className="text-base sm:text-lg uppercase tracking-[.12em]">{map.name}</h3>
        <div className="flex items-center justify-between gap-2 mt-2 text-xs">
          <span className={map.kind === "event" ? "text-[#FFA078] font-bold" : "text-[#9AEAFF] font-bold"}>
            {map.kind === "event" ? "Map spéciale événements" : KIND_LABEL[map.kind]}
          </span>
          <span className="text-muted-foreground inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" aria-hidden="true" /> 25 places</span>
        </div>
      </div>
    </Link>
  );
}

export function ModCard({ mod }: { mod: ModEntry }) {
  return (
    <article className="glass overflow-hidden flex flex-col transition-all duration-300 hover:-translate-y-1 hover:border-[#65D8FF]/60 hover:shadow-[0_0_30px_rgba(101,216,255,.15)]" data-testid={`card-mod-${mod.name}`}>
      <div className="relative h-36 overflow-hidden">
        {mod.image ? <img src={mod.image} alt={`Visuel — ${mod.name}`} loading="lazy" className="w-full h-full object-contain bg-[#080C16] p-2" /> : <div className="h-full grid place-items-center text-xs text-muted-foreground">Aucun visuel renseigné</div>}
        {!mod.sourceUrl && <div className="absolute inset-0 bg-gradient-to-t from-[#0f192a] to-transparent" />}
        <span className="chip absolute left-3 top-3 !bg-[#080C16]/70 text-xs">{mod.badge}</span>
      </div>
      <div className="p-4 grid gap-2 flex-1 content-start">
        <h3 className="text-base tracking-[.08em]">{mod.name}</h3>
        <p className="text-xs text-[#9AEAFF] font-bold uppercase tracking-[.14em]">{mod.category}</p>
        <p className="text-sm text-muted-foreground">{mod.description}</p>
        {mod.sourceUrl
          ? <a href={mod.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline underline-offset-4 mt-2">Page officielle sur CurseForge</a>
          : null}
      </div>
    </article>
  );
}

export function EventCard({ ev, onOpen }: { ev: EventEntry; onOpen: (id: string) => void }) {
  return (
    <button type="button" onClick={() => onOpen(ev.id)} className="media-card text-left w-full !aspect-[16/10]" data-testid={`card-event-${ev.id}`}>
      <img src={ev.image} alt="" loading="lazy" />
      <span className="mc-cta">Détails</span>
      <div className="mc-body">
        <p className="eyebrow !text-[.6rem] mb-1">{ev.category}</p>
        <h3 className="text-base sm:text-lg uppercase tracking-[.1em]">{ev.title}</h3>
        <p className="text-xs text-muted-foreground mt-1">{ev.date} - {ev.map}</p>
      </div>
    </button>
  );
}

export function Tabs<T extends string = string>({ tabs, value, onChange, label }: { tabs: readonly { key: T; label: string }[]; value: string; onChange: (k: any) => void; label: string }) {
  return (
    <div className="tabs-row mb-6" role="tablist" aria-label={label}>
      {tabs.map((t) => (
        <button key={t.key} type="button" role="tab" id={`tab-${t.key}`} aria-selected={value === t.key} aria-controls={`panel-${t.key}`} className="pill whitespace-nowrap" data-testid={`tab-${t.key}`} onClick={() => onChange(t.key)}>{t.label}</button>
      ))}
    </div>
  );
}

export function FilterBar<T extends string>({ filters, value, onChange, query, onQuery, placeholder }: {
  filters: readonly { key: T; label: string }[]; value: string; onChange: (k: any) => void; query: string; onQuery: (q: string) => void; placeholder: string;
}) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-6">
      <div className="flex flex-wrap gap-2 flex-1" role="group" aria-label="Filtres">
        {filters.map((f) => <button key={f.key} type="button" className="pill" aria-pressed={value === f.key} onClick={() => onChange(f.key)}>{f.label}</button>)}
      </div>
      <div className="relative lg:w-72">
        <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <input type="search" className="field !pl-10" placeholder={placeholder} aria-label={placeholder} value={query} onChange={(e) => onQuery(e.target.value)} data-testid="input-filter-search" />
      </div>
    </div>
  );
}

export function Gallery({ images, labels }: { images: string[]; labels?: string }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {images.map((src, i) => (
        <div key={i} className="overflow-hidden rounded-xl border border-white/10 aspect-video group">
          <img src={src} alt={`${labels ?? "Illustration"} ${i + 1}`} loading="lazy" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
        </div>
      ))}
    </div>
  );
}

export function ComingSoon({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="glass p-8 sm:p-12 text-center grid justify-items-center gap-3" data-testid="status-coming-soon">
      <img src={IMG.otter} alt="" className="w-28 opacity-90" />
      <h2 className="text-2xl uppercase">{title}</h2>
      <p className="text-sm text-muted-foreground max-w-md">{children ?? "Cette section n'est pas encore disponible. Aucune donnée n'est affichée pour le moment."}</p>
      <Link href="/" className="btn btn-ghost btn-sm mt-2">Retourner au Nexus <ArrowUpRight className="h-4 w-4" aria-hidden="true" /></Link>
    </div>
  );
}
