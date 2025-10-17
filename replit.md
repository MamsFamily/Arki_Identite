# Arki Family Discord Bot — Gestion des Tribus

## Overview
Bot Discord avancé pour la communauté Arki Family avec système complet de gestion de tribus. Le bot permet de créer, modifier et gérer des fiches de tribus avec une interface interactive (boutons et modals) et des slash commands en français. Le bot inclut un système de progression (boss/notes), recrutement, objectifs, historique et gestion avancée des membres.

## Fonctionnalités Principales

### Panneau Interactif
Commande `/panneau` ouvre un panneau avec 4 boutons :
- **✨ Créer** : Créer une nouvelle tribu (nom, couleur, logo, map base, coords base)
- **🛠️ Modifier** : Modifier nom, couleur, logo, map/coords base (détection auto de ta tribu)
- **🎨 Personnaliser** : Description, devise, logo, couleur, recrutement
- **📋 Détailler** : Photo base, objectif (progression boss/notes via commandes dédiées)

**Note Admin** : Quand un admin demande le panneau, tous les anciens panneaux sont automatiquement supprimés.

### Commandes Slash (/)

#### Commandes Principales
- `/créer_tribu` — Créer une nouvelle tribu
- `/modifier_tribu` — Modifier les infos d'une tribu
- `/personnaliser_tribu` — Personnaliser devise, logo, couleur, recrutement
- `/détailler_tribu` — Ajouter photo base, objectif, progression boss/notes
- `/tribu_voir` — Afficher une fiche tribu (Admin/Modo uniquement)
- `/tribu_transférer` — Transférer la propriété d'une tribu
- `/tribu_supprimer` — Supprimer une tribu (avec confirmation)
- `/panneau` — Ouvrir le panneau interactif
- `/aide` — Afficher la liste complète des commandes
- `/test_bot` — Tester si le bot répond

#### Gestion des Membres
- `/ajouter_membre_tribu` — Ajouter un membre (discord + nom in-game + autorisation)
- `/supprimer_membre_tribu` — Retirer un membre
- `/quitter_tribu` — Quitter sa tribu

#### Gestion des Avant-Postes
- `/ajouter_avant_poste` — Ajouter ton avant-poste (map + coords, nom auto-généré)
- `/supprimer_avant_poste` — Retirer un avant-poste

#### Commandes Admin
- `/ajout_map` — Ajouter une map personnalisée (Admin uniquement)
- `/retirer_map` — Retirer une map de la liste (Admin uniquement)
- `/ajout_boss` — Ajouter un boss aux options de progression (Admin uniquement)
- `/retirer_boss` — Retirer un boss des options (Admin uniquement)
- `/ajout_note` — Ajouter une note aux options de progression (Admin uniquement)
- `/retirer_note` — Retirer une note des options (Admin uniquement)

### Boutons sous la Fiche Tribu
Chaque fiche tribu affichée a 3 boutons :
- **🚪 Quitter tribu** : Pour se retirer de la tribu (tous les membres)
- **📜 Historique** : Voir l'historique des actions (managers, admin, modo uniquement)
- **⚙️ Staff** : Activer le mode staff avec tous les droits (admin/modo uniquement)

### Système de Permissions
- **Référent Tribu** : Créateur de la tribu, contrôle total (affiché en haut de la fiche)
- **Managers** : Membres autorisés à modifier la fiche (invisible sur la fiche)
- **Admins Serveur** : Permissions sur toutes les tribus
- **Modérateurs** : Rôle modo (ID: 1157803768893689877) avec droits similaires aux admins

### Fiche Tribu Améliorée
La fiche tribu affiche :
- **En-tête** : Logo (si présent) et couleur personnalisée
- **Référent Tribu** : Mention du créateur
- **Description** : Courte description (50 car. max)
- **Devise** : Devise de la tribu
- **Objectif** : Objectif actuel (50 car. max)
- **Recrutement** : Statut ouvert/fermé
- **Photo Base** : Image de la base principale (si présente)
- **Base Principale** : Map et coordonnées
- **Membres** : Liste de tous les membres
- **Avant-Postes** : Liste des avant-postes avec map/coords (sans noms de joueurs)
- **Progression Boss** : Boss complétés (avec ✅)
- **Progression Notes** : Notes complétées (avec ✅)

