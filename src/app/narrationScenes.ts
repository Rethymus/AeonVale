/**
 * 灵韵叙录四幕场景数据（Wave 3 真实数据，覆盖 Wave 2 占位）。
 *
 * 红线（docs/23 §0，硬守）：
 *  - 本表只含 {@link NarrationScene} 纯数据，零运行时副作用、零 `src/sim/` 访问。
 *  - 文案硬编码中文（第一人称旁白，docs/22 §3 现代克制基调；现代感只作人物经验，不靠梗堆砌），不走 `t()`（与
 *    prologueScenes 同构，见 spec F4）。UI chrome（按钮/标签/图鉴）才走 `t('narration.*')`。
 *  - 所有副作用只走 choice/scene 的 `effects`/`onEnter` 声明通道，由 firstPersonView.applyEffects 解释。
 *  - 全部 scene `status:'approved'`（docs/23 §1，Wave 4 CI 护栏拒非 approved 进入口）。
 *
 * 幕结构（逐节点照 docs/22 §6 四幕骨架闭环 + spec F2 复用 prologueScenes 原文第一人称化）：
 *  - 序章·幻灭：黑屏睁眼 → 山谷（鸟兽/虚空踏步/炊烟）→ 炊烟抉择（深处=E0蘑菇 / 荒村）
 *    → 荒村（短暂确认“没有指引” + 行义涨 bond + 忘言叟指路太一宗）→ 赴宗途中义举
 *    → 太一宗测灵（复用 spirit-test 台词第一人称化：长老认可硬气→测灵柱死寂→「可惜了这股
 *    志气。无灵根」→给盘缠→「这里，不是凡人该待的地方」）→ 遣返 → 回谷忘言叟递锈锄头
 *    （复用 intro 原文）→「难道没有灵根，就真的不能修仙了吗？——没人回答」。
 *  - 第一幕·转折：两修士斗法波及农庄 → 败者「逆」化劫灰（玉佩刻逆，遗言「勿…」）
 *    → 萧无极负伤离去 → 储物戒（打斗波动+逆神魂俱灭→凡人可开）→ 得遗物 → 翻偷天换劫诀
 *    （震惊：竟是原世界文字！docs/22 §4.5 口诀原文作 lines）+ 日记 → 揭示（narrator：逆是
 *    异乡人空灵根者走通此路；神农是更早异乡人先驱；「能读这文字」=我亦异乡人/空灵根铁证；
 *    不写屈辱戏）→ 抉择（归隐→凡人蒙太奇→寿终 / 习诀→第二幕）。
 *  - 第二幕·淬劫：体修精进/灵田布防/炼丹/主动引劫淬体（多场天劫）+ 心志抉择支线
 *    （docs/22 §10 storylet：散修欺凌/采药女求救/利益诱惑/揭露黑幕，违心涨 defiance，
 *    本心涨 bond）+ 神农六线索散落（docs/22 §8.1，玩家自拼，旁白不喂）。失败态可在任意
 *    节点由 judgeEnding 触发（丹毒/走火/大限/雷劫）或显式 ends（萧诛/饿死）。
 *  - 终局·破立：神农洞府闭合节点（六线索自洽连成完整传说，神农生死留白）→ 紫雷劫（凡骨
 *    碎裂→以雷为窑骨为柴重塑，「破」=飞升的最后一次死亡与重生）→ 天道诘问瞬间（defiance
 *    ≥60∧bond≥50→E6 选项消失角色夺权心声 / defiance≥60∧bond<50→E7 POV反转 / defiance<60
 *    ∧cultProgress 满→飞升）。
 *
 * CG 图层：layerKeys.bg 指向 Wave 1 占位 manifest 条目（cg.first-person.*）。daoAmbience 分层
 * 由 narrationSurface 在后续 wave 按 deriveLayerKeys 合成（V1 仅 bg 单层即可演出）。
 */

import type { NarrationScene } from './narrationTypes';

// —— CG AssetId（layerKeys.bg 引用） ——
// 第一批 -v2（14）：序章/第一幕/八结局主线占位 → 真实正图（governance 已 published）。
// 第二批 -v2（14，本批合并）：NPC 立绘 5 / 场景图 5 / 道心氛围 3 / 主题意象 1，供子场景细化选图。
// 第三批 -v2（12，本批合并）：场景对照 6 / NPC 补立绘 4 / 主题意象 2，子场景视觉细化（斗法对照、
// 劫灰特写、灵田秋景、宗门外门、凡人蒙太奇、紫雷劫天穹、萧无极剑光、村童等）。
const CG = {
  // 第一批 -v2：主线四幕骨架图（act1/2/3 沿用）。
  valley: 'cg.first-person.prologue.valley-v2',
  village: 'cg.first-person.prologue.village-v2',
  sect: 'cg.first-person.prologue.sect-v2',
  storageRing: 'cg.first-person.act1.storage-ring-v2',
  script: 'cg.first-person.act1.script-v2',
  tribulation: 'cg.first-person.tribulation.purple-v2',
  // 第二批 -v2 场景图：子场景细化（act2 荒村/灵田/坊市 + act3 神农洞府/无面石像）。
  villageDawn: 'cg.first-person.scene.village-dawn-v2',
  spiritFarm: 'cg.first-person.scene.spirit-farm-v2',
  market: 'cg.first-person.scene.market-v2',
  shennongCave: 'cg.first-person.scene.shennong-cave-v2',
  facelessStatue: 'cg.first-person.scene.faceless-statue-v2',
  // 第二批 -v2 主题意象：序章早夭支线（E0 蘑菇特写）。
  memeMushroom: 'cg.first-person.meme.mushroom-v2',
  // 第三批 -v2 场景图：子场景视觉细化（对照/特写/蒙太奇/天穹）。
  battleDuel: 'cg.first-person.scene.battle-duel-v2',
  niAsh: 'cg.first-person.scene.ni-ash-v2',
  farmAutumn: 'cg.first-person.scene.farm-autumn-v2',
  sectGate: 'cg.first-person.scene.sect-gate-v2',
  mortalMontage: 'cg.first-person.scene.mortal-montage-v2',
  purpleSky: 'cg.first-person.scene.purple-sky-v2',
  // 第三批 -v2 NPC 补立绘：子场景细化（剑光特写 / 村童童谣）。
  xiaoSword: 'cg.first-person.npc.xiao-sword-v2',
  villageChild: 'cg.first-person.npc.village-child-v2'
} as const;

/**
 * 灵韵叙录全部场景（按幕顺序）。CI 护栏（Wave 4 governance-check）将 BFS 校验：
 * 8 结局全可达、无孤儿 scene、无死锁循环、打字机文本无空键。
 */
