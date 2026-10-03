"""Retirer les anciens composants Discord, sans modifier les données SQLite.

Utilise les files de requêtes et limites partagées de discord.py. L'historique
est lu par pages, plutôt que par une requête distincte pour chaque fiche.
"""
import argparse
import asyncio
import json
import os
from pathlib import Path
import sqlite3
import sys

import discord
from discord.http import HTTPClient, Route

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from tribe_retirement import RETIRED_COMPONENT_PREFIXES, TRIBE_SITE_URL


def replacement_components(message, author_id, url):
    if message["author"]["id"] != author_id:
        return None
    components = message.get("components", [])
    retired = any(
        isinstance(item.get("custom_id"), str)
        and item["custom_id"].startswith(RETIRED_COMPONENT_PREFIXES)
        for row in components for item in row.get("components", [])
    )
    if not retired:
        return None
    remaining = [
        {**row, "components": [
            item for item in row.get("components", [])
            if not (isinstance(item.get("custom_id"), str)
                    and item["custom_id"].startswith(RETIRED_COMPONENT_PREFIXES))
        ]}
        for row in components
    ]
    remaining = [row for row in remaining if row["components"]]
    if len(remaining) >= 5:
        raise RuntimeError("Refusing to remove unrelated buttons to make room for the site link.")
    remaining.append({"type": 1, "components": [{
        "type": 2, "style": 5, "label": "Ouvrir le site Arki Family", "url": url,
    }]})
    return remaining


async def run(snapshot):
    references, active_tribes = {}, set()
    for filename in (snapshot, "tribus.db"):
        with sqlite3.connect(f"file:{Path(filename).resolve()}?mode=ro", uri=True) as db:
            if filename == "tribus.db":
                active_tribes.update(row[0] for row in db.execute("SELECT id FROM tribus"))
            for tribe_id, channel_id, message_id in db.execute(
                "SELECT id,CAST(channel_id AS TEXT),CAST(message_id AS TEXT) FROM tribus "
                "WHERE channel_id IS NOT NULL AND message_id IS NOT NULL"
            ):
                if channel_id.isdigit() and message_id.isdigit() and int(message_id) > 0:
                    references.setdefault(channel_id, {})[message_id] = tribe_id
    http = HTTPClient(asyncio.get_running_loop(), max_ratelimit_timeout=60)
    summary = {
        "referencedMessages": sum(len(messages) for messages in references.values()),
        "referencedFound": 0, "referencedMissing": 0, "updated": 0,
        "alreadyInactive": 0, "publicPanelsUpdated": 0,
        "inaccessibleChannels": 0, "unverified": 0,
    }
    try:
        token = os.getenv("DISCORD_BOT_TOKEN") or os.environ["DISCORD_TOKEN"]
        profile = await http.static_login(token)
        print(json.dumps({"channels": len(references), **summary}), flush=True)
        for channel_id, messages in references.items():
            found, before, complete = set(), None, False
            oldest = min(int(message_id) for message_id in messages)
            for page in range(10):
                params = {"limit": 100}
                if before:
                    params["before"] = before
                try:
                    history = await http.request(
                        Route("GET", "/channels/{channel_id}/messages", channel_id=channel_id),
                        params=params,
                    )
                except discord.Forbidden:
                    summary["inaccessibleChannels"] += 1
                    break
                except discord.NotFound:
                    complete = True
                    break
                for message in history:
                    message_id = message["id"]
                    if message_id in messages:
                        found.add(message_id)
                    custom_ids = [
                        item.get("custom_id", "") for row in message.get("components", [])
                        for item in row.get("components", [])
                    ]
                    panel = any(custom_id.startswith("panneau:") for custom_id in custom_ids)
                    tribe_id = messages.get(message_id)
                    if tribe_id is None:
                        for custom_id in custom_ids:
                            if custom_id.startswith(("menu_fiche:", "galerie_prev:", "galerie_next:")):
                                try:
                                    tribe_id = int(custom_id.split(":")[1])
                                except (ValueError, IndexError):
                                    pass
                    url = (
                        f"{TRIBE_SITE_URL}/mon-espace" if panel else
                        f"{TRIBE_SITE_URL}/tribus/{tribe_id}" if tribe_id in active_tribes else
                        f"{TRIBE_SITE_URL}/tribus"
                    )
                    components = replacement_components(message, profile["id"], url)
                    if components is None:
                        if message_id in messages:
                            summary["alreadyInactive"] += 1
                        continue
                    await http.request(
                        Route("PATCH", "/channels/{channel_id}/messages/{message_id}",
                              channel_id=channel_id, message_id=message_id),
                        json={"components": components},
                    )
                    summary["updated"] += 1
                    summary["publicPanelsUpdated"] += int(panel)
                print(json.dumps({"channelPagesChecked": page + 1, **summary}), flush=True)
                if not history or len(history) < 100:
                    complete = True
                    break
                before = history[-1]["id"]
                # Cover at least the latest 200 messages for untracked public panels.
                if page >= 1 and int(before) <= oldest:
                    complete = True
                    break
            summary["referencedFound"] += len(found)
            if complete:
                summary["referencedMissing"] += len(messages) - len(found)
            else:
                summary["unverified"] += len(messages) - len(found)
        print(json.dumps(summary), flush=True)
        if summary["inaccessibleChannels"] or summary["unverified"]:
            raise RuntimeError("Some messages remain unverified; the summary records the incomplete scope.")
    finally:
        await http.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--snapshot", required=True)
    asyncio.run(run(parser.parse_args().snapshot))