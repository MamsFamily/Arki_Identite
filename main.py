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

def est_admin(inter: discord.Interaction) -> bool:
    perms = inter.user.guild_permissions
    return perms.manage_guild or perms.administrator

def est_manager(tribu_id: int, user_id: int) -> bool:
    with db_connect() as conn:
        c = conn.cursor()
        c.execute("SELECT manager FROM membres WHERE tribu_id=? AND user_id=?", (tribu_id, user_id))
        row = c.fetchone()
        return bool(row and row["manager"])

# ---------- Bot ----------
intents = discord.Intents.default()
intents.guilds = True
intents.members = True

bot = commands.Bot(command_prefix="!", intents=intents)
tree = bot.tree

# ---------- Helpers UI ----------
def embed_tribu(tribu, membres=None, avant_postes=None) -> discord.Embed:
    color = tribu["couleur"] if tribu["couleur"] else 0x2F3136
    e = discord.Embed(
        title=f"🏕️ Tribu — {tribu['nom']}",
        description=tribu["description"] or "—",
        color=color,
        timestamp=dt.datetime.utcnow()
    )
    if tribu["logo_url"]:
        e.set_thumbnail(url=tribu["logo_url"])
    
    base_value = tribu["base"] if tribu["base"] else "—"
    map_base = tribu["map_base"] if "map_base" in tribu.keys() and tribu["map_base"] else ""
    coords_base = tribu["coords_base"] if "coords_base" in tribu.keys() and tribu["coords_base"] else ""
    if map_base and coords_base:
        base_value = f"{base_value}\n🗺️ Map: **{map_base}**\n📍 Coords: **{coords_base}**"
    elif map_base:
        base_value = f"{base_value}\n🗺️ Map: **{map_base}**"
    elif coords_base:
        base_value = f"{base_value}\n📍 Coords: **{coords_base}**"
    
    e.add_field(name="🏰 Base Principale", value=base_value, inline=False)
    e.add_field(name="👑 Propriétaire", value=f"<@{tribu['proprietaire_id']}>", inline=True)

    if membres is not None:
        lines = []
        for m in membres:
            line = f"• <@{m['user_id']}>"
            if m["role"]:
                line += f" — {m['role']}"
            lines.append(line)
        if lines:
            e.add_field(name=f"👥 Membres ({len(lines)})", value="\n".join(lines)[:1024], inline=False)
    
    if avant_postes is not None and len(avant_postes) > 0:
        ap_lines = []
        for ap in avant_postes:
            ap_text = f"• **{ap['nom']}**"
            if ap['map'] and ap['coords']:
                ap_text += f"\n  🗺️ {ap['map']} | 📍 {ap['coords']}"
            elif ap['map']:
                ap_text += f"\n  🗺️ {ap['map']}"
            elif ap['coords']:
                ap_text += f"\n  📍 {ap['coords']}"
            ap_lines.append(ap_text)
        if ap_lines:
            e.add_field(name=f"⛺ Avant-Postes ({len(ap_lines)})", value="\n".join(ap_lines)[:1024], inline=False)

    e.set_footer(text="Astuce : /tribu modifier ou le bouton « Modifier » pour mettre à jour la fiche")
    return e

async def verifier_droits(inter: discord.Interaction, tribu) -> bool:
    if est_admin(inter) or inter.user.id == tribu["proprietaire_id"] or est_manager(tribu["id"], inter.user.id):
        return True
    await inter.response.send_message("❌ Tu n'as pas la permission de modifier cette tribu.", ephemeral=True)
    return False

async def afficher_fiche_mise_a_jour(inter: discord.Interaction, tribu_id: int, message_prefix: str = "✅ **Fiche mise à jour !**", ephemeral: bool = False):
    """Affiche la fiche tribu mise à jour et supprime l'ancienne si elle existe"""
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
        
        # Supprimer l'ancien message s'il existe
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
        
        # Envoyer le nouveau message avec la fiche
        embed = embed_tribu(tribu, membres, avant_postes)
        
        # Répondre à l'interaction
        await inter.response.send_message(message_prefix, embed=embed, ephemeral=ephemeral)
        msg = await inter.original_response()
        
        # Sauvegarder le nouveau message_id et channel_id (seulement si pas ephemeral)
        if not ephemeral:
            c.execute("UPDATE tribus SET message_id=?, channel_id=? WHERE id=?", 
                     (msg.id, msg.channel.id, tribu_id))
            conn.commit()

