"""Tests hors ligne : aucun login Discord, appel réseau ou changement de données."""
from pathlib import Path
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import main
from tribe_retirement import (
    RETIRED_TRIBE_COMMANDS, redirect_retired_component,
    remove_guild_tribe_commands,
)
from scripts.retire_discord_tribe_ui import replacement_components


class RetirementTests(unittest.IsolatedAsyncioTestCase):
    def test_cleanup_preserves_messages_and_unrelated_buttons(self):
        message = {"author": {"id": "bot"}, "content": "Original", "embeds": [{"title": "Tribu"}],
                   "components": [{"type": 1, "components": [
                       {"type": 2, "custom_id": "galerie_next:1"},
                       {"type": 2, "custom_id": "other:action"},
                   ]}]}
        components = replacement_components(message, "bot", "https://example.com/tribus/1")
        self.assertEqual(components[0]["components"][0]["custom_id"], "other:action")
        self.assertEqual(components[-1]["components"][0]["style"], 5)
        self.assertEqual(message["content"], "Original")
        self.assertEqual(message["embeds"], [{"title": "Tribu"}])
        self.assertIsNone(replacement_components(message, "another-bot", "https://example.com"))
        self.assertIsNone(replacement_components(
            {"author": {"id": "bot"}, "components": components}, "bot", "https://example.com"))

    def test_registration_preserves_unrelated_commands(self):
        self.assertEqual(
            {command.name for command in main.tree.get_commands()},
            {"aide", "test_bot", "save_test", "show_test"},
        )
        self.assertFalse(RETIRED_TRIBE_COMMANDS & {c.name for c in main.tree.get_commands()})

    async def test_old_components_never_invoke_tribe_callbacks(self):
        for custom_id in ("panneau:creer", "menu_fiche:1", "galerie_next:1", "galerie_prev:1"):
            response = SimpleNamespace(is_done=lambda: False, send_message=AsyncMock())
            inter = SimpleNamespace(
                type=main.discord.InteractionType.component,
                data={"custom_id": custom_id}, response=response,
            )
            with patch.object(main, "MenuFicheTribu", side_effect=AssertionError("Legacy callback")):
                await main.on_interaction(inter)
            response.send_message.assert_awaited_once()
            self.assertTrue(response.send_message.call_args.kwargs["ephemeral"])
            self.assertIn("/mon-espace", response.send_message.call_args.args[0])

    async def test_other_components_and_already_handled_interactions_are_untouched(self):
        response = SimpleNamespace(is_done=lambda: False, send_message=AsyncMock())
        self.assertFalse(await redirect_retired_component(SimpleNamespace(data={"custom_id": "other:action"}, response=response)))
        response.send_message.assert_not_awaited()
        response.is_done = lambda: True
        self.assertTrue(await redirect_retired_component(SimpleNamespace(data={"custom_id": "menu_fiche:1"}, response=response)))
        response.send_message.assert_not_awaited()

    async def test_guild_cleanup_deletes_only_tribe_commands(self):
        retired = SimpleNamespace(name="créer_tribu", delete=AsyncMock())
        other = SimpleNamespace(name="other_service", delete=AsyncMock())
        tree = SimpleNamespace(fetch_commands=AsyncMock(return_value=[retired, other]))
        self.assertEqual(await remove_guild_tribe_commands(tree, [SimpleNamespace(id=1)]), 1)
        retired.delete.assert_awaited_once()
        other.delete.assert_not_awaited()

    async def test_ready_does_not_initialize_tribes_or_install_persistent_views(self):
        with patch.object(main, "db_init", side_effect=AssertionError("Tribe DB write")), \
             patch.object(main, "identite_db_init"), \
             patch.object(main.bot._connection, "user", SimpleNamespace(id=123)), \
             patch.object(main.bot, "add_view", side_effect=AssertionError("Legacy panel")), \
             patch.object(main.tree, "sync", new=AsyncMock(return_value=[])), \
             patch.object(main, "remove_guild_tribe_commands", new=AsyncMock(return_value=0)):
            await main.on_ready()


if __name__ == "__main__":
    unittest.main()