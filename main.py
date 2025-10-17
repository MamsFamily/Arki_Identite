#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Bot Discord — Fiches Tribu (FR) avec UI (boutons + modals)
- Slash commands FR (comme tribu_bot_fr.py)
- + Vue interactive : boutons "Créer", "Modifier", "Liste", "Voir"
- Modals pour saisir les infos sans taper les commandes
"""
import os
import sqlite3
import datetime as dt
from typing import Optional

import discord
from discord import app_commands
from discord.ext import commands

DB_PATH = os.getenv("TRIBU_BOT_DB", "tribus.db")

# ---------- Base de données ----------
def db_connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def db_init():
    with db_connect() as conn:
        c = conn.cursor()
        c.execute("""
        CREATE TABLE IF NOT EXISTS tribus (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guild_id INTEGER NOT NULL,
            nom TEXT NOT NULL,
            description TEXT DEFAULT '',
            couleur INTEGER DEFAULT 0x2F3136,
            logo_url TEXT DEFAULT '',
            base TEXT DEFAULT '',
            map_base TEXT DEFAULT '',
            coords_base TEXT DEFAULT '',
            tags TEXT DEFAULT '',
            proprietaire_id INTEGER NOT NULL,
            created_at TEXT NOT NULL
        )
        """)
        c.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_unique ON tribus(guild_id, nom)")
        c.execute("""
        CREATE TABLE IF NOT EXISTS membres (
            tribu_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            role TEXT DEFAULT '',
            manager INTEGER DEFAULT 0,
            PRIMARY KEY (tribu_id, user_id),
            FOREIGN KEY (tribu_id) REFERENCES tribus(id) ON DELETE CASCADE
        )
        """)
        c.execute("""
        CREATE TABLE IF NOT EXISTS avant_postes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tribu_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            nom TEXT NOT NULL,
            map TEXT DEFAULT '',
            coords TEXT DEFAULT '',
            created_at TEXT NOT NULL,
            FOREIGN KEY (tribu_id) REFERENCES tribus(id) ON DELETE CASCADE
        )
        """)
        c.execute("""
        CREATE TABLE IF NOT EXISTS maps (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guild_id INTEGER NOT NULL,
            nom TEXT NOT NULL,
            created_at TEXT NOT NULL,
            UNIQUE(guild_id, nom)
        )
        """)
        try:
            c.execute("ALTER TABLE tribus ADD COLUMN map_base TEXT DEFAULT ''")
        except sqlite3.OperationalError:
            pass
        try:
            c.execute("ALTER TABLE tribus ADD COLUMN coords_base TEXT DEFAULT ''")
        except sqlite3.OperationalError:
            pass
        try:
            c.execute("ALTER TABLE tribus ADD COLUMN message_id INTEGER DEFAULT 0")
        except sqlite3.OperationalError:
            pass
        try:
            c.execute("ALTER TABLE tribus ADD COLUMN channel_id INTEGER DEFAULT 0")
        except sqlite3.OperationalError:
            pass
        try:
            c.execute("ALTER TABLE tribus ADD COLUMN devise TEXT DEFAULT ''")
        except sqlite3.OperationalError:
            pass
        try:
            c.execute("ALTER TABLE tribus ADD COLUMN ouvert_recrutement INTEGER DEFAULT 0")
        except sqlite3.OperationalError:
            pass
        try:
            c.execute("ALTER TABLE tribus ADD COLUMN photo_base TEXT DEFAULT ''")
        except sqlite3.OperationalError:
            pass
        try:
            c.execute("ALTER TABLE tribus ADD COLUMN objectif TEXT DEFAULT ''")
        except sqlite3.OperationalError:
            pass
        try:
            c.execute("ALTER TABLE tribus ADD COLUMN progression_boss TEXT DEFAULT ''")
        except sqlite3.OperationalError:
            pass
        try:
            c.execute("ALTER TABLE tribus ADD COLUMN progression_notes TEXT DEFAULT ''")
        except sqlite3.OperationalError:
            pass
        try:
            c.execute("ALTER TABLE membres ADD COLUMN nom_in_game TEXT DEFAULT ''")
        except sqlite3.OperationalError:
            pass
        
        # Tables pour boss et notes
        c.execute("""
        CREATE TABLE IF NOT EXISTS boss (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guild_id INTEGER NOT NULL,
            nom TEXT NOT NULL,
            created_at TEXT NOT NULL,
            UNIQUE(guild_id, nom)
        )
        """)
        
        c.execute("""
        CREATE TABLE IF NOT EXISTS notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guild_id INTEGER NOT NULL,
            nom TEXT NOT NULL,
            created_at TEXT NOT NULL,
            UNIQUE(guild_id, nom)
        )
        """)
        
        # Table d'historique
        c.execute("""
        CREATE TABLE IF NOT EXISTS historique (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tribu_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            action TEXT NOT NULL,
            details TEXT DEFAULT '',
            created_at TEXT NOT NULL,
            FOREIGN KEY (tribu_id) REFERENCES tribus(id) ON DELETE CASCADE
        )
        """)
        
        # Boss par défaut
        default_boss = ["Broodmother", "Megapithecus", "Dragon", "Cave Tek", "Manticore", "Rockwell", "King Titan", "Boss Astraeos"]
        for boss_name in default_boss:
            c.execute("INSERT OR IGNORE INTO boss (guild_id, nom, created_at) VALUES (?, ?, ?)",
                     (0, boss_name, dt.datetime.utcnow().isoformat()))
        
        # Notes par défaut
        default_notes = ["Notes Island", "Notes Scorched", "Notes Abbération", "Extinction", "Bob"]
        for note_name in default_notes:
            c.execute("INSERT OR IGNORE INTO notes (guild_id, nom, created_at) VALUES (?, ?, ?)",
                     (0, note_name, dt.datetime.utcnow().isoformat()))
        
        # Ajouter les maps par défaut si elles n'existent pas
        default_maps = [
            "The Island", "Scorched Earth", "Svartalfheim", "Abberation",
            "The Center", "Extinction", "Astraeos", "Ragnarok", "Valguero"
        ]
        for map_name in default_maps:
            c.execute("INSERT OR IGNORE INTO maps (guild_id, nom, created_at) VALUES (?, ?, ?)",
                     (0, map_name, dt.datetime.utcnow().isoformat()))
        
        conn.commit()

def get_maps_choices(guild_id: int):
    """Récupère les choix de maps pour un serveur"""
    with db_connect() as conn:
        c = conn.cursor()
        # Maps globales (guild_id=0) + maps du serveur
        c.execute("SELECT DISTINCT nom FROM maps WHERE guild_id IN (0, ?) ORDER BY nom", (guild_id,))
        maps = [row["nom"] for row in c.fetchall()]
        return [app_commands.Choice(name=m, value=m) for m in maps[:25]]  # Discord limite à 25 choix

def tribu_par_nom(guild_id: int, nom: str):
    with db_connect() as conn:
        c = conn.cursor()
        c.execute("SELECT * FROM tribus WHERE guild_id=? AND LOWER(nom)=LOWER(?)", (guild_id, nom))
        return c.fetchone()

ROLE_MODO_ID = 1157803768893689877

def est_admin(inter: discord.Interaction) -> bool:
    perms = inter.user.guild_permissions
    return perms.manage_guild or perms.administrator

def est_modo(inter: discord.Interaction) -> bool:
    """Vérifie si l'utilisateur a le rôle modo"""
    return any(role.id == ROLE_MODO_ID for role in inter.user.roles)

def est_admin_ou_modo(inter: discord.Interaction) -> bool:
    """Vérifie si l'utilisateur est admin ou modo"""
    return est_admin(inter) or est_modo(inter)

def est_manager(tribu_id: int, user_id: int) -> bool:
    with db_connect() as conn:
        c = conn.cursor()
        c.execute("SELECT manager FROM membres WHERE tribu_id=? AND user_id=?", (tribu_id, user_id))
        row = c.fetchone()
        return bool(row and row["manager"])

