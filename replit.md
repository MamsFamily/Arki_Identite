# Arki Family Discord Bot — Gestion des Tribus

## Overview
Bot Discord avancé pour la communauté Arki Family avec système complet de gestion de tribus. Le bot permet de créer, modifier et gérer des fiches de tribus avec une interface interactive (boutons et modals) et des slash commands en français.

## Fonctionnalités Principales

### Slash Commands (/)
- `/tribu créer` — Créer une nouvelle tribu
- `/tribu voir` — Afficher la fiche détaillée d'une tribu
- `/tribu lister` — Lister toutes les tribus du serveur
- `/tribu modifier` — Modifier les informations d'une tribu (nom, description, couleur, logo, base, tags)
- `/tribu ajouter_membre` — Ajouter un membre à une tribu avec un rôle optionnel et droits de manager
- `/tribu retirer_membre` — Retirer un membre d'une tribu
- `/tribu transférer` — Transférer la propriété d'une tribu
- `/tribu supprimer` — Supprimer une tribu (avec confirmation)
- `/panneau` — Ouvrir le panneau interactif avec boutons
- `/aide` — Afficher la liste complète des commandes
- `/tribu_test` — Tester si le bot répond

### Interface Utilisateur Interactive
- **Panneau Tribu** : Interface avec 4 boutons principaux
  - ➕ **Créer** : Ouvre un modal pour créer une tribu
  - 🛠️ **Modifier** : Ouvre un modal pour modifier une tribu
  - 📜 **Liste** : Affiche toutes les tribus
  - 👀 **Voir** : Ouvre un modal pour voir une tribu spécifique

### Système de Permissions
- **Propriétaire** : Créateur de la tribu, contrôle total
- **Managers** : Membres avec droits de gestion
- **Admins Serveur** : Permissions sur toutes les tribus

### Base de Données
Le bot utilise SQLite pour stocker :
- **Tribus** : id, guild_id, nom, description, couleur, logo_url, base, tags, proprietaire_id, created_at
- **Membres** : tribu_id, user_id, role, manager (flag)

## Configuration Requise
- Token Discord Bot via la variable d'environnement `DISCORD_BOT_TOKEN`
- Python 3.11+
- discord.py 2.6.4+

## Architecture du Projet
```
.
├── main.py          # Bot Discord complet avec slash commands et UI
├── .gitignore       # Fichiers Python et base de données à ignorer
├── tribus.db        # Base de données SQLite (créée automatiquement)
├── pyproject.toml   # Configuration Python/uv
├── uv.lock          # Dépendances verrouillées
└── replit.md        # Cette documentation
```

## Installation et Démarrage
1. Ajoutez votre token Discord dans les Secrets Replit avec la clé `DISCORD_BOT_TOKEN`
2. Le bot se lance automatiquement via le workflow configuré
3. Utilisez `/aide` dans Discord pour voir toutes les commandes disponibles

## Notes Importantes
- **Intégration Discord** : L'utilisateur a refusé l'intégration Discord de Replit. Le bot utilise donc une variable d'environnement `DISCORD_BOT_TOKEN`.
- **Sécurité** : Le token Discord ne doit JAMAIS être commité dans le code source.
- **Base de données** : Le fichier `tribus.db` est automatiquement créé et géré par le bot.
- **Langue** : Toutes les commandes et messages sont en français pour la communauté Arki Family.

## Recent Changes
- 14 octobre 2025 : Migration vers le bot complet avec système de tribus, UI interactive et base de données
- Ajout des modals Discord pour une meilleure expérience utilisateur
- Implémentation du système de permissions (propriétaire, managers, admins)

## User Preferences
- Bot en français
- Système de gestion de communauté pour Discord
