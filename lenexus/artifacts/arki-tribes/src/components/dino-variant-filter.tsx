export const DINO_VARIANTS = [
  { value: "all", label: "Toutes les variantes" },
  { value: "standard", label: "Espèces de base" },
  { value: "tek", label: "Tek" },
  { value: "aberrant", label: "A — Aberrantes" },
  { value: "x", label: "X" },
  { value: "r", label: "R" },
  { value: "other", label: "Autres variantes" },
] as const;
export type DinoVariant = typeof DINO_VARIANTS[number]["value"];

export function dinoVariant(name: string): DinoVariant {
  if (/^Tek\s/i.test(name)) return "tek";
  if (/^(?:Aberrant\s|A-)/i.test(name)) return "aberrant";
  if (/^X-/i.test(name)) return "x";
  if (/^R-/i.test(name)) return "r";
  if (/^(?:(?:Fire|Lightning|Poison|Ice) Wyvern|(?:Blood|Ember|Tropical) Crystal Wyvern|Astral\s)/i.test(name)) return "other";
  return "standard";
}

export function DinoVariantFilter({ value, onChange, id }: { value: DinoVariant; onChange: (value: DinoVariant) => void; id: string }) {
  return <div><label className="lbl" htmlFor={id}>Variante</label>
    <select id={id} className="field" value={value} onChange={e => onChange(e.target.value as DinoVariant)} data-testid={id}>
      {DINO_VARIANTS.map(variant => <option key={variant.value} value={variant.value}>{variant.label}</option>)}
    </select>
  </div>;
}