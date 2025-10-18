# 📖 Guide Membre — Bot Arki Family

Bienvenue dans le guide complet du bot de gestion des tribus Arki Family ! Ce guide t'explique comment utiliser toutes les fonctionnalités disponibles pour les membres.

---

## 🚀 Démarrage rapide

### 1️⃣ Créer ta tribu
Utilise la commande `/créer_tribu` ou clique sur le bouton **Créer** dans le panneau `/panneau`.

**Informations nécessaires :**
- Nom de ta tribu
- Ton nom in-game
- Map de ta base principale
- Coordonnées de ta base (ex: 45.5, 32.6)
- Statut de recrutement (optionnel)

**Résultat :** Ta fiche tribu est créée et affichée ! Tu es automatiquement défini comme **référent** (propriétaire).

---

## 🎛️ Panneau interactif

### Ouvrir le panneau
Tape `/panneau` pour accéder au panneau principal avec tous les boutons d'actions rapides.

**Boutons disponibles :**
- 🆕 **Créer** — Créer une nouvelle tribu
- ✏️ **Modifier** — Modifier les infos de base
- 🎨 **Personnaliser** — Personnaliser couleur, logo, devise...
- 📖 **Guide** — Afficher le guide de personnalisation

---

## 📋 Gérer ta fiche tribu

### Afficher une fiche tribu
`/fiche_tribu` puis sélectionne le nom de la tribu

**Ce qui s'affiche :**
- Nom et description
- Devise de la tribu
- Liste des membres avec leur nom in-game
- Base principale (map + coordonnées)
- Avant-postes
- Objectif de la tribu
- Statut de recrutement
- Progression Boss & Notes
- Galerie photo (avec navigation ◀️ ▶️)

**Menu sous la fiche :**
- 💡 **Mes commandes** — Panneau d'aide personnalisé
- 🚪 **Quitter tribu** — Quitter cette tribu
- 📜 **Historique** — Voir l'historique des modifications
- ⚙️ **Staff** — Mode staff (admins/modos uniquement)

---

## ✏️ Modifier ta tribu

### Informations de base
`/modifier_tribu` puis remplis le modal avec :
- Nom (peut être changé)
- Description complète
- Map de la base principale
- Coordonnées de la base
- Statut de recrutement

