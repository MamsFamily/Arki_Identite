import { Link } from "wouter";
import { IMG } from "@/data/nexus";
import { useSeo } from "@/lib/helpers";

export default function NotFound() {
  useSeo("Page introuvable", "Cette page n'existe pas dans le portail Arki Family.");
  return (
    <div className="glass max-w-xl mx-auto p-8 sm:p-12 text-center grid justify-items-center gap-3" data-testid="status-not-found">
      <img src={IMG.otter} alt="" className="w-36 drop-shadow-[0_0_18px_rgba(156,124,255,.4)]" />
      <p className="eyebrow">Erreur 404</p>
      <h1 className="text-2xl sm:text-3xl uppercase">La loutre a mangé cette page.</h1>
      <p className="text-sm text-muted-foreground">Cette adresse n'existe pas ou a été déplacée.</p>
      <Link href="/" className="btn btn-primary btn-lg mt-2">Retourner au Nexus</Link>
    </div>
  );
}
