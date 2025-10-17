# Arki Family Discord Bot — Gestion des Tribus

## Overview
Le bot Discord "Arki Family" est conçu pour la communauté Ark: Survival Ascended, offrant un système complet et interactif de gestion de tribus. Il permet aux utilisateurs de créer, modifier et gérer des fiches de tribus détaillées via des commandes slash, des modals et des boutons. Les fonctionnalités incluent la gestion des membres, le suivi de la progression (boss/notes), des avant-postes, et un historique des actions. Ce bot vise à améliorer l'organisation et la communication au sein de la communauté Arki Family en fournissant une interface intuitive et des outils de gestion robustes.

## User Preferences
- Bot en français
- Système de gestion de communauté pour Ark: Survival Ascended
- Interface intuitive avec modals et boutons
- Tracking complet des actions (historique)

## System Architecture
Le bot utilise `discord.py` et s'appuie sur une architecture basée sur des interactions Discord modernes (slash commands, boutons, modals) pour une UX riche.

**UI/UX Decisions:**
- **Panneau Interactif (`/panneau`):** Un point d'entrée centralisé avec des boutons pour les actions principales (Créer, Modifier, Personnaliser, Détailler une tribu). Les panneaux admin s'auto-suppriment pour éviter l'encombrement.
- **Fiches Tribu Détaillées:** Affichent les informations dans un ordre structuré (En-tête, Description, Devise, Membres, Base Principale, Avant-Postes, Objectif, Recrutement, Progression Boss/Notes, Photo Base) avec des titres en **GRAS MAJUSCULES** pour la lisibilité.
- **Boutons sous la Fiche Tribu:** "Quitter tribu", "Historique" (avec pagination), et "Staff" (pour admins/modérateurs).
- **Modals:** Utilisés pour la saisie de données complexes, simplifiant les processus de création et de modification.
- **Menus Déroulants:** Pour la sélection de maps avec autocomplétion.

**Technical Implementations & Feature Specifications:**
- **Gestion des Tribus:** Création, modification (nom, couleur, logo, map/coords de base, description, devise, recrutement, photo, objectif), transfert de propriété, et suppression.
- **Gestion des Membres:** Ajout (avec nom in-game et autorisation manager), suppression, et possibilité de quitter une tribu.
- **Gestion des Avant-Postes:** Ajout (avec nom auto-généré) et suppression.
- **Système de Progression:** Suivi des boss et des notes complétés.
- **Historique des Actions:** Enregistrement détaillé des modifications avec utilisateur, action, détails et horodatage, consultable via pagination.
- **Système de Permissions:**
    - **Référent Tribu:** Créateur, contrôle total.
    - **Managers:** Membres autorisés à modifier.
    - **Admins Serveur:** Droits sur toutes les tribus.
    - **Modérateurs:** Rôle spécifique avec droits similaires aux admins (ID: `1157803768893689877`).
- **Personnalisation:** Supporte les couleurs hex, URLs de logos/photos, descriptions et devises libres.
- **Données par Défaut:** Listes pré-définies de boss, notes et maps, extensibles via commandes admin.

**System Design Choices:**
- **Base de Données SQLite (`tribus.db`):** Utilisée pour persister toutes les données du bot (tribus, membres, avant-postes, historique, boss, notes, maps).
- **Suivi des Fiches:** Les colonnes `message_id` et `channel_id` dans la table `tribus` permettent de mettre à jour dynamiquement les fiches affichées et de supprimer les anciennes.
- **Flexibilité des Champs:** Suppression des limitations de caractères pour la plupart des champs textuels (description, devise, objectif, etc.).

## External Dependencies
- **Discord API:** Le bot interagit directement avec l'API Discord via la bibliothèque `discord.py`.
- **SQLite:** Base de données embarquée pour la persistance des données.

## Recent Changes

### 17 octobre 2025 - Autocomplétion pour /tribu_voir
**Amélioration de la commande /tribu_voir** :
- ✅ **Menu déroulant** : Sélection des tribus existantes via autocomplétion
- ✅ **Recherche intelligente** : Filtre les tribus en temps réel pendant la frappe
- ✅ **Limite Discord** : Affiche jusqu'à 25 tribus dans la liste déroulante
- ✅ **Tri alphabétique** : Les tribus sont affichées par ordre alphabétique

### 17 octobre 2025 - Pagination de l'Historique
**Amélioration du bouton Historique** :
- ✅ **Pagination ajoutée** : Affiche 10 entrées par page au lieu de 20 fixes
- ✅ **Bouton "Voir +"** : Permet de charger les entrées plus anciennes
- ✅ **Navigation complète** : Remonte jusqu'à la création de la tribu
- ✅ **Compteur d'entrées** : Affiche "Entrées 1-10 sur 50 • Page 1/5"
- ✅ **Bouton auto-désactivé** : Le bouton "Voir +" se désactive quand il n'y a plus d'entrées