#!/usr/bin/env node

const pagesUrl = 'https://Rethymus.github.io/AeonVale/';

const generatedAt = 'static-public-status';

const rows = [
  {
    scope: 'P0-A 本地可审版本',
    status: '已达公开前本地验收门槛：本地构建、测试、截图、公开树与泄露检查已有自动化路径',
    evidence: 'pnpm portfolio:mvp-preflight -- --keep-public-tree',
    next: '继续人工试玩首轮 3-5 分钟，并复核 test-results/portfolio/ 截图可读性',
  },
  {
    scope: 'P0-B GitHub Pages 公开展示',
    status: '待复验：本地公开树 smoke 已通过；当前真实 Pages URL 必须在重新部署后再次通过 smoke 才能宣称闭环完成',
    evidence: 'pnpm test:browser:pages 访问真实 URL',
    next: `使用维护者授权的公开树产物重新部署后，先用 pnpm portfolio:pages-diagnose 归因复核，再复跑 pnpm test:browser:pages 并复核 ${pagesUrl}`,
  },
  {
    scope: 'P1 独立游戏首版循环',
    status: '延后推进：已有炼丹、设施、阵法、境界、社交与事件骨架，但不阻塞 P0',
    evidence: '相关单元、集成、属性与回放测试',
    next: '把中期目标链压缩成更清晰的可持续日循环',
  },
  {
    scope: 'P2 Patch / DLC 内容厚度',
    status: '明确延后：人物、节日、地点、作物、收藏和长期叙事按补丁节奏扩容',
    evidence: '路线图与内容测试持续承接',
    next: '避免在公开试玩版前用内容堆量替代发布闭环',
  },
];

const comparison = [
  '《星露谷物语》是长期生活感参照，P0 只验收低门槛日循环与公开试玩闭环。',
  'P0 日循环必须能看见翻地、播种、浇水、过夜、收获、出货、补种。',
  '本作差异化必须能看见炼丹、阵法、淬体、主动引劫，表达“种田即备战”。',
  '修仙竞品参照《鬼谷八荒》《觅长生》《了不起的修仙模拟器》《太吾绘卷》，只吸收适合纯代码单人项目的成长、经营、关系与世界反馈。',
];

