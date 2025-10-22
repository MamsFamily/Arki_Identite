import discord
from discord.ext import commands
import sqlite3
import os
import asyncio
from dotenv import load_dotenv
from flask import Flask
from threading import Thread

# --- Keep-alive HTTP (pour Replit + UptimeRobot) ---
app = Flask(__name__)

@app.route("/")
def home():
    return "OK - bot en ligne"

def _run():
    # Replit expose le webserver sur un port fourni (ou 8080 par défaut)
    port = int(os.getenv("PORT", "8080"))
    app.run(host="0.0.0.0", port=port)

def keep_alive():
    t = Thread(target=_run, daemon=True)
    t.start()


# --- Chargement du fichier .env ---
load_dotenv()

# --- Base de données SQLite ---
def db_init():
    conn = sqlite3.connect('tribus.db')
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS tribus (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    nom TEXT UNIQUE NOT NULL,
                    chef_id INTEGER NOT NULL,
                    membres TEXT DEFAULT ''
                )''')
    conn.commit()
    conn.close()


# --- Configuration du bot ---
intents = discord.Intents.default()
intents.members = True
intents.message_content = True
bot = commands.Bot(command_prefix="!", intents=intents)


# --- Commandes du bot ---
@bot.event
async def on_ready():
    print(f"✅ Connecté en tant que {bot.user}")


@bot.command(name="creer_tribu")
async def creer_tribu(ctx, *, nom: str):
    """Crée une nouvelle tribu avec le nom donné."""
    conn = sqlite3.connect('tribus.db')
    c = conn.cursor()

    # Vérifie si la tribu existe déjà
    c.execute("SELECT * FROM tribus WHERE nom = ?", (nom,))
    if c.fetchone():
        await ctx.send("⚠️ Ce nom de tribu existe déjà.")
        conn.close()
        return

    # Ajoute la nouvelle tribu
    c.execute("INSERT INTO tribus (nom, chef_id) VALUES (?, ?)", (nom, ctx.author.id))
    conn.commit()
    conn.close()

    await ctx.send(f"✅ Tribu **{nom}** créée avec succès !")


@bot.command(name="liste_tribus")
async def liste_tribus(ctx):
    """Affiche la liste des tribus existantes."""
    conn = sqlite3.connect('tribus.db')
    c = conn.cursor()
    c.execute("SELECT nom FROM tribus")
    tribus = c.fetchall()
    conn.close()

    if not tribus:
        await ctx.send("😕 Aucune tribu enregistrée pour le moment.")
    else:
        noms = [t[0] for t in tribus]
        await ctx.send("📜 **Tribus existantes :**\n" + "\n".join(f"- {n}" for n in noms))


@bot.command(name="supprimer_tribu")
async def supprimer_tribu(ctx, *, nom: str):
    """Supprime une tribu si tu en es le chef."""
    conn = sqlite3.connect('tribus.db')
    c = conn.cursor()
    c.execute("SELECT chef_id FROM tribus WHERE nom = ?", (nom,))
    result = c.fetchone()

    if not result:
        await ctx.send("⚠️ Aucune tribu trouvée avec ce nom.")
        conn.close()
        return

    chef_id = result[0]
    if ctx.author.id != chef_id:
        await ctx.send("🚫 Seul le chef de la tribu peut la supprimer.")
        conn.close()
        return

    c.execute("DELETE FROM tribus WHERE nom = ?", (nom,))
    conn.commit()
    conn.close()

    await ctx.send(f"🗑️ La tribu **{nom}** a été supprimée.")


# --- Fonction principale ---
def main():
    db_init()
    token = os.getenv("DISCORD_BOT_TOKEN")
    if not token:
        print("ERREUR : définis la variable d'environnement DISCORD_BOT_TOKEN avec le token du bot.")
        return

    # >>> Ajout keep-alive pour Replit <<<
    keep_alive()  # lance le mini serveur Flask pour éviter la mise en veille Replit

    bot.run(token)


if __name__ == "__main__":
    main()
