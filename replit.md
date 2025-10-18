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

**UI/UX Decisions:**
- **Interactive Panel (`/panneau`):** A centralized entry point with buttons for main actions (Create, Modify, Customize, Guide). Admin panels self-delete to prevent clutter. Includes a visual banner.
- **Detailed Tribe Profiles:** Information displayed in a structured order (Header, Description, Motto, Members, Main Base, Outposts, Objective, Recruitment, Boss/Notes Progression, Base Photo) with **BOLD CAPITALIZED** titles for readability.
- **Dropdown Menu under Tribe Profile:** Menu with options for "Leave Tribe," "History" (with pagination), and "Staff" (for admins/moderators).
- **Modals:** Used for complex data input, simplifying creation and modification processes.
- **Dropdown Menus:** For map and tribe selection with autocompletion.

**Technical Implementations & Feature Specifications:**
- **Tribe Management:** Creation, modification (name, color, logo, base map/coords, description, motto, recruitment, objective), ownership transfer, and deletion.
- **Member Management:** Adding (with in-game name and manager authorization), removal, and ability to leave a tribe.
- **Outpost Management:** Addition (with auto-generated name) and deletion.
- **Progression System:** Tracking of completed bosses and notes with dual states (validated/not validated).
- **Interactive Photo Gallery:** Up to 10 photos per tribe with ◀️ ▶️ navigation directly on the profile. Add/remove via `/ajouter_photo` and `/supprimer_photo`. Position indicator "📸 Photo X/Y" in the footer.
- **Action History:** Detailed logging of modifications with user, action, details, and timestamp, viewable via pagination.
- **Permission System:**
    - **Tribe Referent:** Creator, full control.
    - **Managers:** Authorized members to modify.
    - **Server Admins:** Rights over all tribes.
    - **Moderators:** Specific role with rights similar to admins.
- **Customization:** Supports hex colors, logo/photo URLs, free-form descriptions, and mottos.
- **Default Data:** Pre-defined lists of bosses, notes, and maps, extensible via admin commands.

**System Design Choices:**
- **SQLite Database (`tribus.db`):** Used for persisting all bot data (tribes, members, outposts, history, bosses, notes, maps, tribe photos).
- **`photos_tribu` Table:** Stores gallery photos with `id`, `tribu_id`, `url`, `ordre` columns to manage display order and limit to 10 photos per tribe.
- **Profile Tracking:** `message_id` and `channel_id` columns in the `tribus` table allow dynamic updating of displayed profiles and deletion of old ones.
- **Field Flexibility:** Removal of character limitations for most text fields.
- **Persistent Navigation:** Photo gallery buttons use custom_id with `tribu_id` to remain functional after bot restarts via the global `on_interaction` listener.

## External Dependencies
- **Discord API:** The bot interacts directly with the Discord API via the `discord.py` library.
- **SQLite:** Embedded database for data persistence.