const dimensions = [
  {
    id: 'daily-loop',
    priority: 'P0',
    dimension: '日循环',
    stardewReference: '强：低门槛翻地、播种、浇水、过夜、收获、出货和补种必须在首次试玩中成立',
    xianxiaReference: '把农务收益导向炼丹、阵法与引劫准备，避免只是换皮农场',
    current: '纵切片已能展示基础农务与经济闭环，本地公开树可试玩',
    next: '继续试玩 3-5 分钟，确认玩家不用读文档也知道今天先做什么',
    evidence: 'pnpm portfolio:mvp-preflight -- --keep-public-tree',
    status: 'local-review-ready',
  },
  {
    id: 'economy-feedback',
    priority: 'P0',
    dimension: '经济反馈',
    stardewReference: '中：出货、购买和补种要形成清楚的短反馈',
    xianxiaReference: '灵石和材料应服务于丹药、设施、淬体和渡劫准备',
    current: '已有出货、商店、处理与设施相关测试覆盖，但首屏表达仍可压缩',
    next: '把出货收益到下一步修行目标的提示压进首轮体验',
    evidence: 'pnpm test tests/unit/shipping.test.ts tests/unit/shop.test.ts tests/unit/processing.test.ts',
    status: 'needs-polish',
  },
  {
    id: 'xianxia-differentiation',
    priority: 'P0',
    dimension: '修仙差异化',
    stardewReference: '弱：不追求复刻星露谷的村镇体量，而是借用生活模拟可读性',
    xianxiaReference: '炼丹、阵法、淬体、主动引劫是公开演示必须看见的核心差异',
    current: '系统和测试骨架已存在，公开试玩状态需要持续强调“种田即备战”',
    next: '把炼丹、阵法、主动引劫整理成更直观的 3-5 分钟展示链',
    evidence: 'pnpm test tests/unit/alchemy.test.ts tests/unit/body-cultivation.test.ts tests/integration/tribulation.int.test.ts',
    status: 'visible-but-sharpening',
  },
  {
    id: 'long-term-growth',
    priority: 'P1',
    dimension: '长期成长',
    stardewReference: '中：季度/年度目标和设施成长是独立游戏阶段需要补强的牵引',
    xianxiaReference: '境界、设施、功法和天劫链条应形成持续目标，而不是只堆数值',
    current: '已有境界、设施、后续修行和留世目标骨架，不阻塞 P0',
    next: '把中期目标链压成更清晰的可持续日循环',
    evidence: 'pnpm test tests/unit/progression.test.ts tests/unit/facilities.test.ts tests/unit/staying-world-goals.test.ts',
    status: 'p1-backlog',
  },
  {
    id: 'social-commissions',
    priority: 'P1',
    dimension: '社交与委托',
    stardewReference: '中：NPC、委托和节日提供生活感，但不是公开试玩 P0 的发布闸门',
    xianxiaReference: '关系网应服务于宗门、人情、机缘和资源交换',
    current: 'NPC 信号、委托和节日框架已有测试，人物记忆点仍薄',
    next: '优先保留能改变每日选择的 NPC 信号，再扩写人物厚度',
    evidence: 'pnpm test tests/unit/social.test.ts tests/unit/commissions.test.ts tests/unit/npc-quests.test.ts',
    status: 'p1-backlog',
  },
  {
    id: 'world-events',
    priority: 'P1',
    dimension: '世界反馈',
    stardewReference: '中：天气、节日和突发事件让日子有差异',
    xianxiaReference: '天象、兽潮、机缘和劫雷应改变农庄经营决策',
    current: '天象、事件和留世事故已有自动化覆盖，但公开演示仍以 P0 闭环为先',
    next: '筛选少量能服务首版循环的事件，不在 P0 前扩散内容面',
    evidence: 'pnpm test tests/unit/celestial.test.ts tests/unit/staying-world-incidents.test.ts tests/integration/celestial-chain.int.test.ts',
    status: 'p1-backlog',
  },
  {
    id: 'content-scale',
    priority: 'P2',
    dimension: '内容体量',
    stardewReference: '强但延后：成熟生活模拟的作物、地点、收藏、人物和节庆体量不能在 P0 硬追',
    xianxiaReference: '可按补丁 / DLC 扩展秘境、丹方、功法、人物线和长期叙事',
    current: '明确延后，避免用内容堆量替代公开试玩发布闭环',
    next: '保持 Pages 验证稳定后，再按补丁节奏扩容',
    evidence: 'pnpm portfolio:status -- --json',
    status: 'p2-deferred',
  },
  {
    id: 'publishability',
    priority: 'P0',
    dimension: '公开发布可验证性',
    stardewReference: '间接：公开试玩链接必须像产品一样可访问、可试玩、可验证',
    xianxiaReference: '公开产物只展示可试玩表层，不泄露私有设定、剧情细案或长期路线图',
    current: 'P0-A 本地检查链已建立；本地公开树 smoke 已通过；真实 Pages URL 当前需要重新部署后复验',
    next: '转 Public、创建 Release、修改远端设置或重新部署前，重新取得维护者授权并复跑公开树检查；部署后必须复跑真实 URL smoke',
    evidence: 'pnpm governance:readiness && pnpm portfolio:mvp-preflight -- --keep-public-tree && pnpm test:browser:pages',
    status: 'pages-redeploy-required',
  },
];

const noGo = [
  '未获维护者当次明确授权前，不转为 Public、不创建 tag 或 Release、不修改远端设置。',
  '每次重新部署后，真实 Pages URL 未通过 pnpm test:browser:pages 前，不宣称 GitHub Pages 闭环完成。',
  'docs/、Agent 状态、生成物、.env*、sourcemap 和私有设计资料不得进入公开树、Pages 或 Release 产物。',
];

