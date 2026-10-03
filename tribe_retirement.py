"""Retrait définitif de la gestion des tribus dans le bot, sans toucher aux données."""
import discord

# Origine publique vérifiée lors du passage à la gestion exclusivement web.
TRIBE_SITE_URL = "https://arki-identite.replit.app"
RETIRED_TRIBE_COMMANDS = frozenset({
    "créer_tribu", "fiche_tribu", "tribu_transférer", "tribu_supprimer",
    "corriger_champ", "mon_nom_ingame", "quitter_tribu",
    "changer_bannière_panneau", "ma_tribu", "ajouter_logo", "ajouter_photo",
    "parametres", "panneau", "modifier_tribu", "personnaliser_tribu",
    "supprimer_photo", "ajouter_membre_tribu", "supprimer_membre_tribu",
    "ajouter_avant_poste", "supprimer_avant_poste", "boss_validé_tribu",
    "boss_non_validé_tribu", "note_validé_tribu", "notes_non_validé_tribu",
    "ajout_map", "retirer_map", "ajout_boss", "retirer_boss", "ajout_note",
    "retirer_note", "guide",
})
RETIRED_COMPONENT_PREFIXES = (
    "panneau:", "menu_fiche:", "galerie_prev:", "galerie_next:",
)


def remove_tribe_commands(tree):
    """Enlever les commandes avant toute synchronisation, y compris au redémarrage."""
    for name in RETIRED_TRIBE_COMMANDS:
        tree.remove_command(name)


async def redirect_retired_component(inter):
    """Les anciens messages ne peuvent plus ouvrir un formulaire ou modifier SQLite."""
    custom_id = (inter.data or {}).get("custom_id", "")
    if not isinstance(custom_id, str) or not custom_id.startswith(RETIRED_COMPONENT_PREFIXES):
        return False
    if not inter.response.is_done():
        await inter.response.send_message(
            f"La gestion des fiches tribu se fait désormais uniquement sur le site : "
            f"{TRIBE_SITE_URL}/mon-espace",
            ephemeral=True,
        )
    return True


async def remove_guild_tribe_commands(tree, guilds):
    """Ne supprimer que les commandes des tribus, jamais les autres commandes locales."""
    removed = 0
    for guild in guilds:
        for command in await tree.fetch_commands(guild=discord.Object(id=guild.id)):
            if command.name in RETIRED_TRIBE_COMMANDS:
                await command.delete()
                removed += 1
    return removed