def get_boss_choices(guild_id: int):
    """Récupère les choix de boss pour un serveur"""
    with db_connect() as conn:
        c = conn.cursor()
        c.execute("SELECT DISTINCT nom FROM boss WHERE guild_id IN (0, ?) ORDER BY nom", (guild_id,))
        boss = [row["nom"] for row in c.fetchall()]
        return [app_commands.Choice(name=b, value=b) for b in boss[:25]]

def get_notes_choices(guild_id: int):
    """Récupère les choix de notes pour un serveur"""
    with db_connect() as conn:
        c = conn.cursor()
        c.execute("SELECT DISTINCT nom FROM notes WHERE guild_id IN (0, ?) ORDER BY nom", (guild_id,))
        notes = [row["nom"] for row in c.fetchall()]
        return [app_commands.Choice(name=n, value=n) for n in notes[:25]]

def ajouter_historique(tribu_id: int, user_id: int, action: str, details: str = ""):
    """Ajoute une entrée dans l'historique de la tribu"""
    with db_connect() as conn:
        c = conn.cursor()
        c.execute("""
            INSERT INTO historique (tribu_id, user_id, action, details, created_at)
            VALUES (?, ?, ?, ?, ?)
        """, (tribu_id, user_id, action, details, dt.datetime.utcnow().isoformat()))
        conn.commit()

# ---------- Bot ----------
intents = discord.Intents.default()
intents.guilds = True
intents.members = True

bot = commands.Bot(command_prefix="!", intents=intents)
tree = bot.tree

# ---------- Helpers UI ----------
def embed_tribu(tribu, membres=None, avant_postes=None) -> discord.Embed:
    color = tribu["couleur"] if tribu["couleur"] else 0x2F3136
    
    # Titre et description
    titre = f"🏕️ Tribu — {tribu['nom']}"
    desc_parts = []
    if tribu["description"]:
        desc_parts.append(tribu["description"])
    if "devise" in tribu.keys() and tribu["devise"]:
        desc_parts.append(f"*« {tribu['devise']} »*")
    description = "\n".join(desc_parts) if desc_parts else "—"
    
    e = discord.Embed(
        title=titre,
        description=description,
        color=color,
        timestamp=dt.datetime.utcnow()
    )
    
    # Logo
    if tribu["logo_url"]:
        e.set_thumbnail(url=tribu["logo_url"])
    
    # Photo de la base
    if "photo_base" in tribu.keys() and tribu["photo_base"]:
        e.set_image(url=tribu["photo_base"])
    
    # Membres avec référent (DÉPLACÉ ICI - après description/devise)
    if membres is not None:
        lines = []
        referent_id = tribu['proprietaire_id']
        for m in membres:
            if m['user_id'] == referent_id:
                # Référent tribu
                line = f"👑 <@{m['user_id']}>"
                if "nom_in_game" in m.keys() and m["nom_in_game"]:
                    line += f" ({m['nom_in_game']})"
                line += " — Référent Tribu"
                lines.insert(0, line)  # En premier
            else:
                line = f"• <@{m['user_id']}>"
                if "nom_in_game" in m.keys() and m["nom_in_game"]:
                    line += f" ({m['nom_in_game']})"
                if m["role"]:
                    line += f" — {m['role']}"
                lines.append(line)
        if lines:
            e.add_field(name=f"👥 MEMBRES ({len(lines)})", value="\n".join(lines)[:1024], inline=False)
    
    # Base principale
    map_base = tribu["map_base"] if "map_base" in tribu.keys() and tribu["map_base"] else ""
    coords_base = tribu["coords_base"] if "coords_base" in tribu.keys() and tribu["coords_base"] else ""
    base_info = []
    if map_base:
        base_info.append(f"**{map_base}**")
    if coords_base:
        base_info.append(f"📍 **{coords_base}**")
    base_value = "\n".join(base_info) if base_info else "—"
    e.add_field(name="🏠 BASE PRINCIPALE", value=base_value, inline=False)
    
    # Objectif
    if "objectif" in tribu.keys() and tribu["objectif"]:
        e.add_field(name="🎯 Objectif", value=tribu["objectif"], inline=False)
    
    # Ouvert au recrutement
    if "ouvert_recrutement" in tribu.keys():
        recrutement = "✅ Oui" if tribu["ouvert_recrutement"] else "❌ Non"
        e.add_field(name="Recrutement", value=recrutement, inline=True)
    
    # Avant-postes (liste simple avec tiret)
    if avant_postes is not None and len(avant_postes) > 0:
        ap_lines = []
        for ap in avant_postes:
            ap_info = []
            if ap['map']:
                ap_info.append(f"{ap['map']}")
            if ap['coords']:
                ap_info.append(f"📍 {ap['coords']}")
            if ap_info:
                ap_lines.append(f"• {' | '.join(ap_info)}")
        if ap_lines:
            e.add_field(name=f"⛺ AVANT-POSTES ({len(ap_lines)})", value="\n".join(ap_lines)[:1024], inline=False)
    
    # Progression Boss
    if "progression_boss" in tribu.keys() and tribu["progression_boss"]:
        boss_list = tribu["progression_boss"].split(",")
        boss_display = ", ".join([f"✅ {b.strip()}" for b in boss_list if b.strip()])
        if boss_display:
            e.add_field(name="🐉 Progression Boss", value=boss_display[:1024], inline=False)
    
    # Progression Notes
    if "progression_notes" in tribu.keys() and tribu["progression_notes"]:
        notes_list = tribu["progression_notes"].split(",")
        notes_display = ", ".join([f"✅ {n.strip()}" for n in notes_list if n.strip()])
        if notes_display:
            e.add_field(name="📝 Progression Notes", value=notes_display[:1024], inline=False)

    e.set_footer(text="💡 Utilise les boutons ci-dessous pour gérer la tribu")
    return e

# ---------- Boutons de la fiche tribu ----------
class BoutonsFicheTribu(discord.ui.View):
    def __init__(self, tribu_id: int, timeout: Optional[float] = None):
        super().__init__(timeout=timeout)
        self.tribu_id = tribu_id
    
    @discord.ui.button(label="Quitter tribu", style=discord.ButtonStyle.danger, emoji="🚪")
    async def btn_quitter(self, inter: discord.Interaction, button: discord.ui.Button):
        # Vérifier que l'utilisateur est membre
        with db_connect() as conn:
            c = conn.cursor()
            c.execute("SELECT * FROM tribus WHERE id=?", (self.tribu_id,))
            tribu = c.fetchone()
            if not tribu:
                await inter.response.send_message("❌ Tribu introuvable.", ephemeral=True)
                return
            
            # Ne peut pas quitter si référent
            if inter.user.id == tribu["proprietaire_id"]:
                await inter.response.send_message("❌ Le référent tribu ne peut pas quitter. Utilise `/tribu_transférer` d'abord.", ephemeral=True)
                return
            
            c.execute("SELECT * FROM membres WHERE tribu_id=? AND user_id=?", (self.tribu_id, inter.user.id))
            if not c.fetchone():
                await inter.response.send_message("❌ Tu n'es pas membre de cette tribu.", ephemeral=True)
                return
            
            # Retirer le membre
            c.execute("DELETE FROM membres WHERE tribu_id=? AND user_id=?", (self.tribu_id, inter.user.id))
            conn.commit()
        
        ajouter_historique(self.tribu_id, inter.user.id, "Quitter tribu", f"<@{inter.user.id}> a quitté la tribu")
        await inter.response.send_message(f"✅ Tu as quitté la tribu **{tribu['nom']}**.", ephemeral=True)
    
    @discord.ui.button(label="Historique", style=discord.ButtonStyle.secondary, emoji="📜")
    async def btn_historique(self, inter: discord.Interaction, button: discord.ui.Button):
        # Vérifier les permissions (managers, admin ou modo)
        with db_connect() as conn:
            c = conn.cursor()
            c.execute("SELECT * FROM tribus WHERE id=?", (self.tribu_id,))
            tribu = c.fetchone()
            if not tribu:
                await inter.response.send_message("❌ Tribu introuvable.", ephemeral=True)
                return
            
            # Vérifier les droits
            has_perm = (est_admin_ou_modo(inter) or 
                       inter.user.id == tribu["proprietaire_id"] or 
                       est_manager(self.tribu_id, inter.user.id))
            
            if not has_perm:
                await inter.response.send_message("❌ Seuls les managers, admins et modos peuvent voir l'historique.", ephemeral=True)
                return
            
            # Récupérer l'historique
            c.execute("""
                SELECT user_id, action, details, created_at 
                FROM historique 
                WHERE tribu_id=? 
                ORDER BY created_at DESC 
                LIMIT 20
            """, (self.tribu_id,))
            historique = c.fetchall()
        
        if not historique:
            await inter.response.send_message("📜 Aucun historique pour cette tribu.", ephemeral=True)
            return
        
        # Créer l'embed d'historique
        e = discord.Embed(
            title=f"📜 Historique — {tribu['nom']}",
            color=0x5865F2,
            timestamp=dt.datetime.utcnow()
        )
        
        lines = []
        for h in historique:
            date = dt.datetime.fromisoformat(h["created_at"]).strftime("%d/%m/%y %H:%M")
            lines.append(f"**{date}** — <@{h['user_id']}>\n  ↳ {h['action']}")
            if h["details"]:
                lines.append(f"  _{h['details']}_")
        
        e.description = "\n".join(lines[:20])  # Limiter à 20 entrées
        e.set_footer(text="Historique des 20 dernières actions")
        
        await inter.response.send_message(embed=e, ephemeral=True)
    
    @discord.ui.button(label="Staff", style=discord.ButtonStyle.primary, emoji="⚙️")
    async def btn_staff(self, inter: discord.Interaction, button: discord.ui.Button):
        # Vérifie si admin ou modo
        if not est_admin_ou_modo(inter):
            await inter.response.send_message("❌ Cette fonction est réservée aux admins et modos.", ephemeral=True)
            return
        
        await inter.response.send_message("⚙️ **Mode Staff activé** : Tu as maintenant tous les droits sur cette tribu pour la modifier.", ephemeral=True)

