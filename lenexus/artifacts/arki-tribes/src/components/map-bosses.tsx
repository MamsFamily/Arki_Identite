import { useState } from "react";
import { ASCENSION_LEVELS as BONUS, ASCENSION_RULE as RULE, ASTRAEOS_ASCENSION, BOSS_DIFFICULTIES, bossItemName, bossesForMap, type BossDifficulty, type BossItem, type MapBoss } from "@/data/map-bosses";
const ORDER: BossDifficulty[] = ["gamma", "beta", "alpha"];
const NO_TRIBUTE = "Aucun tribut nécessaire";

function Section({ title, children, id }: { title: string; children: React.ReactNode; id: string }) {
  return (
    <section className="grid gap-2" data-testid={`boss-section-${id}`}>
      <h4 className="eyebrow !font-sans !text-[.68rem]">{title}</h4>
      {children}
    </section>
  );
}

function Items({ items, id }: { items: BossItem[]; id: string }) {
  const shown = items.filter((i) => i.quantity > 0);
  if (!shown.length) return <p className="text-xs text-muted-foreground">Aucun élément requis.</p>;
  return (
    <ul className="grid sm:grid-cols-2 gap-2">
      {shown.map((i) => {
        const fr = bossItemName(i.name);
        return (
          <li key={i.name} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#080C16]/50 px-3 py-2 text-sm" data-testid={`boss-item-${id}-${i.name}`}>
            <span className="min-w-0">
              <span className="block font-bold">{fr}</span>
              {fr !== i.name && <span className="block text-[.7rem] text-muted-foreground">{i.name}</span>}
            </span>
            <strong className="text-[#9AEAFF] whitespace-nowrap">× {i.quantity}</strong>
          </li>
        );
      })}
    </ul>
  );
}

function DiffButtons({ scope, options, value, onChange }: { scope: string; options: BossDifficulty[]; value: BossDifficulty; onChange: (d: BossDifficulty) => void }) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Difficulté du boss">
      {options.map((d) => (
        <button key={d} type="button" className="pill" aria-pressed={value === d} onClick={() => onChange(d)} data-testid={`button-boss-${scope}-${d}`}>
          {BOSS_DIFFICULTIES[d]}
        </button>
      ))}
    </div>
  );
}

