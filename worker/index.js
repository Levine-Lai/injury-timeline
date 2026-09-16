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

async function fplInjuries(origin) {
  const response = await fetch(FPL_BOOTSTRAP, {
    headers: { Accept: 'application/json', 'User-Agent': 'InjuryTimeline/1.0' },
    cf: { cacheTtl: 900, cacheEverything: true },
  });
  if (!response.ok) return json({ error: 'FPL data unavailable' }, response.status, origin);
  const payload = await response.json();
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
  return json({ data: { teams: [...teams.values()].map(team => ({
    id: team.id,
    name: team.name,
    short_name: team.short_name,
    code: team.code,
    logo: team.code ? `https://resources.premierleague.com/premierleague/badges/t${team.code}.svg` : null,
  })), players }, meta: { source: 'Fantasy Premier League', updated_at: updatedAt } }, 200, origin);
}

async function history(url, env, origin) {
  const player = (url.searchParams.get('player') || '').trim();
  if (!player) return json({ error: 'player is required' }, 400, origin);
  const limit = limitFrom(url);
  const abbreviated = player.match(/^(?:[A-Z]\.)+\s+(.+)$/i);
  const playerPattern = abbreviated ? `%${abbreviated[1]}%` : `%${player}%`;
  const result = await env.injury_history.prepare(`
    SELECT season, injury_type, date_from, date_until, days_missed, games_missed,
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
  const position = (url.searchParams.get('position') || '').trim();
  const age = Number.parseInt(url.searchParams.get('age') || '', 10);
  const limit = limitFrom(url, 8, 30);
  const ageValue = Number.isFinite(age) ? age : 0;
  const result = await env.injury_history.prepare(`
    SELECT season, injury_type, date_from, date_until, days_missed, games_missed,
           player_name, player_age, player_position, club, league
    FROM injury_events
    WHERE injury_type LIKE ? COLLATE NOCASE
      AND (? = '' OR player_position LIKE '%' || ? || '%' COLLATE NOCASE)
      AND days_missed IS NOT NULL
    ORDER BY CASE WHEN ? = 0 OR player_age IS NULL THEN 999 ELSE ABS(player_age - ?) END,
             date_from DESC
    LIMIT ?
  `).bind(`%${injury}%`, position, position, ageValue, ageValue, limit).all();
  return json({ query: { injury, position: position || null, age: ageValue || null, limit }, results: result.results }, 200, origin);
}

async function stats(url, env, origin) {
  const injury = (url.searchParams.get('injury') || '').trim();
  if (!injury) return json({ error: 'injury is required' }, 400, origin);
  const position = (url.searchParams.get('position') || '').trim();
  const result = await env.injury_history.prepare(`
    SELECT COUNT(*) AS sample_size,
           ROUND(AVG(days_missed), 1) AS average_days_missed,
           MIN(days_missed) AS minimum_days_missed,
           MAX(days_missed) AS maximum_days_missed,
           ROUND(AVG(games_missed), 1) AS average_games_missed
    FROM injury_events
    WHERE injury_type LIKE ? COLLATE NOCASE
      AND (? = '' OR player_position LIKE '%' || ? || '%' COLLATE NOCASE)
      AND days_missed IS NOT NULL
  `).bind(`%${injury}%`, position, position).first();
  return json({ query: { injury, position: position || null }, stats: result }, 200, origin);
}

export default {
  async fetch(request, env) {
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
    if (url.pathname === '/api/fpl-injuries') return fplInjuries(origin);
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
    if (url.pathname === '/api/history') return history(url, env, origin);
    if (url.pathname === '/api/similar') return similar(url, env, origin);
    if (url.pathname === '/api/history/stats') return stats(url, env, origin);
    return json({
      service: 'injury-api-proxy',
      status: 'ok',
      historyDatabase: Boolean(env.injury_history),
      bigBallsConfigured: Boolean(env.BIGBALLS_API_KEY),
    }, 200, origin);
  },
};