async def verifier_droits(inter: discord.Interaction, tribu) -> bool:
    if est_admin(inter) or inter.user.id == tribu["proprietaire_id"] or est_manager(tribu["id"], inter.user.id):
        return True
    await inter.response.send_message("❌ Tu n'as pas la permission de modifier cette tribu.", ephemeral=True)
    return False

def parser_membre_info(texte: str, guild: discord.Guild):
    """Parse le format: @pseudo NomInGame autorisé:oui/non"""
    if not texte or not texte.strip():
        return None
    
    parts = texte.strip().split()
    if len(parts) < 3:
        return None
    
    # Extraire mention (@pseudo ou ID)
    mention = parts[0]
    user_id = None
    
    # Essayer d'extraire l'ID de la mention
    if mention.startswith('<@') and mention.endswith('>'):
        user_id = int(mention.replace('<@', '').replace('!', '').replace('>', ''))
    elif mention.isdigit():
        user_id = int(mention)
    
    if not user_id:
        return None
    
    # Vérifier que l'utilisateur existe
    member = guild.get_member(user_id)
    if not member:
        return None
    
    # Trouver l'index du "autorisé:"
    autorise_idx = -1
    for i, part in enumerate(parts):
        if part.lower().startswith("autorisé:"):
            autorise_idx = i
            break
    
    if autorise_idx == -1:
        return None
    
    # Nom in-game = tout entre la mention et "autorisé:"
    nom_ingame = " ".join(parts[1:autorise_idx]).strip()
    
    # Autorisation
    autorise_val = parts[autorise_idx].split(':')[1].lower() if ':' in parts[autorise_idx] else 'non'
    manager_flag = 1 if autorise_val == 'oui' else 0
    
    return {
        'user_id': user_id,
        'nom_ingame': nom_ingame,
        'manager': manager_flag
    }

async def afficher_fiche_mise_a_jour(inter: discord.Interaction, tribu_id: int, message_prefix: str = "✅ **Fiche mise à jour !**", ephemeral: bool = False):
    """Affiche la fiche tribu mise à jour et supprime TOUTES les anciennes fiches existantes"""
    with db_connect() as conn:
        c = conn.cursor()
        c.execute("SELECT * FROM tribus WHERE id=?", (tribu_id,))
        tribu = c.fetchone()
        if not tribu:
            return
        
        c.execute("SELECT * FROM membres WHERE tribu_id=? ORDER BY manager DESC, user_id ASC", (tribu_id,))
        membres = c.fetchall()
        c.execute("SELECT * FROM avant_postes WHERE tribu_id=? ORDER BY created_at DESC", (tribu_id,))
        avant_postes = c.fetchall()
        
        # Supprimer l'ancienne fiche référencée dans la DB
        old_message_id = tribu["message_id"] if "message_id" in tribu.keys() else 0
        old_channel_id = tribu["channel_id"] if "channel_id" in tribu.keys() else 0
        
        if old_message_id and old_channel_id:
            try:
                channel = inter.guild.get_channel(old_channel_id)
                if channel:
                    old_message = await channel.fetch_message(old_message_id)
                    if old_message:
                        await old_message.delete()
            except (discord.NotFound, discord.Forbidden, discord.HTTPException):
                pass  # Message déjà supprimé ou pas accessible
        
        # Chercher et supprimer TOUTES les autres anciennes fiches de cette tribu dans le canal actuel
        # (au cas où il y aurait des fiches orphelines)
        try:
            channel = inter.channel
            if channel:
                # Chercher les 50 derniers messages du bot contenant une fiche de cette tribu
                async for message in channel.history(limit=50):
                    if message.author.id == inter.client.user.id and message.embeds:
                        # Vérifier si c'est une fiche de cette tribu
                        for embed in message.embeds:
                            if embed.title and f"Tribu — {tribu['nom']}" in embed.title:
                                # Ne pas supprimer si c'est le message qu'on vient de supprimer
                                if message.id != old_message_id:
                                    try:
                                        await message.delete()
                                    except:
                                        pass
                                break
        except:
            pass  # Erreur lors de la recherche, on continue quand même
        
        # Envoyer le nouveau message avec la fiche et les boutons
        embed = embed_tribu(tribu, membres, avant_postes)
        view = BoutonsFicheTribu(tribu_id, timeout=None)
        
        # Répondre à l'interaction
        await inter.response.send_message(message_prefix, embed=embed, view=view, ephemeral=ephemeral)
        msg = await inter.original_response()
        
        # Sauvegarder le nouveau message_id et channel_id (seulement si pas ephemeral)
        if not ephemeral:
            c.execute("UPDATE tribus SET message_id=?, channel_id=? WHERE id=?", 
                     (msg.id, msg.channel.id, tribu_id))
            conn.commit()

# ---------- Commandes slash standalone ----------

