# ⚙️ Guide Staff — Bot Arki Family

Guide complet pour les **administrateurs** et **modérateurs** du serveur Discord Arki Family.

---

## 🔑 Permissions Staff

### Qui a accès aux commandes staff ?

**Administrateurs :**
- Droits Discord "Administrateur"
- Accès complet à toutes les tribus
- Toutes les commandes admin

**Modérateurs :**
- Rôle ID: `1157803768893689877`
- Même permissions que les admins
- Toutes les commandes admin

---

## 🎛️ Panneau Staff

### Accéder au panneau staff
1. Affiche une fiche tribu avec `/fiche_tribu`
2. Dans le menu déroulant sous la fiche, sélectionne **⚙️ Staff**
3. Un panneau éphémère (visible uniquement par toi) s'ouvre

### Boutons du panneau staff
**Rangée 1 — Tribu**
- ✏️ **Modifier tribu** — Ouvre le modal de modification
- 🎨 **Personnaliser** — Ouvre le modal de personnalisation

**Rangée 2 — Membres & avant-postes**
- 👤 **Ajouter membre** (avec info-bulle)
- 🏘️ **Ajouter avant-poste** (avec info-bulle)

**Rangée 3 — Galerie photo**
- 📸 **Ajouter photo** (ouvre un modal)
- 🗑️ **Supprimer photo** (menu de sélection)

**Rangée 4 — Actions critiques**
- 🔄 **Transférer propriété** (avec info-bulle)
- 🗑️ **Supprimer tribu** (avec info-bulle)

💡 **Avantage :** Le panneau se supprime automatiquement après 3 minutes pour éviter l'encombrement.

---

## 🗺️ Gestion des Maps

### Ajouter une map
`/ajout_map`

**Paramètre :**
- `nom` — Nom de la map (ex: "The Island", "Scorched Earth")

**Résultat :** La map est ajoutée à la liste globale et devient disponible dans l'autocomplétion pour toutes les commandes.

### Retirer une map
`/retirer_map`

**Paramètre :**
- `nom` — Nom de la map à retirer (autocomplétion disponible)

⚠️ **Attention :** Cette action ne supprime pas les tribus ou avant-postes utilisant cette map, elle la retire simplement de la liste de sélection.

---

## 🦖 Gestion des Boss

### Ajouter un boss
`/ajout_boss`

**Paramètre :**
- `nom` — Nom du boss (ex: "Broodmother", "Megapithecus")

**Résultat :** Le boss est ajouté à la liste globale et devient disponible pour toutes les tribus dans `/boss_validé_tribu` et `/boss_non_validé_tribu`.

### Retirer un boss
`/retirer_boss`

**Paramètre :**
- `nom` — Nom du boss à retirer (autocomplétion disponible)

⚠️ **Attention :** Cela retire le boss de la liste de sélection mais ne supprime pas les progressions existantes des tribus.

---

## 📝 Gestion des Notes d'exploration

### Ajouter une note
`/ajout_note`

**Paramètre :**
- `nom` — Nom de la note (ex: "Note de l'explorateur #1", "Chronique de l'île")

**Résultat :** La note est ajoutée à la liste globale pour le suivi de progression.

### Retirer une note
`/retirer_note`

**Paramètre :**
- `nom` — Nom de la note à retirer (autocomplétion disponible)

---

## 🎨 Personnalisation visuelle

### Changer la bannière du panneau
`/changer_bannière_panneau`

**Paramètre :**
- `url` — URL de la nouvelle image de bannière

**Où elle apparaît :**
- Panneau principal `/panneau` affiché par les admins (mode public)
- En haut de l'embed du panneau

**Recommandation :** Utilise une image au format 16:9 (ex: 1280x720px) pour un meilleur rendu.

---

## 🔧 Gestion avancée des tribus

### Droits sur toutes les tribus
En tant que staff, tu as accès à **toutes les tribus** du serveur :
- Modification complète des informations
- Ajout/suppression de membres
- Gestion des avant-postes
- Gestion de la galerie photo
- Transfert de propriété
- Suppression de tribu

