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
from tribe_retirement import (
    TRIBE_SITE_URL, remove_tribe_commands, redirect_retired_component,
    remove_guild_tribe_commands,
)

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

# Chemin de la base de données (utilise SQLITE_PATH pour le déploiement Replit)
DB_PATH = os.getenv("SQLITE_PATH", os.getenv("TRIBU_BOT_DB", "tribus.db"))

# ---------- Base de données Arki Identité ----------
# Base de données séparée pour les identités utilisateurs
# Sur Railway : /data/arki_identite.db (dans le coffre)
# En local : arki_identite.db (racine du projet)
if os.getenv("SQLITE_PATH"):
    # Railway : utiliser le répertoire /data/
    IDENTITE_DB_PATH = "/data/arki_identite.db"
else:
    # Local (Replit) : racine du projet
    IDENTITE_DB_PATH = "arki_identite.db"

def identite_db_connect():
    """Connexion à la base de données Arki Identité"""
    conn = sqlite3.connect(IDENTITE_DB_PATH, timeout=30.0, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA busy_timeout = 30000")
    return conn

def identite_db_init():
    """Initialisation de la base de données Arki Identité"""
    with identite_db_connect() as conn:
        cursor = conn.cursor()
        cursor.execute("CREATE TABLE IF NOT EXISTS users (user_id TEXT, data TEXT)")
        conn.commit()

# ---------- Base de données Tribus ----------
def db_connect():
    """Connexion à la base de données avec timeout et busy handler pour éviter les locks"""
    conn = sqlite3.connect(DB_PATH, timeout=30.0, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    # Activer le mode WAL pour améliorer la concurrence
    conn.execute("PRAGMA journal_mode=WAL")
    # Augmenter le busy_timeout pour attendre jusqu'à 30 secondes
    conn.execute("PRAGMA busy_timeout = 30000")
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
        
        # Initialiser la couleur du panneau par défaut (bleu Discord)
        c.execute("""
        INSERT OR IGNORE INTO config (guild_id, cle, valeur)
        VALUES (0, 'couleur_panneau', '5865F2')
        """)
        
        # Initialiser le texte du panneau par défaut
        c.execute("""
        INSERT OR IGNORE INTO config (guild_id, cle, valeur)
        VALUES (0, 'texte_panneau', 'Bienvenue sur le panneau de gestion des tribus ! Utilise les boutons ci-dessous pour gérer ta tribu.')
        """)
        
        # Salon par défaut pour les fiches tribu (0 = salon actuel)
        c.execute("""
        INSERT OR IGNORE INTO config (guild_id, cle, valeur)
        VALUES (0, 'salon_fiche_tribu', '0')
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
        
        # Table pour les maps premium
        c.execute("""
        CREATE TABLE IF NOT EXISTS maps_premium (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guild_id INTEGER NOT NULL,
            nom TEXT NOT NULL,
            created_at TEXT NOT NULL,
            UNIQUE(guild_id, nom)
        )
        """)
        
        # Maps premium par défaut
        default_maps_premium = ["Svartalfheim", "Némésis"]
        for map_name in default_maps_premium:
            c.execute("INSERT OR IGNORE INTO maps_premium (guild_id, nom, created_at) VALUES (?, ?, ?)",
                     (0, map_name, dt.datetime.utcnow().isoformat()))
        
        # Table pour les bases premium (similaire aux avant-postes)
        c.execute("""
        CREATE TABLE IF NOT EXISTS bases_premium (
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
        
        # Ajouter des index pour optimiser les performances avec beaucoup d'utilisateurs
        c.execute("CREATE INDEX IF NOT EXISTS idx_tribus_guild ON tribus(guild_id)")
        c.execute("CREATE INDEX IF NOT EXISTS idx_tribus_proprietaire ON tribus(proprietaire_id)")
        c.execute("CREATE INDEX IF NOT EXISTS idx_membres_tribu ON membres(tribu_id)")
        c.execute("CREATE INDEX IF NOT EXISTS idx_membres_user ON membres(user_id)")
        c.execute("CREATE INDEX IF NOT EXISTS idx_avant_postes_tribu ON avant_postes(tribu_id)")
        c.execute("CREATE INDEX IF NOT EXISTS idx_photos_tribu ON photos_tribu(tribu_id)")
        c.execute("CREATE INDEX IF NOT EXISTS idx_historique_tribu ON historique(tribu_id)")
        c.execute("CREATE INDEX IF NOT EXISTS idx_bases_premium_tribu ON bases_premium(tribu_id)")
        c.execute("CREATE INDEX IF NOT EXISTS idx_config_guild ON config(guild_id)")
        
        conn.commit()

def get_config(guild_id: int, cle: str, defaut: str = "") -> str:
    """Récupère une valeur de configuration pour un serveur"""
    with db_connect() as conn:
        c = conn.cursor()
        # Chercher d'abord pour ce serveur, sinon utiliser la valeur globale (guild_id=0)
        c.execute("SELECT valeur FROM config WHERE guild_id IN (?, 0) AND cle=? ORDER BY guild_id DESC LIMIT 1", 
                 (guild_id, cle))
        row = c.fetchone()
        return row["valeur"] if row else defaut

def set_config(guild_id: int, cle: str, valeur: str):
    """Définit une valeur de configuration pour un serveur"""
    with db_connect() as conn:
        c = conn.cursor()
        c.execute("INSERT OR REPLACE INTO config (guild_id, cle, valeur) VALUES (?, ?, ?)",
                 (guild_id, cle, valeur))
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

def get_bases_premium(tribu_id: int):
    """Récupère les bases premium d'une tribu"""
    with db_connect() as conn:
        c = conn.cursor()
        c.execute("SELECT * FROM bases_premium WHERE tribu_id=? ORDER BY created_at DESC", (tribu_id,))
        return c.fetchall()

# ---------- Bot ----------
intents = discord.Intents.default()
intents.guilds = True
intents.members = True

bot = commands.Bot(command_prefix="!", intents=intents)
tree = bot.tree

# ---------- Helpers UI ----------
def embed_tribu(tribu, membres=None, avant_postes=None, createur_avatar_url=None, photos=None, photo_index=0, bases_premium=None) -> discord.Embed:
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
    
    # Bases premium (entre base principale et avant-postes)
    if bases_premium is not None and len(bases_premium) > 0:
        bp_lines = []
        for bp in bases_premium:
            bp_info = []
            if bp['map']:
                bp_info.append(f"{bp['map']}")
            if bp['coords']:
                bp_info.append(f"📍 {bp['coords']}")
            if bp_info:
                bp_lines.append(f"• {' | '.join(bp_info)}")
        if bp_lines:
            e.add_field(name=f"**⭐ BASES MAP PREMIUM ({len(bp_lines)})**", value="\n".join(bp_lines)[:1024], inline=False)
    
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
        e.add_field(name="**🎯 OBJECTIF**", value=tribu["objectif"][:1024], inline=False)
    
    # Ouvert au recrutement
    if "ouvert_recrutement" in tribu.keys() and tribu["ouvert_recrutement"]:
        recrutement_value = tribu["ouvert_recrutement"]
        # Si c'est 1 ou 0, convertir en texte
        if recrutement_value == 1:
            recrutement_value = "Oui"
        elif recrutement_value == 0:
            recrutement_value = "Non"
        e.add_field(name="**📢 RECRUTEMENT OUVERT**", value=str(recrutement_value)[:1024], inline=False)
    
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
        super().__init__(timeout=300)  # 3 minutes
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
        style=discord.TextStyle.short,
        max_length=500
    )
    
    def __init__(self, tribu_id: int, tribu_nom: str):
        super().__init__()
        self.tribu_id = tribu_id
        self.tribu_nom = tribu_nom
    
    async def on_submit(self, inter: discord.Interaction):
        await inter.response.defer(ephemeral=True)
        
        # Vérifier les droits
        with db_connect() as conn:
            c = conn.cursor()
            c.execute("SELECT * FROM tribus WHERE id=?", (self.tribu_id,))
            row = c.fetchone()
            
            if not row:
                await inter.followup.send("❌ Tribu introuvable.", ephemeral=True)
                return
            
            # Vérifier les permissions
            if not (est_admin(inter) or inter.user.id == row["proprietaire_id"] or est_manager(self.tribu_id, inter.user.id)):
                await inter.followup.send("❌ Tu n'as pas la permission de modifier cette tribu.", ephemeral=True)
                return
            
            # Vérifier le nombre de photos (max 10)
            c.execute("SELECT COUNT(*) as count FROM photos_tribu WHERE tribu_id=?", (self.tribu_id,))
            count = c.fetchone()["count"]
            
            if count >= 10:
                await inter.followup.send("❌ Cette tribu a déjà 10 photos. Supprime-en une avant d'en ajouter une nouvelle.", ephemeral=True)
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
        await inter.followup.send(f"✅ **Photo #{nouvel_ordre + 1} ajoutée à {self.tribu_nom} !** ({count + 1}/10)\n🔗 depuis une URL", ephemeral=True)
        try:
            await afficher_ou_rafraichir_fiche(inter.client, self.tribu_id, inter.guild, inter.channel)
        except Exception as e:
            print(f"⚠️ Erreur lors du rafraîchissement de la fiche tribu {self.tribu_id}: {e}")

class ModalCoordsBase(discord.ui.Modal, title="🏠 Coordonnées de la base"):
    """Modal pour entrer les coordonnées de la base principale"""
    coords = discord.ui.TextInput(
        label="Coordonnées",
        placeholder="Ex: 45.5, 32.6",
        required=True,
        max_length=100,
        style=discord.TextStyle.short
    )
    
    def __init__(self, tribu_id: int, map_selectionnee: str):
        super().__init__()
        self.tribu_id = tribu_id
        self.map_selectionnee = map_selectionnee
    
    async def on_submit(self, inter: discord.Interaction):
        await inter.response.defer(ephemeral=True)
        
        coords_value = self.coords.value.strip()
        
        with db_connect() as conn:
            c = conn.cursor()
            c.execute("SELECT * FROM tribus WHERE id=?", (self.tribu_id,))
            row = c.fetchone()
            
            if not row:
                await inter.followup.send("❌ Tribu introuvable.", ephemeral=True)
                return
            
            if not (est_admin(inter) or inter.user.id == row["proprietaire_id"] or est_manager(self.tribu_id, inter.user.id)):
                await inter.followup.send("❌ Tu n'as pas la permission de modifier la base principale.", ephemeral=True)
                return
            
            c.execute("UPDATE tribus SET map_base=?, coords_base=? WHERE id=?", (self.map_selectionnee, coords_value, self.tribu_id))
            conn.commit()
        
        ajouter_historique(self.tribu_id, inter.user.id, "Base principale modifiée", f"{self.map_selectionnee} | {coords_value}")
        await inter.followup.send(f"✅ **Base principale définie : {self.map_selectionnee} ({coords_value}) !**", ephemeral=True)
        try:
            await afficher_ou_rafraichir_fiche(inter.client, self.tribu_id, inter.guild, inter.channel)
        except Exception as e:
            await inter.followup.send(f"⚠️ **Note** : Base modifiée mais fiche non rafraîchie. Utilise `/ma_tribu` pour voir.\n`Erreur: {e}`", ephemeral=True)

class ModalCoordsAvantPoste(discord.ui.Modal, title="🏘️ Coordonnées avant-poste"):
    """Modal pour entrer les coordonnées d'un avant-poste"""
    coords = discord.ui.TextInput(
        label="Coordonnées",
        placeholder="Ex: 45.5, 32.6",
        required=True,
        max_length=100,
        style=discord.TextStyle.short
    )
    
    def __init__(self, tribu_id: int, map_selectionnee: str):
        super().__init__()
        self.tribu_id = tribu_id
        self.map_selectionnee = map_selectionnee
    
    async def on_submit(self, inter: discord.Interaction):
        await inter.response.defer(ephemeral=True)
        
        coords_value = self.coords.value.strip()
        
        with db_connect() as conn:
            c = conn.cursor()
            c.execute("SELECT * FROM tribus WHERE id=?", (self.tribu_id,))
            row = c.fetchone()
            
            if not row:
                await inter.followup.send("❌ Tribu introuvable.", ephemeral=True)
                return
            
            if not (est_admin(inter) or inter.user.id == row["proprietaire_id"] or est_manager(self.tribu_id, inter.user.id)):
                await inter.followup.send("❌ Tu n'as pas la permission d'ajouter des avant-postes.", ephemeral=True)
                return
            
            c.execute("SELECT COUNT(*) as count FROM avant_postes WHERE tribu_id=?", (self.tribu_id,))
            count = c.fetchone()["count"]
            nom_ap = f"Avant-poste {count + 1}"
            
            c.execute("""
            INSERT INTO avant_postes (tribu_id, user_id, nom, map, coords, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """, (self.tribu_id, inter.user.id, nom_ap, self.map_selectionnee, coords_value, dt.datetime.utcnow().isoformat()))
            conn.commit()
        
        ajouter_historique(self.tribu_id, inter.user.id, "Avant-poste ajouté", f"{nom_ap} — {self.map_selectionnee} | {coords_value}")
        await inter.followup.send(f"✅ **{nom_ap} ajouté : {self.map_selectionnee} !**", ephemeral=True)
        try:
            await afficher_ou_rafraichir_fiche(inter.client, self.tribu_id, inter.guild, inter.channel)
        except Exception as e:
            await inter.followup.send(f"⚠️ **Note** : Avant-poste ajouté mais fiche non rafraîchie. Utilise `/ma_tribu` pour voir.\n`Erreur: {e}`", ephemeral=True)

class ModalCoordsPremium(discord.ui.Modal, title="⭐ Coordonnées base premium"):
    """Modal pour entrer les coordonnées d'une base premium"""
    coords = discord.ui.TextInput(
        label="Coordonnées",
        placeholder="Ex: 45.5, 32.6",
        required=True,
        max_length=100,
        style=discord.TextStyle.short
    )
    
    def __init__(self, tribu_id: int, map_selectionnee: str):
        super().__init__()
        self.tribu_id = tribu_id
        self.map_selectionnee = map_selectionnee
    
    async def on_submit(self, inter: discord.Interaction):
        await inter.response.defer(ephemeral=True)
        
        coords_value = self.coords.value.strip()
        
        with db_connect() as conn:
            c = conn.cursor()
            c.execute("SELECT * FROM tribus WHERE id=?", (self.tribu_id,))
            row = c.fetchone()
            
            if not row:
                await inter.followup.send("❌ Tribu introuvable.", ephemeral=True)
                return
            
            if not (est_admin(inter) or inter.user.id == row["proprietaire_id"] or est_manager(self.tribu_id, inter.user.id)):
                await inter.followup.send("❌ Tu n'as pas la permission d'ajouter des bases premium.", ephemeral=True)
                return
            
            c.execute("SELECT COUNT(*) as count FROM bases_premium WHERE tribu_id=?", (self.tribu_id,))
            count = c.fetchone()["count"]
            nom_base = f"Base premium {count + 1}"
            
            c.execute("""
            INSERT INTO bases_premium (tribu_id, user_id, nom, map, coords, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """, (self.tribu_id, inter.user.id, nom_base, self.map_selectionnee, coords_value, dt.datetime.utcnow().isoformat()))
            conn.commit()
        
        ajouter_historique(self.tribu_id, inter.user.id, "Base premium ajoutée", f"{nom_base} — {self.map_selectionnee} | {coords_value}")
        await inter.followup.send(f"✅ **{nom_base} ajoutée : {self.map_selectionnee} !**", ephemeral=True)
        try:
            await afficher_ou_rafraichir_fiche(inter.client, self.tribu_id, inter.guild, inter.channel)
        except Exception as e:
            await inter.followup.send(f"⚠️ **Note** : Base premium ajoutée mais fiche non rafraîchie. Utilise `/ma_tribu` pour voir.\n`Erreur: {e}`", ephemeral=True)

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
        await inter.response.send_message(f"✅ **Photo {self.photo_numero} supprimée de {self.tribu_nom} !** ({count_restant}/10)", ephemeral=True)
        try:
            await afficher_ou_rafraichir_fiche(inter.client, self.tribu_id, inter.guild, inter.channel)
        except Exception as e:
            print(f"⚠️ Erreur lors du rafraîchissement de la fiche tribu {self.tribu_id}: {e}")
    
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
        super().__init__(timeout=300)
        self.add_item(SelectSupprimerPhoto(tribu_id, tribu_nom, photos))

class PanneauMembre(discord.ui.View):
    def __init__(self, tribu_nom: str, tribu_id: int = None, timeout: Optional[float] = 180):
        super().__init__(timeout=timeout)
        self.tribu_nom = tribu_nom
        self.tribu_id = tribu_id
    
    @discord.ui.button(label="Changer mon nom in-game", style=discord.ButtonStyle.primary, emoji="✏️", row=0)
    async def btn_nom_ingame(self, inter: discord.Interaction, button: discord.ui.Button):
        class ModalNomIngame(discord.ui.Modal, title="✏️ Modifier mon nom in-game"):
            nom = discord.ui.TextInput(
                label="Nouveau nom in-game",
                placeholder="Ton nom dans Ark: Survival Ascended",
                required=True,
                max_length=100,
                style=discord.TextStyle.short
            )
            
            async def on_submit(modal_self, modal_inter: discord.Interaction):
                await modal_inter.response.defer(ephemeral=True)
                nouveau_nom = modal_self.nom.value.strip()
                if not nouveau_nom:
                    await modal_inter.followup.send("❌ Le nom ne peut pas être vide.", ephemeral=True)
                    return
                
                with db_connect() as conn:
                    c = conn.cursor()
                    c.execute("UPDATE membres SET nom_in_game=? WHERE user_id=?", (nouveau_nom, modal_inter.user.id))
                    affected = c.rowcount
                    conn.commit()
                
                if affected > 0:
                    await modal_inter.followup.send(f"✅ Ton nom in-game a été changé en **{nouveau_nom}** pour toutes tes tribus !", ephemeral=True)
                else:
                    await modal_inter.followup.send(f"✅ Ton nom in-game a été défini sur **{nouveau_nom}** !", ephemeral=True)
        
        await inter.response.send_modal(ModalNomIngame())
    
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
        
        # Vérifier les droits
        with db_connect() as conn:
            c = conn.cursor()
            c.execute("SELECT * FROM tribus WHERE id=?", (self.tribu_id,))
            row = c.fetchone()
        
        if not row:
            await inter.response.send_message("❌ Tribu introuvable.", ephemeral=True)
            return
        
        if not (est_admin(inter) or inter.user.id == row["proprietaire_id"] or est_manager(self.tribu_id, inter.user.id)):
            await inter.response.send_message("❌ Tu n'as pas la permission d'ajouter des membres.", ephemeral=True)
            return
        
        # Créer une vue avec un sélecteur d'utilisateur
        view = discord.ui.View(timeout=300)
        user_select = discord.ui.UserSelect(
            placeholder="Sélectionne l'utilisateur à ajouter...",
            min_values=1,
            max_values=1
        )
        
        async def user_select_callback(select_inter: discord.Interaction):
            # NE PAS DEFER car on va ouvrir un modal
            selected_user = user_select.values[0]
            
            # Vérifier si le membre est déjà dans la tribu
            with db_connect() as conn:
                c = conn.cursor()
                c.execute("SELECT * FROM membres WHERE tribu_id=? AND user_id=?", (self.tribu_id, selected_user.id))
                if c.fetchone():
                    await select_inter.response.send_message(f"❌ {selected_user.mention} est déjà membre de cette tribu.", ephemeral=True)
                    return
            
            # Stocker les variables pour le modal
            tribu_id_local = self.tribu_id
            tribu_nom_local = self.tribu_nom
            
            # Ouvrir un modal pour demander le nom in-game
            class ModalNomIngame(discord.ui.Modal, title="👤 Nom in-game du membre"):
                nom_ingame = discord.ui.TextInput(
                    label="Nom in-game (dans Ark)",
                    placeholder="Ex: Raptor_Killer42",
                    style=discord.TextStyle.short,
                    required=True,
                    max_length=100
                )
                
                async def on_submit(self, modal_inter: discord.Interaction):
                    # DEFER après soumission du modal
                    await modal_inter.response.defer(ephemeral=True)
                    
                    nom_in_game = self.nom_ingame.value.strip()
                    
                    print(f"✅ DEBUG: Nom in-game reçu: {nom_in_game}")
                    print(f"✅ DEBUG: Envoi de l'embed avec les boutons manager...")
                    
                    # Demander si le membre est manager
                    class ViewManagerChoice(discord.ui.View):
                        def __init__(self):
                            super().__init__(timeout=300)
                        
                        @discord.ui.button(label="Oui, manager", style=discord.ButtonStyle.success, emoji="✅")
                        async def btn_manager(self, btn_inter: discord.Interaction, btn: discord.ui.Button):
                            # DEFER immédiatement pour éviter timeout
                            await btn_inter.response.defer(ephemeral=True)
                            
                            with db_connect() as conn:
                                c = conn.cursor()
                                c.execute("INSERT INTO membres (tribu_id, user_id, nom_in_game, role, manager) VALUES (?, ?, ?, ?, 1)", 
                                         (tribu_id_local, selected_user.id, nom_in_game, "Manager"))
                                conn.commit()
                            
                            ajouter_historique(tribu_id_local, btn_inter.user.id, "Membre ajouté", f"{selected_user.mention} ({nom_in_game}) ajouté en tant que Manager")
                            await btn_inter.followup.send(f"✅ {selected_user.mention} **({nom_in_game})** a été ajouté à **{tribu_nom_local}** en tant que **Manager** !", ephemeral=True)
                            try:
                                await afficher_ou_rafraichir_fiche(btn_inter.client, tribu_id_local, btn_inter.guild, btn_inter.channel)
                            except Exception as e:
                                await btn_inter.followup.send(f"⚠️ **Note** : Membre ajouté mais fiche non rafraîchie. Utilise `/ma_tribu` pour voir.\n`Erreur: {e}`", ephemeral=True)
                        
                        @discord.ui.button(label="Non, membre simple", style=discord.ButtonStyle.secondary, emoji="👤")
                        async def btn_membre(self, btn_inter: discord.Interaction, btn: discord.ui.Button):
                            # DEFER immédiatement pour éviter timeout
                            await btn_inter.response.defer(ephemeral=True)
                            
                            with db_connect() as conn:
                                c = conn.cursor()
                                c.execute("INSERT INTO membres (tribu_id, user_id, nom_in_game) VALUES (?, ?, ?)", 
                                         (tribu_id_local, selected_user.id, nom_in_game))
                                conn.commit()
                            
                            ajouter_historique(tribu_id_local, btn_inter.user.id, "Membre ajouté", f"{selected_user.mention} ({nom_in_game}) ajouté à la tribu")
                            await btn_inter.followup.send(f"✅ {selected_user.mention} **({nom_in_game})** a été ajouté à **{tribu_nom_local}** !", ephemeral=True)
                            try:
                                await afficher_ou_rafraichir_fiche(btn_inter.client, tribu_id_local, btn_inter.guild, btn_inter.channel)
                            except Exception as e:
                                await btn_inter.followup.send(f"⚠️ **Note** : Membre ajouté mais fiche non rafraîchie. Utilise `/ma_tribu` pour voir.\n`Erreur: {e}`", ephemeral=True)
                    
                    e = discord.Embed(
                        title="👤 Autorisation de modification",
                        description=f"**{selected_user.mention} ({nom_in_game})** sera-t-il autorisé à modifier la fiche de la tribu ?",
                        color=0x5865F2
                    )
                    await modal_inter.followup.send(embed=e, view=ViewManagerChoice(), ephemeral=True)
            
            await select_inter.response.send_modal(ModalNomIngame())
        
        user_select.callback = user_select_callback
        view.add_item(user_select)
        
        await inter.response.send_message("👤 **Ajouter un membre**\n\nSélectionne l'utilisateur à ajouter :", view=view, ephemeral=True)
    
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
            # Récupérer le nom d'utilisateur Discord
            user = inter.guild.get_member(membre['user_id'])
            if user:
                user_display = f"{user.display_name} (@{user.name})"
                role_display = f" — {membre['role']}" if membre['role'] else ""
                options.append(discord.SelectOption(
                    label=user_display[:100],  # Discord limite à 100 caractères
                    description=f"ID: {membre['user_id']}{role_display}",
                    value=str(membre['user_id'])
                ))
            else:
                # Fallback si le membre n'est plus sur le serveur
                role_display = f" — {membre['role']}" if membre['role'] else ""
                options.append(discord.SelectOption(
                    label=f"Utilisateur {membre['user_id']}",
                    description=f"(Membre absent du serveur){role_display}",
                    value=str(membre['user_id'])
                ))
        
        select = discord.ui.Select(placeholder="Sélectionne le membre à retirer...", options=options[:25])
        
        async def select_callback(select_inter: discord.Interaction):
            # DEFER IMMÉDIATEMENT pour éviter timeout
            await select_inter.response.defer(ephemeral=True)
            user_id = int(select.values[0])
            
            # Vérifier les droits
            with db_connect() as conn:
                c = conn.cursor()
                c.execute("SELECT * FROM tribus WHERE id=?", (self.tribu_id,))
                row = c.fetchone()
                
                if not (est_admin(select_inter) or select_inter.user.id == row["proprietaire_id"] or est_manager(self.tribu_id, select_inter.user.id)):
                    await select_inter.followup.send("❌ Tu n'as pas la permission de retirer des membres.", ephemeral=True)
                    return
                
                c.execute("DELETE FROM membres WHERE tribu_id=? AND user_id=?", (self.tribu_id, user_id))
                conn.commit()
            
            ajouter_historique(self.tribu_id, select_inter.user.id, "Membre retiré", f"<@{user_id}> retiré de la tribu")
            await select_inter.followup.send(f"✅ <@{user_id}> a été retiré de **{self.tribu_nom}** !", ephemeral=True)
            try:
                await afficher_ou_rafraichir_fiche(select_inter.client, self.tribu_id, select_inter.guild, select_inter.channel)
            except Exception as e:
                print(f"⚠️ Erreur lors du rafraîchissement de la fiche tribu {self.tribu_id}: {e}")
        
        select.callback = select_callback
        view = discord.ui.View(timeout=300)
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
            await select_inter.response.send_modal(ModalCoordsAvantPoste(self.tribu_id, map_selectionnee))
        
        select.callback = select_callback
        view = discord.ui.View(timeout=300)
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
            # DEFER IMMÉDIATEMENT pour éviter timeout
            await select_inter.response.defer(ephemeral=True)
            ap_id = int(select.values[0])
            
            # Vérifier les droits
            with db_connect() as conn:
                c = conn.cursor()
                c.execute("SELECT * FROM tribus WHERE id=?", (self.tribu_id,))
                row = c.fetchone()
                
                if not (est_admin(select_inter) or select_inter.user.id == row["proprietaire_id"] or est_manager(self.tribu_id, select_inter.user.id)):
                    await select_inter.followup.send("❌ Tu n'as pas la permission de retirer des avant-postes.", ephemeral=True)
                    return
                
                c.execute("SELECT nom FROM avant_postes WHERE id=?", (ap_id,))
                ap = c.fetchone()
                nom_ap = ap["nom"] if ap else "Avant-poste"
                
                c.execute("DELETE FROM avant_postes WHERE id=?", (ap_id,))
                conn.commit()
            
            ajouter_historique(self.tribu_id, select_inter.user.id, "Avant-poste supprimé", nom_ap)
            await select_inter.followup.send(f"✅ **{nom_ap}** supprimé de **{self.tribu_nom}** !", ephemeral=True)
            try:
                await afficher_ou_rafraichir_fiche(select_inter.client, self.tribu_id, select_inter.guild, select_inter.channel)
            except Exception as e:
                print(f"⚠️ Erreur lors du rafraîchissement de la fiche tribu {self.tribu_id}: {e}")
        
        select.callback = select_callback
        view = discord.ui.View(timeout=300)
        view.add_item(select)
        await inter.response.send_message("🏚️ Sélectionne l'avant-poste à retirer :", view=view, ephemeral=True)
    
    @discord.ui.button(label="Modifier base principale", style=discord.ButtonStyle.success, emoji="🏠", row=2)
    async def btn_ajouter_base(self, inter: discord.Interaction, button: discord.ui.Button):
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
            placeholder="🗺️ Sélectionne la map de la base principale...",
            options=options
        )
        
        async def select_callback(select_inter: discord.Interaction):
            map_selectionnee = select.values[0]
            await select_inter.response.send_modal(ModalCoordsBase(self.tribu_id, map_selectionnee))
        
        select.callback = select_callback
        view = discord.ui.View(timeout=300)
        view.add_item(select)
        
        await inter.response.send_message("🏠 **Modifier la base principale**\n\nSélectionne d'abord la map :", view=view, ephemeral=True)
    
    @discord.ui.button(label="Ajouter base premium", style=discord.ButtonStyle.success, emoji="⭐", row=2)
    async def btn_ajouter_base_premium(self, inter: discord.Interaction, button: discord.ui.Button):
        if not self.tribu_id:
            await inter.response.send_message("❌ Erreur : ID de tribu manquant.", ephemeral=True)
            return
        
        # Récupérer toutes les maps premium disponibles
        with db_connect() as conn:
            c = conn.cursor()
            c.execute("SELECT DISTINCT nom FROM maps_premium WHERE guild_id IN (0, ?) ORDER BY nom", (inter.guild_id,))
            maps = [row["nom"] for row in c.fetchall()]
        
        if not maps:
            await inter.response.send_message("❌ Aucune map premium disponible. Contacte un admin pour en ajouter.", ephemeral=True)
            return
        
        # Créer le menu déroulant des maps premium
        options = []
        for map_nom in maps[:25]:  # Discord limite à 25 options
            options.append(discord.SelectOption(
                label=map_nom,
                value=map_nom,
                emoji="⭐"
            ))
        
        select = discord.ui.Select(
            placeholder="⭐ Sélectionne la map premium...",
            options=options
        )
        
        async def select_callback(select_inter: discord.Interaction):
            map_selectionnee = select.values[0]
            await select_inter.response.send_modal(ModalCoordsPremium(self.tribu_id, map_selectionnee))
        
        select.callback = select_callback
        view = discord.ui.View(timeout=300)
        view.add_item(select)
        
        await inter.response.send_message("⭐ **Ajouter une base premium**\n\nSélectionne d'abord la map premium :", view=view, ephemeral=True)
    
    @discord.ui.button(label="Retirer base premium", style=discord.ButtonStyle.secondary, emoji="🗑️", row=2)
    async def btn_retirer_base_premium(self, inter: discord.Interaction, button: discord.ui.Button):
        if not self.tribu_id:
            await inter.response.send_message("❌ Erreur : ID de tribu manquant.", ephemeral=True)
            return
        
        # Récupérer les bases premium de la tribu
        with db_connect() as conn:
            c = conn.cursor()
            c.execute("SELECT id, nom, map, coords FROM bases_premium WHERE tribu_id=?", (self.tribu_id,))
            bases_premium = c.fetchall()
        
        if not bases_premium:
            await inter.response.send_message("❌ Aucune base premium à retirer.", ephemeral=True)
            return
        
        # Créer un menu de sélection
        options = []
        for bp in bases_premium:
            desc = f"{bp['map']}"
            if bp['coords']:
                desc += f" ({bp['coords']})"
            options.append(discord.SelectOption(
                label=bp['nom'],
                description=desc,
                value=str(bp['id'])
            ))
        
        select = discord.ui.Select(placeholder="Sélectionne la base premium à retirer...", options=options[:25])
        
        async def select_callback(select_inter: discord.Interaction):
            # DEFER IMMÉDIATEMENT pour éviter timeout
            await select_inter.response.defer(ephemeral=True)
            bp_id = int(select.values[0])
            
            # Vérifier les droits
            with db_connect() as conn:
                c = conn.cursor()
                c.execute("SELECT * FROM tribus WHERE id=?", (self.tribu_id,))
                row = c.fetchone()
                
                if not (est_admin(select_inter) or select_inter.user.id == row["proprietaire_id"] or est_manager(self.tribu_id, select_inter.user.id)):
                    await select_inter.followup.send("❌ Tu n'as pas la permission de retirer des bases premium.", ephemeral=True)
                    return
                
                c.execute("SELECT nom FROM bases_premium WHERE id=?", (bp_id,))
                bp = c.fetchone()
                nom_bp = bp["nom"] if bp else "Base premium"
                
                c.execute("DELETE FROM bases_premium WHERE id=?", (bp_id,))
                conn.commit()
            
            ajouter_historique(self.tribu_id, select_inter.user.id, "Base premium supprimée", nom_bp)
            await select_inter.followup.send(f"✅ **{nom_bp}** supprimée de **{self.tribu_nom}** !", ephemeral=True)
            try:
                await afficher_ou_rafraichir_fiche(select_inter.client, self.tribu_id, select_inter.guild, select_inter.channel)
            except Exception as e:
                print(f"⚠️ Erreur lors du rafraîchissement de la fiche tribu {self.tribu_id}: {e}")
        
        select.callback = select_callback
        view = discord.ui.View(timeout=300)
        view.add_item(select)
        await inter.response.send_message("⭐ Sélectionne la base premium à retirer :", view=view, ephemeral=True)
    
    @discord.ui.button(label="Question de recrutement", style=discord.ButtonStyle.success, emoji="📢", row=3)
    async def btn_question_recrutement(self, inter: discord.Interaction, button: discord.ui.Button):
        if not self.tribu_id:
            await inter.response.send_message("❌ Erreur : ID de tribu manquant.", ephemeral=True)
            return
        
        # Stocker les variables localement pour éviter les problèmes de scope
        tribu_id_local = self.tribu_id
        tribu_nom_local = self.tribu_nom
        user_id = inter.user.id
        
        class ModalRecrutement(discord.ui.Modal, title="📢 Question de recrutement"):
            recrutement = discord.ui.TextInput(
                label="Question de recrutement",
                placeholder="Ex: Nous recrutons des joueurs PVP actifs !",
                style=discord.TextStyle.paragraph,
                required=False,
                max_length=500
            )
            
            async def on_submit(modal_self, modal_inter: discord.Interaction):
                await modal_inter.response.defer(ephemeral=True)
                
                with db_connect() as conn:
                    c = conn.cursor()
                    c.execute("SELECT recrutement, proprietaire_id FROM tribus WHERE id=?", (tribu_id_local,))
                    row = c.fetchone()
                
                if not row:
                    await modal_inter.followup.send("❌ Tribu introuvable.", ephemeral=True)
                    return
                
                if not (est_admin(modal_inter) or user_id == row["proprietaire_id"] or est_manager(tribu_id_local, user_id)):
                    await modal_inter.followup.send("❌ Tu n'as pas la permission de modifier la question de recrutement.", ephemeral=True)
                    return
                
                nouveau_recrutement = modal_self.recrutement.value.strip()
                
                with db_connect() as conn:
                    c = conn.cursor()
                    c.execute("UPDATE tribus SET recrutement=? WHERE id=?", (nouveau_recrutement, tribu_id_local))
                    conn.commit()
                
                if nouveau_recrutement:
                    ajouter_historique(tribu_id_local, modal_inter.user.id, "Question de recrutement modifiée", nouveau_recrutement[:100])
                    await modal_inter.followup.send(f"✅ Question de recrutement modifiée pour **{tribu_nom_local}** !", ephemeral=True)
                else:
                    ajouter_historique(tribu_id_local, modal_inter.user.id, "Question de recrutement supprimée", "")
                    await modal_inter.followup.send(f"✅ Question de recrutement supprimée pour **{tribu_nom_local}** !", ephemeral=True)
                
                try:
                    await afficher_ou_rafraichir_fiche(modal_inter.client, tribu_id_local, modal_inter.guild, modal_inter.channel)
                except Exception as e:
                    await modal_inter.followup.send(f"⚠️ **Note** : Question modifiée mais fiche non rafraîchie. Utilise `/ma_tribu` pour voir.\n`Erreur: {e}`", ephemeral=True)
        
        await inter.response.send_modal(ModalRecrutement())
    
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
                "• **/quitter_tribu** — quitter ta tribu\n"
                "• **/tribu_transférer** — transférer la propriété\n"
                "• **/tribu_supprimer** — supprimer une tribu"
            ),
            inline=False
        )
        
        # Galerie & personnalisation
        e.add_field(
            name="🎨 Galerie & Membres",
            value=(
                "• **/mon_nom_ingame** — modifier ton nom in-game\n"
                "• **/ajouter_logo** — changer le logo (fichier ou URL)\n"
                "• **/ajouter_photo** — ajouter une photo (fichier ou URL)"
            ),
            inline=False
        )
        
        # Gestion admin
        e.add_field(
            name="🔧 Gestion admin (modos/admins)",
            value=(
                "• **/parametres** — gérer les paramètres du bot\n"
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
        
        e.set_footer(text="💡 Utilise /panneau pour un accès rapide aux fonctions principales")
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
                emoji="✅"
            ))
        
        select = discord.ui.Select(
            placeholder="✅ Sélectionne le boss validé...",
            options=options
        )
        
        async def select_callback(select_inter: discord.Interaction):
            # DEFER IMMÉDIATEMENT pour éviter timeout
            await select_inter.response.defer(ephemeral=True)
            
            boss_selectionne = select.values[0]
            
            # Vérifier les droits et ajouter le boss validé
            with db_connect() as conn:
                c = conn.cursor()
                c.execute("SELECT * FROM tribus WHERE id=?", (self.tribu_id,))
                row = c.fetchone()
                
                if not row:
                    await select_inter.followup.send("❌ Tribu introuvable.", ephemeral=True)
                    return
                
                if not (est_admin(select_inter) or select_inter.user.id == row["proprietaire_id"] or est_manager(self.tribu_id, select_inter.user.id)):
                    await select_inter.followup.send("❌ Tu n'as pas la permission de modifier la progression.", ephemeral=True)
                    return
                
                # Récupérer les deux listes
                boss_valides = [b.strip() for b in (row["progression_boss"] or "").split(",") if b.strip()]
                boss_non_valides = [b.strip() for b in (row["progression_boss_non_valides"] or "").split(",") if b.strip()]
                
                # Vérifier si le boss est déjà validé
                if boss_selectionne in boss_valides:
                    await select_inter.followup.send(f"ℹ️ Le boss **{boss_selectionne}** est déjà validé pour {row['nom']}.", ephemeral=True)
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
            await select_inter.followup.send(f"✅ **Boss {boss_selectionne} validé pour {row['nom']} !**", ephemeral=True)
            try:
                await afficher_ou_rafraichir_fiche(select_inter.client, self.tribu_id, select_inter.guild, select_inter.channel)
            except Exception as e:
                print(f"⚠️ Erreur lors du rafraîchissement de la fiche tribu {self.tribu_id}: {e}")
        
        select.callback = select_callback
        view = discord.ui.View(timeout=300)
        view.add_item(select)
        
        await inter.response.send_message("✅ **Marquer un boss comme validé**\n\nSélectionne le boss :", view=view, ephemeral=True)
    
    @discord.ui.button(label="Boss non validé", style=discord.ButtonStyle.danger, emoji="❌", row=4)
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
                emoji="❌"
            ))
        
        select = discord.ui.Select(
            placeholder="❌ Sélectionne le boss non-validé...",
            options=options
        )
        
        async def select_callback(select_inter: discord.Interaction):
            # DEFER IMMÉDIATEMENT pour éviter timeout
            await select_inter.response.defer(ephemeral=True)
            boss_selectionne = select.values[0]
            
            # Vérifier les droits et ajouter le boss non-validé
            with db_connect() as conn:
                c = conn.cursor()
                c.execute("SELECT * FROM tribus WHERE id=?", (self.tribu_id,))
                row = c.fetchone()
                
                if not row:
                    await select_inter.followup.send("❌ Tribu introuvable.", ephemeral=True)
                    return
                
                if not (est_admin(select_inter) or select_inter.user.id == row["proprietaire_id"] or est_manager(self.tribu_id, select_inter.user.id)):
                    await select_inter.followup.send("❌ Tu n'as pas la permission de modifier la progression.", ephemeral=True)
                    return
                
                # Récupérer les deux listes
                boss_valides = [b.strip() for b in (row["progression_boss"] or "").split(",") if b.strip()]
                boss_non_valides = [b.strip() for b in (row["progression_boss_non_valides"] or "").split(",") if b.strip()]
                
                # Vérifier si le boss est déjà non-validé
                if boss_selectionne in boss_non_valides:
                    await select_inter.followup.send(f"ℹ️ Le boss **{boss_selectionne}** est déjà marqué comme non-validé pour {row['nom']}.", ephemeral=True)
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
            await select_inter.followup.send(f"❌ **Boss {boss_selectionne} marqué comme non-validé pour {row['nom']} !**", ephemeral=True)
            try:
                await afficher_ou_rafraichir_fiche(select_inter.client, self.tribu_id, select_inter.guild, select_inter.channel)
            except Exception as e:
                print(f"⚠️ Erreur lors du rafraîchissement de la fiche tribu {self.tribu_id}: {e}")
        
        select.callback = select_callback
        view = discord.ui.View(timeout=300)
        view.add_item(select)
        
        await inter.response.send_message("❌ **Marquer un boss comme non-validé**\n\nSélectionne le boss :", view=view, ephemeral=True)
    
    @discord.ui.button(label="Note validée", style=discord.ButtonStyle.success, emoji="📝", row=3)
    async def btn_note_valide(self, inter: discord.Interaction, button: discord.ui.Button):
        if not self.tribu_id:
            await inter.response.send_message("❌ Erreur : ID de tribu manquant.", ephemeral=True)
            return
        
        # Récupérer toutes les notes disponibles
        with db_connect() as conn:
            c = conn.cursor()
            c.execute("SELECT DISTINCT nom FROM notes WHERE guild_id IN (0, ?) ORDER BY nom", (inter.guild_id,))
            notes_list = [row["nom"] for row in c.fetchall()]
        
        if not notes_list:
            await inter.response.send_message("❌ Aucune note disponible. Contacte un admin pour en ajouter.", ephemeral=True)
            return
        
        # Créer le menu déroulant des notes
        options = []
        for note_nom in notes_list[:25]:  # Discord limite à 25 options
            options.append(discord.SelectOption(
                label=note_nom,
                value=note_nom,
                emoji="📝"
            ))
        
        select = discord.ui.Select(
            placeholder="📝 Sélectionne la note validée...",
            options=options
        )
        
        async def select_callback(select_inter: discord.Interaction):
            # DEFER IMMÉDIATEMENT pour éviter timeout
            await select_inter.response.defer(ephemeral=True)
            note_selectionnee = select.values[0]
            
            # Vérifier les droits et ajouter la note validée
            with db_connect() as conn:
                c = conn.cursor()
                c.execute("SELECT * FROM tribus WHERE id=?", (self.tribu_id,))
                row = c.fetchone()
                
                if not row:
                    await select_inter.followup.send("❌ Tribu introuvable.", ephemeral=True)
                    return
                
                if not (est_admin(select_inter) or select_inter.user.id == row["proprietaire_id"] or est_manager(self.tribu_id, select_inter.user.id)):
                    await select_inter.followup.send("❌ Tu n'as pas la permission de modifier la progression.", ephemeral=True)
                    return
                
                # Récupérer les deux listes
                notes_valides = [n.strip() for n in (row["progression_notes"] or "").split(",") if n.strip()]
                notes_non_valides = [n.strip() for n in (row["progression_notes_non_valides"] or "").split(",") if n.strip()]
                
                # Vérifier si la note est déjà validée
                if note_selectionnee in notes_valides:
                    await select_inter.followup.send(f"ℹ️ La note **{note_selectionnee}** est déjà validée pour {row['nom']}.", ephemeral=True)
                    return
                
                # Retirer de la liste non-validées si présent
                if note_selectionnee in notes_non_valides:
                    notes_non_valides.remove(note_selectionnee)
                
                # Ajouter à la liste des validées
                notes_valides.append(note_selectionnee)
                
                c.execute("UPDATE tribus SET progression_notes=?, progression_notes_non_valides=? WHERE id=?", 
                         (", ".join(notes_valides), ", ".join(notes_non_valides), row["id"]))
                conn.commit()
            
            ajouter_historique(self.tribu_id, select_inter.user.id, "Note validée", note_selectionnee)
            await select_inter.followup.send(f"📝 **Note {note_selectionnee} validée pour {row['nom']} !**", ephemeral=True)
            try:
                await afficher_ou_rafraichir_fiche(select_inter.client, self.tribu_id, select_inter.guild, select_inter.channel)
            except Exception as e:
                print(f"⚠️ Erreur lors du rafraîchissement de la fiche tribu {self.tribu_id}: {e}")
        
        select.callback = select_callback
        view = discord.ui.View(timeout=300)
        view.add_item(select)
        
        await inter.response.send_message("📝 **Marquer une note comme validée**\n\nSélectionne la note :", view=view, ephemeral=True)
    
    @discord.ui.button(label="Note non validée", style=discord.ButtonStyle.danger, emoji="📄", row=3)
    async def btn_note_non_valide(self, inter: discord.Interaction, button: discord.ui.Button):
        if not self.tribu_id:
            await inter.response.send_message("❌ Erreur : ID de tribu manquant.", ephemeral=True)
            return
        
        # Récupérer toutes les notes disponibles
        with db_connect() as conn:
            c = conn.cursor()
            c.execute("SELECT DISTINCT nom FROM notes WHERE guild_id IN (0, ?) ORDER BY nom", (inter.guild_id,))
            notes_list = [row["nom"] for row in c.fetchall()]
        
        if not notes_list:
            await inter.response.send_message("❌ Aucune note disponible. Contacte un admin pour en ajouter.", ephemeral=True)
            return
        
        # Créer le menu déroulant des notes
        options = []
        for note_nom in notes_list[:25]:  # Discord limite à 25 options
            options.append(discord.SelectOption(
                label=note_nom,
                value=note_nom,
                emoji="📄"
            ))
        
        select = discord.ui.Select(
            placeholder="📄 Sélectionne la note non-validée...",
            options=options
        )
        
        async def select_callback(select_inter: discord.Interaction):
            # DEFER IMMÉDIATEMENT pour éviter timeout
            await select_inter.response.defer(ephemeral=True)
            note_selectionnee = select.values[0]
            
            # Vérifier les droits et ajouter la note non-validée
            with db_connect() as conn:
                c = conn.cursor()
                c.execute("SELECT * FROM tribus WHERE id=?", (self.tribu_id,))
                row = c.fetchone()
                
                if not row:
                    await select_inter.followup.send("❌ Tribu introuvable.", ephemeral=True)
                    return
                
                if not (est_admin(select_inter) or select_inter.user.id == row["proprietaire_id"] or est_manager(self.tribu_id, select_inter.user.id)):
                    await select_inter.followup.send("❌ Tu n'as pas la permission de modifier la progression.", ephemeral=True)
                    return
                
                # Récupérer les deux listes
                notes_valides = [n.strip() for n in (row["progression_notes"] or "").split(",") if n.strip()]
                notes_non_valides = [n.strip() for n in (row["progression_notes_non_valides"] or "").split(",") if n.strip()]
                
                # Vérifier si la note est déjà non-validée
                if note_selectionnee in notes_non_valides:
                    await select_inter.followup.send(f"ℹ️ La note **{note_selectionnee}** est déjà marquée comme non-validée pour {row['nom']}.", ephemeral=True)
                    return
                
                # Retirer de la liste validées si présent
                if note_selectionnee in notes_valides:
                    notes_valides.remove(note_selectionnee)
                
                # Ajouter à la liste des non-validées
                notes_non_valides.append(note_selectionnee)
                
                c.execute("UPDATE tribus SET progression_notes=?, progression_notes_non_valides=? WHERE id=?", 
                         (", ".join(notes_valides), ", ".join(notes_non_valides), row["id"]))
                conn.commit()
            
            ajouter_historique(self.tribu_id, select_inter.user.id, "Note non-validée", note_selectionnee)
            await select_inter.followup.send(f"📄 **Note {note_selectionnee} marquée comme non-validée pour {row['nom']} !**", ephemeral=True)
            try:
                await afficher_ou_rafraichir_fiche(select_inter.client, self.tribu_id, select_inter.guild, select_inter.channel)
            except Exception as e:
                print(f"⚠️ Erreur lors du rafraîchissement de la fiche tribu {self.tribu_id}: {e}")
        
        select.callback = select_callback
        view = discord.ui.View(timeout=300)
        view.add_item(select)
        
        await inter.response.send_message("📄 **Marquer une note comme non-validée**\n\nSélectionne la note :", view=view, ephemeral=True)

