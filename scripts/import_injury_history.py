from __future__ import annotations

import argparse
import csv
import hashlib
import sqlite3
from datetime import datetime
from pathlib import Path


SOURCE_NAME = "European Football Injuries (2020-2025)"
SOURCE_URL = "https://www.kaggle.com/datasets/sananmuzaffarov/european-football-injuries-2020-2025"
LICENSE_NAME = "CC BY-SA 4.0"
LICENSE_URL = "https://creativecommons.org/licenses/by-sa/4.0/"


def parse_date(value: str) -> str | None:
    value = value.strip()
    if not value:
        return None
    return datetime.strptime(value, "%m/%d/%Y").date().isoformat()


def parse_int(value: str) -> int | None:
    digits = "".join(character for character in value if character.isdigit())
    return int(digits) if digits else None


def record_key(values: list[object]) -> str:
    payload = "\x1f".join("" if value is None else str(value) for value in values)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def import_history(csv_path: Path, database_path: Path, schema_path: Path) -> tuple[int, int]:
    database_path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(database_path)
    connection.execute("PRAGMA foreign_keys = ON")
    connection.executescript(schema_path.read_text(encoding="utf-8"))
    connection.execute(
        """
        INSERT INTO data_sources(name, source_url, license_name, license_url, retrieved_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(name) DO UPDATE SET
          source_url = excluded.source_url,
          license_name = excluded.license_name,
          license_url = excluded.license_url,
          retrieved_at = excluded.retrieved_at
        """,
        (SOURCE_NAME, SOURCE_URL, LICENSE_NAME, LICENSE_URL, "2026-09-16"),
    )
    source_id = connection.execute(
        "SELECT id FROM data_sources WHERE name = ?", (SOURCE_NAME,)
    ).fetchone()[0]

    inserted = 0
    skipped = 0
    with csv_path.open("r", encoding="utf-8-sig", newline="") as source:
        reader = csv.DictReader(source)
        for row in reader:
            values = [
                row["Season"].strip(),
                row["Injury"].strip(),
                parse_date(row["injury_from_parsed"]),
                parse_date(row["injury_until_parsed"]),
                parse_int(row["Days"]),
                parse_int(row["Games missed"]),
                row["player_name"].strip(),
                parse_int(row["player_age"]),
                row["player_position"].strip(),
                row["club"].strip(),
                row["league"].strip(),
            ]
            cursor = connection.execute(
                """
                INSERT OR IGNORE INTO injury_events(
                  source_id, source_record_key, season, injury_type, date_from,
                  date_until, days_missed, games_missed, player_name, player_age,
                  player_position, club, league
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (source_id, record_key(values), *values),
            )
            if cursor.rowcount:
                inserted += 1
            else:
                skipped += 1

    connection.commit()
    total = connection.execute("SELECT COUNT(*) FROM injury_events").fetchone()[0]
    connection.close()
    return inserted, total


def main() -> None:
    parser = argparse.ArgumentParser(description="Import historical football injuries")
    parser.add_argument("csv_path", type=Path)
    parser.add_argument("--database", type=Path, default=Path("data/injuries.sqlite"))
    parser.add_argument(
        "--schema", type=Path, default=Path("worker/migrations/0001_injury_history.sql")
    )
    args = parser.parse_args()
    inserted, total = import_history(args.csv_path, args.database, args.schema)
    print(f"inserted={inserted} total={total} database={args.database}")


if __name__ == "__main__":
    main()

