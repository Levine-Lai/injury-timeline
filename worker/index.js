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
  { id: 'hip_groin', label: '髋部与腹股沟', pattern: /\bhip\b|groin|adductor|pubalgia|pubic|pelvic/i },
  { id: 'lower_leg', label: '小腿与跟腱', pattern: /calf|\bshin(?:bone)?\b|fibula|lower leg|achilles|peroneus/i },
  { id: 'ankle', label: '脚踝', pattern: /ankle/i },
  { id: 'foot', label: '足部', pattern: /foot|metatarsal|toe|heel|plantar/i },
  { id: 'back', label: '背部与脊柱', pattern: /back|lumbago|lumbar|spine|vertebra|sciatica/i },
  { id: 'upper_limb', label: '肩臂与手部', pattern: /shoulder|arm|elbow|wrist|hand|forearm|metacarpal|finger|thumb|collarbone|scaphoid/i },
  { id: 'head_neck', label: '头颈部', pattern: /head|concussion|nose|facial|eye|neck|whiplash|cheekbone|jaw|skull|frontal bone|eyebow/i },
  { id: 'torso', label: '胸腹部', pattern: /rib|chest|abdominal|abdomen/i },
  { id: 'muscle_unspecified', label: '肌肉（部位未明）', pattern: /muscle|muscular|strain/i },
  { id: 'other_trauma', label: '其他创伤', pattern: /ligament|tendon|capsular|knock|bruise|fracture|broken|surgery|inflammation|wound|tear|injury|problems/i },
];

const NON_INJURY_LABELS = /corona|covid|virus|\bill\b|flu|influenza|fever|cold|infection|tonsillitis|quarantine|rest|fitness|stomach|food poisoning|allergy|shingles|heart problems|circulation problems|kidney problems|intestinal surgery|dental surgery/i;

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