### Base de Données
Le bot utilise SQLite avec les tables suivantes :

- **tribus** : id, guild_id, nom, description, couleur, logo_url, map_base, coords_base, proprietaire_id, created_at, message_id, channel_id, devise, ouvert_recrutement, photo_base, objectif, progression_boss, progression_notes

- **membres** : tribu_id, user_id, manager (1=autorisé à modifier, 0=non), nom_in_game

- **avant_postes** : id, tribu_id, user_id, nom (auto-généré), map, coords, created_at

- **historique** : id, tribu_id, user_id, action, details, created_at

- **boss** : id, guild_id (0=global, autre=serveur), nom, created_at
  - Boss par défaut : Broodmother, Megapithecus, Dragon, Cave Tek, Manticore, Rockwell, King Titan, Boss Astraeos

- **notes** : id, guild_id (0=global, autre=serveur), nom, created_at
  - Notes par défaut : Notes Island, Notes Scorched, Notes Abbération, Extinction, Bob

- **maps** : id, guild_id (0=global, autre=serveur), nom, created_at
  - Maps par défaut : The Island, Scorched Earth, Svartalfheim, Abberation, The Center, Extinction, Astraeos, Ragnarok, Valguero

**Note** : Les colonnes `message_id` et `channel_id` permettent au bot de suivre la dernière fiche publiée pour chaque tribu, afin de pouvoir la supprimer automatiquement lors d'une mise à jour.

## Configuration Requise
- Token Discord Bot via la variable d'environnement `DISCORD_BOT_TOKEN`
- Python 3.11+
- discord.py 2.6.4+