# ---------- Panneau Staff pour gérer une tribu spécifique ----------
class PanneauStaff(discord.ui.View):
    def __init__(self, tribu_id: int, tribu_nom: str, timeout: Optional[float] = 180):
        super().__init__(timeout=timeout)
        self.tribu_id = tribu_id
        self.tribu_nom = tribu_nom
    
    @discord.ui.button(label="Modifier", style=discord.ButtonStyle.primary, emoji="🛠️", row=0)
    async def btn_modifier(self, inter: discord.Interaction, button: discord.ui.Button):
        await inter.response.send_message(f"ℹ️ Utilise le bouton **Modifier** dans la fiche de **{self.tribu_nom}** pour modifier cette tribu.", ephemeral=True)
    
    @discord.ui.button(label="Personnaliser", style=discord.ButtonStyle.primary, emoji="🎨", row=0)
    async def btn_personnaliser(self, inter: discord.Interaction, button: discord.ui.Button):
        await inter.response.send_message(f"ℹ️ Utilise le bouton **Personnaliser** dans la fiche de **{self.tribu_nom}** pour personnaliser cette tribu.", ephemeral=True)
    
    @discord.ui.button(label="Ajouter membre", style=discord.ButtonStyle.success, emoji="👤", row=1)
    async def btn_ajouter_membre(self, inter: discord.Interaction, button: discord.ui.Button):
        await inter.response.send_message(f"ℹ️ Utilise le bouton **Ajouter membre** dans la fiche de **{self.tribu_nom}** pour ajouter un membre.", ephemeral=True)
    
    @discord.ui.button(label="Supprimer membre", style=discord.ButtonStyle.secondary, emoji="👥", row=1)
    async def btn_supprimer_membre(self, inter: discord.Interaction, button: discord.ui.Button):
        await inter.response.send_message(f"ℹ️ Utilise le bouton **Supprimer membre** dans la fiche de **{self.tribu_nom}** pour supprimer un membre.", ephemeral=True)
    
    @discord.ui.button(label="Ajouter avant-poste", style=discord.ButtonStyle.success, emoji="🏘️", row=2)
    async def btn_ajouter_ap(self, inter: discord.Interaction, button: discord.ui.Button):
        await inter.response.send_message(f"ℹ️ Utilise le bouton **Ajouter avant-poste** dans la fiche de **{self.tribu_nom}** pour ajouter un avant-poste.", ephemeral=True)
    
    @discord.ui.button(label="Supprimer avant-poste", style=discord.ButtonStyle.secondary, emoji="🏚️", row=2)
    async def btn_supprimer_ap(self, inter: discord.Interaction, button: discord.ui.Button):
        await inter.response.send_message(f"ℹ️ Utilise le bouton **Supprimer avant-poste** dans la fiche de **{self.tribu_nom}** pour supprimer un avant-poste.", ephemeral=True)
    
    @discord.ui.button(label="Réafficher fiche", style=discord.ButtonStyle.primary, emoji="🔄", row=3)
    async def btn_afficher(self, inter: discord.Interaction, button: discord.ui.Button):
        # Réafficher la fiche de cette tribu
        await afficher_fiche(inter, self.tribu_id)
    
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
            c.execute("SELECT * FROM bases_premium WHERE tribu_id=? ORDER BY created_at DESC", (self.tribu_id,))
            bases_premium = c.fetchall()
        
        # Récupérer l'avatar du créateur
        createur_avatar_url = None
        try:
            createur = await inter.client.fetch_user(tribu['proprietaire_id'])
            if createur:
                createur_avatar_url = createur.display_avatar.url
        except:
            pass
        
        # Créer le nouvel embed avec la nouvelle photo avec GESTION D'ERREUR
        try:
            embed = embed_tribu(tribu, membres, avant_postes, createur_avatar_url, photos, nouvel_index, bases_premium)
        except Exception as e:
            print(f"❌ ERREUR _changer_photo pour tribu {self.tribu_id}: {str(e)[:200]}")
            await inter.response.send_message("❌ Erreur lors du changement de photo. Un champ est peut-être trop long.", ephemeral=True)
            return
        
        # Mettre à jour la vue avec le nouvel index
        new_view = MenuFicheTribu(self.tribu_id, nouvel_index, timeout=None)
        
        # Mettre à jour le message
        try:
            await inter.response.edit_message(embed=embed, view=new_view)
        except Exception as e:
            print(f"⚠️ Erreur edit_message dans _changer_photo: {e}")
            await inter.response.send_message("❌ Erreur lors de la mise à jour.", ephemeral=True)
    
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
        # DEFER immédiatement pour éviter le timeout
        await inter.response.defer(ephemeral=True)
        
        # Récupérer les infos de la tribu
        with db_connect() as conn:
            c = conn.cursor()
            c.execute("SELECT * FROM tribus WHERE id=?", (self.tribu_id,))
            tribu = c.fetchone()
            if not tribu:
                await inter.followup.send("❌ Tribu introuvable.", ephemeral=True)
                return
        
        # Afficher le panneau d'aide membre
        view = PanneauMembre(tribu['nom'], self.tribu_id)
        
        e = discord.Embed(
            title=f"💡 Mes Commandes — {tribu['nom']}",
            description="Voici les commandes utiles pour gérer ta tribu.\n\n**Actions disponibles :**\n• Modifier ton nom in-game\n• Afficher ta fiche tribu\n• Gérer membres et avant-postes\n• Consulter l'aide et le guide",
            color=0x5865F2
        )
        e.set_footer(text="💡 Panneau visible uniquement par toi • Utilise les boutons pour plus d'infos")
        
        await inter.followup.send(embed=e, view=view, ephemeral=True)
    
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
        view = discord.ui.View(timeout=300)
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
        # DEFER immédiatement pour éviter le timeout
        await inter.response.defer(ephemeral=True)
        
        # Vérifier que l'utilisateur est membre
        with db_connect() as conn:
            c = conn.cursor()
            c.execute("SELECT * FROM tribus WHERE id=?", (self.tribu_id,))
            tribu = c.fetchone()
            if not tribu:
                await inter.followup.send("❌ Tribu introuvable.", ephemeral=True)
                return
            
            # Ne peut pas quitter si référent
            if inter.user.id == tribu["proprietaire_id"]:
                await inter.followup.send("❌ Le référent tribu ne peut pas quitter. Utilise `/tribu_transférer` d'abord.", ephemeral=True)
                return
            
            c.execute("SELECT * FROM membres WHERE tribu_id=? AND user_id=?", (self.tribu_id, inter.user.id))
            if not c.fetchone():
                await inter.followup.send("❌ Tu n'es pas membre de cette tribu.", ephemeral=True)
                return
            
            # Retirer le membre
            c.execute("DELETE FROM membres WHERE tribu_id=? AND user_id=?", (self.tribu_id, inter.user.id))
            conn.commit()
        
        ajouter_historique(self.tribu_id, inter.user.id, "Quitter tribu", f"<@{inter.user.id}> a quitté la tribu")
        await inter.followup.send(f"✅ Tu as quitté la tribu **{tribu['nom']}**.", ephemeral=True)
    
    async def action_historique(self, inter: discord.Interaction):
        # DEFER immédiatement pour éviter le timeout
        await inter.response.defer(ephemeral=True)
        
        # Vérifier les permissions (managers, admin ou modo)
        with db_connect() as conn:
            c = conn.cursor()
            c.execute("SELECT * FROM tribus WHERE id=?", (self.tribu_id,))
            tribu = c.fetchone()
            if not tribu:
                await inter.followup.send("❌ Tribu introuvable.", ephemeral=True)
                return
            
            # Vérifier les droits
            has_perm = (est_admin_ou_modo(inter) or 
                       inter.user.id == tribu["proprietaire_id"] or 
                       est_manager(self.tribu_id, inter.user.id))
            
            if not has_perm:
                await inter.followup.send("❌ Seuls les managers, admins et modos peuvent voir l'historique.", ephemeral=True)
                return
        
        # Créer la vue avec pagination
        view = HistoriqueView(self.tribu_id, tribu['nom'], offset=0)
        
        # Initialiser l'embed ET configurer le bouton
        embed = await view.create_embed()
        
        if embed is None:
            await inter.followup.send("📜 Aucun historique pour cette tribu.", ephemeral=True)
            return
        
        # Le bouton est maintenant correctement configuré
        await inter.followup.send(embed=embed, view=view, ephemeral=True)
    
    async def action_staff(self, inter: discord.Interaction):
        # DEFER immédiatement pour éviter le timeout
        await inter.response.defer(ephemeral=True)
        
        # Vérifie si admin ou modo
        if not est_admin_ou_modo(inter):
            await inter.followup.send("❌ Cette fonction est réservée aux admins et modos.", ephemeral=True)
            return
        
        # Récupérer les infos de la tribu
        with db_connect() as conn:
            c = conn.cursor()
            c.execute("SELECT * FROM tribus WHERE id=?", (self.tribu_id,))
            tribu = c.fetchone()
            if not tribu:
                await inter.followup.send("❌ Tribu introuvable.", ephemeral=True)
                return
        
        # Afficher le panneau staff
        view = PanneauStaff(self.tribu_id, tribu['nom'])
        
        e = discord.Embed(
            title=f"⚙️ Panneau Staff — {tribu['nom']}",
            description="Utilise les boutons ci-dessous pour gérer cette tribu directement.\n\n**Actions disponibles :**\n• Modifier / Personnaliser\n• Gérer membres et avant-postes\n• Réafficher ou supprimer la tribu",
            color=0xFF6B6B
        )
        e.set_footer(text="🔒 Panneau visible uniquement par toi • Les actions s'appliquent à cette tribu")
        
        await inter.followup.send(embed=e, view=view, ephemeral=True)

