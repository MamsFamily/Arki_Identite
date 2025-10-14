# Arki Family Discord Bot

## Overview
Bot Discord pour la communauté Arki Family. Le bot accueille les nouveaux membres, fournit des informations sur le serveur et offre des commandes utiles en français.

## Configuration Requise
- Token Discord Bot via la variable d'environnement `DISCORD_BOT_TOKEN`
- Python 3.11+
- discord.py 2.6.4+

## Commandes Disponibles
- `!bonjour` - Le bot dit bonjour à l'utilisateur
- `!info` - Affiche les informations du serveur Discord
- `!aide` - Liste toutes les commandes disponibles

## Fonctionnalités
- Message de bienvenue automatique pour les nouveaux membres
- Commandes en français pour la communauté
- Embeds Discord élégants pour les réponses

## Architecture
```
.
├── main.py          # Fichier principal du bot Discord
├── .gitignore       # Fichiers Python à ignorer
└── replit.md        # Cette documentation
```

## Notes Importantes
- **Note sur l'intégration Discord**: L'utilisateur a refusé d'utiliser l'intégration Discord de Replit. Le bot utilise donc une variable d'environnement `DISCORD_BOT_TOKEN` pour le token.
- Le token Discord ne doit JAMAIS être commité dans le code source
- Utilisez les secrets/variables d'environnement Replit pour stocker le token

## Installation et Démarrage
1. Ajoutez votre token Discord dans les Secrets Replit avec la clé `DISCORD_BOT_TOKEN`
2. Exécutez `python main.py` pour démarrer le bot

## Date de Création
14 octobre 2025