## Architecture du Projet
```
.
├── main.py          # Bot Discord complet (1100+ lignes)
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
- **Rôle Modo** : ID 1157803768893689877 (droits similaires aux admins)
- **Historique** : Toutes les actions sont trackées (création, modification, ajout/retrait membres, etc.)

## Recent Changes

### 17 octobre 2025 - Optimisation des Modals et Auto-Suppression Panneaux
**Amélioration de l'UX des modals** :

#### Panneau - Suppression automatique (Admin uniquement)
- Lorsqu'un **admin** demande un nouveau panneau avec `/panneau`, tous les anciens panneaux sont automatiquement supprimés (recherche dans les 50 derniers messages)
- Les membres non-admin créent des panneaux privés sans supprimer les autres

#### Modal "✨ Créer" - 5 champs
- Nom de la tribu (obligatoire)
- Couleur hex (optionnel) - Ex: #00AAFF
- Logo URL (optionnel)
- Map base (obligatoire)
- Coords base (obligatoire)
- ❌ Champ "membre" retiré → utiliser `/ajouter_membre_tribu` après création

#### Modal "🛠️ Modifier" - 5 champs
- Nom tribu (optionnel)
- Couleur hex (optionnel)
- Logo URL (optionnel)
- Map base (optionnel)
- Coords base (optionnel)
- ❌ Champs "ajouter/supprimer membres" retirés → utiliser `/ajouter_membre_tribu` et `/supprimer_membre_tribu`

#### Modal "📋 Détailler" - 2 champs
- Photo base URL (optionnel)
- Objectif (50 car. max, optionnel)
- ❌ Champs "progression boss/notes" retirés → utiliser `/boss_validé_tribu` et `/note_validé_tribu`

### 17 octobre 2025 - REFONTE MAJEURE 🎉
**Refonte complète du panneau et des commandes** :

#### Nouveau Panneau (4 boutons) :
- ✨ **Créer** : Modal avec nom, couleur, logo, map base, coords base
- 🛠️ **Modifier** : Modal pour modifier nom, couleur, logo, map/coords base (détection auto)
- 🎨 **Personnaliser** : Modal pour description, devise, logo, couleur, recrutement
- 📋 **Détailler** : Modal pour photo base, objectif (progression boss/notes via commandes dédiées)

#### Boutons sous la fiche tribu (3 boutons) :
- 🚪 **Quitter tribu** : Se retirer de la tribu
- 📜 **Historique** : Voir l'historique (managers/admin/modo)
- ⚙️ **Staff** : Mode staff avec tous les droits (admin/modo)

#### Commandes renommées :
- `/tribu créer` → `/créer_tribu`
- `/tribu modifier` → `/modifier_tribu`
- `/tribu ajouter_membre` → `/ajouter_membre_tribu` (+ nom_in_game)
- `/tribu retirer_membre` → `/supprimer_membre_tribu`
- `/tribu ajouter_avant_poste` → `/ajouter_avant_poste` (nom auto-généré)
- `/tribu retirer_avant_poste` → `/supprimer_avant_poste`
- `/tribu_test` → `/test_bot`
- `/map ajouter` → `/ajout_map`
- `/map supprimer` → `/retirer_map`

#### Nouvelles commandes :
- `/personnaliser_tribu` (même fonction que bouton Personnaliser)
- `/détailler_tribu` (même fonction que bouton Détailler)
- `/quitter_tribu` (même fonction que bouton Quitter)
- `/ajout_boss` (admin : ajouter boss aux options)
- `/retirer_boss` (admin : retirer boss)
- `/ajout_note` (admin : ajouter note aux options)
- `/retirer_note` (admin : retirer note)

#### Commandes supprimées :
- `/tribu lister` (retiré)
- `/map lister` (retiré)

#### Nouvelles fonctionnalités :
- **Référent Tribu** : Le créateur s'affiche comme "Référent Tribu" (pas "Propriétaire")
- **Nom In-Game** : Chaque membre a un nom Discord ET un nom in-game
- **Autorisation invisible** : Les membres autorisés à modifier ne sont plus visibles sur la fiche
- **Devise** : Chaque tribu peut avoir une devise
- **Recrutement** : Statut ouvert/fermé visible sur la fiche
- **Photo Base** : URL d'image pour la base principale
- **Objectif** : Objectif actuel de la tribu (50 car. max)
- **Progression Boss** : Système de suivi des boss complétés (cases à cocher via texte)
- **Progression Notes** : Système de suivi des notes complétées
- **Historique** : Tracking de toutes les actions avec date/heure/utilisateur
- **Avant-postes auto-nommés** : Avant-Poste 1, 2, 3... (pas de nom custom)
- **Affichage amélioré** : Fiche tribu complètement redesignée avec toutes les nouvelles infos

#### Base de données étendue :
- Table **historique** : tracking des actions
- Table **boss** : boss disponibles pour progression
- Table **notes** : notes disponibles pour progression
- Colonnes ajoutées à **tribus** : devise, ouvert_recrutement, photo_base, objectif, progression_boss, progression_notes
- Colonne ajoutée à **membres** : nom_in_game

#### 21 commandes synchronisées avec succès ✅

### 15 octobre 2025
- **Affichage automatique des fiches mises à jour** : Quand une tribu est modifiée, le bot affiche automatiquement la fiche mise à jour et supprime l'ancienne
- **Simplification de l'affichage** : Suppression de la section "Managers" et du nom des joueurs sur les avant-postes
- **Simplification de la création de tribu** : Modal avec 3 champs obligatoires (nom, map base, coords base)
- **Simplification de `/tribu ajouter_avant_poste`** : Détection automatique de la tribu du joueur
- **Simplification de `/tribu ajouter_membre`** : Détection automatique de la tribu du propriétaire/manager
- **Ajout de menus déroulants** : Sélection de map via autocomplete pour bases et avant-postes
- **Système de maps personnalisées** : Table de base de données pour stocker les maps
- **Panneau admin public** : Les admins peuvent afficher le panneau visible par tous avec `/panneau`
- **Suppression des tags** : Fonctionnalité retirée pour simplifier l'interface
- Fix des bugs sqlite3.Row (utilisation de [] au lieu de .get())

### 14 octobre 2025
- Migration vers le bot complet avec système de tribus, UI interactive et base de données
- Ajout des modals Discord pour une meilleure expérience utilisateur
- Implémentation du système de permissions (propriétaire, managers, admins)
- Ajout des champs map_base et coords_base pour la base principale
- Création du système d'avant-postes avec map et coordonnées pour chaque joueur

## User Preferences
- Bot en français
- Système de gestion de communauté pour Ark: Survival Ascended
- Interface intuitive avec modals et boutons
- Tracking complet des actions (historique)
