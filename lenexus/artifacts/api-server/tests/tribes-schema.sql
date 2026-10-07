-- Empty test schema. No production database or player records are read.
CREATE TABLE tribus (
  id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id INTEGER NOT NULL, nom TEXT NOT NULL,
  description TEXT DEFAULT '', couleur INTEGER DEFAULT 0x2F3136, logo_url TEXT DEFAULT '',
  base TEXT DEFAULT '', map_base TEXT DEFAULT '', coords_base TEXT DEFAULT '', tags TEXT DEFAULT '',
  proprietaire_id INTEGER NOT NULL, created_at TEXT NOT NULL, message_id INTEGER DEFAULT 0,
  channel_id INTEGER DEFAULT 0, devise TEXT DEFAULT '', ouvert_recrutement INTEGER DEFAULT 0,
  photo_base TEXT DEFAULT '', objectif TEXT DEFAULT '', progression_boss TEXT DEFAULT '',
  progression_notes TEXT DEFAULT '', progression_boss_non_valides TEXT DEFAULT '',
  progression_notes_non_valides TEXT DEFAULT ''
);
CREATE TABLE membres (
  tribu_id INTEGER NOT NULL, user_id INTEGER NOT NULL, role TEXT DEFAULT '',
  manager INTEGER DEFAULT 0, nom_in_game TEXT DEFAULT '', PRIMARY KEY (tribu_id,user_id),
  FOREIGN KEY (tribu_id) REFERENCES tribus(id) ON DELETE CASCADE
);
CREATE TABLE avant_postes (
  id INTEGER PRIMARY KEY AUTOINCREMENT, tribu_id INTEGER NOT NULL, user_id INTEGER NOT NULL,
  nom TEXT NOT NULL, map TEXT DEFAULT '', coords TEXT DEFAULT '', created_at TEXT NOT NULL,
  FOREIGN KEY (tribu_id) REFERENCES tribus(id) ON DELETE CASCADE
);
CREATE TABLE maps (
  id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id INTEGER NOT NULL, nom TEXT NOT NULL,
  created_at TEXT NOT NULL, UNIQUE(guild_id,nom)
);
CREATE TABLE boss (
  id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id INTEGER NOT NULL, nom TEXT NOT NULL,
  created_at TEXT NOT NULL, UNIQUE(guild_id,nom)
);
CREATE TABLE notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id INTEGER NOT NULL, nom TEXT NOT NULL,
  created_at TEXT NOT NULL, UNIQUE(guild_id,nom)
);
CREATE TABLE historique (
  id INTEGER PRIMARY KEY AUTOINCREMENT, tribu_id INTEGER NOT NULL, user_id INTEGER NOT NULL,
  action TEXT NOT NULL, details TEXT DEFAULT '', created_at TEXT NOT NULL,
  FOREIGN KEY (tribu_id) REFERENCES tribus(id) ON DELETE CASCADE
);
CREATE TABLE config (
  guild_id INTEGER NOT NULL, cle TEXT NOT NULL, valeur TEXT DEFAULT '', PRIMARY KEY(guild_id,cle)
);
CREATE TABLE photos_tribu (
  id INTEGER PRIMARY KEY AUTOINCREMENT, tribu_id INTEGER NOT NULL, url TEXT NOT NULL,
  ordre INTEGER DEFAULT 0, created_at TEXT NOT NULL,
  FOREIGN KEY (tribu_id) REFERENCES tribus(id) ON DELETE CASCADE
);
CREATE TABLE maps_premium (
  id INTEGER PRIMARY KEY AUTOINCREMENT, guild_id INTEGER NOT NULL, nom TEXT NOT NULL,
  created_at TEXT NOT NULL, UNIQUE(guild_id,nom)
);
CREATE TABLE bases_premium (
  id INTEGER PRIMARY KEY AUTOINCREMENT, tribu_id INTEGER NOT NULL, user_id INTEGER NOT NULL,
  nom TEXT NOT NULL, map TEXT DEFAULT '', coords TEXT DEFAULT '', created_at TEXT NOT NULL,
  FOREIGN KEY (tribu_id) REFERENCES tribus(id) ON DELETE CASCADE
);
CREATE TABLE site_tribe_media (
  tribu_id INTEGER NOT NULL, kind TEXT NOT NULL, source_url TEXT NOT NULL,
  object_path TEXT NOT NULL, digest TEXT NOT NULL, content_type TEXT NOT NULL,
  PRIMARY KEY(tribu_id,kind,source_url)
);
