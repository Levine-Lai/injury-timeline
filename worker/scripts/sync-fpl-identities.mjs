import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const database = 'injury-history';
const wrangler = join(process.cwd(), 'node_modules', 'wrangler', 'bin', 'wrangler.js');
const apply = process.argv.includes('--apply');
const maxWritesArgument = process.argv.find(argument => argument.startsWith('--max-writes='));
const maxWrites = Number.parseInt(maxWritesArgument?.split('=')[1] || '10000', 10);
if (!Number.isFinite(maxWrites) || maxWrites < 1 || maxWrites > 20000) {
  throw new Error('--max-writes must be between 1 and 20000');
}

function normalize(value = '') {
  return String(value).trim().replace(/\s+/g, ' ').toLowerCase();
}

function sql(value = '') {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function d1Json(command) {
  try {
    const output = execFileSync(process.execPath, [
      wrangler, 'd1', 'execute', database, '--remote', '--command', command, '--json',
    ], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
    return JSON.parse(output)[0]?.results || [];
  } catch (error) {
    const detail = String(error?.stdout || error?.message || error);
    if (detail.includes('free tier daily row')) {
      console.error('D1 daily quota is unavailable. No changes were applied; wait for the UTC reset.');
      process.exit(2);
    }
    throw error;
  }
}

const historyPlayers = d1Json(`
  SELECT p.id, p.canonical_name, p.normalized_name, p.current_club, p.current_position
  FROM players p
`);
const sourceRows = d1Json(`
  SELECT external_id, player_id FROM player_source_ids WHERE source = 'fpl'
`);
const aliasRows = d1Json(`
  SELECT player_id, normalized_alias FROM player_aliases WHERE source = 'fpl'
`);
const sourceIds = new Map(sourceRows.map(row => [String(row.external_id), Number(row.player_id)]));
const aliases = new Set(aliasRows.map(row => `${Number(row.player_id)}:${normalize(row.normalized_alias)}`));
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

const changes = [];
let existing = 0;
let exact = 0;
let alias = 0;
let created = 0;
let updated = 0;

function plan(cost, ...statements) {
  changes.push({ cost, statements });
}

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
    plan(8,
      `INSERT INTO players(canonical_name, normalized_name, current_club, current_position) VALUES (${sql(fullName)}, ${sql(normalized)}, ${sql(club)}, ${sql(position)});`,
      `INSERT INTO player_aliases(player_id, alias, normalized_alias, source, confidence, is_verified) SELECT id, ${sql(fullName)}, ${sql(normalized)}, 'fpl', 1.0, 1 FROM players WHERE normalized_name = ${sql(normalized)} ORDER BY id DESC LIMIT 1;`,
      `INSERT INTO player_source_ids(player_id, source, external_id) SELECT id, 'fpl', ${sql(externalId)} FROM players WHERE normalized_name = ${sql(normalized)} ORDER BY id DESC LIMIT 1;`,
    );
  } else {
    const playerId = Number(match.id);
    if (!aliases.has(`${playerId}:${normalized}`)) {
      plan(3, `INSERT INTO player_aliases(player_id, alias, normalized_alias, source, confidence, is_verified) VALUES (${playerId}, ${sql(fullName)}, ${sql(normalized)}, 'fpl', ${confidence}, ${confidence === 1 ? 1 : 0});`);
    }
    if (!sourceIds.has(externalId)) {
      plan(3, `INSERT INTO player_source_ids(player_id, source, external_id) VALUES (${playerId}, 'fpl', ${sql(externalId)});`);
    }
    if (String(match.current_club || '') !== club || String(match.current_position || '') !== position) {
      updated += 1;
      plan(1, `UPDATE players SET current_club = ${sql(club)}, current_position = ${sql(position)}, updated_at = CURRENT_TIMESTAMP WHERE id = ${playerId} AND (current_club IS NOT ${sql(club)} OR current_position IS NOT ${sql(position)});`);
    }
  }
}

const estimatedWrites = changes.reduce((total, change) => total + change.cost, 0);
const summary = { mode: apply ? 'apply' : 'dry-run', total: payload.elements.length, existing, exact, alias, created, updated, estimated_writes: estimatedWrites, max_writes: maxWrites };
if (!apply) {
  console.log(JSON.stringify(summary));
  console.log('Dry run only. Use --apply after reviewing estimated_writes.');
  process.exit(0);
}
if (estimatedWrites > maxWrites) {
  throw new Error(`Refusing sync: estimated ${estimatedWrites} rows written exceeds the ${maxWrites} safety budget`);
}
if (changes.length) {
  const statements = ['PRAGMA foreign_keys = ON;', ...changes.flatMap(change => change.statements)];
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
}

console.log(JSON.stringify(summary));