Object.assign(ARCHIVE_INJURY_NAMES, {
  'Inflammation in the knee': '膝关节炎症',
  'Inner knee ligament tear': '膝内侧韧带撕裂',
  'Knee medial ligament tear': '膝内侧韧带撕裂',
  'Inner ligament stretch of the knee': '膝内侧韧带拉伤',
  'Torn lateral knee ligament': '膝外侧韧带撕裂',
  'Bruised knee': '膝部挫伤',
  'Torn knee ligaments': '膝关节韧带撕裂',
  'Patellar tendon problems': '髌腱问题',
  'Collateral ligament injury': '膝侧副韧带损伤',
  'Cruciate ligament surgery': '十字韧带手术',
  'Meniscus damage': '半月板损伤',
  'Patellar tendon rupture': '髌腱断裂',
  'Patellar tendon irritation': '髌腱刺激症状',
  'Tear of the lateral meniscus': '外侧半月板撕裂',
  'Partial damage to the cruciate ligament': '十字韧带部分损伤',
  'Broken kneecap': '髌骨骨折',
  'Cruciate ligament strain': '十字韧带拉伤',
  'Edema in the knee': '膝关节水肿',
  'Knee collateral ligament strain': '膝侧副韧带拉伤',
  'Patellar tendon dislocation': '髌腱脱位',
  'Knee collateral ligament tear': '膝侧副韧带撕裂',
  'Meniscus irritation': '半月板刺激症状',
  'Patellar tendon tear': '髌腱撕裂',
  'Collateral ligament tear': '膝侧副韧带撕裂',
  'Cyst in the knee': '膝关节囊肿',
  'Inflammation of ligaments in the knee': '膝韧带炎症',
  'Partial patellar tendon tear': '髌腱部分撕裂',
  'Patellar tendinopathy syndrome': '髌腱病',
  'Strain in the thigh and gluteal muscles': '大腿与臀肌拉伤',
  'Inflammation of the biceps tendon in the thigh': '股二头肌腱炎症',
  'Torn muscle fiber in the adductor area': '内收肌纤维撕裂',
  'Pubalgia': '耻骨痛',
  'Inflammation of pubic bone': '耻骨炎症',
  'Pubic bone irritation': '耻骨刺激症状',
  'Pubic bone bruise': '耻骨挫伤',
  'Adductor tear': '内收肌撕裂',
  'Right hip flexor problems': '髋屈肌问题',
  'Left hip flexor problems': '髋屈肌问题',
  'Hip bruise': '髋部挫伤',
  'Groin strain': '腹股沟拉伤',
  'Whiplash': '颈部挥鞭伤',
  'Achilles tendon contusion': '跟腱挫伤',
  'Calf strain': '小腿拉伤',
  'Shin injury': '胫部伤势',
  'Achilles tendon irritation': '跟腱刺激症状',
  'Achilles heel problems': '跟腱问题',
  'Achilles tendon surgery': '跟腱手术',
  'Lower leg fracture': '小腿骨折',
  'Shin bruise': '胫部挫伤',
  'Fissure of the fibula': '腓骨裂伤',
  'Calf stiffness': '小腿僵硬',
  'Bruise on shinbone': '胫骨挫伤',
  'Broken fibula': '腓骨骨折',
  'Hairline fracture in the fibula': '腓骨细微骨折',
  'Inflammation in the head of the fibula': '腓骨头炎症',
  'Broken ankle': '脚踝骨折',
  'Torn ankle ligaments': '脚踝韧带撕裂',
  'Torn lateral ankle ligament': '脚踝外侧韧带撕裂',
  'Ankle ligament tear': '脚踝韧带撕裂',
  'Bruise on ankle': '脚踝挫伤',
  'Inflammation in the ankle joint': '踝关节炎症',
  'Dislocation fracture of the ankle joint': '踝关节骨折脱位',
  'Bruise on the ankle joint': '踝关节挫伤',
  'Capsular tear of ankle joint': '踝关节囊撕裂',
  'Foot bruise': '足部挫伤',
  'Broken foot': '足部骨折',
  'Heel problems': '足跟问题',
  'Broken toe': '脚趾骨折',
  'Heel injury': '足跟伤势',
  'Foot surgery': '足部手术',
  'Heel spur': '跟骨骨刺',
  'Hairline crack in foot': '足部细微骨折',
  'Metatarsal bruise': '跖骨挫伤',
  'Inflammation of the sole of the foot': '足底炎症',
  'Partial tear of the plantar fascia': '足底筋膜部分撕裂',
  'Bruised back': '背部挫伤',
  'Lumbar vertebra fracture': '腰椎骨折',
  'Lumbar vertebra problems': '腰椎问题',
  'Cervical spine injury': '颈椎伤势',
  'Blockage in the back': '背部活动受限',
  'Compression of the spine': '脊柱压迫',
  'Inflammation in the spine': '脊柱炎症',
  'Vertebral injury': '椎体伤势',
  'Elbow injury': '肘部伤势',
  'Broken arm': '手臂骨折',
  'Broken hand': '手部骨折',
  'Wrist injury': '手腕伤势',
  'Arm injury': '手臂伤势',
  'Wrist fracture': '手腕骨折',
  'Forearm fracture': '前臂骨折',
  'Metacarpal fracture': '掌骨骨折',
  'Shoulder joint contusion': '肩关节挫伤',
  'Broken shoulder': '肩部骨折',
  'Broken nose bone': '鼻骨骨折',
  'Neck injury': '颈部伤势',
  'Nose surgery': '鼻部手术',
  'Facial injury': '面部伤势',
  'Facial fracture': '面部骨折',
  'Fracture of the eye socket': '眼眶骨折',
  'Nose injury': '鼻部伤势',
  'Chest injury': '胸部伤势',
  'Injury to abdominal muscles': '腹肌伤势',
  'Bruised ribs': '肋骨挫伤',
  'Abdominal muscle strain': '腹肌拉伤',
  'Rib fracture': '肋骨骨折',
  'Abdominal problems': '腹部问题',
  'Internal ligament strain': '内侧韧带拉伤',
  'Muscle fiber tear': '肌纤维撕裂',
  'muscle stiffness': '肌肉僵硬',
  'Partial muscle tear': '肌肉部分撕裂',
  'Muscle contusion': '肌肉挫伤',
  'Sore muscles': '肌肉酸痛',
  'Muscle tear': '肌肉撕裂',
  'Hairline fracture in the muscles': '肌肉区域细微骨折',
  'Inner ligament injury': '内侧韧带损伤',
  'Ligament injury': '韧带损伤',
  'surgery': '手术恢复',
  'inflammation': '炎症',
  'Capsular injury': '关节囊损伤',
  'Finger injury': '手指伤势',
  'Broken collarbone': '锁骨骨折',
  'Tendon irritation': '肌腱刺激症状',
  'Broken finger': '手指骨折',
  'Syndesmotic ligament tear': '下胫腓联合韧带撕裂',
  'Outer ligament problems': '外侧韧带问题',
  'Pelvic injury': '骨盆伤势',
  'Pelvic contusion': '骨盆挫伤',
  'Pelvic obliquity': '骨盆倾斜',
  'Tendonitis': '肌腱炎',
  'Syndesmosis ligament tear': '下胫腓联合韧带撕裂',
  'Eye injury': '眼部伤势',
  'Ligament stretching': '韧带拉伤',
  'Tendon rupture': '肌腱断裂',
  'Broken cheekbone': '颧骨骨折',
  'Broken jaw': '颌骨骨折',
  'Broken tibia': '胫骨骨折',
  'Outer ligament tear': '外侧韧带撕裂',
  'flesh wound': '皮肉伤',
  'Arch problems': '足弓问题',
  'Thumb injury': '拇指伤势',
  'laceration wound': '撕裂伤',
  'Internal ligament tear': '内侧韧带撕裂',
  'Sciatica problems': '坐骨神经痛',
  'Tendon tear': '肌腱撕裂',
  'Torn ligaments': '韧带撕裂',
  'fatigue fracture': '疲劳性骨折',
  'fracture': '骨折（部位未明）',
  'Peroneus tendon injury': '腓骨肌腱伤势',
  'Bone bruise': '骨挫伤',
  'Broken leg': '腿部骨折',
  'Scaphoid fracture': '舟骨骨折',
  'Broken thumb': '拇指骨折',
  'Eyebow fracture': '眉骨骨折',
  'Ligament tear': '韧带撕裂',
  'open wound': '开放性伤口',
  'Crack bruise': '裂伤伴挫伤',
  'Femoral fracture': '股骨骨折',
  'Fracture of frontal bone': '额骨骨折',
  'Longitudinal tendon tear': '肌腱纵向撕裂',
  'Overstretching of the syndesmotic ligament': '下胫腓联合韧带过度拉伸',
  'Scaphoid surgery': '舟骨手术',
  'Skull fracture': '颅骨骨折',
});

