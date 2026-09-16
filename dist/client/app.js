let players = [];
let teams = [];
let selectedTeam = 0;

const apiBase = (window.INJURY_API_BASE || '.').replace(/\/$/, '');
const list = document.querySelector('#injury-list');
const injuryNames = {
  'Achilles injury':'跟腱伤势','Ankle injury':'脚踝伤势','Arm injury':'手臂伤势',
  'Back injury':'背部伤势','Calf injury':'小腿伤势','Concussion':'脑震荡',
  'Foot injury':'足部伤势','Groin injury':'腹股沟伤势','Hamstring injury':'腿筋伤势',
  'Hand injury':'手部伤势','Knee injury':'膝部伤势','Knock':'碰撞伤',
  'Leg injury':'腿部伤势','Muscular injury':'肌肉伤势','Thigh injury':'大腿伤势',
  'Unspecified injury':'伤情未明确','Wrist injury':'手腕伤势',
};
const positionNames = {Goalkeeper:'门将', Defender:'后卫', Midfielder:'中场', Forward:'前锋'};

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[character]));
}

function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'PL';
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(String(value).replace(' ', 'T') + (String(value).includes('Z') ? '' : 'Z'));
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('zh-CN', {month:'numeric', day:'numeric'});
}

function localizeReturn(detail = '') {
  if (/Unknown return date/i.test(detail)) return '复出时间未定';
  const expected = detail.match(/Expected back\s+(.+)/i);
  if (expected) {
    const months = {Jan:'1月',Feb:'2月',Mar:'3月',Apr:'4月',May:'5月',Jun:'6月',Jul:'7月',Aug:'8月',Sep:'9月',Oct:'10月',Nov:'11月',Dec:'12月'};
    const parts = expected[1].trim().split(/\s+/);
    return parts.length >= 2 ? `预计复出 ${months[parts[1]] || parts[1]}${parts[0]}日` : `预计复出 ${expected[1]}`;
  }
  const chance = detail.match(/(\d+)% chance of playing/i);
  if (chance) return `下轮出场概率 ${chance[1]}%`;
  return detail || '复出时间未定';
}

function normalizePlayer(row) {
  const [rawInjury = 'Unspecified injury', detail = ''] = String(row.news || '').split(/\s+-\s+/, 2);
  const injury = injuryNames[rawInjury] || rawInjury;
  const doubtful = row.status === 'd';
  const availability = doubtful ? '出场存疑' : '伤停';
  return {
    ...row,
    name: row.name || row.display_name,
    position: positionNames[row.position] || row.position,
    initials: initials(row.name || row.display_name),
    injury,
    injuryRaw: rawInjury,
    expectedReturn: localizeReturn(detail),
    availability,
    severity: doubtful ? 'medium' : 'high',
    status: doubtful ? 'doubtful' : 'injured',
    reportedDate: row.news_added,
    reported: formatDate(row.news_added),
    return: doubtful && row.chance_next_round !== null ? `${row.chance_next_round}% 出场概率` : localizeReturn(detail),
    area: availability,
    photo: row.photo,
    note: row.news,
    age: null,
  };
}

function avatarMarkup(player) {
  if (!player.photo) return `<span class="avatar">${escapeHtml(player.initials)}</span>`;
  return `<span class="avatar photo-avatar"><img src="${escapeHtml(player.photo)}" alt="${escapeHtml(player.name)}" data-fallback="${escapeHtml(player.initials)}" /></span>`;
}

function bindImageFallbacks() {
  document.querySelectorAll('img[data-fallback]').forEach(image => image.addEventListener('error', () => {
    image.parentElement.textContent = image.dataset.fallback;
    image.parentElement.classList.remove('photo-avatar');
  }, {once:true}));
}

function visiblePlayers() {
  return players.filter(player => !selectedTeam || player.team_id === selectedTeam);
}

function renderList() {
  const visible = visiblePlayers().sort((a, b) => String(b.news_added).localeCompare(String(a.news_added)));
  const heading = selectedTeam ? teams.find(team => team.id === selectedTeam)?.name : '全部球队';
  document.querySelector('#injury-list-title').textContent = heading || '全部球队';
  document.querySelector('#selection-count').textContent = `${visible.length} 名球员`;
  if (!visible.length) {
    list.innerHTML = '<div class="empty-state">当前没有伤病记录</div>';
    return;
  }
  list.innerHTML = visible.map(player => `
    <button class="injury-row fpl-row" data-id="${escapeHtml(player.id)}">
      <span class="fpl-player">${avatarMarkup(player)}<span><strong>${escapeHtml(player.name)}</strong><small>${escapeHtml(player.team)} · ${escapeHtml(player.position)}</small></span></span>
      <span class="injury-type"><strong>${escapeHtml(player.injury)}</strong><small>${player.status === 'doubtful' ? '出场情况待赛前确认' : '当前列为伤病状态'}</small></span>
      <span class="availability"><span class="availability-label ${player.status}">${escapeHtml(player.availability)}</span><strong>${escapeHtml(player.expectedReturn)}</strong></span>
      <span class="update-date"><strong>${escapeHtml(player.reported)}</strong><small>状态更新</small></span>
      <span class="row-arrow">›</span>
    </button>`).join('');
  bindImageFallbacks();
}

