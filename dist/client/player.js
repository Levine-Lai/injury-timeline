const apiBase = (window.INJURY_API_BASE || '.').replace(/\/$/, '');
const id = new URLSearchParams(location.search).get('id') || '';
let player = null;
try {
  const stored = JSON.parse(sessionStorage.getItem('injury-player') || 'null');
  if (stored && String(stored.id) === String(id)) player = stored;
} catch (_error) {}

function escapeHtml(value='') {
  return String(value).replace(/[&<>'"]/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[character]));
}

function injuryTerm(reason='') {
  const chineseTerms = [
    ['腿筋','hamstring'],['脚踝','ankle'],['膝','knee'],['腹股沟','groin'],
    ['小腿','calf'],['大腿','thigh'],['背','back'],['髋','hip'],['足','foot'],
    ['肌肉','muscle'],['肩','shoulder'],['跟腱','achilles'],['骨折','fracture'],
  ];
  const translated = chineseTerms.find(([label]) => reason.includes(label));
  if (translated) return translated[1];
  const terms = ['hamstring','ankle','knee','groin','calf','thigh','back','hip','foot','muscle','shoulder','achilles','fracture'];
  const lower = reason.toLowerCase();
  return terms.find(term => lower.includes(term)) || reason.split(/[,(\-/]/)[0].trim() || 'injury';
}

function severityLabel(value) { return value === 'high' ? '高风险' : value === 'medium' ? '中等' : '轻微'; }

function initialPage() {
  const root = document.querySelector('#player-page');
  if (!player) {
    root.innerHTML = '<section class="player-card missing-player"><h1>未找到球员信息</h1><p>请从首页的实时缺阵列表重新进入。</p><a class="back-link" href="./index.html">返回首页</a></section>';
    return false;
  }
  document.title = `${player.name}｜伤停线`;
  root.innerHTML = `
    <nav class="breadcrumb" aria-label="面包屑"><a href="./index.html">球员</a><span>›</span><span>${escapeHtml(player.name)}</span></nav>
    <section class="player-profile">
      <div class="profile-main"><span class="profile-avatar" style="--club:${player.club}">${escapeHtml(player.initials)}</span><div><span class="team-pill">${escapeHtml(player.team)}</span><h1>${escapeHtml(player.name)}</h1><p>${escapeHtml(player.position)}${player.age ? ` · ${escapeHtml(player.age)} 岁` : ''}</p></div></div>
      <div class="source-chip"><span>缺阵数据</span><strong>Big Balls Sports</strong><small>${escapeHtml(player.reported)}</small></div>
    </section>
    <section class="injury-summary">
      <div class="injury-title"><div><span class="severity ${player.severity}">${severityLabel(player.severity)}</span><h2>${escapeHtml(player.injury)}</h2><p>${escapeHtml(player.note)}</p></div><div class="return-window"><span>预计恢复区间</span><strong id="estimated-window">${escapeHtml(player.days)}</strong></div></div>
      <div class="metric-row"><article><span>连续缺阵</span><strong>${escapeHtml(player.absenceCount || 1)} 场</strong></article><article><span>历史样本</span><strong id="sample-size">读取中</strong></article><article><span>历史平均缺阵</span><strong id="average-days">读取中</strong></article><article><span>数据状态</span><strong>已同步</strong></article></div>
    </section>
    <div class="player-columns">
      <section class="player-card"><div class="card-head"><h2>恢复周期参考</h2><span>相同伤病历史分布</span></div><div class="recovery-scale"><div class="scale-band"></div><i id="scale-marker" style="left:50%"></i><div class="scale-label"><span id="minimum-days">—</span><span>历史平均</span><span id="maximum-days">—</span></div></div><div class="evidence-list"><p><span>推测依据</span><strong>伤病类型、位置与年龄</strong></p><p><span>预测性质</span><strong>统计参考，非医学结论</strong></p></div></section>
      <section class="player-card"><div class="card-head"><h2>相似伤病案例</h2><span id="case-count">正在匹配</span></div><div class="case-table" id="case-table"><div class="loading-inline">读取历史样本</div></div></section>
    </div>
    <section class="player-card history-card"><div class="card-head"><h2>${escapeHtml(player.name)} 的历史伤病</h2><span>五大联赛历史库</span></div><div id="history-table"><div class="loading-inline">正在查询</div></div></section>
    <p class="player-disclaimer">缺阵记录来自比赛缺席数据；恢复周期来自历史样本统计，不代表俱乐部或医疗结论。</p>`;
  return true;
}

function renderHistory(rows) {
  const table = document.querySelector('#history-table');
  if (!rows.length) { table.innerHTML = '<div class="empty-state compact">历史库中暂无同名记录</div>'; return; }
  table.innerHTML = '<div class="table-row table-head"><span>赛季</span><span>伤病</span><span>缺阵天数</span><span>场次</span></div>' + rows.map(row => `<div class="table-row"><span>${escapeHtml(row.season)}</span><strong>${escapeHtml(row.injury_type)}</strong><span>${row.days_missed ?? '—'} 天</span><span>${row.games_missed ?? '—'} 场</span></div>`).join('');
}

function renderCases(rows) {
  const table = document.querySelector('#case-table');
  document.querySelector('#case-count').textContent = `${rows.length} 个案例`;
  if (!rows.length) { table.innerHTML = '<div class="empty-state compact">暂无足够的相似案例</div>'; return; }
  table.innerHTML = rows.map((row,index) => `<div><b>${String(index+1).padStart(2,'0')}</b><span><strong>${escapeHtml(row.player_name)}</strong><small>${escapeHtml(row.club)} · ${escapeHtml(row.injury_type)}</small></span><strong>${row.days_missed ?? '—'} 天</strong><em>${row.games_missed ?? '—'} 场</em></div>`).join('');
}

function applyStats(stats) {
  const sample = Number(stats?.sample_size || 0);
  const average = Number(stats?.average_days_missed || 0);
  const minimum = Number(stats?.minimum_days_missed || 0);
  const maximum = Number(stats?.maximum_days_missed || 0);
  document.querySelector('#sample-size').textContent = sample ? `${sample} 例` : '样本不足';
  document.querySelector('#average-days').textContent = average ? `${average} 天` : '—';
  document.querySelector('#minimum-days').textContent = minimum ? `${minimum} 天` : '—';
  document.querySelector('#maximum-days').textContent = maximum ? `${maximum} 天` : '—';
  if (average) document.querySelector('#estimated-window').textContent = `${Math.max(1,Math.round(average * .65))}–${Math.round(average * 1.35)} 天`;
  if (average && maximum > minimum) document.querySelector('#scale-marker').style.left = `${Math.min(90,Math.max(10,(average-minimum)/(maximum-minimum)*100))}%`;
}

async function loadEvidence() {
  const term = injuryTerm(player.injury);
  const params = new URLSearchParams({injury:term,limit:'6'});
  if (player.age) params.set('age', player.age);
  const historyParams = new URLSearchParams({player:player.name,limit:'20'});
  try {
    const [historyResponse, casesResponse, statsResponse] = await Promise.all([
      fetch(`${apiBase}/api/history?${historyParams}`),
      fetch(`${apiBase}/api/similar?${params}`),
      fetch(`${apiBase}/api/history/stats?injury=${encodeURIComponent(term)}`),
    ]);
    const [historyPayload,casesPayload,statsPayload] = await Promise.all([historyResponse.json(),casesResponse.json(),statsResponse.json()]);
    renderHistory(Array.isArray(historyPayload.results) ? historyPayload.results : []);
    renderCases(Array.isArray(casesPayload.results) ? casesPayload.results : []);
    applyStats(statsPayload.stats || {});
  } catch (_error) {
    renderHistory([]); renderCases([]); applyStats({});
  }
}

if (initialPage()) loadEvidence();

