import type * as Z from "@workspace/api-zod";

type Section = ReturnType<typeof Z.GetShopResponse.parse>["sections"][number];
type Message = Section["messages"][number];
type Product = Section["products"][number];
const number = (s: string) => Number(s.replace(/[^\d]/g, ""));
const plain = (s: string) => s.normalize("NFKC").replace(/\*\*|\*|__/g, "").trim();
const pricePattern = /(\d[\d \u00a0\u202f]*)\*{0,2}\s*(?:<a?:SparklyCrystal:\d+>|💎)\s*\+\s*\*{0,2}\s*(\d[\d \u00a0\u202f]*)\*{0,2}\s*(?:<a?:fraises:\d+>|🍓)/i;

/** Keep commercial rules, not Discord's navigation/bot instructions. */
export function cleanShopContent(s: string) {
  return s.normalize("NFKC")
    .split("\n").filter(line => !/\/shop\b|Arki.? Family Shop\s*$|Arki.? Family ─ Prix Dinos|cliquez sur un nom|utilise.*commande/i.test(line))
    .map(line => line.replace(/^\s*>+\s*(?:-#\s*)?/, "").replace(/<a?:animearrow:\d+>/g, "").trimEnd())
    .join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function shopPrices(content: string) {
  const prices: Product["prices"] = [];
  let formula = "";
  for (const line of content.normalize("NFKC").split("\n")) {
    const imprint = line.match(/Imprint\s*(100|200|300)/i);
    if (imprint) formula = `Imprint ${imprint[1]}`;
    const match = line.match(pricePattern);
    if (!match) continue;
    const prefix = plain(line.slice(0, match.index));
    const variant = /(?:^|◦|[> ])(?:A|Tek)\s*:/i.exec(prefix)?.[0].replace(/[>◦:]/g, "").trim() || formula || "Standard";
    prices.push({ variant: /^tek$/i.test(variant) ? "Tek" : variant, diamonds: number(match[1]), strawberries: number(match[2]) });
  }
  return prices;
}
function product(message: Message, name: string, content: string, suffix: string): Product {
  const clean = cleanShopContent(content);
  const prices = shopPrices(content);
  const description = prices.length ? clean.split("\n").map(line => {
    if (!pricePattern.test(line)) return line;
    return plain(line.replace(pricePattern, "").replace(/^[>*◦\s]*(?:(?:\*\*)?(?:A|Tek)(?:\*\*)?\s*:\s*)?/, ""))
      .replace(/^[*─\s]+|[*\s]+$/g, "");
  }).filter(line => line.trim()).join("\n") : clean;
  const tags = [
    ...( /dino modd[ée]|mod payant/i.test(plain(clean + name)) ? ["Moddé"] : []),
    ...( /dino d[’']épaule/i.test(plain(clean)) ? ["Épaule"] : []),
    ...( /DLC payant/i.test(plain(clean)) ? ["DLC payant"] : []),
  ];
  return { id: `${message.id}-${suffix}`, name: plain(name).replace(/^[▫️•\s]+/u, "").trim(),
    description, media: message.media, sourceUrl: message.sourceUrl, tags,
    available: !/pas encore disponible|non disponible au shop|indisponible au shop/i.test(clean), prices };
}

function dinos(messages: Message[]) {
  const products: Product[] = [];
  let modNotice = "";
  const other: { message: Message; name: string; content: string; index: number }[] = [];
  for (const message of messages) {
    const text = message.content.normalize("NFKC");
    if (/Information importante.*Dinos moddés/i.test(text)) modNotice = text.match(/\*{3}([\s\S]*?)\*{3}/)?.[1] ?? "";
    const canonical = /【[A-Z]】/.test(text);
    const chunks = [...text.matchAll(/^###\s+(?:▫️\s*)?(.+)\n([\s\S]*?)(?=^###\s|$(?![\s\S]))/gm)];
    chunks.forEach((chunk, index) => {
      if (canonical) products.push(product({ ...message, media: [] }, chunk[1], chunk[2], `dino-${index}`));
      else other.push({ message, name: chunk[1], content: chunk[2], index });
    });
  }
  for (const { message, name, content, index } of other) {
    const normalName = plain(name).replace(/^[▫️•\s]+/u, "").trim();
    const variant = normalName.match(/^(.*?)\s*[─–]\s*(A|Tek)$/i);
    if (variant) {
      const base = products.find(p => p.name.toLocaleLowerCase("fr") === variant[1].trim().toLocaleLowerCase("fr"));
      const extraPrice = shopPrices(content)[0];
      if (base && extraPrice) {
        if (!base.prices.some(p => p.variant.toLowerCase() === variant[2].toLowerCase())) base.prices.push({ ...extraPrice, variant: variant[2] });
        continue;
      }
    }
    const next = product({ ...message, media: [] }, name, content, `dino-${index}`);
    if (!products.some(p => p.name === next.name && p.tags.join() === next.tags.join())) products.push(next);
  }
  if (modNotice) for (const p of products) {
    if (p.tags.includes("Moddé")) p.description += "\n\n" + cleanShopContent(modNotice);
  }
  return products.sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

const donationTitles: Record<string, string> = {
  "1418595130495205486": "Arki’ Boost",
  "1418595177190260906": "Pack Diamant",
  "1418595199256629389": "Pass de combat Discord",
  "1418595709946560585": "Arki’ Légend’",
  "1418595770482823208": "Arki’ Conquêt’",
  "1418595824371503147": "Arki’ Aventur’",
  "1418595855014826045": "Arki’Survi",
  "1418602478219563089": "Arki’ Suprêm’",
};

export function buildShopProducts(messages: Message[], section: string): Product[] {
  if (section === "dinos") return dinos(messages);
  if (section === "infos") {
    const result: Product[] = [];
    for (const message of messages) {
      if (/\/shop\b|Shop.*Index|Dino Shop.*Index/i.test(message.content)) continue;
      const paragraphs = message.content.split(/\n\s*\n/).filter(p =>
        /Chaque commande se paye|Les dinos sont livrés|Lors de vos commandes de dino|Le reste des points|Une fois votre commande|Les commandes sont traitées/i.test(p));
      paragraphs.forEach((text, i) => {
        const name = /commande se paye/i.test(text) ? "Les monnaies du shop" : /Une fois votre commande/i.test(text)
          ? "Validation de votre commande" : /commandes sont traitées/i.test(text) ? "Commander auprès du staff" : "Livraison et caractéristiques des dinos";
        const body = /commandes sont traitées/i.test(text) ? text.split("\n")[0] : text;
        const existing = result.find(p => p.name === name);
        if (existing) existing.description += "\n\n" + cleanShopContent(body);
        else result.push(product({ ...message, media: [] }, name, body, `info-${i}`));
      });
    }
    return result;
  }
  const result: Product[] = [];
  for (const message of messages) {
    const title = message.content.match(/^##\s+(.+)$/m)?.[1];
    if (section === "dons") {
      if (message.media.length || message.content.trim()) result.push(product(message, title ?? donationTitles[message.id] ?? "Informations sur les dons", message.content.replace(/^##\s+.+$/m, ""), "donation"));
      continue;
    }
    // Attachments used as Discord channel banners aren't catalogue offers.
    if (!title || /index|bienvenue/i.test(title)) continue;
    result.push(product(message, title, message.content.replace(/^##\s+.+$/m, ""), "offer"));
  }
  return result;
}