async def verifier_droits(inter: discord.Interaction, tribu) -> bool:
    if est_admin(inter) or inter.user.id == tribu["proprietaire_id"] or est_manager(tribu["id"], inter.user.id):
        return True
    await inter.response.send_message("❌ Tu n'as pas la permission de modifier cette tribu.", ephemeral=True)
    return False

async def verifier_droits_defer(inter: discord.Interaction, tribu) -> bool:
    """Version de verifier_droits pour les interactions déjà defer()"""
    if est_admin(inter) or inter.user.id == tribu["proprietaire_id"] or est_manager(tribu["id"], inter.user.id):
        return True
    await inter.followup.send("❌ Tu n'as pas la permission de modifier cette tribu.", ephemeral=True)
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

async def afficher_fiche(inter: discord.Interaction, tribu_id: int, ephemeral: bool = False, force_current_channel: bool = False):
    """Affiche la fiche tribu (utilisée par les boutons et commandes)
    
    Args:
        inter: L'interaction Discord
        tribu_id: ID de la tribu à afficher
        ephemeral: Si True, affiche un message éphémère
        force_current_channel: Si True, ignore le salon configuré et affiche dans le salon actuel (pour /fiche_tribu admin)
    """
    with db_connect() as conn:
        c = conn.cursor()
        c.execute("SELECT * FROM tribus WHERE id=?", (tribu_id,))
        tribu = c.fetchone()
        if not tribu:
            await inter.response.send_message("❌ Tribu introuvable.", ephemeral=True)
            return
        
        c.execute("SELECT * FROM membres WHERE tribu_id=? ORDER BY manager DESC, user_id ASC", (tribu_id,))
        membres = c.fetchall()
        c.execute("SELECT * FROM avant_postes WHERE tribu_id=? ORDER BY created_at DESC", (tribu_id,))
        avant_postes = c.fetchall()
        c.execute("SELECT id, url, ordre FROM photos_tribu WHERE tribu_id=? ORDER BY ordre", (tribu_id,))
        photos = c.fetchall()
        c.execute("SELECT * FROM bases_premium WHERE tribu_id=? ORDER BY created_at DESC", (tribu_id,))
        bases_premium = c.fetchall()
        
        # Récupérer l'avatar du créateur
        createur_avatar_url = None
        try:
            createur = await inter.client.fetch_user(tribu['proprietaire_id'])
            if createur:
                createur_avatar_url = createur.display_avatar.url
        except:
            pass
        
        # Créer l'embed et le menu
        embed = embed_tribu(tribu, membres, avant_postes, createur_avatar_url, photos, 0, bases_premium)
        view = MenuFicheTribu(tribu_id, 0, timeout=None)
        
        # Déterminer le salon cible
        target_channel = inter.channel
        
        # Si force_current_channel=True (commande admin /fiche_tribu), on ignore le salon configuré
        if not ephemeral and not force_current_channel:
            # Récupérer le salon configuré
            salon_id_str = get_config(inter.guild_id, "salon_fiche_tribu", "0")
            if salon_id_str != "0":
                configured_channel = inter.guild.get_channel(int(salon_id_str))
                if configured_channel:
                    target_channel = configured_channel
        
        # 🗑️ SUPPRIMER L'ANCIENNE FICHE AVANT D'EN CRÉER UNE NOUVELLE
        if not ephemeral and inter.guild:
            old_message_id = tribu["message_id"] if "message_id" in tribu.keys() else 0
            old_channel_id = tribu["channel_id"] if "channel_id" in tribu.keys() else 0
            old_message_id = old_message_id or 0
            old_channel_id = old_channel_id or 0
            
            if old_message_id and old_channel_id:
                try:
                    old_channel = inter.guild.get_channel(old_channel_id)
                    if old_channel and hasattr(old_channel, 'fetch_message'):
                        old_message = await old_channel.fetch_message(old_message_id)
                        await old_message.delete()
                        print(f"🗑️ Ancienne fiche supprimée (message {old_message_id})")
                except Exception as e:
                    print(f"⚠️ Impossible de supprimer l'ancienne fiche: {e}")
        
        # Envoyer la fiche
        if not ephemeral and target_channel != inter.channel:
            # Afficher dans un salon différent
            # Répondre d'abord à l'interaction
            if inter.response.is_done():
                await inter.followup.send(f"✅ **Fiche affichée dans {target_channel.mention} !**", ephemeral=True)
            else:
                await inter.response.send_message(f"✅ **Fiche affichée dans {target_channel.mention} !**", ephemeral=True)
            
            # Envoyer la fiche dans le salon configuré
            msg = await target_channel.send(embed=embed, view=view)
            
            # Sauvegarder le message_id et channel_id
            c.execute("UPDATE tribus SET message_id=?, channel_id=? WHERE id=?", 
                     (msg.id, msg.channel.id, tribu_id))
            conn.commit()
        else:
            # Affichage normal dans le salon actuel
            if inter.response.is_done():
                msg = await inter.followup.send(embed=embed, view=view, ephemeral=ephemeral, wait=True)
            else:
                await inter.response.send_message(embed=embed, view=view, ephemeral=ephemeral)
                msg = await inter.original_response()
            
            # Sauvegarder le message_id et channel_id (seulement si pas ephemeral)
            if not ephemeral:
                c.execute("UPDATE tribus SET message_id=?, channel_id=? WHERE id=?", 
                         (msg.id, msg.channel.id, tribu_id))
                conn.commit()

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
        c.execute("SELECT * FROM bases_premium WHERE tribu_id=? ORDER BY created_at DESC", (tribu_id,))
        bases_premium = c.fetchall()
        
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
        embed = embed_tribu(tribu, membres, avant_postes, createur_avatar_url, photos, 0, bases_premium)
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

