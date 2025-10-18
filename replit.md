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
- **Panneau Interactif (`/panneau`):** Un point d'entrée centralisé avec des boutons pour les actions principales (Créer, Modifier, Personnaliser, Guide). Les panneaux admin s'auto-suppriment pour éviter l'encombrement. Inclut une bannière visuelle.
- **Fiches Tribu Détaillées:** Affichent les informations dans un ordre structuré (En-tête, Description, Devise, Membres, Base Principale, Avant-Postes, Objectif, Recrutement, Progression Boss/Notes, Photo Base) avec des titres en **GRAS MAJUSCULES** pour la lisibilité.
- **Menu Déroulant sous la Fiche Tribu:** Menu avec 3 options - "Quitter tribu", "Historique" (avec pagination), et "Staff" (pour admins/modérateurs).
- **Modals:** Utilisés pour la saisie de données complexes, simplifiant les processus de création et de modification.
- **Menus Déroulants:** Pour la sélection de maps et tribus avec autocomplétion.

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

### 18 octobre 2025 - Panneau "Mes Commandes" pour les Membres
**Nouveau panneau d'aide pour les membres** :
- ✅ **Option "Mes commandes"** : Nouvelle option dans le menu déroulant sous les fiches tribu (en 1ère position)
- ✅ **Panneau temporaire d'aide** : Accessible à tous les membres, affiche un panneau éphémère avec des rappels de commandes utiles
- ✅ **4 boutons d'aide** : Changer nom in-game, Voir fiche tribu, Voir toutes les commandes, Consulter le guide
- ✅ **Interface cohérente** : Design similaire au panneau staff, mais adapté aux besoins des membres réguliers
- ✅ **Menu complet** : Le menu déroulant contient maintenant 4 options (Mes commandes, Quitter tribu, Historique, Staff)

### 18 octobre 2025 - Persistance des Menus après Redémarrage
**Système de persistance avancé** :
- ✅ **Menus déroulants persistants** : Les menus sous les fiches tribu restent **fonctionnels même après redémarrage** du bot
- ✅ **Custom ID dynamique** : Chaque menu inclut l'ID de la tribu dans son identifiant unique (`menu_fiche:{tribu_id}`)
- ✅ **Listener global** : Un événement `on_interaction` intercepte les interactions avec les anciens menus et recrée dynamiquement la logique
- ✅ **Zéro maintenance** : Plus besoin de réafficher les fiches pour réactiver les menus après un redémarrage

### 18 octobre 2025 - Panneau Staff Contextuel
**Nouveau système de gestion staff** :
- ✅ **Panneau staff éphémère** : Quand un admin/modo clique sur "Staff" dans le menu déroulant d'une fiche, un panneau temporaire s'ouvre (visible uniquement par lui)
- ✅ **Nom de la tribu dans le titre** : Le panneau affiche clairement "⚙️ Panneau Staff — [Nom de la tribu]"
- ✅ **8 boutons d'actions** : Modifier, Personnaliser, Ajouter membre, Supprimer membre, Ajouter avant-poste, Supprimer avant-poste, Réafficher fiche, Supprimer tribu
- ✅ **Actions contextuelles** : Toutes les actions s'appliquent à la tribu affichée, plus besoin de retaper le nom
- ✅ **Rappels automatiques** : Les boutons indiquent quelle commande utiliser avec le nom de la tribu pré-rempli

### 18 octobre 2025 - Système de Double Suivi Boss/Notes
**Nouveau système de progression avec deux états** :
- ✅ **Boss/Notes validés** : Affichés avec l'emoji <a:ok:1328152449785008189>
- ✅ **Boss/Notes non-validés** : Affichés avec l'emoji <a:no:1328152539660554363>
- ✅ **Changement d'état dynamique** : Les boss/notes passent d'une liste à l'autre selon la commande utilisée
- ✅ **/boss_validé_tribu** : Déplace un boss vers la liste "validé"
- ✅ **/boss_non_validé_tribu** : Déplace un boss vers la liste "non-validé"
- ✅ **/note_validé_tribu** : Déplace une note vers la liste "validé"
- ✅ **/notes_non_validé_tribu** : Déplace une note vers la liste "non-validé"
- ✅ **Affichage unique** : Les deux listes s'affichent ensemble sur la fiche tribu
- ✅ **Autocomplétion Admin** : Les commandes `/retirer_boss` et `/retirer_note` ont maintenant des menus déroulants
- ✅ **Total : 27 commandes** slash disponibles

