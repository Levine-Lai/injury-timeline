let players = [];
let teamStats = [];
const apiBase = (window.INJURY_API_BASE || '.').replace(/\/$/, '');
const list = document.querySelector('#injury-list');

const fallbackPlayers = [
  {id:'demo-saka',name:'Bukayo Saka',initials:'BS',team:'Arsenal',club:'#d51f35',position:'右边锋',injury:'腿筋伤势',area:'公开缺阵记录',severity:'medium',status:'new',return:'等待球队更新',days:'14–35 天',confidence:'历史区间',reported:'示例数据',note:'实时源暂不可用',age:null,absenceCount:2},
  {id:'demo-haaland',name:'Erling Haaland',initials:'EH',team:'Manchester City',club:'#6cabdd',position:'中锋',injury:'脚踝伤势',area:'公开缺阵记录',severity:'medium',status:'returning',return:'等待球队更新',days:'14–35 天',confidence:'历史区间',reported:'示例数据',note:'实时源暂不可用',age:null,absenceCount:1},
];

function escapeHtml(value='') {
  return String(value).replace(/[&<>'"]/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[character]));
}

function first(...values) {
  return values.find(value => value !== undefined && value !== null && value !== '') ?? '';
}

function rowsFrom(payload) {
  if (Array.isArray(payload)) return payload;
  for (const key of ['data','results','injuries','absences','response']) {
    if (Array.isArray(payload?.[key])) return payload[key];
    if (Array.isArray(payload?.data?.[key])) return payload.data[key];
  }
  return [];
}

function dateValue(row) {
  return first(row.match_date,row.fixture_date,row.date,row.game_date,row.match?.date,row.fixture?.date,row.match?.kickoff,row.created_at);
}

function normalizeRow(row, index) {
  const playerObject = typeof row.player === 'object' ? row.player : {};
  const teamObject = typeof row.team === 'object' ? row.team : {};
  const name = first(row.player_name,row.name,playerObject.name,playerObject.full_name,'未知球员');
  const team = first(row.team_name,row.club,row.squad,teamObject.name,teamObject.short_name,'未知球队');
  const reason = first(row.reason,row.injury,row.description,row.status,row.type,row.comment,'原因待确认');
  const date = dateValue(row);
  return {
    source: row,
    id: String(first(row.player_id,playerObject.id,row.id,`${name}-${index}`)),
    name,
    team,
    injury: reason,
    position: first(row.position,playerObject.position,'球员'),
    age: first(row.age,playerObject.age,null),
    reportedDate: date,
  };
}

function isNonInjury(reason='') {
  return /suspension|red card|yellow card|international duty|loan|transfer|personal|not in squad|rested/i.test(reason);
}

function severityFor(reason, missed) {
  if (/acl|cruciate|achilles|fracture|surgery|rupture|season/i.test(reason) || missed >= 6) return 'high';
  if (/hamstring|muscle|ankle|knee|groin|calf|thigh|back|hip/i.test(reason) || missed >= 3) return 'medium';
  return 'low';
}

function daysFor(severity) {
  return severity === 'high' ? '60–180 天' : severity === 'medium' ? '14–35 天' : '3–14 天';
}

function clubColor(team='') {
  const colors = ['#2674d9','#269c68','#e34b52','#6b7bd6','#e08b3d','#2e9aa8'];
  let sum = 0;
  for (const character of team) sum += character.codePointAt(0) || 0;
  return colors[sum % colors.length];
}

function buildPlayers(payload) {
  const rows = rowsFrom(payload).map(normalizeRow).filter(row => row.name !== '未知球员');
  const metaDate = first(payload?.meta?.as_of,payload?.as_of);
  const timestamps = rows.map(row => Date.parse(row.reportedDate)).filter(Number.isFinite);
  const newest = metaDate ? Date.parse(metaDate) : Math.max(...timestamps);
  const recentCutoff = Number.isFinite(newest) ? newest - 35 * 86400000 : 0;
  const groups = new Map();
  rows.forEach(row => {
    const key = row.id || row.name;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  });
  const result = [];
  groups.forEach(records => {
    records.sort((a,b) => (Date.parse(b.reportedDate) || 0) - (Date.parse(a.reportedDate) || 0));
    const latest = records[0];
    const latestTime = Date.parse(latest.reportedDate) || 0;
    if (recentCutoff && latestTime < recentCutoff) return;
    if (isNonInjury(latest.injury)) return;
    const windowStart = latestTime - 45 * 86400000;
    const absenceCount = records.filter(record => (Date.parse(record.reportedDate) || 0) >= windowStart).length;
    const severity = severityFor(latest.injury, absenceCount);
    const isNew = Number.isFinite(newest) && newest - latestTime <= 7 * 86400000;
    result.push({
      ...latest,
      initials: latest.name.split(/\s+/).map(part => part[0]).join('').slice(0,2).toUpperCase(),
      club: clubColor(latest.team),
      area: `${absenceCount} 场缺阵记录`,
      severity,
      status: severity === 'high' ? 'serious' : isNew ? 'new' : 'returning',
      return: '等待球队更新',
      days: daysFor(severity),
      confidence: `${absenceCount} 场样本`,
      reported: latest.reportedDate ? new Date(latest.reportedDate).toLocaleDateString('zh-CN') : '最近更新',
      note: `Big Balls Sports 缺阵原因：${latest.injury}`,
      absenceCount,
    });
  });
  result.sort((a,b) => (Date.parse(b.reportedDate) || 0) - (Date.parse(a.reportedDate) || 0));
  return { players: result.slice(0,80), asOf: metaDate || result[0]?.reportedDate || '', rawCount: rows.length };
}

function severityLabel(value) { return value === 'high' ? '长期' : value === 'medium' ? '中等' : '轻微'; }

function renderList(filter='all', team='') {
  const filtered = players.filter(player => (filter === 'all' || player.status === filter) && (!team || player.team === team));
  list.innerHTML = filtered.length ? filtered.map(player => `<button class="injury-row" data-id="${escapeHtml(player.id)}"><span class="avatar" style="--club:${player.club}">${escapeHtml(player.initials)}</span><span class="player"><strong>${escapeHtml(player.name)}</strong><small>${escapeHtml(player.team)} · ${escapeHtml(player.position)}</small></span><span class="injury-type"><strong>${escapeHtml(player.injury)}</strong><small>${escapeHtml(player.area)} · ${escapeHtml(player.reported)}</small></span><span class="return-date"><small>状态</small><strong>${escapeHtml(player.return)}</strong></span><span class="severity ${player.severity}">${severityLabel(player.severity)}</span><span class="row-arrow">›</span></button>`).join('') : '<div class="empty-state">当前筛选下暂无记录</div>';
}

function openPlayer(id) {
  const selected = players.find(player => String(player.id) === String(id));
  if (selected) sessionStorage.setItem('injury-player', JSON.stringify(selected));
  window.location.href = `./player.html?id=${encodeURIComponent(id)}`;
}

function calculateTeams() {
  const counts = new Map();
  players.forEach(player => counts.set(player.team, (counts.get(player.team) || 0) + 1));
  const maximum = Math.max(...counts.values(), 1);
  teamStats = [...counts.entries()].map(([name,count]) => [name,count,Math.round(count / maximum * 100),clubColor(name)]).sort((a,b) => b[1]-a[1]);
}

function renderPressure() {
  document.querySelector('#pressure-chart').innerHTML = teamStats.slice(0,7).map(([name,count,score,color]) => `<div class="pressure-item"><span>${escapeHtml(name)} · ${count}人</span><div class="bar-track"><div class="bar" style="--w:${score}%;--club:${color}"></div></div><b>${score}</b></div>`).join('') || '<div class="empty-state">暂无球队数据</div>';
}

function renderTeams() {
  document.querySelector('#team-grid').innerHTML = teamStats.map(([name,count,score,color]) => `<button class="team-card" data-team="${escapeHtml(name)}"><span class="team-badge" style="--club:${color}">${escapeHtml(name.split(/\s/).map(part=>part[0]).join('').slice(0,3))}</span><strong>${escapeHtml(name)}</strong><p>${count} 人近期缺阵 · 压力指数 ${score}</p><div class="meter"><i style="--club:${color};--pressure:${score}%"></i></div><footer><span>近期状态</span><span>${score>70?'高风险':score>35?'需关注':'稳定'}</span></footer></button>`).join('');
}

function renderTimeline() {
  document.querySelector('#timeline-list').innerHTML = players.map(player => `<button class="timeline-item" data-id="${escapeHtml(player.id)}"><span class="timeline-time">${escapeHtml(player.reported)}</span><i class="timeline-dot"></i><span class="timeline-copy"><strong>${escapeHtml(player.name)} · ${escapeHtml(player.injury)}</strong><span>${escapeHtml(player.team)}｜${escapeHtml(player.area)}</span></span><span class="severity ${player.severity}">${severityLabel(player.severity)}</span></button>`).join('');
}

function renderAll() {
  calculateTeams(); renderList(); renderPressure(); renderTeams(); renderTimeline();
}

function switchView(view) {
  document.querySelectorAll('[data-panel]').forEach(panel => panel.classList.toggle('hidden', panel.dataset.panel !== view));
  document.querySelectorAll('.nav-link').forEach(link => link.classList.toggle('active', link.dataset.view === view));
  window.scrollTo({top:0,behavior:'smooth'});
}

document.addEventListener('click', event => {
  const row = event.target.closest('[data-id]'); if (row) openPlayer(row.dataset.id);
  const nav = event.target.closest('[data-view]'); if (nav) switchView(nav.dataset.view);
  const filter = event.target.closest('[data-filter]');
  if (filter) { document.querySelectorAll('.filter').forEach(item => item.classList.remove('active')); filter.classList.add('active'); renderList(filter.dataset.filter); }
  const team = event.target.closest('[data-team]'); if (team) { switchView('overview'); renderList('all', team.dataset.team); }
});

const search = document.querySelector('#global-search');
const results = document.querySelector('#search-results');
function updateSearch() {
  const query = search.value.trim().toLowerCase();
  if (!query) { results.classList.remove('open'); return; }
  const matched = players.filter(player => [player.name,player.team,player.injury,player.position].join(' ').toLowerCase().includes(query)).slice(0,10);
  results.innerHTML = matched.length ? matched.map(player => `<button class="search-result" data-id="${escapeHtml(player.id)}" role="option"><strong>${escapeHtml(player.name)}</strong><small>${escapeHtml(player.team)} · ${escapeHtml(player.injury)}</small></button>`).join('') : '<div class="empty-state compact">没有匹配结果</div>';
  results.classList.add('open');
}
search.addEventListener('input', updateSearch);
search.addEventListener('keydown', event => { if (event.key === 'Escape') { search.value=''; results.classList.remove('open'); } });
document.addEventListener('keydown', event => { if (event.key === '/' && document.activeElement !== search) { event.preventDefault(); search.focus(); } });
document.addEventListener('click', event => { if (!event.target.closest('.search-wrap')) results.classList.remove('open'); });

async function syncAbsences() {
  list.innerHTML = '<div class="loading-state"><span></span>正在读取英超缺阵数据</div>';
  try {
    const response = await fetch(`${apiBase}/api/absences`, {headers:{Accept:'application/json'}});
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    const normalized = buildPlayers(payload);
    if (!normalized.players.length) throw new Error('empty dataset');
    players = normalized.players;
    const newCount = players.filter(player => player.status === 'new').length;
    const seriousCount = players.filter(player => player.severity === 'high').length;
    document.querySelector('#stat-current').textContent = players.length;
    document.querySelector('#stat-new').textContent = newCount;
    document.querySelector('#stat-return').textContent = seriousCount;
    document.querySelector('#stat-teams').textContent = `${new Set(players.map(player => player.team)).size} 支球队`;
    document.querySelector('.freshness').innerHTML = `<i></i> Big Balls · ${normalized.asOf ? `截至 ${escapeHtml(normalized.asOf)}` : '已同步'}`;
    renderAll();
  } catch (_error) {
    players = fallbackPlayers;
    document.querySelector('#stat-current').textContent = '2';
    document.querySelector('#stat-new').textContent = '1';
    document.querySelector('#stat-return').textContent = '0';
    document.querySelector('#stat-teams').textContent = '数据源连接中';
    document.querySelector('.freshness').innerHTML = '<i class="warning-dot"></i> 实时源暂不可用 · 展示示例';
    renderAll();
  }
}

syncAbsences();