async def rafraichir_fiche_tribu(client, tribu_id: int):
    """Rafraîchit automatiquement la fiche tribu existante après une modification"""
    with db_connect() as conn:
        c = conn.cursor()
        c.execute("SELECT * FROM tribus WHERE id=?", (tribu_id,))
        tribu = c.fetchone()
        
        if not tribu:
            return
        
        # Récupérer message_id et channel_id
        message_id = tribu["message_id"] if "message_id" in tribu.keys() else 0
        channel_id = tribu["channel_id"] if "channel_id" in tribu.keys() else 0
        message_id = message_id or 0
        channel_id = channel_id or 0
        
        # Si pas de message existant, ne rien faire
        if not message_id or not channel_id:
            return
        
        # Récupérer les données
        c.execute("SELECT * FROM membres WHERE tribu_id=? ORDER BY manager DESC, user_id ASC", (tribu_id,))
        membres = c.fetchall()
        c.execute("SELECT * FROM avant_postes WHERE tribu_id=? ORDER BY created_at DESC", (tribu_id,))
        avant_postes = c.fetchall()
        c.execute("SELECT id, url, ordre FROM photos_tribu WHERE tribu_id=? ORDER BY ordre", (tribu_id,))
        photos = c.fetchall()
        c.execute("SELECT * FROM bases_premium WHERE tribu_id=? ORDER BY created_at DESC", (tribu_id,))
        bases_premium = c.fetchall()
        
        # Récupérer l'avatar du créateur
        createur_avatar_url = None
        try:
            createur = await client.fetch_user(tribu['proprietaire_id'])
            if createur:
                createur_avatar_url = createur.display_avatar.url
        except:
            pass
        
        # Créer l'embed mis à jour avec GESTION D'ERREUR
        try:
            embed = embed_tribu(tribu, membres, avant_postes, createur_avatar_url, photos, 0, bases_premium)
            view = MenuFicheTribu(tribu_id, 0, timeout=None)
        except Exception as e:
            print(f"❌ ERREUR embed_tribu() dans rafraichir_fiche_tribu pour tribu {tribu_id}: {str(e)[:200]}")
            print(f"⚠️ Probable: un champ dépasse 1024 caractères. Utiliser /corriger_champ")
            return
        
        # Éditer le message existant
        try:
            channel = client.get_channel(channel_id)
            if channel:
                message = await channel.fetch_message(message_id)
                await message.edit(embed=embed, view=view)
        except:
            # Message introuvable ou supprimé, ne rien faire
            pass

