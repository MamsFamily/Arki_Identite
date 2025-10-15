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
        try:
            c.execute("ALTER TABLE tribus ADD COLUMN map_base TEXT DEFAULT ''")
        except sqlite3.OperationalError:
            pass
        try:
            c.execute("ALTER TABLE tribus ADD COLUMN coords_base TEXT DEFAULT ''")
        except sqlite3.OperationalError:
            pass
        conn.commit()

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
    e.add_field(name="🏷️ Tags", value=tribu["tags"] or "—", inline=True)
    e.add_field(name="👑 Propriétaire", value=f"<@{tribu['proprietaire_id']}>", inline=True)

    if membres is not None:
        lines = []
        managers = []
        for m in membres:
            line = f"• <@{m['user_id']}>"
            if m["role"]:
                line += f" — {m['role']}"
            if m["manager"]:
                managers.append(m["user_id"])
            lines.append(line)
        if lines:
            e.add_field(name=f"👥 Membres ({len(lines)})", value="\n".join(lines)[:1024], inline=False)
        if managers:
            e.add_field(name="🛠️ Managers", value=", ".join(f"<@{uid}>" for uid in managers)[:1024], inline=False)
    
    if avant_postes is not None and len(avant_postes) > 0:
        ap_lines = []
        for ap in avant_postes:
            ap_text = f"• **{ap['nom']}** — <@{ap['user_id']}>"
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
    description="Description (facultatif)",
    base="Nom de la base principale (facultatif)",
    map_base="Map de la base (facultatif)",
    coords_base="Coordonnées de la base ex: 45.5, 32.6 (facultatif)"
)
async def tribu_creer(
    inter: discord.Interaction, 
    nom: str, 
    description: Optional[str] = "",
    base: Optional[str] = "",
    map_base: Optional[str] = "",
    coords_base: Optional[str] = ""
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
            (description or "").strip(), 
            (base or "").strip(),
            (map_base or "").strip(),
            (coords_base or "").strip(),
            inter.user.id, 
            dt.datetime.utcnow().isoformat()
        ))
        tribu_id = c.lastrowid
        c.execute("INSERT OR REPLACE INTO membres (tribu_id, user_id, role, manager) VALUES (?, ?, ?, 1)",
                  (tribu_id, inter.user.id, "Chef",))
        conn.commit()
        c.execute("SELECT * FROM tribus WHERE id=?", (tribu_id,))
        row = c.fetchone()
    await inter.response.send_message("✅ **Tribu créée !**", embed=embed_tribu(row))

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
    coords_base="Coordonnées de la base ex: 45.5, 32.6 (optionnel)",
    tags="Tags séparés par des virgules (optionnel)"
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
    coords_base: Optional[str] = None,
    tags: Optional[str] = None
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
    if tags is not None:
        updates["tags"] = ",".join([t.strip() for t in tags.split(",")]) if tags else ""

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
        c.execute("SELECT * FROM tribus WHERE id=?", (row["id"],))
        updated = c.fetchone()

    await inter.response.send_message("✅ Fiche mise à jour.", embed=embed_tribu(updated))

@tribu.command(name="ajouter_membre", description="Ajouter un membre à une tribu")
@app_commands.describe(nom="Nom de la tribu", utilisateur="Membre à ajouter", role="Rôle affiché (optionnel)", manager="Donner les droits de gestion ?")
async def tribu_ajouter_membre(inter: discord.Interaction, nom: str, utilisateur: discord.Member, role: Optional[str] = "", manager: Optional[bool] = False):
    db_init()
    row = tribu_par_nom(inter.guild_id, nom)
    if not row:
        await inter.response.send_message("❌ Aucune tribu trouvée avec ce nom.", ephemeral=True)
        return
    if not await verifier_droits(inter, row):
        return
    with db_connect() as conn:
        c = conn.cursor()
        c.execute("INSERT OR REPLACE INTO membres (tribu_id, user_id, role, manager) VALUES (?, ?, ?, ?)",
                  (row["id"], utilisateur.id, role or "", 1 if manager else 0))
        conn.commit()
    await inter.response.send_message(f"✅ <@{utilisateur.id}> ajouté à **{row['nom']}**.")

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
    await inter.response.send_message(f"✅ <@{utilisateur.id}> retiré de **{row['nom']}**.")

