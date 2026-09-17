CREATE TABLE IF NOT EXISTS players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  canonical_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  birth_date TEXT,
  current_club TEXT,
  current_position TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_players_normalized_name
  ON players(normalized_name);

CREATE TABLE IF NOT EXISTS player_aliases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  alias TEXT NOT NULL,
  normalized_alias TEXT NOT NULL,
  source TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 1.0,
  is_verified INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (player_id) REFERENCES players(id),
  UNIQUE(player_id, normalized_alias, source)
);

CREATE INDEX IF NOT EXISTS idx_player_aliases_normalized_alias
  ON player_aliases(normalized_alias);

CREATE TABLE IF NOT EXISTS player_source_ids (
  player_id INTEGER NOT NULL,
  source TEXT NOT NULL,
  external_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (player_id) REFERENCES players(id),
  PRIMARY KEY (source, external_id)
);

CREATE INDEX IF NOT EXISTS idx_player_source_ids_player
  ON player_source_ids(player_id);

ALTER TABLE injury_events ADD COLUMN player_id INTEGER REFERENCES players(id);

CREATE INDEX IF NOT EXISTS idx_injury_events_player_id
  ON injury_events(player_id, date_from DESC);
