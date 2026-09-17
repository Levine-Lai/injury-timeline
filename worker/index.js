const API_ORIGIN = 'https://v3.football.api-sports.io';
const BIGBALLS_ORIGIN = 'https://api.bigballsdata.com';
const FPL_BOOTSTRAP = 'https://fantasy.premierleague.com/api/bootstrap-static/';

function json(value, status = 200, origin = '*') {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': status >= 400 ? 'no-store' : 'public, max-age=900',
      'access-control-allow-origin': origin,
      'access-control-allow-methods': 'GET, OPTIONS',
      'access-control-allow-headers': 'content-type',
    },
  });
}

function limitFrom(url, fallback = 20, maximum = 100) {
  const value = Number.parseInt(url.searchParams.get('limit') || '', 10);
  return Number.isFinite(value) ? Math.min(Math.max(value, 1), maximum) : fallback;
}

function normalizePlayerName(value = '') {
  return String(value).trim().replace(/\s+/g, ' ').toLowerCase();
}

const INJURY_LABELS = {
  hamstring: ['Hamstring injury', 'Hamstring muscle injury', 'Hamstring strain'],
  ankle: ['Ankle injury', 'ankle sprain', 'Ankle problems', 'Injury to the ankle', 'Ankle surgery', 'Bruise on ankle', 'Broken ankle', 'Torn ankle ligaments', 'Torn lateral ankle ligament', 'Ankle ligament tear'],
  knee: ['Knee injury', 'Knee problems', 'Knee surgery', 'Knee bruise', 'Inflammation in the knee', 'Inner knee ligament tear', 'Knee medial ligament tear', 'Inner ligament stretch of the knee', 'Torn lateral knee ligament', 'Bruised knee', 'Torn knee ligaments'],
  groin: ['Groin injury', 'Groin problems', 'Groin surgery', 'Groin strain'],
  calf: ['Calf injury', 'Calf problems', 'Calf muscle tear', 'Calf strain', 'Calf stiffness'],
  thigh: ['Thigh problems', 'Torn thigh muscle', 'Strain in the thigh and gluteal muscles'],
  back: ['Back problems', 'Back injury', 'Bruised back', 'Blockage in the back'],
  hip: ['Hip injury', 'Hip problems', 'Hip flexor problems', 'Hip bruise', 'Right hip flexor problems', 'Left hip flexor problems'],
  foot: ['Foot injury', 'Foot bruise', 'Broken foot', 'Foot surgery', 'Hairline crack in foot', 'Inflammation of the sole of the foot'],
  muscle: ['Muscle injury', 'muscular problems', 'Muscle fatigue', 'Hamstring muscle injury', 'Torn muscle fiber', 'Muscle strain', 'Calf muscle tear', 'Torn muscle bundle', 'Torn thigh muscle', 'Injury to abdominal muscles', 'Torn muscle fiber in the adductor area', 'Strain in the thigh and gluteal muscles', 'Abdominal muscle strain'],
  shoulder: ['Shoulder injury', 'Shoulder joint contusion', 'Broken shoulder'],
  achilles: ['Achilles tendon problems', 'Achilles tendon rupture', 'Achilles tendon contusion', 'Achilles tendon irritation', 'Achilles heel problems', 'Achilles tendon surgery'],
  fracture: ['Metatarsal fracture', 'Rib fracture', 'Wrist fracture', 'Lower leg fracture', 'Facial fracture', 'Forearm fracture', 'Metacarpal fracture', 'fatigue fracture', 'fracture', 'Lumbar vertebra fracture', 'Fracture of the eye socket', 'Scaphoid fracture'],
  concussion: ['concussion'],
  wrist: ['Wrist injury', 'Wrist fracture'],
  arm: ['Broken arm', 'Arm injury', 'Forearm fracture'],
  leg: ['Dead leg', 'Leg injury', 'Lower leg fracture', 'Broken leg'],
  knock: ['Knock', 'minor knock'],
};