const CANONICAL_INJURIES = [
  { id: 'knee_unspecified', label: '膝部伤势（未明确）', aliases: ['Knee injury', 'Knee problems'] },
  { id: 'knee_bruise', label: '膝部挫伤', aliases: ['Knee bruise', 'Bruised knee'] },
  { id: 'cruciate_ligament_injury', label: '十字韧带伤病', aliases: ['Cruciate ligament tear', 'Cruciate ligament injury', 'Cruciate ligament surgery', 'Partial damage to the cruciate ligament', 'Cruciate ligament strain'] },
  { id: 'meniscus_injury', label: '半月板伤病', aliases: ['Meniscus injury', 'Meniscus damage', 'Meniscus irritation', 'Meniscus tear', 'Tear of the lateral meniscus'] },
  { id: 'patellar_tendon_injury', label: '髌腱伤病', aliases: ['Patellar tendon problems', 'Patellar tendon rupture', 'Patellar tendon irritation', 'Patellar tendon dislocation', 'Patellar tendon tear', 'Partial patellar tendon tear', 'Patellar tendinopathy syndrome'] },
  { id: 'knee_collateral_injury', label: '膝侧副韧带伤病', aliases: ['Collateral ligament injury', 'Inner knee ligament tear', 'Knee medial ligament tear', 'Inner ligament stretch of the knee', 'Torn lateral knee ligament', 'Knee collateral ligament strain', 'Knee collateral ligament tear', 'Collateral ligament tear'] },
  { id: 'knee_ligament_unspecified', label: '膝关节韧带伤病（未明确）', aliases: ['Torn knee ligaments', 'Inflammation of ligaments in the knee'] },
  { id: 'hamstring_injury', label: '腿筋伤病', aliases: ['Hamstring injury', 'Hamstring muscle injury', 'Hamstring strain'] },
  { id: 'hip_unspecified', label: '髋部伤势（未明确）', aliases: ['Hip injury', 'Hip problems'] },
  { id: 'hip_flexor', label: '髋屈肌问题', aliases: ['Hip flexor problems', 'Right hip flexor problems', 'Left hip flexor problems'] },
  { id: 'adductor_injury', label: '内收肌伤病', aliases: ['Adductor pain', 'Adductor injury', 'Torn muscle fiber in the adductor area', 'Adductor tear'] },
  { id: 'groin_unspecified', label: '腹股沟伤病', aliases: ['Groin injury', 'Groin problems', 'Groin strain'] },
  { id: 'calf_unspecified', label: '小腿肌肉伤病', aliases: ['Calf injury', 'Calf problems', 'Calf muscle tear', 'Calf strain', 'Calf stiffness'] },
  { id: 'achilles_unspecified', label: '跟腱伤病', aliases: ['Achilles tendon problems', 'Achilles tendon rupture', 'Achilles tendon contusion', 'Achilles tendon irritation', 'Achilles heel problems', 'Achilles tendon surgery'] },
  { id: 'fibula_fracture', label: '腓骨骨折', aliases: ['Broken fibula', 'Fissure of the fibula', 'Hairline fracture in the fibula'] },
  { id: 'ankle_unspecified', label: '脚踝伤势（未明确）', aliases: ['Ankle injury', 'Injury to the ankle'] },
  { id: 'ankle_bruise', label: '脚踝挫伤', aliases: ['Bruise on ankle', 'Bruise on the ankle joint'] },
  { id: 'ankle_ligament_injury', label: '脚踝韧带伤病', aliases: ['Ankle sprain', 'ankle sprain', 'Torn ankle ligaments', 'Torn lateral ankle ligament', 'Ankle ligament tear'] },
  { id: 'heel_injury', label: '足跟伤病', aliases: ['Heel problems', 'Heel injury'] },
  { id: 'back_unspecified', label: '背部伤势（未明确）', aliases: ['Back problems', 'Back injury'] },
  { id: 'abdominal_muscle_injury', label: '腹肌伤病', aliases: ['Injury to abdominal muscles', 'Abdominal muscle strain'] },
  { id: 'muscle_unspecified', label: '肌肉伤势（部位未明）', aliases: ['Muscle injury', 'muscular problems'] },
  { id: 'muscle_fiber_tear', label: '肌肉撕裂（部位未明）', aliases: ['Torn muscle fiber', 'Muscle fiber tear', 'Torn muscle bundle', 'Muscle tear', 'Partial muscle tear'] },
  { id: 'muscle_strain', label: '肌肉拉伤（部位未明）', aliases: ['strain', 'Muscle strain'] },
  { id: 'syndesmosis_tear', label: '下胫腓联合韧带撕裂', aliases: ['Syndesmotic ligament tear', 'Syndesmosis ligament tear'] },
  { id: 'ligament_tear_unspecified', label: '韧带撕裂（部位未明）', aliases: ['Torn ligaments', 'Ligament tear'] },
  { id: 'knock', label: '碰撞伤', aliases: ['Knock', 'minor knock'] },
];

