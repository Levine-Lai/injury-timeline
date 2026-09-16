# Historical injury data attribution

The historical injury database is built from **European Football Injuries
(2020–2025)** by Sanan Muzaffarov.

- Source: https://www.kaggle.com/datasets/sananmuzaffarov/european-football-injuries-2020-2025
- Licence: Creative Commons Attribution-ShareAlike 4.0 International
- Licence text: https://creativecommons.org/licenses/by-sa/4.0/
- Retrieved: 2026-09-16

The import process normalizes dates and numeric fields, adds stable deduplication
keys, and stores the resulting records in the `injury_events` table. The source
data describes publicly reported absences and must not be treated as clinical
medical records.

