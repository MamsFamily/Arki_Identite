# Lenexus et ArkiFamily : première liaison en lecture seule

Le site est importé depuis l'archive fournie par son propriétaire dans une branche
de `MamsFamily/Arki_Identite`, dans le dossier isolé `lenexus/`. Le bot Python, ses commandes de démarrage et les
fichiers de données déjà présents dans le dépôt ne sont pas remplacés.
Aucune base SQLite réelle ni aucun secret n'est ajouté depuis l'archive.
Le sandbox de maquettes n'est pas importé.

## Changements fonctionnels

- `/mes-informations` : inventaire du compte Discord connecté, commandes,
  tickets shop/spawn/reclaim et mouvements d'inventaire.
- `/catalogue-arkifamily` : catalogue directement lu dans ArkiFamily,
  avec prix de base et variantes/options ; ce n'est pas un devis de paiement.
- `/administration/commandes` : suivi paginé pour le staff autorisé des deux côtés.
- Les pages sont liées depuis le menu, Mon espace et l'administration.
- L'ancien shop alimenté depuis les messages Discord reste disponible :
  aucun repli automatique ne présente ses prix comme des données de la nouvelle API.
- Les fiches tribu continuent d'être gérées par les fonctions actuelles de Lenexus.

## Configuration et déploiement séparés

Examiner les deux branches et leur documentation avant toute fusion.
Le bot Python reste démarré avec ses commandes actuelles. Le site et son API
nécessitent leurs services séparés, pnpm et Node.js >= 22.16 (SQLite natif).
Les commandes du workspace JavaScript s'exécutent depuis `lenexus/`.
Le service Railway du bot ne doit pas utiliser ce dossier comme racine.
Pour le site/API hébergé séparément, la racine du workspace est `lenexus/`.
Le lancement de développement cherche un runtime Node compatible sans changer
celui du bot. Une base SQLite manquante bloque les fonctions concernées et
désactive les synchronisations de fond ; aucune base fictive n'est créée.
Ne pas utiliser le build du site comme commande de démarrage du bot Railway.
Les fichiers `.replit`, `Procfile`, `main.py` et les données du bot existant
ne sont pas remplacés par cet import.

Dans le backend Lenexus uniquement :

- `ARKI_BRIDGE_URL` : origine HTTPS **publiée** du service ArkiFamily
  (sans chemin ni paramètre, jamais son URL PostgreSQL).
- `ARKI_BRIDGE_TOKEN` : clé de liaison forte conservée dans les Secrets.
- `DISCORD_GUILD_ID` : même serveur Discord que celui configuré dans ArkiFamily.

Dans le service ArkiFamily appelé :

- `NEXUS_BRIDGE_TOKEN` : même clé, au moins 32 caractères.
- `NEXUS_BRIDGE_ENABLED=true` : activation explicite.
- Sa connexion PostgreSQL et son propre token Discord doivent déjà être configurés.

Ne jamais mettre ces valeurs dans des variables `VITE_`, des messages ou des fichiers
Git. Les Secrets Replit ne sont pas automatiquement transférés sur Railway.
Les tokens Discord et les sessions des deux produits restent indépendants.
La liaison reste fermée si sa configuration est absente.

Un joueur ne peut demander que ses informations ; le backend utilise l'identité
de sa session, pas un ID transmis dans l'URL. Les autorisations staff sont
vérifiées sur Lenexus puis sur ArkiFamily. L'aperçu propriétaire-en-joueur
masque les contrôles et bloque la route staff.

Aucune route d'écriture, aucun débit, aucun paiement et aucune création de ticket
n'est ajouté. Un ticket fermé peut pointer vers un salon Discord supprimé.
Une commande `paid` signifie encaissée, pas une preuve supplémentaire de livraison.

La compilation du frontend/API et les tests doivent être exécutés avant
activation. Les tests utilisent des comptes fictifs et une base SQLite de test,
et n'héritent pas de la connexion PostgreSQL réelle.

## Limite constatée lors de l'import

Le frontend passe son contrôle de type et les deux services compilent.
Le contrôle de type global de l'API signale encore 17 erreurs dans des fichiers
inchangés de l'archive (types des entrées cartes, dinos, guides et gestion du site).
Les nouvelles routes de liaison n'ont plus d'erreur de type.
Ces erreurs existantes sont à corriger avant d'exiger un contrôle global sans
erreur ; elles ne sont pas masquées par la nouvelle liaison.
