const apiBase = (window.INJURY_API_BASE || '.').replace(/\/$/, '');
const id = new URLSearchParams(location.search).get('id') || '';
let player = null;

try {
  const stored = JSON.parse(sessionStorage.getItem('injury-player') || 'null');
  if (stored && String(stored.id) === String(id)) player = stored;
} catch (_error) {}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[character]));
}

function safeImage(value = '') {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : '';
  } catch (_error) {
    return '';
  }
}

function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'PL';
}

function avatarMarkup(person, className = 'detail-avatar') {
  const image = safeImage(person.headshot_url || person.photo || person.image || '');
  if (image) return `<span class="${className}"><img src="${escapeHtml(image)}" alt="${escapeHtml(person.name || person.player_name)}" /></span>`;
  return `<span class="${className}" aria-hidden="true">${escapeHtml(person.initials || initials(person.name || person.player_name))}</span>`;
}

function display(value, fallback = '—') {
  const text = String(value ?? '').trim();
  return text && !['球员', '英超', '最近更新'].includes(text) ? text : fallback;
}

function injuryTerm(reason = '') {
  if (!reason || /未公开|待确认|伤停/.test(reason)) return '';
  const chineseTerms = [
    ['腿筋','hamstring'],['脚踝','ankle'],['膝','knee'],['腹股沟','groin'],
    ['小腿','calf'],['大腿','thigh'],['背','back'],['髋','hip'],['足','foot'],
    ['肌肉','muscle'],['肩','shoulder'],['跟腱','achilles'],['骨折','fracture'],
    ['脑震荡','concussion'],['手腕','wrist'],['手臂','arm'],['腿部','leg'],['碰撞','knock'],
  ];
  const translated = chineseTerms.find(([label]) => reason.includes(label));
  if (translated) return translated[1];
  const terms = ['hamstring','ankle','knee','groin','calf','thigh','back','hip','foot','muscle','shoulder','achilles','fracture'];
  const lower = reason.toLowerCase();
  return terms.find(term => lower.includes(term)) || reason.split(/[,(/-]/)[0].trim();
}

function positionTerm(position = '') {
  return ({'门将':'Goalkeeper','后卫':'Defender','中场':'Midfielder','前锋':'Forward'})[position] || position;
}

function formatDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString('zh-CN') : '—';
}

function initialPage() {
  const root = document.querySelector('#player-page');
  if (!player) {
    root.innerHTML = '<section class="player-card missing-player"><h1>未找到球员</h1><a class="back-link" href="./index.html">返回伤病列表</a></section>';
    return false;
  }

  document.title = `${player.name}｜伤停线`;
  root.innerHTML = `
    <section class="identity-panel" id="identity-panel">
      ${avatarMarkup(player)}
      <div class="identity-name"><h1>${escapeHtml(player.name)}</h1><p><span id="player-position">${escapeHtml(display(player.position))}</span><i></i><span id="player-team">${escapeHtml(display(player.team))}</span></p></div>
      <dl class="identity-facts">
        <div><dt>伤病</dt><dd>${escapeHtml(display(player.injury, '未公开'))}</dd></div>
        <div><dt>受伤日期</dt><dd>${formatDate(player.injuryDate)}</dd></div>
        <div><dt>当前状态</dt><dd class="status-active ${player.status === 'doubtful' ? 'status-doubtful' : ''}">${escapeHtml(player.availability || '伤停')}</dd></div>
      </dl>
    </section>

    <section class="recovery-panel">
      <div class="section-title"><h2>恢复预测</h2><strong id="recovery-window">数据不足</strong></div>
      <div class="recovery-layout">
        <div class="recovery-plot" id="recovery-plot">
          <div class="plot-track"><span class="plot-range" id="plot-range"></span><i id="plot-marker"></i></div>
          <div class="plot-labels"><span id="minimum-days">短</span><span id="average-days">历史均值</span><span id="maximum-days">长</span></div>
        </div>
        <dl class="recovery-facts">
          <div><dt>恢复信息</dt><dd id="estimated-date">${escapeHtml(player.expectedReturn || '—')}</dd></div>
          <div><dt>历史样本</dt><dd id="sample-size">—</dd></div>
          <div><dt>平均缺阵</dt><dd id="average-value">—</dd></div>
        </dl>
      </div>
    </section>

    <section class="similar-panel">
      <div class="section-title"><h2>相似案例</h2><strong id="case-count">—</strong></div>
      <div class="similar-head"><span>球员</span><span>相似率</span><span>受伤日期</span><span>受伤天数</span></div>
      <div class="similar-list" id="case-table"><div class="loading-inline">读取中</div></div>
    </section>
    <p class="player-source">实时状态：Big Balls Sports · 历史样本：European Football Injuries 2020–2025</p>`;
  return true;
}

