(() => {
  const tabs = [...document.querySelectorAll('[data-view]')];
  const currentView = document.querySelector('#current-view');
  const archiveView = document.querySelector('#archive-view');
  const regionRoot = document.querySelector('#archive-regions');
  const typeRoot = document.querySelector('#archive-types');
  const recordRoot = document.querySelector('#archive-records');
  const chartPanel = document.querySelector('#archive-chart-panel');
  const chartRoot = document.querySelector('#archive-chart');
  const leagueSelect = document.querySelector('#archive-league');
  const searchForm = document.querySelector('#archive-search');
  const searchInput = document.querySelector('#archive-query');
  const archiveApiBase = (window.INJURY_API_BASE || '.').replace(/\/$/, '');
  let catalog = null;
  let selectedRegion = null;
  let selectedTypeId = null;

  const escape = value => String(value ?? '').replace(/[&<>'"]/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[character]));
  const number = value => new Intl.NumberFormat('zh-CN').format(Number(value || 0));
  const formatDate = value => {
    if (!value) return '—';
    const parts = String(value).slice(0, 10).split('-');
    return parts.length === 3 ? `${parts[0]}.${Number(parts[1])}.${Number(parts[2])}` : value;
  };
  const positionNames = {
    Goalkeeper:'门将', Defender:'后卫', Midfielder:'中场', Forward:'前锋',
    'Centre-Back':'中后卫', 'Left-Back':'左后卫', 'Right-Back':'右后卫',
    'Defensive Midfield':'后腰', 'Central Midfield':'中场', 'Attacking Midfield':'前腰',
    'Left Midfield':'左中场', 'Right Midfield':'右中场', 'Left Winger':'左边锋',
    'Right Winger':'右边锋', 'Centre-Forward':'中锋', 'Second Striker':'影锋',
  };
  const leagueNames = {'Premier League':'英超', 'La Liga':'西甲', Bundesliga:'德甲', 'Serie A':'意甲', 'Ligue 1':'法甲'};

  function hideChart() {
    chartPanel.hidden = true;
    chartRoot.innerHTML = '';
  }

  function percentile(distribution, fraction) {
    const total = distribution.reduce((sum, item) => sum + Number(item.cases || 0), 0);
    const target = total * fraction;
    let cumulative = 0;
    for (const item of distribution) {
      cumulative += Number(item.cases || 0);
      if (cumulative >= target) return Number(item.days_missed || 0);
    }
    return Number(distribution.at(-1)?.days_missed || 0);
  }

  function renderChart(type, distribution, stats) {
    if (!distribution.length || !stats?.sample_size) {
      hideChart();
      return;
    }
    const width = 900;
    const height = 220;
    const left = 48;
    const right = 24;
    const top = 20;
    const baseline = 174;
    const plotWidth = width - left - right;
    const binCount = 24;
    const observedMax = Number(stats.maximum_days || 0);
    const p97 = percentile(distribution, .97);
    const step = p97 <= 90 ? 10 : p97 <= 180 ? 15 : 30;
    const xMax = Math.max(step * 3, Math.ceil(p97 / step) * step);
    const bins = Array(binCount).fill(0);
    distribution.forEach(item => {
      const days = Number(item.days_missed || 0);
      const index = Math.min(binCount - 1, Math.floor((days / xMax) * binCount));
      bins[index] += Number(item.cases || 0);
    });
    const yMax = Math.max(...bins, 1);
    const points = bins.map((count, index) => ({
      x: left + (index / (binCount - 1)) * plotWidth,
      y: baseline - (count / yMax) * (baseline - top),
    }));
    let line = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
    for (let index = 1; index < points.length; index += 1) {
      const previous = points[index - 1];
      const point = points[index];
      const middle = (previous.x + point.x) / 2;
      line += ` C ${middle.toFixed(1)} ${previous.y.toFixed(1)}, ${middle.toFixed(1)} ${point.y.toFixed(1)}, ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
    }
    const area = `${line} L ${points.at(-1).x.toFixed(1)} ${baseline} L ${points[0].x.toFixed(1)} ${baseline} Z`;
    const average = Number(stats.average_days || 0);
    const averageX = left + Math.min(average / xMax, 1) * plotWidth;
    const median = percentile(distribution, .5);
    const ticks = [0, .25, .5, .75, 1].map(fraction => {
      const x = left + fraction * plotWidth;
      const value = Math.round(xMax * fraction);
      const label = fraction === 1 && observedMax > xMax ? `≥${value}天` : `${value}天`;
      return `<line x1="${x}" y1="${top}" x2="${x}" y2="${baseline}" class="chart-grid"/><text x="${x}" y="204" text-anchor="middle">${label}</text>`;
    }).join('');
    document.querySelector('#archive-chart-title').textContent = `${type.injury_label} · 缺阵天数分布`;
    document.querySelector('#archive-average').textContent = `平均 ${number(average)} 天`;
    chartRoot.innerHTML = `
      <figure class="injury-wave" aria-label="${escape(type.injury_label)}缺阵天数分布，平均${number(average)}天">
        <svg viewBox="0 0 ${width} ${height}" role="img">
          <title>${escape(type.injury_label)}缺阵天数分布</title>
          ${ticks}
          <line x1="${left}" y1="${baseline}" x2="${width - right}" y2="${baseline}" class="chart-axis"/>
          <path d="${area}" class="wave-area"/>
          <path d="${line}" class="wave-line"/>
          <line x1="${averageX}" y1="${top}" x2="${averageX}" y2="${baseline}" class="average-line"/>
          <text x="${Math.min(averageX + 7, width - 86)}" y="34" class="average-label">平均 ${number(average)} 天</text>
          <g class="hover-guide" hidden>
            <line x1="${left}" y1="${top}" x2="${left}" y2="${baseline}" class="hover-line"/>
            <circle cx="${left}" cy="${baseline}" r="5" class="hover-point"/>
            <g class="hover-tooltip">
              <rect x="0" y="0" width="154" height="32" rx="6"/>
              <text x="12" y="21">—</text>
            </g>
          </g>
          <rect x="${left}" y="${top}" width="${plotWidth}" height="${baseline - top}" class="chart-hit-area"/>
        </svg>
        <figcaption><span>样本 ${number(stats.sample_size)} 例</span><span>中位数 ${number(median)} 天</span><span>最长 ${number(stats.maximum_days)} 天</span></figcaption>
      </figure>`;
    const svg = chartRoot.querySelector('svg');
    const hitArea = svg.querySelector('.chart-hit-area');
    const guide = svg.querySelector('.hover-guide');
    const guideLine = guide.querySelector('.hover-line');
    const guidePoint = guide.querySelector('.hover-point');
    const tooltip = guide.querySelector('.hover-tooltip');
    const tooltipText = tooltip.querySelector('text');
    const moveGuide = event => {
      const bounds = svg.getBoundingClientRect();
      const viewX = Math.min(width - right, Math.max(left, ((event.clientX - bounds.left) / bounds.width) * width));
      const position = ((viewX - left) / plotWidth) * (binCount - 1);
      const lowIndex = Math.floor(position);
      const highIndex = Math.min(binCount - 1, Math.ceil(position));
      const mix = position - lowIndex;
      const pointY = points[lowIndex].y + (points[highIndex].y - points[lowIndex].y) * mix;
      const binIndex = Math.min(binCount - 1, Math.max(0, Math.floor(((viewX - left) / plotWidth) * binCount)));
      const rangeStart = Math.round((binIndex / binCount) * xMax);
      const rangeEnd = Math.round(((binIndex + 1) / binCount) * xMax);
      const rangeLabel = binIndex === binCount - 1 && observedMax > xMax ? `≥${rangeStart} 天` : `${rangeStart}–${rangeEnd} 天`;
      guideLine.setAttribute('x1', viewX.toFixed(1));
      guideLine.setAttribute('x2', viewX.toFixed(1));
      guidePoint.setAttribute('cx', viewX.toFixed(1));
      guidePoint.setAttribute('cy', pointY.toFixed(1));
      tooltip.setAttribute('transform', `translate(${Math.min(width - right - 154, Math.max(left, viewX + (viewX > width - 210 ? -164 : 10)))}, ${top + 7})`);
      tooltipText.textContent = `${rangeLabel} · ${number(bins[binIndex])} 例`;
      guide.removeAttribute('hidden');
    };
    hitArea.addEventListener('pointerenter', moveGuide);
    hitArea.addEventListener('pointermove', moveGuide);
    hitArea.addEventListener('pointerleave', () => { guide.setAttribute('hidden', ''); });
    chartPanel.hidden = false;
  }

  function setView(view, updateUrl = true) {
    const archiveActive = view === 'archive';
    currentView.hidden = archiveActive;
    archiveView.hidden = !archiveActive;
    tabs.forEach(tab => {
      const active = tab.dataset.view === view;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', String(active));
    });
    if (updateUrl) {
      const url = new URL(window.location.href);
      if (archiveActive) url.searchParams.set('view', 'archive');
      else url.searchParams.delete('view');
      window.history.replaceState({}, '', url);
    }
    if (archiveActive && !catalog) loadCatalog();
  }

  function renderRegions() {
    regionRoot.innerHTML = catalog.data.categories.map(region => `
      <button class="archive-region${region.id === selectedRegion ? ' active' : ''}" data-region="${escape(region.id)}" aria-pressed="${region.id === selectedRegion}">
        <strong>${escape(region.label)}</strong>
        <span>${number(region.cases)} 例</span>
      </button>`).join('');
  }

  function renderTypes() {
    const types = catalog.data.types.filter(type => type.category_id === selectedRegion);
    document.querySelector('#archive-types-title').textContent = catalog.data.categories.find(region => region.id === selectedRegion)?.label || '伤病类型';
    document.querySelector('#archive-type-count').textContent = `${types.length} 种`;
    typeRoot.innerHTML = types.map(type => `
      <button class="archive-type${type.type_id === selectedTypeId ? ' active' : ''}" data-type-id="${escape(type.type_id)}">
        <span><strong>${escape(type.injury_label)}</strong>${type.review_required ? '<small>待审核</small>' : ''}</span>
        <span><b>${number(type.cases)}</b><small>案例</small></span>
        <span><b>${number(type.average_days)}</b><small>平均天数</small></span>
      </button>`).join('') || '<div class="empty-state compact">暂无分类记录</div>';
  }

  function firstTypeInRegion() {
    return catalog?.data.types.find(type => type.category_id === selectedRegion) || null;
  }

  function selectFirstType() {
    const type = firstTypeInRegion();
    selectedTypeId = type?.type_id || null;
    renderTypes();
    if (type) loadRecords({ type });
    else {
      hideChart();
      document.querySelector('#archive-record-title').textContent = '案例记录';
      document.querySelector('#archive-record-count').textContent = '暂无记录';
      recordRoot.innerHTML = '<div class="empty-state">暂无案例</div>';
    }
  }

  function renderRecords(rows, heading, hasMore = false) {
    document.querySelector('#archive-record-title').textContent = heading;
    document.querySelector('#archive-record-count').textContent = hasMore ? `显示前 ${rows.length} 条` : `${rows.length} 条`;
    if (!rows.length) {
      recordRoot.innerHTML = '<div class="empty-state">没有匹配的已结束案例</div>';
      return;
    }
    recordRoot.innerHTML = rows.map(row => `
      <article class="archive-record">
        <span class="archive-person"><strong>${escape(row.player_name)}</strong><small>${escape(row.season || '—')}</small></span>
        <span><strong>${escape(row.club || '—')}</strong><small>${escape(positionNames[row.player_position] || row.player_position || '位置未记录')}</small></span>
        <span><strong>${formatDate(row.date_from)} — ${formatDate(row.date_until)}</strong><small>${escape(row.injury_label || '伤病类型待审核')}</small></span>
        <span class="archive-days"><strong>${number(row.days_missed)} 天</strong><small>${row.games_missed == null ? '场次未记录' : `${number(row.games_missed)} 场`}</small></span>
        <span>${escape(leagueNames[row.league] || row.league || '—')}</span>
      </article>`).join('');
  }

  async function loadCatalog() {
    regionRoot.innerHTML = '<div class="loading-state"><span></span>正在读取历史档案</div>';
    typeRoot.innerHTML = '';
    const params = new URLSearchParams({ schema: '20260921-2' });
    if (leagueSelect.value) params.set('league', leagueSelect.value);
    try {
      const response = await fetch(`${archiveApiBase}/api/history/archive?${params}`, {cache:'no-store', headers:{Accept:'application/json'}});
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      catalog = await response.json();
      selectedRegion = catalog.data.categories[0]?.id || null;
      selectedTypeId = null;
      document.querySelector('#archive-total').textContent = `${number(catalog.meta.classified_cases)} 个已结束案例`;
      renderRegions();
      selectFirstType();
    } catch (_error) {
      regionRoot.innerHTML = '<div class="empty-state">历史档案暂时不可用</div>';
      document.querySelector('#archive-total').textContent = '读取失败';
    }
  }

  async function loadRecords({ type = null, query = '' } = {}) {
    const params = new URLSearchParams({ limit: '50', schema: '20260921-2' });
    if (leagueSelect.value) params.set('league', leagueSelect.value);
    if (type) type.raw_labels.forEach(label => params.append('injury', label));
    if (query) params.set('q', query);
    hideChart();
    recordRoot.innerHTML = '<div class="loading-state"><span></span>正在读取案例</div>';
    try {
      const response = await fetch(`${archiveApiBase}/api/history/archive?${params}`, {cache:'no-store', headers:{Accept:'application/json'}});
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      if (type) renderChart(type, payload.distribution || [], payload.stats);
      else hideChart();
      renderRecords(payload.results || [], query ? `“${query}”的伤病档案` : type.injury_label, (payload.results || []).length === 50);
    } catch (_error) {
      recordRoot.innerHTML = '<div class="empty-state">案例记录暂时不可用</div>';
    }
  }

  tabs.forEach(tab => tab.addEventListener('click', () => setView(tab.dataset.view)));
  regionRoot.addEventListener('click', event => {
    const button = event.target.closest('[data-region]');
    if (!button) return;
    selectedRegion = button.dataset.region;
    selectedTypeId = null;
    renderRegions();
    selectFirstType();
  });
  typeRoot.addEventListener('click', event => {
    const button = event.target.closest('[data-type-id]');
    if (!button) return;
    selectedTypeId = button.dataset.typeId;
    const type = catalog.data.types.find(item => item.type_id === selectedTypeId);
    if (!type) return;
    renderTypes();
    loadRecords({ type });
  });
  leagueSelect.addEventListener('change', () => {
    catalog = null;
    searchInput.value = '';
    loadCatalog();
  });
  searchForm.addEventListener('submit', event => {
    event.preventDefault();
    const query = searchInput.value.trim();
    if (query.length < 2) return;
    selectedTypeId = null;
    if (catalog) renderTypes();
    hideChart();
    loadRecords({ query });
  });

  setView(new URLSearchParams(window.location.search).get('view') === 'archive' ? 'archive' : 'current', false);
})();