### Modifier n'importe quelle tribu
1. Utilise `/fiche_tribu` pour afficher la tribu concernée
2. Clique sur **⚙️ Staff** dans le menu
3. Utilise les boutons du panneau staff

**Ou** utilise directement les commandes slash en sélectionnant la tribu dans l'autocomplétion.

### Transférer la propriété d'une tribu
`/tribu_transférer`

**Utilisation :**
1. Sélectionne la tribu concernée
2. Mentionne le nouveau propriétaire (@utilisateur)

**Use case :** Utile quand un référent quitte le serveur ou devient inactif.

### Supprimer une tribu
`/tribu_supprimer`

**Sécurité :** Confirmation requise en tapant exactement le nom de la tribu.

**Use case :**
- Tribu abandonnée
- Doublon
- Demande du propriétaire
- Nettoyage du serveur

---

## 📜 Consulter l'historique complet

### Accès à l'historique
1. Affiche la fiche tribu avec `/fiche_tribu`
2. Menu déroulant → **📜 Historique**

**Informations tracées :**
- Qui a effectué l'action (avec mention)
- Type d'action (création, modification, ajout membre, etc.)
- Détails précis de l'action
- Date et heure (timestamp Discord)

**Navigation :** Utilise les boutons **Page suivante** et **Page précédente**.

**Utilité staff :**
- Suivre les modifications suspectes
- Vérifier qui a modifié quoi
- Audit complet des actions sur une tribu

---

## 🛡️ Modération et bonnes pratiques

### Gestion des conflits
Si un membre se plaint qu'on a modifié sa tribu :
1. Consulte l'**historique** de la tribu
2. Vérifie qui a fait les modifications et quand
3. Si c'est une erreur d'un membre autorisé, discute avec lui
4. Si c'est une action non autorisée, rétablis les infos depuis l'historique