async def afficher_ou_rafraichir_fiche(client, tribu_id: int, guild, fallback_channel=None):
    """
    Fonction pour créer une NOUVELLE fiche tribu à chaque modification.
    - Supprime l'ancienne fiche si elle existe
    - Crée toujours une nouvelle fiche dans le salon configuré (ou fallback_channel)
    """
    with db_connect() as conn:
        c = conn.cursor()
        c.execute("SELECT * FROM tribus WHERE id=?", (tribu_id,))
        tribu = c.fetchone()
        
        if not tribu:
            print(f"⚠️ Tribu {tribu_id} introuvable")
            return
        
        # Récupérer les données de la tribu
        c.execute("SELECT * FROM membres WHERE tribu_id=? ORDER BY manager DESC, user_id ASC", (tribu_id,))
        membres = c.fetchall()
        c.execute("SELECT * FROM avant_postes WHERE tribu_id=? ORDER BY created_at DESC", (tribu_id,))
        avant_postes = c.fetchall()
        c.execute("SELECT id, url, ordre FROM photos_tribu WHERE tribu_id=? ORDER BY ordre", (tribu_id,))
        photos = c.fetchall()
        c.execute("SELECT * FROM bases_premium WHERE tribu_id=? ORDER BY created_at DESC", (tribu_id,))
        bases_premium = c.fetchall()
        
        # Récupérer l'avatar du créateur
        createur_avatar_url = None
        try:
            createur = await client.fetch_user(tribu['proprietaire_id'])
            if createur:
                createur_avatar_url = createur.display_avatar.url
        except:
            pass
        
        # Créer l'embed et la vue avec GESTION D'ERREUR
        try:
            embed = embed_tribu(tribu, membres, avant_postes, createur_avatar_url, photos, 0, bases_premium)
            view = MenuFicheTribu(tribu_id, 0, timeout=None)
        except Exception as e:
            print(f"❌ ERREUR embed_tribu() pour tribu {tribu_id} ({tribu['nom']}): {str(e)[:200]}")
            print(f"⚠️ Probable: un champ dépasse 1024 caractères. Utiliser /corriger_champ")
            # Ne pas crasher le bot, juste arrêter la mise à jour
            return
        
        # Récupérer message_id et channel_id de l'ancienne fiche
        message_id = tribu["message_id"] if tribu["message_id"] else 0
        channel_id = tribu["channel_id"] if tribu["channel_id"] else 0
        
        # Supprimer l'ancienne fiche si elle existe
        if message_id and channel_id and channel_id != 0:
            try:
                channel = client.get_channel(channel_id)
                if channel:
                    old_message = await channel.fetch_message(message_id)
                    await old_message.delete()
                    print(f"🗑️ Ancienne fiche supprimée pour tribu {tribu_id}")
            except Exception as e:
                print(f"⚠️ Impossible de supprimer ancienne fiche: {e}")
        
        # Déterminer le salon cible pour la nouvelle fiche
        target_channel = None
        
        # 1. Essayer le salon configuré
        salon_config = get_config(tribu["guild_id"], "salon_fiche_tribu", "0")
        target_channel_id = int(salon_config) if salon_config != "0" else 0
        
        if target_channel_id and target_channel_id != 0:
            target_channel = client.get_channel(target_channel_id)
            if target_channel:
                print(f"📍 Utilisation du salon configuré: {target_channel.name}")
        
        # 2. Sinon, utiliser le fallback_channel (salon de l'interaction)
        if not target_channel and fallback_channel:
            target_channel = fallback_channel
            print(f"📍 Utilisation du salon fallback (interaction): {target_channel.name}")
        
        # 3. Sinon, chercher le premier salon textuel disponible
        if not target_channel:
            for channel in guild.text_channels:
                if channel.permissions_for(guild.me).send_messages:
                    target_channel = channel
                    print(f"📍 Utilisation du premier salon disponible: {target_channel.name}")
                    break
        
        # Créer et envoyer la NOUVELLE fiche
        if target_channel:
            new_message = await target_channel.send(embed=embed, view=view)
            # Sauvegarder le nouveau message_id et channel_id
            with db_connect() as conn2:
                c2 = conn2.cursor()
                c2.execute("UPDATE tribus SET message_id=?, channel_id=? WHERE id=?", 
                         (new_message.id, new_message.channel.id, tribu_id))
                conn2.commit()
            print(f"✅ Nouvelle fiche créée pour tribu {tribu_id} (message {new_message.id} dans canal {target_channel.name})")
        else:
            error_msg = f"Aucun salon accessible trouvé pour créer la fiche tribu {tribu_id}"
            print(f"❌ {error_msg}")
            raise Exception(error_msg)

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
    embed.set_footer(text="ℹ️ Utilisez le panneau de la fiche tribu pour ajouter des membres et des avant-postes")
    await inter.response.send_message("✅ **Tribu créée !**", embed=embed)

@tribu_creer.autocomplete('map_base')
async def map_autocomplete(inter: discord.Interaction, current: str):
    return get_maps_choices(inter.guild_id)

async def autocomplete_tribus(inter: discord.Interaction, current: str):
    """Autocomplétion pour les noms de tribus"""
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

@tree.command(name="fiche_tribu", description="[ADMIN/MODO] Afficher la fiche d'une tribu dans le salon actuel")
@app_commands.describe(nom="Nom de la tribu")
@app_commands.autocomplete(nom=autocomplete_tribus)
async def fiche_tribu(inter: discord.Interaction, nom: str):
    # DEFER immédiatement pour éviter le timeout
    await inter.response.defer()
    
    if not est_admin_ou_modo(inter):
        await inter.followup.send("❌ Cette commande est réservée aux admins et modos.", ephemeral=True)
        return
    
    row = tribu_par_nom(inter.guild_id, nom)
    if not row:
        await inter.followup.send("❌ Aucune tribu trouvée avec ce nom.", ephemeral=True)
        return
    
    # Récupérer toutes les données de la tribu
    tribu_id = row["id"]
    with db_connect() as conn:
        c = conn.cursor()
        c.execute("SELECT * FROM membres WHERE tribu_id=? ORDER BY manager DESC, user_id ASC", (tribu_id,))
        membres = c.fetchall()
        c.execute("SELECT * FROM avant_postes WHERE tribu_id=? ORDER BY created_at DESC", (tribu_id,))
        avant_postes = c.fetchall()
        c.execute("SELECT id, url, ordre FROM photos_tribu WHERE tribu_id=? ORDER BY ordre", (tribu_id,))
        photos = c.fetchall()
        c.execute("SELECT * FROM bases_premium WHERE tribu_id=? ORDER BY created_at DESC", (tribu_id,))
        bases_premium = c.fetchall()
    
    # Récupérer l'avatar du créateur
    createur_avatar_url = None
    try:
        createur = await inter.client.fetch_user(row['proprietaire_id'])
        if createur:
            createur_avatar_url = createur.display_avatar.url
    except:
        pass
    
    # Créer l'embed et la vue avec gestion d'erreur
    try:
        embed = embed_tribu(row, membres, avant_postes, createur_avatar_url, photos, 0, bases_premium)
        view = MenuFicheTribu(tribu_id, 0, timeout=None)
    except Exception as e:
        await inter.followup.send(
            f"❌ **Erreur lors de la création de la fiche de tribu `{nom}`**\n\n"
            f"**Cause probable :** Un ou plusieurs champs dépassent la limite Discord de 1024 caractères.\n\n"
            f"**Solution :** Utilise `/corriger_champ nom:{nom} champ:description nouveau_texte:[texte raccourci]`\n"
            f"(Remplace `description` par `devise` ou `objectif` selon le champ problématique)\n\n"
            f"```Erreur technique: {str(e)[:200]}```",
            ephemeral=True
        )
        return
    
    # 🗑️ SUPPRIMER L'ANCIENNE FICHE si elle existe
    if inter.guild:
        old_message_id = row["message_id"] if "message_id" in row.keys() else 0
        old_channel_id = row["channel_id"] if "channel_id" in row.keys() else 0
        old_message_id = old_message_id or 0
        old_channel_id = old_channel_id or 0
        
        if old_message_id and old_channel_id:
            try:
                old_channel = inter.guild.get_channel(old_channel_id)
                if old_channel and hasattr(old_channel, 'fetch_message'):
                    old_message = await old_channel.fetch_message(old_message_id)
                    await old_message.delete()
                    print(f"🗑️ Ancienne fiche supprimée (message {old_message_id})")
            except Exception as e:
                print(f"⚠️ Impossible de supprimer l'ancienne fiche: {e}")
    
    # Envoyer la nouvelle fiche dans le salon actuel avec gestion d'erreur
    try:
        msg = await inter.followup.send(embed=embed, view=view, wait=True)
        
        # Sauvegarder le nouveau message_id et channel_id
        with db_connect() as conn:
            c = conn.cursor()
            c.execute("UPDATE tribus SET message_id=?, channel_id=? WHERE id=?", 
                     (msg.id, msg.channel.id, tribu_id))
            conn.commit()
    except Exception as e:
        await inter.followup.send(
            f"❌ **Erreur lors de l'envoi de la fiche**\n\n"
            f"**Cause probable :** Un champ dépasse la limite Discord (1024 caractères).\n\n"
            f"**Solution :** Utilise `/corriger_champ` pour corriger les champs trop longs.\n\n"
            f"```{str(e)[:300]}```",
            ephemeral=True
        )






@tree.command(name="tribu_transférer", description="Transférer la propriété d'une tribu")
@app_commands.describe(nom="Nom de la tribu", nouveau_proprio="Nouveau propriétaire")
async def tribu_transferer(inter: discord.Interaction, nom: str, nouveau_proprio: discord.Member):
    # DEFER immédiatement pour éviter le timeout
    await inter.response.defer(ephemeral=True)
    
    row = tribu_par_nom(inter.guild_id, nom)
    if not row:
        await inter.followup.send("❌ Aucune tribu trouvée avec ce nom.", ephemeral=True)
        return
    if not (est_admin(inter) or inter.user.id == row["proprietaire_id"]):
        await inter.followup.send("❌ Seul le propriétaire actuel (ou un admin) peut transférer la tribu.", ephemeral=True)
        return
    with db_connect() as conn:
        c = conn.cursor()
        c.execute("UPDATE tribus SET proprietaire_id=? WHERE id=?", (nouveau_proprio.id, row["id"]))
        c.execute("INSERT OR REPLACE INTO membres (tribu_id, user_id, role, manager) VALUES (?, ?, ?, 1)",
                  (row["id"], nouveau_proprio.id, "Chef",))
        conn.commit()
    
    ajouter_historique(row["id"], inter.user.id, "Transfert propriété", f"Nouveau propriétaire: <@{nouveau_proprio.id}>")
    
    # Répondre AVANT le rafraîchissement
    await inter.followup.send(f"✅ **Propriété de {row['nom']} transférée à <@{nouveau_proprio.id}> !**", ephemeral=True)
    
    # Rafraîchir la fiche APRÈS avoir répondu
    try:
        await afficher_ou_rafraichir_fiche(inter.client, row["id"], inter.guild, inter.channel)
    except Exception as e:
        await inter.followup.send(f"⚠️ **Note** : Tribu transférée mais fiche non rafraîchie. Utilise `/ma_tribu` pour voir.\n`Erreur: {e}`", ephemeral=True)

@tree.command(name="tribu_supprimer", description="Supprimer une tribu (confirmation requise)")
@app_commands.describe(nom="Nom de la tribu", confirmation="Retape exactement le nom pour confirmer")
async def tribu_supprimer(inter: discord.Interaction, nom: str, confirmation: str):
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


@tree.command(name="corriger_champ", description="[ADMIN/MODO] Corriger un champ de tribu qui dépasse la limite Discord")
@app_commands.describe(
    nom="Nom de la tribu",
    champ="Champ à corriger (description/devise/objectif)",
    nouveau_texte="Nouveau texte (max 1024 caractères)"
)
@app_commands.autocomplete(nom=autocomplete_tribus)
async def corriger_champ(inter: discord.Interaction, nom: str, champ: str, nouveau_texte: str):
    await inter.response.defer(ephemeral=True)
    
    if not est_admin_ou_modo(inter):
        await inter.followup.send("❌ Cette commande est réservée aux admins et modos.", ephemeral=True)
        return
    
    # Vérifier que le champ est valide
    champs_autorises = ["description", "devise", "objectif"]
    if champ.lower() not in champs_autorises:
        await inter.followup.send(f"❌ Champ invalide. Champs autorisés : {', '.join(champs_autorises)}", ephemeral=True)
        return
    
    # Vérifier la longueur
    if len(nouveau_texte) > 1024:
        await inter.followup.send(f"❌ Le texte est trop long ({len(nouveau_texte)} caractères). Maximum : 1024 caractères.\n\n**Astuce** : Coupe ton texte pour qu'il fasse moins de 1024 caractères.", ephemeral=True)
        return
    
    row = tribu_par_nom(inter.guild_id, nom)
    if not row:
        await inter.followup.send("❌ Aucune tribu trouvée avec ce nom.", ephemeral=True)
        return
    
    # Mettre à jour le champ
    with db_connect() as conn:
        c = conn.cursor()
        c.execute(f"UPDATE tribus SET {champ}=? WHERE id=?", (nouveau_texte, row["id"]))
        conn.commit()
    
    ajouter_historique(row["id"], inter.user.id, f"Correction {champ}", f"Texte corrigé par admin ({len(nouveau_texte)} caractères)")
    
    await inter.followup.send(f"✅ **Champ `{champ}` de la tribu {row['nom']} corrigé !**\n\n📝 Nouveau texte ({len(nouveau_texte)} caractères) :\n```\n{nouveau_texte[:500]}{'...' if len(nouveau_texte) > 500 else ''}\n```", ephemeral=True)
    
    # Rafraîchir la fiche
    try:
        await afficher_ou_rafraichir_fiche(inter.client, row["id"], inter.guild, inter.channel)
    except Exception as e:
        await inter.followup.send(f"⚠️ Champ corrigé mais fiche non rafraîchie. Utilise `/fiche_tribu` pour voir.\n`Erreur: {e}`", ephemeral=True)



@tree.command(name="test_bot", description="Vérifier si le bot répond")
async def tribu_test(inter: discord.Interaction):
    await inter.response.send_message("🐔 Tout roule ma poule")



@tree.command(name="mon_nom_ingame", description="Ajouter ou modifier ton nom In Game")
@app_commands.describe(nom_ingame="Ton nom dans le jeu (ex: Raptor_Killer42)")
async def mon_nom_ingame(inter: discord.Interaction, nom_ingame: str):
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


