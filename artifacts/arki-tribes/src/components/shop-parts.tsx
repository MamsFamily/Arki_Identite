import { Fragment, useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import type { ShopProduct } from "@workspace/api-client-react";

export const safeUrl = (u: string) => (/^https?:\/\//i.test(u) || (u.startsWith("/") && !u.startsWith("//")) ? u : "");
export const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
export const when = (s: string | null) => { if (!s) return "jamais"; const d = new Date(s); return isNaN(d.getTime()) ? s : d.toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" }); };

const INLINE = /<(a?):([^:>\s]{1,64}):(\d{5,25})>|\*\*([^*]+)\*\*|__([^_]+)__|\*([^*\s][^*]*)\*|_([^_\s][^_]*)_|`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;

export function Inline({ text }: { text: string }) {
  const out: ReactNode[] = [];
  let last = 0, k = 0, m: RegExpExecArray | null;
  const re = new RegExp(INLINE.source, "g");
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const key = k++;
    if (m[3]) out.push(<img key={key} src={`/api/shop/emoji/${m[3]}/${m[1] ? "gif" : "png"}`} alt={m[2]} title={m[2]} loading="lazy" className="inline-block h-5 w-5 align-[-0.3em] object-contain" />);
    else if (m[4] || m[5]) out.push(<strong key={key}><Inline text={m[4] || m[5]} /></strong>);
    else if (m[6] || m[7]) out.push(<em key={key}><Inline text={m[6] || m[7]} /></em>);
    else if (m[8]) out.push(<code key={key} className="px-1 rounded bg-white/10 text-[.85em]">{m[8]}</code>);
    else if (m[9]) out.push(<a key={key} href={m[10]} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 text-[#9AEAFF]">{m[9]}</a>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out.map((n, i) => <Fragment key={i}>{n}</Fragment>)}</>;
}

export function ShopMd({ text, className = "" }: { text: string; className?: string }) {
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  const flush = () => { if (list.length) { const l = list; list = []; blocks.push(<ul key={blocks.length} className="list-disc pl-5 grid gap-1">{l.map((x, i) => <li key={i}><Inline text={x} /></li>)}</ul>); } };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    const b = /^[-*•]\s+(.*)/.exec(line);
    const h = /^(#{1,3})\s+(.*)/.exec(line);
    if (b) { list.push(b[1]); continue; }
    flush();
    if (!line) continue;
    if (h) blocks.push(<h4 key={blocks.length} className="font-bold text-[#9AEAFF] tracking-wide text-[.95rem] mt-1"><Inline text={h[2]} /></h4>);
    else blocks.push(<p key={blocks.length}><Inline text={line} /></p>);
  }
  flush();
  return <div className={`grid gap-2 text-sm leading-relaxed break-words min-w-0 ${className}`}>{blocks}</div>;
}

export function Lightbox({ src, title, onClose }: { src: string; title: string; onClose: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") { e.preventDefault(); ref.current?.focus(); }
    };
    window.addEventListener("keydown", key);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", key); document.body.style.overflow = ""; prev?.focus(); };
  }, [onClose]);
  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-[100] bg-[#05080f]/90 backdrop-blur-sm grid place-items-center p-3 rise" onClick={onClose} data-testid="dialog-shop-image">
      <button ref={ref} type="button" onClick={onClose} aria-label="Fermer" className="absolute top-3 right-3 btn btn-ghost btn-sm"><X className="h-4 w-4" aria-hidden="true" /> Fermer</button>
      <figure className="grid gap-2 max-w-full" onClick={(e) => e.stopPropagation()}>
        <img src={src} alt={title} className="max-w-full max-h-[82dvh] object-contain rounded-xl mx-auto" />
        <figcaption className="text-center text-sm text-muted-foreground">{title}</figcaption>
      </figure>
    </div>
  );
}

export function Prices({ p, compact = false }: { p: ShopProduct; compact?: boolean }) {
  if (!p.prices.length) return null;
  return (
     <ul className={`flex flex-wrap gap-2 ${compact ? "sm:max-w-72 sm:justify-end" : "mt-1"}`} aria-label="Prix">
      {p.prices.map((x, i) => (
        <li key={i} className={`rounded-xl border px-2.5 py-1 text-xs leading-tight ${p.available ? "border-[#65D8FF]/30 bg-[#65D8FF]/[.06]" : "border-white/10 opacity-70"}`}>
          <span className="block font-mono uppercase tracking-wider text-[.62rem] text-[#C9B8FF]">{x.variant}</span>
           <span className="font-bold tabular-nums">{x.diamonds.toLocaleString("fr-FR")}</span> <Inline text="<a:SparklyCrystal:1366174439003263087>" /> <span className={compact ? "sr-only" : "text-muted-foreground"}>diamants</span>
           {x.strawberries > 0 && <> <span className="text-muted-foreground">+</span> <span className="font-bold tabular-nums">{x.strawberries.toLocaleString("fr-FR")}</span> <Inline text="<:fraises:1328148609585123379>" /> <span className={compact ? "sr-only" : "text-muted-foreground"}>fraises</span></>}
        </li>
      ))}
    </ul>
  );
}

export function Tags({ tags, available }: { tags: string[]; available: boolean }) {
  return (
    <>
      {tags.map((t) => <span key={t} className="chip !text-[.65rem]">{t}</span>)}
      {!available && <span className="demo-tag" data-testid="badge-unavailable">Indisponible</span>}
    </>
  );
}