### Personnalisation avancée
`/personnaliser_tribu` pour modifier :
- **Couleur** (code hex, ex: #00AAFF)
  - Site recommandé : https://htmlcolorcodes.com/fr/selecteur-de-couleur/
- **Logo** (URL d'image)
- **Devise** de la tribu
- **Objectif** de la tribu

💡 **Astuce :** Utilise https://postimages.org pour héberger tes images et obtenir un lien direct.

---

## 📸 Galerie photo

### Ajouter une photo
**Méthode 1 :** `/ajouter_photo` puis entre l'URL de la photo  
**Méthode 2 :** Menu fiche tribu → **Mes commandes** → Bouton **Ajouter photo**

- **Limite :** 10 photos maximum par tribu
- **Format :** URL directe vers l'image
- **Recommandé :** postimages.org pour héberger

### Supprimer une photo
**Méthode 1 :** `/supprimer_photo` puis sélectionne la photo à retirer  
**Méthode 2 :** Menu fiche tribu → **Mes commandes** → Bouton **Supprimer photo**

### Naviguer dans la galerie
Sur la fiche tribu, utilise les boutons :
- ◀️ **Photo précédente**
- ▶️ **Photo suivante**

L'indicateur **"📸 Photo 2/5"** montre ta position dans la galerie.

---

## 👥 Gestion des membres

### Ajouter un membre
`/ajouter_membre_tribu`

**Paramètres :**
- Nom de ta tribu
- Utilisateur Discord à ajouter
- Nom in-game du membre
- **Manager** (Oui/Non) — Les managers peuvent modifier la tribu

**Permissions :** Seul le référent ou les managers peuvent ajouter des membres.

### Supprimer un membre
`/supprimer_membre_tribu`

Sélectionne ta tribu et le membre à retirer.

### Modifier ton nom in-game
`/mon_nom_ingame`

Change ton nom in-game affiché dans toutes tes tribus sans demander aux référents.

### Quitter une tribu
**Méthode 1 :** `/quitter_tribu`  
**Méthode 2 :** Menu fiche tribu → **Quitter tribu**

⚠️ **Attention :** Le référent (propriétaire) ne peut pas quitter sa tribu. Il doit d'abord transférer la propriété ou supprimer la tribu.

---

## 🏘️ Gestion des avant-postes

### Ajouter un avant-poste
`/ajouter_avant_poste`

**Informations nécessaires :**
- Nom de ta tribu
- Map de l'avant-poste
- Coordonnées (ex: 23.4, 67.8)

Un nom automatique sera généré (ex: "AP-1", "AP-2"...).

### Supprimer un avant-poste
`/supprimer_avant_poste`

Sélectionne ta tribu et l'avant-poste à retirer.

---

## 📊 Progression Boss & Notes

### Valider un boss
`/boss_validé_tribu`

Marque un boss comme **complété** (affiché avec l'émoji animé validé).

### Retirer un boss
`/boss_non_validé_tribu`

Marque un boss comme **non-validé** (affiché avec l'émoji non-validé).

### Valider une note
`/note_validé_tribu`

Marque une note d'exploration comme **trouvée**.

### Retirer une note
`/notes_non_validé_tribu`

Marque une note comme **non-trouvée**.

**Liste disponible :** Les boss et notes disponibles sont configurés par les admins du serveur.

---

## 📜 Historique des actions

### Consulter l'historique
Menu fiche tribu → **Historique**

**Ce qui est enregistré :**
- Qui a fait l'action
- Type d'action (création, modification, ajout membre, etc.)
- Détails de l'action
- Date et heure précise

**Navigation :** Utilise les boutons **Page suivante** et **Page précédente** pour parcourir l'historique.

---

## 🔄 Transfert de propriété

### Transférer ta tribu
`/tribu_transférer`

**Utilisation :**
1. Sélectionne ta tribu
2. Mentionne le nouveau propriétaire (@utilisateur)

⚠️ **Attention :** Cette action est irréversible ! Le nouveau référent aura le contrôle total.

---

## 🗑️ Supprimer une tribu

### Supprimer définitivement
`/tribu_supprimer`

**Sécurité :** Tu devras confirmer en tapant exactement le nom de ta tribu.

⚠️ **Attention :** Cette action est **IRRÉVERSIBLE** ! Toutes les données (membres, avant-postes, progression, photos) seront perdues.

---

## 💡 Panneau "Mes Commandes"

Accessible via le menu sous chaque fiche tribu, ce panneau offre un accès rapide à toutes les actions :

**Rangée 1 — Profil**
- ✏️ Changer mon nom in-game
- 📋 Voir ma fiche tribu

**Rangée 2 — Membres**
- 👤 Ajouter membre
- 👥 Supprimer membre

**Rangée 3 — Avant-postes**
- 🏘️ Ajouter avant-poste
- 🏚️ Supprimer avant-poste

**Rangée 4 — Galerie photo**
- 📸 Ajouter photo (ouvre un modal)
- 🗑️ Supprimer photo (affiche un menu de sélection)

**Rangée 5 — Documentation**
- 📖 Voir toutes les commandes
- 📚 Consulter le guide

---

## 🆘 Aide et support

### Commandes d'aide
- `/aide` — Liste complète des 29 commandes disponibles
- `/guide` — Guide de personnalisation avec liens utiles
- `/test_bot` — Vérifier que le bot répond

### Sites utiles
- **Couleurs hex :** https://htmlcolorcodes.com/fr/selecteur-de-couleur/
- **Hébergement d'images :** https://postimages.org

---

## ⚡ Astuces et bonnes pratiques

✅ **Utilise le panneau interactif** `/panneau` pour un accès rapide  
✅ **Nomme bien tes coordonnées** (format: latitude, longitude)  
✅ **Héberge tes images** sur postimages.org pour un lien direct  
✅ **Définis des managers** pour partager la gestion de ta tribu  
✅ **Utilise les boutons** au lieu de taper les commandes (plus rapide !)  
✅ **Consulte l'historique** pour suivre toutes les modifications  

---

## 📝 Résumé des 29 commandes

### Gestion des tribus
- `/créer_tribu` — Créer une nouvelle tribu
- `/fiche_tribu` — Afficher une fiche tribu
- `/modifier_tribu` — Modifier les infos de base
- `/personnaliser_tribu` — Personnaliser couleur, logo, devise
- `/tribu_transférer` — Transférer la propriété
- `/tribu_supprimer` — Supprimer une tribu
- `/quitter_tribu` — Quitter une tribu

### Membres & avant-postes
- `/ajouter_membre_tribu` — Ajouter un membre
- `/supprimer_membre_tribu` — Retirer un membre
- `/mon_nom_ingame` — Modifier ton nom in-game
- `/ajouter_avant_poste` — Ajouter un avant-poste
- `/supprimer_avant_poste` — Retirer un avant-poste

### Galerie photo
- `/ajouter_photo` — Ajouter une photo (max 10)
- `/supprimer_photo` — Retirer une photo

### Progression
- `/boss_validé_tribu` — Valider un boss
- `/boss_non_validé_tribu` — Retirer un boss
- `/note_validé_tribu` — Valider une note
- `/notes_non_validé_tribu` — Retirer une note

### Utilitaires
- `/panneau` — Ouvrir le panneau interactif
- `/aide` — Voir toutes les commandes
- `/guide` — Consulter le guide
- `/test_bot` — Tester le bot

---

**Bon jeu sur Ark: Survival Ascended !** 🦖

*Si tu as des questions, n'hésite pas à contacter les admins ou modérateurs du serveur.*