@tree.command(name="changer_bannière_panneau", description="[ADMIN] Modifier la bannière du panneau")
@app_commands.describe(
    url="URL de la bannière (optionnel si tu fournis un fichier)",
    fichier="Image à uploader depuis ton téléphone/PC (optionnel si tu fournis une URL)"
)
async def changer_banniere_panneau(inter: discord.Interaction, url: Optional[str] = None, fichier: Optional[discord.Attachment] = None):
    if not est_admin(inter):
        await inter.response.send_message("❌ Cette commande est réservée aux administrateurs.", ephemeral=True)
        return
    
    # Vérifier qu'au moins un des deux est fourni
    if not url and not fichier:
        await inter.response.send_message("❌ Tu dois fournir soit une URL, soit un fichier image.", ephemeral=True)
        return
    
    # Si un fichier est fourni, vérifier que c'est une image
    if fichier:
        if not fichier.content_type or not fichier.content_type.startswith("image/"):
            await inter.response.send_message("❌ Le fichier doit être une image (JPG, PNG, GIF, etc.).", ephemeral=True)
            return
        # Utiliser l'URL du fichier uploadé
        banniere_url = fichier.url
        source = "📱 depuis un fichier"
    else:
        banniere_url = url.strip()
        # Vérifier que c'est une URL valide
        if not banniere_url.startswith("http://") and not banniere_url.startswith("https://"):
            await inter.response.send_message("❌ L'URL doit commencer par http:// ou https://", ephemeral=True)
            return
        source = "🔗 depuis une URL"
    
    # Sauvegarder la nouvelle bannière
    set_config(inter.guild_id, "banniere_panneau", banniere_url)
    
    await inter.response.send_message(f"✅ **Bannière du panneau modifiée !** {source}\n\n💡 *Utilise `/panneau` pour voir le résultat.*", ephemeral=True)

@tree.command(name="ma_tribu", description="Afficher la fiche de ma tribu")
async def ma_tribu(inter: discord.Interaction):
    # DEFER immédiatement pour éviter timeout
    await inter.response.defer(ephemeral=True)
    
    # Trouver la tribu de l'utilisateur
    with db_connect() as conn:
        c = conn.cursor()
        c.execute("""
            SELECT t.* FROM tribus t
            LEFT JOIN membres m ON t.id = m.tribu_id
            WHERE t.guild_id = ? AND (t.proprietaire_id = ? OR m.user_id = ?)
        """, (inter.guild_id, inter.user.id, inter.user.id))
        row = c.fetchone()
    
    if not row:
        await inter.followup.send("❌ Tu ne fais partie d'aucune tribu. Utilise `/panneau` pour créer ou rejoindre une tribu !", ephemeral=True)
        return
    
    # Supprimer l'ancienne fiche si elle existe dans ce même salon
    if row["message_id"] and row["channel_id"] == inter.channel_id:
        try:
            channel = bot.get_channel(row["channel_id"])
            if channel:
                message = await channel.fetch_message(row["message_id"])
                await message.delete()
                print(f"✅ Ancienne fiche de '{row['nom']}' supprimée du salon {inter.channel_id}")
        except discord.NotFound:
            print(f"⚠️ Ancienne fiche introuvable (déjà supprimée)")
        except Exception as e:
            print(f"⚠️ Erreur lors de la suppression de l'ancienne fiche : {e}")
    
    # Afficher la nouvelle fiche de la tribu
    await afficher_fiche(inter, row["id"], ephemeral=False)

@tree.command(name="aide", description="Afficher la liste des commandes du bot")
async def aide(inter: discord.Interaction):
    e = discord.Embed(
        title="Aide — Arki Family",
        description=(
            "La création et la gestion des fiches tribu se font désormais uniquement "
            f"sur le site.\n\n[Ouvrir mon espace]({TRIBE_SITE_URL}/mon-espace)\n"
            f"[Consulter les tribus]({TRIBE_SITE_URL}/tribus)"
        ),
        color=0x5865F2
    )
    e.add_field(
        name="Autres fonctions du bot",
        value="**/test_bot** — vérifier que le bot répond\n"
              "**/save_test** et **/show_test** — tests Arki Identité",
        inline=False
    )
    await inter.response.send_message(embed=e, ephemeral=True)

# ---------- Commandes de Test DB Arki Identité (pour Railway) ----------
@tree.command(name="save_test", description="[TEST] Enregistrer une donnée dans la base Arki Identité")
@app_commands.describe(texte="Le texte à enregistrer pour tester la base de données")
async def save_test(inter: discord.Interaction, texte: str):
    """Commande de test pour enregistrer une donnée dans la base Arki Identité"""
    try:
        with identite_db_connect() as conn:
            cursor = conn.cursor()
            cursor.execute("INSERT INTO users (user_id, data) VALUES (?, ?)", (str(inter.user.id), texte))
            conn.commit()
        await inter.response.send_message(
            f"✅ **Donnée sauvegardée pour {inter.user.display_name}**\n📝 Contenu : `{texte}`", 
            ephemeral=True
        )
    except Exception as e:
        await inter.response.send_message(f"❌ Erreur lors de la sauvegarde : {e}", ephemeral=True)

@tree.command(name="show_test", description="[TEST] Afficher la dernière donnée enregistrée")
async def show_test(inter: discord.Interaction):
    """Commande de test pour afficher la dernière donnée enregistrée dans Arki Identité"""
    try:
        with identite_db_connect() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT data FROM users WHERE user_id = ? ORDER BY rowid DESC LIMIT 1", (str(inter.user.id),))
            result = cursor.fetchone()
        
        if result:
            await inter.response.send_message(
                f"📦 **Dernière donnée enregistrée**\n`{result[0]}`", 
                ephemeral=True
            )
        else:
            await inter.response.send_message("ℹ️ Aucune donnée trouvée pour toi 🫤", ephemeral=True)
    except Exception as e:
        await inter.response.send_message(f"❌ Erreur lors de la lecture : {e}", ephemeral=True)

# ---------- UI (boutons + modals) ----------
class ModalCreerTribu(discord.ui.Modal, title="✨ Créer une tribu"):
    nom = discord.ui.TextInput(label="Nom de la tribu", placeholder="Ex: Les Spinos", required=True, max_length=100)
    nom_ingame = discord.ui.TextInput(label="Ton nom In Game", placeholder="Ex: Raptor_Killer42", required=True, max_length=100)
    map_base = discord.ui.TextInput(label="Base principale - Map", placeholder="Ex: The Island", required=True, max_length=100)
    coords_base = discord.ui.TextInput(label="Base principale - Coordonnées", placeholder="Ex: 45.5, 32.6", required=True, max_length=50)
    description = discord.ui.TextInput(label="Description (optionnel)", placeholder="Une brève description de la tribu", required=False, style=discord.TextStyle.paragraph, max_length=1024)

    async def on_submit(self, inter: discord.Interaction):
        # Différer immédiatement pour éviter le timeout (la création prend du temps)
        await inter.response.defer(ephemeral=False)
        
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
        
        # Afficher la fiche de la nouvelle tribu
        # Note: on utilise followup car le defer a déjà été appelé
        note = "ℹ️ **Autres options disponibles** : Utilise les boutons « Modifier », « Personnaliser » et « Guide » pour compléter ta fiche !"
        await inter.followup.send(f"✅ **Tribu {self.nom.value} créée !**\n{note}", ephemeral=True)
        
        # Afficher la fiche automatiquement
        try:
            await afficher_ou_rafraichir_fiche(inter.client, tid, inter.guild, inter.channel)
        except Exception as e:
            print(f"⚠️ Erreur lors de l'affichage de la fiche tribu {tid}: {e}")

class ModalModifierTribu(discord.ui.Modal, title="🛠️ Modifier tribu"):
    nom = discord.ui.TextInput(label="Nom de la tribu", required=False, max_length=100)
    map_base = discord.ui.TextInput(label="Base principale - Map", required=False, max_length=100)
    coords_base = discord.ui.TextInput(label="Base principale - Coordonnées", required=False, max_length=50)
    description = discord.ui.TextInput(label="Une petite description", style=discord.TextStyle.paragraph, required=False, max_length=1024)
    recrutement = discord.ui.TextInput(label="Recrutement ouvert", required=False, placeholder="Ex: Oui, nous recrutons !", max_length=1024)

    async def on_submit(self, inter: discord.Interaction):
        await inter.response.defer(ephemeral=True)
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
            await inter.followup.send("❌ Tu n'es référent ou manager d'aucune tribu.", ephemeral=True)
            return
        
        updates = {}
        if self.nom.value.strip():
            updates["nom"] = self.nom.value.strip()
        if self.map_base.value.strip():
            updates["map_base"] = self.map_base.value.strip()
        if self.coords_base.value.strip():
            updates["coords_base"] = self.coords_base.value.strip()
        if self.description.value.strip():
            updates["description"] = self.description.value.strip()
        if self.recrutement.value.strip():
            recrutement_texte = self.recrutement.value.strip()
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
            await inter.followup.send("✅ **Tribu modifiée !**", ephemeral=True)
            try:
                await afficher_ou_rafraichir_fiche(inter.client, row["id"], inter.guild, inter.channel)
            except Exception as e:
                print(f"⚠️ Erreur lors du rafraîchissement de la fiche tribu {row['id']}: {e}")
                await inter.followup.send(f"⚠️ **Note** : Fiche modifiée mais non rafraîchie automatiquement. Utilise `/ma_tribu` pour voir les changements.\n`Erreur: {e}`", ephemeral=True)
        else:
            await inter.followup.send("ℹ️ Aucun changement n'a été effectué.", ephemeral=True)

class ModalPersonnaliserTribu(discord.ui.Modal, title="🎨 Personnaliser tribu"):
    couleur_hex = discord.ui.TextInput(label="Couleur", required=False, placeholder="Ex: #00AAFF", max_length=7)
    logo_url = discord.ui.TextInput(label="Logo", required=False, placeholder="https://...", max_length=500)
    objectif = discord.ui.TextInput(label="Objectif de tribu", required=False, style=discord.TextStyle.paragraph, max_length=1024)
    devise = discord.ui.TextInput(label="Devise de tribu", required=False, max_length=1024)

    async def on_submit(self, inter: discord.Interaction):
        await inter.response.defer(ephemeral=True)
        with db_connect() as conn:
            c = conn.cursor()
            c.execute("""
                SELECT t.* FROM tribus t
                LEFT JOIN membres m ON t.id = m.tribu_id
                WHERE t.guild_id = ? AND (t.proprietaire_id = ? OR (m.user_id = ? AND m.manager = 1))
            """, (inter.guild_id, inter.user.id, inter.user.id))
            row = c.fetchone()
        
        if not row:
            await inter.followup.send("❌ Tu n'es référent ou manager d'aucune tribu.", ephemeral=True)
            return
        
        updates = {}
        if self.couleur_hex.value.strip():
            try:
                updates["couleur"] = int(self.couleur_hex.value.replace("#", ""), 16)
            except ValueError:
                await inter.followup.send("❌ Couleur invalide.", ephemeral=True)
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
            
            await inter.followup.send("✅ **Tribu personnalisée !**", ephemeral=True)
            try:
                await afficher_ou_rafraichir_fiche(inter.client, row["id"], inter.guild, inter.channel)
            except Exception as e:
                print(f"⚠️ Erreur lors du rafraîchissement de la fiche tribu {row['id']}: {e}")
                await inter.followup.send(f"⚠️ **Note** : Personnalisation enregistrée mais fiche non rafraîchie. Utilise `/ma_tribu`.\n`Erreur: {e}`", ephemeral=True)
        else:
            await inter.followup.send("ℹ️ Aucun changement n'a été effectué.", ephemeral=True)

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
            "Utilise les boutons **Boss validé** et **Boss non-validé** dans la fiche de ta tribu.\n"
            "Même chose pour les notes avec **Note validée** et **Note non-validée**."
        ),
        inline=False
    )
    
    e.add_field(
        name="👥 Gérer les membres et avant-postes",
        value="Utilise les boutons dans la fiche de ta tribu pour :\n• Ajouter/supprimer des membres\n• Ajouter/supprimer des avant-postes",
        inline=False
    )
    
    e.add_field(
        name="📸 Galerie photo (jusqu'à 10 photos)",
        value="Gérer les photos de ta base :\n• `/ajouter_photo` — ajouter une photo à ta galerie\n• Bouton **Supprimer photo** dans la fiche — retirer une photo\n\nNavigue dans la galerie avec les boutons ◀️ ▶️ sous ta fiche tribu !",
        inline=False
    )
    
    e.set_footer(text="💡 Utilise /aide pour voir toutes les commandes disponibles")
    
    await inter.response.send_message(embed=e, ephemeral=True)

# Ancien modal Détailler conservé temporairement pour compatibilité
class ModalDetaillerTribu(discord.ui.Modal, title="📋 Détailler tribu"):
    photo_base = discord.ui.TextInput(label="Photo base (URL)", required=False, placeholder="https://...", max_length=500)
    objectif = discord.ui.TextInput(label="Objectif", required=False, max_length=1024)

    async def on_submit(self, inter: discord.Interaction):
        await inter.response.defer(ephemeral=True)
        with db_connect() as conn:
            c = conn.cursor()
            c.execute("""
                SELECT t.* FROM tribus t
                LEFT JOIN membres m ON t.id = m.tribu_id
                WHERE t.guild_id = ? AND (t.proprietaire_id = ? OR (m.user_id = ? AND m.manager = 1))
            """, (inter.guild_id, inter.user.id, inter.user.id))
            row = c.fetchone()
        
        if not row:
            await inter.followup.send("❌ Tu n'es référent ou manager d'aucune tribu.", ephemeral=True)
            return
        
        updates = {}
        if self.photo_base.value.strip():
            updates["photo_base"] = self.photo_base.value.strip()
        if self.objectif.value.strip():
            updates["objectif"] = self.objectif.value.strip()
        
        if updates:
            with db_connect() as conn:
                c = conn.cursor()
                set_clause = ", ".join(f"{k}=?" for k in updates.keys())
                c.execute(f"UPDATE tribus SET {set_clause} WHERE id=?", (*updates.values(), row["id"]))
                conn.commit()
            
            ajouter_historique(row["id"], inter.user.id, "Détails ajoutés", f"Champs: {', '.join(updates.keys())}")
            
            # Message avec info sur la progression
            msg_success = "✅ **Détails ajoutés !**\n\nℹ️ *Pour la progression Boss/Notes, utilise les boutons dans la fiche de ta tribu.*"
            await inter.followup.send(msg_success, ephemeral=True)
            try:
                await afficher_ou_rafraichir_fiche(inter.client, row["id"], inter.guild, inter.channel)
            except Exception as e:
                print(f"⚠️ Erreur lors du rafraîchissement de la fiche tribu {row['id']}: {e}")
        else:
            await inter.followup.send("ℹ️ Aucun changement n'a été effectué.", ephemeral=True)

