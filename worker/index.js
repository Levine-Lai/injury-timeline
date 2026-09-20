const API_ORIGIN = 'https://v3.football.api-sports.io';
const BIGBALLS_ORIGIN = 'https://api.bigballsdata.com';
const FPL_BOOTSTRAP = 'https://fantasy.premierleague.com/api/bootstrap-static/';

const MEDICAL_EVIDENCE = {
  fpl_6: {
    episode_id: 'inj-saliba-2026-07-23',
    player_id: 'fpl_6',
    current: {
      classification_code: 'BACK-UNSPECIFIED',
      body_region: '背部',
      tissue: null,
      pathology: null,
      grade: null,
      treatment: null,
      precision: 'region_only',
      precision_label: '仅部位级',
      club_report_status: '未匹配到俱乐部组织级诊断',
      can_predict: false,
      assessment: '公开信息只能确认背部伤势，无法区分肌肉、椎间盘、骨应力或其他病理。',
    },
    claims: [{
      claim_id: 'claim-saliba-back-fpl',
      field: 'body_region',
      value: '背部',
      published_at: '2026-07-23T12:01:23.289376Z',
      source_name: 'Fantasy Premier League',
      source_type: 'league_fantasy',
      evidence: '标记为背部伤势，复出日期未知。',
      confidence: 'basic',
      source_url: 'https://fantasy.premierleague.com/',
    }],
    verified_history: {
      episode_id: 'inj-saliba-calf-2025',
      classification_code: 'CALF-UNSPECIFIED',
      diagnosis: '小腿伤势',
      status: 'closed',
      outcome: '缺席4场后首发复出',
      events: [
        {
          date: '2025-12-12',
          stage: '接近复出',
          detail: '阿森纳赛前信息确认 Saliba 正接近从小腿伤势中复出。',
          source_name: 'Arsenal.com',
          source_url: 'https://www.arsenal.com/news/preview-arsenal-v-wolves-aqlcz7A6u2M5',
        },
        {
          date: '2025-12-13',
          stage: '正式复出',
          detail: '进入首发阵容；俱乐部确认此前因小腿伤势缺席4场。',
          source_name: 'Arsenal.com',
          source_url: 'https://www.arsenal.com/news/team-news-saliba-rice-and-timber-back-for-wolves-aNL307w3J79s',
        },
      ],
    },
  },
};

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

const ARCHIVE_CATEGORIES = [
  { id: 'knee', label: '膝部', pattern: /knee|meniscus|cruciate|acl|patell|collateral/i },
  { id: 'thigh', label: '大腿与腿筋', pattern: /hamstring|thigh|quadriceps/i },
  { id: 'hip_groin', label: '髋部与腹股沟', pattern: /hip|groin|adductor|pubalgia|pubic/i },
  { id: 'lower_leg', label: '小腿与跟腱', pattern: /calf|shin|fibula|lower leg|achilles/i },
  { id: 'ankle', label: '脚踝', pattern: /ankle/i },
  { id: 'foot', label: '足部', pattern: /foot|metatarsal|toe|heel|plantar/i },
  { id: 'back', label: '背部与脊柱', pattern: /back|lumbago|lumbar|spine|vertebra/i },
  { id: 'upper_limb', label: '肩臂与手部', pattern: /shoulder|arm|elbow|wrist|hand|forearm|metacarpal/i },
  { id: 'head_neck', label: '头颈部', pattern: /head|concussion|nose|facial|eye socket|neck/i },
  { id: 'torso', label: '胸腹部', pattern: /rib|chest|abdominal|abdomen/i },
  { id: 'muscle_unspecified', label: '肌肉（部位未明）', pattern: /muscle|muscular|strain/i },
  { id: 'other_trauma', label: '其他创伤', pattern: /ligament|tendon|capsular|knock|bruise|fracture|broken|surgery|inflammation|wound|tear|injury|problems/i },
];

const NON_INJURY_LABELS = /corona|covid|virus|\bill\b|flu|influenza|fever|cold|infection|tonsillitis|quarantine|rest|fitness|stomach|food poisoning|allergy/i;

