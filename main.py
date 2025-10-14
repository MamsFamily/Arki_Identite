import discord
from discord.ext import commands
import os

intents = discord.Intents.default()
intents.message_content = True
intents.members = True

bot = commands.Bot(command_prefix='!', intents=intents)

@bot.event
async def on_ready():
    if bot.user:
        print(f'{bot.user} est maintenant connecté à Discord!')
        print(f'ID: {bot.user.id}')
        print('------')

@bot.event
async def on_member_join(member):
    channel = member.guild.system_channel
    if channel is not None:
        await channel.send(f'Bienvenue dans la Arki Family, {member.mention}! 🎉')

@bot.command(name='bonjour')
async def hello(ctx):
    """Dire bonjour au bot"""
    await ctx.send(f'Bonjour {ctx.author.mention}! Bienvenue dans Arki Family! 👋')

@bot.command(name='info')
async def info(ctx):
    """Afficher les informations du serveur"""
    guild = ctx.guild
    embed = discord.Embed(
        title=f"Informations sur {guild.name}",
        color=discord.Color.blue()
    )
    embed.add_field(name="Membres", value=guild.member_count, inline=True)
    embed.add_field(name="Créé le", value=guild.created_at.strftime("%d/%m/%Y"), inline=True)
    embed.add_field(name="Propriétaire", value=guild.owner.mention, inline=True)
    embed.set_thumbnail(url=guild.icon.url if guild.icon else None)
    await ctx.send(embed=embed)

@bot.command(name='aide')
async def aide(ctx):
    """Afficher la liste des commandes disponibles"""
    embed = discord.Embed(
        title="Commandes Arki Family Bot",
        description="Voici la liste des commandes disponibles:",
        color=discord.Color.green()
    )
    embed.add_field(name="!bonjour", value="Dire bonjour au bot", inline=False)
    embed.add_field(name="!info", value="Afficher les informations du serveur", inline=False)
    embed.add_field(name="!aide", value="Afficher cette liste de commandes", inline=False)
    embed.set_footer(text="Arki Family Bot")
    await ctx.send(embed=embed)

if __name__ == '__main__':
    token = os.getenv('DISCORD_BOT_TOKEN')
    if not token:
        print("ERREUR: Le token Discord n'est pas défini!")
        print("Veuillez définir la variable d'environnement DISCORD_BOT_TOKEN")
    else:
        bot.run(token)
