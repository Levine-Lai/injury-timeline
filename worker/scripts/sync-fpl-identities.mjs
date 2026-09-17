import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const database = 'injury-history';
const wrangler = join(process.cwd(), 'node_modules', 'wrangler', 'bin', 'wrangler.js');

function normalize(value = '') {
  return String(value).trim().replace(/\s+/g, ' ').toLowerCase();
}

function sql(value = '') {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function d1Json(command) {
  const output = execFileSync(process.execPath, [
    wrangler, 'd1', 'execute', database, '--remote', '--command', command, '--json',
  ], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  return JSON.parse(output)[0]?.results || [];
}

const historyPlayers = d1Json(`
  SELECT p.id, p.canonical_name, p.normalized_name, p.current_club, p.current_position
  FROM players p
`);
const sourceRows = d1Json(`
  SELECT external_id, player_id FROM player_source_ids WHERE source = 'fpl'
`);
const sourceIds = new Map(sourceRows.map(row => [String(row.external_id), Number(row.player_id)]));
const byId = new Map(historyPlayers.map(row => [Number(row.id), row]));
const byName = new Map();
for (const row of historyPlayers) {
  const key = normalize(row.normalized_name || row.canonical_name);
  const rows = byName.get(key) || [];
  rows.push(row);
  byName.set(key, rows);
}

const response = await fetch('https://fantasy.premierleague.com/api/bootstrap-static/', {
  headers: { Accept: 'application/json', 'User-Agent': 'InjuryTimeline/1.0' },
});
if (!response.ok) throw new Error(`FPL bootstrap failed: ${response.status}`);
const payload = await response.json();
const teams = new Map(payload.teams.map(team => [team.id, team.name]));
const positions = new Map(payload.element_types.map(position => [position.id, position.singular_name]));

const nicknames = new Map(Object.entries({
  alexander: 'alex', benjamin: 'ben', christopher: 'chris', daniel: 'dan',
  edward: 'eddie', frederick: 'fred', jacob: 'jake', joseph: 'joe',
  jonathan: 'jon', matthew: 'matt', michael: 'mike', nathaniel: 'nathan',
  nicholas: 'nick', robert: 'rob', samuel: 'sam', theodore: 'theo',
  thomas: 'tom', timothy: 'tim', william: 'will',
}));

function uniqueNameMatch(name) {
  const rows = byName.get(normalize(name)) || [];
  return rows.length === 1 ? rows[0] : null;
}

function candidateNames(player) {
  const full = [player.first_name, player.second_name].filter(Boolean).join(' ');
  const parts = normalize(full).split(' ').filter(Boolean);
  const candidates = [full];
  if (parts.length > 2) candidates.push(`${parts[0]} ${parts.at(-1)}`);
  const nickname = nicknames.get(parts[0]);
  if (nickname && parts.length > 1) candidates.push(`${nickname} ${parts.at(-1)}`);
  return [...new Set(candidates.map(normalize))];
}

const statements = ['PRAGMA foreign_keys = ON;'];
let existing = 0;
let exact = 0;
let alias = 0;
let created = 0;

for (const player of payload.elements) {
  const externalId = String(player.id);
  const fullName = [player.first_name, player.second_name].filter(Boolean).join(' ');
  const normalized = normalize(fullName);
  const club = teams.get(player.team) || '';
  const position = positions.get(player.element_type) || '';
  let match = sourceIds.has(externalId) ? byId.get(sourceIds.get(externalId)) : null;
  let confidence = 1;
  if (match) {
    existing += 1;
  } else {
    const candidates = candidateNames(player);
    for (let index = 0; index < candidates.length && !match; index += 1) {
      match = uniqueNameMatch(candidates[index]);
      if (match) {
        confidence = index === 0 ? 1 : 0.95;
        if (index === 0) exact += 1;
        else alias += 1;
      }
    }
  }

  if (!match) {
    created += 1;
    statements.push(`INSERT INTO players(canonical_name, normalized_name, current_club, current_position) VALUES (${sql(fullName)}, ${sql(normalized)}, ${sql(club)}, ${sql(position)});`);
    statements.push(`INSERT OR IGNORE INTO player_aliases(player_id, alias, normalized_alias, source, confidence, is_verified) SELECT id, ${sql(fullName)}, ${sql(normalized)}, 'fpl', 1.0, 1 FROM players WHERE normalized_name = ${sql(normalized)} ORDER BY id DESC LIMIT 1;`);
    statements.push(`INSERT OR IGNORE INTO player_source_ids(player_id, source, external_id) SELECT id, 'fpl', ${sql(externalId)} FROM players WHERE normalized_name = ${sql(normalized)} ORDER BY id DESC LIMIT 1;`);
  } else {
    statements.push(`INSERT OR IGNORE INTO player_aliases(player_id, alias, normalized_alias, source, confidence, is_verified) VALUES (${Number(match.id)}, ${sql(fullName)}, ${sql(normalized)}, 'fpl', ${confidence}, ${confidence === 1 ? 1 : 0});`);
    statements.push(`INSERT OR IGNORE INTO player_source_ids(player_id, source, external_id) VALUES (${Number(match.id)}, 'fpl', ${sql(externalId)});`);
    statements.push(`UPDATE players SET current_club = ${sql(club)}, current_position = ${sql(position)}, updated_at = CURRENT_TIMESTAMP WHERE id = ${Number(match.id)};`);
  }
}

statements.push('PRAGMA optimize;');
const temporaryDirectory = mkdtempSync(join(tmpdir(), 'injury-fpl-identities-'));
const sqlFile = join(temporaryDirectory, 'sync.sql');
try {
  writeFileSync(sqlFile, statements.join('\n'), 'utf8');
  execFileSync(process.execPath, [wrangler, 'd1', 'execute', database, '--remote', '--file', sqlFile], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], maxBuffer: 16 * 1024 * 1024,
  });
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}

console.log(JSON.stringify({ total: payload.elements.length, existing, exact, alias, created }));
