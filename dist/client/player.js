const playerRecords={
1:{id:1,name:'Bukayo Saka',initials:'BS',team:'Arsenal',club:'#d51f35',position:'右边锋',age:25,injury:'腿筋拉伤',area:'大腿后侧',severity:'medium',return:'9月28日—10月5日',days:'14–21 天',confidence:'72%',updated:'今天 09:40',note:'训练中感到不适，等待进一步评估',history:[['2024/25','小腿受伤','18 天','3 场'],['2023/24','轻微撞伤','7 天','1 场'],['2022/23','脚踝不适','10 天','2 场']],cases:[['Mohamed Salah','腿筋','17 天','84%'],['Phil Foden','腿筋','21 天','79%'],['Jarrod Bowen','大腿后侧','15 天','73%']]},
2:{id:2,name:'Cole Palmer',initials:'CP',team:'Chelsea',club:'#1450a3',position:'前腰',age:24,injury:'腹股沟不适',area:'内收肌群',severity:'low',return:'本周末待定',days:'3–7 天',confidence:'64%',updated:'今天 08:15',note:'已恢复部分合练，赛前评估',history:[['2025/26','腹股沟不适','6 天','1 场'],['2024/25','撞击伤','4 天','0 场']],cases:[['James Maddison','腹股沟','6 天','77%'],['Martin Ødegaard','内收肌','4 天','71%'],['Bruno Fernandes','轻微不适','0 天','66%']]},
3:{id:3,name:'Alexander Isak',initials:'AI',team:'Liverpool',club:'#e5484d',position:'中锋',age:27,injury:'脚踝扭伤',area:'右脚踝',severity:'high',return:'10月19日—11月2日',days:'28–42 天',confidence:'81%',updated:'昨天 21:10',note:'比赛中受伤离场，预计缺席多轮',history:[['2025/26','腹股沟受伤','31 天','5 场'],['2024/25','脚趾受伤','12 天','2 场'],['2023/24','脚踝扭伤','32 天','5 场']],cases:[['Darwin Núñez','脚踝','29 天','88%'],['Gabriel Jesus','脚踝','35 天','82%'],['Ollie Watkins','脚踝','24 天','75%']]},
4:{id:4,name:'Rodri',initials:'RO',team:'Manchester City',club:'#45a1e8',position:'后腰',age:30,injury:'膝部恢复',area:'右膝',severity:'medium',return:'10月5日—10月12日',days:'18–25 天',confidence:'69%',updated:'昨天 17:35',note:'个人训练阶段，复出后预计限制时间',history:[['2025/26','膝部受伤','41 天','7 场'],['2024/25','肌肉疲劳','9 天','2 场']],cases:[['Declan Rice','膝部','20 天','76%'],['Thomas Partey','膝部','26 天','70%'],['Casemiro','膝部','18 天','65%']]},
5:{id:5,name:'Cristian Romero',initials:'CR',team:'Tottenham',club:'#2979e2',position:'中后卫',age:28,injury:'小腿拉伤',area:'左小腿',severity:'medium',return:'10月3日—10月10日',days:'18–26 天',confidence:'76%',updated:'昨天 13:20',note:'国家队比赛后报告肌肉紧张',history:[['2024/25','小腿受伤','22 天','4 场'],['2023/24','腿筋受伤','17 天','3 场']],cases:[['Lisandro Martínez','小腿','23 天','85%'],['John Stones','小腿','19 天','78%'],['Rúben Dias','小腿','27 天','74%']]},
6:{id:6,name:'Bruno Guimarães',initials:'BG',team:'Newcastle',club:'#2ca572',position:'中场',age:28,injury:'撞击伤',area:'左足',severity:'low',return:'9月21日',days:'2–5 天',confidence:'88%',updated:'9月14日 18:05',note:'影像检查无结构性损伤',history:[['2024/25','足部撞击','5 天','1 场'],['2023/24','脚踝不适','8 天','1 场']],cases:[['Joelinton','足部撞击','4 天','90%'],['Douglas Luiz','足部撞击','6 天','82%'],['Moisés Caicedo','足部撞击','3 天','80%']]}
};
const id=new URLSearchParams(location.search).get('id')||'1';
let stored=null;try{const value=JSON.parse(sessionStorage.getItem('injury-player')||'null');if(value&&String(value.id)===String(id))stored=value}catch(_error){}
const fallback=playerRecords[id]||playerRecords[1],p=stored?{...fallback,...stored,age:stored.age||fallback.age,history:Array.isArray(stored.history)?stored.history:fallback.history,cases:Array.isArray(stored.cases)&&stored.cases.length?stored.cases:fallback.cases}:fallback;
const severityLabel=p.severity==='high'?'高风险':p.severity==='medium'?'中等':'轻微';
document.title=`${p.name}｜伤停线`;
document.querySelector('#player-page').innerHTML=`
  <nav class="breadcrumb" aria-label="面包屑"><a href="./index.html">球员</a><span>›</span><span>${p.name}</span></nav>
  <section class="player-profile">
    <div class="profile-main"><span class="profile-avatar" style="--club:${p.club}">${p.initials}</span><div><span class="team-pill">${p.team}</span><h1>${p.name}</h1><p>${p.position} · ${p.age} 岁</p></div></div>
    <div class="source-chip"><span>数据源</span><strong>API-Football</strong><small>${p.updated} 更新</small></div>
  </section>
  <section class="injury-summary">
    <div class="injury-title"><div><span class="severity ${p.severity}">${severityLabel}</span><h2>${p.injury}</h2><p>${p.area} · ${p.note}</p></div><div class="return-window"><span>预计复出</span><strong>${p.return}</strong></div></div>
    <div class="metric-row"><article><span>预计康复</span><strong>${p.days}</strong></article><article><span>预测置信度</span><strong>${p.confidence}</strong></article><article><span>本赛季预计缺席</span><strong>${p.severity==='high'?'5–7 场':p.severity==='medium'?'2–4 场':'0–1 场'}</strong></article><article><span>复发风险</span><strong>${p.severity==='high'?'偏高':p.severity==='medium'?'中等':'较低'}</strong></article></div>
  </section>
  <div class="player-columns">
    <section class="player-card recovery-card"><div class="card-head"><h2>康复时间估计</h2><span>${p.confidence} 置信度</span></div><div class="recovery-scale"><div class="scale-band"></div><i style="left:${p.severity==='high'?'68':p.severity==='medium'?'54':'32'}%"></i></div><div class="scale-label"><span>乐观</span><span>模型中位</span><span>保守</span></div><div class="evidence-list"><p><span>伤病类型</span><strong>${p.injury}</strong></p><p><span>位置影响</span><strong>${p.position}</strong></p><p><span>历史复发</span><strong>${p.history.length} 次记录</strong></p></div></section>
    <section class="player-card"><div class="card-head"><h2>相似案例</h2><span>按伤病与位置匹配</span></div><div class="case-table">${p.cases.map((c,i)=>`<div><b>${String(i+1).padStart(2,'0')}</b><span><strong>${c[0]}</strong><small>${c[1]}</small></span><span>${c[2]}</span><em>${c[3]}</em></div>`).join('')}</div></section>
  </div>
  <section class="player-card history-card"><div class="card-head"><h2>过往伤病</h2><span>API-Football /sidelined 字段结构</span></div><div class="history-table"><div class="table-row table-head"><span>赛季</span><span>伤病</span><span>缺阵时间</span><span>缺席场次</span></div>${p.history.map(h=>`<div class="table-row">${h.map(x=>`<span>${x}</span>`).join('')}</div>`).join('')}</div></section>
  <p class="player-disclaimer">预测基于公开伤病记录与相似案例，不代表俱乐部或医疗结论。</p>`;