const REVIEW_REQUIRED_LABELS = new Set([
  'Internal ligament strain', 'Hairline fracture in the muscles', 'Inner ligament injury',
  'Ligament injury', 'surgery', 'inflammation', 'Capsular injury', 'Outer ligament problems',
  'Ligament stretching', 'Outer ligament tear', 'Internal ligament tear', 'Torn ligaments',
  'fatigue fracture', 'fracture', 'Ligament tear', 'Crack bruise', 'Longitudinal tendon tear',
  'Pelvic obliquity',
]);

const CANONICAL_ALIAS_MAP = new Map();
for (const group of CANONICAL_INJURIES) {
  for (const alias of group.aliases) CANONICAL_ALIAS_MAP.set(alias, group);
}

function canonicalArchiveInjury(injuryType) {
  const group = CANONICAL_ALIAS_MAP.get(injuryType);
  return {
    id: group?.id || `raw:${injuryType}`,
    label: group?.label || ARCHIVE_INJURY_NAMES[injuryType] || '待审核伤病类型',
    review_required: REVIEW_REQUIRED_LABELS.has(injuryType) || !ARCHIVE_INJURY_NAMES[injuryType] && !group,
  };
}

const ARCHIVE_CATEGORY_OVERRIDES = new Map([
  ['Whiplash', 'head_neck'],
  ['Femoral fracture', 'thigh'],
  ['Pelvic injury', 'hip_groin'],
  ['Arch problems', 'foot'],
  ['Syndesmotic ligament tear', 'ankle'],
  ['Syndesmosis ligament tear', 'ankle'],
  ['Overstretching of the syndesmotic ligament', 'ankle'],
  ['Broken tibia', 'lower_leg'],
  ['Scaphoid fracture', 'upper_limb'],
  ['Scaphoid surgery', 'upper_limb'],
  ['Broken collarbone', 'upper_limb'],
]);

