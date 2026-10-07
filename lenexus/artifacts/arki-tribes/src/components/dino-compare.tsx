import { ArrowDown, ArrowUp, Equal, Minus, Plus } from "lucide-react";
import type { DinoStats } from "@workspace/api-client-react";
import { STAT_KEYS, STAT_LABELS, direction, show, type Direction } from "@/lib/dino";

const DIR: Record<Direction, { text: string; cls: string; icon: typeof ArrowUp }> = {
  higher: { text: "Plus haut", cls: "text-emerald-300", icon: ArrowUp },
  lower: { text: "Plus bas", cls: "text-red-300", icon: ArrowDown },
  equal: { text: "Égal", cls: "text-white", icon: Equal },
  new: { text: "Nouveau", cls: "text-emerald-300", icon: Plus },
  skip: { text: "Non fourni : ancienne valeur conservée", cls: "text-muted-foreground", icon: Minus },
};

export function DirBadge({ d }: { d: Direction }) {
  const { text, cls, icon: Icon } = DIR[d];
  return <span className={`inline-flex items-center gap-1 font-bold ${cls}`}><Icon className="h-3.5 w-3.5" aria-hidden />{d === "skip" ? "Conservé" : text}</span>;
}

export function CompareTable({ old, next, mode }: { old: DinoStats | null; next: DinoStats; mode?: "best" | "replace" }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" data-testid="table-compare">
        <thead><tr className="lbl !table-row text-left"><th className="py-1 pr-2">Stat</th><th className="pr-2">Actuel</th><th className="pr-2">Saisie</th><th className="pr-2">Sens</th>{mode && <th>Résultat</th>}</tr></thead>
        <tbody>
          {STAT_KEYS.map((k) => {
            const o = old ? old[k] : null;
            const n = next[k];
            const d = direction(o, n);
            const res = n === null ? o : mode === "replace" ? n : o === null || n > o ? n : o;
            return (
              <tr key={k} className="border-t border-border/60" data-testid={`row-compare-${k}`}>
                <td className="py-1.5 pr-2 font-semibold">{STAT_LABELS[k]}</td>
                <td className="pr-2 font-mono">{show(o)}</td>
                <td className={`pr-2 font-mono ${DIR[d].cls}`}>{show(n)}</td>
                <td className="pr-2"><DirBadge d={d} /></td>
                {mode && <td className="font-mono font-bold">{show(res)}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function StatGrid({ stats }: { stats: DinoStats }) {
  return (
    <dl className="grid grid-cols-4 sm:grid-cols-7 gap-2 text-center">
      {STAT_KEYS.map((k) => (
        <div key={k} className="rounded-xl border border-border bg-background/50 py-2 px-1">
          <dt className="lbl !mb-0 !text-[.6rem] truncate">{STAT_LABELS[k]}</dt>
          <dd className="font-mono text-lg font-bold" data-testid={`value-${k}`}>{show(stats[k])}</dd>
        </div>
      ))}
    </dl>
  );
}
