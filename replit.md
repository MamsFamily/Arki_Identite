# Arki Family Discord Bot — Gestion des Tribus

## Overview
Bot Discord avancé pour la communauté Arki Family avec système complet de gestion de tribus. Le bot permet de créer, modifier et gérer des fiches de tribus avec une interface interactive (boutons et modals) et des slash commands en français.

## Fonctionnalités Principales

### Slash Commands (/)
- `/tribu créer` — Créer une nouvelle tribu (nom + map base + coords base **obligatoires**)
- `/tribu voir` — Afficher la fiche détaillée d'une tribu avec base et avant-postes
- `/tribu lister` — Lister toutes les tribus du serveur
- `/tribu modifier` — Modifier les informations d'une tribu (nom, description, couleur, logo, base, map_base, coords_base, tags)
- `/tribu ajouter_membre` — Ajouter un membre à une tribu avec un rôle optionnel et droits de manager
- `/tribu retirer_membre` — Retirer un membre d'une tribu
- `/tribu ajouter_avant_poste` — Ajouter ton avant-poste (détection automatique de ta tribu, demande nom, map et coords)
- `/tribu retirer_avant_poste` — Retirer un avant-poste d'une tribu
- `/tribu transférer` — Transférer la propriété d'une tribu
- `/tribu supprimer` — Supprimer une tribu (avec confirmation)
- `/panneau` — Ouvrir le panneau interactif avec boutons
- `/aide` — Afficher la liste complète des commandes
- `/tribu_test` — Tester si le bot répond

### Interface Utilisateur Interactive
- **Panneau Tribu** : Interface avec 4 boutons principaux
  - ➕ **Créer** : Ouvre un modal pour créer une tribu
    - Nom de la tribu (**obligatoire**)
    - Map de la base principale (**obligatoire**)
    - Coordonnées de la base (**obligatoire**)
    - Note : Ajoutez membres et avant-postes après avec les commandes
  - 🛠️ **Modifier** : Ouvre un modal pour modifier une tribu
  - 📜 **Liste** : Affiche toutes les tribus
  - 👀 **Voir** : Ouvre un modal pour voir une tribu spécifique

### Système de Permissions
- **Propriétaire** : Créateur de la tribu, contrôle total
- **Managers** : Membres avec droits de gestion
- **Admins Serveur** : Permissions sur toutes les tribus

### Base de Données
Le bot utilise SQLite pour stocker :
- **Tribus** : id, guild_id, nom, description, couleur, logo_url, base, map_base, coords_base, tags, proprietaire_id, created_at
- **Membres** : tribu_id, user_id, role, manager (flag)
- **Avant-postes** : id, tribu_id, user_id, nom, map, coords, created_at

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
- 15 octobre 2025 : 
  - **Simplification de la création de tribu** : Modal avec 3 champs obligatoires (nom, map base, coords base)
  - **Simplification de `/tribu ajouter_avant_poste`** : Détection automatique de la tribu du joueur
  - Ajout d'une note informative après création pour ajouter membres et avant-postes
  - Fix des bugs sqlite3.Row (utilisation de [] au lieu de .get())
- 14 octobre 2025 : 
  - Migration vers le bot complet avec système de tribus, UI interactive et base de données
  - Ajout des modals Discord pour une meilleure expérience utilisateur
  - Implémentation du système de permissions (propriétaire, managers, admins)
  - Ajout des champs map_base et coords_base pour la base principale
  - Création du système d'avant-postes avec map et coordonnées pour chaque joueur

## User Preferences
- Bot en français
- Système de gestion de communauté pour Discord