function updateIdentity(profile) {
  if (!profile) return;
  player = {
    ...player,
    name: player.name || profile.name,
    team: player.team || profile.team_name,
    position: player.position || profile.position,
    headshot_url: profile.headshot_url || player.headshot_url,
  };
  sessionStorage.setItem('injury-player', JSON.stringify(player));
  document.querySelector('#identity-panel').querySelector('.detail-avatar').outerHTML = avatarMarkup(player);
  document.querySelector('#player-position').textContent = display(player.position);
  document.querySelector('#player-team').textContent = display(player.team);
}

function similarityScore(row) {
  let score = 82;
  if (player.position && row.player_position && row.player_position.toLowerCase().includes(player.position.toLowerCase())) score += 7;
  if (player.age && row.player_age) score += Math.max(0, 8 - Math.abs(Number(player.age) - Number(row.player_age)));
  return Math.min(96, score);
}

function renderCases(rows, hasInjuryType) {
  const table = document.querySelector('#case-table');
  const count = document.querySelector('#case-count');
  count.textContent = rows.length ? `${rows.length} 例` : '—';
  if (!hasInjuryType) {
    table.innerHTML = '<div class="empty-state compact">伤病类型确认后匹配</div>';
    return;
  }
  if (!rows.length) {
    table.innerHTML = '<div class="empty-state compact">暂无匹配案例</div>';
    return;
  }
  table.innerHTML = rows.map(row => `
    <article class="similar-row">
      <div class="similar-person">${avatarMarkup(row, 'case-avatar')}<span><strong>${escapeHtml(row.player_name)}</strong><small>${escapeHtml(display(row.club))}</small></span></div>
      <strong class="similarity">${similarityScore(row)}%</strong>
      <time>${formatDate(row.date_from)}</time>
      <strong>${row.days_missed ?? '—'} 天</strong>
    </article>`).join('');
}

function addDays(dateValue, days) {
  if (!dateValue || !days) return null;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;
  date.setDate(date.getDate() + days);
  return date;
}

function applyStats(stats, hasInjuryType) {
  const sample = Number(stats?.sample_size || 0);
  const average = Number(stats?.average_days_missed || 0);
  const minimum = Number(stats?.minimum_days_missed || 0);
  const maximum = Number(stats?.maximum_days_missed || 0);
  if (!hasInjuryType || !sample || !average) return;

  const low = Math.max(1, Math.round(average * .65));
  const high = Math.max(low, Math.round(average * 1.35));
  document.querySelector('#recovery-window').textContent = `${low}–${high} 天`;
  document.querySelector('#sample-size').textContent = `${sample} 例`;
  document.querySelector('#average-value').textContent = `${Math.round(average)} 天`;
  document.querySelector('#minimum-days').textContent = `${minimum} 天`;
  document.querySelector('#average-days').textContent = `${Math.round(average)} 天`;
  document.querySelector('#maximum-days').textContent = `${maximum} 天`;
  const marker = maximum > minimum ? ((average - minimum) / (maximum - minimum)) * 100 : 50;
  document.querySelector('#plot-marker').style.left = `${Math.min(92, Math.max(8, marker))}%`;
  document.querySelector('#plot-range').style.width = '100%';

  const from = addDays(player.injuryDate, low);
  const until = addDays(player.injuryDate, high);
  if (from && until) document.querySelector('#estimated-date').textContent = `${formatDate(from)} – ${formatDate(until)}`;
}

async function loadEvidence() {
  const term = injuryTerm(player.injury);
  const historyParams = new URLSearchParams({player: player.name, limit: '20'});
  const profileParams = new URLSearchParams({name: player.name});

  try {
    const [profileResponse, historyResponse] = await Promise.all([
      id.startsWith('fpl_') ? Promise.resolve(null) : fetch(`${apiBase}/api/player-search?${profileParams}`),
      fetch(`${apiBase}/api/history?${historyParams}`),
    ]);
    const [profilePayload, historyPayload] = await Promise.all([profileResponse ? profileResponse.json() : {}, historyResponse.json()]);
    const profiles = Array.isArray(profilePayload.data) ? profilePayload.data : [];
    updateIdentity(profiles[0]);

    if (!term) {
      renderCases([], false);
      applyStats({}, false);
      return;
    }

    const params = new URLSearchParams({injury: term, limit: '6'});
    if (player.age) params.set('age', player.age);
    if (display(player.position) !== '—') params.set('position', positionTerm(player.position));
    const [casesResponse, statsResponse] = await Promise.all([
      fetch(`${apiBase}/api/similar?${params}`),
      fetch(`${apiBase}/api/history/stats?${params}`),
    ]);
    const [casesPayload, statsPayload] = await Promise.all([casesResponse.json(), statsResponse.json()]);
    renderCases(Array.isArray(casesPayload.results) ? casesPayload.results : [], true);
    applyStats(statsPayload.stats || {}, true);
    void historyPayload;
  } catch (_error) {
    renderCases([], Boolean(term));
    applyStats({}, Boolean(term));
  }
}

if (initialPage()) loadEvidence();