function injuryLabels(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return INJURY_LABELS[normalized] || [value];
}

async function apiFootball(path, env, origin) {
  if (!env.API_FOOTBALL_KEY) return json({ error: 'API_FOOTBALL_KEY is not configured' }, 503, origin);
  const response = await fetch(`${API_ORIGIN}${path}`, {
    headers: { 'x-apisports-key': env.API_FOOTBALL_KEY, Accept: 'application/json' },
  });
  const body = await response.json();
  return json(body, response.status, origin);
}

async function bigBalls(path, env, origin) {
  if (!env.BIGBALLS_API_KEY) return json({ error: 'BIGBALLS_API_KEY is not configured' }, 503, origin);
  const response = await fetch(`${BIGBALLS_ORIGIN}${path}`, {
    headers: { Authorization: `Bearer ${env.BIGBALLS_API_KEY}`, Accept: 'application/json' },
  });
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json')
    ? await response.json()
    : { error: await response.text() };
  return json(body, response.status, origin);
}

async function teamBadge(url, origin) {
  const code = (url.searchParams.get('code') || '').trim();
  if (!/^\d+$/.test(code)) return json({ error: 'valid team code is required' }, 400, origin);
  const response = await fetch(`https://resources.premierleague.com/premierleague/badges/50/t${code}.png`, {
    headers: { Accept: 'image/png', 'User-Agent': 'InjuryTimeline/1.0' },
    cf: { cacheTtl: 86400, cacheEverything: true },
  });
  if (!response.ok) return json({ error: 'team badge unavailable' }, response.status, origin);
  return new Response(response.body, {
    status: 200,
    headers: {
      'content-type': 'image/png',
      'cache-control': 'public, max-age=86400',
      'access-control-allow-origin': origin,
    },
  });
}

async function fplInjuries(request, env, origin, ctx) {
  const cache = caches.default;
  const cacheKey = new Request(new URL('/__cache/fpl-injuries', request.url), { method: 'GET' });
  const cached = await cache.match(cacheKey);
  if (cached) return cached;
  const response = await fetch(FPL_BOOTSTRAP, {
    headers: { Accept: 'application/json', 'User-Agent': 'InjuryTimeline/1.0' },
    cf: { cacheTtl: 900, cacheEverything: true },
  });
  if (!response.ok) return json({ error: 'FPL data unavailable' }, response.status, origin);
  const payload = await response.json();
  let identityRows = { results: [] };
  try {
    identityRows = await env.injury_history.prepare(`
      SELECT external_id, player_id
      FROM player_source_ids
      WHERE source = 'fpl'
    `).all();
  } catch (_error) {
    // Current injury status must remain available if the historical database is rate-limited.
  }
  const historyIds = new Map((identityRows.results || []).map(row => [String(row.external_id), row.player_id]));
  const teams = new Map((payload.teams || []).map(team => [team.id, team]));
  const positions = new Map((payload.element_types || []).map(position => [position.id, position]));
  const players = (payload.elements || [])
    .filter(player => ['i', 'd'].includes(player.status) && player.news)
    .map(player => {
      const team = teams.get(player.team) || {};
      const position = positions.get(player.element_type) || {};
      const photoCode = String(player.photo || '').replace(/\.[^.]+$/, '');
      return {
        id: `fpl_${player.id}`,
        fpl_id: player.id,
        history_player_id: historyIds.get(String(player.id)) || null,
        name: [player.first_name, player.second_name].filter(Boolean).join(' '),
        display_name: player.web_name,
        team_id: player.team,
        team: team.name || '',
        team_short: team.short_name || '',
        position: position.singular_name || position.singular_name_short || '',
        status: player.status,
        news: player.news,
        news_added: player.news_added,
        chance_next_round: player.chance_of_playing_next_round,
        chance_this_round: player.chance_of_playing_this_round,
        photo: photoCode ? `https://resources.premierleague.com/premierleague/photos/players/110x140/p${photoCode}.png` : null,
      };
    });
  const updatedAt = players.map(player => player.news_added).filter(Boolean).sort().at(-1) || null;
  const workerOrigin = new URL(request.url).origin;
  const result = json({ data: { teams: [...teams.values()].map(team => ({
    id: team.id,
    name: team.name,
    short_name: team.short_name,
    code: team.code,
    logo: team.code ? `${workerOrigin}/api/team-badge?code=${team.code}` : null,
  })), players }, meta: { source: 'Fantasy Premier League', updated_at: updatedAt } }, 200, origin);
  ctx.waitUntil(cache.put(cacheKey, result.clone()));
  return result;
}