# ---------- Groupe de commandes ----------
class GroupeTribu(app_commands.Group):
    def __init__(self):
        super().__init__(name="tribu", description="Gérer les fiches tribu")

tribu = GroupeTribu()
tree.add_command(tribu)

# ---- Slash commands de base (FR) ----
@tribu.command(name="créer", description="Créer une nouvelle tribu")
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
    embed.set_footer(text="ℹ️ Ajoutez des membres avec /tribu ajouter_membre et des avant-postes avec /tribu ajouter_avant_poste")
    await inter.response.send_message("✅ **Tribu créée !**", embed=embed)

@tribu_creer.autocomplete('map_base')
async def map_autocomplete(inter: discord.Interaction, current: str):
    db_init()
    return get_maps_choices(inter.guild_id)

@tribu.command(name="voir", description="Afficher la fiche d'une tribu")
@app_commands.describe(nom="Nom de la tribu")
async def tribu_voir(inter: discord.Interaction, nom: str):
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
    await inter.response.send_message(embed=embed_tribu(row, membres, avant_postes))

@tribu.command(name="lister", description="Lister toutes les tribus du serveur")
async def tribu_lister(inter: discord.Interaction):
    db_init()
    with db_connect() as conn:
        c = conn.cursor()
        c.execute("SELECT nom, proprietaire_id FROM tribus WHERE guild_id=? ORDER BY LOWER(nom) ASC", (inter.guild_id,))
        rows = c.fetchall()
    if not rows:
        await inter.response.send_message("Aucune tribu pour l'instant. Utilise **/tribu créer** pour commencer.", ephemeral=True)
        return
    texte = "\n".join(f"• **{r['nom']}** — proprio : <@{r['proprietaire_id']}>"
                      for r in rows)
    await inter.response.send_message(texte)

@tribu.command(name="modifier", description="Modifier les infos d'une tribu")
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

@tribu.command(name="ajouter_membre", description="Ajouter un membre à ta tribu")
@app_commands.describe(utilisateur="Membre à ajouter", role="Rôle affiché (optionnel)", manager="Donner les droits de gestion ?")
async def tribu_ajouter_membre(inter: discord.Interaction, utilisateur: discord.Member, role: Optional[str] = "", manager: Optional[bool] = False):
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
        await inter.response.send_message(f"❌ Tu gères plusieurs tribus ({noms}). Utilise `/tribu modifier` puis ajoute les membres manuellement.", ephemeral=True)
        return
    
    row = tribus[0]
    
    with db_connect() as conn:
        c = conn.cursor()
        c.execute("INSERT OR REPLACE INTO membres (tribu_id, user_id, role, manager) VALUES (?, ?, ?, ?)",
                  (row["id"], utilisateur.id, role or "", 1 if manager else 0))
        conn.commit()
    
    await afficher_fiche_mise_a_jour(inter, row["id"], f"✅ **<@{utilisateur.id}> ajouté à {row['nom']} !**")

@tribu.command(name="retirer_membre", description="Retirer un membre d'une tribu")
@app_commands.describe(nom="Nom de la tribu", utilisateur="Membre à retirer")
async def tribu_retirer_membre(inter: discord.Interaction, nom: str, utilisateur: discord.Member):
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