@tribu.command(name="ajouter_avant_poste", description="Ajouter un avant-poste à ta tribu")
@app_commands.describe(
    nom_avant_poste="Nom de l'avant-poste",
    map="Map de l'avant-poste (optionnel)",
    coords="Coordonnées ex: 45.5, 32.6 (optionnel)"
)
async def tribu_ajouter_avant_poste(
    inter: discord.Interaction,
    nom_avant_poste: str,
    map: Optional[str] = "",
    coords: Optional[str] = ""
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
        await inter.response.send_message(f"❌ Tu es membre de plusieurs tribus ({noms}). Utilise `/tribu ajouter_avant_poste_pour` pour spécifier la tribu.", ephemeral=True)
        return
    
    row = tribus[0]
    
    with db_connect() as conn:
        c = conn.cursor()
        c.execute("""
            INSERT INTO avant_postes (tribu_id, user_id, nom, map, coords, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (row["id"], inter.user.id, nom_avant_poste.strip(), (map or "").strip(), (coords or "").strip(), dt.datetime.utcnow().isoformat()))
        conn.commit()
    await inter.response.send_message(f"✅ Avant-poste **{nom_avant_poste}** ajouté à **{row['nom']}** !")

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
    await inter.response.send_message(f"✅ Avant-poste **{nom_avant_poste}** retiré de **{row['nom']}**.")

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
        c.execute("SELECT * FROM tribus WHERE id=?", (row["id"],))
        updated = c.fetchone()
    await inter.response.send_message(f"✅ Propriété transférée à <@{nouveau_proprio.id}>.", embed=embed_tribu(updated))

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
        "• **/tribu créer** — créer une nouvelle tribu avec base et coordonnées",
        "• **/tribu voir** — afficher une fiche tribu",
        "• **/tribu lister** — lister toutes les tribus du serveur",
        "• **/tribu modifier** — éditer nom/description/couleur/logo/base/map/coords/tags",
        "• **/tribu ajouter_membre** — ajouter un membre (+ rôle + manager)",
        "• **/tribu retirer_membre** — retirer un membre",
        "• **/tribu ajouter_avant_poste** — ajouter ton avant-poste avec map et coords",
        "• **/tribu retirer_avant_poste** — retirer un avant-poste",
        "• **/tribu transférer** — transférer la propriété",
        "• **/tribu supprimer** — supprimer une tribu (avec confirmation)",
        "• **/tribu_test** — vérifier que le bot répond",
        "• **/panneau** — ouvre les boutons (Créer / Modifier / Liste / Voir)"
    ]
    e.add_field(name="Résumé", value="\n".join(lignes), inline=False)
    e.set_footer(text="Astuce : limite les tags (3-5) pour garder des fiches lisibles.")
    await inter.response.send_message(embed=e, ephemeral=True)

# ---------- UI (boutons + modals) ----------
class ModalCreerTribu(discord.ui.Modal, title="Créer une tribu"):
    nom = discord.ui.TextInput(label="Nom de la tribu", placeholder="Ex: Les Spinos", max_length=64)
    description = discord.ui.TextInput(label="Description", style=discord.TextStyle.paragraph, required=False, max_length=500, placeholder="Objectifs, ambiance, règles...")
    base = discord.ui.TextInput(label="Nom de la base principale (optionnel)", required=False, max_length=100, placeholder="Ex: Base Principale")
    map_base = discord.ui.TextInput(label="Map de la base (optionnel)", required=False, max_length=50, placeholder="Ex: TheIsland, Ragnarok...")
    coords_base = discord.ui.TextInput(label="Coordonnées base (optionnel)", required=False, max_length=50, placeholder="Ex: 45.5, 32.6")

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
                str(self.description or "").strip(),
                str(self.base or "").strip(),
                str(self.map_base or "").strip(),
                str(self.coords_base or "").strip(),
                inter.user.id, 
                dt.datetime.utcnow().isoformat()
            ))
            tid = c.lastrowid
            c.execute("INSERT OR REPLACE INTO membres (tribu_id, user_id, role, manager) VALUES (?, ?, ?, 1)",
                      (tid, inter.user.id, "Chef",))
            conn.commit()
            c.execute("SELECT * FROM tribus WHERE id=?", (tid,))
            row = c.fetchone()
        await inter.response.send_message("✅ **Tribu créée !**", embed=embed_tribu(row), ephemeral=False)

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
            c.execute("SELECT * FROM tribus WHERE id=?", (row["id"],))
            updated = c.fetchone()
        await inter.response.send_message("✅ Fiche mise à jour.", embed=embed_tribu(updated), ephemeral=False)

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
    v = PanneauTribu(timeout=180)
    e = discord.Embed(
        title="🧭 Panneau — Fiches Tribu",
        description="Utilise les boutons ci-dessous pour gérer les fiches sans taper de commandes.",
        color=0x2B2D31
    )
    e.set_footer(text="Astuce : tu peux rouvrir ce panneau à tout moment avec /panneau")
    await inter.response.send_message(embed=e, view=v, ephemeral=True)

@bot.event
async def on_ready():
    try:
        synced = await tree.sync()
        print(f"Commandes synchronisées : {len(synced)}")
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