const ARCHIVE_INJURY_NAMES = {
  'Hamstring injury': '腿筋伤势',
  'Hamstring muscle injury': '腿筋肌肉伤势',
  'Hamstring strain': '腿筋拉伤',
  'Muscle injury': '肌肉伤势',
  'muscular problems': '肌肉问题',
  'Muscle fatigue': '肌肉疲劳',
  'Muscle strain': '肌肉拉伤',
  'Torn muscle fiber': '肌纤维撕裂',
  'Torn muscle bundle': '肌束撕裂',
  'Knee injury': '膝部伤势',
  'Knee problems': '膝部问题',
  'Knee surgery': '膝部手术',
  'Knee bruise': '膝部挫伤',
  'Meniscus injury': '半月板伤势',
  'Meniscus tear': '半月板撕裂',
  'Cruciate ligament tear': '十字韧带撕裂',
  'Cruciate ligament injury': '十字韧带伤势',
  'Ankle injury': '脚踝伤势',
  'Ankle problems': '脚踝问题',
  'Ankle sprain': '脚踝扭伤',
  'ankle sprain': '脚踝扭伤',
  'Injury to the ankle': '脚踝伤势',
  'Ankle surgery': '脚踝手术',
  'Calf injury': '小腿伤势',
  'Calf problems': '小腿问题',
  'Calf muscle tear': '小腿肌肉撕裂',
  'Achilles tendon problems': '跟腱问题',
  'Achilles tendon rupture': '跟腱断裂',
  'Thigh problems': '大腿伤势',
  'Torn thigh muscle': '大腿肌肉撕裂',
  'Adductor pain': '内收肌疼痛',
  'Adductor injury': '内收肌伤势',
  'Groin injury': '腹股沟伤势',
  'Groin problems': '腹股沟问题',
  'Groin surgery': '腹股沟手术',
  'Hip injury': '髋部伤势',
  'Hip problems': '髋部问题',
  'Hip flexor problems': '髋屈肌问题',
  'Foot injury': '足部伤势',
  'Metatarsal fracture': '跖骨骨折',
  'Toe injury': '脚趾伤势',
  'Back problems': '背部问题',
  'Back injury': '背部伤势',
  'Lumbago': '腰痛',
  'Shoulder injury': '肩部伤势',
  'Hand injury': '手部伤势',
  'Head injury': '头部伤势',
  'concussion': '脑震荡',
  'Leg injury': '腿部伤势',
  'Dead leg': '大腿挫伤',
  'Knock': '碰撞伤',
  'minor knock': '轻微碰撞伤',
  'bruise': '挫伤',
};

function archiveCategory(injuryType) {
  if (!injuryType || NON_INJURY_LABELS.test(injuryType)) return null;
  return ARCHIVE_CATEGORIES.find(category => category.pattern.test(injuryType)) || null;
}

function archiveTypeRow(row) {
  const category = archiveCategory(row.injury_type);
  if (!category) return null;
  return {
    injury_type: row.injury_type,
    injury_label: ARCHIVE_INJURY_NAMES[row.injury_type] || row.injury_type,
    category_id: category.id,
    category_label: category.label,
    cases: Number(row.cases || 0),
    players: Number(row.players || 0),
    average_days: Number(row.average_days || 0),
    minimum_days: Number(row.minimum_days || 0),
    maximum_days: Number(row.maximum_days || 0),
  };
}

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

function medicalEvidence(url, origin) {
  const playerId = (url.searchParams.get('player_id') || '').trim();
  if (!playerId) return json({ error: 'player_id is required' }, 400, origin);
  const evidence = MEDICAL_EVIDENCE[playerId];
  if (!evidence) return json({ data: null }, 404, origin);
  return json({ data: evidence }, 200, origin);
}

