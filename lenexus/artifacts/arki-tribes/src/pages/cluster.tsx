import { Link } from "wouter";
import {
  ArrowDown,
  ArrowRight,
  Compass,
  HeartHandshake,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { CLUSTER_SETTINGS, BRAND, IMG, KIND_LABEL, MAPS, type MapEntry } from "@/data/nexus";
import { PageBanner, Reveal, StatCard } from "@/components/nexus";
import { useSeo } from "@/lib/helpers";

const mapKind = (map: MapEntry) => {
  if (map.slug === "svartalfheim") return "Map mod premium";
  if (map.kind === "event") return "Rendez-vous communautaires";
  return KIND_LABEL[map.kind];
};

const reasons = [
  {
    icon: HeartHandshake,
    title: "Une équipe vraiment présente",
    copy: "Un staff actif et réactif, là pour répondre, orienter et aider — que vous découvriez ASA ou que vous connaissiez déjà chaque recoin de l’Arche.",
  },
  {
    icon: ShieldCheck,
    title: "Un cadre serein",
    copy: "Le PvE favorise la coopération. La protection anti-troll, le respect et l’attention portée aux joueurs aident chacun à construire et progresser tranquillement.",
  },
  {
    icon: UsersRound,
    title: "Une histoire qui continue",
    copy: "Arki Family prolonge une communauté ASE active depuis un an et demi. Le cluster ASA évolue depuis son lancement : on construit dans la durée, ensemble.",
  },
];

const features = [
  ["Événements", "Des rendez-vous pour jouer ensemble et faire vivre les maps."],
  ["Shop & enchères", "Un shop et des ventes aux enchères pour faire circuler les ressources."],
  ["Un bon départ", "Discord Pass et pack de départ pour prendre ses marques plus facilement."],
  ["Deux monnaies", "Une double monnaie qui accompagne les échanges et les activités."],
  ["Construire à sa façon", "Des mods de construction et de décoration pour donner forme à votre base."],
  ["Des créatures équilibrées", "Des ajouts mesurés, dont Shiny Dinos, sans perdre l’esprit de progression."],
  ["Moins de friction", "Poids illimité et auto-engrammes pour passer plus de temps à jouer."],
  ["Une progression fluide", "Des réglages pensés pour avancer sans transformer chaque étape en corvée."],
];

function MapLink({ map }: { map: MapEntry }) {
  return (
    <Link
      href={`/maps/${map.slug}`}
      className="cluster-map group flex min-w-0 items-center gap-3 rounded-xl border border-white/10 bg-[#0b1220]/70 p-2.5 transition duration-300 hover:-translate-y-0.5 hover:border-[#9C7CFF]/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#65D8FF]"
      data-testid={`link-cluster-map-${map.slug}`}
    >
      <img
        src={map.image}
        alt=""
        loading="lazy"
        className="h-14 w-[4.5rem] shrink-0 rounded-lg object-cover"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold tracking-wide text-foreground">{map.name}</span>
        <span className="mt-1 block truncate text-[.65rem] uppercase tracking-[.11em] text-muted-foreground">{mapKind(map)}</span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-[#9C7CFF] transition-transform group-hover:translate-x-1" aria-hidden="true" />
    </Link>
  );
}

export default function Cluster() {
  useSeo("Le Cluster", "Découvrez le cluster PvE francophone Arki Family : une communauté accueillante, 12 maps et une aventure qui évolue ensemble.");

  return (
    <main className="pb-8">
      <PageBanner
        kicker="Le Nexus · ARK: Survival Ascended"
        title="Le Cluster"
        sub="Une aventure PvE francophone, pensée pour durer. Posez vos valises, trouvez votre tribu et faites de l’Arche un endroit où l’on aime revenir."
        image={IMG.cluster}
      >
        <div className="mt-5 flex flex-wrap gap-2" aria-label="Esprit du cluster">
          {BRAND.tags.map((tag) => <span key={tag} className="chip">{tag}</span>)}
          <span className="chip">PC · Xbox · PS5</span>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/connexion" className="btn btn-primary btn-lg" data-testid="link-cluster-discord">
            Rejoindre la communauté <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link href="/maps" className="btn btn-ghost btn-lg" data-testid="link-cluster-maps">
            Explorer les maps <Compass className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </PageBanner>

      <Reveal>
        <section className="glass relative mb-8 overflow-hidden p-5 sm:p-8" aria-labelledby="welcome-heading">
          <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full border border-[#9C7CFF]/15 shadow-[0_0_0_24px_rgba(156,124,255,.025),0_0_0_52px_rgba(101,216,255,.02)]" />
          <div className="relative grid gap-7 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="max-w-3xl">
              <p className="eyebrow mb-3">Bienvenue chez vous</p>
              <h2 id="welcome-heading" className="max-w-2xl text-2xl uppercase leading-tight sm:text-4xl">
                On vient pour l’Arche.<br /><span className="text-[#9C7CFF]">On reste pour la tribu.</span>
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                Ici, l’entraide compte autant que l’exploration. Notre communauté francophone réunit des joueurs adultes autour d’un PvE respectueux, d’une équipe disponible et du plaisir de progresser à son rythme.
              </p>
            </div>
            <div className="flex items-center gap-3 border-t border-white/10 pt-4 lg:max-w-[15rem] lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[#65D8FF]/25 bg-[#65D8FF]/[.07] text-[#65D8FF]">
                <LockKeyhole className="h-5 w-5" aria-hidden="true" />
              </span>
              <p className="text-xs leading-5 text-muted-foreground">
                Cluster privé, protégé par mot de passe et hébergé indépendamment de Nitrado.
              </p>
            </div>
          </div>
          <div className="relative mt-7 grid gap-3 border-t border-white/10 pt-5 sm:grid-cols-3">
            {[
              ["ASE", "Une communauté déjà active depuis un an et demi."],
              ["ASA", "Un cluster qui évolue depuis son lancement."],
              ["La suite", "Les futures maps officielles rejoindront l’aventure."],
            ].map(([title, text], i) => (
              <div key={title} className={`sm:pl-4 ${i > 0 ? "sm:border-l sm:border-white/10" : ""}`}>
                <p className="eyebrow !text-[.62rem]">{title}</p>
                <p className="mt-1 text-sm text-foreground/85">{text}</p>
              </div>
            ))}
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section className="glass mb-8 p-5 sm:p-7" aria-labelledby="settings-heading">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow mb-2">Repères de jeu</p>
              <h2 id="settings-heading" className="text-xl uppercase tracking-[.16em] sm:text-2xl">Les réglages du cluster</h2>
            </div>
            <span className="chip">25 places par map</span>
          </div>
          <div className="rule-glow my-4" />
          <div className="grid grid-cols-2 gap-y-1 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9">
            {CLUSTER_SETTINGS.map((setting) => (
              <StatCard key={setting.key} icon={setting.icon} value={setting.value} label={setting.label} />
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-4">
            <p className="text-sm text-muted-foreground">Niveau de base des créatures sauvages : 300.</p>
            <p className="text-xs text-muted-foreground">Réglages communiqués par l’équipe ; ils ne reflètent pas l’état du serveur en temps réel.</p>
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section className="mb-10" aria-labelledby="reasons-heading">
          <div className="mb-5 max-w-2xl">
            <p className="eyebrow mb-2">Une place pour chacun</p>
            <h2 id="reasons-heading" className="text-2xl uppercase sm:text-3xl">Ce qui fait la différence</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Un serveur, c’est d’abord les personnes avec qui l’on partage l’aventure.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {reasons.map(({ icon: Icon, title, copy }, index) => (
              <article key={title} className="tribe-card panel p-5 sm:p-6">
                <span className="mb-5 grid h-10 w-10 place-items-center rounded-xl border border-[#65D8FF]/20 bg-[#65D8FF]/[.07] text-[#65D8FF]">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <p className="eyebrow !text-[.62rem]">0{index + 1} · La communauté</p>
                <h3 className="mt-2 text-lg uppercase tracking-[.08em]">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{copy}</p>
              </article>
            ))}
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section className="mb-10 overflow-hidden rounded-2xl border border-[#9C7CFF]/20 bg-[linear-gradient(125deg,rgba(101,216,255,.055),rgba(156,124,255,.10)_55%,rgba(15,25,42,.75))] p-5 sm:p-8" aria-labelledby="play-heading">
          <div className="grid gap-7 lg:grid-cols-[.8fr_1.2fr]">
            <div>
              <p className="eyebrow mb-2">Plus de possibilités, sans perdre l’équilibre</p>
              <h2 id="play-heading" className="max-w-md text-2xl uppercase leading-tight sm:text-3xl">Tout ce qu’il faut pour écrire votre aventure.</h2>
              <p className="mt-4 max-w-md text-sm leading-6 text-muted-foreground">
                Des outils utiles, des occasions de se retrouver et de la liberté pour bâtir. Le confort est là pour fluidifier la progression, pas pour effacer le plaisir de jouer.
              </p>
              <div className="mt-5 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[.12em] text-[#9AEAFF]">
                <Sparkles className="h-4 w-4" aria-hidden="true" /> Un cluster qui vit avec ses joueurs
              </div>
            </div>
            <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
              {features.map(([title, copy]) => (
                <div key={title} className="border-l border-[#9C7CFF]/50 pl-3">
                  <h3 className="text-sm font-bold tracking-wide">{title}</h3>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{copy}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section className="mb-10" aria-labelledby="maps-heading">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow mb-2">Douze horizons, un même foyer</p>
              <h2 id="maps-heading" className="text-2xl uppercase sm:text-3xl">Choisissez votre prochaine expédition</h2>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Chaque map a son caractère. Parcourez les fiches pour découvrir leurs biomes, leurs particularités et leurs règles.</p>
            </div>
            <Link href="/maps" className="btn btn-ghost btn-sm" data-testid="link-all-maps">
              Toutes les maps <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {MAPS.map((map) => <MapLink key={map.slug} map={map} />)}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">De nouvelles maps officielles seront ajoutées au cluster au fil de leur disponibilité.</p>
        </section>
      </Reveal>

      <Reveal>
        <section className="glass relative overflow-hidden px-5 py-7 text-center sm:px-8 sm:py-9" aria-labelledby="join-heading">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#65D8FF]/70 to-transparent" />
          <p className="eyebrow mb-2">La prochaine histoire peut être la vôtre</p>
          <h2 id="join-heading" className="text-2xl uppercase sm:text-3xl">Votre tribu vous attend.</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
            Venez comme vous êtes : pour bâtir, explorer, apprendre ou simplement partager un bon moment. Ici, on s’entraide, on se respecte et on vous accueille avec plaisir.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link href="/connexion" className="btn btn-primary btn-lg" data-testid="link-join-community">
              Faire le premier pas <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link href="/maps" className="btn btn-ghost btn-lg" data-testid="link-return-maps">
              <ArrowDown className="h-4 w-4" aria-hidden="true" /> Voir les 12 maps
            </Link>
          </div>
        </section>
      </Reveal>
    </main>
  );
}
