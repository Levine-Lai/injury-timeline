(() => {
  const tabs = [...document.querySelectorAll('[data-view]')];
  const currentView = document.querySelector('#current-view');
  const archiveView = document.querySelector('#archive-view');
  const regionRoot = document.querySelector('#archive-regions');
  const typeRoot = document.querySelector('#archive-types');
  const recordRoot = document.querySelector('#archive-records');
  const leagueSelect = document.querySelector('#archive-league');
  const searchForm = document.querySelector('#archive-search');
  const searchInput = document.querySelector('#archive-query');
  const archiveApiBase = (window.INJURY_API_BASE || '.').replace(/\/$/, '');
  let catalog = null;
  let selectedRegion = null;
  let selectedInjury = null;

  const escape = value => String(value ?? '').replace(/[&<>'"]/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[character]));
  const number = value => new Intl.NumberFormat('zh-CN').format(Number(value || 0));
  const formatDate = value => {
    if (!value) return '—';
    const parts = String(value).slice(0, 10).split('-');
    return parts.length === 3 ? `${parts[0]}.${Number(parts[1])}.${Number(parts[2])}` : value;
  };

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
      <button class="archive-type${type.injury_type === selectedInjury ? ' active' : ''}" data-injury="${escape(type.injury_type)}">
        <span><strong>${escape(type.injury_label)}</strong>${type.injury_label !== type.injury_type ? `<small>${escape(type.injury_type)}</small>` : ''}</span>
        <span><b>${number(type.cases)}</b><small>案例</small></span>
        <span><b>${number(type.average_days)}</b><small>平均天数</small></span>
      </button>`).join('') || '<div class="empty-state compact">暂无分类记录</div>';
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
        <span><strong>${escape(row.club || '—')}</strong><small>${escape(row.player_position || '位置未记录')}</small></span>
        <span><strong>${formatDate(row.date_from)} — ${formatDate(row.date_until)}</strong><small>${escape(row.injury_type)}</small></span>
        <span class="archive-days"><strong>${number(row.days_missed)} 天</strong><small>${row.games_missed == null ? '场次未记录' : `${number(row.games_missed)} 场`}</small></span>
        <span>${escape(row.league || '—')}</span>
      </article>`).join('');
  }

  async function loadCatalog() {
    regionRoot.innerHTML = '<div class="loading-state"><span></span>正在读取历史档案</div>';
    typeRoot.innerHTML = '';
    const params = new URLSearchParams();
    if (leagueSelect.value) params.set('league', leagueSelect.value);
    try {
      const response = await fetch(`${archiveApiBase}/api/history/archive?${params}`, {headers:{Accept:'application/json'}});
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      catalog = await response.json();
      selectedRegion = catalog.data.categories[0]?.id || null;
      selectedInjury = null;
      document.querySelector('#archive-total').textContent = `${number(catalog.meta.classified_cases)} 个已结束案例`;
      renderRegions();
      renderTypes();
      document.querySelector('#archive-record-title').textContent = '案例记录';
      document.querySelector('#archive-record-count').textContent = '选择伤病类型';
      recordRoot.innerHTML = '<div class="empty-state">选择伤病类型查看案例</div>';
    } catch (_error) {
      regionRoot.innerHTML = '<div class="empty-state">历史档案暂时不可用</div>';
      document.querySelector('#archive-total').textContent = '读取失败';
    }
  }

  async function loadRecords({ injury = '', query = '' } = {}) {
    const params = new URLSearchParams({ limit: '50' });
    if (leagueSelect.value) params.set('league', leagueSelect.value);
    if (injury) params.set('injury', injury);
    if (query) params.set('q', query);
    recordRoot.innerHTML = '<div class="loading-state"><span></span>正在读取案例</div>';
    try {
      const response = await fetch(`${archiveApiBase}/api/history/archive?${params}`, {headers:{Accept:'application/json'}});
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      const type = catalog?.data.types.find(item => item.injury_type === injury);
      renderRecords(payload.results || [], query ? `“${query}”的伤病档案` : (type?.injury_label || injury), (payload.results || []).length === 50);
    } catch (_error) {
      recordRoot.innerHTML = '<div class="empty-state">案例记录暂时不可用</div>';
    }
  }

  tabs.forEach(tab => tab.addEventListener('click', () => setView(tab.dataset.view)));
  regionRoot.addEventListener('click', event => {
    const button = event.target.closest('[data-region]');
    if (!button) return;
    selectedRegion = button.dataset.region;
    selectedInjury = null;
    renderRegions();
    renderTypes();
    document.querySelector('#archive-record-title').textContent = '案例记录';
    document.querySelector('#archive-record-count').textContent = '选择伤病类型';
    recordRoot.innerHTML = '<div class="empty-state">选择伤病类型查看案例</div>';
  });
  typeRoot.addEventListener('click', event => {
    const button = event.target.closest('[data-injury]');
    if (!button) return;
    selectedInjury = button.dataset.injury;
    renderTypes();
    loadRecords({ injury: selectedInjury });
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
    selectedInjury = null;
    if (catalog) renderTypes();
    loadRecords({ query });
  });

  setView(new URLSearchParams(window.location.search).get('view') === 'archive' ? 'archive' : 'current', false);
})();
