from __future__ import annotations

import argparse
import sqlite3
from pathlib import Path


def sql_value(value: object) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, (int, float)):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def main() -> None:
    parser = argparse.ArgumentParser(description="Export the local injury database for D1")
    parser.add_argument("database", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()

    connection = sqlite3.connect(args.database)
    source = connection.execute(
        "SELECT name, source_url, license_name, license_url, retrieved_at FROM data_sources"
    ).fetchone()
    rows = connection.execute(
        """
        SELECT source_record_key, season, injury_type, date_from, date_until,
               days_missed, games_missed, player_name, player_age,
               player_position, club, league
        FROM injury_events ORDER BY id
        """
    )

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", encoding="utf-8", newline="\n") as output:
        output.write("PRAGMA foreign_keys = ON;\n")
        output.write(
            "INSERT OR REPLACE INTO data_sources(id,name,source_url,license_name,license_url,retrieved_at) VALUES (1,"
            + ",".join(sql_value(value) for value in source)
            + ");\n"
        )
        for row in rows:
            output.write(
                "INSERT OR IGNORE INTO injury_events(source_id,source_record_key,season,injury_type,date_from,date_until,days_missed,games_missed,player_name,player_age,player_position,club,league) VALUES (1,"
                + ",".join(sql_value(value) for value in row)
                + ");\n"
            )
    connection.close()
    print(f"output={args.output}")


if __name__ == "__main__":
    main()