class PanneauParametres(discord.ui.View):
    """Panneau de configuration du bot (Admin seulement)"""
    def __init__(self, timeout: Optional[float] = None):
        super().__init__(timeout=timeout)
    
    @discord.ui.button(label="Bannière", style=discord.ButtonStyle.primary, emoji="🖼️", row=0)
    async def btn_banniere(self, inter: discord.Interaction, button: discord.ui.Button):
        if not est_admin(inter):
            await inter.response.send_message("❌ Réservé aux administrateurs.", ephemeral=True)
            return
        
        # Afficher un message avec options : URL ou upload via commande
        e = discord.Embed(
            title="🖼️ Modifier la bannière du panneau",
            description=(
                "**Deux options pour ajouter ta bannière :**\n\n"
                "📱 **Option 1 : Uploader depuis ton appareil**\n"
                "Utilise la commande `/changer_bannière_panneau` avec le paramètre `fichier` pour uploader directement une image depuis ton téléphone ou PC.\n\n"
                "🔗 **Option 2 : Utiliser une URL**\n"
                "Clique sur le bouton ci-dessous pour entrer une URL d'image."
            ),
            color=0x5865F2
        )
        e.set_footer(text="💡 L'upload direct est plus simple si tu as l'image sur ton appareil !")
        
        # Créer un bouton pour ouvrir le modal URL
        view = discord.ui.View(timeout=300)
        btn = discord.ui.Button(label="Entrer une URL", style=discord.ButtonStyle.primary, emoji="🔗")
        
        async def btn_callback(btn_inter: discord.Interaction):
            class ModalBanniere(discord.ui.Modal, title="🖼️ URL de la bannière"):
                url = discord.ui.TextInput(
                    label="URL de la bannière",
                    placeholder="https://example.com/banniere.png",
                    style=discord.TextStyle.short,
                    required=True,
                    max_length=500
                )
                
                async def on_submit(self, submit_inter: discord.Interaction):
                    url_value = self.url.value.strip()
                    if not url_value.startswith("http://") and not url_value.startswith("https://"):
                        await submit_inter.response.send_message("❌ L'URL doit commencer par http:// ou https://", ephemeral=True)
                        return
                    
                    set_config(submit_inter.guild_id, "banniere_panneau", url_value)
                    await submit_inter.response.send_message(f"✅ **Bannière modifiée !**\n\n💡 *Utilise `/panneau` pour voir le résultat.*", ephemeral=True)
            
            await btn_inter.response.send_modal(ModalBanniere())
        
        btn.callback = btn_callback
        view.add_item(btn)
        
        await inter.response.send_message(embed=e, view=view, ephemeral=True)
    
    @discord.ui.button(label="Couleur", style=discord.ButtonStyle.primary, emoji="🎨", row=0)
    async def btn_couleur(self, inter: discord.Interaction, button: discord.ui.Button):
        if not est_admin(inter):
            await inter.response.send_message("❌ Réservé aux administrateurs.", ephemeral=True)
            return
        
        # Afficher un message avec le lien pour la couleur + bouton pour ouvrir le modal
        e = discord.Embed(
            title="🎨 Modifier la couleur du panneau",
            description="**Avant de personnaliser, voici un outil utile :**\n\n"
                        "🎨 **Pour choisir ta couleur :**\n"
                        "👉 [Cliquer ici pour le sélecteur de couleur](https://htmlcolorcodes.com/fr/selecteur-de-couleur/)\n\n"
                        "💡 **Clique ensuite sur le bouton ci-dessous pour entrer le code hexadécimal.**",
            color=0x5865F2
        )
        e.set_footer(text="💡 Le sélecteur de couleur t'aidera à trouver le code hexadécimal parfait")
        
        # Créer un bouton pour ouvrir le modal
        view = discord.ui.View(timeout=300)
        btn = discord.ui.Button(label="Entrer le code couleur", style=discord.ButtonStyle.primary, emoji="🎨")
        
        async def btn_callback(btn_inter: discord.Interaction):
            class ModalCouleur(discord.ui.Modal, title="🎨 Modifier la couleur"):
                couleur = discord.ui.TextInput(
                    label="Couleur hexadécimale",
                    placeholder="Ex: 5865F2 ou #5865F2",
                    style=discord.TextStyle.short,
                    required=True,
                    max_length=7
                )
                
                async def on_submit(self, submit_inter: discord.Interaction):
                    couleur_value = self.couleur.value.strip().replace("#", "")
                    
                    if len(couleur_value) != 6 or not all(c in '0123456789ABCDEFabcdef' for c in couleur_value):
                        await submit_inter.response.send_message("❌ Couleur invalide. Utilise un code hexadécimal à 6 caractères (ex: 5865F2)", ephemeral=True)
                        return
                    
                    set_config(submit_inter.guild_id, "couleur_panneau", couleur_value)
                    
                    try:
                        couleur_int = int(couleur_value, 16)
                        e = discord.Embed(
                            title="✅ Couleur modifiée !",
                            description=f"**Nouvelle couleur :** #{couleur_value.upper()}\n\n💡 *Utilise `/panneau` pour voir le résultat.*",
                            color=couleur_int
                        )
                        await submit_inter.response.send_message(embed=e, ephemeral=True)
                    except:
                        await submit_inter.response.send_message(f"✅ **Couleur modifiée !**\n\nNouvelle couleur : #{couleur_value.upper()}", ephemeral=True)
            
            await btn_inter.response.send_modal(ModalCouleur())
        
        btn.callback = btn_callback
        view.add_item(btn)
        
        await inter.response.send_message(embed=e, view=view, ephemeral=True)
    
    @discord.ui.button(label="Texte", style=discord.ButtonStyle.primary, emoji="📝", row=0)
    async def btn_texte(self, inter: discord.Interaction, button: discord.ui.Button):
        if not est_admin(inter):
            await inter.response.send_message("❌ Réservé aux administrateurs.", ephemeral=True)
            return
        
        # Modal pour le texte
        class ModalTexte(discord.ui.Modal, title="📝 Modifier le texte du panneau"):
            texte = discord.ui.TextInput(
                label="Texte de description",
                placeholder="Ex: Utilise les boutons ci-dessous...",
                style=discord.TextStyle.paragraph,
                required=True,
                max_length=1000
            )
            
            async def on_submit(self, submit_inter: discord.Interaction):
                texte_value = self.texte.value.strip()
                set_config(submit_inter.guild_id, "texte_panneau", texte_value)
                await submit_inter.response.send_message(f"✅ **Texte modifié !**\n\n💡 *Utilise `/panneau` pour voir le résultat.*", ephemeral=True)
        
        await inter.response.send_modal(ModalTexte())
    
    @discord.ui.button(label="Salon fiches", style=discord.ButtonStyle.secondary, emoji="📍", row=0)
    async def btn_salon(self, inter: discord.Interaction, button: discord.ui.Button):
        if not est_admin(inter):
            await inter.response.send_message("❌ Réservé aux administrateurs.", ephemeral=True)
            return
        
        # Modal pour entrer le nom ou l'ID du salon
        class ModalSalonFiche(discord.ui.Modal, title="📍 Salon pour les fiches tribu"):
            salon_input = discord.ui.TextInput(
                label="Nom du salon ou ID",
                placeholder="Ex: #fiches-tribus ou 123456789012345678 ou 'reset'",
                style=discord.TextStyle.short,
                required=True,
                max_length=100
            )
            
            async def on_submit(self, submit_inter: discord.Interaction):
                input_value = self.salon_input.value.strip().lower()
                
                # Option reset
                if input_value in ["reset", "default", "défaut", "0"]:
                    set_config(submit_inter.guild_id, "salon_fiche_tribu", "0")
                    await submit_inter.response.send_message(
                        "✅ **Configuration réinitialisée !**\n\n"
                        "Les fiches seront affichées dans le salon actuel (où la commande est exécutée).",
                        ephemeral=True
                    )
                    return
                
                # Chercher par nom de salon (avec ou sans #)
                salon_trouve = None
                search_name = input_value.replace("#", "").strip()
                
                for channel in submit_inter.guild.text_channels:
                    if channel.name.lower() == search_name:
                        salon_trouve = channel
                        break
                
                # Si pas trouvé par nom, essayer par ID
                if not salon_trouve:
                    try:
                        channel_id = int(input_value.replace("#", "").strip())
                        salon_trouve = submit_inter.guild.get_channel(channel_id)
                    except ValueError:
                        pass
                
                if not salon_trouve:
                    await submit_inter.response.send_message(
                        "❌ **Salon introuvable !**\n\n"
                        "**Exemples valides :**\n"
                        "• `#fiches-tribus` (nom du salon)\n"
                        "• `fiches-tribus` (sans #)\n"
                        "• `1234567890123456789` (ID du salon)\n"
                        "• `reset` (pour réinitialiser)\n\n"
                        "💡 **Astuce :** Pour obtenir l'ID d'un salon, active le Mode Développeur Discord, "
                        "clique-droit sur le salon → Copier l'identifiant",
                        ephemeral=True
                    )
                    return
                
                # Vérifier que c'est bien un salon texte
                if not isinstance(salon_trouve, discord.TextChannel):
                    await submit_inter.response.send_message(
                        "❌ Ce n'est pas un salon texte valide.",
                        ephemeral=True
                    )
                    return
                
                # Sauvegarder la configuration
                set_config(submit_inter.guild_id, "salon_fiche_tribu", str(salon_trouve.id))
                await submit_inter.response.send_message(
                    f"✅ **Salon défini !**\n\n"
                    f"Toutes les nouvelles fiches seront affichées dans {salon_trouve.mention}",
                    ephemeral=True
                )
        
        await inter.response.send_modal(ModalSalonFiche())
    
    @discord.ui.button(label="Maps", style=discord.ButtonStyle.secondary, emoji="🗺️", row=1)
    async def btn_maps(self, inter: discord.Interaction, button: discord.ui.Button):
        if not est_admin(inter):
            await inter.response.send_message("❌ Réservé aux administrateurs.", ephemeral=True)
            return
        
        # Afficher un sous-menu pour ajouter ou retirer des maps
        class ViewMapsGestion(discord.ui.View):
            def __init__(self):
                super().__init__(timeout=300)
            
            @discord.ui.button(label="Ajouter une map", style=discord.ButtonStyle.success, emoji="➕")
            async def btn_ajouter(self, btn_inter: discord.Interaction, btn: discord.ui.Button):
                class ModalAjoutMap(discord.ui.Modal, title="🗺️ Ajouter une map"):
                    nom = discord.ui.TextInput(
                        label="Nom de la map",
                        placeholder="Ex: The Island, Scorched Earth...",
                        style=discord.TextStyle.short,
                        required=True,
                        max_length=100
                    )
                    
                    async def on_submit(self, submit_inter: discord.Interaction):
                        nom_map = self.nom.value.strip()
                        try:
                            with db_connect() as conn:
                                c = conn.cursor()
                                c.execute("INSERT INTO maps (guild_id, nom, created_at) VALUES (?, ?, ?)", 
                                         (submit_inter.guild_id, nom_map, dt.datetime.utcnow().isoformat()))
                                conn.commit()
                            await submit_inter.response.send_message(f"✅ Map **{nom_map}** ajoutée à la liste !", ephemeral=True)
                        except sqlite3.IntegrityError:
                            await submit_inter.response.send_message(f"❌ La map **{nom_map}** existe déjà.", ephemeral=True)
                
                await btn_inter.response.send_modal(ModalAjoutMap())
            
            @discord.ui.button(label="Retirer une map", style=discord.ButtonStyle.danger, emoji="➖")
            async def btn_retirer(self, btn_inter: discord.Interaction, btn: discord.ui.Button):
                # Créer un menu déroulant avec les maps existantes
                with db_connect() as conn:
                    c = conn.cursor()
                    c.execute("SELECT DISTINCT nom FROM maps WHERE guild_id IN (0, ?) ORDER BY nom", (inter.guild_id,))
                    maps = [row["nom"] for row in c.fetchall()]
                
                if not maps:
                    await btn_inter.followup.send("❌ Aucune map à retirer.", ephemeral=True)
                    return
                
                class ViewMapSelect(discord.ui.View):
                    def __init__(self):
                        super().__init__(timeout=300)
                    
                    @discord.ui.select(
                        placeholder="Sélectionne la map à retirer",
                        options=[discord.SelectOption(label=m, value=m) for m in maps[:25]]
                    )
                    async def select_map(self, select_inter: discord.Interaction, select: discord.ui.Select):
                        nom_map = select.values[0]
                        with db_connect() as conn:
                            c = conn.cursor()
                            c.execute("DELETE FROM maps WHERE guild_id=? AND nom=?", (select_inter.guild_id, nom_map))
                            if c.rowcount == 0:
                                await select_inter.followup.send(f"❌ Map **{nom_map}** non trouvée.", ephemeral=True)
                            else:
                                conn.commit()
                                await select_inter.followup.send(f"✅ Map **{nom_map}** supprimée de la liste !", ephemeral=True)
                
                view = ViewMapSelect()
                await btn_inter.followup.send("🗺️ **Choisir la map à retirer :**", view=view, ephemeral=True)
        
        e = discord.Embed(
            title="🗺️ Gestion des Maps",
            description="Utilise les boutons ci-dessous pour ajouter ou retirer des maps de la liste.",
            color=0x5865F2
        )
        await inter.response.send_message(embed=e, view=ViewMapsGestion(), ephemeral=True)
    
    @discord.ui.button(label="Boss", style=discord.ButtonStyle.secondary, emoji="🐉", row=1)
    async def btn_boss(self, inter: discord.Interaction, button: discord.ui.Button):
        if not est_admin(inter):
            await inter.response.send_message("❌ Réservé aux administrateurs.", ephemeral=True)
            return
        
        # Afficher un sous-menu pour ajouter ou retirer des boss
        class ViewBossGestion(discord.ui.View):
            def __init__(self):
                super().__init__(timeout=300)
            
            @discord.ui.button(label="Ajouter un boss", style=discord.ButtonStyle.success, emoji="➕")
            async def btn_ajouter(self, btn_inter: discord.Interaction, btn: discord.ui.Button):
                class ModalAjoutBoss(discord.ui.Modal, title="🐉 Ajouter un boss"):
                    nom = discord.ui.TextInput(
                        label="Nom du boss",
                        placeholder="Ex: Broodmother, Dragon...",
                        style=discord.TextStyle.short,
                        required=True,
                        max_length=100
                    )
                    
                    async def on_submit(self, submit_inter: discord.Interaction):
                        nom_boss = self.nom.value.strip()
                        try:
                            with db_connect() as conn:
                                c = conn.cursor()
                                c.execute("INSERT INTO boss (guild_id, nom, created_at) VALUES (?, ?, ?)", 
                                         (submit_inter.guild_id, nom_boss, dt.datetime.utcnow().isoformat()))
                                conn.commit()
                            await submit_inter.response.send_message(f"✅ Boss **{nom_boss}** ajouté à la liste !", ephemeral=True)
                        except sqlite3.IntegrityError:
                            await submit_inter.response.send_message(f"❌ Le boss **{nom_boss}** existe déjà.", ephemeral=True)
                
                await btn_inter.response.send_modal(ModalAjoutBoss())
            
            @discord.ui.button(label="Retirer un boss", style=discord.ButtonStyle.danger, emoji="➖")
            async def btn_retirer(self, btn_inter: discord.Interaction, btn: discord.ui.Button):
                # Créer un menu déroulant avec les boss existants
                with db_connect() as conn:
                    c = conn.cursor()
                    c.execute("SELECT DISTINCT nom FROM boss WHERE guild_id IN (0, ?) ORDER BY nom", (inter.guild_id,))
                    boss = [row["nom"] for row in c.fetchall()]
                
                if not boss:
                    await btn_inter.followup.send("❌ Aucun boss à retirer.", ephemeral=True)
                    return
                
                class ViewBossSelect(discord.ui.View):
                    def __init__(self):
                        super().__init__(timeout=300)
                    
                    @discord.ui.select(
                        placeholder="Sélectionne le boss à retirer",
                        options=[discord.SelectOption(label=b, value=b) for b in boss[:25]]
                    )
                    async def select_boss(self, select_inter: discord.Interaction, select: discord.ui.Select):
                        nom_boss = select.values[0]
                        with db_connect() as conn:
                            c = conn.cursor()
                            c.execute("DELETE FROM boss WHERE guild_id=? AND nom=?", (select_inter.guild_id, nom_boss))
                            if c.rowcount == 0:
                                await select_inter.followup.send(f"❌ Boss **{nom_boss}** non trouvé.", ephemeral=True)
                            else:
                                conn.commit()
                                await select_inter.followup.send(f"✅ Boss **{nom_boss}** supprimé de la liste !", ephemeral=True)
                
                view = ViewBossSelect()
                await btn_inter.followup.send("🐉 **Choisir le boss à retirer :**", view=view, ephemeral=True)
        
        e = discord.Embed(
            title="🐉 Gestion des Boss",
            description="Utilise les boutons ci-dessous pour ajouter ou retirer des boss de la liste.",
            color=0x5865F2
        )
        await inter.response.send_message(embed=e, view=ViewBossGestion(), ephemeral=True)
    
    @discord.ui.button(label="Notes", style=discord.ButtonStyle.secondary, emoji="📝", row=1)
    async def btn_notes(self, inter: discord.Interaction, button: discord.ui.Button):
        if not est_admin(inter):
            await inter.response.send_message("❌ Réservé aux administrateurs.", ephemeral=True)
            return
        
        # Afficher un sous-menu pour ajouter ou retirer des notes
        class ViewNotesGestion(discord.ui.View):
            def __init__(self):
                super().__init__(timeout=300)
            
            @discord.ui.button(label="Ajouter une note", style=discord.ButtonStyle.success, emoji="➕")
            async def btn_ajouter(self, btn_inter: discord.Interaction, btn: discord.ui.Button):
                class ModalAjoutNote(discord.ui.Modal, title="📝 Ajouter une note"):
                    nom = discord.ui.TextInput(
                        label="Nom de la note",
                        placeholder="Ex: Note de l'explorateur...",
                        style=discord.TextStyle.short,
                        required=True,
                        max_length=100
                    )
                    
                    async def on_submit(self, submit_inter: discord.Interaction):
                        nom_note = self.nom.value.strip()
                        try:
                            with db_connect() as conn:
                                c = conn.cursor()
                                c.execute("INSERT INTO notes (guild_id, nom, created_at) VALUES (?, ?, ?)", 
                                         (submit_inter.guild_id, nom_note, dt.datetime.utcnow().isoformat()))
                                conn.commit()
                            await submit_inter.response.send_message(f"✅ Note **{nom_note}** ajoutée à la liste !", ephemeral=True)
                        except sqlite3.IntegrityError:
                            await submit_inter.response.send_message(f"❌ La note **{nom_note}** existe déjà.", ephemeral=True)
                
                await btn_inter.response.send_modal(ModalAjoutNote())
            
            @discord.ui.button(label="Retirer une note", style=discord.ButtonStyle.danger, emoji="➖")
            async def btn_retirer(self, btn_inter: discord.Interaction, btn: discord.ui.Button):
                # Créer un menu déroulant avec les notes existantes
                with db_connect() as conn:
                    c = conn.cursor()
                    c.execute("SELECT DISTINCT nom FROM notes WHERE guild_id IN (0, ?) ORDER BY nom", (inter.guild_id,))
                    notes = [row["nom"] for row in c.fetchall()]
                
                if not notes:
                    await btn_inter.followup.send("❌ Aucune note à retirer.", ephemeral=True)
                    return
                
                class ViewNoteSelect(discord.ui.View):
                    def __init__(self):
                        super().__init__(timeout=300)
                    
                    @discord.ui.select(
                        placeholder="Sélectionne la note à retirer",
                        options=[discord.SelectOption(label=n, value=n) for n in notes[:25]]
                    )
                    async def select_note(self, select_inter: discord.Interaction, select: discord.ui.Select):
                        nom_note = select.values[0]
                        with db_connect() as conn:
                            c = conn.cursor()
                            c.execute("DELETE FROM notes WHERE guild_id=? AND nom=?", (select_inter.guild_id, nom_note))
                            if c.rowcount == 0:
                                await select_inter.followup.send(f"❌ Note **{nom_note}** non trouvée.", ephemeral=True)
                            else:
                                conn.commit()
                                await select_inter.followup.send(f"✅ Note **{nom_note}** supprimée de la liste !", ephemeral=True)
                
                view = ViewNoteSelect()
                await btn_inter.followup.send("📝 **Choisir la note à retirer :**", view=view, ephemeral=True)
        
        e = discord.Embed(
            title="📝 Gestion des Notes",
            description="Utilise les boutons ci-dessous pour ajouter ou retirer des notes de la liste.",
            color=0x5865F2
        )
        await inter.response.send_message(embed=e, view=ViewNotesGestion(), ephemeral=True)
    
    @discord.ui.button(label="Maps Premium", style=discord.ButtonStyle.secondary, emoji="⭐", row=2)
    async def btn_maps_premium(self, inter: discord.Interaction, button: discord.ui.Button):
        if not est_admin(inter):
            await inter.response.send_message("❌ Réservé aux administrateurs.", ephemeral=True)
            return
        
        # Afficher un sous-menu pour ajouter ou retirer des maps premium
        class ViewMapsPremiumGestion(discord.ui.View):
            def __init__(self):
                super().__init__(timeout=300)
            
            @discord.ui.button(label="Ajouter une map premium", style=discord.ButtonStyle.success, emoji="➕")
            async def btn_ajouter(self, btn_inter: discord.Interaction, btn: discord.ui.Button):
                class ModalAjoutMapPremium(discord.ui.Modal, title="⭐ Ajouter une map premium"):
                    nom = discord.ui.TextInput(
                        label="Nom de la map premium",
                        placeholder="Ex: Svartalfheim, Némésis...",
                        style=discord.TextStyle.short,
                        required=True,
                        max_length=100
                    )
                    
                    async def on_submit(self, submit_inter: discord.Interaction):
                        nom_map = self.nom.value.strip()
                        try:
                            with db_connect() as conn:
                                c = conn.cursor()
                                c.execute("INSERT INTO maps_premium (guild_id, nom, created_at) VALUES (?, ?, ?)", 
                                         (submit_inter.guild_id, nom_map, dt.datetime.utcnow().isoformat()))
                                conn.commit()
                            await submit_inter.response.send_message(f"✅ Map premium **{nom_map}** ajoutée à la liste !", ephemeral=True)
                        except sqlite3.IntegrityError:
                            await submit_inter.response.send_message(f"❌ La map premium **{nom_map}** existe déjà.", ephemeral=True)
                
                await btn_inter.response.send_modal(ModalAjoutMapPremium())
            
            @discord.ui.button(label="Retirer une map premium", style=discord.ButtonStyle.danger, emoji="➖")
            async def btn_retirer(self, btn_inter: discord.Interaction, btn: discord.ui.Button):
                # DEFER immédiatement
                await btn_inter.response.defer(ephemeral=True)
                
                # Créer un menu déroulant avec les maps premium existantes
                with db_connect() as conn:
                    c = conn.cursor()
                    c.execute("SELECT DISTINCT nom FROM maps_premium WHERE guild_id IN (0, ?) ORDER BY nom", (inter.guild_id,))
                    maps = [row["nom"] for row in c.fetchall()]
                
                if not maps:
                    await btn_inter.followup.send("❌ Aucune map premium à retirer.", ephemeral=True)
                    return
                
                class ViewMapPremiumSelect(discord.ui.View):
                    def __init__(self):
                        super().__init__(timeout=300)
                    
                    @discord.ui.select(
                        placeholder="Sélectionne la map premium à retirer",
                        options=[discord.SelectOption(label=m, value=m) for m in maps[:25]]
                    )
                    async def select_map(self, select_inter: discord.Interaction, select: discord.ui.Select):
                        await select_inter.response.defer(ephemeral=True)
                        nom_map = select.values[0]
                        with db_connect() as conn:
                            c = conn.cursor()
                            c.execute("DELETE FROM maps_premium WHERE guild_id=? AND nom=?", (select_inter.guild_id, nom_map))
                            if c.rowcount == 0:
                                await select_inter.followup.send(f"❌ Map premium **{nom_map}** non trouvée.", ephemeral=True)
                            else:
                                conn.commit()
                                await select_inter.followup.send(f"✅ Map premium **{nom_map}** supprimée de la liste !", ephemeral=True)
                
                view = ViewMapPremiumSelect()
                await btn_inter.followup.send("⭐ **Choisir la map premium à retirer :**", view=view, ephemeral=True)
        
        e = discord.Embed(
            title="⭐ Gestion des Maps Premium",
            description="Utilise les boutons ci-dessous pour ajouter ou retirer des maps premium de la liste.",
            color=0x5865F2
        )
        await inter.response.send_message(embed=e, view=ViewMapsPremiumGestion(), ephemeral=True)

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
        view = discord.ui.View(timeout=300)
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
    # DEFER immédiatement pour éviter le timeout (3 secondes)
    await inter.response.defer(ephemeral=True)
    
    row = tribu_par_nom(inter.guild_id, nom)
    if not row:
        await inter.followup.send("❌ Aucune tribu trouvée avec ce nom.", ephemeral=True)
        return
    
    # Vérifier qu'au moins un des deux est fourni
    if not url_logo and not fichier:
        await inter.followup.send("❌ Tu dois fournir soit une URL, soit un fichier image.", ephemeral=True)
        return
    
    # Si un fichier est fourni, vérifier que c'est une image
    if fichier:
        if not fichier.content_type or not fichier.content_type.startswith("image/"):
            await inter.followup.send("❌ Le fichier doit être une image (JPG, PNG, GIF, etc.).", ephemeral=True)
            return
        # Utiliser l'URL du fichier uploadé
        logo_url = fichier.url
    else:
        logo_url = url_logo.strip()
    
    # Vérifier les droits
    if not await verifier_droits_defer(inter, row):
        return
    
    # Mettre à jour le logo
    with db_connect() as conn:
        c = conn.cursor()
        c.execute("UPDATE tribus SET logo_url=? WHERE id=?", (logo_url, row["id"]))
        conn.commit()
    
    source = "📱 depuis un fichier" if fichier else "🔗 depuis une URL"
    ajouter_historique(row["id"], inter.user.id, "Logo modifié", f"Logo changé {source}")
    
    # Répondre AVANT le rafraîchissement
    await inter.followup.send(f"✅ **Logo de {row['nom']} mis à jour !**\n{source}", ephemeral=True)
    
    # Rafraîchir la fiche APRÈS avoir répondu
    try:
        await afficher_ou_rafraichir_fiche(inter.client, row["id"], inter.guild, inter.channel)
    except Exception as e:
        await inter.followup.send(f"⚠️ **Note** : Logo mis à jour mais fiche non rafraîchie. Utilise `/ma_tribu` pour voir.\n`Erreur: {e}`", ephemeral=True)