const evidenceArtifacts = [
  {
    id: 'public-demo-evidence-json',
    priority: 'P0-A',
    path: 'test-results/portfolio/portfolio-mvp-evidence.json',
    generatedBy: 'pnpm portfolio:capture',
    requiredSignals: [
      'first-loop-complete onboarding objective',
      '10/10 first-loop progress',
      'farmstead + show-farm-work selection',
      'shipping bin review output',
      'today briefing visible with asset',
      'today briefing proof includes farm, alchemy, tribulation, 10/10 progress, and cultivation handoff cues',
      'Stardew low-friction loop text',
      'xianxia differentiation text',
      'remote-action authorization boundary',
    ],
    publicTreePolicy: 'generated-only; must not enter the public tree, Pages, or Release artifacts',
    reviewCommand: 'pnpm portfolio:mvp-preflight -- --keep-public-tree',
  },
  {
    id: 'public-demo-screenshot-set',
    priority: 'P0-A',
    path: 'test-results/portfolio/*.png',
    generatedBy: 'pnpm portfolio:capture',
    requiredSignals: [
      '01-farm-loop.png 960x540 readable PNG',
      '02-location-routing.png 960x540 readable PNG',
      '03-farm-actions.png 960x540 readable PNG',
      '04-mobile-farm-loop.png 960x540 readable PNG',
      'screenshotEvidence paintedRatio and colors meet thresholds',
    ],
    publicTreePolicy: 'generated-only; review evidence only, do not publish screenshots directly from test-results',
    reviewCommand: 'pnpm portfolio:mvp-preflight -- --keep-public-tree',
  },
  {
    id: 'live-pages-smoke',
    priority: 'P0-B',
    path: pagesUrl,
    generatedBy: 'maintainer-authorized GitHub Pages deployment',
    requiredSignals: [
      'PLAYWRIGHT_SKIP_WEBSERVER=true smoke test hits the deployed URL',
      'PLAYWRIGHT_GAME_BASE_PATH=/AeonVale/ route works on GitHub Pages',
      'public dist has no production sourcemap or private design material',
    ],
    publicTreePolicy: 'verified for private Pages; required after each deployment and before any Public/Release claim',
    reviewCommand: 'pnpm test:browser:pages',
  },
];

const status = {
  title: 'Aeon Vale 公开试玩状态',
  generatedAt,
  pagesUrl,
  safety: '此命令只输出公开安全的本地状态，不提交、不推送、不部署、不修改 GitHub 设置。',
  rows,
  comparison,
  dimensions,
  evidenceArtifacts,
  noGo,
};

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(status, null, 2));
  process.exit(0);
}

console.log(status.title);
console.log(status.safety);
console.log('');

console.log('优先级矩阵');
for (const row of status.rows) {
  console.log(`- ${row.scope}`);
  console.log(`  状态：${row.status}`);
  console.log(`  证据：${row.evidence}`);
  console.log(`  下一步：${row.next}`);
}
console.log('');

console.log('对标口径');
for (const item of status.comparison) console.log(`- ${item}`);
console.log('');

console.log('对标维度');
for (const item of status.dimensions) {
  console.log(`- ${item.priority} ${item.dimension}（${item.id}）`);
  console.log(`  星露谷参照：${item.stardewReference}`);
  console.log(`  修仙差异：${item.xianxiaReference}`);
  console.log(`  当前进度：${item.current}`);
  console.log(`  下一步：${item.next}`);
  console.log(`  证据：${item.evidence}`);
  console.log(`  状态：${item.status}`);
}
console.log('');

console.log('证据产物');
for (const item of status.evidenceArtifacts) {
  console.log(`- ${item.priority} ${item.id}`);
  console.log(`  路径：${item.path}`);
  console.log(`  生成：${item.generatedBy}`);
  console.log(`  复核命令：${item.reviewCommand}`);
  console.log(`  公开边界：${item.publicTreePolicy}`);
  console.log(`  必备信号：${item.requiredSignals.join('；')}`);
}
console.log('');

console.log('No-Go 边界');
for (const item of status.noGo) console.log(`- ${item}`);