### 17 octobre 2025 - Gestion Intelligente des Fiches Tribu
**Amélioration de l'affichage des fiches** :
- ✅ **Suppression conditionnelle** : Les fiches ne sont supprimées que si affichées dans le **même salon**
- ✅ **Multi-salon** : Permet d'afficher la même tribu dans plusieurs salons différents simultanément
- ✅ **Pas de doublons** : Si on affiche dans le même salon, toutes les anciennes fiches de cette tribu sont supprimées avant d'afficher la nouvelle

### 17 octobre 2025 - Nom In Game lors de la création
**Amélioration du modal Créer** :
- ✅ **Nouveau champ "Ton nom In Game"** : Demande le nom in-game du créateur lors de la création d'une tribu
- ✅ **Affichage dans la fiche** : Le nom in-game s'affiche à côté du nom d'utilisateur Discord dans la liste des membres
- ✅ **Champs optionnels** : Map base et coords base sont maintenant optionnels lors de la création (peuvent être ajoutés via Modifier)
- ✅ **Nouvelle commande /mon_nom_ingame** : Permet à tout membre de modifier son nom in-game affiché dans ses tribus

### 17 octobre 2025 - Amélioration du Guide
**Ajout de sections informatives** :
- ✅ **Section gestion membres/avant-postes** : Ajout des commandes `/ajouter_membre_tribu`, `/supprimer_membre_tribu`, `/ajouter_avant_poste`, `/supprimer_avant_poste` dans le guide
- ✅ **Référence à /aide** : Le footer indique maintenant d'utiliser `/aide` pour voir toutes les commandes disponibles

### 17 octobre 2025 - Commande Admin Bannière Panneau
**Nouvelle commande admin** :
- ✅ **/changer_bannière_panneau** : Permet aux admins de modifier la bannière du panneau avec une URL personnalisée
- ✅ **Stockage en base de données** : La bannière est sauvegardée par serveur Discord
- ✅ **Bannière par défaut** : Une bannière est définie par défaut pour tous les serveurs

### 18 octobre 2025 - Logo et Avatar du Créateur
**Amélioration visuelle de la fiche** :
- ✅ **Logo en haut** : Le logo s'affiche en haut à droite (thumbnail)
- ✅ **Avatar du créateur par défaut** : Si aucun logo n'est ajouté, la photo du créateur s'affiche à sa place
- ✅ **Photo de base en grand** : La photo de base s'affiche en grand en bas (image principale)
- ✅ **Champs Base obligatoires** : Map base et Coordonnées base sont maintenant obligatoires lors de la création

### 18 octobre 2025 - Modal Créer : Recrutement et Nom In-Game Obligatoire
**Amélioration du modal de création** :
- ✅ **Champ "Recrutement ouvert"** : Remplace "Description" dans le modal Créer pour capturer directement le statut de recrutement
- ✅ **Nom In-Game obligatoire** : Le champ "Ton nom In Game" est maintenant requis lors de la création d'une tribu
- ✅ **Modal Créer actualisé** : 5 champs obligatoires (Nom*, Ton nom In Game*, Map base*, Coords base*, Recrutement ouvert)

### 17 octobre 2025 - Refonte Complète des Modals et UI
**Réorganisation majeure des modals** :
- ✅ **Modal Créer** : 5 champs - Nom*, Ton nom In Game*, Map base*, Coords base*, Recrutement ouvert
- ✅ **Modal Modifier** : 5 champs - Nom, Map base, Coords base, Description, Recrutement
- ✅ **Modal Personnaliser** : 5 champs - Couleur, Logo, Objectif, Devise, Photo base
- ✅ **Guide** : Affichage en lecture seule via embed avec 3 sections d'information (site couleur, site images, commandes progression)

**Changements de commandes** :
- ✅ **/détailler_tribu** renommée en **/guide**

**Amélioration du panneau** :
- ✅ **Couleurs des boutons** : Créer=vert, Modifier=bleu, Personnaliser=bleu, Guide=gris
- ✅ **Bannière** : Ajout d'une bannière visuelle personnalisée en haut du panneau (https://i.postimg.cc/8c6gy1qK/AB2723-D2-B10-F-40-F7-A124-1-D6-F30510096.jpg)

**Menu déroulant sous la fiche** :
- ✅ **Remplacement des boutons** : Menu déroulant avec 3 options (Quitter tribu, Historique, Staff)
- ✅ **UX améliorée** : Plus compact et intuitif

### 17 octobre 2025 - Ajout du label "Devise"
**Amélioration visuelle de la fiche** :
- ✅ **Label avant la devise** : Ajout de "💬 Devise :" avant la devise dans la fiche tribu

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