function renderTeamTabs() {
  const counts = new Map();
  players.forEach(player => counts.set(player.team_id, (counts.get(player.team_id) || 0) + 1));
  const tabs = [{id:0,name:'全部',short_name:'ALL'}, ...teams];
  document.querySelector('#team-tabs').innerHTML = tabs.map(team => `
    <button class="team-tab${team.id === selectedTeam ? ' active' : ''}" role="tab" aria-selected="${team.id === selectedTeam}" data-team="${team.id}">
      <span>${escapeHtml(team.name)}</span><b>${team.id ? counts.get(team.id) || 0 : players.length}</b>
    </button>`).join('');
}

function renderStats() {
  const doubtful = players.filter(player => player.status === 'doubtful').length;
  const knownReturn = players.filter(player => /^预计复出/.test(player.expectedReturn)).length;
  const affectedTeams = new Set(players.map(player => player.team_id)).size;
  document.querySelector('#stat-current').textContent = players.length;
  document.querySelector('#stat-doubtful').textContent = doubtful;
  document.querySelector('#stat-return').textContent = knownReturn;
  document.querySelector('#stat-teams').textContent = affectedTeams;
  document.querySelector('#data-summary').textContent = `${teams.length} 支球队 · 仅显示有明确伤病状态的球员`;
}

function openPlayer(id) {
  const selected = players.find(player => String(player.id) === String(id));
  if (selected) sessionStorage.setItem('injury-player', JSON.stringify(selected));
  window.location.href = `./player.html?id=${encodeURIComponent(id)}`;
}

document.addEventListener('click', event => {
  const row = event.target.closest('[data-id]');
  if (row) openPlayer(row.dataset.id);
  const tab = event.target.closest('[data-team]');
  if (tab) {
    selectedTeam = Number(tab.dataset.team);
    renderTeamTabs();
    renderList();
  }
});

const search = document.querySelector('#global-search');
const results = document.querySelector('#search-results');
function updateSearch() {
  const query = search.value.trim().toLowerCase();
  if (!query) { results.classList.remove('open'); return; }
  const matched = players.filter(player => [player.name, player.team, player.injury, player.position].join(' ').toLowerCase().includes(query)).slice(0, 10);
  results.innerHTML = matched.length ? matched.map(player => `<button class="search-result" data-id="${escapeHtml(player.id)}" role="option"><strong>${escapeHtml(player.name)}</strong><small>${escapeHtml(player.team)} · ${escapeHtml(player.injury)}</small></button>`).join('') : '<div class="empty-state compact">没有匹配结果</div>';
  results.classList.add('open');
}
search.addEventListener('input', updateSearch);
search.addEventListener('keydown', event => { if (event.key === 'Escape') { search.value = ''; results.classList.remove('open'); } });
document.addEventListener('click', event => { if (!event.target.closest('.search-wrap')) results.classList.remove('open'); });

async function syncInjuries() {
  list.innerHTML = '<div class="loading-state"><span></span>正在读取英超伤病数据</div>';
  try {
    const response = await fetch(`${apiBase}/api/fpl-injuries`, {headers:{Accept:'application/json'}});
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    players = (payload?.data?.players || []).map(normalizePlayer);
    teams = payload?.data?.teams || [];
    if (!players.length || teams.length !== 20) throw new Error('incomplete dataset');
    renderStats();
    renderTeamTabs();
    renderList();
    const updated = formatDate(payload?.meta?.updated_at);
    document.querySelector('.freshness').innerHTML = `<i></i> FPL · 更新至 ${escapeHtml(updated)}`;
  } catch (_error) {
    document.querySelector('#data-summary').textContent = '数据暂时无法读取';
    document.querySelector('.freshness').innerHTML = '<i class="warning-dot"></i> 更新失败';
    document.querySelector('#team-tabs').innerHTML = '';
    list.innerHTML = '<div class="empty-state">伤病数据暂时不可用</div>';
  }
}

syncInjuries();