### Nettoyage régulier
Recommandations pour maintenir un serveur propre :
- Supprime les tribus inactives après X jours/semaines
- Vérifie les tribus sans membres
- Retire les maps/boss/notes obsolètes
- Nettoie les panneaux `/panneau` anciens (ils s'auto-suppriment déjà)

### Aide aux membres
Si un membre ne comprend pas une fonctionnalité :
- Oriente-le vers le **GUIDE_MEMBRE.md**
- Montre-lui le panneau `/panneau` et les boutons
- Explique le panneau **Mes commandes** sous les fiches
- Utilise `/guide` pour les liens de personnalisation

---

## 📊 Suivi des données

### Structure de la base de données
Le bot utilise SQLite avec les tables suivantes :

**Tables principales :**
- `tribus` — Informations des tribus
- `membres` — Membres de chaque tribu
- `avant_postes` — Avant-postes par tribu
- `photos_tribu` — Galerie photo (max 10 par tribu)
- `historique` — Journal complet des actions

**Tables de configuration :**
- `maps` — Liste des maps disponibles
- `boss` — Liste des boss
- `notes` — Liste des notes d'exploration
- `config` — Configuration du serveur (bannières, etc.)

**Tables de progression :**
- `boss_tribu` — Boss validés/non-validés par tribu
- `notes_tribu` — Notes validées/non-validées par tribu

### Persistance des interactions
- Les menus déroulants restent fonctionnels après redémarrage du bot
- Les boutons de galerie photo persistent également
- Système basé sur `custom_id` avec `tribu_id`

---

## 🚨 Dépannage

### Le bot ne répond pas
1. Utilise `/test_bot` pour vérifier la connexion
2. Vérifie que le workflow "Bot Discord" est en cours d'exécution
3. Consulte les logs du workflow si nécessaire

### Une commande ne fonctionne pas
1. Vérifie que les 29 commandes sont synchronisées
2. Redémarre le workflow si besoin
3. Vérifie les permissions du bot sur le serveur

### Un panneau ne répond plus
Les panneaux temporaires ont un timeout :
- Panneau staff : 3 minutes (180 secondes)
- Panneau membre : 3 minutes (180 secondes)
- Panneaux publics : pas de timeout

Si le timeout est atteint, réaffiche simplement le panneau.

### L'autocomplétion ne fonctionne pas
L'autocomplétion est dynamique et cherche dans la base de données :
- Pour les tribus : recherche par nom
- Pour les maps/boss/notes : liste globale
- Pour les photos : par tribu spécifique

Si une donnée n'apparaît pas, vérifie qu'elle existe bien dans la base.

---

## 🎯 Commandes réservées au Staff

### Liste complète des commandes admin

**Gestion des maps**
- `/ajout_map` — Ajouter une map
- `/retirer_map` — Retirer une map

**Gestion des boss**
- `/ajout_boss` — Ajouter un boss
- `/retirer_boss` — Retirer un boss

**Gestion des notes**
- `/ajout_note` — Ajouter une note
- `/retirer_note` — Retirer une note

**Personnalisation**
- `/changer_bannière_panneau` — Changer la bannière du panneau public

**Gestion des tribus (sur toutes les tribus)**
- Toutes les commandes de modification
- Tous les boutons du panneau staff

---

## 📝 Récapitulatif des 29 commandes totales

### Commandes membres (accessibles à tous)
1. `/créer_tribu`
2. `/fiche_tribu`
3. `/modifier_tribu`
4. `/personnaliser_tribu`
5. `/tribu_transférer`
6. `/tribu_supprimer`
7. `/quitter_tribu`
8. `/ajouter_membre_tribu`
9. `/supprimer_membre_tribu`
10. `/mon_nom_ingame`
11. `/ajouter_avant_poste`
12. `/supprimer_avant_poste`
13. `/ajouter_photo`
14. `/supprimer_photo`
15. `/boss_validé_tribu`
16. `/boss_non_validé_tribu`
17. `/note_validé_tribu`
18. `/notes_non_validé_tribu`
19. `/panneau`
20. `/aide`
21. `/guide`
22. `/test_bot`

### Commandes staff (admin/modo uniquement)
23. `/ajout_map`
24. `/retirer_map`
25. `/ajout_boss`
26. `/retirer_boss`
27. `/ajout_note`
28. `/retirer_note`
29. `/changer_bannière_panneau`

---

## 💡 Conseils pour les admins

✅ **Définis des boss et notes par map** pour une progression cohérente  
✅ **Utilise le panneau staff** pour modifier rapidement les tribus  
✅ **Consulte régulièrement les historiques** pour détecter les abus  
✅ **Nettoie les tribus inactives** pour garder le serveur organisé  
✅ **Personnalise la bannière** selon les événements (raids, saisons...)  
✅ **Guide les nouveaux membres** vers le GUIDE_MEMBRE.md  
✅ **Communique les mises à jour** du bot aux membres  

---

## 🔐 Sécurité et confidentialité

### Gestion des permissions
- Les référents ont le contrôle total de leur tribu
- Les managers peuvent modifier mais pas supprimer
- Les membres classiques ne peuvent que quitter
- Le staff a accès à tout (pour la modération)

### Protection contre les abus
- Confirmation requise pour supprimer une tribu
- Historique complet de toutes les actions
- Messages éphémères pour les panneaux sensibles
- Auto-suppression des panneaux admin après 3 minutes

### Données sensibles
Le bot **NE stocke PAS** :
- Messages privés
- Contenu des discussions
- Données sensibles des utilisateurs

Le bot **stocke uniquement** :
- Informations publiques des tribus
- Noms in-game déclarés volontairement
- Actions effectuées (pour l'historique)

---

## 🆘 Support et contact

En cas de problème technique avec le bot :
1. Vérifie les logs du workflow
2. Redémarre le bot si nécessaire
3. Contacte le développeur/administrateur technique

Pour les questions de modération :
1. Consulte l'historique des actions
2. Discute avec le membre concerné
3. Applique les règles du serveur

---

**Merci de ton engagement pour la communauté Arki Family !** 🦕

*Ce guide est mis à jour régulièrement. Dernière mise à jour : Octobre 2025*
