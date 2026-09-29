(() => {
  const cases = [
    {
      ids: ['15022', '6815'],
      initials: 'SM',
      player: 'Scott McTominay',
      club: '那不勒斯',
      position: '中场',
      season: '2024/25',
      period: '2025.06.06—结束日未核实',
      diagnosis: '轻度膝关节扭伤（主帅表述）',
      status: '已结束',
      missed: '1场国家队比赛',
      confidence: '较高',
      confidenceClass: '',
      mechanism: '对阵冰岛后出现跛行；具体受伤动作未公开',
      examination: '影像检查及韧带结构未公开',
      treatment: '休息观察；未见手术或固定治疗报道',
      returnPoint: '数据库记为6月14日；没有正式比赛复出节点可核验',
      summary: '公开信息支持“轻度膝关节扭伤”，但不足以判断具体韧带或软骨结构。球员退出苏格兰队六月集训并缺席对列支敦士登的友谊赛，随后进入休赛期，因此数据库结束日期更像登记日期，而不是经比赛验证的复出日期。',
      corrections: [
        ['球队归属', '受伤时球员效力那不勒斯；曼联条目属于跨联赛重复记录，应合并到同一案例。'],
        ['起始日期', '数据库从6月8日计算；比赛及报道显示问题出现在6月6日对冰岛之后。'],
        ['诊断粒度', '“膝部问题”可提升为“轻度膝关节扭伤”，但不能进一步写成某条韧带损伤。'],
      ],
      evidence: [
        ['2025.06.08', '苏格兰足协', '确认McTominay带有轻微问题并将缺席下一场比赛，主教练强调问题较轻。', 'https://www.scottishfa.co.uk/en/news/scotland-round-off-camp-with-liechtenstein-friendly'],
        ['2025.06.08', '意大利天空体育', '报道球员对冰岛赛后明显跛行并退出国家队集训。', 'https://sport.sky.it/calcio/serie-a/2025/06/08/mctominay-scozia-infortunio-napoli-news'],
        ['2025.06.09', '全市场网', '转述主教练发布会，将伤势描述为轻度膝关节扭伤并伴有疼痛。', 'https://www.tuttomercatoweb.com/serie-a/scozia-il-ct-clarke-su-mctominay-ha-subito-una-leggera-distorsione-al-ginocchio-2112209'],
      ],
    },
    {
      ids: ['11001'],
      initials: 'BB',
      player: 'Bradley Barcola',
      club: '巴黎圣日耳曼',
      position: '左边锋',
      season: '2024/25',
      period: '2025.06.05—06.20',
      diagnosis: '右膝不适，具体结构未公开',
      status: '已结束',
      missed: '至少1场国家队比赛',
      confidence: '高',
      confidenceClass: '',
      mechanism: '法国对西班牙比赛后出现跛行；具体接触动作未公开',
      examination: '仅确认右膝伤情，未公开影像或结构性诊断',
      treatment: '短期减量及单独训练，随后恢复合练',
      returnPoint: '6月13日恢复合练；6月15日进入名单；最迟6月20日恢复出场',
      summary: '这是一次短期右膝问题，公开报道没有支持ACL、半月板等结构性损伤。球员6月13日已恢复全队训练，6月15日进入世俱杯比赛名单，并在6月20日对博塔弗戈出场，因此历史库记录到6月29日、24天和缺席5场明显偏长。',
      corrections: [
        ['结束日期', '数据库记为6月29日；比赛报道显示球员最迟已于6月20日恢复出场。'],
        ['缺席场次', '可确认缺席法国对德国的比赛；“缺席5场”与随后世俱杯出场记录不一致。'],
        ['诊断粒度', '可确认右膝不适，但没有公开到韧带、半月板或软骨层级。'],
      ],
      evidence: [
        ['2025.06.06', '队报', '记录球员赛后跛行、膝部受伤并缺席法国队合练。', 'https://www.lequipe.fr/Football/Actualites/Bradley-barcola-touche-a-un-genou-et-incertain-contre-l-allemagne-en-ligue-des-nations/1568193'],
        ['2025.06.06', '阿斯报', '进一步明确为右膝伤情，并确认缺席对德国的比赛。', 'https://as.com/futbol/internacional/se-caen-dembele-y-barcola-problemas-para-luis-enrique-n/'],
        ['2025.06.13', '队报', '确认球员在世俱杯首战前两天恢复巴黎圣日耳曼全队训练。', 'https://www.lequipe.fr/Football/Actualites/Bradley-barcola-a-retrouve-le-groupe-du-psg-avant-la-rencontre-face-a-l-atletico-en-coupe-du-monde-des-clubs/1570014'],
        ['2025.06.20', '世界报', '比赛报道记录球员在对博塔弗戈一战替补出场，构成实际复出证据。', 'https://www.lemonde.fr/sport/article/2025/06/20/psg-botafago-les-parisiens-concedent-une-defaite-surprise-0-1-a-la-coupe-du-monde-des-clubs_6614748_3242.html'],
      ],
    },
    {
      ids: ['3371', '3846'],
      initials: 'SÖ',
      player: 'Salih Özcan',
      club: '多特蒙德',
      position: '后腰',
      season: '2024/25',
      period: '2025.06.04—07.28之后',
      diagnosis: '伤病部位存在公开来源冲突',
      status: '待人工审核',
      missed: '缺席世俱杯',
      confidence: '冲突',
      confidenceClass: 'conflict',
      mechanism: '土耳其国家队期间受伤；具体动作未公开',
      examination: '多特官方称大腿后侧伤；其他记录称膝伤或外侧副韧带伤',
      treatment: '康复训练；检查和治疗方案未公开',
      returnPoint: '7月28日已参加多特训练；完整恢复日期仍需核对',
      summary: '这条案例不能直接确定为膝伤。多特蒙德官方在6月10日明确写为大腿后侧伤，而历史数据库和部分二手资料写为膝伤或外侧副韧带伤。正式档案应保留冲突状态，等待更多一手信息，而不是自动合并为某种膝韧带损伤。',
      corrections: [
        ['球队归属', '球员已于2025年1月结束沃尔夫斯堡租借并回到多特蒙德；沃尔夫斯堡条目是重复归属。'],
        ['伤病类型', '官方来源与历史库冲突，暂不应进入“膝伤”统计模型。'],
        ['结束日期', '数据库记为7月15日，但7月中旬仍有康复报道；7月28日训练照片提供了更晚的回归节点。'],
      ],
      evidence: [
        ['2025.01.28', '多特蒙德', '官方确认球员结束沃尔夫斯堡租借并回到多特蒙德。', 'https://www.bvb.de/de/de/aktuelles/news/news.html/2025/1/28/BVB-holt-Salih-Oezcan-zurueck.html'],
        ['2025.06.10', '多特蒙德', '官方确认球员在土耳其国家队期间遭遇大腿后侧伤，并缺席世俱杯。', 'https://www.bvb.de/de/en/news/news-overview/news.html/2025/6/10/BVB-to-travel-to-the-Club-World-Cup-without-Can-and-Oezcan.html'],
        ['2025.07.15', '历史数据来源', '记录为膝伤、42天和7场，与俱乐部官方伤病部位不一致。', 'https://www.transfermarkt.com/salih-ozcan/verletzungen/spieler/244940'],
        ['2025.07.31', 'RotoWire', '二手报道将其描述为外侧副韧带伤，并称球员已恢复全队训练。', 'https://www.rotowire.com/soccer/headlines/salih-ozcan-news-returns-in-friendly-468971'],
      ],
    },
  ];

  const escape = value => String(value ?? '').replace(/[&<>'"]/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[character]));
  const id = new URLSearchParams(window.location.search).get('id');
  const record = cases.find(item => item.ids.includes(id));
  const root = document.querySelector('#case-root');

  if (!record) {
    root.innerHTML = '<section class="case-section"><h1>案例不存在</h1><p class="case-summary">该案例尚未完成公开来源核查。</p></section>';
    return;
  }

  document.title = `${record.player}｜伤病案例｜伤停线`;
  root.innerHTML = `
    <div class="case-breadcrumb"><a href="./index.html?view=archive">历史档案</a></div>
    <section class="case-identity">
      <div class="case-name"><div class="case-avatar">${escape(record.initials)}</div><div><h1>${escape(record.player)}</h1><p>${escape(record.club)} · ${escape(record.position)} · ${escape(record.season)}</p></div></div>
      <div class="case-fact"><span>公开诊断</span><strong>${escape(record.diagnosis)}</strong></div>
      <div class="case-fact"><span>伤病周期</span><strong>${escape(record.period)}</strong></div>
      <div class="case-fact"><span>档案状态</span><strong>${escape(record.status)}</strong></div>
    </section>

    <section class="case-section">
      <h2>核查结论</h2>
      <div class="case-verdict">
        <div class="case-metric"><span>受伤经过</span><strong>${escape(record.mechanism)}</strong></div>
        <div class="case-metric"><span>检查结果</span><strong>${escape(record.examination)}</strong></div>
        <div class="case-metric"><span>处理方式</span><strong>${escape(record.treatment)}</strong></div>
        <div class="case-metric"><span>回归节点</span><strong class="case-ok">${escape(record.returnPoint)}</strong></div>
      </div>
      <p class="case-summary">${escape(record.summary)}</p>
      <span class="case-confidence ${escape(record.confidenceClass)}">证据可信度：${escape(record.confidence)}</span>
    </section>

    <section class="case-section">
      <h2>数据库核对</h2>
      ${record.corrections.map(item => `<div class="case-correction"><strong>${escape(item[0])}</strong><span>${escape(item[1])}</span></div>`).join('')}
    </section>

    <section class="case-section">
      <h2>证据时间线</h2>
      ${record.evidence.map(item => `<div class="case-evidence"><time>${escape(item[0])}</time><span><strong>${escape(item[1])}</strong><small>${escape(item[2])}</small></span><a href="${escape(item[3])}" target="_blank" rel="noopener noreferrer">查看来源</a></div>`).join('')}
    </section>
    <p class="case-footer">档案仅整理公开信息；未公开的影像检查、医疗处置和诊断结构保持为空。</p>`;
})();