async function history(url, env, origin) {
  const player = (url.searchParams.get('player') || '').trim();
  let playerId = Number.parseInt(url.searchParams.get('player_id') || '', 10);
  if (!Number.isFinite(playerId) && !player) return json({ error: 'player_id or player is required' }, 400, origin);
  const limit = limitFrom(url);
  if (!Number.isFinite(playerId) && player) {
    const identity = await env.injury_history.prepare(`
      SELECT player_id
      FROM player_aliases
      WHERE normalized_alias = ?
      ORDER BY is_verified DESC, confidence DESC, id ASC
      LIMIT 1
    `).bind(normalizePlayerName(player)).first();
    if (identity?.player_id) playerId = Number(identity.player_id);
  }
  if (Number.isFinite(playerId)) {
    const result = await env.injury_history.prepare(`
      SELECT id, player_id, season, injury_type, date_from, date_until, days_missed, games_missed,
             player_name, player_age, player_position, club, league
      FROM injury_events
      WHERE player_id = ?
      ORDER BY date_from DESC
      LIMIT ?
    `).bind(playerId, limit).all();
    return json({ query: { player_id: playerId, player: player || null, limit }, results: result.results }, 200, origin);
  }
  const abbreviated = player.match(/^(?:[A-Z]\.)+\s+(.+)$/i);
  const playerPattern = abbreviated ? `%${abbreviated[1]}%` : `%${player}%`;
  const result = await env.injury_history.prepare(`
    SELECT id, player_id, season, injury_type, date_from, date_until, days_missed, games_missed,
           player_name, player_age, player_position, club, league
    FROM injury_events
    WHERE player_name LIKE ? COLLATE NOCASE
    ORDER BY date_from DESC
    LIMIT ?
  `).bind(playerPattern, limit).all();
  return json({ query: { player, limit }, results: result.results }, 200, origin);
}

async function similar(url, env, origin) {
  const injury = (url.searchParams.get('injury') || '').trim();
  if (!injury) return json({ error: 'injury is required' }, 400, origin);
  const labels = injuryLabels(injury);
  const labelParameters = labels.map(() => '?').join(', ');
  const position = (url.searchParams.get('position') || '').trim();
  const age = Number.parseInt(url.searchParams.get('age') || '', 10);
  const limit = limitFrom(url, 8, 30);
  const ageValue = Number.isFinite(age) ? age : 0;
  const result = await env.injury_history.prepare(`
    SELECT season, injury_type, date_from, date_until, days_missed, games_missed,
           player_name, player_age, player_position, club, league
    FROM injury_events
    WHERE injury_type IN (${labelParameters})
      AND (? = '' OR player_position LIKE '%' || ? || '%' COLLATE NOCASE)
      AND days_missed IS NOT NULL
    ORDER BY CASE WHEN ? = 0 OR player_age IS NULL THEN 999 ELSE ABS(player_age - ?) END,
             date_from DESC
    LIMIT ?
  `).bind(...labels, position, position, ageValue, ageValue, limit).all();
  return json({ query: { injury, position: position || null, age: ageValue || null, limit }, results: result.results }, 200, origin);
}