@tree.command(name="créer_tribu", description="Créer une nouvelle tribu")
@app_commands.describe(
    nom="Nom de la tribu", 
    map_base="Map de la base principale",
    coords_base="Coordonnées de la base ex: 45.5, 32.6"
)
async def tribu_creer(
    inter: discord.Interaction, 
    nom: str, 
    map_base: str,
    coords_base: str
):
    db_init()
    if tribu_par_nom(inter.guild_id, nom):
        await inter.response.send_message("❌ Ce nom de tribu est déjà pris sur ce serveur.", ephemeral=True)
        return
    with db_connect() as conn:
        c = conn.cursor()
        c.execute("""
            INSERT INTO tribus (guild_id, nom, description, base, map_base, coords_base, proprietaire_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            inter.guild_id, 
            nom.strip(), 
            "",  # description vide par défaut
            "Base Principale",  # nom de base par défaut
            map_base.strip(),
            coords_base.strip(),
            inter.user.id, 
            dt.datetime.utcnow().isoformat()
        ))
        tribu_id = c.lastrowid
        c.execute("INSERT OR REPLACE INTO membres (tribu_id, user_id, role, manager) VALUES (?, ?, ?, 1)",
                  (tribu_id, inter.user.id, "Chef",))
        conn.commit()
        c.execute("SELECT * FROM tribus WHERE id=?", (tribu_id,))
        row = c.fetchone()
    
    embed = embed_tribu(row)
    embed.set_footer(text="ℹ️ Ajoutez des membres avec /ajouter_membre_tribu et des avant-postes avec /ajouter_avant_poste")
    await inter.response.send_message("✅ **Tribu créée !**", embed=embed)

@tribu_creer.autocomplete('map_base')
async def map_autocomplete(inter: discord.Interaction, current: str):
    db_init()
    return get_maps_choices(inter.guild_id)

@tree.command(name="tribu_voir", description="[ADMIN/MODO] Afficher la fiche d'une tribu")
@app_commands.describe(nom="Nom de la tribu")
async def tribu_voir(inter: discord.Interaction, nom: str):
    if not est_admin_ou_modo(inter):
        await inter.response.send_message("❌ Cette commande est réservée aux admins et modos.", ephemeral=True)
        return
    db_init()
    row = tribu_par_nom(inter.guild_id, nom)
    if not row:
        await inter.response.send_message("❌ Aucune tribu trouvée avec ce nom.", ephemeral=True)
        return
    with db_connect() as conn:
        c = conn.cursor()
        c.execute("SELECT * FROM membres WHERE tribu_id=? ORDER BY manager DESC, user_id ASC", (row["id"],))
        membres = c.fetchall()
        c.execute("SELECT * FROM avant_postes WHERE tribu_id=? ORDER BY created_at DESC", (row["id"],))
        avant_postes = c.fetchall()
    await afficher_fiche_mise_a_jour(inter, row["id"], "📋 **Fiche tribu**", ephemeral=False)

@tree.command(name="modifier_tribu", description="Modifier les infos d'une tribu")
@app_commands.describe(
    nom="Nom de la tribu à modifier",
    nouveau_nom="Nouveau nom (optionnel)",
    description="Nouvelle description (optionnel)",
    couleur_hex="Couleur hex. ex: #00AAFF (optionnel)",
    logo_url="URL du logo (optionnel)",
    base="Nom de la base principale (optionnel)",
    map_base="Map de la base principale (optionnel)",
    coords_base="Coordonnées de la base ex: 45.5, 32.6 (optionnel)"
)
async def tribu_modifier(
    inter: discord.Interaction,
    nom: str,
    nouveau_nom: Optional[str] = None,
    description: Optional[str] = None,
    couleur_hex: Optional[str] = None,
    logo_url: Optional[str] = None,
    base: Optional[str] = None,
    map_base: Optional[str] = None,
    coords_base: Optional[str] = None
):
    db_init()
    row = tribu_par_nom(inter.guild_id, nom)
    if not row:
        await inter.response.send_message("❌ Aucune tribu trouvée avec ce nom.", ephemeral=True)
        return
    if not await verifier_droits(inter, row):
        return

    updates = {}
    if nouveau_nom:
        updates["nom"] = nouveau_nom.strip()
    if description is not None:
        updates["description"] = description.strip()
    if couleur_hex:
        try:
            updates["couleur"] = int(couleur_hex.replace("#", ""), 16)
        except ValueError:
            await inter.response.send_message("❌ Couleur invalide. Utilise un hex, ex: #00AAFF", ephemeral=True)
            return
    if logo_url is not None:
        updates["logo_url"] = logo_url.strip()
    if base is not None:
        updates["base"] = base.strip()
    if map_base is not None:
        updates["map_base"] = map_base.strip()
    if coords_base is not None:
        updates["coords_base"] = coords_base.strip()

    if not updates:
        await inter.response.send_message("Aucun changement fourni.", ephemeral=True)
        return

    with db_connect() as conn:
        c = conn.cursor()
        if "nom" in updates:
            c.execute("SELECT 1 FROM tribus WHERE guild_id=? AND LOWER(nom)=LOWER(?) AND id<>?",
                      (inter.guild_id, updates["nom"], row["id"]))
            if c.fetchone():
                await inter.response.send_message("❌ Ce nouveau nom est déjà utilisé.", ephemeral=True)
                return
        set_clause = ", ".join(f"{k}=?" for k in updates.keys())
        c.execute(f"UPDATE tribus SET {set_clause} WHERE id=?", (*updates.values(), row["id"]))
        conn.commit()

    await afficher_fiche_mise_a_jour(inter, row["id"], "✅ **Fiche mise à jour !**")

@tree.command(name="ajouter_membre_tribu", description="Ajouter un membre à ta tribu")
@app_commands.describe(
    utilisateur="Membre à ajouter", 
    nom_ingame="Nom in-game du joueur", 
    autorisé_à_modifier_fiche="Autoriser à modifier la fiche ? (oui/non)"
)
@app_commands.choices(autorisé_à_modifier_fiche=[
    app_commands.Choice(name="Oui", value="oui"),
    app_commands.Choice(name="Non", value="non")
])
async def ajouter_membre_tribu(inter: discord.Interaction, utilisateur: discord.Member, nom_ingame: str, autorisé_à_modifier_fiche: str):
    db_init()
    
    # Trouver la tribu du propriétaire/manager
    with db_connect() as conn:
        c = conn.cursor()
        c.execute("""
            SELECT t.* FROM tribus t
            LEFT JOIN membres m ON t.id = m.tribu_id AND m.user_id = ?
            WHERE t.guild_id = ? AND (t.proprietaire_id = ? OR m.manager = 1)
        """, (inter.user.id, inter.guild_id, inter.user.id))
        tribus = c.fetchall()
    
    if not tribus:
        await inter.response.send_message("❌ Tu n'es propriétaire ou manager d'aucune tribu.", ephemeral=True)
        return
    
    if len(tribus) > 1:
        noms = ", ".join([t["nom"] for t in tribus])
        await inter.response.send_message(f"❌ Tu gères plusieurs tribus ({noms}). Utilise `/modifier_tribu` puis ajoute les membres manuellement.", ephemeral=True)
        return
    
    row = tribus[0]
    
    # Convertir oui/non en 1/0 pour la base de données
    manager_flag = 1 if autorisé_à_modifier_fiche.lower() == "oui" else 0
    
    with db_connect() as conn:
        c = conn.cursor()
        c.execute("INSERT OR REPLACE INTO membres (tribu_id, user_id, nom_in_game, manager) VALUES (?, ?, ?, ?)",
                  (row["id"], utilisateur.id, nom_ingame.strip(), manager_flag))
        conn.commit()
    
    await afficher_fiche_mise_a_jour(inter, row["id"], f"✅ **<@{utilisateur.id}> ajouté à {row['nom']} !**")

@tree.command(name="supprimer_membre_tribu", description="Retirer un membre d'une tribu")
@app_commands.describe(nom="Nom de la tribu", utilisateur="Membre à retirer")
async def supprimer_membre_tribu(inter: discord.Interaction, nom: str, utilisateur: discord.Member):
    db_init()
    row = tribu_par_nom(inter.guild_id, nom)
    if not row:
        await inter.response.send_message("❌ Aucune tribu trouvée avec ce nom.", ephemeral=True)
        return
    if not await verifier_droits(inter, row):
        return
    with db_connect() as conn:
        c = conn.cursor()
        c.execute("DELETE FROM membres WHERE tribu_id=? AND user_id=?", (row["id"], utilisateur.id))
        conn.commit()
    
    await afficher_fiche_mise_a_jour(inter, row["id"], f"✅ **<@{utilisateur.id}> retiré de {row['nom']} !**")

@tree.command(name="ajouter_avant_poste", description="Ajouter un avant-poste à ta tribu")
@app_commands.describe(
    map="Map de l'avant-poste",
    coords="Coordonnées ex: 45.5, 32.6"
)
async def ajouter_avant_poste(
    inter: discord.Interaction,
    map: str,
    coords: str
):
    db_init()
    
    # Trouver la tribu du joueur
    with db_connect() as conn:
        c = conn.cursor()
        c.execute("""
            SELECT t.* FROM tribus t
            JOIN membres m ON t.id = m.tribu_id
            WHERE t.guild_id = ? AND m.user_id = ?
        """, (inter.guild_id, inter.user.id))
        tribus = c.fetchall()
    
    if not tribus:
        await inter.response.send_message("❌ Tu n'es membre d'aucune tribu. Rejoins ou crée une tribu d'abord.", ephemeral=True)
        return
    
    if len(tribus) > 1:
        noms = ", ".join([t["nom"] for t in tribus])
        await inter.response.send_message(f"❌ Tu es membre de plusieurs tribus ({noms}). Contacte un admin pour ajouter ton avant-poste.", ephemeral=True)
        return
    
    row = tribus[0]
    
    # Ajouter l'avant-poste sans nom
    with db_connect() as conn:
        c = conn.cursor()
        c.execute("""
            INSERT INTO avant_postes (tribu_id, user_id, nom, map, coords, created_at)
            VALUES (?, ?, NULL, ?, ?, ?)
        """, (row["id"], inter.user.id, map.strip(), coords.strip(), dt.datetime.utcnow().isoformat()))
        conn.commit()
    
    ajouter_historique(row["id"], inter.user.id, "Ajout avant-poste", f"{map.strip()} | {coords.strip()}")
    await afficher_fiche_mise_a_jour(inter, row["id"], f"✅ **Avant-poste ajouté : {map.strip()} !**")

@ajouter_avant_poste.autocomplete('map')
async def map_avant_poste_autocomplete(inter: discord.Interaction, current: str):
    db_init()
    return get_maps_choices(inter.guild_id)

@tree.command(name="supprimer_avant_poste", description="Retirer un avant-poste d'une tribu")
@app_commands.describe(nom_tribu="Nom de la tribu", map="Map de l'avant-poste à retirer")
async def supprimer_avant_poste(inter: discord.Interaction, nom_tribu: str, map: str):
    db_init()
    row = tribu_par_nom(inter.guild_id, nom_tribu)
    if not row:
        await inter.response.send_message("❌ Aucune tribu trouvée avec ce nom.", ephemeral=True)
        return
    if not await verifier_droits(inter, row):
        return
    with db_connect() as conn:
        c = conn.cursor()
        c.execute("DELETE FROM avant_postes WHERE tribu_id=? AND LOWER(map)=LOWER(?)", (row["id"], map))
        if c.rowcount == 0:
            await inter.response.send_message(f"❌ Aucun avant-poste trouvé avec la map **{map}**.", ephemeral=True)
            return
        conn.commit()
    
    ajouter_historique(row["id"], inter.user.id, "Retrait avant-poste", f"{map}")
    await afficher_fiche_mise_a_jour(inter, row["id"], f"✅ **Avant-poste {map} retiré de {row['nom']} !**")

@tree.command(name="tribu_transférer", description="Transférer la propriété d'une tribu")
@app_commands.describe(nom="Nom de la tribu", nouveau_proprio="Nouveau propriétaire")
async def tribu_transferer(inter: discord.Interaction, nom: str, nouveau_proprio: discord.Member):
    db_init()
    row = tribu_par_nom(inter.guild_id, nom)
    if not row:
        await inter.response.send_message("❌ Aucune tribu trouvée avec ce nom.", ephemeral=True)
        return
    if not (est_admin(inter) or inter.user.id == row["proprietaire_id"]):
        await inter.response.send_message("❌ Seul le propriétaire actuel (ou un admin) peut transférer la tribu.", ephemeral=True)
        return
    with db_connect() as conn:
        c = conn.cursor()
        c.execute("UPDATE tribus SET proprietaire_id=? WHERE id=?", (nouveau_proprio.id, row["id"]))
        c.execute("INSERT OR REPLACE INTO membres (tribu_id, user_id, role, manager) VALUES (?, ?, ?, 1)",
                  (row["id"], nouveau_proprio.id, "Chef",))
        conn.commit()
    
    await afficher_fiche_mise_a_jour(inter, row["id"], f"✅ **Propriété de {row['nom']} transférée à <@{nouveau_proprio.id}> !**")

@tree.command(name="tribu_supprimer", description="Supprimer une tribu (confirmation requise)")
@app_commands.describe(nom="Nom de la tribu", confirmation="Retape exactement le nom pour confirmer")
async def tribu_supprimer(inter: discord.Interaction, nom: str, confirmation: str):
    db_init()
    row = tribu_par_nom(inter.guild_id, nom)
    if not row:
        await inter.response.send_message("❌ Aucune tribu trouvée avec ce nom.", ephemeral=True)
        return
    if not await verifier_droits(inter, row):
        return
    if confirmation.lower() != nom.lower():
        await inter.response.send_message("❌ Confirmation incorrecte. Opération annulée.", ephemeral=True)
        return
    with db_connect() as conn:
        c = conn.cursor()
        c.execute("DELETE FROM tribus WHERE id=?", (row["id"],))
        c.execute("DELETE FROM membres WHERE tribu_id=?", (row["id"],))
        conn.commit()
    await inter.response.send_message(f"🗑️ La tribu **{nom}** a été supprimée.")

@tribu_supprimer.autocomplete('nom')
async def tribu_supprimer_autocomplete(inter: discord.Interaction, current: str):
    db_init()
    with db_connect() as conn:
        c = conn.cursor()
        
        # Si admin ou modo, afficher toutes les tribus
        if est_admin_ou_modo(inter):
            c.execute("SELECT nom FROM tribus WHERE guild_id=? ORDER BY LOWER(nom) ASC", (inter.guild_id,))
        else:
            # Sinon, afficher seulement les tribus où l'utilisateur est propriétaire ou manager
            c.execute("""
                SELECT DISTINCT t.nom FROM tribus t
                LEFT JOIN membres m ON t.id = m.tribu_id
                WHERE t.guild_id = ? AND (t.proprietaire_id = ? OR (m.user_id = ? AND m.manager = 1))
                ORDER BY LOWER(t.nom) ASC
            """, (inter.guild_id, inter.user.id, inter.user.id))
        
        tribus = c.fetchall()
    
    # Filtrer par la recherche de l'utilisateur
    filtered = [t["nom"] for t in tribus if current.lower() in t["nom"].lower()][:25]
    return [app_commands.Choice(name=nom, value=nom) for nom in filtered]

# ---- Commandes Admin (maps) ----

@tree.command(name="ajout_map", description="[ADMIN] Ajouter une map à la liste")
@app_commands.describe(nom="Nom de la map à ajouter")
async def ajout_map(inter: discord.Interaction, nom: str):
    if not est_admin(inter):
        await inter.response.send_message("❌ Cette commande est réservée aux administrateurs.", ephemeral=True)
        return
    db_init()
    with db_connect() as conn:
        c = conn.cursor()
        try:
            c.execute("INSERT INTO maps (guild_id, nom, created_at) VALUES (?, ?, ?)",
                     (inter.guild_id, nom.strip(), dt.datetime.utcnow().isoformat()))
            conn.commit()
            await inter.response.send_message(f"✅ Map **{nom}** ajoutée à la liste !", ephemeral=True)
        except sqlite3.IntegrityError:
            await inter.response.send_message(f"❌ La map **{nom}** existe déjà.", ephemeral=True)

@tree.command(name="retirer_map", description="[ADMIN] Supprimer une map de la liste")
@app_commands.describe(nom="Nom de la map à supprimer")
async def retirer_map(inter: discord.Interaction, nom: str):
    if not est_admin(inter):
        await inter.response.send_message("❌ Cette commande est réservée aux administrateurs.", ephemeral=True)
        return
    db_init()
    with db_connect() as conn:
        c = conn.cursor()
        c.execute("DELETE FROM maps WHERE guild_id=? AND nom=?", (inter.guild_id, nom))
        if c.rowcount == 0:
            await inter.response.send_message(f"❌ Map **{nom}** non trouvée.", ephemeral=True)
        else:
            conn.commit()
            await inter.response.send_message(f"✅ Map **{nom}** supprimée de la liste !", ephemeral=True)

@tree.command(name="test_bot", description="Vérifier si le bot répond")
async def tribu_test(inter: discord.Interaction):
    await inter.response.send_message("🏓 Pong !")

@tree.command(name="personnaliser_tribu", description="Personnaliser ta tribu (description, devise, logo, couleur)")
async def personnaliser_tribu(inter: discord.Interaction):
    await inter.response.send_modal(ModalPersonnaliserTribu())

@tree.command(name="détailler_tribu", description="Détailler ta tribu (photo base, objectif, boss, notes)")
async def detailler_tribu(inter: discord.Interaction):
    await inter.response.send_modal(ModalDetaillerTribu())

@tree.command(name="quitter_tribu", description="Quitter ta tribu")
async def quitter_tribu(inter: discord.Interaction):
    db_init()
    
    with db_connect() as conn:
        c = conn.cursor()
        c.execute("""
            SELECT t.* FROM tribus t
            JOIN membres m ON t.id = m.tribu_id
            WHERE t.guild_id = ? AND m.user_id = ?
        """, (inter.guild_id, inter.user.id))
        tribus = c.fetchall()
    
    if not tribus:
        await inter.response.send_message("❌ Tu n'es membre d'aucune tribu.", ephemeral=True)
        return
    
    if len(tribus) > 1:
        noms = ", ".join([t["nom"] for t in tribus])
        await inter.response.send_message(f"❌ Tu es membre de plusieurs tribus ({noms}). Utilise le bouton 'Quitter tribu' sur la fiche de la tribu que tu veux quitter.", ephemeral=True)
        return
    
    tribu = tribus[0]
    
    if inter.user.id == tribu["proprietaire_id"]:
        await inter.response.send_message("❌ Le référent tribu ne peut pas quitter. Utilise `/tribu_transférer` d'abord.", ephemeral=True)
        return
    
    with db_connect() as conn:
        c = conn.cursor()
        c.execute("DELETE FROM membres WHERE tribu_id=? AND user_id=?", (tribu["id"], inter.user.id))
        conn.commit()
    
    ajouter_historique(tribu["id"], inter.user.id, "Quitter tribu", f"<@{inter.user.id}> a quitté la tribu")
    await inter.response.send_message(f"✅ Tu as quitté la tribu **{tribu['nom']}**.", ephemeral=True)

@tree.command(name="ajout_boss", description="[ADMIN] Ajouter un boss à la liste")
@app_commands.describe(nom="Nom du boss à ajouter")
async def ajout_boss(inter: discord.Interaction, nom: str):
    if not est_admin(inter):
        await inter.response.send_message("❌ Cette commande est réservée aux administrateurs.", ephemeral=True)
        return
    db_init()
    with db_connect() as conn:
        c = conn.cursor()
        try:
            c.execute("INSERT INTO boss (guild_id, nom, created_at) VALUES (?, ?, ?)",
                     (inter.guild_id, nom.strip(), dt.datetime.utcnow().isoformat()))
            conn.commit()
            await inter.response.send_message(f"✅ Boss **{nom}** ajouté à la liste !", ephemeral=True)
        except sqlite3.IntegrityError:
            await inter.response.send_message(f"❌ Le boss **{nom}** existe déjà.", ephemeral=True)

@tree.command(name="retirer_boss", description="[ADMIN] Supprimer un boss de la liste")
@app_commands.describe(nom="Nom du boss à supprimer")
async def retirer_boss(inter: discord.Interaction, nom: str):
    if not est_admin(inter):
        await inter.response.send_message("❌ Cette commande est réservée aux administrateurs.", ephemeral=True)
        return
    db_init()
    with db_connect() as conn:
        c = conn.cursor()
        c.execute("DELETE FROM boss WHERE guild_id=? AND nom=?", (inter.guild_id, nom))
        if c.rowcount == 0:
            await inter.response.send_message(f"❌ Boss **{nom}** non trouvé.", ephemeral=True)
        else:
            conn.commit()
            await inter.response.send_message(f"✅ Boss **{nom}** supprimé de la liste !", ephemeral=True)

@tree.command(name="ajout_note", description="[ADMIN] Ajouter une note à la liste")
@app_commands.describe(nom="Nom de la note à ajouter")
async def ajout_note(inter: discord.Interaction, nom: str):
    if not est_admin(inter):
        await inter.response.send_message("❌ Cette commande est réservée aux administrateurs.", ephemeral=True)
        return
    db_init()
    with db_connect() as conn:
        c = conn.cursor()
        try:
            c.execute("INSERT INTO notes (guild_id, nom, created_at) VALUES (?, ?, ?)",
                     (inter.guild_id, nom.strip(), dt.datetime.utcnow().isoformat()))
            conn.commit()
            await inter.response.send_message(f"✅ Note **{nom}** ajoutée à la liste !", ephemeral=True)
        except sqlite3.IntegrityError:
            await inter.response.send_message(f"❌ La note **{nom}** existe déjà.", ephemeral=True)

@tree.command(name="retirer_note", description="[ADMIN] Supprimer une note de la liste")
@app_commands.describe(nom="Nom de la note à supprimer")
async def retirer_note(inter: discord.Interaction, nom: str):
    if not est_admin(inter):
        await inter.response.send_message("❌ Cette commande est réservée aux administrateurs.", ephemeral=True)
        return
    db_init()
    with db_connect() as conn:
        c = conn.cursor()
        c.execute("DELETE FROM notes WHERE guild_id=? AND nom=?", (inter.guild_id, nom))
        if c.rowcount == 0:
            await inter.response.send_message(f"❌ Note **{nom}** non trouvée.", ephemeral=True)
        else:
            conn.commit()
            await inter.response.send_message(f"✅ Note **{nom}** supprimée de la liste !", ephemeral=True)

@tree.command(name="boss_validé_tribu", description="Valider un boss complété pour ta tribu")
@app_commands.describe(boss="Boss complété")
async def boss_valide_tribu(inter: discord.Interaction, boss: str):
    db_init()
    
    # Trouver la tribu de l'utilisateur
    with db_connect() as conn:
        c = conn.cursor()
        c.execute("""
            SELECT t.* FROM tribus t
            LEFT JOIN membres m ON t.id = m.tribu_id
            WHERE t.guild_id = ? AND (t.proprietaire_id = ? OR (m.user_id = ? AND m.manager = 1))
        """, (inter.guild_id, inter.user.id, inter.user.id))
        row = c.fetchone()
    
    if not row:
        await inter.response.send_message("❌ Tu n'es référent ou manager d'aucune tribu.", ephemeral=True)
        return
    
    # Récupérer la progression actuelle
    progression_actuelle = row["progression_boss"] if row["progression_boss"] else ""
    boss_list = [b.strip() for b in progression_actuelle.split(",") if b.strip()]
    
    # Vérifier si le boss est déjà validé
    if boss in boss_list:
        await inter.response.send_message(f"ℹ️ Le boss **{boss}** est déjà validé pour {row['nom']}.", ephemeral=True)
        return
    
    # Ajouter le boss
    boss_list.append(boss)
    nouvelle_progression = ", ".join(boss_list)
    
    with db_connect() as conn:
        c = conn.cursor()
        c.execute("UPDATE tribus SET progression_boss=? WHERE id=?", (nouvelle_progression, row["id"]))
        conn.commit()
    
    ajouter_historique(row["id"], inter.user.id, "Boss validé", boss)
    await afficher_fiche_mise_a_jour(inter, row["id"], f"✅ **Boss {boss} validé pour {row['nom']} !**")

@boss_valide_tribu.autocomplete('boss')
async def boss_autocomplete(inter: discord.Interaction, current: str):
    db_init()
    return get_boss_choices(inter.guild_id)

@tree.command(name="note_validé_tribu", description="Valider une note complétée pour ta tribu")
@app_commands.describe(note="Note complétée")
async def note_valide_tribu(inter: discord.Interaction, note: str):
    db_init()
    
    # Trouver la tribu de l'utilisateur
    with db_connect() as conn:
        c = conn.cursor()
        c.execute("""
            SELECT t.* FROM tribus t
            LEFT JOIN membres m ON t.id = m.tribu_id
            WHERE t.guild_id = ? AND (t.proprietaire_id = ? OR (m.user_id = ? AND m.manager = 1))
        """, (inter.guild_id, inter.user.id, inter.user.id))
        row = c.fetchone()
    
    if not row:
        await inter.response.send_message("❌ Tu n'es référent ou manager d'aucune tribu.", ephemeral=True)
        return
    
    # Récupérer la progression actuelle
    progression_actuelle = row["progression_notes"] if row["progression_notes"] else ""
    notes_list = [n.strip() for n in progression_actuelle.split(",") if n.strip()]
    
    # Vérifier si la note est déjà validée
    if note in notes_list:
        await inter.response.send_message(f"ℹ️ La note **{note}** est déjà validée pour {row['nom']}.", ephemeral=True)
        return
    
    # Ajouter la note
    notes_list.append(note)
    nouvelle_progression = ", ".join(notes_list)
    
    with db_connect() as conn:
        c = conn.cursor()
        c.execute("UPDATE tribus SET progression_notes=? WHERE id=?", (nouvelle_progression, row["id"]))
        conn.commit()
    
    ajouter_historique(row["id"], inter.user.id, "Note validée", note)
    await afficher_fiche_mise_a_jour(inter, row["id"], f"✅ **Note {note} validée pour {row['nom']} !**")

@note_valide_tribu.autocomplete('note')
async def note_autocomplete(inter: discord.Interaction, current: str):
    db_init()
    return get_notes_choices(inter.guild_id)

@tree.command(name="aide", description="Afficher la liste des commandes du bot")
async def aide(inter: discord.Interaction):
    e = discord.Embed(
        title="❓ Aide — Commandes disponibles",
        description="Commandes rapides pour gérer les fiches tribu :",
        color=0x5865F2
    )
    lignes = [
        "**Gestion des tribus :**",
        "• **/créer_tribu** — créer une nouvelle tribu",
        "• **/tribu_voir** — afficher une fiche tribu complète",
        "• **/modifier_tribu** — éditer les infos de base",
        "• **/personnaliser_tribu** — personnaliser (description, devise, logo, couleur)",
        "• **/détailler_tribu** — détailler (photo, objectif, boss, notes)",
        "• **/quitter_tribu** — quitter ta tribu",
        "• **/tribu_transférer** — transférer la propriété",
        "• **/tribu_supprimer** — supprimer une tribu (avec confirmation)",
        "",
        "**Membres et avant-postes :**",
        "• **/ajouter_membre_tribu** — ajouter un membre à ta tribu",
        "• **/supprimer_membre_tribu** — retirer un membre de la tribu",
        "• **/ajouter_avant_poste** — ajouter ton avant-poste",
        "• **/supprimer_avant_poste** — retirer un avant-poste",
        "",
        "**Interface :**",
        "• **/panneau** — ouvre les boutons (Créer / Modifier / Personnaliser / Détailler)",
        "",
        "**Commandes Admin :**",
        "• **/ajout_map** — ajouter une map personnalisée",
        "• **/retirer_map** — supprimer une map",
        "• **/ajout_boss** — ajouter un boss",
        "• **/retirer_boss** — supprimer un boss",
        "• **/ajout_note** — ajouter une note",
        "• **/retirer_note** — supprimer une note"
    ]
    e.add_field(name="Résumé", value="\n".join(lignes), inline=False)
    e.set_footer(text="💡 Les maps ont des menus déroulants pour faciliter la sélection")
    await inter.response.send_message(embed=e, ephemeral=True)

# ---------- UI (boutons + modals) ----------
class ModalCreerTribu(discord.ui.Modal, title="✨ Créer une tribu"):
    nom = discord.ui.TextInput(label="Nom de la tribu", placeholder="Ex: Les Spinos", max_length=64, required=True)
    couleur_hex = discord.ui.TextInput(label="Couleur (optionnel)", required=False, placeholder="Ex: #00AAFF")
    logo_url = discord.ui.TextInput(label="Logo URL (optionnel)", required=False, placeholder="https://...")
    map_base = discord.ui.TextInput(label="🏠 BASE PRINCIPALE — Map", placeholder="Ex: The Island", max_length=50, required=True)
    coords_base = discord.ui.TextInput(label="🏠 BASE PRINCIPALE — Coords", placeholder="Ex: 45.5, 32.6", max_length=50, required=True)

    async def on_submit(self, inter: discord.Interaction):
        db_init()
        if tribu_par_nom(inter.guild_id, str(self.nom)):
            await inter.response.send_message("❌ Ce nom de tribu est déjà pris.", ephemeral=True)
            return
        
        # Gérer la couleur
        couleur = None
        if str(self.couleur_hex).strip():
            try:
                couleur = int(str(self.couleur_hex).replace("#", ""), 16)
            except ValueError:
                await inter.response.send_message("❌ Couleur invalide. Utilise un format hex comme #00AAFF", ephemeral=True)
                return
        
        with db_connect() as conn:
            c = conn.cursor()
            c.execute("""
                INSERT INTO tribus (guild_id, nom, map_base, coords_base, couleur, logo_url, proprietaire_id, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (inter.guild_id, str(self.nom).strip(), str(self.map_base).strip(), 
                  str(self.coords_base).strip(), couleur, str(self.logo_url).strip() if str(self.logo_url).strip() else None, 
                  inter.user.id, dt.datetime.utcnow().isoformat()))
            tid = c.lastrowid
            
            # Ajouter le créateur comme Référent
            c.execute("INSERT INTO membres (tribu_id, user_id, manager) VALUES (?, ?, 1)",
                      (tid, inter.user.id))
            
            conn.commit()
        
        ajouter_historique(tid, inter.user.id, "Création tribu", f"Tribu {str(self.nom)} créée")
        
        # Note d'information
        note = "ℹ️ **Autres options disponibles** : Utilise les boutons « Modifier », « Personnaliser » et « Détailler » pour compléter ta fiche !"
        await afficher_fiche_mise_a_jour(inter, tid, f"✅ **Tribu {str(self.nom)} créée !**\n{note}", ephemeral=False)

class ModalModifierTribu(discord.ui.Modal, title="🛠️ Modifier tribu"):
    nom = discord.ui.TextInput(label="Nom tribu (optionnel)", required=False)
    map_base = discord.ui.TextInput(label="🏠 BASE PRINCIPALE — Map (optionnel)", required=False)
    coords_base = discord.ui.TextInput(label="🏠 BASE PRINCIPALE — Coords (optionnel)", required=False)

    async def on_submit(self, inter: discord.Interaction):
        db_init()
        # Trouver la tribu de l'utilisateur
        with db_connect() as conn:
            c = conn.cursor()
            c.execute("""
                SELECT t.* FROM tribus t
                LEFT JOIN membres m ON t.id = m.tribu_id
                WHERE t.guild_id = ? AND (t.proprietaire_id = ? OR (m.user_id = ? AND m.manager = 1))
            """, (inter.guild_id, inter.user.id, inter.user.id))
            row = c.fetchone()
        
        if not row:
            await inter.response.send_message("❌ Tu n'es référent ou manager d'aucune tribu.", ephemeral=True)
            return
        
        updates = {}
        if str(self.nom).strip():
            updates["nom"] = str(self.nom).strip()
        if str(self.map_base).strip():
            updates["map_base"] = str(self.map_base).strip()
        if str(self.coords_base).strip():
            updates["coords_base"] = str(self.coords_base).strip()
        
        with db_connect() as conn:
            c = conn.cursor()
            
            # Mettre à jour les champs de base
            if updates:
                set_clause = ", ".join(f"{k}=?" for k in updates.keys())
                c.execute(f"UPDATE tribus SET {set_clause} WHERE id=?", (*updates.values(), row["id"]))
                ajouter_historique(row["id"], inter.user.id, "Modification", f"Champs modifiés: {', '.join(updates.keys())}")
                conn.commit()
                await afficher_fiche_mise_a_jour(inter, row["id"], "✅ **Tribu modifiée !**", ephemeral=False)
            else:
                await inter.response.send_message("ℹ️ Aucun changement n'a été effectué.", ephemeral=True)

class ModalPersonnaliserTribu(discord.ui.Modal, title="🎨 Personnaliser tribu"):
    description = discord.ui.TextInput(label="Description (50 car. max)", max_length=50, required=False, style=discord.TextStyle.short)
    devise = discord.ui.TextInput(label="Devise de la tribu", required=False, max_length=100)
    logo_url = discord.ui.TextInput(label="Logo (URL image)", required=False, placeholder="https://...")
    couleur_hex = discord.ui.TextInput(label="Couleur hex (ex: #00AAFF)", required=False)
    recrutement = discord.ui.TextInput(label="Ouvert recrutement? (oui/non)", required=False, placeholder="oui ou non")

    async def on_submit(self, inter: discord.Interaction):
        db_init()
        with db_connect() as conn:
            c = conn.cursor()
            c.execute("""
                SELECT t.* FROM tribus t
                LEFT JOIN membres m ON t.id = m.tribu_id
                WHERE t.guild_id = ? AND (t.proprietaire_id = ? OR (m.user_id = ? AND m.manager = 1))
            """, (inter.guild_id, inter.user.id, inter.user.id))
            row = c.fetchone()
        
        if not row:
            await inter.response.send_message("❌ Tu n'es référent ou manager d'aucune tribu.", ephemeral=True)
            return
        
        updates = {}
        if str(self.description).strip():
            updates["description"] = str(self.description).strip()
        if str(self.devise).strip():
            updates["devise"] = str(self.devise).strip()
        if str(self.logo_url).strip():
            updates["logo_url"] = str(self.logo_url).strip()
        if str(self.couleur_hex).strip():
            try:
                updates["couleur"] = int(str(self.couleur_hex).replace("#", ""), 16)
            except ValueError:
                await inter.response.send_message("❌ Couleur invalide.", ephemeral=True)
                return
        if str(self.recrutement).strip().lower() in ["oui", "non"]:
            updates["ouvert_recrutement"] = 1 if str(self.recrutement).strip().lower() == "oui" else 0
        
        with db_connect() as conn:
            c = conn.cursor()
            if updates:
                set_clause = ", ".join(f"{k}=?" for k in updates.keys())
                c.execute(f"UPDATE tribus SET {set_clause} WHERE id=?", (*updates.values(), row["id"]))
                conn.commit()
                ajouter_historique(row["id"], inter.user.id, "Personnalisation", f"Champs: {', '.join(updates.keys())}")
        
        await afficher_fiche_mise_a_jour(inter, row["id"], "✅ **Tribu personnalisée !**", ephemeral=False)

class ModalDetaillerTribu(discord.ui.Modal, title="📋 Détailler tribu"):
    photo_base = discord.ui.TextInput(label="Photo base (URL)", required=False, placeholder="https://...")
    objectif = discord.ui.TextInput(label="Objectif (50 car. max)", max_length=50, required=False)
    info_progression = discord.ui.TextInput(
        label="ℹ️ Progression Boss & Notes", 
        required=False, 
        style=discord.TextStyle.paragraph,
        placeholder="Pour ajouter la progression de votre tribu:\n• Boss : /boss_validé_tribu\n• Notes : /note_validé_tribu",
        default="Pour ajouter la progression de votre tribu:\n• Boss : /boss_validé_tribu\n• Notes : /note_validé_tribu"
    )

    async def on_submit(self, inter: discord.Interaction):
        db_init()
        with db_connect() as conn:
            c = conn.cursor()
            c.execute("""
                SELECT t.* FROM tribus t
                LEFT JOIN membres m ON t.id = m.tribu_id
                WHERE t.guild_id = ? AND (t.proprietaire_id = ? OR (m.user_id = ? AND m.manager = 1))
            """, (inter.guild_id, inter.user.id, inter.user.id))
            row = c.fetchone()
        
        if not row:
            await inter.response.send_message("❌ Tu n'es référent ou manager d'aucune tribu.", ephemeral=True)
            return
        
        updates = {}
        if str(self.photo_base).strip():
            updates["photo_base"] = str(self.photo_base).strip()
        if str(self.objectif).strip():
            updates["objectif"] = str(self.objectif).strip()
        
        with db_connect() as conn:
            c = conn.cursor()
            if updates:
                set_clause = ", ".join(f"{k}=?" for k in updates.keys())
                c.execute(f"UPDATE tribus SET {set_clause} WHERE id=?", (*updates.values(), row["id"]))
                conn.commit()
                ajouter_historique(row["id"], inter.user.id, "Détails ajoutés", f"Champs: {', '.join(updates.keys())}")
                await afficher_fiche_mise_a_jour(inter, row["id"], "✅ **Détails ajoutés !**", ephemeral=False)
            else:
                # Si aucune mise à jour, juste afficher la fiche
                await inter.response.send_message("ℹ️ Aucun changement n'a été effectué.", ephemeral=True)
                return

class PanneauTribu(discord.ui.View):
    def __init__(self, timeout: Optional[float] = None):
        super().__init__(timeout=timeout)

    @discord.ui.button(label="Créer", style=discord.ButtonStyle.success, emoji="✨")
    async def btn_creer(self, inter: discord.Interaction, button: discord.ui.Button):
        await inter.response.send_modal(ModalCreerTribu())

    @discord.ui.button(label="Modifier", style=discord.ButtonStyle.primary, emoji="🛠️")
    async def btn_modifier(self, inter: discord.Interaction, button: discord.ui.Button):
        await inter.response.send_modal(ModalModifierTribu())
    
    @discord.ui.button(label="Personnaliser", style=discord.ButtonStyle.secondary, emoji="🎨")
    async def btn_personnaliser(self, inter: discord.Interaction, button: discord.ui.Button):
        await inter.response.send_modal(ModalPersonnaliserTribu())
    
    @discord.ui.button(label="Détailler", style=discord.ButtonStyle.secondary, emoji="📋")
    async def btn_detailler(self, inter: discord.Interaction, button: discord.ui.Button):
        await inter.response.send_modal(ModalDetaillerTribu())

@tree.command(name="panneau", description="Ouvrir le panneau Tribu (boutons)")
async def panneau(inter: discord.Interaction):
    v = PanneauTribu(timeout=None)  # Pas de timeout pour un panneau permanent
    e = discord.Embed(
        title="🧭 Panneau — Fiches Tribu",
        description="Utilise les boutons ci-dessous pour gérer les fiches sans taper de commandes.",
        color=0x2B2D31
    )
    
    # Si admin, afficher pour tout le monde, sinon en privé
    if est_admin(inter):
        e.set_footer(text="👑 Panneau admin — Visible par tous")
        await inter.response.send_message(embed=e, view=v, ephemeral=False)
    else:
        e.set_footer(text="Astuce : tu peux rouvrir ce panneau à tout moment avec /panneau")
        await inter.response.send_message(embed=e, view=v, ephemeral=True)

@bot.event
async def on_ready():
    db_init()  # Initialiser la DB au démarrage
    try:
        synced = await tree.sync()
        print(f"Commandes synchronisées : {len(synced)}")
        for cmd in synced:
            print(f"  - /{cmd.name}")
    except Exception as e:
        print("Erreur de sync des commandes :", e)
    print(f"Connecté en tant que {bot.user} (ID: {bot.user.id})")

def main():
    db_init()
    token = os.getenv("DISCORD_BOT_TOKEN")
    if not token:
        print("ERREUR : définis la variable d'environnement DISCORD_BOT_TOKEN avec le token du bot.")
        return
    bot.run(token)

if __name__ == "__main__":
    main()