async function fplInjuries(request, env, origin, ctx) {
  const cache = caches.default;
  const cacheKey = new Request(new URL('/__cache/v2/fpl-injuries', request.url), { method: 'GET' });
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
        photo: photoCode ? `https://resources.premierleague.com/premierleague/photos/players/250x250/p${photoCode}.png` : null,
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

async function archive(request, env, origin, ctx) {
  const url = new URL(request.url);
  const league = (url.searchParams.get('league') || '').trim();
  const injury = (url.searchParams.get('injury') || '').trim();
  const query = (url.searchParams.get('q') || '').trim().replace(/\s+/g, ' ');
  const limit = limitFrom(url, 30, 50);
  const offsetValue = Number.parseInt(url.searchParams.get('offset') || '', 10);
  const offset = Number.isFinite(offsetValue) ? Math.max(offsetValue, 0) : 0;

  if (query && query.length < 2) return json({ error: 'search query must contain at least 2 characters' }, 400, origin);

  if (injury || query) {
    const where = [
      'date_until IS NOT NULL',
      'days_missed IS NOT NULL',
      'days_missed > 0',
      "(? = '' OR league = ?)",
    ];
    const bindings = [league, league];
    if (injury) {
      where.push('injury_type = ?');
      bindings.push(injury);
    }
    if (query) {
      where.push('player_name LIKE ? COLLATE NOCASE');
      bindings.push(`%${query}%`);
    }
    const result = await env.injury_history.prepare(`
      SELECT id, player_id, season, injury_type, date_from, date_until, days_missed,
             games_missed, player_name, player_age, player_position, club, league
      FROM injury_events
      WHERE ${where.join('\n        AND ')}
      ORDER BY date_from DESC, id DESC
      LIMIT ? OFFSET ?
    `).bind(...bindings, limit, offset).all();
    return json({
      query: { injury: injury || null, player: query || null, league: league || null, limit, offset },
      results: result.results || [],
    }, 200, origin);
  }

  const cache = caches.default;
  const cacheUrl = new URL(`/__cache/v1/history-archive?league=${encodeURIComponent(league)}`, request.url);
  const cacheKey = new Request(cacheUrl, { method: 'GET' });
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const [typesResult, totalResult] = await Promise.all([
    env.injury_history.prepare(`
      SELECT injury_type,
             COUNT(*) AS cases,
             COUNT(DISTINCT COALESCE(CAST(player_id AS TEXT), lower(player_name))) AS players,
             ROUND(AVG(days_missed), 1) AS average_days,
             MIN(days_missed) AS minimum_days,
             MAX(days_missed) AS maximum_days
      FROM injury_events
      WHERE date_until IS NOT NULL
        AND days_missed IS NOT NULL
        AND days_missed > 0
        AND (? = '' OR league = ?)
      GROUP BY injury_type
      ORDER BY cases DESC
    `).bind(league, league).all(),
    env.injury_history.prepare(`
      SELECT COUNT(*) AS cases,
             COUNT(DISTINCT COALESCE(CAST(player_id AS TEXT), lower(player_name))) AS players
      FROM injury_events
      WHERE date_until IS NOT NULL
        AND days_missed IS NOT NULL
        AND days_missed > 0
        AND (? = '' OR league = ?)
    `).bind(league, league).first(),
  ]);

  const types = (typesResult.results || []).map(archiveTypeRow).filter(Boolean);
  const categories = ARCHIVE_CATEGORIES.map(category => {
    const categoryTypes = types.filter(type => type.category_id === category.id);
    return {
      id: category.id,
      label: category.label,
      cases: categoryTypes.reduce((sum, type) => sum + type.cases, 0),
      type_count: categoryTypes.length,
    };
  }).filter(category => category.cases > 0);
  const classifiedCases = types.reduce((sum, type) => sum + type.cases, 0);
  const response = json({
    data: { categories, types },
    meta: {
      league: league || null,
      completed_cases: Number(totalResult?.cases || 0),
      classified_cases: classifiedCases,
      players: Number(totalResult?.players || 0),
      source: 'European Football Injuries 2020–2025',
    },
  }, 200, origin);
  response.headers.set('cache-control', 'public, max-age=86400');
  ctx.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
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
    if (url.pathname === '/api/medical-evidence') return medicalEvidence(url, origin);
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
    if (url.pathname === '/api/history/archive') {
      try { return await archive(request, env, origin, ctx); }
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