async function stats(url, env, origin) {
  const injury = (url.searchParams.get('injury') || '').trim();
  if (!injury) return json({ error: 'injury is required' }, 400, origin);
  const labels = injuryLabels(injury);
  const labelParameters = labels.map(() => '?').join(', ');
  const position = (url.searchParams.get('position') || '').trim();
  const result = await env.injury_history.prepare(`
    SELECT COUNT(*) AS sample_size,
           ROUND(AVG(days_missed), 1) AS average_days_missed,
           MIN(days_missed) AS minimum_days_missed,
           MAX(days_missed) AS maximum_days_missed,
           ROUND(AVG(games_missed), 1) AS average_games_missed
    FROM injury_events
    WHERE injury_type IN (${labelParameters})
      AND (? = '' OR player_position LIKE '%' || ? || '%' COLLATE NOCASE)
      AND days_missed IS NOT NULL
  `).bind(...labels, position, position).first();
  return json({ query: { injury, position: position || null }, stats: result }, 200, origin);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = env.ALLOWED_ORIGIN || '*';
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: {
        'access-control-allow-origin': origin,
        'access-control-allow-methods': 'GET, OPTIONS',
        'access-control-allow-headers': 'content-type',
      } });
    }
    if (url.pathname === '/api/injuries') {
      const league = url.searchParams.get('league') || '39';
      const season = url.searchParams.get('season') || String(new Date().getUTCFullYear());
      return apiFootball(`/injuries?league=${encodeURIComponent(league)}&season=${encodeURIComponent(season)}`, env, origin);
    }
    if (url.pathname === '/api/absences') {
      return bigBalls('/v1/injuries?sport=football&league=epl', env, origin);
    }
    if (url.pathname === '/api/team-badge') return teamBadge(url, origin);
    if (url.pathname === '/api/fpl-injuries') return fplInjuries(request, env, origin, ctx);
    if (url.pathname === '/api/standings') {
      return bigBalls('/v1/standings?sport=football&league=epl', env, origin);
    }
    if (url.pathname === '/api/teams') {
      return bigBalls('/v1/teams?sport=football', env, origin);
    }
    if (url.pathname === '/api/player-search') {
      const name = url.searchParams.get('name');
      if (!name) return json({ error: 'player name required' }, 400, origin);
      return bigBalls(`/v1/players?name=${encodeURIComponent(name)}`, env, origin);
    }
    if (url.pathname === '/api/players') {
      return bigBalls('/v1/players?sport=football&league=epl&limit=200', env, origin);
    }
    if (url.pathname === '/api/absence-player') {
      const player = url.searchParams.get('id');
      if (!player) return json({ error: 'player id required' }, 400, origin);
      return bigBalls(`/v1/players/${encodeURIComponent(player)}/injury`, env, origin);
    }
    if (url.pathname === '/api/player') {
      const player = url.searchParams.get('id');
      if (!player) return json({ error: 'player id required' }, 400, origin);
      const [current, past] = await Promise.all([
        apiFootball(`/injuries?player=${encodeURIComponent(player)}`, env, origin),
        apiFootball(`/sidelined?player=${encodeURIComponent(player)}`, env, origin),
      ]);
      return json({ current: await current.json(), history: await past.json() }, 200, origin);
    }
    if (url.pathname === '/api/history') {
      try { return await history(url, env, origin); }
      catch (_error) { return json({ error: 'history database temporarily unavailable' }, 503, origin); }
    }
    if (url.pathname === '/api/similar') {
      try { return await similar(url, env, origin); }
      catch (_error) { return json({ error: 'history database temporarily unavailable' }, 503, origin); }
    }
    if (url.pathname === '/api/history/stats') {
      try { return await stats(url, env, origin); }
      catch (_error) { return json({ error: 'history database temporarily unavailable' }, 503, origin); }
    }
    return json({
      service: 'injury-api-proxy',
      status: 'ok',
      historyDatabase: Boolean(env.injury_history),
      bigBallsConfigured: Boolean(env.BIGBALLS_API_KEY),
    }, 200, origin);
  },
};

