# Arki Family Discord Bot

## Overview
The "Arki Family" Discord bot is designed for the Ark: Survival Ascended community, providing a comprehensive and interactive tribe management system. It enables users to create, modify, and manage detailed tribe profiles using slash commands, modals, and buttons. Key functionalities include member management, progression tracking (bosses/notes), outpost management, and an action history. The bot aims to enhance organization and communication within the Arki Family community by offering an intuitive interface and robust management tools.

## User Preferences
- Bot en français
- Système de gestion de communauté pour Ark: Survival Ascended
- Interface intuitive avec modals et boutons
- Tracking complet des actions (historique)

## System Architecture
The bot utilizes `discord.py` and is built on an architecture leveraging modern Discord interactions (slash commands, buttons, modals) for a rich user experience.

**Command Optimization (October 2025):**
- **Streamlined Commands:** Reduced from 31 to 14 slash commands (-55%) by consolidating redundant features into interactive panels
- **Phase 1 (13 commands removed):** `/modifier_tribu`, `/personnaliser_tribu`, `/ajouter_membre_tribu`, `/retirer_membre_tribu`, `/ajouter_avant_poste`, `/supprimer_avant_poste`, `/supprimer_photo`, `/voir_historique`, `/modifier_base`, `/modifier_description`, `/modifier_couleur`, `/modifier_logo`, `/modifier_recrutement`
- **Phase 2 (9 additional commands removed):** `/ajout_map`, `/retirer_map`, `/ajout_boss`, `/retirer_boss`, `/ajout_note`, `/retirer_note`, `/couleur_panneau`, `/texte_panneau`, `/salon_fiche_tribu`
- **Functionality Preserved:** All removed command features remain accessible through interactive buttons, modals, and menus in panels
- **Final Command Count:** 14 active slash commands (3 admin-only: `/test_bot`, `/fiche_tribu`, `/changer_bannière_panneau`)

**UI/UX Decisions:**
- **Interactive Panel (`/panneau`):** A centralized entry point with buttons for main actions (Create, Modify, Customize, Guide). Admin panels self-delete to prevent clutter. Includes customizable banner, color, and text.
- **Admin Configuration Panel (`/parametres`):** Comprehensive admin-only panel with 8 buttons organized in 3 rows:
  - **Row 1 (Appearance):** Banner (with file upload support via link), Color (with color picker link), Text, Tribe Card Channel
  - **Row 2 (Data Management):** Maps (add/remove), Boss (add/remove), Notes (add/remove)
  - **Row 3 (Premium Features):** Maps Premium (add/remove premium DLC maps)
  - Each button opens a sub-panel with intuitive controls (modals for input, dropdowns for selection)
- **Customizable Main Panel:** Admins personalize the panel appearance entirely through `/parametres` (banner, color, text) with visual color picker integration
- **Configurable Tribe Card Channel:** Admins define a dedicated channel for all tribe cards via dropdown in `/parametres`
- **File Upload Support:** `/changer_bannière_panneau` command allows direct image upload from phone/PC for banner customization
- **Auto-Refresh System:** Tribe cards automatically update after any modification using `rafraichir_fiche_tribu()` function
- **Smart Deletion:** `/ma_tribu` command automatically deletes old tribe card in the same channel before displaying new one to prevent duplicates
- **Detailed Tribe Profiles:** Information displayed in a structured order (Header, Description, Motto, Members, Main Base, Outposts, Objective, Recruitment, Boss/Notes Progression, Base Photo) with **BOLD CAPITALIZED** titles for readability.
- **Dropdown Menu under Tribe Profile:** Menu with options for "Mes commandes" (member panel), "Personnaliser", "Leave Tribe", "History" (with pagination), and "Staff" (for admins/moderators).
- **"Mes commandes" Panel:** All buttons in this panel replicate their corresponding slash command behavior (e.g., "Ajouter avant-poste" uses map dropdown selection like `/ajouter_avant_poste`).
- **Modals:** Used for complex data input, simplifying creation and modification processes.
- **Dropdown Menus:** For map and tribe selection with autocompletion, ensuring consistency between slash commands and button interactions.