@tree.command(name="ajouter_photo", description="Ajouter une photo à la galerie de ta tribu (max 10 photos)")
@app_commands.describe(
    nom="Nom de la tribu",
    url_photo="URL de la photo (optionnel si tu fournis un fichier)",
    fichier="Image à uploader depuis ton téléphone/PC (optionnel si tu fournis une URL)"
)
@app_commands.autocomplete(nom=autocomplete_tribus)
async def ajouter_photo(inter: discord.Interaction, nom: str, url_photo: Optional[str] = None, fichier: Optional[discord.Attachment] = None):
    # DEFER immédiatement pour éviter le timeout (3 secondes)
    await inter.response.defer(ephemeral=True)
    
    row = tribu_par_nom(inter.guild_id, nom)
    if not row:
        await inter.followup.send("❌ Aucune tribu trouvée avec ce nom.", ephemeral=True)
        return
    
    # Vérifier qu'au moins un des deux est fourni
    if not url_photo and not fichier:
        await inter.followup.send("❌ Tu dois fournir soit une URL, soit un fichier image.", ephemeral=True)
        return
    
    # Si un fichier est fourni, vérifier que c'est une image
    if fichier:
        if not fichier.content_type or not fichier.content_type.startswith("image/"):
            await inter.followup.send("❌ Le fichier doit être une image (JPG, PNG, GIF, etc.).", ephemeral=True)
            return
        # Utiliser l'URL du fichier uploadé
        photo_url = fichier.url
    else:
        photo_url = url_photo.strip()
    
    # Vérifier les droits
    if not await verifier_droits_defer(inter, row):
        return
    
    # Vérifier le nombre de photos (max 10)
    with db_connect() as conn:
        c = conn.cursor()
        c.execute("SELECT COUNT(*) as count FROM photos_tribu WHERE tribu_id=?", (row["id"],))
        count = c.fetchone()["count"]
        
        if count >= 10:
            await inter.followup.send("❌ Cette tribu a déjà 10 photos. Supprime-en une avant d'en ajouter une nouvelle.", ephemeral=True)
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
    
    # Répondre AVANT le rafraîchissement
    await inter.followup.send(f"✅ **Photo #{nouvel_ordre + 1} ajoutée à {row['nom']} !** ({count + 1}/10)\n{source}", ephemeral=True)
    
    # Rafraîchir la fiche APRÈS avoir répondu
    try:
        await afficher_ou_rafraichir_fiche(inter.client, row["id"], inter.guild, inter.channel)
    except Exception as e:
        await inter.followup.send(f"⚠️ **Note** : Photo ajoutée mais fiche non rafraîchie. Utilise `/ma_tribu` pour voir.\n`Erreur: {e}`", ephemeral=True)

async def autocomplete_photos_tribu(inter: discord.Interaction, current: str):
    """Autocomplétion pour les photos d'une tribu"""
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


@tree.command(name="parametres", description="[ADMIN] Ouvrir le panneau de configuration du bot")
async def parametres(inter: discord.Interaction):
    if not est_admin(inter):
        await inter.response.send_message("❌ Cette commande est réservée aux administrateurs.", ephemeral=True)
        return
    
    view = PanneauParametres(timeout=None)
    
    e = discord.Embed(
        title="⚙️ Paramètres du bot",
        description=(
            "Utilise les boutons ci-dessous pour configurer le bot :\n\n"
            "🖼️ **Bannière** — Personnaliser l'image du panneau\n"
            "🎨 **Couleur** — Changer la couleur du panneau\n"
            "📝 **Texte** — Modifier le texte de description\n"
            "📍 **Salon fiches** — Définir où afficher les fiches\n"
            "🗺️ **Maps** — Gérer les maps disponibles\n"
            "🐉 **Boss** — Gérer les boss disponibles\n"
            "📝 **Notes** — Gérer les notes disponibles"
        ),
        color=0xFF9900
    )
    e.set_footer(text="👑 Panneau réservé aux administrateurs")
    
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
        
        # Récupérer les configurations personnalisées
        couleur_hex = get_config(inter.guild_id, "couleur_panneau", "5865F2")
        texte = get_config(inter.guild_id, "texte_panneau", "Utilise les boutons ci-dessous pour gérer les fiches sans taper de commandes.")
        banniere_url = get_config(inter.guild_id, "banniere_panneau", "https://i.postimg.cc/8c6gy1qK/AB2723-D2-B10-F-40-F7-A124-1-D6-F30510096.jpg")
        
        # Convertir la couleur hex en int
        try:
            couleur = int(couleur_hex, 16)
        except:
            couleur = 0x5865F2  # Bleu Discord par défaut
        
        e = discord.Embed(
            title="🧭 Panneau — Fiches Tribu",
            description=texte,
            color=couleur
        )
        e.set_image(url=banniere_url)
        e.set_footer(text="👑 Panneau admin — Visible par tous")
        await inter.followup.send(embed=e, view=v)
    else:
        # Récupérer les configurations personnalisées
        couleur_hex = get_config(inter.guild_id, "couleur_panneau", "5865F2")
        texte = get_config(inter.guild_id, "texte_panneau", "Utilise les boutons ci-dessous pour gérer les fiches sans taper de commandes.")
        banniere_url = get_config(inter.guild_id, "banniere_panneau", "https://i.postimg.cc/8c6gy1qK/AB2723-D2-B10-F-40-F7-A124-1-D6-F30510096.jpg")
        
        # Convertir la couleur hex en int
        try:
            couleur = int(couleur_hex, 16)
        except:
            couleur = 0x5865F2  # Bleu Discord par défaut
        
        e = discord.Embed(
            title="🧭 Panneau — Fiches Tribu",
            description=texte,
            color=couleur
        )
        e.set_image(url=banniere_url)
        e.set_footer(text="Astuce : tu peux rouvrir ce panneau à tout moment avec /panneau")
        await inter.response.send_message(embed=e, view=v, ephemeral=True)

remove_tribe_commands(tree)

@bot.event
async def on_interaction(inter: discord.Interaction):
    """Rediriger les anciens boutons vers le site, sans aucune écriture tribu."""
    if inter.type != discord.InteractionType.component:
        return
    await redirect_retired_component(inter)

@bot.event
async def on_ready():
    identite_db_init()  # Initialiser la DB Arki Identité au démarrage
    # Ne plus initialiser la base tribus ni réinstaller ses panneaux interactifs.
    remove_tribe_commands(tree)
    
    try:
        synced = await tree.sync()
        removed = await remove_guild_tribe_commands(tree, bot.guilds)
        print(f"Commandes tribu locales supprimées : {removed}")
        print(f"Commandes synchronisées : {len(synced)}")
        for cmd in synced:
            print(f"  - /{cmd.name}")
    except Exception as e:
        print("Erreur de sync des commandes :", e)
    print(f"Connecté en tant que {bot.user} (ID: {bot.user.id})")

def main():
    # Replit utilise DISCORD_TOKEN, Railway/autres peuvent utiliser DISCORD_BOT_TOKEN
    token = os.getenv("DISCORD_BOT_TOKEN") or os.getenv("DISCORD_TOKEN")
    if not token:
        print("ERREUR : définis la variable d'environnement DISCORD_BOT_TOKEN ou DISCORD_TOKEN avec le token du bot.")
        return
    keep_alive()  # Lance le serveur web pour éviter la mise en veille
    bot.run(token)

if __name__ == "__main__":
    main()