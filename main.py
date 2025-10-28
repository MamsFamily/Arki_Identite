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
from threading import Thread

import discord
from discord import app_commands
from discord.ext import commands
from flask import Flask

# ---------- Keep-alive HTTP (pour Replit) ----------
app = Flask(__name__)

@app.route("/")
def home():
    return "✅ Bot Discord en ligne"

def keep_alive():
    """Lance un mini serveur web pour maintenir le bot actif sur Replit"""
    def run():
        port = int(os.getenv("PORT", "8080"))
        app.run(host="0.0.0.0", port=port, debug=False)
    
    t = Thread(target=run, daemon=True)
    t.start()

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
            c.execute("ALTER TABLE tribus ADD COLUMN progression_boss_non_valides TEXT DEFAULT ''")
        except sqlite3.OperationalError:
            pass
        try:
            c.execute("ALTER TABLE tribus ADD COLUMN progression_notes_non_valides TEXT DEFAULT ''")
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
        
        # Table de configuration
        c.execute("""
        CREATE TABLE IF NOT EXISTS config (
            guild_id INTEGER NOT NULL,
            cle TEXT NOT NULL,
            valeur TEXT DEFAULT '',
            PRIMARY KEY (guild_id, cle)
        )
        """)
        
        # Initialiser la bannière par défaut si elle n'existe pas
        c.execute("""
        INSERT OR IGNORE INTO config (guild_id, cle, valeur)
        VALUES (0, 'banniere_panneau', 'https://i.postimg.cc/8c6gy1qK/AB2723-D2-B10-F-40-F7-A124-1-D6-F30510096.jpg')
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
        
        # Table pour les photos de la galerie (jusqu'à 10 photos par tribu)
        c.execute("""
        CREATE TABLE IF NOT EXISTS photos_tribu (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tribu_id INTEGER NOT NULL,
            url TEXT NOT NULL,
            ordre INTEGER DEFAULT 0,
            created_at TEXT NOT NULL,
            FOREIGN KEY (tribu_id) REFERENCES tribus(id) ON DELETE CASCADE
        )
        """)
        
        # Migrer les photos existantes depuis photo_base vers la nouvelle table
        c.execute("SELECT id, photo_base FROM tribus WHERE photo_base IS NOT NULL AND photo_base != ''")
        tribus_avec_photo = c.fetchall()
        for tribu in tribus_avec_photo:
            # Vérifier si la photo n'existe pas déjà dans la nouvelle table
            c.execute("SELECT COUNT(*) as count FROM photos_tribu WHERE tribu_id=?", (tribu["id"],))
            if c.fetchone()["count"] == 0:
                c.execute("""
                INSERT INTO photos_tribu (tribu_id, url, ordre, created_at)
                VALUES (?, ?, 0, ?)
                """, (tribu["id"], tribu["photo_base"], dt.datetime.utcnow().isoformat()))
        
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

def get_config(guild_id: int, cle: str, defaut: str = "") -> str:
    """Récupère une valeur de configuration"""
    with db_connect() as conn:
        c = conn.cursor()
        c.execute("SELECT valeur FROM config WHERE guild_id=? AND cle=?", (guild_id, cle))
        row = c.fetchone()
        if row:
            return row["valeur"]
        # Essayer avec guild_id=0 (config globale)
        c.execute("SELECT valeur FROM config WHERE guild_id=0 AND cle=?", (cle,))
        row = c.fetchone()
        return row["valeur"] if row else defaut

def set_config(guild_id: int, cle: str, valeur: str):
    """Définit une valeur de configuration"""
    with db_connect() as conn:
        c = conn.cursor()
        c.execute("""
            INSERT OR REPLACE INTO config (guild_id, cle, valeur)
            VALUES (?, ?, ?)
        """, (guild_id, cle, valeur))
        conn.commit()

# ---------- Bot ----------
intents = discord.Intents.default()
intents.guilds = True
intents.members = True

bot = commands.Bot(command_prefix="!", intents=intents)
tree = bot.tree

# ---------- Helpers UI ----------
def embed_tribu(tribu, membres=None, avant_postes=None, createur_avatar_url=None, photos=None, photo_index=0) -> discord.Embed:
    color = tribu["couleur"] if tribu["couleur"] else 0x2F3136
    
    # Titre et description
    titre = f"🏕️ Tribu — {tribu['nom']}"
    desc_parts = []
    if tribu["description"]:
        desc_parts.append(tribu["description"])
    if "devise" in tribu.keys() and tribu["devise"]:
        desc_parts.append(f"<a:Announcements:1328165705069236308> Devise : *« {tribu['devise']} »*")
    description = "\n".join(desc_parts) if desc_parts else "—"
    
    e = discord.Embed(
        title=titre,
        description=description,
        color=color,
        timestamp=dt.datetime.utcnow()
    )
    
    # Logo en haut à droite (thumbnail) - Si pas de logo, afficher l'avatar du créateur
    if tribu["logo_url"]:
        e.set_thumbnail(url=tribu["logo_url"])
    elif createur_avatar_url:
        # Afficher la photo du créateur si pas de logo
        e.set_thumbnail(url=createur_avatar_url)
    
    # Galerie photo - Afficher la photo sélectionnée
    if photos and len(photos) > 0:
        # S'assurer que l'index est valide
        if 0 <= photo_index < len(photos):
            photo_url = photos[photo_index]['url']
            e.set_image(url=photo_url)
            # Ajouter un footer pour indiquer la position dans la galerie
            if len(photos) > 1:
                footer_text = f"📸 Photo {photo_index + 1}/{len(photos)}"
                if e.footer:
                    footer_text = f"{e.footer.text} • {footer_text}"
                e.set_footer(text=footer_text)
    elif "photo_base" in tribu.keys() and tribu["photo_base"]:
        # Fallback sur l'ancienne photo_base si pas de galerie
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
            e.add_field(name=f"**👥 MEMBRES ({len(lines)})**", value="\n".join(lines)[:1024], inline=False)
    
    # Base principale
    map_base = tribu["map_base"] if "map_base" in tribu.keys() and tribu["map_base"] else ""
    coords_base = tribu["coords_base"] if "coords_base" in tribu.keys() and tribu["coords_base"] else ""
    base_info = []
    if map_base:
        base_info.append(f"**{map_base}**")
    if coords_base:
        base_info.append(f"📍 **{coords_base}**")
    base_value = "\n".join(base_info) if base_info else "—"
    e.add_field(name="**🏠 BASE PRINCIPALE**", value=base_value, inline=False)
    
    # Avant-postes (liste simple avec tiret) - DÉPLACÉ ICI après BASE PRINCIPALE
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
            e.add_field(name=f"**⛺ AVANT-POSTES ({len(ap_lines)})**", value="\n".join(ap_lines)[:1024], inline=False)
    
    # Objectif
    if "objectif" in tribu.keys() and tribu["objectif"]:
        e.add_field(name="**🎯 OBJECTIF**", value=tribu["objectif"], inline=False)
    
    # Ouvert au recrutement
    if "recrutement" in tribu.keys() and tribu["recrutement"]:
        e.add_field(name="**📢 RECRUTEMENT OUVERT**", value=tribu["recrutement"], inline=False)
    
    # Progression Boss
    boss_valides = []
    boss_non_valides = []
    if "progression_boss" in tribu.keys() and tribu["progression_boss"]:
        boss_valides = [f"<a:ok:1328152449785008189> {b.strip()}" for b in tribu["progression_boss"].split(",") if b.strip()]
    if "progression_boss_non_valides" in tribu.keys() and tribu["progression_boss_non_valides"]:
        boss_non_valides = [f"<a:no:1328152539660554363> {b.strip()}" for b in tribu["progression_boss_non_valides"].split(",") if b.strip()]
    
    if boss_valides or boss_non_valides:
        boss_display = ", ".join(boss_valides + boss_non_valides)
        e.add_field(name="**🐉 PROGRESSION BOSS**", value=boss_display[:1024], inline=False)
    
    # Progression Notes
    notes_valides = []
    notes_non_valides = []
    if "progression_notes" in tribu.keys() and tribu["progression_notes"]:
        notes_valides = [f"<a:ok:1328152449785008189> {n.strip()}" for n in tribu["progression_notes"].split(",") if n.strip()]
    if "progression_notes_non_valides" in tribu.keys() and tribu["progression_notes_non_valides"]:
        notes_non_valides = [f"<a:no:1328152539660554363> {n.strip()}" for n in tribu["progression_notes_non_valides"].split(",") if n.strip()]
    
    if notes_valides or notes_non_valides:
        notes_display = ", ".join(notes_valides + notes_non_valides)
        e.add_field(name="**📝 PROGRESSION NOTES**", value=notes_display[:1024], inline=False)

    e.set_footer(text="💡 Utilise les boutons ci-dessous pour gérer la tribu")
    return e

# ---------- Vue pour l'historique paginé ----------
class HistoriqueView(discord.ui.View):
    def __init__(self, tribu_id: int, tribu_nom: str, offset: int = 0):
        super().__init__(timeout=180)  # 3 minutes
        self.tribu_id = tribu_id
        self.tribu_nom = tribu_nom
        self.offset = offset
        self.page_size = 10
        self.total_entries = 0
    
    async def create_embed(self):
        """Crée l'embed de l'historique pour la page actuelle"""
        with db_connect() as conn:
            c = conn.cursor()
            # Compter le total d'entrées
            c.execute("SELECT COUNT(*) as total FROM historique WHERE tribu_id=?", (self.tribu_id,))
            self.total_entries = c.fetchone()["total"]
            
            if self.total_entries == 0:
                return None
            
            # Récupérer les entrées pour cette page
            c.execute("""
                SELECT user_id, action, details, created_at 
                FROM historique 
                WHERE tribu_id=? 
                ORDER BY created_at DESC 
                LIMIT ? OFFSET ?
            """, (self.tribu_id, self.page_size, self.offset))
            historique = c.fetchall()
        
        if not historique:
            return None
        
        # Créer l'embed
        e = discord.Embed(
            title=f"📜 Historique — {self.tribu_nom}",
            color=0x5865F2,
            timestamp=dt.datetime.utcnow()
        )
        
        lines = []
        for h in historique:
            date = dt.datetime.fromisoformat(h["created_at"]).strftime("%d/%m/%y %H:%M")
            lines.append(f"**{date}** — <@{h['user_id']}>\n  ↳ {h['action']}")
            if h["details"]:
                lines.append(f"  _{h['details']}_")
        
        e.description = "\n".join(lines)
        
        # Footer avec info de pagination
        page_actuelle = (self.offset // self.page_size) + 1
        total_pages = (self.total_entries + self.page_size - 1) // self.page_size
        entries_debut = self.offset + 1
        entries_fin = min(self.offset + self.page_size, self.total_entries)
        e.set_footer(text=f"Entrées {entries_debut}-{entries_fin} sur {self.total_entries} • Page {page_actuelle}/{total_pages}")
        
        # Activer/désactiver le bouton "Voir +" selon s'il reste des entrées
        has_more = (self.offset + self.page_size) < self.total_entries
        
        # Chercher et mettre à jour le bouton dans les enfants de la vue
        for child in self.children:
            if isinstance(child, discord.ui.Button):
                if "Voir" in str(child.label) or child.custom_id == "voir_plus_btn":
                    child.disabled = not has_more
                    break
        
        return e
    
    @discord.ui.button(label="Voir +", style=discord.ButtonStyle.primary, emoji="📖")
    async def voir_plus_btn(self, inter: discord.Interaction, button: discord.ui.Button):
        # Charger la page suivante
        self.offset += self.page_size
        embed = await self.create_embed()
        
        if embed:
            await inter.response.edit_message(embed=embed, view=self)
        else:
            await inter.response.send_message("📜 Fin de l'historique atteint.", ephemeral=True)

# ---------- Panneau Membre pour afficher les commandes utiles ----------
class ModalAjouterPhoto(discord.ui.Modal, title="📸 Ajouter une photo"):
    url_photo = discord.ui.TextInput(
        label="URL de la photo",
        placeholder="https://... (postimages.org recommandé)",
        required=True,
        style=discord.TextStyle.short
    )
    
    def __init__(self, tribu_id: int, tribu_nom: str):
        super().__init__()
        self.tribu_id = tribu_id
        self.tribu_nom = tribu_nom
    
    async def on_submit(self, inter: discord.Interaction):
        db_init()
        
        # Vérifier les droits
        with db_connect() as conn:
            c = conn.cursor()
            c.execute("SELECT * FROM tribus WHERE id=?", (self.tribu_id,))
            row = c.fetchone()
            
            if not row:
                await inter.response.send_message("❌ Tribu introuvable.", ephemeral=True)
                return
            
            # Vérifier les permissions
            if not (est_admin(inter) or inter.user.id == row["proprietaire_id"] or est_manager(self.tribu_id, inter.user.id)):
                await inter.response.send_message("❌ Tu n'as pas la permission de modifier cette tribu.", ephemeral=True)
                return
            
            # Vérifier le nombre de photos (max 10)
            c.execute("SELECT COUNT(*) as count FROM photos_tribu WHERE tribu_id=?", (self.tribu_id,))
            count = c.fetchone()["count"]
            
            if count >= 10:
                await inter.response.send_message("❌ Cette tribu a déjà 10 photos. Supprime-en une avant d'en ajouter une nouvelle.", ephemeral=True)
                return
            
            # Calculer le prochain ordre
            c.execute("SELECT COALESCE(MAX(ordre), -1) as max_ordre FROM photos_tribu WHERE tribu_id=?", (self.tribu_id,))
            max_ordre = c.fetchone()["max_ordre"]
            nouvel_ordre = max_ordre + 1
            
            # Ajouter la photo
            c.execute("""
            INSERT INTO photos_tribu (tribu_id, url, ordre, created_at)
            VALUES (?, ?, ?, ?)
            """, (self.tribu_id, self.url_photo.value.strip(), nouvel_ordre, dt.datetime.utcnow().isoformat()))
            conn.commit()
        
        ajouter_historique(self.tribu_id, inter.user.id, "Photo ajoutée", f"Photo #{nouvel_ordre + 1} ajoutée à la galerie")
        await afficher_fiche_mise_a_jour(inter, self.tribu_id, f"✅ **Photo #{nouvel_ordre + 1} ajoutée à {self.tribu_nom} !** ({count + 1}/10)\n🔗 depuis une URL", ephemeral=False)

class ConfirmationSupprimerPhoto(discord.ui.View):
    """Vue de confirmation pour la suppression de photo"""
    def __init__(self, tribu_id: int, tribu_nom: str, photo_id: int, photo_url: str, photo_numero: int):
        super().__init__(timeout=60)
        self.tribu_id = tribu_id
        self.tribu_nom = tribu_nom
        self.photo_id = photo_id
        self.photo_url = photo_url
        self.photo_numero = photo_numero
    
    @discord.ui.button(label="Confirmer la suppression", style=discord.ButtonStyle.danger, emoji="✅")
    async def confirmer(self, inter: discord.Interaction, button: discord.ui.Button):
        with db_connect() as conn:
            c = conn.cursor()
            # Supprimer la photo
            c.execute("DELETE FROM photos_tribu WHERE id=?", (self.photo_id,))
            
            # Réorganiser les ordres
            c.execute("SELECT id FROM photos_tribu WHERE tribu_id=? ORDER BY ordre", (self.tribu_id,))
            photos_restantes = c.fetchall()
            for i, p in enumerate(photos_restantes):
                c.execute("UPDATE photos_tribu SET ordre=? WHERE id=?", (i, p["id"]))
            
            conn.commit()
            count_restant = len(photos_restantes)
        
        ajouter_historique(self.tribu_id, inter.user.id, "Photo supprimée", f"Photo {self.photo_numero} supprimée de la galerie")
        await afficher_fiche_mise_a_jour(inter, self.tribu_id, f"✅ **Photo {self.photo_numero} supprimée de {self.tribu_nom} !** ({count_restant}/10)", ephemeral=False)
    
    @discord.ui.button(label="Annuler", style=discord.ButtonStyle.secondary, emoji="❌")
    async def annuler(self, inter: discord.Interaction, button: discord.ui.Button):
        await inter.response.edit_message(content="❌ Suppression annulée.", embed=None, view=None)

class SelectSupprimerPhoto(discord.ui.Select):
    def __init__(self, tribu_id: int, tribu_nom: str, photos: list):
        self.tribu_id = tribu_id
        self.tribu_nom = tribu_nom
        self.photos_dict = {photo['id']: photo for photo in photos}  # Stocker les photos
        
        # Créer les options à partir des photos (juste les numéros, SANS #)
        options = []
        for photo in photos:
            numero = photo['ordre'] + 1
            options.append(discord.SelectOption(
                label=f"Photo {numero}",
                description=f"Supprimer la photo {numero}",
                value=str(photo['id']),
                emoji="🗑️"
            ))
        
        super().__init__(
            placeholder="Choisis le numéro de la photo...",
            options=options,
            min_values=1,
            max_values=1
        )
    
    async def callback(self, inter: discord.Interaction):
        photo_id = int(self.values[0])
        
        # Récupérer les infos de la photo
        photo = self.photos_dict.get(photo_id)
        if not photo:
            await inter.response.send_message("❌ Photo introuvable.", ephemeral=True)
            return
        
        photo_numero = photo['ordre'] + 1
        
        # Afficher un embed de confirmation avec la photo
        e = discord.Embed(
            title=f"⚠️ Confirmer la suppression — {self.tribu_nom}",
            description=f"**Es-tu sûr de vouloir supprimer la Photo {photo_numero} ?**\n\nCette action est irréversible.",
            color=0xFF6B6B
        )
        e.set_image(url=photo['url'])
        e.set_footer(text="💡 Clique sur ✅ pour confirmer ou ❌ pour annuler")
        
        # Créer la vue de confirmation
        view = ConfirmationSupprimerPhoto(self.tribu_id, self.tribu_nom, photo_id, photo['url'], photo_numero)
        
        # Modifier le message avec l'embed de confirmation
        await inter.response.edit_message(embed=e, view=view)

class ViewSupprimerPhoto(discord.ui.View):
    def __init__(self, tribu_id: int, tribu_nom: str, photos: list):
        super().__init__(timeout=180)
        self.add_item(SelectSupprimerPhoto(tribu_id, tribu_nom, photos))

class PanneauMembre(discord.ui.View):
    def __init__(self, tribu_nom: str, tribu_id: int = None, timeout: Optional[float] = 180):
        super().__init__(timeout=timeout)
        self.tribu_nom = tribu_nom
        self.tribu_id = tribu_id
    
    @discord.ui.button(label="Changer mon nom in-game", style=discord.ButtonStyle.primary, emoji="✏️", row=0)
    async def btn_nom_ingame(self, inter: discord.Interaction, button: discord.ui.Button):
        # Ouvrir un modal pour changer le nom in-game
        modal = discord.ui.Modal(title="✏️ Modifier mon nom in-game")
        nom_input = discord.ui.TextInput(
            label="Nouveau nom in-game",
            placeholder="Ton nom dans Ark: Survival Ascended",
            required=True,
            max_length=100,
            style=discord.TextStyle.short
        )
        modal.add_item(nom_input)
        
        async def modal_callback(modal_inter: discord.Interaction):
            nouveau_nom = nom_input.value.strip()
            if not nouveau_nom:
                await modal_inter.response.send_message("❌ Le nom ne peut pas être vide.", ephemeral=True)
                return
            
            # Mettre à jour le nom in-game pour toutes les tribus de l'utilisateur
            with db_connect() as conn:
                c = conn.cursor()
                c.execute("UPDATE membres SET nom_in_game=? WHERE user_id=?", (nouveau_nom, modal_inter.user.id))
                affected = c.rowcount
                conn.commit()
            
            if affected > 0:
                await modal_inter.response.send_message(f"✅ Ton nom in-game a été changé en **{nouveau_nom}** pour toutes tes tribus !", ephemeral=True)
            else:
                await modal_inter.response.send_message(f"✅ Ton nom in-game a été défini sur **{nouveau_nom}** !", ephemeral=True)
        
        modal.on_submit = modal_callback
        await inter.response.send_modal(modal)
    
    @discord.ui.button(label="Voir ma fiche tribu", style=discord.ButtonStyle.primary, emoji="📋", row=0)
    async def btn_fiche(self, inter: discord.Interaction, button: discord.ui.Button):
        if not self.tribu_id:
            await inter.response.send_message("❌ Erreur : ID de tribu manquant.", ephemeral=True)
            return
        
        # Afficher directement la fiche de la tribu
        await afficher_fiche(inter, self.tribu_id, ephemeral=False)
    
    @discord.ui.button(label="Changer logo", style=discord.ButtonStyle.primary, emoji="🖼️", row=0)
    async def btn_logo(self, inter: discord.Interaction, button: discord.ui.Button):
        if not self.tribu_id:
            await inter.response.send_message("❌ Erreur : ID de tribu manquant.", ephemeral=True)
            return
        
        # Message explicatif avec instructions claires
        e = discord.Embed(
            title=f"🖼️ Changer le logo de {self.tribu_nom}",
            description="**Pour uploader depuis ton téléphone/PC :**\n"
                        "1️⃣ Tape `/ajouter_logo`\n"
                        "2️⃣ Sélectionne ta tribu\n"
                        "3️⃣ Clique sur l'icône **📎** (à gauche)\n"
                        "4️⃣ Choisis ton image\n"
                        "5️⃣ Envoie !\n\n"
                        "**Ou via URL :**\n"
                        "Remplis simplement le champ `url_logo`",
            color=0x5865F2
        )
        e.set_footer(text="💡 Les boutons Discord ne peuvent pas uploader de fichiers - utilise la commande /ajouter_logo")
        await inter.response.send_message(embed=e, ephemeral=True)
    
    @discord.ui.button(label="Ajouter membre", style=discord.ButtonStyle.success, emoji="👤", row=1)
    async def btn_ajouter_membre(self, inter: discord.Interaction, button: discord.ui.Button):
        if not self.tribu_id:
            await inter.response.send_message("❌ Erreur : ID de tribu manquant.", ephemeral=True)
            return
        
        # Ouvrir un modal pour ajouter un membre
        modal = discord.ui.Modal(title="👤 Ajouter un membre")
        user_input = discord.ui.TextInput(
            label="Membre Discord",
            placeholder="@utilisateur ou ID utilisateur",
            required=True,
            style=discord.TextStyle.short
        )
        nom_ingame_input = discord.ui.TextInput(
            label="Nom in-game (optionnel)",
            placeholder="Son nom dans le jeu",
            required=False,
            max_length=100,
            style=discord.TextStyle.short
        )
        modal.add_item(user_input)
        modal.add_item(nom_ingame_input)
        
        async def modal_callback(modal_inter: discord.Interaction):
            user_str = user_input.value.strip()
            nom_ingame = nom_ingame_input.value.strip() if nom_ingame_input.value else ""
            
            # Extraire l'ID utilisateur
            user_id = None
            if user_str.startswith("<@") and user_str.endswith(">"):
                user_id = int(user_str.strip("<@!>"))
            elif user_str.isdigit():
                user_id = int(user_str)
            else:
                await modal_inter.response.send_message("❌ Format invalide. Mentionne un utilisateur avec @ ou fournis son ID.", ephemeral=True)
                return
            
            # Vérifier les droits
            with db_connect() as conn:
                c = conn.cursor()
                c.execute("SELECT * FROM tribus WHERE id=?", (self.tribu_id,))
                row = c.fetchone()
                
                if not row:
                    await modal_inter.response.send_message("❌ Tribu introuvable.", ephemeral=True)
                    return
                
                if not (est_admin(modal_inter) or modal_inter.user.id == row["proprietaire_id"] or est_manager(self.tribu_id, modal_inter.user.id)):
                    await modal_inter.response.send_message("❌ Tu n'as pas la permission d'ajouter des membres.", ephemeral=True)
                    return
                
                # Vérifier si le membre est déjà dans la tribu
                c.execute("SELECT * FROM membres WHERE tribu_id=? AND user_id=?", (self.tribu_id, user_id))
                if c.fetchone():
                    await modal_inter.response.send_message(f"❌ <@{user_id}> est déjà membre de cette tribu.", ephemeral=True)
                    return
                
                # Ajouter le membre
                c.execute("INSERT INTO membres (tribu_id, user_id, nom_in_game) VALUES (?, ?, ?)", 
                         (self.tribu_id, user_id, nom_ingame))
                conn.commit()
            
            ajouter_historique(self.tribu_id, modal_inter.user.id, "Membre ajouté", f"<@{user_id}> ajouté à la tribu")
            await modal_inter.response.send_message(f"✅ <@{user_id}> a été ajouté à **{self.tribu_nom}** !", ephemeral=True)
        
        modal.on_submit = modal_callback
        await inter.response.send_modal(modal)
    
    @discord.ui.button(label="Supprimer membre", style=discord.ButtonStyle.secondary, emoji="👥", row=1)
    async def btn_supprimer_membre(self, inter: discord.Interaction, button: discord.ui.Button):
        if not self.tribu_id:
            await inter.response.send_message("❌ Erreur : ID de tribu manquant.", ephemeral=True)
            return
        
        # Récupérer les membres de la tribu
        with db_connect() as conn:
            c = conn.cursor()
            c.execute("SELECT * FROM tribus WHERE id=?", (self.tribu_id,))
            row = c.fetchone()
            
            if not row:
                await inter.response.send_message("❌ Tribu introuvable.", ephemeral=True)
                return
            
            c.execute("SELECT user_id, role FROM membres WHERE tribu_id=? AND user_id != ?", 
                     (self.tribu_id, row["proprietaire_id"]))
            membres = c.fetchall()
        
        if not membres:
            await inter.response.send_message("❌ Aucun membre à supprimer (hors référent).", ephemeral=True)
            return
        
        # Créer un menu de sélection
        options = []
        for membre in membres:
            role_display = f" — {membre['role']}" if membre['role'] else ""
            options.append(discord.SelectOption(
                label=f"@{membre['user_id']}",
                description=f"User ID: {membre['user_id']}{role_display}",
                value=str(membre['user_id'])
            ))
        
        select = discord.ui.Select(placeholder="Sélectionne le membre à retirer...", options=options[:25])
        
        async def select_callback(select_inter: discord.Interaction):
            user_id = int(select.values[0])
            
            # Vérifier les droits
            with db_connect() as conn:
                c = conn.cursor()
                c.execute("SELECT * FROM tribus WHERE id=?", (self.tribu_id,))
                row = c.fetchone()
                
                if not (est_admin(select_inter) or select_inter.user.id == row["proprietaire_id"] or est_manager(self.tribu_id, select_inter.user.id)):
                    await select_inter.response.send_message("❌ Tu n'as pas la permission de retirer des membres.", ephemeral=True)
                    return
                
                c.execute("DELETE FROM membres WHERE tribu_id=? AND user_id=?", (self.tribu_id, user_id))
                conn.commit()
            
            ajouter_historique(self.tribu_id, select_inter.user.id, "Membre retiré", f"<@{user_id}> retiré de la tribu")
            await select_inter.response.send_message(f"✅ <@{user_id}> a été retiré de **{self.tribu_nom}** !", ephemeral=True)
        
        select.callback = select_callback
        view = discord.ui.View(timeout=180)
        view.add_item(select)
        await inter.response.send_message("👥 Sélectionne le membre à retirer :", view=view, ephemeral=True)
    
    @discord.ui.button(label="Ajouter avant-poste", style=discord.ButtonStyle.success, emoji="🏘️", row=2)
    async def btn_ajouter_ap(self, inter: discord.Interaction, button: discord.ui.Button):
        if not self.tribu_id:
            await inter.response.send_message("❌ Erreur : ID de tribu manquant.", ephemeral=True)
            return
        
        # Récupérer toutes les maps disponibles
        with db_connect() as conn:
            c = conn.cursor()
            c.execute("SELECT DISTINCT nom FROM maps WHERE guild_id IN (0, ?) ORDER BY nom", (inter.guild_id,))
            maps = [row["nom"] for row in c.fetchall()]
        
        if not maps:
            await inter.response.send_message("❌ Aucune map disponible. Contacte un admin pour en ajouter.", ephemeral=True)
            return
        
        # Créer le menu déroulant des maps
        options = []
        for map_nom in maps[:25]:  # Discord limite à 25 options
            options.append(discord.SelectOption(
                label=map_nom,
                value=map_nom,
                emoji="🗺️"
            ))
        
        select = discord.ui.Select(
            placeholder="🗺️ Sélectionne la map de l'avant-poste...",
            options=options
        )
        
        async def select_callback(select_inter: discord.Interaction):
            map_selectionnee = select.values[0]
            
            # Ouvrir un modal pour les coordonnées
            modal = discord.ui.Modal(title=f"🏘️ Avant-poste sur {map_selectionnee}")
            coords_input = discord.ui.TextInput(
                label="Coordonnées",
                placeholder="Ex: 45.5, 32.6",
                required=True,
                max_length=100,
                style=discord.TextStyle.short
            )
            modal.add_item(coords_input)
            
            async def modal_callback(modal_inter: discord.Interaction):
                coords = coords_input.value.strip()
                
                # Vérifier les droits
                with db_connect() as conn:
                    c = conn.cursor()
                    c.execute("SELECT * FROM tribus WHERE id=?", (self.tribu_id,))
                    row = c.fetchone()
                    
                    if not row:
                        await modal_inter.response.send_message("❌ Tribu introuvable.", ephemeral=True)
                        return
                    
                    if not (est_admin(modal_inter) or modal_inter.user.id == row["proprietaire_id"] or est_manager(self.tribu_id, modal_inter.user.id)):
                        await modal_inter.response.send_message("❌ Tu n'as pas la permission d'ajouter des avant-postes.", ephemeral=True)
                        return
                    
                    # Générer un nom automatique
                    c.execute("SELECT COUNT(*) as count FROM avant_postes WHERE tribu_id=?", (self.tribu_id,))
                    count = c.fetchone()["count"]
                    nom_ap = f"Avant-poste {count + 1}"
                    
                    # Ajouter l'avant-poste
                    c.execute("""
                    INSERT INTO avant_postes (tribu_id, user_id, nom, map, coords, created_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """, (self.tribu_id, modal_inter.user.id, nom_ap, map_selectionnee, coords, dt.datetime.utcnow().isoformat()))
                    conn.commit()
                
                ajouter_historique(self.tribu_id, modal_inter.user.id, "Avant-poste ajouté", f"{nom_ap} — {map_selectionnee} | {coords}")
                await afficher_fiche_mise_a_jour(modal_inter, self.tribu_id, f"✅ **{nom_ap} ajouté : {map_selectionnee} !**")
            
            modal.on_submit = modal_callback
            await select_inter.response.send_modal(modal)
        
        select.callback = select_callback
        view = discord.ui.View(timeout=180)
        view.add_item(select)
        
        await inter.response.send_message("🏘️ **Ajouter un avant-poste**\n\nSélectionne d'abord la map :", view=view, ephemeral=True)
    
    @discord.ui.button(label="Supprimer avant-poste", style=discord.ButtonStyle.secondary, emoji="🏚️", row=2)
    async def btn_supprimer_ap(self, inter: discord.Interaction, button: discord.ui.Button):
        if not self.tribu_id:
            await inter.response.send_message("❌ Erreur : ID de tribu manquant.", ephemeral=True)
            return
        
        # Récupérer les avant-postes de la tribu
        with db_connect() as conn:
            c = conn.cursor()
            c.execute("SELECT id, nom, map, coords FROM avant_postes WHERE tribu_id=?", (self.tribu_id,))
            avant_postes = c.fetchall()
        
        if not avant_postes:
            await inter.response.send_message("❌ Aucun avant-poste à supprimer.", ephemeral=True)
            return
        
        # Créer un menu de sélection
        options = []
        for ap in avant_postes:
            desc = f"{ap['map']}"
            if ap['coords']:
                desc += f" ({ap['coords']})"
            options.append(discord.SelectOption(
                label=ap['nom'],
                description=desc,
                value=str(ap['id'])
            ))
        
        select = discord.ui.Select(placeholder="Sélectionne l'avant-poste à retirer...", options=options[:25])
        
        async def select_callback(select_inter: discord.Interaction):
            ap_id = int(select.values[0])
            
            # Vérifier les droits
            with db_connect() as conn:
                c = conn.cursor()
                c.execute("SELECT * FROM tribus WHERE id=?", (self.tribu_id,))
                row = c.fetchone()
                
                if not (est_admin(select_inter) or select_inter.user.id == row["proprietaire_id"] or est_manager(self.tribu_id, select_inter.user.id)):
                    await select_inter.response.send_message("❌ Tu n'as pas la permission de retirer des avant-postes.", ephemeral=True)
                    return
                
                c.execute("SELECT nom FROM avant_postes WHERE id=?", (ap_id,))
                ap = c.fetchone()
                nom_ap = ap["nom"] if ap else "Avant-poste"
                
                c.execute("DELETE FROM avant_postes WHERE id=?", (ap_id,))
                conn.commit()
            
            ajouter_historique(self.tribu_id, select_inter.user.id, "Avant-poste supprimé", nom_ap)
            await select_inter.response.send_message(f"✅ **{nom_ap}** supprimé de **{self.tribu_nom}** !", ephemeral=True)
        
        select.callback = select_callback
        view = discord.ui.View(timeout=180)
        view.add_item(select)
        await inter.response.send_message("🏚️ Sélectionne l'avant-poste à retirer :", view=view, ephemeral=True)
    
    @discord.ui.button(label="Ajouter photo", style=discord.ButtonStyle.success, emoji="📸", row=3)
    async def btn_ajouter_photo(self, inter: discord.Interaction, button: discord.ui.Button):
        if not self.tribu_id:
            await inter.response.send_message("❌ Erreur : ID de tribu manquant.", ephemeral=True)
            return
        
        # Message explicatif avec instructions claires
        e = discord.Embed(
            title=f"📸 Ajouter une photo à {self.tribu_nom}",
            description="**Pour uploader depuis ton téléphone/PC :**\n"
                        "1️⃣ Tape `/ajouter_photo`\n"
                        "2️⃣ Sélectionne ta tribu\n"
                        "3️⃣ Clique sur l'icône **📎** (à gauche)\n"
                        "4️⃣ Choisis ton image\n"
                        "5️⃣ Envoie !\n\n"
                        "**Ou via URL :**\n"
                        "Remplis simplement le champ `url_photo`",
            color=0x5865F2
        )
        e.set_footer(text="💡 Les boutons Discord ne peuvent pas uploader de fichiers - utilise la commande /ajouter_photo")
        await inter.response.send_message(embed=e, ephemeral=True)
    
    @discord.ui.button(label="Supprimer photo", style=discord.ButtonStyle.secondary, emoji="🗑️", row=3)
    async def btn_supprimer_photo(self, inter: discord.Interaction, button: discord.ui.Button):
        if not self.tribu_id:
            await inter.response.send_message("❌ Erreur : ID de tribu manquant.", ephemeral=True)
            return
        
        # Récupérer les photos de la tribu
        with db_connect() as conn:
            c = conn.cursor()
            c.execute("SELECT id, url, ordre FROM photos_tribu WHERE tribu_id=? ORDER BY ordre", (self.tribu_id,))
            photos = c.fetchall()
        
        if not photos:
            await inter.response.send_message("📷 Aucune photo dans la galerie. Utilise le bouton **Ajouter photo** pour en ajouter une.", ephemeral=True)
            return
        
        # Créer la liste des photos pour la description
        photos_liste = []
        for i, photo in enumerate(photos):
            numero = i + 1
            # Tronquer l'URL pour l'affichage
            url_courte = photo['url'][:60] + "..." if len(photo['url']) > 60 else photo['url']
            photos_liste.append(f"**📸 Photo {numero}** — [Voir]({photo['url']})")
        
        photos_texte = "\n".join(photos_liste)
        
        # Créer un embed simple avec la liste des photos
        e = discord.Embed(
            title=f"🗑️ Supprimer une photo — {self.tribu_nom}",
            description=f"**{len(photos)} photo(s) dans la galerie**\n\n{photos_texte}\n\n💡 **Sélectionne le numéro dans le menu ci-dessous**",
            color=0xFF6B6B
        )
        
        # Afficher la première photo comme aperçu
        if photos:
            e.set_thumbnail(url=photos[0]['url'])
        
        # Afficher le menu de sélection
        view = ViewSupprimerPhoto(self.tribu_id, self.tribu_nom, photos)
        await inter.response.send_message(embed=e, view=view, ephemeral=True)
    
    @discord.ui.button(label="Voir toutes les commandes", style=discord.ButtonStyle.secondary, emoji="📖", row=4)
    async def btn_aide(self, inter: discord.Interaction, button: discord.ui.Button):
        # Afficher directement l'embed de la commande /aide
        e = discord.Embed(
            title="❓ Aide — Commandes disponibles",
            description="Voici toutes les commandes pour gérer les fiches tribu :",
            color=0x5865F2
        )
        
        # Gestion des tribus
        e.add_field(
            name="🏕️ Gestion des tribus",
            value=(
                "• **/créer_tribu** — créer une nouvelle tribu\n"
                "• **/fiche_tribu** — afficher une fiche tribu complète\n"
                "• **/modifier_tribu** — éditer les infos de base\n"
                "• **/personnaliser_tribu** — personnaliser ta tribu\n"
                "• **/guide** — afficher le guide\n"
                "• **/quitter_tribu** — quitter ta tribu\n"
                "• **/tribu_transférer** — transférer la propriété\n"
                "• **/tribu_supprimer** — supprimer une tribu"
            ),
            inline=False
        )
        
        # Membres et avant-postes
        e.add_field(
            name="👥 Membres & avant-postes",
            value=(
                "• **/ajouter_membre_tribu** — ajouter un membre\n"
                "• **/supprimer_membre_tribu** — retirer un membre\n"
                "• **/mon_nom_ingame** — modifier ton nom in-game\n"
                "• **/ajouter_avant_poste** — ajouter un avant-poste\n"
                "• **/supprimer_avant_poste** — retirer un avant-poste"
            ),
            inline=False
        )
        
        # Galerie & personnalisation
        e.add_field(
            name="🎨 Galerie & personnalisation",
            value=(
                "• **/ajouter_logo** — changer le logo (fichier ou URL)\n"
                "• **/ajouter_photo** — ajouter une photo (fichier ou URL)\n"
                "• **/supprimer_photo** — retirer une photo"
            ),
            inline=False
        )
        
        # Progression
        e.add_field(
            name="📊 Progression boss & notes",
            value=(
                "• **/boss_validé_tribu** — marquer un boss comme validé\n"
                "• **/boss_non_validé_tribu** — marquer un boss comme non-validé\n"
                "• **/note_validé_tribu** — marquer une note comme validée\n"
                "• **/notes_non_validé_tribu** — marquer une note comme non-validée"
            ),
            inline=False
        )
        
        # Gestion admin
        e.add_field(
            name="🔧 Gestion admin (modos/admins)",
            value=(
                "• **/ajout_boss** — ajouter un boss à la liste\n"
                "• **/retirer_boss** — retirer un boss de la liste\n"
                "• **/ajout_note** — ajouter une note à la liste\n"
                "• **/retirer_note** — retirer une note de la liste\n"
                "• **/ajout_map** — ajouter une map\n"
                "• **/retirer_map** — retirer une map\n"
                "• **/changer_bannière_panneau** — personnaliser la bannière"
            ),
            inline=False
        )
        
        # Utilitaires
        e.add_field(
            name="🛠️ Utilitaires",
            value="• **/test_bot** — vérifier que le bot répond\n• **/panneau** — ouvre le panneau interactif\n• **/aide** — afficher cette aide",
            inline=False
        )
        
        e.set_footer(text="Total : 27 commandes disponibles • Utilise /guide pour les conseils de personnalisation")
        await inter.response.send_message(embed=e, ephemeral=True)
    
    @discord.ui.button(label="Boss validé", style=discord.ButtonStyle.success, emoji="✅", row=4)
    async def btn_boss_valide(self, inter: discord.Interaction, button: discord.ui.Button):
        if not self.tribu_id:
            await inter.response.send_message("❌ Erreur : ID de tribu manquant.", ephemeral=True)
            return
        
        # Récupérer tous les boss disponibles
        with db_connect() as conn:
            c = conn.cursor()
            c.execute("SELECT DISTINCT nom FROM boss WHERE guild_id IN (0, ?) ORDER BY nom", (inter.guild_id,))
            boss_list = [row["nom"] for row in c.fetchall()]
        
        if not boss_list:
            await inter.response.send_message("❌ Aucun boss disponible. Contacte un admin pour en ajouter.", ephemeral=True)
            return
        
        # Créer le menu déroulant des boss
        options = []
        for boss_nom in boss_list[:25]:  # Discord limite à 25 options
            options.append(discord.SelectOption(
                label=boss_nom,
                value=boss_nom,
                emoji="<a:yes:1328152490163601448>"
            ))
        
        select = discord.ui.Select(
            placeholder="<a:yes:1328152490163601448> Sélectionne le boss validé...",
            options=options
        )
        
        async def select_callback(select_inter: discord.Interaction):
            boss_selectionne = select.values[0]
            
            # Vérifier les droits et ajouter le boss validé
            with db_connect() as conn:
                c = conn.cursor()
                c.execute("SELECT * FROM tribus WHERE id=?", (self.tribu_id,))
                row = c.fetchone()
                
                if not row:
                    await select_inter.response.send_message("❌ Tribu introuvable.", ephemeral=True)
                    return
                
                if not (est_admin(select_inter) or select_inter.user.id == row["proprietaire_id"] or est_manager(self.tribu_id, select_inter.user.id)):
                    await select_inter.response.send_message("❌ Tu n'as pas la permission de modifier la progression.", ephemeral=True)
                    return
                
                # Récupérer les deux listes
                boss_valides = [b.strip() for b in (row["progression_boss"] or "").split(",") if b.strip()]
                boss_non_valides = [b.strip() for b in (row["progression_boss_non_valides"] or "").split(",") if b.strip()]
                
                # Vérifier si le boss est déjà validé
                if boss_selectionne in boss_valides:
                    await select_inter.response.send_message(f"ℹ️ Le boss **{boss_selectionne}** est déjà validé pour {row['nom']}.", ephemeral=True)
                    return
                
                # Retirer de la liste non-validés si présent
                if boss_selectionne in boss_non_valides:
                    boss_non_valides.remove(boss_selectionne)
                
                # Ajouter à la liste des validés
                boss_valides.append(boss_selectionne)
                
                c.execute("UPDATE tribus SET progression_boss=?, progression_boss_non_valides=? WHERE id=?", 
                         (", ".join(boss_valides), ", ".join(boss_non_valides), row["id"]))
                conn.commit()
            
            ajouter_historique(self.tribu_id, select_inter.user.id, "Boss validé", boss_selectionne)
            await afficher_fiche_mise_a_jour(select_inter, self.tribu_id, f"✅ **Boss {boss_selectionne} validé pour {row['nom']} !**")
        
        select.callback = select_callback
        view = discord.ui.View(timeout=180)
        view.add_item(select)
        
        await inter.response.send_message("✅ **Marquer un boss comme validé**\n\nSélectionne le boss :", view=view, ephemeral=True)
    
    @discord.ui.button(label="Boss non validé", style=discord.ButtonStyle.danger, emoji="<a:no:1328152539660554363>", row=4)
    async def btn_boss_non_valide(self, inter: discord.Interaction, button: discord.ui.Button):
        if not self.tribu_id:
            await inter.response.send_message("❌ Erreur : ID de tribu manquant.", ephemeral=True)
            return
        
        # Récupérer tous les boss disponibles
        with db_connect() as conn:
            c = conn.cursor()
            c.execute("SELECT DISTINCT nom FROM boss WHERE guild_id IN (0, ?) ORDER BY nom", (inter.guild_id,))
            boss_list = [row["nom"] for row in c.fetchall()]
        
        if not boss_list:
            await inter.response.send_message("❌ Aucun boss disponible. Contacte un admin pour en ajouter.", ephemeral=True)
            return
        
        # Créer le menu déroulant des boss
        options = []
        for boss_nom in boss_list[:25]:  # Discord limite à 25 options
            options.append(discord.SelectOption(
                label=boss_nom,
                value=boss_nom,
                emoji="<a:no:1328152539660554363>"
            ))
        
        select = discord.ui.Select(
            placeholder="<a:no:1328152539660554363> Sélectionne le boss non-validé...",
            options=options
        )
        
        async def select_callback(select_inter: discord.Interaction):
            boss_selectionne = select.values[0]
            
            # Vérifier les droits et ajouter le boss non-validé
            with db_connect() as conn:
                c = conn.cursor()
                c.execute("SELECT * FROM tribus WHERE id=?", (self.tribu_id,))
                row = c.fetchone()
                
                if not row:
                    await select_inter.response.send_message("❌ Tribu introuvable.", ephemeral=True)
                    return
                
                if not (est_admin(select_inter) or select_inter.user.id == row["proprietaire_id"] or est_manager(self.tribu_id, select_inter.user.id)):
                    await select_inter.response.send_message("❌ Tu n'as pas la permission de modifier la progression.", ephemeral=True)
                    return
                
                # Récupérer les deux listes
                boss_valides = [b.strip() for b in (row["progression_boss"] or "").split(",") if b.strip()]
                boss_non_valides = [b.strip() for b in (row["progression_boss_non_valides"] or "").split(",") if b.strip()]
                
                # Vérifier si le boss est déjà non-validé
                if boss_selectionne in boss_non_valides:
                    await select_inter.response.send_message(f"ℹ️ Le boss **{boss_selectionne}** est déjà marqué comme non-validé pour {row['nom']}.", ephemeral=True)
                    return
                
                # Retirer de la liste validés si présent
                if boss_selectionne in boss_valides:
                    boss_valides.remove(boss_selectionne)
                
                # Ajouter à la liste des non-validés
                boss_non_valides.append(boss_selectionne)
                
                c.execute("UPDATE tribus SET progression_boss=?, progression_boss_non_valides=? WHERE id=?", 
                         (", ".join(boss_valides), ", ".join(boss_non_valides), row["id"]))
                conn.commit()
            
            ajouter_historique(self.tribu_id, select_inter.user.id, "Boss non-validé", boss_selectionne)
            await afficher_fiche_mise_a_jour(select_inter, self.tribu_id, f"<a:no:1328152539660554363> **Boss {boss_selectionne} marqué comme non-validé pour {row['nom']} !**")
        
        select.callback = select_callback
        view = discord.ui.View(timeout=180)
        view.add_item(select)
        
        await inter.response.send_message("<a:no:1328152539660554363> **Marquer un boss comme non-validé**\n\nSélectionne le boss :", view=view, ephemeral=True)

# ---------- Panneau Staff pour gérer une tribu spécifique ----------
class PanneauStaff(discord.ui.View):
    def __init__(self, tribu_id: int, tribu_nom: str, timeout: Optional[float] = 180):
        super().__init__(timeout=timeout)
        self.tribu_id = tribu_id
        self.tribu_nom = tribu_nom
    
    @discord.ui.button(label="Modifier", style=discord.ButtonStyle.primary, emoji="🛠️", row=0)
    async def btn_modifier(self, inter: discord.Interaction, button: discord.ui.Button):
        # Pré-remplir le modal avec le nom de la tribu
        modal = ModalModifierTribu()
        # On ne peut pas pré-remplir directement, mais on peut créer un modal spécifique
        await inter.response.send_message(f"ℹ️ Utilise `/modifier_tribu` et sélectionne **{self.tribu_nom}** pour modifier cette tribu.", ephemeral=True)
    
    @discord.ui.button(label="Personnaliser", style=discord.ButtonStyle.primary, emoji="🎨", row=0)
    async def btn_personnaliser(self, inter: discord.Interaction, button: discord.ui.Button):
        await inter.response.send_message(f"ℹ️ Utilise `/personnaliser_tribu` et sélectionne **{self.tribu_nom}** pour personnaliser cette tribu.", ephemeral=True)
    
    @discord.ui.button(label="Ajouter membre", style=discord.ButtonStyle.success, emoji="👤", row=1)
    async def btn_ajouter_membre(self, inter: discord.Interaction, button: discord.ui.Button):
        await inter.response.send_message(f"ℹ️ Utilise `/ajouter_membre_tribu` et sélectionne **{self.tribu_nom}** pour ajouter un membre.", ephemeral=True)
    
    @discord.ui.button(label="Supprimer membre", style=discord.ButtonStyle.secondary, emoji="👥", row=1)
    async def btn_supprimer_membre(self, inter: discord.Interaction, button: discord.ui.Button):
        await inter.response.send_message(f"ℹ️ Utilise `/supprimer_membre_tribu` et sélectionne **{self.tribu_nom}** pour supprimer un membre.", ephemeral=True)
    
    @discord.ui.button(label="Ajouter avant-poste", style=discord.ButtonStyle.success, emoji="🏘️", row=2)
    async def btn_ajouter_ap(self, inter: discord.Interaction, button: discord.ui.Button):
        await inter.response.send_message(f"ℹ️ Utilise `/ajouter_avant_poste` et sélectionne **{self.tribu_nom}** pour ajouter un avant-poste.", ephemeral=True)
    
    @discord.ui.button(label="Supprimer avant-poste", style=discord.ButtonStyle.secondary, emoji="🏚️", row=2)
    async def btn_supprimer_ap(self, inter: discord.Interaction, button: discord.ui.Button):
        await inter.response.send_message(f"ℹ️ Utilise `/supprimer_avant_poste` et sélectionne **{self.tribu_nom}** pour supprimer un avant-poste.", ephemeral=True)
    
    @discord.ui.button(label="Réafficher fiche", style=discord.ButtonStyle.primary, emoji="🔄", row=3)
    async def btn_afficher(self, inter: discord.Interaction, button: discord.ui.Button):
        # Réafficher la fiche de cette tribu
        await inter.response.defer(ephemeral=False)
        await afficher_fiche_mise_a_jour(inter, self.tribu_id, f"📋 **Fiche tribu : {self.tribu_nom}**", ephemeral=False)
    
    @discord.ui.button(label="Supprimer tribu", style=discord.ButtonStyle.danger, emoji="🗑️", row=3)
    async def btn_supprimer(self, inter: discord.Interaction, button: discord.ui.Button):
        await inter.response.send_message(f"⚠️ Utilise `/tribu_supprimer` et confirme avec **{self.tribu_nom}** pour supprimer définitivement cette tribu.", ephemeral=True)

# ---------- Menu déroulant pour la fiche tribu avec galerie photo ----------
class MenuFicheTribu(discord.ui.View):
    def __init__(self, tribu_id: int, photo_index: int = 0, timeout: Optional[float] = None):
        super().__init__(timeout=timeout)
        self.tribu_id = tribu_id
        self.photo_index = photo_index
        
        # Ajouter les boutons de navigation de galerie EN PREMIER (row=0, au-dessus)
        btn_prev = discord.ui.Button(
            emoji="🔙",
            style=discord.ButtonStyle.primary,
            custom_id=f"galerie_prev:{tribu_id}",
            row=0
        )
        btn_prev.callback = self.photo_precedente
        self.add_item(btn_prev)
        
        btn_next = discord.ui.Button(
            emoji="🔜",
            style=discord.ButtonStyle.primary,
            custom_id=f"galerie_next:{tribu_id}",
            row=0
        )
        btn_next.callback = self.photo_suivante
        self.add_item(btn_next)
        
        # Créer dynamiquement le select avec un custom_id incluant le tribu_id (row=1, en dessous)
        select = discord.ui.Select(
            placeholder="Sélectionne une action...",
            custom_id=f"menu_fiche:{tribu_id}",
            options=[
                discord.SelectOption(label="Mes commandes", value="commandes", emoji="💡", description="Aide et commandes utiles"),
                discord.SelectOption(label="Personnaliser", value="personnaliser", emoji="🎨", description="Personnaliser la tribu"),
                discord.SelectOption(label="Guide", value="guide", emoji="📖", description="Consulter le guide"),
                discord.SelectOption(label="Quitter tribu", value="quitter", emoji="🚪", description="Quitter cette tribu"),
                discord.SelectOption(label="Historique", value="historique", emoji="📜", description="Voir l'historique des actions"),
                discord.SelectOption(label="Staff", value="staff", emoji="⚙️", description="Mode staff (admins/modos)")
            ],
            row=1
        )
        select.callback = self.menu_callback
        self.add_item(select)
    
    async def photo_precedente(self, inter: discord.Interaction):
        """Afficher la photo précédente dans la galerie"""
        await self._changer_photo(inter, -1)
    
    async def photo_suivante(self, inter: discord.Interaction):
        """Afficher la photo suivante dans la galerie"""
        await self._changer_photo(inter, 1)
    
    async def _changer_photo(self, inter: discord.Interaction, direction: int):
        """Change la photo affichée (direction: -1 pour précédent, +1 pour suivant)"""
        with db_connect() as conn:
            c = conn.cursor()
            # Récupérer toutes les photos de cette tribu
            c.execute("SELECT id, url, ordre FROM photos_tribu WHERE tribu_id=? ORDER BY ordre", (self.tribu_id,))
            photos = c.fetchall()
            
            if not photos:
                await inter.response.send_message("📷 Aucune photo dans la galerie. Utilise `/ajouter_photo` pour en ajouter.", ephemeral=True)
                return
            
            # Calculer le nouvel index
            nouvel_index = (self.photo_index + direction) % len(photos)
            
            # Récupérer les infos de la tribu et les autres données
            c.execute("SELECT * FROM tribus WHERE id=?", (self.tribu_id,))
            tribu = c.fetchone()
            c.execute("SELECT * FROM membres WHERE tribu_id=? ORDER BY manager DESC, user_id ASC", (self.tribu_id,))
            membres = c.fetchall()
            c.execute("SELECT * FROM avant_postes WHERE tribu_id=? ORDER BY created_at DESC", (self.tribu_id,))
            avant_postes = c.fetchall()
        
        # Récupérer l'avatar du créateur
        createur_avatar_url = None
        try:
            createur = await inter.client.fetch_user(tribu['proprietaire_id'])
            if createur:
                createur_avatar_url = createur.display_avatar.url
        except:
            pass
        
        # Créer le nouvel embed avec la nouvelle photo
        embed = embed_tribu(tribu, membres, avant_postes, createur_avatar_url, photos, nouvel_index)
        
        # Mettre à jour la vue avec le nouvel index
        new_view = MenuFicheTribu(self.tribu_id, nouvel_index, timeout=None)
        
        # Mettre à jour le message
        await inter.response.edit_message(embed=embed, view=new_view)
    
    async def menu_callback(self, inter: discord.Interaction):
        select = [item for item in self.children if isinstance(item, discord.ui.Select)][0]
        choice = select.values[0]
        
        if choice == "commandes":
            await self.action_commandes(inter)
        elif choice == "personnaliser":
            await self.action_personnaliser(inter)
        elif choice == "guide":
            await self.action_guide(inter)
        elif choice == "quitter":
            await self.action_quitter(inter)
        elif choice == "historique":
            await self.action_historique(inter)
        elif choice == "staff":
            await self.action_staff(inter)
    
    async def action_commandes(self, inter: discord.Interaction):
        # Récupérer les infos de la tribu
        with db_connect() as conn:
            c = conn.cursor()
            c.execute("SELECT * FROM tribus WHERE id=?", (self.tribu_id,))
            tribu = c.fetchone()
            if not tribu:
                await inter.response.send_message("❌ Tribu introuvable.", ephemeral=True)
                return
        
        # Afficher le panneau d'aide membre
        view = PanneauMembre(tribu['nom'], self.tribu_id)
        
        e = discord.Embed(
            title=f"💡 Mes Commandes — {tribu['nom']}",
            description="Voici les commandes utiles pour gérer ta tribu.\n\n**Actions disponibles :**\n• Modifier ton nom in-game\n• Afficher ta fiche tribu\n• Gérer membres et avant-postes\n• Consulter l'aide et le guide",
            color=0x5865F2
        )
        e.set_footer(text="💡 Panneau visible uniquement par toi • Utilise les boutons pour plus d'infos")
        
        await inter.response.send_message(embed=e, view=view, ephemeral=True)
    
    async def action_personnaliser(self, inter: discord.Interaction):
        # Vérifier les droits (référent, manager, admin ou modo)
        with db_connect() as conn:
            c = conn.cursor()
            c.execute("SELECT * FROM tribus WHERE id=?", (self.tribu_id,))
            tribu = c.fetchone()
            if not tribu:
                await inter.response.send_message("❌ Tribu introuvable.", ephemeral=True)
                return
            
            # Vérifier les permissions
            has_perm = (est_admin_ou_modo(inter) or 
                       inter.user.id == tribu["proprietaire_id"] or 
                       est_manager(self.tribu_id, inter.user.id))
            
            if not has_perm:
                await inter.response.send_message("❌ Seuls le référent, les managers, admins et modos peuvent personnaliser la tribu.", ephemeral=True)
                return
        
        # Afficher un message avec le lien pour la couleur + bouton pour ouvrir le modal
        e = discord.Embed(
            title="🎨 Personnaliser ta tribu",
            description="**Avant de personnaliser, voici un outil utile :**\n\n"
                        "🎨 **Pour choisir ta couleur :**\n"
                        "👉 [Cliquer ici pour le sélecteur de couleur](https://htmlcolorcodes.com/fr/selecteur-de-couleur/)\n\n"
                        "💡 **Clique ensuite sur le bouton ci-dessous pour ouvrir le formulaire de personnalisation.**",
            color=0x5865F2
        )
        e.set_footer(text="💡 Le sélecteur de couleur t'aidera à trouver le code hexadécimal parfait")
        
        # Créer un bouton pour ouvrir le modal
        view = discord.ui.View(timeout=180)
        btn = discord.ui.Button(label="Ouvrir le formulaire", style=discord.ButtonStyle.primary, emoji="📝")
        
        async def btn_callback(btn_inter: discord.Interaction):
            modal = ModalPersonnaliserTribu()
            await btn_inter.response.send_modal(modal)
        
        btn.callback = btn_callback
        view.add_item(btn)
        
        await inter.response.send_message(embed=e, view=view, ephemeral=True)
    
    async def action_guide(self, inter: discord.Interaction):
        # Afficher le guide
        await afficher_guide(inter)
    
    async def action_quitter(self, inter: discord.Interaction):
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
    
    async def action_historique(self, inter: discord.Interaction):
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
        
        # Créer la vue avec pagination
        view = HistoriqueView(self.tribu_id, tribu['nom'], offset=0)
        
        # Initialiser l'embed ET configurer le bouton
        embed = await view.create_embed()
        
        if embed is None:
            await inter.response.send_message("📜 Aucun historique pour cette tribu.", ephemeral=True)
            return
        
        # Le bouton est maintenant correctement configuré
        await inter.response.send_message(embed=embed, view=view, ephemeral=True)
    
    async def action_staff(self, inter: discord.Interaction):
        # Vérifie si admin ou modo
        if not est_admin_ou_modo(inter):
            await inter.response.send_message("❌ Cette fonction est réservée aux admins et modos.", ephemeral=True)
            return
        
        # Récupérer les infos de la tribu
        with db_connect() as conn:
            c = conn.cursor()
            c.execute("SELECT * FROM tribus WHERE id=?", (self.tribu_id,))
            tribu = c.fetchone()
            if not tribu:
                await inter.response.send_message("❌ Tribu introuvable.", ephemeral=True)
                return
        
        # Afficher le panneau staff
        view = PanneauStaff(self.tribu_id, tribu['nom'])
        
        e = discord.Embed(
            title=f"⚙️ Panneau Staff — {tribu['nom']}",
            description="Utilise les boutons ci-dessous pour gérer cette tribu directement.\n\n**Actions disponibles :**\n• Modifier / Personnaliser\n• Gérer membres et avant-postes\n• Réafficher ou supprimer la tribu",
            color=0xFF6B6B
        )
        e.set_footer(text="🔒 Panneau visible uniquement par toi • Les actions s'appliquent à cette tribu")
        
        await inter.response.send_message(embed=e, view=view, ephemeral=True)

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
        c.execute("SELECT id, url, ordre FROM photos_tribu WHERE tribu_id=? ORDER BY ordre", (tribu_id,))
        photos = c.fetchall()
        
        # Récupérer l'ancien salon et message
        old_message_id = tribu["message_id"] if "message_id" in tribu.keys() else 0
        old_channel_id = tribu["channel_id"] if "channel_id" in tribu.keys() else 0
        
        # Supprimer les anciennes fiches UNIQUEMENT si on affiche dans le MÊME salon
        if old_channel_id and old_channel_id == inter.channel.id:
            # On est dans le même salon, supprimer toutes les fiches de cette tribu
            try:
                async for message in inter.channel.history(limit=50):
                    if message.author.id == inter.client.user.id and message.embeds:
                        # Vérifier si c'est une fiche de cette tribu
                        for embed in message.embeds:
                            if embed.title and f"Tribu — {tribu['nom']}" in embed.title:
                                try:
                                    await message.delete()
                                except:
                                    pass
                                break
            except:
                pass  # Erreur lors de la recherche, on continue quand même
        
        # Si on affiche dans un salon différent, ne rien supprimer (laisser l'ancienne fiche)
        
        # Récupérer l'avatar du créateur
        createur_avatar_url = None
        try:
            createur = await inter.client.fetch_user(tribu['proprietaire_id'])
            if createur:
                createur_avatar_url = createur.display_avatar.url
        except:
            pass
        
        # Envoyer le nouveau message avec la fiche et les boutons
        embed = embed_tribu(tribu, membres, avant_postes, createur_avatar_url, photos, 0)
        view = MenuFicheTribu(tribu_id, 0, timeout=None)
        
        # Répondre à l'interaction (vérifier si déjà différée)
        if inter.response.is_done():
            # L'interaction a déjà été différée ou répondue, utiliser followup
            msg = await inter.followup.send(message_prefix, embed=embed, view=view, ephemeral=ephemeral, wait=True)
        else:
            # Première réponse
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

async def autocomplete_tribus(inter: discord.Interaction, current: str):
    """Autocomplétion pour les noms de tribus"""
    db_init()
    with db_connect() as conn:
        c = conn.cursor()
        c.execute("SELECT nom FROM tribus WHERE guild_id=? ORDER BY LOWER(nom) ASC", (inter.guild_id,))
        tribus = [row["nom"] for row in c.fetchall()]
    
    # Filtrer selon ce que l'utilisateur tape
    if current:
        filtered = [t for t in tribus if current.lower() in t.lower()]
    else:
        filtered = tribus
    
    # Discord limite à 25 choix
    return [app_commands.Choice(name=t, value=t) for t in filtered[:25]]

@tree.command(name="fiche_tribu", description="[ADMIN/MODO] Afficher la fiche d'une tribu")
@app_commands.describe(nom="Nom de la tribu")
@app_commands.autocomplete(nom=autocomplete_tribus)
async def fiche_tribu(inter: discord.Interaction, nom: str):
    if not est_admin_ou_modo(inter):
        await inter.response.send_message("❌ Cette commande est réservée aux admins et modos.", ephemeral=True)
        return
    
    # Defer pour éviter le timeout lors de la suppression des anciennes fiches
    await inter.response.defer(ephemeral=False)
    
    db_init()
    row = tribu_par_nom(inter.guild_id, nom)
    if not row:
        await inter.followup.send("❌ Aucune tribu trouvée avec ce nom.", ephemeral=True)
        return
    
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
    
    # Générer un nom automatique pour l'avant-poste
    with db_connect() as conn:
        c = conn.cursor()
        # Compter les avant-postes existants
        c.execute("SELECT COUNT(*) as count FROM avant_postes WHERE tribu_id=?", (row["id"],))
        count = c.fetchone()["count"]
        nom_avant_poste = f"Avant-poste {count + 1}"
        
        c.execute("""
            INSERT INTO avant_postes (tribu_id, user_id, nom, map, coords, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (row["id"], inter.user.id, nom_avant_poste, map.strip(), coords.strip(), dt.datetime.utcnow().isoformat()))
        conn.commit()
    
    ajouter_historique(row["id"], inter.user.id, "Ajout avant-poste", f"{nom_avant_poste} - {map.strip()} | {coords.strip()}")
    await afficher_fiche_mise_a_jour(inter, row["id"], f"✅ **{nom_avant_poste} ajouté : {map.strip()} !**")

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
    await inter.response.send_message("🐔 Tout roule ma poule")

@tree.command(name="personnaliser_tribu", description="Personnaliser ta tribu (description, devise, logo, couleur)")
async def personnaliser_tribu(inter: discord.Interaction):
    # Afficher un message avec le lien pour la couleur + bouton pour ouvrir le modal
    e = discord.Embed(
        title="🎨 Personnaliser ta tribu",
        description="**Avant de personnaliser, voici un outil utile :**\n\n"
                    "🎨 **Pour choisir ta couleur :**\n"
                    "👉 [Cliquer ici pour le sélecteur de couleur](https://htmlcolorcodes.com/fr/selecteur-de-couleur/)\n\n"
                    "💡 **Clique ensuite sur le bouton ci-dessous pour ouvrir le formulaire de personnalisation.**",
        color=0x5865F2
    )
    e.set_footer(text="💡 Le sélecteur de couleur t'aidera à trouver le code hexadécimal parfait")
    
    # Créer un bouton pour ouvrir le modal
    view = discord.ui.View(timeout=180)
    btn = discord.ui.Button(label="Ouvrir le formulaire", style=discord.ButtonStyle.primary, emoji="📝")
    
    async def btn_callback(btn_inter: discord.Interaction):
        modal = ModalPersonnaliserTribu()
        await btn_inter.response.send_modal(modal)
    
    btn.callback = btn_callback
    view.add_item(btn)
    
    await inter.response.send_message(embed=e, view=view, ephemeral=True)

@tree.command(name="guide", description="Afficher le guide pour personnaliser ta tribu")
async def guide(inter: discord.Interaction):
    await afficher_guide(inter)

@tree.command(name="mon_nom_ingame", description="Ajouter ou modifier ton nom In Game")
@app_commands.describe(nom_ingame="Ton nom dans le jeu (ex: Raptor_Killer42)")
async def mon_nom_ingame(inter: discord.Interaction, nom_ingame: str):
    db_init()
    
    # Trouver les tribus dont l'utilisateur est membre
    with db_connect() as conn:
        c = conn.cursor()
        c.execute("""
            SELECT t.id, t.nom FROM tribus t
            JOIN membres m ON t.id = m.tribu_id
            WHERE t.guild_id = ? AND m.user_id = ?
        """, (inter.guild_id, inter.user.id))
        tribus = c.fetchall()
    
    if not tribus:
        await inter.response.send_message("❌ Tu n'es membre d'aucune tribu.", ephemeral=True)
        return
    
    # Mettre à jour le nom in-game pour toutes les tribus dont l'utilisateur est membre
    nom_ingame_clean = nom_ingame.strip()
    with db_connect() as conn:
        c = conn.cursor()
        for tribu in tribus:
            c.execute("UPDATE membres SET nom_in_game = ? WHERE tribu_id = ? AND user_id = ?",
                     (nom_ingame_clean, tribu["id"], inter.user.id))
        conn.commit()
    
    # Ajouter à l'historique pour chaque tribu
    for tribu in tribus:
        ajouter_historique(tribu["id"], inter.user.id, "Mise à jour nom in-game", f"Nom in-game: {nom_ingame_clean}")
    
    if len(tribus) == 1:
        await inter.response.send_message(f"✅ Ton nom in-game **{nom_ingame_clean}** a été mis à jour dans la tribu **{tribus[0]['nom']}** !", ephemeral=True)
    else:
        noms_tribus = ", ".join([t["nom"] for t in tribus])
        await inter.response.send_message(f"✅ Ton nom in-game **{nom_ingame_clean}** a été mis à jour dans tes tribus : {noms_tribus}", ephemeral=True)

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

@retirer_boss.autocomplete('nom')
async def retirer_boss_autocomplete(inter: discord.Interaction, current: str):
    db_init()
    return get_boss_choices(inter.guild_id)

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

@retirer_note.autocomplete('nom')
async def retirer_note_autocomplete(inter: discord.Interaction, current: str):
    db_init()
    return get_notes_choices(inter.guild_id)

@tree.command(name="changer_bannière_panneau", description="[ADMIN] Modifier la bannière du panneau")
@app_commands.describe(url="URL de la nouvelle bannière (image)")
async def changer_banniere_panneau(inter: discord.Interaction, url: str):
    if not est_admin(inter):
        await inter.response.send_message("❌ Cette commande est réservée aux administrateurs.", ephemeral=True)
        return
    
    db_init()
    
    # Vérifier que c'est une URL valide
    if not url.startswith("http://") and not url.startswith("https://"):
        await inter.response.send_message("❌ L'URL doit commencer par http:// ou https://", ephemeral=True)
        return
    
    # Sauvegarder la nouvelle bannière
    set_config(inter.guild_id, "banniere_panneau", url)
    
    await inter.response.send_message(f"✅ **Bannière du panneau modifiée !**\n\nNouvelle URL : {url}\n\n💡 *Utilise `/panneau` pour voir le résultat.*", ephemeral=True)

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
    
    # Récupérer les deux listes
    boss_valides = [b.strip() for b in (row["progression_boss"] or "").split(",") if b.strip()]
    boss_non_valides = [b.strip() for b in (row["progression_boss_non_valides"] or "").split(",") if b.strip()]
    
    # Vérifier si le boss est déjà validé
    if boss in boss_valides:
        await inter.response.send_message(f"ℹ️ Le boss **{boss}** est déjà validé pour {row['nom']}.", ephemeral=True)
        return
    
    # Retirer de la liste non-validés si présent
    if boss in boss_non_valides:
        boss_non_valides.remove(boss)
    
    # Ajouter à la liste des validés
    boss_valides.append(boss)
    
    with db_connect() as conn:
        c = conn.cursor()
        c.execute("UPDATE tribus SET progression_boss=?, progression_boss_non_valides=? WHERE id=?", 
                 (", ".join(boss_valides), ", ".join(boss_non_valides), row["id"]))
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
    
    # Récupérer les deux listes
    notes_valides = [n.strip() for n in (row["progression_notes"] or "").split(",") if n.strip()]
    notes_non_valides = [n.strip() for n in (row["progression_notes_non_valides"] or "").split(",") if n.strip()]
    
    # Vérifier si la note est déjà validée
    if note in notes_valides:
        await inter.response.send_message(f"ℹ️ La note **{note}** est déjà validée pour {row['nom']}.", ephemeral=True)
        return
    
    # Retirer de la liste non-validés si présent
    if note in notes_non_valides:
        notes_non_valides.remove(note)
    
    # Ajouter à la liste des validés
    notes_valides.append(note)
    
    with db_connect() as conn:
        c = conn.cursor()
        c.execute("UPDATE tribus SET progression_notes=?, progression_notes_non_valides=? WHERE id=?", 
                 (", ".join(notes_valides), ", ".join(notes_non_valides), row["id"]))
        conn.commit()
    
    ajouter_historique(row["id"], inter.user.id, "Note validée", note)
    await afficher_fiche_mise_a_jour(inter, row["id"], f"✅ **Note {note} validée pour {row['nom']} !**")

@note_valide_tribu.autocomplete('note')
async def note_autocomplete(inter: discord.Interaction, current: str):
    db_init()
    return get_notes_choices(inter.guild_id)

@tree.command(name="boss_non_validé_tribu", description="Marquer un boss comme non-validé pour ta tribu")
@app_commands.describe(boss="Boss à marquer comme non-validé")
async def boss_non_valide_tribu(inter: discord.Interaction, boss: str):
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
    
    # Récupérer les deux listes
    boss_valides = [b.strip() for b in (row["progression_boss"] or "").split(",") if b.strip()]
    boss_non_valides = [b.strip() for b in (row["progression_boss_non_valides"] or "").split(",") if b.strip()]
    
    # Vérifier si le boss est déjà non-validé
    if boss in boss_non_valides:
        await inter.response.send_message(f"ℹ️ Le boss **{boss}** est déjà marqué comme non-validé pour {row['nom']}.", ephemeral=True)
        return
    
    # Retirer de la liste validés si présent
    if boss in boss_valides:
        boss_valides.remove(boss)
    
    # Ajouter à la liste des non-validés
    boss_non_valides.append(boss)
    
    with db_connect() as conn:
        c = conn.cursor()
        c.execute("UPDATE tribus SET progression_boss=?, progression_boss_non_valides=? WHERE id=?", 
                 (", ".join(boss_valides), ", ".join(boss_non_valides), row["id"]))
        conn.commit()
    
    ajouter_historique(row["id"], inter.user.id, "Boss non-validé", boss)
    await afficher_fiche_mise_a_jour(inter, row["id"], f"<a:no:1328152539660554363> **Boss {boss} marqué comme non-validé pour {row['nom']} !**")

@boss_non_valide_tribu.autocomplete('boss')
async def boss_non_valide_autocomplete(inter: discord.Interaction, current: str):
    db_init()
    return get_boss_choices(inter.guild_id)

@tree.command(name="notes_non_validé_tribu", description="Marquer une note comme non-validée pour ta tribu")
@app_commands.describe(note="Note à marquer comme non-validée")
async def notes_non_valide_tribu(inter: discord.Interaction, note: str):
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
    
    # Récupérer les deux listes
    notes_valides = [n.strip() for n in (row["progression_notes"] or "").split(",") if n.strip()]
    notes_non_valides = [n.strip() for n in (row["progression_notes_non_valides"] or "").split(",") if n.strip()]
    
    # Vérifier si la note est déjà non-validée
    if note in notes_non_valides:
        await inter.response.send_message(f"ℹ️ La note **{note}** est déjà marquée comme non-validée pour {row['nom']}.", ephemeral=True)
        return
    
    # Retirer de la liste validés si présent
    if note in notes_valides:
        notes_valides.remove(note)
    
    # Ajouter à la liste des non-validés
    notes_non_valides.append(note)
    
    with db_connect() as conn:
        c = conn.cursor()
        c.execute("UPDATE tribus SET progression_notes=?, progression_notes_non_valides=? WHERE id=?", 
                 (", ".join(notes_valides), ", ".join(notes_non_valides), row["id"]))
        conn.commit()
    
    ajouter_historique(row["id"], inter.user.id, "Note non-validée", note)
    await afficher_fiche_mise_a_jour(inter, row["id"], f"<a:no:1328152539660554363> **Note {note} marquée comme non-validée pour {row['nom']} !**")

@notes_non_valide_tribu.autocomplete('note')
async def notes_non_valide_autocomplete(inter: discord.Interaction, current: str):
    db_init()
    return get_notes_choices(inter.guild_id)

@tree.command(name="aide", description="Afficher la liste des commandes du bot")
async def aide(inter: discord.Interaction):
    e = discord.Embed(
        title="❓ Aide — Commandes disponibles",
        description="Voici toutes les commandes pour gérer les fiches tribu :",
        color=0x5865F2
    )
    
    # Gestion des tribus
    e.add_field(
        name="🏕️ Gestion des tribus",
        value=(
            "• **/créer_tribu** — créer une nouvelle tribu\n"
            "• **/fiche_tribu** — afficher une fiche tribu complète\n"
            "• **/modifier_tribu** — éditer les infos de base\n"
            "• **/personnaliser_tribu** — personnaliser ta tribu\n"
            "• **/guide** — afficher le guide\n"
            "• **/quitter_tribu** — quitter ta tribu\n"
            "• **/tribu_transférer** — transférer la propriété\n"
            "• **/tribu_supprimer** — supprimer une tribu"
        ),
        inline=False
    )
    
    # Membres et avant-postes
    e.add_field(
        name="👥 Membres & avant-postes",
        value=(
            "• **/ajouter_membre_tribu** — ajouter un membre\n"
            "• **/supprimer_membre_tribu** — retirer un membre\n"
            "• **/mon_nom_ingame** — modifier ton nom in-game\n"
            "• **/ajouter_avant_poste** — ajouter un avant-poste\n"
            "• **/supprimer_avant_poste** — retirer un avant-poste\n"
            "• **/boss_validé_tribu** — valider un boss\n"
            "• **/boss_non_validé_tribu** — retirer un boss\n"
            "• **/note_validé_tribu** — valider une note\n"
            "• **/notes_non_validé_tribu** — retirer une note\n"
            "• **/ajouter_photo** — ajouter une photo à ta galerie\n"
            "• **/supprimer_photo** — retirer une photo"
        ),
        inline=False
    )
    
    # Interface et Admin
    e.add_field(
        name="🎛️ Interface & Admin",
        value=(
            "• **/panneau** — ouvrir le panneau interactif\n"
            "• **/ajout_map** — ajouter une map (Admin)\n"
            "• **/retirer_map** — supprimer une map (Admin)\n"
            "• **/ajout_boss** — ajouter un boss (Admin)\n"
            "• **/retirer_boss** — supprimer un boss (Admin)\n"
            "• **/ajout_note** — ajouter une note (Admin)\n"
            "• **/retirer_note** — supprimer une note (Admin)\n"
            "• **/changer_bannière_panneau** — changer la bannière (Admin)"
        ),
        inline=False
    )
    
    e.set_footer(text="💡 Utilise /panneau pour un accès rapide aux fonctions principales")
    await inter.response.send_message(embed=e, ephemeral=True)

# ---------- UI (boutons + modals) ----------
class ModalCreerTribu(discord.ui.Modal, title="✨ Créer une tribu"):
    nom = discord.ui.TextInput(label="Nom de la tribu", placeholder="Ex: Les Spinos", required=True)
    nom_ingame = discord.ui.TextInput(label="Ton nom In Game", placeholder="Ex: Raptor_Killer42", required=True)
    map_base = discord.ui.TextInput(label="Base principale - Map", placeholder="Ex: The Island", required=True)
    coords_base = discord.ui.TextInput(label="Base principale - Coordonnées", placeholder="Ex: 45.5, 32.6", required=True)
    description = discord.ui.TextInput(label="Description (optionnel)", placeholder="Une brève description de la tribu", required=False, style=discord.TextStyle.paragraph)

    async def on_submit(self, inter: discord.Interaction):
        # Différer immédiatement pour éviter le timeout (la création prend du temps)
        await inter.response.defer(ephemeral=False)
        
        db_init()
        if tribu_par_nom(inter.guild_id, self.nom.value):
            await inter.followup.send("❌ Ce nom de tribu est déjà pris.", ephemeral=True)
            return
        
        with db_connect() as conn:
            c = conn.cursor()
            c.execute("""
                INSERT INTO tribus (guild_id, nom, map_base, coords_base, description, proprietaire_id, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (inter.guild_id, self.nom.value.strip(), 
                  self.map_base.value.strip(),
                  self.coords_base.value.strip(),
                  self.description.value.strip() if self.description.value else '',
                  inter.user.id, dt.datetime.utcnow().isoformat()))
            tid = c.lastrowid
            
            # Ajouter le créateur comme Référent avec son nom in-game (obligatoire)
            nom_in_game = self.nom_ingame.value.strip()
            c.execute("INSERT INTO membres (tribu_id, user_id, nom_in_game, manager) VALUES (?, ?, ?, 1)",
                      (tid, inter.user.id, nom_in_game))
            
            conn.commit()
        
        ajouter_historique(tid, inter.user.id, "Création tribu", f"Tribu {self.nom.value} créée")
        
        # Note d'information
        note = "ℹ️ **Autres options disponibles** : Utilise les boutons « Modifier », « Personnaliser » et « Guide » pour compléter ta fiche !"
        await afficher_fiche_mise_a_jour(inter, tid, f"✅ **Tribu {self.nom.value} créée !**\n{note}", ephemeral=False)

class ModalModifierTribu(discord.ui.Modal, title="🛠️ Modifier tribu"):
    nom = discord.ui.TextInput(label="Nom de la tribu", required=False)
    map_base = discord.ui.TextInput(label="Base principale - Map", required=False)
    coords_base = discord.ui.TextInput(label="Base principale - Coordonnées", required=False)
    description = discord.ui.TextInput(label="Une petite description", style=discord.TextStyle.paragraph, required=False)
    recrutement = discord.ui.TextInput(label="Recrutement ouvert", required=False, placeholder="Ex: Oui, nous recrutons !")

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
        if str(self.description).strip():
            updates["description"] = str(self.description).strip()
        if str(self.recrutement).strip():
            recrutement_texte = str(self.recrutement).strip()
            if recrutement_texte.lower() in ["oui", "non"]:
                updates["ouvert_recrutement"] = 1 if recrutement_texte.lower() == "oui" else 0
            else:
                updates["ouvert_recrutement"] = recrutement_texte
        
        if updates:
            with db_connect() as conn:
                c = conn.cursor()
                set_clause = ", ".join(f"{k}=?" for k in updates.keys())
                c.execute(f"UPDATE tribus SET {set_clause} WHERE id=?", (*updates.values(), row["id"]))
                conn.commit()
            
            # Ajouter l'historique après avoir fermé la connexion
            ajouter_historique(row["id"], inter.user.id, "Modification", f"Champs modifiés: {', '.join(updates.keys())}")
            await afficher_fiche_mise_a_jour(inter, row["id"], "✅ **Tribu modifiée !**", ephemeral=False)
        else:
            await inter.response.send_message("ℹ️ Aucun changement n'a été effectué.", ephemeral=True)

class ModalPersonnaliserTribu(discord.ui.Modal, title="🎨 Personnaliser tribu"):
    couleur_hex = discord.ui.TextInput(label="Couleur", required=False, placeholder="Ex: #00AAFF")
    logo_url = discord.ui.TextInput(label="Logo", required=False, placeholder="https://...")
    objectif = discord.ui.TextInput(label="Objectif de tribu", required=False, style=discord.TextStyle.paragraph)
    devise = discord.ui.TextInput(label="Devise de tribu", required=False)

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
        if self.couleur_hex.value.strip():
            try:
                updates["couleur"] = int(self.couleur_hex.value.replace("#", ""), 16)
            except ValueError:
                await inter.response.send_message("❌ Couleur invalide.", ephemeral=True)
                return
        if self.logo_url.value.strip():
            updates["logo_url"] = self.logo_url.value.strip()
        if self.objectif.value.strip():
            updates["objectif"] = self.objectif.value.strip()
        if self.devise.value.strip():
            updates["devise"] = self.devise.value.strip()
        
        if updates:
            with db_connect() as conn:
                c = conn.cursor()
                set_clause = ", ".join(f"{k}=?" for k in updates.keys())
                c.execute(f"UPDATE tribus SET {set_clause} WHERE id=?", (*updates.values(), row["id"]))
                conn.commit()
            
            # Ajouter l'historique après avoir fermé la connexion
            ajouter_historique(row["id"], inter.user.id, "Personnalisation", f"Champs: {', '.join(updates.keys())}")
        
        await afficher_fiche_mise_a_jour(inter, row["id"], "✅ **Tribu personnalisée !**", ephemeral=False)

async def afficher_guide(inter: discord.Interaction):
    """Affiche le guide d'information pour personnaliser sa tribu"""
    e = discord.Embed(
        title="📖 Guide — Personnaliser ta tribu",
        description="Voici les informations utiles pour compléter et personnaliser ta fiche tribu :",
        color=0x5865F2
    )
    
    e.add_field(
        name="🎨 Site pour la couleur",
        value="https://htmlcolorcodes.com/fr/selecteur-de-couleur/",
        inline=False
    )
    
    e.add_field(
        name="🖼️ Site pour publier un logo ou une image",
        value="https://postimages.org\n*N'oublie pas de recopier le lien direct pour ajouter une photo ou un logo.*",
        inline=False
    )
    
    e.add_field(
        name="📊 Gérer la progression (Boss & Notes)",
        value=(
            "Utilise ces commandes pour compléter la progression de ta fiche :\n"
            "• `/boss_validé_tribu` — ajouter un boss complété\n"
            "• `/boss_non_validé_tribu` — retirer un boss\n"
            "• `/note_validé_tribu` — ajouter une note complétée\n"
            "• `/notes_non_validé_tribu` — retirer une note"
        ),
        inline=False
    )
    
    e.add_field(
        name="👥 Gérer les membres et avant-postes",
        value="Pour ajouter ou retirer des membres et avant-postes, utilise :\n• `/ajouter_membre_tribu`\n• `/supprimer_membre_tribu`\n• `/ajouter_avant_poste`\n• `/supprimer_avant_poste`",
        inline=False
    )
    
    e.add_field(
        name="📸 Galerie photo (jusqu'à 10 photos)",
        value="Gérer les photos de ta base :\n• `/ajouter_photo` — ajouter une photo à ta galerie\n• `/supprimer_photo` — retirer une photo\n\nNavigue dans la galerie avec les boutons ◀️ ▶️ sous ta fiche tribu !",
        inline=False
    )
    
    e.set_footer(text="💡 Utilise /aide pour voir toutes les commandes disponibles")
    
    await inter.response.send_message(embed=e, ephemeral=True)

# Ancien modal Détailler conservé temporairement pour compatibilité
class ModalDetaillerTribu(discord.ui.Modal, title="📋 Détailler tribu"):
    photo_base = discord.ui.TextInput(label="Photo base (URL)", required=False, placeholder="https://...")
    objectif = discord.ui.TextInput(label="Objectif", required=False)

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
                
                # Message avec info sur la progression
                msg_success = "✅ **Détails ajoutés !**\n\nℹ️ *Pour la progression Boss/Notes, utilise :*\n• `/boss_validé_tribu`\n• `/note_validé_tribu`"
                await afficher_fiche_mise_a_jour(inter, row["id"], msg_success, ephemeral=False)
            else:
                # Si aucune mise à jour, juste afficher la fiche
                await inter.response.send_message("ℹ️ Aucun changement n'a été effectué.", ephemeral=True)
                return

class PanneauTribu(discord.ui.View):
    def __init__(self, timeout: Optional[float] = None):
        super().__init__(timeout=timeout)

    @discord.ui.button(label="Créer", style=discord.ButtonStyle.success, emoji="✨", custom_id="panneau:creer")
    async def btn_creer(self, inter: discord.Interaction, button: discord.ui.Button):
        await inter.response.send_modal(ModalCreerTribu())

    @discord.ui.button(label="Modifier", style=discord.ButtonStyle.primary, emoji="🛠️", custom_id="panneau:modifier")
    async def btn_modifier(self, inter: discord.Interaction, button: discord.ui.Button):
        await inter.response.send_modal(ModalModifierTribu())
    
    @discord.ui.button(label="Personnaliser", style=discord.ButtonStyle.primary, emoji="🎨", custom_id="panneau:personnaliser")
    async def btn_personnaliser(self, inter: discord.Interaction, button: discord.ui.Button):
        # Afficher un message avec le lien pour la couleur + bouton pour ouvrir le modal
        e = discord.Embed(
            title="🎨 Personnaliser ta tribu",
            description="**Avant de personnaliser, voici un outil utile :**\n\n"
                        "🎨 **Pour choisir ta couleur :**\n"
                        "👉 [Cliquer ici pour le sélecteur de couleur](https://htmlcolorcodes.com/fr/selecteur-de-couleur/)\n\n"
                        "💡 **Clique ensuite sur le bouton ci-dessous pour ouvrir le formulaire de personnalisation.**",
            color=0x5865F2
        )
        e.set_footer(text="💡 Le sélecteur de couleur t'aidera à trouver le code hexadécimal parfait")
        
        # Créer un bouton pour ouvrir le modal
        view = discord.ui.View(timeout=180)
        btn = discord.ui.Button(label="Ouvrir le formulaire", style=discord.ButtonStyle.primary, emoji="📝")
        
        async def btn_callback(btn_inter: discord.Interaction):
            modal = ModalPersonnaliserTribu()
            await btn_inter.response.send_modal(modal)
        
        btn.callback = btn_callback
        view.add_item(btn)
        
        await inter.response.send_message(embed=e, view=view, ephemeral=True)
    
    @discord.ui.button(label="Guide", style=discord.ButtonStyle.secondary, emoji="📖", custom_id="panneau:guide")
    async def btn_guide(self, inter: discord.Interaction, button: discord.ui.Button):
        await afficher_guide(inter)

@tree.command(name="ajouter_logo", description="Changer le logo de ta tribu")
@app_commands.describe(
    nom="Nom de la tribu",
    url_logo="URL du logo (optionnel si tu fournis un fichier)",
    fichier="Image à uploader depuis ton téléphone/PC (optionnel si tu fournis une URL)"
)
@app_commands.autocomplete(nom=autocomplete_tribus)
async def ajouter_logo(inter: discord.Interaction, nom: str, url_logo: Optional[str] = None, fichier: Optional[discord.Attachment] = None):
    db_init()
    row = tribu_par_nom(inter.guild_id, nom)
    if not row:
        await inter.response.send_message("❌ Aucune tribu trouvée avec ce nom.", ephemeral=True)
        return
    
    # Vérifier qu'au moins un des deux est fourni
    if not url_logo and not fichier:
        await inter.response.send_message("❌ Tu dois fournir soit une URL, soit un fichier image.", ephemeral=True)
        return
    
    # Si un fichier est fourni, vérifier que c'est une image
    if fichier:
        if not fichier.content_type or not fichier.content_type.startswith("image/"):
            await inter.response.send_message("❌ Le fichier doit être une image (JPG, PNG, GIF, etc.).", ephemeral=True)
            return
        # Utiliser l'URL du fichier uploadé
        logo_url = fichier.url
    else:
        logo_url = url_logo.strip()
    
    # Vérifier les droits
    if not await verifier_droits(inter, row):
        return
    
    # Mettre à jour le logo
    with db_connect() as conn:
        c = conn.cursor()
        c.execute("UPDATE tribus SET logo_url=? WHERE id=?", (logo_url, row["id"]))
        conn.commit()
    
    source = "📱 depuis un fichier" if fichier else "🔗 depuis une URL"
    ajouter_historique(row["id"], inter.user.id, "Logo modifié", f"Logo changé {source}")
    await afficher_fiche_mise_a_jour(inter, row["id"], f"✅ **Logo de {row['nom']} mis à jour !**\n{source}", ephemeral=False)

@tree.command(name="ajouter_photo", description="Ajouter une photo à la galerie de ta tribu (max 10 photos)")
@app_commands.describe(
    nom="Nom de la tribu",
    url_photo="URL de la photo (optionnel si tu fournis un fichier)",
    fichier="Image à uploader depuis ton téléphone/PC (optionnel si tu fournis une URL)"
)
@app_commands.autocomplete(nom=autocomplete_tribus)
async def ajouter_photo(inter: discord.Interaction, nom: str, url_photo: Optional[str] = None, fichier: Optional[discord.Attachment] = None):
    db_init()
    row = tribu_par_nom(inter.guild_id, nom)
    if not row:
        await inter.response.send_message("❌ Aucune tribu trouvée avec ce nom.", ephemeral=True)
        return
    
    # Vérifier qu'au moins un des deux est fourni
    if not url_photo and not fichier:
        await inter.response.send_message("❌ Tu dois fournir soit une URL, soit un fichier image.", ephemeral=True)
        return
    
    # Si un fichier est fourni, vérifier que c'est une image
    if fichier:
        if not fichier.content_type or not fichier.content_type.startswith("image/"):
            await inter.response.send_message("❌ Le fichier doit être une image (JPG, PNG, GIF, etc.).", ephemeral=True)
            return
        # Utiliser l'URL du fichier uploadé
        photo_url = fichier.url
    else:
        photo_url = url_photo.strip()
    
    # Vérifier les droits
    if not await verifier_droits(inter, row):
        return
    
    # Vérifier le nombre de photos (max 10)
    with db_connect() as conn:
        c = conn.cursor()
        c.execute("SELECT COUNT(*) as count FROM photos_tribu WHERE tribu_id=?", (row["id"],))
        count = c.fetchone()["count"]
        
        if count >= 10:
            await inter.response.send_message("❌ Cette tribu a déjà 10 photos. Supprime-en une avant d'en ajouter une nouvelle avec `/supprimer_photo`.", ephemeral=True)
            return
        
        # Calculer le prochain ordre
        c.execute("SELECT COALESCE(MAX(ordre), -1) as max_ordre FROM photos_tribu WHERE tribu_id=?", (row["id"],))
        max_ordre = c.fetchone()["max_ordre"]
        nouvel_ordre = max_ordre + 1
        
        # Ajouter la photo
        c.execute("""
        INSERT INTO photos_tribu (tribu_id, url, ordre, created_at)
        VALUES (?, ?, ?, ?)
        """, (row["id"], photo_url, nouvel_ordre, dt.datetime.utcnow().isoformat()))
        conn.commit()
    
    source = "📱 depuis un fichier" if fichier else "🔗 depuis une URL"
    ajouter_historique(row["id"], inter.user.id, "Photo ajoutée", f"Photo #{nouvel_ordre + 1} ajoutée {source}")
    await afficher_fiche_mise_a_jour(inter, row["id"], f"✅ **Photo #{nouvel_ordre + 1} ajoutée à {row['nom']} !** ({count + 1}/10)\n{source}", ephemeral=False)

async def autocomplete_photos_tribu(inter: discord.Interaction, current: str):
    """Autocomplétion pour les photos d'une tribu"""
    db_init()
    
    # Récupérer le nom de la tribu depuis le namespace
    nom_tribu = inter.namespace.nom if hasattr(inter.namespace, 'nom') else None
    if not nom_tribu:
        return []
    
    row = tribu_par_nom(inter.guild_id, nom_tribu)
    if not row:
        return []
    
    # Récupérer les photos de cette tribu
    with db_connect() as conn:
        c = conn.cursor()
        c.execute("SELECT id, url, ordre FROM photos_tribu WHERE tribu_id=? ORDER BY ordre", (row["id"],))
        photos = c.fetchall()
    
    choices = []
    for photo in photos:
        # Afficher juste "📸 Photo 1", "📸 Photo 2", etc. (SANS # pour éviter les liens Discord)
        numero = photo['ordre'] + 1
        choices.append(app_commands.Choice(name=f"📸 Photo {numero}", value=str(photo['id'])))
    
    return choices[:25]

@tree.command(name="supprimer_photo", description="Supprimer une photo de la galerie de ta tribu")
@app_commands.describe(
    nom="Nom de la tribu",
    photo_id="Sélectionne la photo à supprimer"
)
@app_commands.autocomplete(nom=autocomplete_tribus, photo_id=autocomplete_photos_tribu)
async def supprimer_photo(inter: discord.Interaction, nom: str, photo_id: str):
    db_init()
    row = tribu_par_nom(inter.guild_id, nom)
    if not row:
        await inter.response.send_message("❌ Aucune tribu trouvée avec ce nom.", ephemeral=True)
        return
    
    # Vérifier les droits
    if not await verifier_droits(inter, row):
        return
    
    # Récupérer la photo
    try:
        photo_id_int = int(photo_id)
    except ValueError:
        await inter.response.send_message("❌ ID de photo invalide.", ephemeral=True)
        return
    
    with db_connect() as conn:
        c = conn.cursor()
        # Vérifier que la photo appartient bien à cette tribu
        c.execute("SELECT * FROM photos_tribu WHERE id=? AND tribu_id=?", (photo_id_int, row["id"]))
        photo = c.fetchone()
        
        if not photo:
            await inter.response.send_message("❌ Photo introuvable ou n'appartient pas à cette tribu.", ephemeral=True)
            return
    
    # Afficher la confirmation avec la photo
    photo_numero = photo['ordre'] + 1
    
    e = discord.Embed(
        title=f"⚠️ Confirmer la suppression — {row['nom']}",
        description=f"**Es-tu sûr de vouloir supprimer la Photo {photo_numero} ?**\n\nCette action est irréversible.",
        color=0xFF6B6B
    )
    e.set_image(url=photo['url'])
    e.set_footer(text="💡 Clique sur ✅ pour confirmer ou ❌ pour annuler")
    
    # Créer la vue de confirmation
    view = ConfirmationSupprimerPhoto(row["id"], row['nom'], photo_id_int, photo['url'], photo_numero)
    
    await inter.response.send_message(embed=e, view=view, ephemeral=True)

@tree.command(name="panneau", description="Ouvrir le panneau Tribu (boutons)")
async def panneau(inter: discord.Interaction):
    v = PanneauTribu(timeout=None)  # Pas de timeout pour un panneau permanent
    
    # Si admin, supprimer les anciens panneaux et afficher pour tout le monde
    if est_admin(inter):
        # Répondre d'abord à l'interaction pour éviter le timeout
        await inter.response.defer(ephemeral=False)
        
        # Supprimer tous les anciens panneaux dans le canal (cherche dans les 200 derniers messages)
        panneaux_supprimes = 0
        try:
            async for msg in inter.channel.history(limit=200):
                if msg.embeds and len(msg.embeds) > 0:
                    for embed in msg.embeds:
                        if embed.title == "🧭 Panneau — Fiches Tribu":
                            try:
                                await msg.delete()
                                panneaux_supprimes += 1
                                print(f"Panneau supprimé : {msg.id}")
                                break
                            except Exception as ex:
                                print(f"Erreur suppression panneau {msg.id}: {ex}")
        except Exception as ex:
            print(f"Erreur lors de la recherche de panneaux: {ex}")
        
        print(f"Total panneaux supprimés: {panneaux_supprimes}")
        
        e = discord.Embed(
            title="🧭 Panneau — Fiches Tribu",
            description="Utilise les boutons ci-dessous pour gérer les fiches sans taper de commandes.",
            color=0x2B2D31
        )
        banniere_url = get_config(inter.guild_id, "banniere_panneau", "https://i.postimg.cc/8c6gy1qK/AB2723-D2-B10-F-40-F7-A124-1-D6-F30510096.jpg")
        e.set_image(url=banniere_url)
        e.set_footer(text="👑 Panneau admin — Visible par tous")
        await inter.followup.send(embed=e, view=v)
    else:
        e = discord.Embed(
            title="🧭 Panneau — Fiches Tribu",
            description="Utilise les boutons ci-dessous pour gérer les fiches sans taper de commandes.",
            color=0x2B2D31
        )
        banniere_url = get_config(inter.guild_id, "banniere_panneau", "https://i.postimg.cc/8c6gy1qK/AB2723-D2-B10-F-40-F7-A124-1-D6-F30510096.jpg")
        e.set_image(url=banniere_url)
        e.set_footer(text="Astuce : tu peux rouvrir ce panneau à tout moment avec /panneau")
        await inter.response.send_message(embed=e, view=v, ephemeral=True)

@bot.event
async def on_interaction(inter: discord.Interaction):
    """
    Listener global pour intercepter les interactions avec les menus de fiche tribu
    et les boutons de galerie photo même après redémarrage du bot.
    Ce listener ne s'active QUE si l'interaction n'a pas déjà été traitée par une vue active.
    """
    # Vérifier si c'est une interaction avec un composant
    if inter.type != discord.InteractionType.component:
        return
    
    if not inter.data or 'custom_id' not in inter.data:
        return
    
    custom_id = inter.data['custom_id']
    
    # Gérer les boutons de galerie photo
    if custom_id.startswith("galerie_prev:") or custom_id.startswith("galerie_next:"):
        # Vérifier si l'interaction a déjà été traitée (par une vue active)
        if inter.response.is_done():
            return
        
        try:
            tribu_id = int(custom_id.split(":")[1])
        except (IndexError, ValueError):
            return
        
        # Déterminer la direction
        direction = -1 if custom_id.startswith("galerie_prev:") else 1
        
        # Recréer la vue et exécuter la navigation
        # On commence à l'index 0 par défaut, la méthode _changer_photo calculera le bon index
        view = MenuFicheTribu(tribu_id, 0, timeout=None)
        await view._changer_photo(inter, direction)
        return
    
    # Gérer les menus déroulants
    if not custom_id.startswith("menu_fiche:"):
        return
    
    # Vérifier si l'interaction a déjà été traitée (par une vue active)
    if inter.response.is_done():
        return
    
    # Extraire le tribu_id du custom_id
    try:
        tribu_id = int(custom_id.split(":")[1])
    except (IndexError, ValueError):
        return
    
    # Récupérer le choix sélectionné
    if 'values' not in inter.data or len(inter.data['values']) == 0:
        return
    
    choice = inter.data['values'][0]
    
    # Recréer dynamiquement la vue et exécuter l'action
    view = MenuFicheTribu(tribu_id, 0, timeout=None)
    
    if choice == "commandes":
        await view.action_commandes(inter)
    elif choice == "quitter":
        await view.action_quitter(inter)
    elif choice == "historique":
        await view.action_historique(inter)
    elif choice == "staff":
        await view.action_staff(inter)

@bot.event
async def on_ready():
    db_init()  # Initialiser la DB au démarrage
    
    # Ajouter les vues persistantes pour qu'elles fonctionnent après redémarrage
    bot.add_view(PanneauTribu(timeout=None))
    
    # MenuFicheTribu est maintenant géré par le listener on_interaction
    # qui intercepte les interactions même après redémarrage
    
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
    keep_alive()  # Lance le serveur web pour éviter la mise en veille
    bot.run(token)

if __name__ == "__main__":
    main()