**Technical Implementations & Feature Specifications:**
- **Tribe Management:** Creation, modification (name, color, logo, base map/coords, description, motto, recruitment, objective), ownership transfer, and deletion.
- **Member Management:** Adding (with in-game name and manager authorization), removal, and ability to leave a tribe.
- **Outpost Management:** Addition (with auto-generated name) and deletion.
- **Premium Maps System (November 2025):** Dedicated management for premium DLC maps (Svartalfheim, Némésis). Admins can add/remove premium maps via `/parametres`. Tribe managers can add/remove premium bases via "Mes commandes" panel. Premium bases displayed separately on tribe cards between main base and standard outposts.
- **Progression System:** Tracking of completed bosses and notes with dual states (validated/not validated).
- **Interactive Photo Gallery:** Up to 10 photos per tribe with ◀️ ▶️ navigation directly on the profile. Add/remove via `/ajouter_photo` and `/supprimer_photo`, or directly from the "Mes commandes" panel with interactive modal and select menu. Position indicator "📸 Photo X/Y" in the footer.
- **Action History:** Detailed logging of modifications with user, action, details, and timestamp, viewable via pagination.
- **Permission System:**
    - **Tribe Referent:** Creator, full control.
    - **Managers:** Authorized members to modify.
    - **Server Admins:** Rights over all tribes.
    - **Moderators:** Specific role with rights similar to admins.
- **Customization:** Supports hex colors, logo/photo URLs, free-form descriptions, and mottos.
- **Default Data:** Pre-defined lists of bosses, notes, and maps, extensible via admin commands.

**System Design Choices:**
- **SQLite Database (`tribus.db`):** Used for persisting all bot data (tribes, members, outposts, history, bosses, notes, maps, tribe photos, premium maps, premium bases).
- **`photos_tribu` Table:** Stores gallery photos with `id`, `tribu_id`, `url`, `ordre` columns to manage display order and limit to 10 photos per tribe.
- **`maps_premium` Table:** Stores premium DLC maps with `id`, `guild_id`, `nom`, `created_at` columns. Default maps: Svartalfheim, Némésis.
- **`bases_premium` Table:** Stores premium bases with `id`, `tribu_id`, `user_id`, `nom`, `map`, `coords`, `created_at` columns following the same pattern as `avant_postes`.
- **`config` Table:** Stores bot configuration (panel banner, color, text, tribe card channel) with key-value structure per guild
- **Profile Tracking:** `message_id` and `channel_id` columns in the `tribus` table allow dynamic updating of displayed profiles and deletion of old ones.
- **Smart Channel Routing:** When a tribe card channel is configured, all tribe cards display there instead of the current channel
- **Field Flexibility:** Removal of character limitations for most text fields.
- **Persistent Navigation:** Photo gallery buttons use custom_id with `tribu_id` to remain functional after bot restarts via the global `on_interaction` listener.

**High-Load Optimizations (October 2025):**
- **Database Concurrency:** SQLite configured with WAL mode (`PRAGMA journal_mode=WAL`) for improved concurrent reads/writes, `timeout=30.0s`, and `busy_timeout=30000ms` to prevent "database is locked" errors
- **Single Initialization:** `db_init()` called only once at bot startup (in `on_ready()`) instead of 26 times per interaction, eliminating exclusive lock contention from repeated CREATE INDEX statements
- **8 Performance Indexes:** Added indexes on frequently-queried columns (tribus.guild_id, tribus.message_id, membres.tribu_id, membres.user_id, avant_postes.tribu_id, historique.tribu_id, photos_tribu.tribu_id, config.guild_id) to accelerate database operations
- **Interaction Timeout Prevention:** All heavy modals (ModalModifierTribu, ModalPersonnaliserTribu, ModalDetaillerTribu) use `await inter.response.defer(ephemeral=True)` at the start to prevent "application not responding" errors during database operations
- **Extended View Timeouts:** All Views increased from 180s to 300s (5 minutes) to accommodate user interaction delays
- **Auto-Refresh/Create System:** Unified `afficher_ou_rafraichir_fiche()` function automatically creates tribe cards if they don't exist or refreshes existing ones, with robust error handling for deleted messages/channels
- **Stress-Tested:** Designed and validated for 50+ simultaneous users creating/modifying tribes without errors or interaction failures

**Error Handling & Stability (November 2025):**
- **Discord Character Limit Enforcement:** All text input fields (description, motto, objective, recruitment) enforce Discord's 1024-character limit via `max_length=1024` parameter to prevent embed errors
- **Comprehensive Error Handling:** All functions calling `embed_tribu()` wrapped in try/except blocks to prevent bot crashes when fields exceed limits
- **Graceful Degradation:** When `embed_tribu()` fails, bot displays user-friendly error message with solution (`/corriger_champ`) instead of crashing
- **Protected Functions:** Critical functions `afficher_ou_rafraichir_fiche()` and `rafraichir_fiche_tribu()` secured with error handling to prevent "bot thinking indefinitely" state
- **Admin Correction Tool:** `/corriger_champ` command allows admins to manually fix tribes with problematic field content
- **Logging System:** Detailed error logging (tribe ID, field name, error message) in console for debugging without exposing errors to users

## External Dependencies
- **Discord API:** The bot interacts directly with the Discord API via the `discord.py` library.
- **SQLite:** Embedded database for data persistence.