function AscensionTable({ active }: { active: BossDifficulty | null }) {
  return (
    <table className="w-full max-w-sm text-sm text-left" data-testid="table-ascension-bonus">
      <caption className="sr-only">Bonus de niveau maximum par difficulté</caption>
      <thead><tr className="text-xs text-muted-foreground"><th className="py-1 font-semibold">Difficulté</th><th className="py-1 font-semibold">Niveau maximum</th></tr></thead>
      <tbody>
        {ORDER.map((d) => (
          <tr key={d} className={`border-t border-white/10 ${active === d ? "text-[#9AEAFF] font-bold" : ""}`}>
            <td className="py-1">{BOSS_DIFFICULTIES[d]}</td><td className="py-1">+{BONUS[d]}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function BossCard({ boss, first }: { boss: MapBoss; first: boolean }) {
  const opts = boss.difficulties && boss.difficulties.length ? ORDER.filter((d) => boss.difficulties!.includes(d)) : [];
  const [diff, setDiff] = useState<BossDifficulty | null>(opts[0] ?? null);
  const req = (diff && boss.requirements[diff]) || boss.requirements.default || null;
  const grouped = !!boss.ascensionGroup;
  const unverified = boss.tributeStatus === "unverified";
  const none = boss.tributeStatus === "none";
  const hasNoTributeText = !!req?.specialRequirements.some((s) => s.toLowerCase().includes("aucun tribut"));
  return (
    <details className="glass group" open={first} data-testid={`card-boss-${boss.id}`}>
      <summary className="cursor-pointer list-none p-4 sm:p-5 flex flex-wrap items-center gap-x-3 gap-y-1">
        <h3 className="text-base sm:text-lg uppercase tracking-[.1em] mr-auto" data-testid={`text-boss-name-${boss.id}`}>{boss.name}</h3>
        <span className="chip">{boss.type}</span>
        {boss.ascension && <span className="chip !border-[#FFA078] !text-[#FFA078]">Ascension</span>}
        <span className="text-xs text-muted-foreground w-full">{opts.length ? opts.map((d) => BOSS_DIFFICULTIES[d]).join(" · ") : unverified ? "Difficultés non précisées" : "Sans difficulté Gamma / Bêta / Alpha"}</span>
      </summary>
      <div className="px-4 sm:px-5 pb-5 grid gap-5 border-t border-white/10 pt-4">
        {opts.length > 0 && <DiffButtons scope={boss.id} options={opts} value={diff!} onChange={setDiff} />}
        {boss.notes.length > 0 && (
          <ul className="grid gap-1 list-disc pl-5 text-sm text-[#c9d4e4]" data-testid={`boss-notes-${boss.id}`}>{boss.notes.map((n) => <li key={n}>{n}</li>)}</ul>
        )}
        {!req ? (
          <p className="text-sm text-muted-foreground" data-testid={`status-boss-unverified-${boss.id}`}>Prérequis non vérifiés pour ce boss. Aucune donnée n’est affichée.</p>
        ) : (
          <>
            {req.playerLevel != null && <p className="text-sm" data-testid={`text-boss-level-${boss.id}`}>
              <span className="text-muted-foreground">Niveau requis : </span>
              <strong>{req.playerLevel}</strong>
            </p>}
            <Section id="artifacts" title="Artéfacts">{unverified ? <p className="text-xs text-muted-foreground">Quantités en cours de vérification.</p> : <Items id={boss.id} items={req.artifacts} />}</Section>
            <Section id="tributes" title="Trophées et ressources">
              {unverified && req.tributes.every((t) => t.quantity <= 0) ? (
                <p className="text-sm text-[#FFA078]" data-testid={`status-tribute-unverified-${boss.id}`}>Coûts en tributs non vérifiés.</p>
              ) : (
                <>
                  {none && !hasNoTributeText && <p className="text-sm font-bold text-[#9AEAFF]" data-testid={`status-no-tribute-${boss.id}`}>{NO_TRIBUTE}</p>}
                  {req.tributes.some((t) => t.quantity > 0) && <Items id={boss.id} items={req.tributes} />}
                  {!req.tributes.some((t) => t.quantity > 0) && !none && <p className="text-xs text-muted-foreground">Aucune ressource supplémentaire requise.</p>}
                </>
              )}
            </Section>
            <Section id="boss-trophies" title="Trophées de boss">{unverified ? <p className="text-xs text-muted-foreground">Prérequis en cours de vérification.</p> : <Items id={boss.id} items={req.bossTrophies} />}</Section>
            <Section id="conditions" title="Conditions spéciales">
              {req.specialRequirements.length || (none && hasNoTributeText) ? (
                <ul className="grid gap-1 list-disc pl-5 text-sm text-[#c9d4e4]">{req.specialRequirements.map((s) => <li key={s}>{s}</li>)}</ul>
              ) : <p className="text-xs text-muted-foreground">Aucune condition spéciale.</p>}
            </Section>
          </>
        )}
        <Section id="ascension" title="Ascension">
          {!boss.ascension ? (
            <p className="text-sm text-muted-foreground">Aucune ascension.</p>
          ) : grouped ? (
            <p className="text-sm" data-testid={`text-ascension-shared-${boss.id}`}>
              Ascension partagée : Abyssalus ET Shallocis doivent être vaincus à la difficulté correspondante. <a className="text-primary underline" href={`#ascension-${boss.ascensionGroup}`}>Voir l’encadré commun</a> : un seul bonus pour l’Ascension Astraeos.
            </p>
          ) : (
            <div className="grid gap-3 rounded-2xl border border-[#FFA078]/40 bg-[#FFA078]/5 p-4">
              {diff ? (
                <p className="text-sm" data-testid={`text-ascension-bonus-${boss.id}`}>
                  Bonus choisi ({BOSS_DIFFICULTIES[diff]}) : <strong className="text-[#FFA078]">+{req?.ascensionLevels ?? "non précisé"}</strong> au niveau maximum du survivant
                </p>
              ) : <p className="text-sm">Bonus selon la difficulté vaincue.</p>}
              <AscensionTable active={diff} />
              <p className="text-xs text-muted-foreground">{RULE}</p>
            </div>
          )}
        </Section>
      </div>
    </details>
  );
}

function GroupBox({ group, bosses }: { group: string; bosses: MapBoss[] }) {
  const sets = bosses.map((b) => b.difficulties ?? []);
  const opts = ORDER.filter((d) => sets.every((s) => s.includes(d)));
  const options = opts.length ? opts : ORDER;
  const [diff, setDiff] = useState<BossDifficulty>(options[0]);
  return (
    <section id={`ascension-${group}`} className="glass p-4 sm:p-5 grid gap-3 !border-[#FFA078]/50 scroll-mt-24" aria-label="Ascension commune" data-testid={`box-ascension-group-${group}`}>
      <h3 className="text-base uppercase tracking-[.1em]">{ASTRAEOS_ASCENSION.title}</h3>
      <p className="text-sm text-[#c9d4e4]">{ASTRAEOS_ASCENSION.requirement}</p>
      <p className="text-sm text-[#c9d4e4]">{ASTRAEOS_ASCENSION.note}</p>
      <DiffButtons scope={`group-${group}`} options={options} value={diff} onChange={setDiff} />
      <p className="text-sm" data-testid={`text-ascension-group-bonus-${group}`}>
        {BOSS_DIFFICULTIES[diff]} : les deux vaincus → <strong className="text-[#FFA078]">+{BONUS[diff]}</strong> au niveau maximum du survivant (un seul bonus partagé)
      </p>
      <AscensionTable active={diff} />
      <p className="text-xs text-muted-foreground">{RULE}</p>
    </section>
  );
}

export function MapBosses({ slug, mapName }: { slug: string; mapName: string }) {
  const bosses = bossesForMap(slug);
  if (!bosses.length) {
    return <p className="glass p-6 text-muted-foreground" data-testid="status-no-bosses">Aucun boss renseigné pour {mapName}.</p>;
  }
  const groups = Array.from(new Set(bosses.map((b) => b.ascensionGroup).filter((g): g is string => !!g)));
  return (
    <div className="grid gap-4" data-testid="map-bosses">
      <p className="text-sm text-muted-foreground">{bosses.length} boss sur {mapName}. Choisissez une difficulté dans chaque fiche pour voir ses prérequis.</p>
      {slug === "ragnarok-event" && <p className="text-xs text-muted-foreground">Référentiel Ragnarok standard partagé, sans duplication. Les règles propres à chaque événement restent à confirmer auprès du staff.</p>}
      {groups.map((g) => <GroupBox key={g} group={g} bosses={bosses.filter((b) => b.ascensionGroup === g)} />)}
      {bosses.map((b, i) => <BossCard key={b.id} boss={b} first={i === 0} />)}
    </div>
  );
}
