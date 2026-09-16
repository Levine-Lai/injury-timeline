CREATE TABLE IF NOT EXISTS data_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  source_url TEXT NOT NULL,
  license_name TEXT NOT NULL,
  license_url TEXT NOT NULL,
  retrieved_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS injury_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER NOT NULL,
  source_record_key TEXT NOT NULL UNIQUE,
  season TEXT NOT NULL,
  injury_type TEXT NOT NULL,
  date_from TEXT,
  date_until TEXT,
  days_missed INTEGER,
  games_missed INTEGER,
  player_name TEXT NOT NULL,
  player_age INTEGER,
  player_position TEXT,
  club TEXT,
  league TEXT,
  FOREIGN KEY (source_id) REFERENCES data_sources(id)
);

CREATE INDEX IF NOT EXISTS idx_injury_events_player ON injury_events(player_name);
CREATE INDEX IF NOT EXISTS idx_injury_events_injury ON injury_events(injury_type);
CREATE INDEX IF NOT EXISTS idx_injury_events_league ON injury_events(league);
CREATE INDEX IF NOT EXISTS idx_injury_events_dates ON injury_events(date_from, date_until);
CREATE INDEX IF NOT EXISTS idx_injury_events_lookup
  ON injury_events(injury_type, player_position, player_age, days_missed);

CREATE VIEW IF NOT EXISTS injury_reference_stats AS
SELECT
  injury_type,
  player_position,
  COUNT(*) AS sample_size,
  ROUND(AVG(days_missed), 1) AS average_days_missed,
  MIN(days_missed) AS minimum_days_missed,
  MAX(days_missed) AS maximum_days_missed,
  ROUND(AVG(games_missed), 1) AS average_games_missed
FROM injury_events
WHERE days_missed IS NOT NULL AND days_missed >= 0
GROUP BY injury_type, player_position;