function archiveCategory(injuryType) {
  if (!injuryType || NON_INJURY_LABELS.test(injuryType)) return null;
  const override = ARCHIVE_CATEGORY_OVERRIDES.get(injuryType);
  if (override) return ARCHIVE_CATEGORIES.find(category => category.id === override) || null;
  return ARCHIVE_CATEGORIES.find(category => category.pattern.test(injuryType)) || null;
}

function mergeArchiveTypes(rows) {
  const merged = new Map();
  for (const row of rows) {
    const category = archiveCategory(row.injury_type);
    if (!category) continue;
    const canonical = canonicalArchiveInjury(row.injury_type);
    const cases = Number(row.cases || 0);
    const current = merged.get(canonical.id) || {
      type_id: canonical.id,
      injury_label: canonical.label,
      category_id: category.id,
      category_label: category.label,
      cases: 0,
      players: 0,
      average_days: 0,
      minimum_days: Number.POSITIVE_INFINITY,
      maximum_days: 0,
      raw_labels: [],
      review_required: false,
      weighted_days: 0,
    };
    current.cases += cases;
    current.players += Number(row.players || 0);
    current.weighted_days += Number(row.average_days || 0) * cases;
    current.minimum_days = Math.min(current.minimum_days, Number(row.minimum_days || 0));
    current.maximum_days = Math.max(current.maximum_days, Number(row.maximum_days || 0));
    current.raw_labels.push(row.injury_type);
    current.review_required ||= canonical.review_required;
    merged.set(canonical.id, current);
  }
  return [...merged.values()].map(type => {
    type.average_days = type.cases ? Math.round((type.weighted_days / type.cases) * 10) / 10 : 0;
    if (!Number.isFinite(type.minimum_days)) type.minimum_days = 0;
    delete type.weighted_days;
    return type;
  }).sort((a, b) => b.cases - a.cases || a.injury_label.localeCompare(b.injury_label, 'zh-CN'));
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
  const injuries = [...new Set(url.searchParams.getAll('injury').map(value => value.trim()).filter(Boolean))].slice(0, 20);
  const query = (url.searchParams.get('q') || '').trim().replace(/\s+/g, ' ');
  const limit = limitFrom(url, 30, 50);
  const offsetValue = Number.parseInt(url.searchParams.get('offset') || '', 10);
  const offset = Number.isFinite(offsetValue) ? Math.max(offsetValue, 0) : 0;

  if (query && query.length < 2) return json({ error: 'search query must contain at least 2 characters' }, 400, origin);

  if (injuries.length || query) {
    const where = [
      'date_until IS NOT NULL',
      'days_missed IS NOT NULL',
      'days_missed > 0',
      "(? = '' OR league = ?)",
    ];
    const bindings = [league, league];
    if (injuries.length) {
      where.push(`injury_type IN (${injuries.map(() => '?').join(', ')})`);
      bindings.push(...injuries);
    }
    if (query) {
      where.push('player_name LIKE ? COLLATE NOCASE');
      bindings.push(`%${query}%`);
    }
    const recordsPromise = env.injury_history.prepare(`
      SELECT id, player_id, season, injury_type, date_from, date_until, days_missed,
             games_missed, player_name, player_age, player_position, club, league
      FROM injury_events
      WHERE ${where.join('\n        AND ')}
      ORDER BY date_from DESC, id DESC
      LIMIT ? OFFSET ?
    `).bind(...bindings, limit, offset).all();

    let distributionPromise = Promise.resolve({ results: [] });
    let statsPromise = Promise.resolve(null);
    if (injuries.length && !query) {
      const labelParameters = injuries.map(() => '?').join(', ');
      distributionPromise = env.injury_history.prepare(`
        SELECT days_missed, COUNT(*) AS cases
        FROM injury_events
        WHERE date_until IS NOT NULL
          AND days_missed IS NOT NULL
          AND days_missed > 0
          AND (? = '' OR league = ?)
          AND injury_type IN (${labelParameters})
        GROUP BY days_missed
        ORDER BY days_missed ASC
      `).bind(league, league, ...injuries).all();
      statsPromise = env.injury_history.prepare(`
        SELECT COUNT(*) AS sample_size,
               ROUND(AVG(days_missed), 1) AS average_days,
               MIN(days_missed) AS minimum_days,
               MAX(days_missed) AS maximum_days
        FROM injury_events
        WHERE date_until IS NOT NULL
          AND days_missed IS NOT NULL
          AND days_missed > 0
          AND (? = '' OR league = ?)
          AND injury_type IN (${labelParameters})
      `).bind(league, league, ...injuries).first();
    }
    const [result, distributionResult, typeStats] = await Promise.all([recordsPromise, distributionPromise, statsPromise]);
    const records = (result.results || []).map(row => ({
      ...row,
      injury_label: canonicalArchiveInjury(row.injury_type).label,
    }));
    return json({
      query: { injuries, player: query || null, league: league || null, limit, offset },
      results: records,
      distribution: distributionResult.results || [],
      stats: typeStats,
    }, 200, origin);
  }

  const cache = caches.default;
  const cacheUrl = new URL(`/__cache/v5/history-archive?league=${encodeURIComponent(league)}`, request.url);
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

  const types = mergeArchiveTypes(typesResult.results || []);
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
  const reviewTypes = types.filter(type => type.review_required).map(type => ({
    injury_label: type.injury_label,
    cases: type.cases,
    raw_labels: type.raw_labels,
  }));
  const response = json({
    data: { categories, types },
    meta: {
      league: league || null,
      completed_cases: Number(totalResult?.cases || 0),
      classified_cases: classifiedCases,
      players: Number(totalResult?.players || 0),
      review_types: reviewTypes,
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