@tribu.command(name="ajouter_avant_poste", description="Ajouter un avant-poste à ta tribu")
@app_commands.describe(
    nom_avant_poste="Nom de l'avant-poste",
    map="Map de l'avant-poste",
    coords="Coordonnées ex: 45.5, 32.6"
)
async def tribu_ajouter_avant_poste(
    inter: discord.Interaction,
    nom_avant_poste: str,
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
    
    with db_connect() as conn:
        c = conn.cursor()
        c.execute("""
            INSERT INTO avant_postes (tribu_id, user_id, nom, map, coords, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (row["id"], inter.user.id, nom_avant_poste.strip(), map.strip(), coords.strip(), dt.datetime.utcnow().isoformat()))
        conn.commit()
    
    await afficher_fiche_mise_a_jour(inter, row["id"], f"✅ **Avant-poste {nom_avant_poste} ajouté à {row['nom']} !**")

@tribu_ajouter_avant_poste.autocomplete('map')
async def map_avant_poste_autocomplete(inter: discord.Interaction, current: str):
    db_init()
    return get_maps_choices(inter.guild_id)

@tribu.command(name="retirer_avant_poste", description="Retirer un avant-poste d'une tribu")
@app_commands.describe(nom_tribu="Nom de la tribu", nom_avant_poste="Nom de l'avant-poste à retirer")
async def tribu_retirer_avant_poste(inter: discord.Interaction, nom_tribu: str, nom_avant_poste: str):
    db_init()
    row = tribu_par_nom(inter.guild_id, nom_tribu)
    if not row:
        await inter.response.send_message("❌ Aucune tribu trouvée avec ce nom.", ephemeral=True)
        return
    if not await verifier_droits(inter, row):
        return
    with db_connect() as conn:
        c = conn.cursor()
        c.execute("DELETE FROM avant_postes WHERE tribu_id=? AND LOWER(nom)=LOWER(?)", (row["id"], nom_avant_poste))
        if c.rowcount == 0:
            await inter.response.send_message(f"❌ Aucun avant-poste trouvé avec le nom **{nom_avant_poste}**.", ephemeral=True)
            return
        conn.commit()
    
    await afficher_fiche_mise_a_jour(inter, row["id"], f"✅ **Avant-poste {nom_avant_poste} retiré de {row['nom']} !**")

@tribu.command(name="transférer", description="Transférer la propriété d'une tribu")
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

@tribu.command(name="supprimer", description="Supprimer une tribu (confirmation requise)")
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

# ---- Commandes Admin (maps) ----
class GroupeMap(app_commands.Group):
    def __init__(self):
        super().__init__(name="map", description="Gérer les maps disponibles (Admin uniquement)")

map_group = GroupeMap()
tree.add_command(map_group)

@map_group.command(name="ajouter", description="[ADMIN] Ajouter une map à la liste")
@app_commands.describe(nom="Nom de la map à ajouter")
async def map_ajouter(inter: discord.Interaction, nom: str):
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

@map_group.command(name="supprimer", description="[ADMIN] Supprimer une map de la liste")
@app_commands.describe(nom="Nom de la map à supprimer")
async def map_supprimer(inter: discord.Interaction, nom: str):
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

@map_group.command(name="lister", description="[ADMIN] Lister toutes les maps disponibles")
async def map_lister(inter: discord.Interaction):
    if not est_admin(inter):
        await inter.response.send_message("❌ Cette commande est réservée aux administrateurs.", ephemeral=True)
        return
    db_init()
    with db_connect() as conn:
        c = conn.cursor()
        c.execute("SELECT nom FROM maps WHERE guild_id IN (0, ?) ORDER BY guild_id, nom", (inter.guild_id,))
        maps = c.fetchall()
    
    if not maps:
        await inter.response.send_message("Aucune map disponible.", ephemeral=True)
        return
    
    e = discord.Embed(title="🗺️ Maps disponibles", color=0x5865F2)
    maps_list = "\n".join([f"• {m['nom']}" for m in maps])
    e.add_field(name="Liste", value=maps_list, inline=False)
    e.set_footer(text="Utilisez /map ajouter et /map supprimer pour gérer les maps")
    await inter.response.send_message(embed=e, ephemeral=True)

@tree.command(name="tribu_test", description="Vérifier si le bot répond")
async def tribu_test(inter: discord.Interaction):
    await inter.response.send_message("🏓 Pong !")

@tree.command(name="aide", description="Afficher la liste des commandes du bot")
async def aide(inter: discord.Interaction):
    e = discord.Embed(
        title="❓ Aide — Commandes disponibles",
        description="Commandes rapides pour gérer les fiches tribu :",
        color=0x5865F2
    )
    lignes = [
        "• **/tribu créer** — créer une tribu (map à sélectionner)",
        "• **/tribu voir** — afficher une fiche tribu complète",
        "• **/tribu lister** — lister toutes les tribus du serveur",
        "• **/tribu modifier** — éditer les infos (description, couleur, logo...)",
        "• **/tribu ajouter_membre** — ajouter un membre à ta tribu",
        "• **/tribu retirer_membre** — retirer un membre de la tribu",
        "• **/tribu ajouter_avant_poste** — ajouter ton avant-poste (map à sélectionner)",
        "• **/tribu retirer_avant_poste** — retirer un avant-poste",
        "• **/tribu transférer** — transférer la propriété",
        "• **/tribu supprimer** — supprimer une tribu (avec confirmation)",
        "• **/panneau** — ouvre les boutons (Créer / Modifier / Liste / Voir)",
        "",
        "**Commandes Admin :**",
        "• **/map ajouter** — ajouter une map personnalisée",
        "• **/map supprimer** — supprimer une map",
        "• **/map lister** — voir toutes les maps disponibles"
    ]
    e.add_field(name="Résumé", value="\n".join(lignes), inline=False)
    e.set_footer(text="💡 Les maps ont des menus déroulants pour faciliter la sélection")
    await inter.response.send_message(embed=e, ephemeral=True)

# ---------- UI (boutons + modals) ----------
class ModalCreerTribu(discord.ui.Modal, title="Créer une tribu"):
    nom = discord.ui.TextInput(label="Nom de la tribu", placeholder="Ex: Les Spinos", max_length=64, required=True)
    map_base = discord.ui.TextInput(label="🗺️ Map de la base principale", placeholder="Ex: TheIsland, Ragnarok...", max_length=50, required=True)
    coords_base = discord.ui.TextInput(label="📍 Coordonnées de la base", placeholder="Ex: 45.5, 32.6", max_length=50, required=True)

    async def on_submit(self, inter: discord.Interaction):
        db_init()
        if tribu_par_nom(inter.guild_id, str(self.nom)):
            await inter.response.send_message("❌ Ce nom de tribu est déjà pris.", ephemeral=True)
            return
        with db_connect() as conn:
            c = conn.cursor()
            c.execute("""
                INSERT INTO tribus (guild_id, nom, description, base, map_base, coords_base, proprietaire_id, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                inter.guild_id, 
                str(self.nom).strip(), 
                "",  # description vide par défaut
                "Base Principale",  # nom de base par défaut
                str(self.map_base).strip(),
                str(self.coords_base).strip(),
                inter.user.id, 
                dt.datetime.utcnow().isoformat()
            ))
            tid = c.lastrowid
            c.execute("INSERT OR REPLACE INTO membres (tribu_id, user_id, role, manager) VALUES (?, ?, ?, 1)",
                      (tid, inter.user.id, "Chef",))
            conn.commit()
            c.execute("SELECT * FROM tribus WHERE id=?", (tid,))
            row = c.fetchone()
        
        # Afficher la fiche et sauvegarder le message_id
        embed = embed_tribu(row)
        embed.set_footer(text="ℹ️ Ajoutez des membres avec /tribu ajouter_membre et des avant-postes avec /tribu ajouter_avant_poste")
        await inter.response.send_message("✅ **Tribu créée !**", embed=embed, ephemeral=False)
        msg = await inter.original_response()
        
        # Sauvegarder le message_id et channel_id
        with db_connect() as conn:
            c = conn.cursor()
            c.execute("UPDATE tribus SET message_id=?, channel_id=? WHERE id=?", 
                     (msg.id, msg.channel.id, tid))
            conn.commit()

class ModalModifierTribu(discord.ui.Modal, title="Modifier une tribu"):
    nom = discord.ui.TextInput(label="Nom de la tribu à modifier")
    nouveau_nom = discord.ui.TextInput(label="Nouveau nom (optionnel)", required=False)
    description = discord.ui.TextInput(label="Description (optionnel)", style=discord.TextStyle.paragraph, required=False)
    couleur_hex = discord.ui.TextInput(label="Couleur hex (ex: #00AAFF)", required=False)
    logo_url = discord.ui.TextInput(label="Logo URL (optionnel)", required=False, placeholder="https://...")

    async def on_submit(self, inter: discord.Interaction):
        db_init()
        row = tribu_par_nom(inter.guild_id, str(self.nom))
        if not row:
            await inter.response.send_message("❌ Aucune tribu trouvée avec ce nom.", ephemeral=True)
            return
        if not (est_admin(inter) or inter.user.id == row["proprietaire_id"] or est_manager(row["id"], inter.user.id)):
            await inter.response.send_message("❌ Tu n'as pas la permission de modifier cette tribu.", ephemeral=True)
            return
        updates = {}
        if str(self.nouveau_nom).strip():
            updates["nom"] = str(self.nouveau_nom).strip()
        if self.description is not None:
            updates["description"] = str(self.description).strip()
        if str(self.couleur_hex).strip():
            try:
                updates["couleur"] = int(str(self.couleur_hex).replace("#",""), 16)
            except ValueError:
                await inter.response.send_message("❌ Couleur invalide. Utilise un hex, ex: #00AAFF", ephemeral=True)
                return
        if str(self.logo_url).strip():
            updates["logo_url"] = str(self.logo_url).strip()
        with db_connect() as conn:
            c = conn.cursor()
            if "nom" in updates:
                c.execute("SELECT 1 FROM tribus WHERE guild_id=? AND LOWER(nom)=LOWER(?) AND id<>?",
                          (inter.guild_id, updates["nom"], row["id"]))
                if c.fetchone():
                    await inter.response.send_message("❌ Ce nouveau nom est déjà utilisé.", ephemeral=True)
                    return
            if updates:
                set_clause = ", ".join(f"{k}=?" for k in updates.keys())
                c.execute(f"UPDATE tribus SET {set_clause} WHERE id=?", (*updates.values(), row["id"]))
                conn.commit()
        
        if updates:
            await afficher_fiche_mise_a_jour(inter, row["id"], "✅ **Fiche mise à jour !**", ephemeral=False)
        else:
            await inter.response.send_message("ℹ️ Aucun changement détecté.", ephemeral=True)

class ModalVoirTribu(discord.ui.Modal, title="Voir une tribu"):
    nom = discord.ui.TextInput(label="Nom de la tribu")

    async def on_submit(self, inter: discord.Interaction):
        db_init()
        row = tribu_par_nom(inter.guild_id, str(self.nom))
        if not row:
            await inter.response.send_message("❌ Aucune tribu trouvée avec ce nom.", ephemeral=True)
            return
        with db_connect() as conn:
            c = conn.cursor()
            c.execute("SELECT * FROM membres WHERE tribu_id=? ORDER BY manager DESC, user_id ASC", (row["id"],))
            membres = c.fetchall()
            c.execute("SELECT * FROM avant_postes WHERE tribu_id=? ORDER BY created_at DESC", (row["id"],))
            avant_postes = c.fetchall()
        await inter.response.send_message(embed=embed_tribu(row, membres, avant_postes), ephemeral=False)

class PanneauTribu(discord.ui.View):
    def __init__(self, timeout: Optional[float] = 180):
        super().__init__(timeout=timeout)

    @discord.ui.button(label="Créer", style=discord.ButtonStyle.success, emoji="➕")
    async def btn_creer(self, inter: discord.Interaction, button: discord.ui.Button):
        await inter.response.send_modal(ModalCreerTribu())

    @discord.ui.button(label="Modifier", style=discord.ButtonStyle.primary, emoji="🛠️")
    async def btn_modifier(self, inter: discord.Interaction, button: discord.ui.Button):
        await inter.response.send_modal(ModalModifierTribu())

    @discord.ui.button(label="Liste", style=discord.ButtonStyle.secondary, emoji="📜")
    async def btn_liste(self, inter: discord.Interaction, button: discord.ui.Button):
        db_init()
        with db_connect() as conn:
            c = conn.cursor()
            c.execute("SELECT nom, proprietaire_id FROM tribus WHERE guild_id=? ORDER BY LOWER(nom) ASC", (inter.guild_id,))
            rows = c.fetchall()
        if not rows:
            await inter.response.send_message("Aucune tribu pour l'instant. Utilise le bouton **Créer**.", ephemeral=True)
            return
        texte = "\n".join(f"• **{r['nom']}** — proprio : <@{r['proprietaire_id']}>"
                          for r in rows)
        await inter.response.send_message(texte, ephemeral=True)

    @discord.ui.button(label="Voir", style=discord.ButtonStyle.secondary, emoji="👀")
    async def btn_voir(self, inter: discord.Interaction, button: discord.ui.Button):
        await inter.response.send_modal(ModalVoirTribu())

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