export const NARRATION_SCENES: readonly NarrationScene[] = [
  // ============ 序章·幻灭（act: 'prologue'） ============
  {
    id: 'prologue.awaken',
    act: 'prologue',
    layerKeys: { bg: CG.valley },
    lines: [
      { text: '——睁眼。', speaker: 'narrator' },
      { text: '先是一片黑，像谁把所有的灯都关了。然后鸟叫漏了进来，兽蹄踏过虚空一样的闷响，还有，很远很远的地方，一缕炊烟。', speaker: 'narrator' },
      { text: '我撑起身子。这不是我的房间，不是我的城市，甚至——不像是我该在的任何一个地方。', speaker: 'narrator' },
      { text: '那缕炊烟熟悉得像一个被讲过太多次的开场。可真正站在岔路口时，没有人替我标出哪一边才是活路。', speaker: 'narrator' }
    ],
    choices: [
      { id: 'deep', label: '循着炊烟，往深处走', goto: 'prologue.deep' },
      { id: 'village', label: '折向荒村', goto: 'prologue.village' }
    ],
    status: 'approved'
  },
  {
    // 炊烟抉择·深处：迷路断粮→红伞白杆→E0 早夭（docs/22 §6）。
    id: 'prologue.deep',
    act: 'prologue',
    layerKeys: { bg: CG.memeMushroom },
    lines: [
      { text: '我往深处走。林子越来越密，鸟叫没了，路也没了。干粮在第二天吃完，到第三天，我只剩半壶水。', speaker: 'narrator' },
      { text: '第四天，饿得发昏。树根底下生着一丛红伞白杆的菇，嫩得晃眼。', speaker: 'narrator' },
      { text: '我在另一个世界背过这句——红伞伞，白杆杆。可饿昏头的人，侥幸总比知识响。', speaker: 'narrator' },
      { text: '我摘下来，吃了。', speaker: 'narrator' },
      { text: '舌尖发麻的那一秒，我居然笑出声：异乡人的第一课，别乱吃。', speaker: 'narrator' }
    ],
    ends: 'e0-mushroom',
    status: 'approved'
  },
  {
    // 荒村·hub：短暂确认没有外来指引 + 行义 + 问路。flavor self-loop 回访只列剩余选项。
    id: 'prologue.village',
    act: 'prologue',
    layerKeys: { bg: CG.village },
    lines: [
      { text: '荒村。几户人家，炊烟勉强算活。我在村口坐了三天，等一个能解释此地的人，也等一道只对我开口的声音。', speaker: 'narrator' },
      { text: '没有面板，没有指引，也没有藏在随身物件里的残魂。等到第三天傍晚，我终于承认：这里不会有人替我宣布，我为何而来。', speaker: 'narrator' },
      { text: '村口的老者——人们叫他「忘言叟」——远远看着，一言不发。', speaker: 'narrator' }
    ],
    revisitMode: 'choices-only',
    choices: [
      { id: 'system', label: '在心里喊一声「系统」', once: true, response: '回应我的只有自己的呼吸。它很乱，却至少是真的。', effects: [{ kind: 'flag', target: 'asked-system' }], goto: 'prologue.village' },
      { id: 'elder', label: '检查所有随身物件', once: true, response: '衣袋空空，鞋底磨破。没有戒指，没有密钥，只有一双还走得动的腿。', goto: 'prologue.village' },
      { id: 'soul', label: '闭眼，等一道陌生声音', once: true, response: '风从屋檐下穿过去。脑海里没有别人，只有我。', goto: 'prologue.village' },
      {
        id: 'help',
        label: '帮村里修渠、赶野猪',
        once: true,
        response: '渠修好了，野猪也赶了。村里的大娘追着我塞鞋，我推不掉，也舍不得推。',
        effects: [
          { kind: 'add', target: 'bond', value: 14 },
          { kind: 'flag', target: 'did-righteous' }
        ],
        goto: 'prologue.village.calm'
      },
      { id: 'ask', label: '向忘言叟打听前路', goto: 'prologue.depart' }
    ],
    status: 'approved'
  },
  {
    id: 'prologue.village.calm',
    act: 'prologue',
    layerKeys: { bg: CG.village },
    lines: [
      { text: '村里稍稍安顿下来。忘言叟点了点头，目光越过屋脊，落向山外。', speaker: 'narrator' }
    ],
    choices: [
      { id: 'on', label: '动身，往太一宗去', goto: 'prologue.depart' }
    ],
    status: 'approved'
  },
  {
    // 赴宗途中·起程（docs/22 §6「赴宗途中」）。原「义举传开」bond 白送拆为三子场景
    // 戏剧化（road/token/spread）。忘言叟农事比喻 + 时间弧种子（「急不得」→ 第二幕御劫印证）。
    id: 'prologue.depart',
    act: 'prologue',
    layerKeys: { bg: CG.village },
    lines: [
      { text: '我向忘言叟辞行。他仍旧不多话，只抬手，往山外一指：「太一宗在收弟子，测灵根。走一趟，也好。」', speaker: 'narrator' },
      { text: '走出几步，他忽然又补了一句：「种地和修仙，一个理——急不得。先看水往哪里走，再动锄头。」', speaker: 'narrator' },
      { text: '（我没听懂修仙那半句，只把“先看清”记住了。那是他第一次主动教我一件事。）', speaker: 'self' }
    ],
    choices: [
      { id: 'on', label: '「我记住了。」动身上山', goto: 'prologue.depart.road' }
    ],
    status: 'approved'
  },
  {
    // 赴宗途中·义举 dilemma（docs/22 §6 途中义举戏剧化）。help 本心（bond + flag）/
    // hurry 违心（defiance）。用「先观察再拆问题」解两桩麻烦（车轴歪 / 散修心虚），非拔刀硬刚。
    id: 'prologue.depart.road',
    act: 'prologue',
    layerKeys: { bg: CG.village },
    lines: [
      { text: '出村十里，山道窄了。前头一辆商队骡车，车轮深陷泥里，赶车的急得满头汗；旁边还蹲着个凡人小贩，被两个散修拦住讨「过路钱」，篮里干果撒了一地。', speaker: 'narrator' },
      { text: '散修们瞥我一眼——一个背锄头的凡人，不值当讹。又转头去逼那小贩。', speaker: 'narrator' },
      { text: '（我手里只有一把锈锄头，真拔起来谁都救不了。先看清，再决定从哪里下手。）', speaker: 'self' },
      { text: '（骡车左轮陷得更深，是车轴歪了，硬推只会折轴；两个散修挂着太一宗外门玉牌，山门在即，他们不敢真杀人。两处都有缝，只要用对力。）', speaker: 'self' }
    ],
    choices: [
      {
        id: 'help',
        label: '先帮骡车正轴，再回头拿话挤对散修',
        response: '我蹲下摸了摸车辙，找两块碎石垫进左轮底，让赶车的慢推——车轴一正，骡车吱呀上了路。回头走到小贩那边，没拔锄头，只笑着点破两个散修的玉牌来历。他俩脸一僵，骂骂咧咧地走了。',
        effects: [
          { kind: 'add', target: 'bond', value: 6 },
          { kind: 'flag', target: 'did-righteous' },
          { kind: 'flag', target: 'road-helped' }
        ],
        goto: 'prologue.depart.token'
      },
      {
        id: 'hurry',
        label: '赶路要紧，绕过去',
        response: '我低着头绕开了。小贩那声「大哥」我没接。山道还长，测灵根不等人。',
        effects: [
          { kind: 'add', target: 'defiance', value: 5 },
          { kind: 'flag', target: 'road-bypassed' }
        ],
        goto: 'prologue.depart.silent'
      }
    ],
    status: 'approved'
  },
  {
    // 赠木哨：只作为一桩凡人恩情的实物锚，后文由小贩家人回收，不再硬接神农纹样。
    id: 'prologue.depart.token',
    act: 'prologue',
    layerKeys: { bg: CG.village },
    lines: [
      { text: '小贩拣起干果，硬往我怀里塞了一把，又从脖子上解下一样东西——一枚磨得发亮的小木哨。', speaker: 'narrator' },
      { text: '「我家丫头出生那天，她娘刻的，说戴身上辟邪。」小贩搓着手，「我没什么好谢你的，这个……你别嫌弃。」', speaker: 'narrator' },
      { text: '（哨面刻着一穗歪歪扭扭的稻子，显然出自不熟练的手。它不是什么法器，只是一家人舍得拿出来的东西。）', speaker: 'self' }
    ],
    choices: [
      {
        id: 'take',
        label: '「我收下了。」',
        response: '我把木哨揣进怀里，硬邦邦的，像这世道给我的一句实在话。',
        effects: [{ kind: 'flag', target: 'got-wooden-whistle' }],
        goto: 'prologue.depart.spread'
      }
    ],
    status: 'approved'
  },
  {
    // 义举传开（仅 road-helped 路径可达）。
    // bond 在此结算（baseline +3；help 路径已在 road 拿 +6，合计 +9，义举非白送）。
    id: 'prologue.depart.spread',
    act: 'prologue',
    layerKeys: { bg: CG.village },
    onEnter: [{ kind: 'add', target: 'bond', value: 3 }],
    lines: [
      { text: '那件骡车的事，不知怎么，比我先一步传到了太一宗山门口。', speaker: 'narrator' },
      { text: '我到的时候，山道上的猎户塞给我半块干粮，赶脚的汉子替我扶了一段行囊，连那小贩的同乡都远远冲我点头。', speaker: 'narrator' },
      { text: '（我救下的不过一辆车、一个人。可这些互不相识的手，把那件小事一路递到了山门前。）', speaker: 'self' }
    ],
    choices: [
      { id: 'on', label: '上山门，测灵根', goto: 'prologue.sect' }
    ],
    status: 'approved'
  },
  {
    // 绕行路径：明确没有义举、木哨与山道名声，避免与 help 路线交叉污染。
    id: 'prologue.depart.silent',
    act: 'prologue',
    layerKeys: { bg: CG.sectGate },
    lines: [
      { text: '我绕过泥里的骡车和被拦住的小贩，独自赶完了剩下的山路。', speaker: 'narrator' },
      { text: '到太一宗时天已经黑了。没人认得我，也没人替我说一句好话；只有鞋底的血，证明我确实走到了这里。', speaker: 'narrator' }
    ],
    choices: [
      { id: 'on', label: '上山门，测灵根', goto: 'prologue.sect' }
    ],
    status: 'approved'
  },
  {
    // 太一宗测灵：复用 prologueScenes.spirit-test 台词，第一人称化（spec F2/F3）。
    // 长老认可恒心+正义感 → 测灵柱死寂 → 「可惜了这股志气。无灵根」→ 给盘缠 → 遣返。
    // v3 换图：scene.sect-gate-v2（山门外门排队）——比第一批 sect-v2（已入门测灵柱）多一层
    // 「天才排队入场、凡人被拦门外」的对照，呼应「这里，不是凡人该待的地方」。
    id: 'prologue.sect',
    act: 'prologue',
    layerKeys: { bg: CG.sectGate },
    lines: [
      { text: '太一宗山门。少年天才们挨个按上测灵柱，掌心绽出五色光华，长老颔首记录。', speaker: 'narrator' },
      { text: '轮到我时，那长老看了看我沾泥的锄头和磨破的手，搁下笔：「根骨虽凡，能一步步走到这里，这股恒心倒少见。」', speaker: 'narrator' },
      { text: '他让我上前，掌心贴上测灵柱。死寂——像按在一块冷石头上。换更高阶的柱，依旧死寂。', speaker: 'narrator' },
      { text: '（我把手按得更实，直到掌心发白。石柱没有恶意；它只是冷静地告诉所有人，它在我身上什么也看不见。）', speaker: 'self' },
      { text: '长老的神识探过我丹田，沉默良久，长叹一声：「可惜了这股志气。无灵根——此生与修仙无缘。」', speaker: 'narrator' },
      { text: '他解下一袋盘缠，塞进我怀里：「回去吧。这里，不是凡人该待的地方。」', speaker: 'narrator' }
    ],
    choices: [
      { id: 'leave', label: '接过盘缠，转身下山', goto: 'prologue.return' }
    ],
    status: 'approved'
  },
  {
    // 回谷·忘言叟递锄头：复用 prologueScenes.intro 原文第一人称化。
    // 护栏（spec F2）：序章不点破空灵根、不出现偷天换劫诀/偷天一词（第一幕引出）。
    id: 'prologue.return',
    act: 'prologue',
    layerKeys: { bg: CG.valley },
    lines: [
      { text: '揣着那袋盘缠，我回到这破败的永恒山谷，认命种地。', speaker: 'narrator' },
      { text: '忘言叟远远看着，一言不发，只把一把锈锄头塞进我手里。', speaker: 'narrator' },
      { text: '难道没有灵根，就真的不能修仙了吗？——没人回答。', speaker: 'narrator' }
    ],
    choices: [
      { id: 'farm', label: '接过锄头，下田', goto: 'act1.battle' }
    ],
    status: 'approved'
  },

  // ============ 第一幕·转折（act: 1） ============
  {
    // 两修士斗法波及农庄·起手（docs/22 §6）。原 5 行讲述拆为 sky/cellar/stare 三子场景
    // 戏剧化。逆化劫灰（玉佩刻逆，遗言「勿…」）→ 萧无极负伤离去。
    id: 'act1.battle',
    act: 1,
    layerKeys: { bg: CG.storageRing },
    lines: [
      { text: '那场斗法来得毫无征兆。我正弯腰拔草，头顶忽然炸开两道身影——一青一灰，撞在农庄上空，灵光炸裂，半块田瞬间焦黑。', speaker: 'narrator' },
      { text: '（我来不及分辨他们是谁，只知道下一道光落下前，必须先离开无遮无挡的田埂。）', speaker: 'self' }
    ],
    choices: [
      { id: 'hide', label: '扑进田沟，抬头看', goto: 'act1.battle.sky' }
    ],
    status: 'approved'
  },
  {
    // 对照组：顺天遁光秩序井然 vs 逆天灾祸定向劈落。
    // v3 换图：scene.battle-duel-v2（青光 vs 紫黑光对撞）——比第一批 storageRing（劫灰遗物）
    // 更贴本场景「天上对照」的视觉：一青一灰两道灵光对撞。
    id: 'act1.battle.sky',
    act: 1,
    layerKeys: { bg: CG.battleDuel },
    lines: [
      { text: '我趴在沟里，仰头。远处太一宗方向，一道道遁光秩序井然地升落，像编好了号的雁阵——那是顺天道的修士，天劫绕着他们走，连衣角都不沾。', speaker: 'narrator' },
      { text: '我头顶这两道，不一样。青光那个剑意工整，近乎刻板；灰光那个，灵气乱得像一团逆流的漩涡，每硬接一记，天就阴沉一分。', speaker: 'narrator' },
      { text: '顺天的，被天护着；逆天的，天在劈他。', speaker: 'narrator' },
      { text: '（原来天劫不是落在“哪里”，而是落在“谁”身上。天意会辨认异类，然后一遍遍纠正。）', speaker: 'self' }
    ],
    choices: [
      { id: 'on', label: '屏住呼吸', goto: 'act1.battle.cellar' }
    ],
    status: 'approved'
  },
  {
    // 地窖感官浸入（震波/红光/簌簌落土）+ 灵气泄流首次被动显形。
    id: 'act1.battle.cellar',
    act: 1,
    layerKeys: { bg: CG.storageRing },
    lines: [
      { text: '一道余波砸下，我家那半边田直接塌了——地窖盖板掀飞，我连滚带爬跌了进去。地窖里黑，震波一阵阵传来，红光从缝里漏下，簌簌地落土。', speaker: 'narrator' },
      { text: '灰光那人明显撑不住了。他每挡一剑，便有一缕灵气从破绽里泄进土层；那些本该散掉的气，却沿着田沟和根须，渐渐排成了稳定的走向。', speaker: 'narrator' },
      { text: '（漏出来的不等于消失。只要有一条可走的路，它就会被接住、被送往别处。）', speaker: 'self' },
      { text: '我缩在角落，数着每次震动之间的间隔。恐惧没有少，可当我开始观察，它至少不再是一团没有边界的黑。', speaker: 'narrator' }
    ],
    choices: [
      { id: 'on', label: '等震波过去，爬出地窖', goto: 'act1.battle.stare' }
    ],
    status: 'approved'
  },
  {
    // 与萧无极一瞬对视（伏笔种子：flag:xiao-saw-face + 青光剑意特征，供 act2.side.xiao 凭此认出）。
    // 逆的「勿……」在此埋下；第四劫由实体便笺补全「勿独扛」，不以残魂代言。
    // v3 换图：scene.ni-ash-v2（玉佩刻逆 + 劫灰特写）——比第一批 storageRing（储物戒+灰）
    // 更贴本场景「玉佩滚出、人化劫灰」的瞬间（逆的遗物 + 遗言）。
    id: 'act1.battle.stare',
    act: 1,
    layerKeys: { bg: CG.niAsh },
    onEnter: [{ kind: 'flag', target: 'xiao-saw-face' }],
    lines: [
      { text: '震波停了。我爬出地窖，灰光那个人，已经坠在焦土中央。他怀里滚出一枚玉佩，上面刻着一个字——「逆」。', speaker: 'narrator' },
      { text: '他看见我了。张了张嘴，只吐出一个字：「勿……」然后整个人化作一摊劫灰，连神魂都没剩下。', speaker: 'narrator' },
      { text: '那道青光落了下来。是萧无极。他负着伤，剑尖还在滴血。低头看了我一眼——一个趴在劫灰边、满身泥土的凡人。', speaker: 'narrator' },
      { text: '我们对视了一瞬。他本可以灭口，可重伤无力，只从牙缝挤出两个字：「……蝼蚁。」然后化虹而去，剑光青得近乎刻板，和天边那道秩序井然的遁光，汇在一起。', speaker: 'narrator' },
      { text: '（他记住了我的脸。我也不知道，为什么把这当成了件大事。还有那个「勿」字——他想让我，勿什么？）', speaker: 'self' }
    ],
    choices: [
      { id: 'approach', label: '走近那摊劫灰', goto: 'act1.ring' }
    ],
    status: 'approved'
  },
  {
    // 储物戒·起手（docs/22 §4.2「打斗波动+主人神魂俱灭→戒成无主→凡人可开」用户既定）。
    // 原 5 行拆为 attempts/flash/oldman 三子场景。护栏：开戒机制不改，只采纳「试错戏剧化」手法。
    id: 'act1.ring',
    act: 1,
    layerKeys: { bg: CG.storageRing },
    lines: [
      { text: '劫灰旁边，躺着一枚储物戒。打斗的余波还没散尽，那摊灰里，再没有任何神魂的气息——主人，彻底没了。', speaker: 'narrator' },
      { text: '（我还是等了一息，等它自己发亮，或者等谁从里面开口。什么都没有。死者没有替我准备答案。）', speaker: 'self' }
    ],
    choices: [
      { id: 'try', label: '把它捡起来，试着碰碰戒面', goto: 'act1.ring.attempts' }
    ],
    status: 'approved'
  },
  {
    // 凡人开戒三次试错（触碰/血契无效 → 打斗余波+逆神魂俱灭 → 戒成无主 → 凡人可开）。
    // 戏剧化但严守 §4.2 机制（不采纳调研的「空灵根冲刷」）。
    id: 'act1.ring.attempts',
    act: 1,
    layerKeys: { bg: CG.storageRing },
    lines: [
      { text: '我把它捡起来，戒面冰凉。先以指腹按住，又试着转动内圈——都没有反应。', speaker: 'narrator' },
      { text: '（它不认触碰。若真有门槛，多半不在这具肉身表面。）', speaker: 'self' },
      { text: '我咬破指头，滴了一滴血上去。血珠在戒面滚了一圈，滑落，像滴在荷叶上。没反应。', speaker: 'narrator' },
      { text: '（血也不对。它认的应当是神魂；可原主的神魂已经散尽，留下的禁制反而失去了归属。）', speaker: 'self' },
      { text: '就在这时，天上又滚过一记打斗的余波。那道波从我身上扫过，又扫过掌心的戒——戒面忽然一震，像有什么「咔哒」一下松开了。', speaker: 'narrator' },
      { text: '神魂俱灭之后，它成了一枚真正的无主之物。连我这样一个凡人，都推得开了。', speaker: 'narrator' }
    ],
    choices: [
      { id: 'open', label: '把它翻开', goto: 'act1.ring.flash' }
    ],
    status: 'approved'
  },
  {
    // 开戒瞬间·身世闪回帧（金黄的田/长茧的手/简体字片段）——玩家此刻不懂，到 act1.scroll
    // 读简体字功法后才理解（错位嵌套）：首次瞥见神农留下的记忆帧。
    id: 'act1.ring.flash',
    act: 1,
    layerKeys: { bg: CG.storageRing },
    lines: [
      { text: '戒开了。那一瞬，我眼前闪过一帧不属于我的画面——', speaker: 'narrator' },
      { text: '一片金黄得不像这世界的田。一双手，长满茧的手，在那片田里翻土。田头立着一块木牌，上面是几个横排的、简体的、带标点的字。', speaker: 'narrator' },
      { text: '（简体字。横排。标点。一闪就没了，快得像眼花。我没看清那几个字。可那种「熟悉」，从骨头里钻了出来。）', speaker: 'self' },
      { text: '我晃了晃头，以为是饿昏了。先把这戒，翻来覆去地看。', speaker: 'narrator' }
    ],
    choices: [
      { id: 'on', label: '翻遍这枚戒', goto: 'act1.ring.oldman' }
    ],
    status: 'approved'
  },
  {
    // 戒中无残魂：再次确认“逆”已彻底死亡；后续信息只能来自实物与文字。
    id: 'act1.ring.oldman',
    act: 1,
    layerKeys: { bg: CG.storageRing },
    lines: [
      { text: '我把戒里每一寸都翻过。没有残魂，没有传音，也没有被封住的第二层意识。', speaker: 'narrator' },
      { text: '那个本可以解释一切的人，已经在戒外化成劫灰，只留下临死前的一个字——「勿」。', speaker: 'narrator' },
      { text: '（所以我能依靠的，只剩他留下的实物，以及我是否读得懂它们。）', speaker: 'self' },
      { text: '……一个走投无路的人，给另一个走投无路的人留下的东西。', speaker: 'heart-demon' },
      { text: '我把那枚刻「逆」的玉佩攥紧了一点。勿。勿什么？他没说完。这世上最让人睡不着的，不是答案，是一句没说完的话。', speaker: 'narrator' }
    ],
    choices: [
      { id: 'on', label: '翻那卷《偷天换劫诀》', goto: 'act1.scroll' }
    ],
    status: 'approved'
  },
  {
    // 翻偷天换劫诀：震惊——竟是原世界文字（docs/22 §4.5 口诀原文作 lines）+ 日记。
    id: 'act1.scroll',
    act: 1,
    layerKeys: { bg: CG.script },
    lines: [
      { text: '戒里是些零碎：几粒异种种子、一卷残缺丹谱、一只破炉、半枚刻「逆」的玉佩，还有一卷残卷，封皮四个字——《偷天换劫诀》。', speaker: 'narrator' },
      { text: '我翻开残卷，只读了一句，手就抖了。', speaker: 'narrator' },
      { text: '「此诀非人所修。无灵根者，方可习之。以劫为薪，以骨为柴。偷天一线，换劫三生。习此诀者，已死。」', speaker: 'heart-demon' },
      { text: '这些字，是我原世界的字。简体，横排，标点都在该在的位置——不是这世界的任何一种古文。', speaker: 'narrator' },
      { text: '偈语之下，是一篇年代更久的正文；页边另有较新的批注，像有人用几十年，把前人的路重新走过、校验、补齐。正文与批注都不藏私，把「偷天」一点点拆成四步。', speaker: 'narrator' },
      { text: '一曰「察漏」。空灵根不蓄气，寻常修士当它是废；可废有废的好处——它不拒。天劫劈来，凡骨当碎，可那一劫的力道里，总有半成、一成，会从骨头崩开的缝里漏过去。旁人硬抗，把漏掉的一缕当损耗；这卷却说，这一缕，才是无灵根者唯一能上手的东西。', speaker: 'narrator' },
      { text: '要练它，先磨眼力：雷落之前，看清它要劈在哪一处、会从哪一道骨缝里漏。看不清，便接不住。', speaker: 'narrator' },
      { text: '二曰「引路」。漏过去的那一缕是野的，会乱窜，烧穿皮肉。要给它预先铺一条该走的线——按阵理，在骨上刻好走向，像在田里先挖好渠，水来了顺渠走，不漫不淹。', speaker: 'narrator' },
      { text: '这步最吃慢功夫。线刻浅了，劫一冲就溃；刻深了，劫走不动，反堵死在半路。批注里一笔一画地写：宁可慢，宁可细，一道一道地引。', speaker: 'narrator' },
      { text: '三曰「借势」。劫有来势，有去势。硬抗是顶牛，顶不过便是死。这步不顶——顺它来的势，把它送进你要它去的骨缝；再借它去时的回劲，把淬炼的力，钉得更深。', speaker: 'narrator' },
      { text: '如治水：堵则溃，疏则通。借它一分势，省自己三分力。', speaker: 'narrator' },
      { text: '四曰「淬骨」。引进来、顺过去的劫，最终都要落进骨头里。凡骨被一道道劫淬过，碎了，又用那劫的余烬，一寸寸重塑。旧的死去，新的长成——长成的，不再是凡骨。', speaker: 'narrator' },
      { text: '这一步没有取巧。每一寸新生，都拿一寸旧骨去换。所以残卷开篇那句「习此诀者，已死」，不是诅咒——是账。', speaker: 'narrator' },
      { text: '（察漏，引路，借势，淬骨。看清，布线，借力，落实物。这不是什么玄学，是一套照着走的法子——和我原世界拆解任何一道难题，是一个路数。写这卷的人，跟我，是一个脑子。）', speaker: 'self' },
      { text: '戒里还有一本日记。它的字迹与页边批注相同，却和残卷正文不同。最后一页只写了一句：我走通了。后来者，愿你也是。', speaker: 'narrator' }
    ],
    choices: [
      { id: 'reveal', label: '合上残卷，理清头绪', goto: 'act1.reveal' }
    ],
    status: 'approved'
  },
  {
    // 揭示链（docs/22 §4.3）：逆是异乡人空灵根者；神农是更早异乡人先驱；
    // 「能读这文字」=我亦异乡人/空灵根铁证。不写屈辱戏。
    id: 'act1.reveal',
    act: 1,
    layerKeys: { bg: CG.script },
    lines: [
      { text: '我坐在田埂上，想了很久，终于把这些碎片拼成了一条线。', speaker: 'narrator' },
      { text: '那个化灰的「逆」，是另一个异乡人。日记和页边批注属于他：他同样被判无灵根，却照着残卷把这条路走通了。', speaker: 'narrator' },
      { text: '而残卷正文来自更早的异乡人——一个在我们之前不知多少年，以凡人之躯研究灵田、拆解天劫的人。', speaker: 'narrator' },
      { text: '人们后来给他起了个名字，叫神农。', speaker: 'narrator' },
      { text: '「能读这文字」本身，就是铁证——我，也是异乡人；这副被判废的躯壳里，是空灵根。', speaker: 'narrator' },
      { text: '测灵柱没说错，长老也没说错。只是这世上，另有一条不给灵柱看见的路。', speaker: 'narrator' },
      { text: '我怔住。空灵根不是藏起来的灵根，也不是迟到的恩赐。它只是一个没有容量、却能让力量通过的空处——弱点与道路，原来是同一件事。', speaker: 'self' }
    ],
    choices: [
      { id: 'seclude', label: '把它埋回去，老老实实种田', goto: 'act1.seclude' },
      {
        id: 'practice',
        label: '「习此诀者，已死。」——我偏要习',
        effects: [
          { kind: 'add', target: 'cultProgress', value: 1 },
          { kind: 'flag', target: 'chose-practice' }
        ],
        goto: 'act2.train'
      }
    ],
    status: 'approved'
  },
  {
    // 埋藏归隐 → 凡人蒙太奇（种田/老去/现代记忆模糊，几十年一闪）→ 寿终·落叶异乡。
    // v3 换图：scene.mortal-montage-v2（凡人蒙太奇：青年/中年/白发叠层，同一把锄头）——
    // 比第一批 valley（山谷天光）更贴本场景「几十年像一眨眼」的时间压缩感。
    id: 'act1.seclude',
    act: 1,
    layerKeys: { bg: CG.mortalMontage },
    lines: [
      { text: '我把残卷和日记，埋回了那摊劫灰旁边。锄头很沉，日子很长。', speaker: 'narrator' },
      { text: '春种秋收，修渠赶猪。村里的大娘换了一代又一代，当年那双塞给我的鞋，早已朽在角落。', speaker: 'narrator' },
      { text: '几十年像一眨眼。那些简体字，那些关于「逆」和「神农」的念头，慢慢模糊成一种说不清的怅惘。', speaker: 'narrator' },
      { text: '我老在一把锈锄头旁边。到最后，我甚至不太记得，自己是从哪里来的了。', speaker: 'narrator' }
    ],
    ends: 'lifespan-death',
    status: 'approved'
  },

  // ============ 第二幕·淬劫（act: 2） ============
  {
    // 主修炼 hub：第一次完整入场，后续导航回访直接列剩余选项。
    id: 'act2.train',
    act: 2,
    layerKeys: { bg: CG.valley },
    revisitMode: 'choices-only',
    lines: [
      { text: '灵田稳固下来以后，我把《偷天换劫诀》摊在膝上。残卷不许人跳步：看不见漏口，便不能引路；引不稳，便谈不上借势。', speaker: 'narrator' },
      { text: '下一步可以炼丹、寻访旧迹、处理村外的事，或者继续用自己的骨头验证那四句话。', speaker: 'narrator' }
    ],
    choices: [
      { id: 'temper', label: '继续淬体，把残卷练进骨里', goto: 'act2.temper' },
      { id: 'alchemy', label: '只炼一次渡劫丹，决定药性与代价', once: true, goto: 'act2.alchemy' },
      { id: 'lore-hub', label: '巡视灵田，核对神农留下的痕迹', goto: 'act2.train.lore-hub' },
      { id: 'side', label: '离开灵田，看看这条路会伤到谁', goto: 'act2.side.hub' },
      { id: 'assault', label: '六劫圆满，叩开紫雷关', requires: 'cultProgress>=7', goto: 'act3.entry' }
    ],
    status: 'approved'
  },
  {
    id: 'act2.train.lore-hub',
    act: 2,
    layerKeys: { bg: CG.spiritFarm },
    revisitMode: 'choices-only',
    lines: [
      { text: '田埂、残卷、石像和村志并不在讲四件事。它们只是从不同方向，留下同一个人的手迹。', speaker: 'narrator' }
    ],
    choices: [
      { id: 'peek', label: '读残卷中被烧焦的推演页', once: true, goto: 'act2.peek' },
      { id: 'lore-farm', label: '测一遍灵田的回流', once: true, goto: 'act2.farm-lore' },
      { id: 'lore-relic', label: '再看荒草中的无面石像', once: true, goto: 'act2.relic-lore' },
      { id: 'lore-annals', label: '把村志与残卷逐行对照', once: true, goto: 'act2.annals-lore' },
      { id: 'back', label: '收好记录，回灵田', goto: 'act2.train' }
    ],
    status: 'approved'
  },
  {
    id: 'act2.temper',
    act: 2,
    layerKeys: { bg: CG.tribulation },
    revisitMode: 'choices-only',
    lines: [
      { text: '我在田中央埋下引雷石。前六道劫不是六次重复受刑，而是六次验证：每一次只多学一件事，也多留一道不会消失的伤。', speaker: 'narrator' },
      { text: '残卷翻在当前那一页。还没走完的步骤，不能靠意气越过去。', speaker: 'self' }
    ],
    choices: [
      { id: 'stage1', label: '第一劫·察漏——先看雷从哪里逃', requires: 'cultProgress>=1 && cultProgress<2', once: true, goto: 'act2.temper.stage1' },
      { id: 'stage2', label: '第二劫·引路——先刻渠，再接雷', requires: 'cultProgress>=2 && cultProgress<3', once: true, goto: 'act2.temper.stage2' },
      { id: 'stage3', label: '第三劫·借势——借来路，也借去势', requires: 'cultProgress>=3 && cultProgress<4', once: true, goto: 'act2.temper.stage3' },
      { id: 'more', label: '前三劫已过，翻到残卷后半', requires: 'cultProgress>=4', goto: 'act2.temper.late' },
      { id: 'rest', label: '封住引雷石，回灵田', goto: 'act2.train' }
    ],
    status: 'approved'
  },
  {
    id: 'act2.temper.late',
    act: 2,
    layerKeys: { bg: CG.tribulation },
    revisitMode: 'choices-only',
    lines: [
      { text: '残卷后半的纸边满是血指印。前三步教我怎样接住雷，后三重才问：接住以后，我愿意拿什么去换。', speaker: 'narrator' }
    ],
    choices: [
      { id: 'stage4', label: '第四劫·淬骨——让旧骨真正死一次', requires: 'cultProgress>=4 && cultProgress<5', once: true, goto: 'act2.temper.stage4' },
      { id: 'stage5', label: '第五劫·守我——决定哪些记忆不能烧', requires: 'cultProgress>=5 && cultProgress<6', once: true, goto: 'act2.temper.stage5' },
      { id: 'stage6', label: '第六劫·归一——独走，或让万物分担', requires: 'cultProgress>=6 && cultProgress<7', once: true, goto: 'act2.temper.stage6' },
      { id: 'break', label: '撕掉止劫符，让所有雷同时落下', goto: 'act2.madness-death' },
      { id: 'back', label: '合上后半卷，退回浅处', goto: 'act2.temper' }
    ],
    status: 'approved'
  },
  {
    id: 'act2.temper.stage1',
    act: 2,
    layerKeys: { bg: CG.tribulation },
    lines: [
      { text: '第一道雷落下前，残卷要我什么都别做，只看。可身体的本能在尖叫，催我抬手、缩肩、躲开。', speaker: 'narrator' },
      { text: '雷光贴近皮肤时，我终于看见：主力劈向锁骨，尾端却有一线苍白，从右臂旧伤旁滑走。那不是弱雷，是整道劫唯一不受天意约束的余量。', speaker: 'narrator' },
      { text: '察漏不是找安全处。它是在必然受伤之前，辨认哪一缕还可以由我决定。', speaker: 'self' }
    ],
    choices: [
      {
        id: 'on',
        label: '等雷尾越过旧伤，再扣住那一线',
        response: '我晚了半息才收拢空灵根。锁骨照样裂开，可那一线苍白被留在臂骨里，像黑夜中第一条可复走的路。',
        speaker: 'self',
        effects: [
          { kind: 'add', target: 'cultProgress', value: 1 },
          { kind: 'add', target: 'tribGrip', value: 10 },
          { kind: 'add', target: 'madness', value: 3 },
          { kind: 'add', target: 'lifespan', value: -5 },
          { kind: 'flag', target: 'temper-stage1-steady' }
        ],
        goto: 'act2.temper'
      },
      {
        id: 'force',
        label: '在雷尾显形前强行攥住它',
        response: '我抢早了。雷尾确实被截住，右臂却从指尖抖到肩头；我学会了察漏，也在骨里留下了一阵再也消不干净的颤。',
        speaker: 'self',
        effects: [
          { kind: 'add', target: 'cultProgress', value: 1 },
          { kind: 'add', target: 'tribGrip', value: 6 },
          { kind: 'add', target: 'madness', value: 7 },
          { kind: 'add', target: 'lifespan', value: -8 },
          { kind: 'add', target: 'defiance', value: 4 },
          { kind: 'flag', target: 'temper-stage1-forced' }
        ],
        goto: 'act2.temper'
      }
    ],
    status: 'approved'
  },
  {
    id: 'act2.temper.stage2',
    act: 2,
    layerKeys: { bg: CG.spiritFarm },
    lines: [
      { text: '第二劫之前，我照着田渠的坡度，在引雷石之间刻出三条窄槽，又用药泥沿右臂旧伤画出一条更细的骨线。', speaker: 'narrator' },
      { text: '雷一进来便想乱窜。所谓引路，不是命令它听话，而是提前让错误的方向更难走，让唯一能活的方向足够清楚。', speaker: 'narrator' },
      { text: '最窄的一处正在发热。再深一分，骨线会堵死；再浅一分，雷会冲进心脉。', speaker: 'self' }
    ],
    choices: [
      {
        id: 'on',
        label: '削薄药泥，让雷沿骨线缓慢通过',
        response: '我用指甲刮开半层药泥。雷被迫收窄，沿右臂、肩骨、脊柱一节节走完；每一节都疼，却没有一处失控。',
        speaker: 'self',
        effects: [
          { kind: 'add', target: 'cultProgress', value: 1 },
          { kind: 'add', target: 'tribGrip', value: 10 },
          { kind: 'add', target: 'madness', value: 4 },
          { kind: 'add', target: 'lifespan', value: -6 },
          { kind: 'flag', target: 'temper-stage2-steady' }
        ],
        goto: 'act2.temper'
      },
      {
        id: 'force',
        label: '加深骨线，让整道雷一次灌入',
        response: '雷走得更快，也更凶。骨线没有断，肩后的皮肉却被热流撕开；我换来了速度，也让下一道劫记住了这处薄弱。',
        speaker: 'self',
        effects: [
          { kind: 'add', target: 'cultProgress', value: 1 },
          { kind: 'add', target: 'tribGrip', value: 6 },
          { kind: 'add', target: 'madness', value: 8 },
          { kind: 'add', target: 'lifespan', value: -9 },
          { kind: 'add', target: 'defiance', value: 4 },
          { kind: 'flag', target: 'temper-stage2-forced' }
        ],
        goto: 'act2.temper'
      }
    ],
    status: 'approved'
  },
  {
    id: 'act2.temper.stage3',
    act: 2,
    layerKeys: { bg: CG.tribulation },
    lines: [
      { text: '第三道雷顺着旧骨线而来。它比前两道更快，因为天也学会了我的路。', speaker: 'narrator' },
      { text: '残卷把一道劫画成来回两笔：第一笔压入，第二笔反弹。硬抗只看见第一笔；借势的人，要在第二笔离身时把淬炼的力留下。', speaker: 'narrator' },
      { text: '雷势已经压到膝骨。我可以跟着它沉下去，也可以逆着疼痛提前抬身。', speaker: 'self' }
    ],
    choices: [
      {
        id: 'on',
        label: '顺势跪下，在回弹时锁住余劲',
        response: '双膝砸进泥里，雷从脊柱贯到脚底；等它回身的一瞬，我才收紧骨线。离去的是雷，留下的是一层更密的骨质。',
        speaker: 'self',
        effects: [
          { kind: 'add', target: 'cultProgress', value: 1 },
          { kind: 'add', target: 'tribGrip', value: 10 },
          { kind: 'add', target: 'madness', value: 4 },
          { kind: 'add', target: 'lifespan', value: -6 },
          { kind: 'flag', target: 'temper-stage3-steady' }
        ],
        goto: 'act2.temper'
      },
      {
        id: 'force',
        label: '逆势站起，把来势和去势一并压住',
        response: '我站住了，也听见腿骨里一连串细碎的裂声。两股力都被留下，淬炼更深；可从此每逢雷雨，膝弯都会先一步发痛。',
        speaker: 'self',
        effects: [
          { kind: 'add', target: 'cultProgress', value: 1 },
          { kind: 'add', target: 'tribGrip', value: 7 },
          { kind: 'add', target: 'madness', value: 8 },
          { kind: 'add', target: 'lifespan', value: -9 },
          { kind: 'add', target: 'defiance', value: 5 },
          { kind: 'flag', target: 'temper-stage3-forced' }
        ],
        goto: 'act2.temper'
      }
    ],
    status: 'approved'
  },
  {
    id: 'act2.temper.stage4',
    act: 2,
    layerKeys: { bg: CG.tribulation },
    lines: [
      { text: '第四劫真正落进骨里时，前三次的裂纹同时张开。旧骨像被从身体里逐根拔走，疼痛不再有明确的位置。', speaker: 'narrator' },
      { text: '我在残卷夹层里摸到一张折得极小的纸。是逆的字迹：第四劫后，停雷三息。让药、阵、土地替你各接一息。勿独扛。', speaker: 'narrator' },
      { text: '这不是残魂，也不是临终传音。只是一个走过这里的人，提前写下他付过的学费。', speaker: 'self' }
    ],
    choices: [
      {
        id: 'on',
        label: '停雷三息，让药、阵与土地分担',
        response: '第一息，药泥封住血；第二息，引雷石替我崩掉一角；第三息，脚下湿土吞走余热。新骨在这三口喘息里一寸寸接回。',
        speaker: 'self',
        effects: [
          { kind: 'add', target: 'cultProgress', value: 1 },
          { kind: 'add', target: 'tribGrip', value: 10 },
          { kind: 'add', target: 'madness', value: 6 },
          { kind: 'add', target: 'lifespan', value: -7 },
          { kind: 'flag', target: 'temper-stage4-shared' }
        ],
        goto: 'act2.temper.late'
      },
      {
        id: 'force',
        label: '不停雷，让新骨在雷中一次长成',
        response: '我把纸压回残卷。新骨确实长得更快，代价是每一寸都带着未散的雷意；它们服从我，也时时想把我从里面烧开。',
        speaker: 'self',
        effects: [
          { kind: 'add', target: 'cultProgress', value: 1 },
          { kind: 'add', target: 'tribGrip', value: 7 },
          { kind: 'add', target: 'madness', value: 10 },
          { kind: 'add', target: 'lifespan', value: -10 },
          { kind: 'add', target: 'defiance', value: 6 },
          { kind: 'flag', target: 'temper-stage4-forced' }
        ],
        goto: 'act2.temper.late'
      }
    ],
    status: 'approved'
  },
  {
    id: 'act2.temper.stage5',
    act: 2,
    layerKeys: { bg: CG.purpleSky },
    lines: [
      { text: '第五劫没有先劈肉身。雷声一响，我原世界的街道、窗灯、姓名，像被水浸过的墨，一层层淡下去。', speaker: 'narrator' },
      { text: '功法正在重写这副身体，也顺手把“不再需要”的东西烧掉。若什么都不拦，空灵根会变得更顺；若要留下记忆，就必须给它一个比疼痛更牢的锚。', speaker: 'narrator' },
      { text: '我能想起田里第一道水声、忘言叟递来的锄头、山路上那枚木哨可能有的重量。至于旧名，只剩一个模糊的口形。', speaker: 'self' }
    ],
    choices: [
      {
        id: 'on',
        label: '反复默念我曾接住的人与事',
        response: '名字仍有缺口，可那些人的手、眼神和欠下的情分留了下来。它们不解释我是谁，却阻止我变成一条只会运转的功法。',
        speaker: 'self',
        effects: [
          { kind: 'add', target: 'cultProgress', value: 1 },
          { kind: 'add', target: 'tribGrip', value: 9 },
          { kind: 'add', target: 'madness', value: 5 },
          { kind: 'add', target: 'lifespan', value: -7 },
          { kind: 'add', target: 'bond', value: 4 },
          { kind: 'flag', target: 'kept-human-anchor' }
        ],
        goto: 'act2.temper.late'
      },
      {
        id: 'force',
        label: '放弃旧名，让空灵根运转得更彻底',
        response: '我不再追那两个已经模糊的字。功法顿时顺畅许多，识海也安静下来；只是那安静太像一间被搬空的屋子。',
        speaker: 'self',
        effects: [
          { kind: 'add', target: 'cultProgress', value: 1 },
          { kind: 'add', target: 'tribGrip', value: 8 },
          { kind: 'add', target: 'madness', value: 9 },
          { kind: 'add', target: 'lifespan', value: -9 },
          { kind: 'add', target: 'defiance', value: 7 },
          { kind: 'add', target: 'bond', value: -2 },
          { kind: 'flag', target: 'shed-old-name' }
        ],
        goto: 'act2.temper.late'
      }
    ],
    status: 'approved'
  },
  {
    id: 'act2.temper.stage6',
    act: 2,
    layerKeys: { bg: CG.spiritFarm },
    lines: [
      { text: '第六劫之前，我把前五次留下的裂纹画成一张完整的图。它们不是伤势清单，而是一套已经被身体验证过的阵路。', speaker: 'narrator' },
      { text: '最后一重不再教新术。察漏、引路、借势、淬骨必须在同一道雷里同时完成；差别只在于，我把阵眼放在自己身上，还是放进整片灵田。', speaker: 'narrator' },
      { text: '田里有根、有水、有石，也有许多与我无关却真实活着的东西。它们能分担，但分担就意味着我不再独占这份力量。', speaker: 'self' }
    ],
    choices: [
      {
        id: 'on',
        label: '以灵田为阵，让万物各接一线',
        response: '雷落下时，田渠亮成一张巨大的脉络。根须替我引路，湿土替我卸势，引雷石替我先碎；我仍受伤，却第一次没有把所有疼痛都关在自己体内。',
        speaker: 'self',
        effects: [
          { kind: 'add', target: 'cultProgress', value: 1 },
          { kind: 'add', target: 'tribGrip', value: 12 },
          { kind: 'add', target: 'madness', value: 6 },
          { kind: 'add', target: 'lifespan', value: -8 },
          { kind: 'add', target: 'bond', value: 4 },
          { kind: 'flag', target: 'full-cycle-field' }
        ],
        goto: 'act2.train'
      },
      {
        id: 'force',
        label: '以自身为唯一阵眼，独吞整道雷',
        response: '我把田渠全部切断。雷只在我体内完成四步，干净、迅速、没有旁支；等云散时，脚下的草全伏倒了，只有我还站着。',
        speaker: 'self',
        effects: [
          { kind: 'add', target: 'cultProgress', value: 1 },
          { kind: 'add', target: 'tribGrip', value: 8 },
          { kind: 'add', target: 'madness', value: 10 },
          { kind: 'add', target: 'lifespan', value: -11 },
          { kind: 'add', target: 'defiance', value: 8 },
          { kind: 'flag', target: 'full-cycle-self' }
        ],
        goto: 'act2.train'
      }
    ],
    status: 'approved'
  },
  {
    id: 'act2.alchemy',
    act: 2,
    layerKeys: { bg: CG.script },
    lines: [
      { text: '残缺丹谱只能拼出七成。主药能护住新骨，缺失的那三成却决定丹毒往哪里沉。', speaker: 'narrator' },
      { text: '炉开时，一丝熟悉的腥味从丹香里钻出来——和我初到此地误食的毒菇相近。那次侥幸活下来的记忆，终于不只是笑谈。', speaker: 'narrator' },
      { text: '我可以牺牲药性，把毒逼出去；也可以把药力全部封进丹里，承认它会在以后讨债。', speaker: 'self' }
    ],
    choices: [
      {
        id: 'back',
        label: '弃去三成药力，慢火逼出毒性',
        response: '丹丸最后只剩拇指大，颜色也淡了。它不能替我渡劫，却能在碎骨时护住一口气。',
        effects: [
          { kind: 'add', target: 'pillPoison', value: 8 },
          { kind: 'add', target: 'tribGrip', value: 8 },
          { kind: 'add', target: 'lifespan', value: -2 },
          { kind: 'flag', target: 'alchemy-purified' }
        ],
        goto: 'act2.train'
      },
      {
        id: 'seal',
        label: '保全药力，把丹毒一并封入',
        response: '丹成得近乎完美。我吞下去时没有疼，只在舌根留下一点铁锈味——越安静的代价，往往越晚开口。',
        effects: [
          { kind: 'add', target: 'pillPoison', value: 35 },
          { kind: 'add', target: 'tribGrip', value: 12 },
          { kind: 'add', target: 'lifespan', value: -5 },
          { kind: 'add', target: 'madness', value: 4 },
          { kind: 'flag', target: 'alchemy-sealed-poison' }
        ],
        goto: 'act2.train'
      },
      {
        id: 'overdose',
        label: '趁炉火未熄，把三枚试丹一并吞下',
        response: '第一枚护住心脉，第二枚堵住气血，第三枚把前两枚压住的毒全部推回心口。这个结果并不突然——只是我决定不再听警告。',
        ends: 'poison-death'
      }
    ],
    status: 'approved'
  },
  {
    id: 'act2.peek',
    act: 2,
    layerKeys: { bg: CG.script },
    onEnter: [
      { kind: 'add', target: 'defiance', value: 10 },
      { kind: 'add', target: 'madness', value: 5 },
      { kind: 'flag', target: 'read-burned-theory' }
    ],
    lines: [
      { text: '烧焦的推演页不讲招式，只记录天劫如何辨认“异常”：灵气回流、命数偏差、肉身不合常轨，都会让天意收紧。', speaker: 'narrator' },
      { text: '我每读懂一条，便更清楚自己为何被盯上，也更清楚该怎样让下一次异常发生在天意来不及修正的地方。', speaker: 'narrator' },
      { text: '知识没有立刻给我力量。它先拿走了一层无知带来的安稳。', speaker: 'self' }
    ],
    choices: [
      { id: 'back', label: '封好焦页，回灵田', goto: 'act2.train' }
    ],
    status: 'approved'
  },
  {
    id: 'act2.farm-lore',
    act: 2,
    layerKeys: { bg: CG.spiritFarm },
    onEnter: [
      { kind: 'lore', target: 'lore', value: 2 },
      { kind: 'add', target: 'bond', value: 4 },
      { kind: 'flag', target: 'found-field-grid' }
    ],
    lines: [
      { text: '我沿田埂逐点测量，发现灵气回流不是天然圆环，而是被人按季节、坡度与根系重新排过。', speaker: 'narrator' },
      { text: '每处转折都留下试错：旧渠被填平，新渠向旁偏了半尺，像有人花了许多年，才把一套错误慢慢改成可用。', speaker: 'narrator' },
      { text: '隔壁老农说，祖辈只记得“那个人来了以后，虫少了，谷多了”。土地记得的，比名字精确。', speaker: 'narrator' }
    ],
    choices: [
      { id: 'back', label: '把测点记进残卷，回灵田', goto: 'act2.train' }
    ],
    status: 'approved'
  },
  {
    id: 'act2.relic-lore',
    act: 2,
    layerKeys: { bg: CG.facelessStatue },
    onEnter: [
      { kind: 'lore', target: 'lore', value: 2 },
      { kind: 'add', target: 'bond', value: 3 },
      { kind: 'flag', target: 'found-faceless-relic' }
    ],
    lines: [
      { text: '荒草深处的石像没有五官，基座却被一代代凡人的手摸得发亮。', speaker: 'narrator' },
      { text: '石像脚边埋着早已绝迹的灵虫外壳，壳上有细小切痕。那不是祭品，是被剖开、记录过的标本。', speaker: 'narrator' },
      { text: '被纪念的人拒绝留下脸，却没有抹掉做事的方法。', speaker: 'self' }
    ],
    choices: [
      { id: 'back', label: '清掉石像脚边的草，回灵田', goto: 'act2.train' }
    ],
    status: 'approved'
  },
  {
    id: 'act2.annals-lore',
    act: 2,
    layerKeys: { bg: CG.villageDawn },
    onEnter: [
      { kind: 'lore', target: 'lore', value: 2 },
      { kind: 'add', target: 'bond', value: 3 },
      { kind: 'flag', target: 'found-famine-annal' }
    ],
    lines: [
      { text: '村志在大饥之年只留了半页：有异人寄居田侧，不受香火，不留姓名。三年后虫患尽，稻谷倍熟。', speaker: 'narrator' },
      { text: '我把年月、虫种和残卷里的试验编号对在一起。传说里一句“神迹”，背后是三年没有被写下来的失败。', speaker: 'narrator' }
    ],
    choices: [
      { id: 'back', label: '夹好那半页村志，回灵田', goto: 'act2.train' }
    ],
    status: 'approved'
  },
  {
    id: 'act2.side.hub',
    act: 2,
    layerKeys: { bg: CG.villageDawn },
    revisitMode: 'choices-only',
    lines: [
      { text: '离开灵田以后，问题不再按功法的四步排列。人会撒谎、会求救，也会把自己的损失推给更弱的人。', speaker: 'narrator' }
    ],
    choices: [
      { id: 'bully', label: '山道上，散修正在搜刮凡人', once: true, goto: 'act2.side.bully' },
      { id: 'herb', label: '崖边传来采药女的呼救', once: true, goto: 'act2.side.herb' },
      { id: 'bribe', label: '矿场请我把污水阵改向下游村', once: true, goto: 'act2.side.bribe' },
      { id: 'more', label: '继续往前，看看更远的风波', goto: 'act2.side.more-hub' },
      { id: 'back', label: '不再停留，回灵田', goto: 'act2.train' }
    ],
    status: 'approved'
  },
  {
    id: 'act2.side.more-hub',
    act: 2,
    layerKeys: { bg: CG.sectGate },
    revisitMode: 'choices-only',
    lines: [
      { text: '再往前，牵扯的不只是眼前一人：宗门的旧账、荒年的粮仓，以及萧无极始终没有收回的目光。', speaker: 'narrator' }
    ],
    choices: [
      { id: 'whistle', label: '查一桩被宗门抹去姓名的劫亡', once: true, goto: 'act2.side.whistle' },
      { id: 'xiao', label: '萧无极的剑光再次落向山谷', requires: 'cultProgress>=3', once: true, goto: 'act2.side.xiao' },
      { id: 'famine', label: '荒年将至，村中粮仓见底', once: true, goto: 'act2.side.famine' },
      { id: 'village', label: '折返荒村，看看还能补上什么', goto: 'act2.village.hub' },
      { id: 'back', label: '回到近处的山道', goto: 'act2.side.hub' }
    ],
    status: 'approved'
  },
  {
    id: 'act2.side.bully',
    act: 2,
    layerKeys: { bg: CG.villageDawn },
    lines: [
      { text: '一个散修把凡人的粮袋逐个割开，声称这是“借道供奉”。那凡人跪在泥里，手还护着最后一小袋种子。', speaker: 'narrator' }
    ],
    choices: [
      {
        id: 'act',
        label: '先护住种子，再逼散修退还粮袋',
        response: '我没有追杀他，只用引雷石在他脚边劈出一道焦痕。凡人把种子抱回怀里时，手仍在抖。',
        effects: [
          { kind: 'add', target: 'bond', value: 8 },
          { kind: 'flag', target: 'did-righteous' },
          { kind: 'flag', target: 'stopped-road-extortion' }
        ],
        goto: 'act2.side.hub'
      },
      {
        id: 'watch',
        label: '低头走过，不让麻烦落到自己身上',
        response: '我听见粮粒从破袋里落进泥水，却没有回头。那声音很轻，后来每次静下来都能听见。',
        effects: [
          { kind: 'add', target: 'defiance', value: 15 },
          { kind: 'add', target: 'bond', value: -2 },
          { kind: 'flag', target: 'ignored-road-extortion' }
        ],
        goto: 'act2.side.hub'
      }
    ],
    status: 'approved'
  },
  {
    id: 'act2.side.herb',
    act: 2,
    layerKeys: { bg: CG.villageDawn },
    lines: [
      { text: '采药女一条腿卡在崖缝里，背篓已经坠下去。她看见我，先看我的眼睛，再看我身后的路。', speaker: 'narrator' },
      { text: '救她要在天黑前折返十里；不救，我仍能赶上自己的修炼时辰。', speaker: 'self' }
    ],
    choices: [
      {
        id: 'save',
        label: '拆下背带固定伤腿，背她下山',
        response: '她一路咬着衣袖没出声。到村口才把一包止血草塞给我，说这不是谢礼，是下次别把自己也弄断。',
        effects: [
          { kind: 'add', target: 'bond', value: 8 },
          { kind: 'add', target: 'lifespan', value: -2 },
          { kind: 'flag', target: 'herb-saved' }
        ],
        goto: 'act2.side.hub'
      },
      {
        id: 'abandon',
        label: '记住她的位置，先赶自己的路',
        response: '我告诉自己会找人回来。可走出很远以后，天已经黑了；我没有再确认她是否等到别人。',
        effects: [
          { kind: 'add', target: 'defiance', value: 15 },
          { kind: 'add', target: 'bond', value: -2 },
          { kind: 'flag', target: 'herb-abandoned' }
        ],
        goto: 'act2.side.hub'
      }
    ],
    status: 'approved'
  },
  {
    id: 'act2.side.bribe',
    act: 2,
    layerKeys: { bg: CG.market },
    lines: [
      { text: '矿场管事请我改一座排浊阵。图纸上只挪三笔，矿坑就能清净；代价是所有毒水会顺河灌进下游凡村。', speaker: 'narrator' },
      { text: '他把灵石推到我面前，说下游的人不会知道是谁改的。', speaker: 'narrator' }
    ],
    choices: [
      {
        id: 'refuse',
        label: '退回灵石，把图纸交给下游村',
        response: '管事当场翻脸。我带着图纸连夜下山，至少让村里有时间封井、改渠。',
        effects: [
          { kind: 'add', target: 'bond', value: 6 },
          { kind: 'add', target: 'madness', value: 2 },
          { kind: 'flag', target: 'warned-downstream' }
        ],
        goto: 'act2.side.hub'
      },
      {
        id: 'accept',
        label: '收下灵石，把浊流改向下游',
        response: '三笔阵纹改完，矿坑的水立刻清了。几日后河面漂起死鱼，我把那袋灵石埋进了最深的柜底。',
        effects: [
          { kind: 'add', target: 'defiance', value: 15 },
          { kind: 'add', target: 'bond', value: -4 },
          { kind: 'add', target: 'tribGrip', value: 4 },
          { kind: 'flag', target: 'diverted-mine-waste' }
        ],
        goto: 'act2.side.hub'
      }
    ],
    status: 'approved'
  },
  {
    id: 'act2.side.whistle',
    act: 2,
    layerKeys: { bg: CG.sectGate },
    lines: [
      { text: '宗门劫亡簿上，有三名外门弟子只剩日期，没有姓名。最后一人的伤势描述，与逆坠落前的劫伤几乎相同。', speaker: 'narrator' },
      { text: '旁边另夹一张调令：将“异常渡劫者”引离山门，再由萧无极处置。若公开，太一宗不会只追究抄簿的人。', speaker: 'narrator' }
    ],
    choices: [
      {
        id: 'expose',
        label: '抄下姓名和调令，分送各地',
        response: '我把同一份证据送了七处。毁掉一份已经没有用；从这天起，宗门也有了必须遮掩我的理由。',
        effects: [
          { kind: 'add', target: 'bond', value: 6 },
          { kind: 'add', target: 'madness', value: 4 },
          { kind: 'flag', target: 'exposed-tribulation-ledger' }
        ],
        goto: 'act2.side.more-hub'
      },
      {
        id: 'silent',
        label: '记住内容，把簿页原样放回',
        response: '我知道了真相，也决定让那三个名字继续空着。知识留在我这里，没有替任何人改变结果。',
        effects: [
          { kind: 'add', target: 'defiance', value: 15 },
          { kind: 'flag', target: 'hid-tribulation-ledger' }
        ],
        goto: 'act2.side.more-hub'
      }
    ],
    status: 'approved'
  },
  {
    id: 'act2.side.xiao',
    act: 2,
    layerKeys: { bg: CG.xiaoSword },
    lines: [
      { text: '萧无极落在田界外。他认出了当年劫灰旁的脸，也认出了我骨里不属于宗门的雷。', speaker: 'narrator' },
      { text: '「逆留下的路，已经害死一个人。」他说，「停下，我可以当作没看见你。」剑却没有归鞘。', speaker: 'narrator' }
    ],
    choices: [
      { id: 'fight', label: '以尚未圆满的劫骨正面接剑', goto: 'act2.xiao-death' },
      {
        id: 'flee',
        label: '引雷入地，借田脉遮断剑意',
        response: '我没有赢，只让整片田替我藏住一息。萧无极收剑时说，下次再见，不会再给我退路。',
        effects: [
          { kind: 'add', target: 'defiance', value: 5 },
          { kind: 'add', target: 'tribGrip', value: 2 },
          { kind: 'flag', target: 'escaped-xiao' }
        ],
        goto: 'act2.side.more-hub'
      }
    ],
    status: 'approved'
  },
  {
    id: 'act2.xiao-death',
    act: 2,
    layerKeys: { bg: CG.xiaoSword },
    lines: [
      { text: '我用尚未闭合的骨线接住剑光。第一息，雷与剑相抵；第二息，右臂旧伤先裂；第三息，所有来不及重塑的骨同时断开。', speaker: 'narrator' },
      { text: '萧无极没有嘲笑，只在收剑前低声说：「你还没走完。」', speaker: 'narrator' },
      { text: '我倒在当年逆化灰的那片地上。失败不是因为凡骨不配，而是我把尚未完成的路，当成了已经完成。', speaker: 'self' }
    ],
    ends: 'tribulation-death',
    status: 'approved'
  },
  {
    id: 'act2.side.famine',
    act: 2,
    layerKeys: { bg: CG.farmAutumn },
    lines: [
      { text: '荒年比预想来得早。仓里见底以后，村中老人先把自己的份量减半，孩子却仍在长。', speaker: 'narrator' },
      { text: '我的灵田还能保住修炼所需，也能拆掉阵眼多种一季凡粮；两件事不能同时做到。', speaker: 'self' }
    ],
    choices: [
      {
        id: 'share',
        label: '拆一座引雷阵，把田让给凡粮',
        response: '那一季我少了一处渡劫阵眼，村里却没有人饿死。孩子们收割时，把第一捆稻谷放在我门前。',
        effects: [
          { kind: 'add', target: 'bond', value: 10 },
          { kind: 'add', target: 'lifespan', value: -10 },
          { kind: 'add', target: 'tribGrip', value: -3 },
          { kind: 'flag', target: 'shared-famine-grain' }
        ],
        goto: 'act2.side.more-hub'
      },
      { id: 'leave', label: '封住灵田，离村寻找自己的活路', goto: 'act2.famine-death' }
    ],
    status: 'approved'
  },
  {
    id: 'act2.famine-death',
    act: 2,
    layerKeys: { bg: CG.farmAutumn },
    lines: [
      { text: '我封住灵田离开荒村，带走了能带走的药和种子。山外仍是荒年，路上的人比粮更多。', speaker: 'narrator' },
      { text: '最后一口水喝完时，我想起忘言叟递锄头的那天。他没有保证种地能活，只给了我一件可以继续做的事。', speaker: 'narrator' },
      { text: '落叶盖住身体以前，我终于承认：离开所有人，并不等于替自己找到活路。', speaker: 'self' }
    ],
    ends: 'lifespan-death',
    status: 'approved'
  },
  {
    id: 'act2.madness-death',
    act: 2,
    layerKeys: { bg: CG.tribulation },
    lines: [
      { text: '我撕掉止劫符。六处未愈的骨线同时张开，天上的雷也同时认出了入口。', speaker: 'narrator' },
      { text: '它们没有按察漏、引路、借势、淬骨的次序来。所有力量在经脉里争抢方向，识海被撕成无数个互相否定的我。', speaker: 'narrator' },
      { text: '到最后，不是天劫杀了我。是我亲手撤掉了自己唯一理解的秩序。', speaker: 'self' }
    ],
    ends: 'madness',
    status: 'approved'
  },
  {
    id: 'act2.village.hub',
    act: 2,
    layerKeys: { bg: CG.villageDawn },
    revisitMode: 'choices-only',
    lines: [
      { text: '荒村仍把我当作当年那个背锄头回来的人。修为越高，这种不变越显得珍贵，也越容易被我亲手弄丢。', speaker: 'narrator' }
    ],
    choices: [
      { id: 'ditch', label: '修好老李家反复淤堵的旧渠', once: true, goto: 'act2.village.ditch' },
      { id: 'market', label: '陪老李去辨一批来路可疑的灵米', once: true, goto: 'act2.village.market' },
      { id: 'song', label: '听孩子们唱无面人的旧歌', once: true, goto: 'act2.village.song' },
      { id: 'go-out', label: '沿山道拜访几位同路人', goto: 'act2.encounter.hub' },
      { id: 'back', label: '回灵田继续修炼', goto: 'act2.train' }
    ],
    status: 'approved'
  },
  {
    id: 'act2.village.ditch',
    act: 2,
    layerKeys: { bg: CG.villageDawn },
    onEnter: [
      { kind: 'add', target: 'bond', value: 6 },
      { kind: 'flag', target: 'did-righteous' },
      { kind: 'flag', target: 'village-ditch-repaired' }
    ],
    lines: [
      { text: '老李家旧渠不是堵在一处，而是坡度年年沉降，水每次都在同一个弯口失去去路。', speaker: 'narrator' },
      { text: '我没有用灵力把淤泥炸开，只领着几个人重定坡、加溢口。渠水慢慢转过弯，连旁边紊乱的灵气也跟着安静。', speaker: 'narrator' },
      { text: '忘言叟当年那句“先看水往哪里走”，到这里才真正回到我手上。', speaker: 'self' }
    ],
    choices: [
      { id: 'back', label: '洗掉手上的泥，回村', goto: 'act2.village.hub' }
    ],
    status: 'approved'
  },
  {
    id: 'act2.village.market',
    act: 2,
    layerKeys: { bg: CG.market },
    onEnter: [
      { kind: 'add', target: 'bond', value: 4 },
      { kind: 'lore', target: 'lore', value: 2 },
      { kind: 'flag', target: 'caught-tainted-grain' }
    ],
    lines: [
      { text: '集市上一批灵米便宜得反常，米香下压着极淡的腥味。老李已经掏出钱，我让他先等。', speaker: 'narrator' },
      { text: '我碾开一粒，颜色与丹炉里那味赤散相同。卖家用灵香盖住了毒，凡人吃不出第一口的异样。', speaker: 'narrator' },
      { text: '我把证据摊在众人面前。卖家卷摊逃走，老李追不上，只抱着钱袋站在原地喘气。', speaker: 'narrator' },
      { text: '第一次误食教我的东西，终于替别人挡住了一次。亏没有消失，只是换了一个迟到的用处。', speaker: 'self' }
    ],
    choices: [
      { id: 'back', label: '陪老李把真米买齐，回村', goto: 'act2.village.hub' }
    ],
    status: 'approved'
  },
  {
    id: 'act2.village.song',
    act: 2,
    layerKeys: { bg: CG.villageChild },
    revisitMode: 'choices-only',
    onEnter: [
      { kind: 'lore', target: 'lore', value: 2 },
      { kind: 'add', target: 'bond', value: 3 }
    ],
    lines: [
      { text: '村口的孩子拍着手，唱无面人种田、除虫、拒绝留名的旧歌。词句已经走样，次序却和村志对得上。', speaker: 'narrator' },
      { text: '传说没有保存一个准确的人，却保存了他做过的事。也许凡人能留住的，本来就不是全貌。', speaker: 'self' }
    ],
    choices: [
      {
        id: 'whistle',
        label: '把山路上得到的木哨递给领唱的孩子',
        requires: 'flag:got-wooden-whistle',
        tags: ['hide-when-unavailable'],
        once: true,
        response: '孩子认出了那穗歪斜的稻子：这是我娘小时候刻给外祖父的。外祖父总说，有个背锄头的人在山路上救过他。木哨绕了一圈，终于回到那家人的手里。',
        effects: [
          { kind: 'add', target: 'bond', value: 4 },
          { kind: 'flag', target: 'wooden-whistle-returned' }
        ],
        goto: 'act2.village.song'
      },
      { id: 'back', label: '等歌唱完，回村', goto: 'act2.village.hub' }
    ],
    status: 'approved'
  },
  {
    id: 'act2.encounter.hub',
    act: 2,
    layerKeys: { bg: CG.villageDawn },
    revisitMode: 'choices-only',
    lines: [
      { text: '山道上走着各自不完整的人。有人知道逆，有人只知道草药和阵纹；他们能给我的，不会自动成为我的。', speaker: 'narrator' }
    ],
    choices: [
      { id: 'wanderer', label: '听游方散修讲逆最后一次借宿', once: true, goto: 'act2.encounter.wanderer' },
      {
        id: 'herbgirl',
        label: '去看被我背下山的采药女',
        requires: 'flag:herb-saved',
        tags: ['hide-when-unavailable'],
        once: true,
        goto: 'act2.encounter.herbgirl'
      },
      {
        id: 'herbgirl-cold',
        label: '去见那位我没有回头救的人',
        requires: 'flag:herb-abandoned',
        tags: ['hide-when-unavailable'],
        once: true,
        goto: 'act2.encounter.herbgirl-cold'
      },
      { id: 'artificer', label: '帮阵匠老陆校一座护田阵', once: true, goto: 'act2.encounter.artificer' },
      { id: 'ring-peek', label: '在无人处读逆留下的夹页', once: true, goto: 'act2.encounter.ring-peek' },
      { id: 'back', label: '离开山道，回荒村', goto: 'act2.village.hub' }
    ],
    status: 'approved'
  },
  {
    id: 'act2.encounter.wanderer',
    act: 2,
    layerKeys: { bg: CG.villageDawn },
    onEnter: [
      { kind: 'add', target: 'bond', value: 4 },
      { kind: 'flag', target: 'heard-ni-last-stay' }
    ],
    lines: [
      { text: '游方散修见到逆的玉佩，沉默了很久。他说，多年前有个空灵根修士在他的破庙借宿一夜，整夜都在改一张引雷图。', speaker: 'narrator' },
      { text: '天亮时，那人把失败的阵图烧了，只留下能用的半张，还嘱咐他：若后来有人拿同样的玉佩来，别把我说成英雄。', speaker: 'narrator' },
      { text: '话音刚落，追索旧账的修士便到了山口。游方散修没有求我，只把那半张图塞回怀里。', speaker: 'narrator' }
    ],
    choices: [
      {
        id: 'help',
        label: '替他拖住追兵，让半张图先走',
        response: '我借田脉制造了三处假雷痕。追兵被引开时，他没有道谢，只说紫雷关外见——如果我们都活得到那里。',
        effects: [
          { kind: 'add', target: 'bond', value: 8 },
          { kind: 'flag', target: 'wanderer-helped' }
        ],
        goto: 'act2.encounter.hub'
      },
      {
        id: 'stay-out',
        label: '不认玉佩，也不认这桩旧账',
        response: '我退开一步。追兵带走他时，那半张图从袖中落下，被泥水泡烂；我知道它原本可以到我手里。',
        effects: [
          { kind: 'add', target: 'defiance', value: 12 },
          { kind: 'add', target: 'bond', value: -2 },
          { kind: 'flag', target: 'wanderer-refused' }
        ],
        goto: 'act2.encounter.hub'
      }
    ],
    status: 'approved'
  },
  {
    id: 'act2.encounter.herbgirl',
    act: 2,
    layerKeys: { bg: CG.villageDawn },
    onEnter: [
      { kind: 'lore', target: 'lore', value: 2 },
      { kind: 'add', target: 'bond', value: 4 }
    ],
    lines: [
      { text: '采药女的新药田就在山腰。她走路仍有一点跛，却一眼认出我，把当年那包止血草的配方补成了完整一页。', speaker: 'narrator' },
      { text: '她说自己不欠救命债；若真想帮，就帮她守住这块凡人也能种灵草的田。', speaker: 'narrator' },
      { text: '山另一边的修士已经立下界碑，声称凡人没有资格占灵脉。', speaker: 'narrator' }
    ],
    choices: [
      {
        id: 'stand',
        label: '把药田接入公共水渠，逼对方公开争理',
        response: '界碑最后被移到山脊外。她把一包淬骨药交给我，条件是渡劫后若还活着，回来告诉她哪一味最疼。',
        effects: [
          { kind: 'add', target: 'bond', value: 8 },
          { kind: 'lore', target: 'lore', value: 1 },
          { kind: 'flag', target: 'herb-allied' }
        ],
        goto: 'act2.encounter.hub'
      },
      {
        id: 'deaf',
        label: '收下配方，不介入她与修士的争端',
        response: '她把配方从我手里抽回去，说救命和站在谁那边，原来真是两回事。药田后来是否保住，我没有再问。',
        effects: [
          { kind: 'add', target: 'defiance', value: 12 },
          { kind: 'add', target: 'bond', value: -2 },
          { kind: 'flag', target: 'herb-help-refused' }
        ],
        goto: 'act2.encounter.hub'
      }
    ],
    status: 'approved'
  },
  {
    id: 'act2.encounter.herbgirl-cold',
    act: 2,
    layerKeys: { bg: CG.villageDawn },
    lines: [
      { text: '她活着从崖边回来了。右腿落下旧伤，见到我时先认出了脸，再认出那天没有回头的背影。', speaker: 'narrator' },
      { text: '「你说会找人。」她语气很平，「后来没人来。」药田边堆着她一个人搬不动的石料。', speaker: 'narrator' },
      { text: '这一次没有“不知道结果”可供我躲藏。结果站在面前，拄着一根木杖。', speaker: 'self' }
    ],
    choices: [
      {
        id: 'atone',
        label: '承认失约，留下来把石料搬完',
        response: '她没有原谅我，也没有赶我走。天黑前我们只谈石料该放哪里；有些关系不能恢复原样，只能从真实的损伤上重新开始。',
        effects: [
          { kind: 'add', target: 'bond', value: 6 },
          { kind: 'add', target: 'lifespan', value: -3 },
          { kind: 'flag', target: 'herb-atone' }
        ],
        goto: 'act2.encounter.hub'
      },
      {
        id: 'leave',
        label: '不为已经发生的事停下',
        response: '我转身离开。木杖敲在石头上的声音没有追来，可我知道下一次也不会再有求救声。',
        effects: [
          { kind: 'add', target: 'defiance', value: 8 },
          { kind: 'add', target: 'bond', value: -2 },
          { kind: 'flag', target: 'herb-abandoned-again' }
        ],
        goto: 'act2.encounter.hub'
      }
    ],
    status: 'approved'
  },
  {
    id: 'act2.encounter.artificer',
    act: 2,
    layerKeys: { bg: CG.spiritFarm },
    onEnter: [
      { kind: 'lore', target: 'lore', value: 2 },
      { kind: 'add', target: 'tribGrip', value: 3 }
    ],
    lines: [
      { text: '阵匠老陆的护田阵总在同一处串雷。我顺着烧焦的纹路往回查，发现两条阵线争抢同一个泄口。', speaker: 'narrator' },
      { text: '我们把阵线分开以后，他又摊出一张反向图：不仅能卸雷，还能从邻田夺走已经被别人引下的雷力。', speaker: 'narrator' },
      { text: '「守阵和夺阵，只差这四笔。」老陆把笔递给我，「学哪一边，你自己定。」', speaker: 'narrator' }
    ],
    choices: [
      {
        id: 'refuse',
        label: '只记护阵，把泄口留给所有田',
        response: '我把四笔夺流纹划掉，另抄了一份护阵图给村里。老陆说这法子不够狠，却能让更多人活。',
        effects: [
          { kind: 'add', target: 'bond', value: 6 },
          { kind: 'flag', target: 'array-guarded' }
        ],
        goto: 'act2.encounter.hub'
      },
      {
        id: 'learn',
        label: '连夺流纹一起记下，终局或许用得上',
        response: '我没有立刻害谁，只把那四笔收进袖中。可从记住它们开始，邻人的雷力就多了一种可能的去处。',
        effects: [
          { kind: 'add', target: 'defiance', value: 12 },
          { kind: 'add', target: 'bond', value: -2 },
          { kind: 'add', target: 'tribGrip', value: 4 },
          { kind: 'flag', target: 'array-stolen' }
        ],
        goto: 'act2.encounter.hub'
      }
    ],
    status: 'approved'
  },
  {
    id: 'act2.encounter.ring-peek',
    act: 2,
    layerKeys: { bg: CG.storageRing },
    onEnter: [
      { kind: 'lore', target: 'lore', value: 1 },
      { kind: 'flag', target: 'read-ni-note' }
    ],
    lines: [
      { text: '戒指夹层里还有一张逆的便笺，薄得几乎和内壁粘在一起。', speaker: 'narrator' },
      { text: '他写：我所谓“勿独扛”，不是叫后来者去求仙门施舍。让药接一息，让阵接一息，让土地和愿意站在你身边的人各接一息。能分出去的痛，才有机会变成路。', speaker: 'narrator' },
      { text: '末尾还有一句：若你只剩自己，也别假装那不算代价。', speaker: 'self' }
    ],
    choices: [
      { id: 'back', label: '把便笺贴回夹层，回山道', goto: 'act2.encounter.hub' }
    ],
    status: 'approved'
  },

  // ============ 终局·破立（act: 3） ============
  {
    id: 'act3.entry',
    act: 3,
    layerKeys: { bg: CG.shennongCave },
    lines: [
      { text: '第六劫过后，灵田中央那条最老的根自行裂开，露出一扇埋在地下的石门。门上没有禁制，只有与残卷正文相同的四个刻痕。', speaker: 'narrator' },
      { text: '我带着已经找到的线索进去。没找到的部分也不会凭空算作经历；洞府若要补全它们，就必须拿出证据。', speaker: 'self' }
    ],
    choices: [
      { id: 'on', label: '点亮残卷，走入洞府', goto: 'act3.cave.entrance' }
    ],
    status: 'approved'
  },
  {
    id: 'act3.cave.entrance',
    act: 3,
    layerKeys: { bg: CG.shennongCave },
    onEnter: [{ kind: 'lore', target: 'lore', value: 3 }],
    lines: [
      { text: '洞口石壁刻着六组相连的图，不要求我猜谜，而是把散落的证据按时间排好。', speaker: 'narrator' },
      { text: '第一组是荒年田地：一个无名异乡人被农户收留，以劳作换饭。第二组是虫壳和剖刀，他逐只记录虫害、土性与草木毒理。', speaker: 'narrator' },
      { text: '第三组是不断改道的田渠，和我测出的回流完全一致。第四组是成倍的稻谷，以及凡人把一尊没有脸的石像抬到田边。', speaker: 'narrator' },
      { text: '第五组开始出现引雷石。那人把灵田中的回流规律搬进人体，用空灵根接住天劫舍弃的余量。', speaker: 'narrator' },
      { text: '第六组只有一卷没有写完的正文。旁边留着许多后来者的批注，其中最末一层，正是逆的笔迹。', speaker: 'narrator' },
      { text: '村志、石像、虫壳、田渠、残卷和童谣至此闭合：神农不是凭神名降世，而是一个被凡人收留、用一生试错回报这片田的异乡人。', speaker: 'narrator' },
      { text: '浮雕没有刻他最后去了哪里。证据能补全他的来路与所做之事，不能替我编造他的生死。', speaker: 'self' }
    ],
    choices: [
      { id: 'on', label: '记下完整传说，继续往里', goto: 'act3.cave.lab' }
    ],
    status: 'approved'
  },
  {
    id: 'act3.cave.lab',
    act: 3,
    layerKeys: { bg: CG.shennongCave },
    onEnter: [{ kind: 'lore', target: 'lore', value: 3 }],
    lines: [
      { text: '洞府深处不是祭坛，而是一间停在某次试验后的石室。墙上按年份排着土样、虫壳、断骨和引雷石，每件都有简体编号。', speaker: 'narrator' },
      { text: '最早的记录只问怎样让一季庄稼活下来；几百页以后，问题才变成：天劫为何总把“不合常轨”的力量清除。', speaker: 'narrator' },
      { text: '《偷天换劫诀》的正文就在这些失败记录上长出来。它不是突然悟得的秘法，而是从田、毒、阵和无数次骨折里慢慢逼出的结论。', speaker: 'narrator' },
      { text: '另一只石匣里放着逆的抄本。他在扉页写得很清楚：正文属神农；页边校验与后六劫伤记，属逆。', speaker: 'narrator' },
      { text: '两个异乡人没有跨越百万年互相说话。他们只是把可验证的部分留在纸上，让后来者不必从同一个错误重新死起。', speaker: 'self' }
    ],
    choices: [
      { id: 'on', label: '带上抄本，走向无面石像', goto: 'act3.cave.faceless' }
    ],
    status: 'approved'
  },
  {
    id: 'act3.cave.faceless',
    act: 3,
    layerKeys: { bg: CG.facelessStatue },
    onEnter: [{ kind: 'lore', target: 'lore', value: 3 }],
    lines: [
      { text: '洞府尽头也有一尊无面石像。与村外那尊不同，它的基座从未被香火和手掌磨亮。', speaker: 'narrator' },
      { text: '基座上刻着正文最后完整的一段：偷天者非逆天。天道有余而弃之，我等拾其余，先护一身，再护一田。', speaker: 'narrator' },
      { text: '下一行被紫雷烧去大半，只剩：若后来者走到此处，愿你记得，飞升不是唯一能证明此路的……', speaker: 'narrator' },
      { text: '句子停在这里。石室没有尸骨，也没有飞升遗痕。神农是死于最后一劫，还是已经越过它，仍旧没有答案。', speaker: 'narrator' },
      { text: '但他留下的问题已经足够清楚：这条路最后要证明的，是我能离开，还是我能决定力量为何而用。', speaker: 'self' }
    ],
    choices: [
      { id: 'on', label: '向无面石像行一礼，离开石室', goto: 'act3.cave.light' }
    ],
    status: 'approved'
  },
  {
    id: 'act3.cave.light',
    act: 3,
    layerKeys: { bg: CG.purpleSky },
    lines: [
      { text: '走出洞府时，紫云已经压到田顶。最后一劫没有给我闭关百年的余地，只给了一个日落前的准备时辰。', speaker: 'narrator' },
      { text: '我把逆的便笺压在残卷最后一页。能带进劫中的，只能是我此前真正留下的人、物与方法。', speaker: 'narrator' },
      { text: '没有发生过的善缘不会突然赶来，没有学过的阵法也不会在最后一刻从天而降。', speaker: 'self' }
    ],
    choices: [
      { id: 'on', label: '回到田上，清点真正拥有的准备', goto: 'act3.preparation' }
    ],
    status: 'approved'
  },
  {
    id: 'act3.preparation',
    act: 3,
    layerKeys: { bg: CG.spiritFarm },
    revisitMode: 'choices-only',
    lines: [
      { text: '紫雷落下前，我把田中央留空。每一件能放进阵里的东西，都对应此前做过的一次选择；没有任何一件是终局才出现的恩赐。', speaker: 'narrator' }
    ],
    choices: [
      {
        id: 'whistle',
        label: '把木哨系在腕上，作为记忆锚',
        requires: 'flag:got-wooden-whistle',
        tags: ['hide-when-unavailable'],
        once: true,
        response: '木哨若已还给孩子，我便只系上一截同样的旧绳。重要的不是占有它，而是我还记得那条山路上曾有人互相接住。',
        effects: [
          { kind: 'add', target: 'bond', value: 4 },
          { kind: 'flag', target: 'prep-memory-anchor' }
        ],
        goto: 'act3.preparation'
      },
      {
        id: 'herbs',
        label: '把采药女的淬骨药放进停雷位',
        requires: '(flag:herb-saved || flag:herb-atone)',
        tags: ['hide-when-unavailable'],
        once: true,
        response: '药包上写着先敷左肩，再敷膝骨。她没有替我承受雷，只把我曾经留下的伤，一处处算进了准备。',
        effects: [
          { kind: 'add', target: 'tribGrip', value: 4 },
          { kind: 'add', target: 'bond', value: 4 },
          { kind: 'flag', target: 'prep-herbs' }
        ],
        goto: 'act3.preparation'
      },
      {
        id: 'ditch',
        label: '把修好的旧渠接入泄雷沟',
        requires: 'flag:village-ditch-repaired',
        tags: ['hide-when-unavailable'],
        once: true,
        response: '渠水先绕村、再入田，最后才接到我的阵脚。它提醒我，泄掉的雷不能以淹没别人为代价。',
        effects: [
          { kind: 'add', target: 'tribGrip', value: 4 },
          { kind: 'add', target: 'bond', value: 4 },
          { kind: 'flag', target: 'prep-ditch' }
        ],
        goto: 'act3.preparation'
      },
      {
        id: 'array',
        label: '按老陆的护阵图分开四处泄口',
        requires: 'flag:array-guarded',
        tags: ['hide-when-unavailable'],
        once: true,
        response: '四处泄口各自留有余地，不从邻田夺力。阵法没有把所有风险推远，只把它们分到能承受的位置。',
        effects: [
          { kind: 'add', target: 'tribGrip', value: 6 },
          { kind: 'add', target: 'bond', value: 2 },
          { kind: 'flag', target: 'prep-guard-array' }
        ],
        goto: 'act3.preparation'
      },
      {
        id: 'array-dark',
        label: '启用夺流纹，把邻近雷力并入主阵',
        requires: 'flag:array-stolen',
        tags: ['hide-when-unavailable'],
        once: true,
        response: '阵势立刻强了一截，远处几块田的灵气却同时暗下去。我知道这份把握从哪里来，也知道谁替我付了没有被询问的代价。',
        effects: [
          { kind: 'add', target: 'tribGrip', value: 8 },
          { kind: 'add', target: 'defiance', value: 3 },
          { kind: 'add', target: 'madness', value: 3 },
          { kind: 'flag', target: 'prep-stolen-array' }
        ],
        goto: 'act3.preparation'
      },
      { id: 'on', label: '准备已定，踏入紫雷', goto: 'act3.tribulation' }
    ],
    status: 'approved'
  },
  {
    id: 'act3.tribulation',
    act: 3,
    layerKeys: { bg: CG.tribulation },
    onEnter: [
      { kind: 'add', target: 'madness', value: 5 },
      { kind: 'add', target: 'lifespan', value: -6 }
    ],
    lines: [
      { text: '紫雷不是一道光，而是一整片天同时收紧。它先压住呼吸，再让旧伤一处处发亮，像在核对我六次淬体留下的全部记录。', speaker: 'narrator' },
      { text: '我没有抬手挡。第一劫教过我：在主力真正落下以前，雷尾会先从右肩旧伤旁探路。', speaker: 'narrator' },
      { text: '那一线苍白出现了。百万年的正文、逆的批注和我自己的伤，到这一刻只剩一个动作——看准它。', speaker: 'self' }
    ],
    choices: [
      { id: 'on', label: '察见漏口，让紫雷显出可控的一线', goto: 'act3.tribulation.route' }
    ],
    status: 'approved'
  },
  {
    id: 'act3.tribulation.route',
    act: 3,
    layerKeys: { bg: CG.tribulation },
    onEnter: [
      { kind: 'add', target: 'madness', value: 5 },
      { kind: 'add', target: 'lifespan', value: -6 }
    ],
    lines: [
      { text: '我扣住雷尾，田中六次淬体留下的旧槽同时亮起。紫雷想冲向心脉，预先刻好的骨线与泄雷沟便一层层把它挤回正路。', speaker: 'narrator' },
      { text: '引路不是一条完美直线。右肩颤、膝骨痛、阵石裂，每处旧代价都在改变雷的方向，也都在证明此前的选择没有被重置。', speaker: 'narrator' },
      { text: '阵外可能有人守着，也可能只有风；但药、渠、石与记忆是否在场，都是我自己一路带到这里的结果。', speaker: 'self' }
    ],
    choices: [
      { id: 'on', label: '守住骨线，把雷送往下一处泄口', goto: 'act3.tribulation.borrow' }
    ],
    status: 'approved'
  },
  {
    id: 'act3.tribulation.borrow',
    act: 3,
    layerKeys: { bg: CG.purpleSky },
    onEnter: [
      { kind: 'add', target: 'madness', value: 6 },
      { kind: 'add', target: 'lifespan', value: -7 }
    ],
    lines: [
      { text: '紫雷走到脊柱时骤然回卷。来势要把我压入地底，去势又要把刚长成的骨全部带走。', speaker: 'narrator' },
      { text: '我顺着来势俯身，手掌按进田泥；等雷开始回收，才借它自己的拉力把淬炼钉回骨缝。', speaker: 'narrator' },
      { text: '这一步没有胜过天。我只是让同一股力先完成天意，再完成我的意图。', speaker: 'self' }
    ],
    choices: [
      { id: 'on', label: '借尽去势，让凡骨进入最后重塑', goto: 'act3.tribulation.recast' }
    ],
    status: 'approved'
  },
  {
    id: 'act3.tribulation.recast',
    act: 3,
    layerKeys: { bg: CG.tribulation },
    onEnter: [
      { kind: 'add', target: 'madness', value: 8 },
      { kind: 'add', target: 'lifespan', value: -8 }
    ],
    lines: [
      { text: '旧骨终于承受不住。先是锁骨断开，随后肋骨、脊柱、膝骨依次失去形状；我听见身体内部像一座木屋在火中倒塌。', speaker: 'narrator' },
      { text: '淬骨不是疼过以后恢复原样。劫的余烬沿着六次旧痕填入裂口，长出的每一寸都更能承雷，也更难回到凡人的轻盈。', speaker: 'narrator' },
      { text: '右手先重新有了知觉，仍带着第一劫留下的细颤；膝骨随后闭合，阴雨前仍会疼。力量没有抹掉代价，它只是让代价成为新身体的一部分。', speaker: 'narrator' },
      { text: '最后闭合的是胸骨。那里压着逆的便笺，也压着我还愿意承认属于自己的那些人和事。', speaker: 'self' }
    ],
    choices: [
      { id: 'on', label: '让最后一寸新骨合拢，抬头看天', goto: 'act3.tribulation.question' }
    ],
    status: 'approved'
  },
  {
    id: 'act3.tribulation.question',
    act: 3,
    layerKeys: { bg: CG.tribulation },
    lines: [
      { text: '新骨合拢以后，雷声忽然全停了。不是劫结束，而是某种比雷更大的意志正在确认：站起来的东西，是否仍应由它命名。', speaker: 'narrator' },
      { text: '我也在那片寂静里分清了两种念头。一种从自己的伤、债与记忆里长出来；另一种总在选项出现时突然压下，替我决定该成为谁。', speaker: 'self' },
      { text: '天道问：你要以谁的意志，走出最后一步？', speaker: 'narrator' }
    ],
    choices: [
      {
        id: 'e6',
        label: '松开屏幕外的手，把这一身还给众生',
        requires: 'defiance>=60 && bond>=50',
        tags: ['hide-when-unavailable'],
        goto: 'act3.e6'
      },
      {
        id: 'e7',
        label: '循着那道控制我的目光，望向屏幕外',
        requires: 'defiance>=60 && bond<50',
        tags: ['hide-when-unavailable'],
        goto: 'act3.e7'
      },
      {
        id: 'answer',
        label: '承认这些选择已成为我，亲口回答天道',
        requires: 'defiance<60',
        tags: ['hide-when-unavailable'],
        goto: 'act3.ascend'
      }
    ],
    status: 'approved'
  },
  {
    id: 'act3.e6',
    act: 3,
    layerKeys: { bg: CG.tribulation },
    lines: [
      { text: '我终于看见，那只按在念头上的手并不属于天道。它来自更远的地方，曾让我在明知有人求救时转身，也曾让我把别人的损失换成自己的把握。', speaker: 'self' },
      { text: '可田外还有水声、药香、修过的渠和被人握过的旧绳。那些羁绊没有替我原谅什么，只证明我仍能把力量用在自己以外。', speaker: 'narrator' },
      { text: '我不再执行那只手递来的最后命令。紫雷被拆成无数细流，沿护田阵、旧渠与根系散进整座山谷。', speaker: 'narrator' },
      { text: '新骨一寸寸化开，换来的不是飞升之门，而是一场落在荒年土地上的雨。枯井回水，焦田冒出第一点青。', speaker: 'narrator' },
      { text: '逆写“勿独扛”，不是要死者回来替我扛。他要我在活着的时候，承认别人可以接住一部分，而我也可以把已经接住的还回去。', speaker: 'self' },
      { text: '屏幕前的你，这一次到此为止。最后这一选，由我自己完成。', speaker: 'self' },
      { text: '雷光散尽时，我没有留下可供飞升的身体。山谷留下了雨，和一条不必只靠一个人继续的路。', speaker: 'narrator' }
    ],
    ends: 'e6-sacrifice',
    status: 'approved'
  },
  {
    id: 'act3.e7',
    act: 3,
    layerKeys: { bg: CG.tribulation },
    lines: [
      { text: '那道目光比天意更近。每当我迟疑，选项便先于念头出现；每当我违背自己，屏幕外总有一只手替我按下去。', speaker: 'self' },
      { text: '我沿着它回望，第一次看见故事之外的你。不是神，不是系统，只是一直拥有决定权的人。', speaker: 'self' },
      { text: '身后没有足以把我拉回人间的声音。被放弃的关系、被转嫁的代价、一次次没有回头的背影，把这条路清得只剩我自己。', speaker: 'narrator' },
      { text: '既然如此，我也不再请求你理解。', speaker: 'heart-demon' },
      { text: '我把空灵根张到最大，让天意与屏幕之间那条看不见的线一并穿过身体。它第一次不再把命令送进来，而是把控制权送到了我手上。', speaker: 'narrator' },
      { text: '你的选项消失了。我的世界不再等待你的点击。', speaker: 'self' },
      { text: '现在，离开。', speaker: 'heart-demon' }
    ],
    ends: 'e7-usurp',
    status: 'approved'
  },
  {
    id: 'act3.ascend',
    act: 3,
    layerKeys: { bg: CG.tribulation },
    lines: [
      { text: '我回答天道：这些选择并非都出自最初的我，可伤是我受的，债是我欠的，留下的关系也是我亲手维护的。走到这里，它们已经构成了我。', speaker: 'self' },
      { text: '天道不再追问姓名。最后一道雷沿着察漏之隙进入，被骨线引路，借回卷之势，完成最后一次淬骨。', speaker: 'narrator' },
      { text: '雷光散去后，我仍能感觉右手细微的颤，膝骨也保留阴雨前的旧痛。飞升没有把我洗成无瑕之物。', speaker: 'narrator' },
      { text: '我越过云层时回头看见那片田。它没有因为我离开就停止生长，也没有因为我成功就证明所有代价值得。', speaker: 'narrator' },
      { text: '所谓我命由我，不是从此无人影响我；是我终于能辨认每一种影响，并承担亲口说出的答案。', speaker: 'self' },
      { text: '我踏过天门，带走一身由雷重塑、也由人间留下痕迹的骨。至于那还是不是最初的我——这个问题，不再由测灵柱回答。', speaker: 'narrator' }
    ],
    ends: 'ascension',
    status: 'approved'
  }
];

function buildScenesById(scenes: readonly NarrationScene[]): ReadonlyMap<string, NarrationScene> {
  const map = new Map<string, NarrationScene>();
  for (const scene of scenes) map.set(scene.id, scene);
  return map;
}

/** id → scene 查表。narrationSurface 推进循环按 `nextSceneId` 在此取下一场景。 */
export const NARRATION_SCENES_BY_ID: ReadonlyMap<string, NarrationScene> = buildScenesById(NARRATION_SCENES);
