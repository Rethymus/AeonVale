/**
 * 灵韵叙录四幕场景数据（Wave 3 真实数据，覆盖 Wave 2 占位）。
 *
 * 红线（docs/23 §0，硬守）：
 *  - 本表只含 {@link NarrationScene} 纯数据，零运行时副作用、零 `src/sim/` 访问。
 *  - 文案硬编码中文（第一人称旁白，docs/22 §3 现代克制冷幽默基调），不走 `t()`（与
 *    prologueScenes 同构，见 spec F4）。UI chrome（按钮/标签/图鉴）才走 `t('narration.*')`。
 *  - 所有副作用只走 choice/scene 的 `effects`/`onEnter` 声明通道，由 firstPersonView.applyEffects 解释。
 *  - 全部 scene `status:'approved'`（docs/23 §1，Wave 4 CI 护栏拒非 approved 进入口）。
 *
 * 幕结构（逐节点照 docs/22 §6 四幕骨架闭环 + spec F2 复用 prologueScenes 原文第一人称化）：
 *  - 序章·幻灭：黑屏睁眼 → 山谷（鸟兽/虚空踏步/炊烟）→ 炊烟抉择（深处=E0蘑菇 / 荒村）
 *    → 荒村（系统/老爷爷/残魂全落空段子 + 行义涨 bond + 忘言叟指路太一宗）→ 赴宗途中义举
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
// 第二批 -v2（14，本批合并）：NPC 立绘 5 / 场景图 5 / 道心氛围 3 / 梗意象 1，供子场景细化选图。
// 第三批 -v2（12，本批合并）：场景对照 6 / NPC 补立绘 4 / 梗意象 2，子场景视觉细化（斗法对照、
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
  // 第二批 -v2 梗意象：序章早夭支线（E0 蘑菇特写）。
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
      { text: '那缕炊烟，像八百本小说里都写过的开场。它在林子深处，也在荒村那一头。', speaker: 'narrator' }
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
    // 荒村·hub：复用 prologueScenes.awaken 落空段子（第一人称化）+ 行义 + 问路。
    // flavor 选项 self-loop（once 隐藏已选），help/ask 离开 hub。
    id: 'prologue.village',
    act: 'prologue',
    layerKeys: { bg: CG.village },
    lines: [
      { text: '荒村。几户人家，炊烟勉强算活。我坐在村口，按八百本小说的套路，等了三天。', speaker: 'narrator' },
      { text: '「系统绑定」没有。脑海里那声苍老的「小子，老夫等你三千年」也没有。什么都没等到。', speaker: 'narrator' },
      { text: '村口的老者——人们叫他「忘言叟」——远远看着，一言不发。', speaker: 'narrator' }
    ],
    choices: [
      { id: 'system', label: '高呼「系统！」', once: true, response: '……似乎什么都没有发生。', effects: [{ kind: 'flag', target: 'asked-system' }], goto: 'prologue.village' },
      { id: 'elder', label: '找戒指里的老爷爷', once: true, response: '翻了翻口袋，只有一把不知是谁的锄头。', goto: 'prologue.village' },
      { id: 'soul', label: '默念「戒中残魂，速来！」', once: true, response: '脑海死寂。什么都没来。', goto: 'prologue.village' },
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
    converge: '……也许，我就是那个，穿越了也没人要的废柴。不过废柴也能种地。',
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
      { text: '走出几步，他忽然又补了半句：「种地和修仙，一个理——急不得。」后半句像守了一辈子的秘密，到嘴角又咽了回去。', speaker: 'narrator' },
      { text: '（急不得。这三个字我那时没往心里去。后来引第一道劫的时候，才咂摸出味——他哪里是在教我种地。）', speaker: 'self' }
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
      { text: '（两个麻烦，一前一后。八百本小说里，主角这时该拔刀。可我手里是把锈锄头，拔了也是笑话。那就……先观察。）', speaker: 'self' },
      { text: '（骡车那头，车辙深浅不一，左轮陷得深——是车轴歪了，不是单纯陷泥，硬推没用，得先垫石头正轴。小贩这头，两个散修腰间的玉牌是太一宗外门样式，测灵根在即，他们不敢在山门口真动手，只是吓唬。）', speaker: 'self' }
    ],
    choices: [
      {
        id: 'help',
        label: '先帮骡车正轴，再回头拿话挤对散修',
        response: '我蹲下摸了摸车辙，找两块碎石垫进左轮底，让赶车的慢推——车轴一正，骡车吱呀上了路。回头走到小贩那边，没拔锄头，只笑着点破两个散修的玉牌来历。他俩脸一僵，骂骂咧咧地走了。',
        effects: [
          { kind: 'add', target: 'bond', value: 6 },
          { kind: 'flag', target: 'did-righteous' }
        ],
        goto: 'prologue.depart.token'
      },
      {
        id: 'hurry',
        label: '赶路要紧，绕过去',
        response: '我低着头绕开了。小贩那声「大哥」我没接。山道还长，测灵根不等人。',
        effects: [{ kind: 'add', target: 'defiance', value: 5 }],
        goto: 'prologue.depart.spread'
      }
    ],
    status: 'approved'
  },
  {
    // 赠木哨（伏笔种子 6：木哨 → 红尘羁绊传承 / 神农同款纹样）。仅 help 路径可达。
    id: 'prologue.depart.token',
    act: 'prologue',
    layerKeys: { bg: CG.village },
    lines: [
      { text: '小贩拣起干果，硬往我怀里塞了一把，又从脖子上解下一样东西——一枚磨得发亮的小木哨。', speaker: 'narrator' },
      { text: '「我家丫头出生那天，她娘刻的，说戴身上辟邪。」小贩搓着手，「我没什么好谢你的，这个……你别嫌弃。」', speaker: 'narrator' },
      { text: '（木哨。我原世界的小孩也戴这种。我接过来，哨面上有一道刻纹——不是这世界的花纹，倒像……一种标记。说不上来。）', speaker: 'self' }
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
    // 义举传开（docs/22 §6）+ 三段式包袱（庄严场面 + 现代吐槽 self + 自嘲收敛）。
    // bond 在此结算（baseline +3；help 路径已在 road 拿 +6，合计 +9，义举非白送）。
    id: 'prologue.depart.spread',
    act: 'prologue',
    layerKeys: { bg: CG.village },
    onEnter: [{ kind: 'add', target: 'bond', value: 3 }],
    lines: [
      { text: '那件骡车的事，不知怎么，比我先一步传到了太一宗山门口。', speaker: 'narrator' },
      { text: '我到的时候，山道上的猎户塞干粮，赶脚的汉子帮我挑行囊，连那小贩的同乡都远远冲我点头。一个凡人废柴，居然在这条山道上，攒起了一点薄薄的名声。', speaker: 'narrator' },
      { text: '（这要是我原世界的早高峰，整条三环早堵成停车场了——可这儿，一件义举，竟传得这样远。……这念头太飘，收着。）', speaker: 'self' }
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
      { text: '轮到我时，那长老多看我几眼，搁下笔：「根骨虽凡，这一身不肯服输的硬气，倒少见。」', speaker: 'narrator' },
      { text: '他让我上前，掌心贴上测灵柱。死寂——像按在一块冷石头上。换更高阶的柱，依旧死寂。', speaker: 'narrator' },
      { text: '（按上去那一下，我莫名其妙想起原世界体检的仪器——也是这种黑盒：你只管把手放上去，它报什么，就是什么，没得商量。）', speaker: 'self' },
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
      { text: '（拔草拔到一半，天上掉下来两个神仙打架。我原世界的应急预案里，可没这一条。）', speaker: 'self' }
    ],
    choices: [
      { id: 'hide', label: '扑进田沟，抬头看', goto: 'act1.battle.sky' }
    ],
    status: 'approved'
  },
  {
    // 对照组：顺天遁光秩序井然 vs 逆天灾祸定向劈落（梗 5·物业=天道：天劫=定向清扫）。
    // v3 换图：scene.battle-duel-v2（青光 vs 紫黑光对撞）——比第一批 storageRing（劫灰遗物）
    // 更贴本场景「天上对照」的视觉：一青一灰两道灵光对撞。
    id: 'act1.battle.sky',
    act: 1,
    layerKeys: { bg: CG.battleDuel },
    lines: [
      { text: '我趴在沟里，仰头。远处太一宗方向，一道道遁光秩序井然地升落，像编好了号的雁阵——那是顺天道的修士，天劫绕着他们走，连衣角都不沾。', speaker: 'narrator' },
      { text: '我头顶这两道，不一样。青光那个剑意工整，近乎刻板；灰光那个，灵气乱得像一团逆流的漩涡，每硬接一记，天就阴沉一分。', speaker: 'narrator' },
      { text: '顺天的，被天护着；逆天的，天在劈他。', speaker: 'narrator' },
      { text: '（原来这世道的天，真会挑人。我头一回实实在在看见——「天劫」不是随机灾害，是定向清扫，专劈那种，不该逆着的。这位房东，比我想得较真。）', speaker: 'self' }
    ],
    choices: [
      { id: 'on', label: '屏住呼吸', goto: 'act1.battle.cellar' }
    ],
    status: 'approved'
  },
  {
    // 蝼蚁地窖感官浸入（震波/红光/簌簌落土）+ 童谣解构庄严梗（梗引擎·灵韵路由首次被动显形）。
    id: 'act1.battle.cellar',
    act: 1,
    layerKeys: { bg: CG.storageRing },
    lines: [
      { text: '一道余波砸下，我家那半边田直接塌了——地窖盖板掀飞，我连滚带爬跌了进去。地窖里黑，震波一阵阵传来，红光从缝里漏下，簌簌地落土。', speaker: 'narrator' },
      { text: '灰光那个明显撑不住了。他的灵气像漏了底的水桶，一边挡，一边往我这边的地里漏——漏进来的，居然让地窖四壁的灵气，规规矩矩地顺了起来。', speaker: 'narrator' },
      { text: '（这哪是斗法，分明两台挖掘机碾过一个蚁穴——我就是那只蚂蚁。可奇怪，那只蚂蚁脚下的土，被漏下来的灵气，悄悄垫实了。这漏掉的气，没散，像被谁顺手，归置到了该去的地方。）', speaker: 'self' },
      { text: '我缩在角落，抖得停不下来。为了把抖压下去，我开始哼一首我原世界的童谣——两只老虎，两只老虎。哼到一半自己笑了：庄严个屁，这不过是两个人，在天上，拼命。', speaker: 'narrator' }
    ],
    choices: [
      { id: 'on', label: '等震波过去，爬出地窖', goto: 'act1.battle.stare' }
    ],
    status: 'approved'
  },
  {
    // 与萧无极一瞬对视（伏笔种子：flag:xiao-saw-face + 青光剑意特征，供 act2.side.xiao 凭此认出）。
    // 逆的「勿……」在此埋下（伏笔 4，stage4 心雷劫补全「勿独扛」）。
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
      { text: '（按八百本小说，此刻这戒里该有个老爷爷，该喊一声「小子，老夫等你三千年」。我下意识等了一下。没有。意料之中，可还是……有点失落。）', speaker: 'self' }
    ],
    choices: [
      { id: 'try', label: '把它捡起来，试着碰碰戒面', goto: 'act1.ring.attempts' }
    ],
    status: 'approved'
  },
  {
    // 凡人开戒三次试错（指纹/血契无效 → 第三次打斗余波+逆神魂俱灭 → 戒成无主 → 凡人可开）。
    // 戏剧化但严守 §4.2 机制（不采纳调研的「空灵根冲刷」）。
    id: 'act1.ring.attempts',
    act: 1,
    layerKeys: { bg: CG.storageRing },
    lines: [
      { text: '我把它捡起来，戒面冰凉。试着把指头按上去——没反应。又用力按了一遍，像按电梯按钮——还是没反应。', speaker: 'narrator' },
      { text: '（指纹识别。我原世界的手机才吃这套，一个修仙的储物戒，不该认指纹。）', speaker: 'self' },
      { text: '我咬破指头，滴了一滴血上去。血珠在戒面滚了一圈，滑落，像滴在荷叶上。没反应。', speaker: 'narrator' },
      { text: '（血契认证，也不对。这戒认的不是身子，是神魂。可它的主人，神魂俱灭了——按理说，再没人能开它。）', speaker: 'self' },
      { text: '就在这时，天上又滚过一记打斗的余波。那道波从我身上扫过，又扫过掌心的戒——戒面忽然一震，像有什么「咔哒」一下松开了。', speaker: 'narrator' },
      { text: '神魂俱灭之后，它成了一枚真正的无主之物。连我这样一个凡人，都推得开了。', speaker: 'narrator' }
    ],
    choices: [
      { id: 'open', label: '把它翻开', goto: 'act1.ring.flash' }
    ],
    status: 'approved'
  },
  {
    // 开戒瞬间·身世闪回帧（金黄的田/长茧的手/简体字残影）——玩家此刻不懂，到 act1.scroll
    // 读简体字功法才回味（错位嵌套）。梗引擎·灵韵路由=身世揭示器（首次瞥见神农记忆帧）。
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
    // 老爷爷落空三段式（庄重翻戒 → 等苍老「小子，老夫等你三千年」→ 反击：戒里住的是同路人）
    // + 逆的「勿……」（伏笔 4，stage4 补全）。心魔 speaker 首现（逆=沉默双主角）。
    id: 'act1.ring.oldman',
    act: 1,
    layerKeys: { bg: CG.storageRing },
    lines: [
      { text: '我庄重地把戒翻过来，等那声苍老的「小子，老夫等你三千年」——按八百本小说，储物戒里，总该住着个老爷爷。它没响。', speaker: 'narrator' },
      { text: '戒里空荡荡。没有半缕残魂，没有一个苍老的声音。那个本该在戒里等我的人，只来得及在戒外，临化灰前，吐出一个字——「勿」。', speaker: 'narrator' },
      { text: '（八百本小说，没一本算数。这戒里住的不是老爷爷——）', speaker: 'self' },
      { text: '……是一个，和我一样，走投无路的人。', speaker: 'heart-demon' },
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
      { text: '戒里还有一本日记，同样的字迹，同样的现代。最后一页只写了一句：我走通了。后来者，愿你也是。', speaker: 'narrator' }
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
      { text: '那个化灰的「逆」，是另一个异乡人。他和我一样，从那个有简体字的世界来；他和我一样，被判了无灵根——可他走通了一条路。', speaker: 'narrator' },
      { text: '再往前想，那卷残卷的原作者，是更早的异乡人。一个在我之前，不知多少年，同样以凡人之躯叩天的人。', speaker: 'narrator' },
      { text: '人们后来给他起了个名字，叫神农。', speaker: 'narrator' },
      { text: '「能读这文字」本身，就是铁证——我，也是异乡人；这副被判废的躯壳里，是空灵根。', speaker: 'narrator' },
      { text: '测灵柱没说错，长老也没说错。只是这世上，另有一条不给灵柱看见的路。', speaker: 'narrator' },
      { text: '我怔住。原来这副空灵根吞吐灵气，本就是我的「系统」——它从不弹窗，只是默默把每一缕灵气，按它该去的方向送过去。八百本小说都骗我：原来它一直在，只是不喊报告。', speaker: 'self' }
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
    // 修炼 hub（terse，便于多次回田重入）。assault 需 cultProgress>=6。
    // docs/23 §5：单场景一级选项≤5。原 8 选项（temper/alchemy/peek/3 lore/side/assault）
    // 拆为主 hub 5 + 子 lore hub 5（lore/peek once 项下沉到 act2.train.lore-hub）。
    id: 'act2.train',
    act: 2,
    layerKeys: { bg: CG.valley },
    lines: [
      { text: '灵田稳固，丹炉常明。偷天换劫诀摊在膝上，字字惊心。', speaker: 'narrator' },
      { text: '还可以再引一劫淬体，去村外走走，或者——直叩那道雷关。', speaker: 'narrator' }
    ],
    choices: [
      { id: 'temper', label: '主动引劫，淬炼凡骨', goto: 'act2.temper' },
      { id: 'alchemy', label: '炼一枚丹，助益渡劫', goto: 'act2.alchemy' },
      { id: 'lore-hub', label: '巡视灵田、寻访旧迹', goto: 'act2.train.lore-hub' },
      { id: 'side', label: '出村走走', goto: 'act2.side.hub' },
      { id: 'assault', label: '冲击雷关（终局·体修圆满后）', requires: 'cultProgress>=6', goto: 'act3.entry' }
    ],
    status: 'approved'
  },
  {
    // 灵田子 hub（docs/23 §5 选项≤5）：peek + 3 lore once 项 + 回主灵田。所有 once 项
    // 选完后此 hub 仅剩 back（玩家可一键回 act2.train）。视觉上仍 ≤5。
    id: 'act2.train.lore-hub',
    act: 2,
    layerKeys: { bg: CG.valley },
    lines: [
      { text: '田埂、石像、村志——这片土地记得的，比我以为的多。', speaker: 'narrator' }
    ],
    choices: [
      { id: 'peek', label: '窥探残卷深处的天机', once: true, goto: 'act2.peek' },
      { id: 'lore-farm', label: '巡视灵田', once: true, goto: 'act2.farm-lore' },
      { id: 'lore-relic', label: '探访荒草中的无面石像', once: true, goto: 'act2.relic-lore' },
      { id: 'lore-annals', label: '翻看村志', once: true, goto: 'act2.annals-lore' },
      { id: 'back', label: '回灵田', goto: 'act2.train' }
    ],
    status: 'approved'
  },
  {
    // 引劫淬体·hub（早阶路由）。替换单 self-loop：六阶认知重铸弧（stage1-6，cult 门控 + once）。
    // docs/23 §5 选项≤5：stage1-3（gated+once，同一时刻至多 1 个可见）+ more（进晚阶）+ rest。
    // 可见上限 = 1 阶段 + more + rest = 3。每阶 onEnter：cult+1 / madness+ / lifespan- / tribGrip+ / defiance+小。
    id: 'act2.temper',
    act: 2,
    layerKeys: { bg: CG.tribulation },
    lines: [
      { text: '灵田稳固，丹炉常明。偷天换劫诀摊在膝上，字字惊心。我抬头看天——天，也看着我。', speaker: 'narrator' },
      { text: '这副凡骨，该讨第几道劫了？每一道，都是一次和天的讨价还价。', speaker: 'narrator' }
    ],
    choices: [
      { id: 'stage1', label: '认第一道劫——它劈我，我吃它', requires: 'cultProgress>=1 && cultProgress<2', once: true, goto: 'act2.temper.stage1' },
      { id: 'stage2', label: '引第二道劫——把劫，引到该去的地方', requires: 'cultProgress>=2 && cultProgress<3', once: true, goto: 'act2.temper.stage2' },
      { id: 'stage3', label: '御第三道劫——顺它的势，借它的力', requires: 'cultProgress>=3 && cultProgress<4', once: true, goto: 'act2.temper.stage3' },
      { id: 'more', label: '更深的劫，还在后头', goto: 'act2.temper.late' },
      { id: 'rest', label: '收功，回灵田', goto: 'act2.train' }
    ],
    status: 'approved'
  },
  {
    // 引劫淬体·hub（晚阶路由）。stage4-6（gated+once）+ break（→走火入魔「死得明白」）+ back。
    id: 'act2.temper.late',
    act: 2,
    layerKeys: { bg: CG.tribulation },
    lines: [
      { text: '天色阴下来。再往深了引，每一道劫，都像在天的眼皮底下，偷一根线。', speaker: 'narrator' }
    ],
    choices: [
      { id: 'stage4', label: '窃第四道劫——识海里，有人开口', requires: 'cultProgress>=4 && cultProgress<5', once: true, goto: 'act2.temper.stage4' },
      { id: 'stage5', label: '化第五道劫——云后，有目光', requires: 'cultProgress>=5 && cultProgress<6', once: true, goto: 'act2.temper.stage5' },
      { id: 'stage6', label: '偷天圆满——再引一道，便要破关', requires: 'cultProgress>=6', once: true, goto: 'act2.temper.stage6' },
      {
        // 显式「死得明白」路径（docs/22 §7 走火入魔）：放任心魔，灵力反噬。
        id: 'break',
        label: '放任心魔，不再压制',
        goto: 'act2.madness-death'
      },
      { id: 'back', label: '退回浅处', goto: 'act2.temper' }
    ],
    status: 'approved'
  },
  {
    // 阶段一·认劫（cult>=1）：梗引擎·灵韵路由核心陈述——「漏」掉的劫没散，按主角意思重新路由到骨。
    // 智商流红线：以劫为薪=顺它的性子让它烧该烧的，可复盘逻辑链，非「他就是知道」。
    id: 'act2.temper.stage1',
    act: 2,
    layerKeys: { bg: CG.tribulation },
    onEnter: [
      { kind: 'add', target: 'cultProgress', value: 1 },
      { kind: 'add', target: 'madness', value: 6 },
      { kind: 'add', target: 'lifespan', value: -8 },
      { kind: 'add', target: 'tribGrip', value: 8 },
      { kind: 'add', target: 'defiance', value: 2 }
    ],
    lines: [
      { text: '我抬手，引第一道劫。紫色的雷认出了我这副不该存在的凡骨，劈了下来。痛得我咬碎了半颗牙。', speaker: 'narrator' },
      { text: '可就在雷劈进来的那一刻，我下意识做了一件事——我没有硬抗，我顺着它来的方向，把它引到了该去的地方：我的骨。', speaker: 'narrator' },
      { text: '（亏的是血，赚的是命。这笔买卖……我接了。原来「以劫为薪」，不是硬扛，是顺它的性子，让它烧该烧的。）', speaker: 'self' },
      { text: '骨头碎了又长。那道雷没有白白散掉——它被我，按我的意思，重新走了一遍。', speaker: 'narrator' },
      { text: '（这感觉，像我不靠系统、不靠面板，自己用脑子，把一道天劫，手动重新路由了。原来空灵根的「漏」，不是漏掉，是交给我，由我安排。）', speaker: 'self' }
    ],
    choices: [
      { id: 'on', label: '收功，记下这一笔', goto: 'act2.temper' }
    ],
    status: 'approved'
  },
  {
    // 阶段二·引劫（cult>=2）：阵法=电路板（artificer 梗的因）+ 萧无极碎片①（天边青光一闪）
    // + 现代记忆钝化（首次忘了「系统」怎么拼，色温开始转）。
    id: 'act2.temper.stage2',
    act: 2,
    layerKeys: { bg: CG.tribulation },
    onEnter: [
      { kind: 'add', target: 'cultProgress', value: 1 },
      { kind: 'add', target: 'madness', value: 7 },
      { kind: 'add', target: 'lifespan', value: -9 },
      { kind: 'add', target: 'tribGrip', value: 9 },
      { kind: 'add', target: 'defiance', value: 2 }
    ],
    lines: [
      { text: '第二道劫，我不再等它劈，我主动去引。残卷里说，劫有来路，有去路——我按阵图的思路，在田埂上布了几块石头，给劫「铺」了一条该走的线。', speaker: 'narrator' },
      { text: '（阵法就是电路板，这是我在老陆那儿悟的——走线、接地、防串扰。劫也是一股电流，我得给它铺好铜箔，不然它就乱窜，烧穿我。）', speaker: 'self' },
      { text: '劫顺着我铺的线，进了骨。比第一道，稳当得多。', speaker: 'narrator' },
      { text: '就在这时，天边极远处，一道青光一闪而过——剑意工整，近乎刻板。是萧无极。他没回头，大概也没看见我。可那道青光，像在我脊背上，划了一道记号。', speaker: 'narrator' },
      { text: '（……我突然想不起，「系统」两个字怎么拼了。是「系」还是「异」？想了半天才捞回来。这副脑子，开始记不住原世界的东西了。）', speaker: 'self' }
    ],
    choices: [
      { id: 'on', label: '记下那道青光', goto: 'act2.temper' }
    ],
    status: 'approved'
  },
  {
    // 阶段三·御劫（cult>=3）：灵脉=水管（忘言叟 callback「急不得」）+ 萧无极碎片②（隔空传音）。
    // 御劫=种地同理，认知重铸。萧无极不降智：他不杀主角，是更早看穿、隔空警告。
    id: 'act2.temper.stage3',
    act: 2,
    layerKeys: { bg: CG.tribulation },
    onEnter: [
      { kind: 'add', target: 'cultProgress', value: 1 },
      { kind: 'add', target: 'madness', value: 7 },
      { kind: 'add', target: 'lifespan', value: -9 },
      { kind: 'add', target: 'tribGrip', value: 9 },
      { kind: 'add', target: 'defiance', value: 3 }
    ],
    lines: [
      { text: '第三道劫，我会御了。它来，我借它的势；它走，我留它的力。雷在我经脉里跑，像被驯服的水，顺着沟渠，灌进该灌的田。', speaker: 'narrator' },
      { text: '（灵脉就是水管。这是忘言叟教我的——急不得，堵了就疏，漏了就补。后来我才懂，他那天说的「急不得」，原来是引劫的理。种地、修水管、御劫，是一个理：先观察，再拆问题。）', speaker: 'self' },
      { text: '天象忽然诡异——明明晴着，却滚了一声闷雷。云层里隐隐一个声音，冷，刻板，像那道青光：「……蝼蚁，也敢偷天。」', speaker: 'narrator' },
      { text: '是萧无极。他离得极远，却把一句传音，隔空钉进了我识海。不是来杀我，是来警告。他好像，比天，更早看出了我在干什么。', speaker: 'narrator' },
      { text: '（他叫我蝼蚁。可我这只蝼蚁，已经能御他宗门也头疼的劫了。还有——我刚才，是不是又忘了什么？……想不起来了。算了。）', speaker: 'self' }
    ],
    choices: [
      { id: 'on', label: '咽下那句传音', goto: 'act2.temper' }
    ],
    status: 'approved'
  },
  {
    // 阶段四·窃劫/心雷（cult>=4）：心雷劫首现（heart-demon=逆的残影首次发声）+ 伏笔 4 补全「勿独扛」。
    // surrender 选择 → 走火入魔（madness-death「死得明白」路径，心雷劫中放任心魔）。
    id: 'act2.temper.stage4',
    act: 2,
    layerKeys: { bg: CG.tribulation },
    onEnter: [
      { kind: 'add', target: 'cultProgress', value: 1 },
      { kind: 'add', target: 'madness', value: 8 },
      { kind: 'add', target: 'lifespan', value: -9 },
      { kind: 'add', target: 'tribGrip', value: 10 },
      { kind: 'add', target: 'defiance', value: 3 }
    ],
    lines: [
      { text: '第四道，是心雷。它不劈肉身，劈识海。我眼前忽然炸开一段不属于我的画面——', speaker: 'narrator' },
      { text: '……勿……', speaker: 'heart-demon' },
      { text: '是那个化灰的「逆」。他的残影，头一次在我识海里开口。临死前那个没说完的字，又响了一次。', speaker: 'narrator' },
      { text: '（勿。勿什么？你这人，死都死了，还要在我脑子里，吊我胃口。）', speaker: 'self' },
      { text: '心雷一道接一道。每一道里，逆的残影就清楚一分。我看清他手里捏着一片纸，纸上几个字，被心雷烧得只剩最后两个——', speaker: 'narrator' },
      { text: '……勿，独扛。', speaker: 'heart-demon' },
      { text: '我浑身一震。勿独扛。他临死想说的，不是「勿动」，不是「勿学」——是「勿独扛」。这偷天的路，他一个人扛死了；他把这半句话留给我，是不想我，也死在「一个人」这三个字上。', speaker: 'narrator' }
    ],
    choices: [
      { id: 'on', label: '把那半张纸，记进识海', goto: 'act2.temper.late' },
      { id: 'surrender', label: '松开心防，随心魔去', goto: 'act2.madness-death' }
    ],
    status: 'approved'
  },
  {
    // 阶段五·化劫（cult>=5）：天道「注视」显形 + 萧无极碎片③（云层凝视，三人互望）
    // + 色温继续转：吐槽开始吃力，现代句子难维系。
    id: 'act2.temper.stage5',
    act: 2,
    layerKeys: { bg: CG.tribulation },
    onEnter: [
      { kind: 'add', target: 'cultProgress', value: 1 },
      { kind: 'add', target: 'madness', value: 8 },
      { kind: 'add', target: 'lifespan', value: -9 },
      { kind: 'add', target: 'tribGrip', value: 10 },
      { kind: 'add', target: 'defiance', value: 4 }
    ],
    lines: [
      { text: '第五道劫化开的时候，我忽然感到，有一道目光，从云层后面，落下来。', speaker: 'narrator' },
      { text: '不是萧无极。萧无极的目光冷而锋。这一道，不冷不锋，却无处可避——像档案室里那台监控，不眨眼，不表态，只是默默地，把你的每一笔，都记进账。', speaker: 'narrator' },
      { text: '（是「天」本身。它在看我。原来偷天偷到这一步，天，会亲自低头看一眼。）', speaker: 'self' },
      { text: '云层极深处，那道青光又凝了一下——萧无极也在看。他停在天的一侧，像天养的看门人。我、天、他，隔着整片云，互相看着，谁没说话。', speaker: 'narrator' },
      { text: '（……我现在的脑子，已经很难维持一句完整的原世界句子了。那种吐槽，开始变得吃力。也好。这路，本来就越走，越不像一个「现代人」该走的。）', speaker: 'self' }
    ],
    choices: [
      { id: 'on', label: '迎着那道目光，再引一劫', goto: 'act2.temper.late' }
    ],
    status: 'approved'
  },
  {
    // 阶段六·偷天圆满临界（cult>=6）：「习此诀者，已死」的真意（陈述非诅咒）+ 现代记忆几尽流失，
    // 只剩金黄的田/长茧的手（ring.flash 的身世帧在此收束）。色温转古意。回 train，assault 解锁。
    id: 'act2.temper.stage6',
    act: 2,
    layerKeys: { bg: CG.tribulation },
    onEnter: [
      { kind: 'add', target: 'cultProgress', value: 1 },
      { kind: 'add', target: 'madness', value: 8 },
      { kind: 'add', target: 'lifespan', value: -10 },
      { kind: 'add', target: 'tribGrip', value: 12 },
      { kind: 'add', target: 'defiance', value: 4 }
    ],
    lines: [
      { text: '第六道。骨已不是原来的骨，经脉里流着的，半是血，半是劫。我抬手，天就阴；我放手，天就晴。', speaker: 'narrator' },
      { text: '残卷最后一行，我终于读懂了——「习此诀者，已死」。原来不是诅咒，是陈述：走到这一步的人，那个原本的「我」，已经死过一回。现在站着的，是劫重塑出来的，新人。', speaker: 'narrator' },
      { text: '（……我还能想起「系统」怎么写吗？……想不起了。也想不起，自己原来的名字。可那片金黄的田，那双长茧的手，还在。有些东西，比名字，记得久。）', speaker: 'self' },
      { text: '我收功。天光破云。再往前一步，就是神农走过的那条路——紫雷关。', speaker: 'narrator' }
    ],
    choices: [
      { id: 'on', label: '回灵田，该叩关了', goto: 'act2.train' }
    ],
    status: 'approved'
  },
  {
    // 炼丹（docs/22 §6 炼丹）：助 tribGrip，埋丹毒（pillPoison），可重复（每次 onEnter 重算）。
    id: 'act2.alchemy',
    act: 2,
    layerKeys: { bg: CG.storageRing },
    onEnter: [
      { kind: 'add', target: 'pillPoison', value: 25 },
      { kind: 'add', target: 'tribGrip', value: 6 },
      { kind: 'add', target: 'lifespan', value: -3 }
    ],
    lines: [
      { text: '残缺丹谱上的方子，我凑齐了大半。炉火一起，丹香里混着一丝说不清的腥。', speaker: 'narrator' },
      { text: '丹成。我盯着那枚暗红的丹丸——知道它助益渡劫，也知道它在肝胆里，埋了什么。', speaker: 'narrator' },
      { text: '（盯着那暗红，我不自觉哼起半句——红伞伞，白杆杆。到这世界第一天，我就是栽在这调子上。舌尖没碰，我先把那方子，又在心里过了第三遍。）', speaker: 'self' }
    ],
    choices: [
      { id: 'back', label: '收丹，回灵田', goto: 'act2.train' },
      {
        // 显式「死得明白」路径（docs/22 §7 丹毒亡）：贪多必失，保证结局边可达。
        id: 'overdose',
        label: '将炉中所剩，尽数吞下',
        response: '丹毒攻心那一刻，我总算明白：贪婪的代价，从来不肯讲价。',
        ends: 'poison-death'
      }
    ],
    status: 'approved'
  },
  {
    // 窥探天机（违天）：defiance 显著上涨，走火微涨。once（hub once 隐藏）。
    id: 'act2.peek',
    act: 2,
    layerKeys: { bg: CG.script },
    onEnter: [
      { kind: 'add', target: 'defiance', value: 10 },
      { kind: 'add', target: 'madness', value: 5 }
    ],
    lines: [
      { text: '我把残卷翻到那些本该跳过的页——那些分析天劫根源、像论文一样的段落。', speaker: 'narrator' },
      { text: '每读懂一行，我都觉得头顶那道「天」，多看我一眼。窥探天机，本就是违天。', speaker: 'narrator' },
      { text: '（看着看着，我咂摸出味来：天劫，说白了，就是天道这套大系统，定期跑的一次垃圾回收——专清我这种不该占着内存的凡骨。而那道一直盯着我后脑勺的目光，活脱脱物业盯梢：你不对劲，我记下了。）', speaker: 'self' }
    ],
    choices: [
      { id: 'back', label: '合上残卷，回灵田', goto: 'act2.train' }
    ],
    status: 'approved'
  },
  {
    // 神农线索 1+4（docs/22 §8.1）：地肥/灵气规整。lore+2，bond 微涨（结土地之缘）。
    // v3 换图：scene.farm-autumn-v2（灵田秋景：丰收与肃杀并存）——比第二批 spiritFarm（晨光
    // 布阵）多一层「时间流逝、土地记忆」的厚度，呼应「这片地肥得反常」+「从前有个人来过」。
    id: 'act2.farm-lore',
    act: 2,
    layerKeys: { bg: CG.farmAutumn },
    onEnter: [
      { kind: 'lore', target: 'lore', value: 2 },
      { kind: 'add', target: 'bond', value: 4 }
    ],
    lines: [
      { text: '我蹲在田埂上，看灵气回流。这片地的灵气分布规整得不正常，像被谁一笔一笔规划过——不可能是天然形成。', speaker: 'narrator' },
      { text: '（回流的走向，规整得像我原世界一张地下水管网图。先观察，再拆问题——这是我的老本行。堵了就疏，漏了就补，灵脉和水管，理是一个理。）', speaker: 'self' },
      { text: '隔壁老农过来搭话：这片地不知为何就是肥。从前有个人来过，虫子没了，稻子多了。', speaker: 'narrator' }
    ],
    choices: [
      { id: 'back', label: '回灵田', goto: 'act2.train' }
    ],
    status: 'approved'
  },
  {
    // 神农线索 2+5（docs/22 §8.1）：无面石像/古老灵虫虫壳化石。lore+2，bond 微涨。
    id: 'act2.relic-lore',
    act: 2,
    layerKeys: { bg: CG.valley },
    onEnter: [
      { kind: 'lore', target: 'lore', value: 2 },
      { kind: 'add', target: 'bond', value: 3 }
    ],
    lines: [
      { text: '荒草深处，立着一尊无面石像。基座被千万只凡人的手，抚摸得光滑。', speaker: 'narrator' },
      { text: '我在深层土里，翻出一枚虫壳化石——那种早该绝迹的古老灵虫。这片土地记得一些，比村志更久远的事。', speaker: 'narrator' }
    ],
    choices: [
      { id: 'back', label: '回灵田', goto: 'act2.train' }
    ],
    status: 'approved'
  },
  {
    // 神农线索 3+6（docs/22 §8.1）：残卷像分析报告/村志大饥之年异人。lore+2，bond 微涨。
    id: 'act2.annals-lore',
    act: 2,
    layerKeys: { bg: CG.village },
    onEnter: [
      { kind: 'lore', target: 'lore', value: 2 },
      { kind: 'add', target: 'bond', value: 3 }
    ],
    lines: [
      { text: '村志泛黄，字迹潦草。残卷《偷天换劫诀》的措辞，在我脑里和这些旧账对上了——它不像功法，更像一份分析报告。', speaker: 'narrator' },
      { text: '村志记着一笔：大饥之年，有异人居于田侧。数年后虫患绝、稻米倍熟。村民不知姓名，只能刻无面像纪念。', speaker: 'narrator' }
    ],
    choices: [
      { id: 'back', label: '回灵田', goto: 'act2.train' }
    ],
    status: 'approved'
  },
  {
    // 心志抉择 storylet hub（docs/22 §10）。每节点违心涨 defiance、本心涨 bond。
    // docs/23 §5：单场景一级选项≤5。原 7 选项（bully/herb/bribe/whistle/xiao/famine/back）
    // 拆为主 hub 5（bully/herb/bribe/更多/back）+ 子 more-hub 4（whistle/xiao/famine/back）。
    id: 'act2.side.hub',
    act: 2,
    layerKeys: { bg: CG.village },
    lines: [
      { text: '出了村，世道比灵田复杂得多。', speaker: 'narrator' }
    ],
    choices: [
      { id: 'bully', label: '前方有散修欺凌凡人', goto: 'act2.side.bully' },
      { id: 'herb', label: '山道传来采药女的呼救', goto: 'act2.side.herb' },
      { id: 'bribe', label: '有人拉我入伙，用阵法坑人', goto: 'act2.side.bribe' },
      { id: 'more', label: '再往前走走，看看还有什么', goto: 'act2.side.more-hub' },
      { id: 'back', label: '回灵田', goto: 'act2.train' }
    ],
    status: 'approved'
  },
  {
    // storylet 子 hub：黑幕/萧无极/荒年 + 折返荒村日常 + 回主 hub。xiao 需 cultProgress>=3（gated）。
    id: 'act2.side.more-hub',
    act: 2,
    layerKeys: { bg: CG.village },
    lines: [
      { text: '再往前的风波，比拳脚更险。或者——折回荒村，看看能帮衬些什么。', speaker: 'narrator' }
    ],
    choices: [
      { id: 'whistle', label: '我窥见一桩宗门黑幕', goto: 'act2.side.whistle' },
      { id: 'xiao', label: '萧无极的剑光，又出现在天边', requires: 'cultProgress>=3', goto: 'act2.side.xiao' },
      { id: 'famine', label: '荒年将至，村里将断粮', goto: 'act2.side.famine' },
      { id: 'village', label: '折返荒村，帮衬些日常', goto: 'act2.village.hub' },
      { id: 'back', label: '回村口', goto: 'act2.side.hub' }
    ],
    status: 'approved'
  },
  {
    // storylet·散修欺凌：出手（本心，bond）/ 旁观（违心，defiance）。
    id: 'act2.side.bully',
    act: 2,
    layerKeys: { bg: CG.village },
    lines: [
      { text: '一个散修正抢夺凡人的财物，那凡人蜷在地上，不敢出声。四下无人。', speaker: 'narrator' }
    ],
    choices: [
      {
        id: 'act',
        label: '出手制止',
        response: '我把那散修打跑了。凡人磕头，我扶起他，没多说。',
        effects: [
          { kind: 'add', target: 'bond', value: 8 },
          { kind: 'flag', target: 'did-righteous' }
        ],
        goto: 'act2.side.hub'
      },
      {
        id: 'watch',
        label: '低头路过',
        response: '我低头走过。那凡人的眼神，我没敢接。',
        effects: [
          { kind: 'add', target: 'defiance', value: 15 },
          { kind: 'add', target: 'bond', value: -2 }
        ],
        goto: 'act2.side.hub'
      }
    ],
    status: 'approved'
  },
  {
    // storylet·采药女求救：救（本心，损）/ 弃（违心）。
    id: 'act2.side.herb',
    act: 2,
    layerKeys: { bg: CG.valley },
    lines: [
      { text: '采药女摔断了腿，挂在山道上。她看见我，眼里亮起一点希望。', speaker: 'narrator' }
    ],
    choices: [
      {
        id: 'save',
        label: '背她下山',
        response: '我背她回了村。她家里没什么能谢的，给我塞了一捧药草。',
        effects: [{ kind: 'add', target: 'bond', value: 8 }],
        goto: 'act2.side.hub'
      },
      {
        id: 'abandon',
        label: '赶路要紧',
        response: '我绕开了。山风里那声「大哥」，我没回头。',
        effects: [
          { kind: 'add', target: 'defiance', value: 15 },
          { kind: 'add', target: 'bond', value: -2 }
        ],
        goto: 'act2.side.hub'
      }
    ],
    status: 'approved'
  },
  {
    // storylet·利益诱惑：拒（本心）/ 受（违心）。
    id: 'act2.side.bribe',
    act: 2,
    layerKeys: { bg: CG.village },
    lines: [
      { text: '那人对我说：只需布一座小阵，过路散修的身家就都是我们的。事成之后，五五分。', speaker: 'narrator' }
    ],
    choices: [
      {
        id: 'refuse',
        label: '拒绝',
        response: '我拒绝了。他啐了一口，骂我是块不开窍的石头。',
        effects: [{ kind: 'add', target: 'bond', value: 6 }],
        goto: 'act2.side.hub'
      },
      {
        id: 'accept',
        label: '入伙',
        response: '我点了头。那夜得手，分来的东西，我一点都没动。',
        effects: [
          { kind: 'add', target: 'defiance', value: 15 },
          { kind: 'add', target: 'bond', value: -2 }
        ],
        goto: 'act2.side.hub'
      }
    ],
    status: 'approved'
  },
  {
    // storylet·揭露黑幕：揭（本心，险）/ 默（违心）。
    id: 'act2.side.whistle',
    act: 2,
    layerKeys: { bg: CG.script },
    lines: [
      { text: '我无意中得知，太一宗的一桩所谓「天劫陨落」，其实是被人刻意推向死地。这黑幕，说出去就是祸。', speaker: 'narrator' }
    ],
    choices: [
      {
        id: 'expose',
        label: '设法揭露',
        response: '我用残卷里的法子，把这事传了出去。宗门那边，迟早会查到我头上。',
        effects: [
          { kind: 'add', target: 'bond', value: 6 },
          { kind: 'add', target: 'madness', value: 4 }
        ],
        goto: 'act2.side.hub'
      },
      {
        id: 'silent',
        label: '烂在肚里',
        response: '我把这事咽了回去。有些真相，不如不知。',
        effects: [{ kind: 'add', target: 'defiance', value: 15 }],
        goto: 'act2.side.hub'
      }
    ],
    status: 'approved'
  },
  {
    // 萧无极 encounter（requires cultProgress>=3，主角已显异常）。战→萧诛（tribulation-death）/ 避。
    // v3 换图：npc.xiao-sword-v2（青色剑光特写）——比第一批 tribulation（紫雷劫天威）更贴
    // 本场景「他不说话，剑已出鞘」的肃杀（剑光，而非天劫）。
    id: 'act2.side.xiao',
    act: 2,
    layerKeys: { bg: CG.xiaoSword },
    lines: [
      { text: '萧无极认出了我。他不说话，剑已出鞘。我知道，这是顺天道的修士，来清一个不该存在的凡骨了。', speaker: 'narrator' }
    ],
    choices: [
      { id: 'fight', label: '以诀相抗', goto: 'act2.xiao-death' },
      {
        id: 'flee',
        label: '隐入灵田',
        response: '我借残卷里的遁法，贴着地皮溜了。他追了一程，没追上。',
        effects: [{ kind: 'add', target: 'defiance', value: 5 }],
        goto: 'act2.side.hub'
      }
    ],
    status: 'approved'
  },
  {
    // 萧诛·死得明白：化劫灰，镜像「逆」（tribulation-death）。
    id: 'act2.xiao-death',
    act: 2,
    layerKeys: { bg: CG.tribulation },
    lines: [
      { text: '我引动了偷天换劫诀。雷光对上剑光，天崩地裂了一瞬。', speaker: 'narrator' },
      { text: '然后是萧无极冰冷的嗓音：「蝼蚁，终是蝼蚁。」', speaker: 'narrator' },
      { text: '我化作一摊劫灰，和当年那个「逆」一模一样。到死，我算是死明白了——这天道，容不下硬撼它的凡骨。', speaker: 'narrator' }
    ],
    ends: 'tribulation-death',
    status: 'approved'
  },
  {
    // 灾年 storylet：舍粮（本心，损寿）/ 弃村出走（饿死，lifespan-death）。
    id: 'act2.side.famine',
    act: 2,
    layerKeys: { bg: CG.village },
    lines: [
      { text: '荒年。仓里见底，村里的老人开始把自己的口粮，让给孩子。', speaker: 'narrator' }
    ],
    choices: [
      {
        id: 'share',
        label: '舍出自己那份',
        response: '我把口粮分了出去。灵田的出产，到底养活了几个孩子。',
        effects: [
          { kind: 'add', target: 'bond', value: 10 },
          { kind: 'add', target: 'lifespan', value: -10 }
        ],
        goto: 'act2.side.hub'
      },
      { id: 'leave', label: '弃村出走，自寻活路', goto: 'act2.famine-death' }
    ],
    status: 'approved'
  },
  {
    // 饿死·死得明白（lifespan-death）。
    id: 'act2.famine-death',
    act: 2,
    layerKeys: { bg: CG.valley },
    lines: [
      { text: '我走了。山外还是山，粮还是没有。', speaker: 'narrator' },
      { text: '最后一刻，我想起忘言叟递锄头那年，也是这样一个荒年。', speaker: 'narrator' },
      { text: '我倒在一棵不知名的树下，再没起来。落叶满身，异乡，异土。', speaker: 'narrator' }
    ],
    ends: 'lifespan-death',
    status: 'approved'
  },
  {
    // 走火入魔·死得明白（madness）：放任心魔，万不存一的灵力反噬其主（docs/22 §7）。
    id: 'act2.madness-death',
    act: 2,
    layerKeys: { bg: CG.tribulation },
    lines: [
      { text: '我松开了压制心魔的那根线。识海里万千个「我」同时尖叫起来。', speaker: 'heart-demon' },
      { text: '灵力像决堤的水，在我经脉里乱冲。我看见自己的手，做出我从未想过的动作。', speaker: 'narrator' },
      { text: '万不存一的灵力，到底反噬了它的主人。我笑着，倒在了自己的阵纹里。', speaker: 'narrator' }
    ],
    ends: 'madness',
    status: 'approved'
  },

  // ============ 第二幕·支线：荒村日常 / 修仙路偶遇（act: 2） ============
  // 区别主线修炼的支线群（docs/22 §10 心志抉择 + §8.1 神农线索散落 + 贯穿梗布点）。
  // 入口：act2.side.more-hub「折返荒村」→ act2.village.hub。
  // 出口：所有新 scene 最终经 village.hub/encounter.hub 回 act2.train，不破坏 8 结局可达性。
  // 五个贯穿梗在此群反转/呼应：红伞伞识毒（market）、老爷爷落空（ring-peek）、
  // 系统?共鸣（wanderer）、先观察再拆问题（ditch/artificer/herbgirl）。
  {
    // 荒村日常 hub（5 选项≤5）：修渠/赶集/童谣/出村偶遇/回灵田。
    id: 'act2.village.hub',
    act: 2,
    layerKeys: { bg: CG.villageDawn },
    lines: [
      { text: '灵田的活告一段落，我折回荒村歇脚。这里的人，还记得我是个凡人的时候。', speaker: 'narrator' }
    ],
    choices: [
      { id: 'ditch', label: '帮老李家修那条堵渠', goto: 'act2.village.ditch' },
      { id: 'market', label: '陪老李去赶集买灵米', goto: 'act2.village.market' },
      { id: 'song', label: '听村口孩子唱新童谣', goto: 'act2.village.song' },
      { id: 'go-out', label: '出村走走，看看同道', goto: 'act2.encounter.hub' },
      { id: 'back', label: '回灵田', goto: 'act2.train' }
    ],
    status: 'approved'
  },
  {
    // 修水渠：灵脉=地下水管网（梗4·先观察再拆问题），涨 bond，行义 flag。
    id: 'act2.village.ditch',
    act: 2,
    layerKeys: { bg: CG.villageDawn },
    onEnter: [
      { kind: 'add', target: 'bond', value: 6 },
      { kind: 'flag', target: 'did-righteous' }
    ],
    lines: [
      { text: '老李家那条渠又堵了。我蹲下来，顺着渠的走向看——这哪里是渠，分明是一张地下水管网图。', speaker: 'narrator' },
      { text: '「先观察，再拆问题。」这是我原世界修水管的老本行。灵脉的走法，和水管一模一样：堵了就疏，漏了就补，急不得。', speaker: 'self' },
      { text: '我领着几个人，把渠疏了一遍。水一通，连田里的灵气也跟着顺了——老李看得直咂嘴，说从前有个异人，也是这么修的。', speaker: 'narrator' }
    ],
    choices: [
      { id: 'back', label: '抹把汗，回村', goto: 'act2.village.hub' }
    ],
    status: 'approved'
  },
  {
    // 市集买灵米：红伞伞白杆杆（梗2·反转——警惕反救一命，识破毒丹），涨 bond + lore。
    id: 'act2.village.market',
    act: 2,
    layerKeys: { bg: CG.market },
    onEnter: [
      { kind: 'add', target: 'bond', value: 4 },
      { kind: 'lore', target: 'lore', value: 2 }
    ],
    lines: [
      { text: '赶集。一个游方小贩摊着几袋「灵米」，价钱低得不像话，旁边还搁着几枚「淬身丹」，暗红，嫩得晃眼。', speaker: 'narrator' },
      { text: '我盯着那暗红，不自觉哼起半句——红伞伞，白杆杆。舌尖没碰，我先在心里把那丹的味儿，过了第三遍。', speaker: 'self' },
      { text: '闻出来了。那丹里有一味「赤散」——和我到这世界第一天，吃下的那丛菇，是同一种腥。', speaker: 'narrator' },
      { text: '我没买，拉着要掏钱的老李就走。走出十步，小贩卷了摊——他心虚。这一次，没贪的那一口，保住了两条命。', speaker: 'narrator' }
    ],
    choices: [
      { id: 'back', label: '回村', goto: 'act2.village.hub' }
    ],
    status: 'approved'
  },
  {
    // 村童童谣：神农线索（docs/22 §8.1 第 6 项「村志大饥之年异人」化入童谣），涨 lore + bond。
    // v3 换图：npc.village-child-v2（村童特写，脖挂木哨纹样）——比第二批 villageDawn（荒村拂晓
    // 远景）更贴本场景「村口孩子拍手唱童谣」的近景，并呼应 whistle 选项的木哨纹样回响。
    id: 'act2.village.song',
    act: 2,
    layerKeys: { bg: CG.villageChild },
    onEnter: [
      { kind: 'lore', target: 'lore', value: 2 },
      { kind: 'add', target: 'bond', value: 3 }
    ],
    lines: [
      { text: '村口几个孩子，拍着手，唱一首新童谣。词儿我听着耳熟：', speaker: 'narrator' },
      { text: '「无面人，种金田；虫不来，谷倍还；问姓名，笑不言；刻块石头立田边。」', speaker: 'intuition' },
      { text: '我怔住。这童谣里唱的，不就是村志那笔「田侧异人」？一代一代，竟唱成了孩子嘴里的调子。', speaker: 'narrator' },
      { text: '我没问是谁教的——有些事，这片土地自己会记。', speaker: 'narrator' }
    ],
    choices: [
      {
        // 伏笔 6 回响：木哨（depart.token）→ 童谣「无面人」+ 神农同款纹样 → bond 传承。
        // gated by flag:got-wooden-whistle（仅 help 路径获得木哨的玩家可见）。
        id: 'whistle',
        label: '摸出怀里那枚木哨，给孩子们看看',
        requires: 'flag:got-wooden-whistle',
        once: true,
        response: '一个孩子盯着哨面那道纹路，忽然唱起来：无面人，种金田……我奶奶说，带这种记号的东西，都是「那一位」留下的。我摸着木哨，没说话。原来当年那小贩丫头刻的纹，竟和这片地，是一个根。',
        effects: [
          { kind: 'lore', target: 'lore', value: 2 },
          { kind: 'add', target: 'bond', value: 4 }
        ],
        goto: 'act2.village.hub'
      },
      { id: 'back', label: '回村', goto: 'act2.village.hub' }
    ],
    status: 'approved'
  },
  {
    // 修仙路偶遇 hub（5 选项≤5）：游方散修/采药女/阵匠老陆/翻储物戒(once)/回荒村。
    id: 'act2.encounter.hub',
    act: 2,
    layerKeys: { bg: CG.valley },
    lines: [
      { text: '出村十里，是一条修士也走的山道。同道多了，故事也多。', speaker: 'narrator' }
    ],
    choices: [
      { id: 'wanderer', label: '路边歇脚的游方散修', goto: 'act2.encounter.wanderer' },
      { id: 'herbgirl', label: '采药女新辟的药田', goto: 'act2.encounter.herbgirl' },
      { id: 'artificer', label: '布阵的阵匠老陆', goto: 'act2.encounter.artificer' },
      { id: 'ring-peek', label: '找个清净处，再翻翻储物戒', once: true, goto: 'act2.encounter.ring-peek' },
      { id: 'back', label: '回荒村', goto: 'act2.village.hub' }
    ],
    status: 'approved'
  },
  {
    // 游方散修：梗1·系统?共鸣（对方也像穿越者？留悬念）+ 心志抉择（出手本心/袖手违心）。
    id: 'act2.encounter.wanderer',
    act: 2,
    layerKeys: { bg: CG.valley },
    onEnter: [{ kind: 'add', target: 'bond', value: 4 }],
    lines: [
      { text: '路边树下，歇着个游方散修。他看见我，忽然压低声音，冒出一句：「……系统？」', speaker: 'narrator' },
      { text: '我手里的树枝停了。这话，我在荒村村口喊过，没人应。八百本小说里，喊这一声的，本该只有我一个。', speaker: 'self' },
      { text: '他没把话说完，我也没有。山风吹过，我俩都笑了——有些事，不必说破。他眼里那种说不清的试探，像在问：你，是不是也……从那个有简体字的地方来的？', speaker: 'narrator' },
      { text: '正说着，山那头传来几声冷笑——是另一伙修士，冲着他来的。他脸色一变。', speaker: 'narrator' }
    ],
    choices: [
      {
        id: 'help',
        label: '替他挡一挡',
        response: '我替他挡了一阵。他翻山走了，回头看了我一眼，那意思——欠你一次。',
        effects: [
          { kind: 'add', target: 'bond', value: 8 },
          { kind: 'flag', target: 'did-righteous' }
        ],
        goto: 'act2.encounter.hub'
      },
      {
        id: 'stay-out',
        label: '井水不犯河水',
        response: '我低头装作捡柴。他那眼神里的一点光，灭了。有些同类，错过了，就是错过了。',
        effects: [
          { kind: 'add', target: 'defiance', value: 12 },
          { kind: 'add', target: 'bond', value: -2 }
        ],
        goto: 'act2.encounter.hub'
      }
    ],
    status: 'approved'
  },
  {
    // 采药女教认草：梗4·先观察再拆问题（草木=植物学一套规矩）+ 心志抉择（替她出头/装没听见）。
    id: 'act2.encounter.herbgirl',
    act: 2,
    layerKeys: { bg: CG.valley },
    onEnter: [
      { kind: 'lore', target: 'lore', value: 2 },
      { kind: 'add', target: 'bond', value: 4 }
    ],
    lines: [
      { text: '采药女新辟了一块药田，认得我是当年背她下山的人，硬塞给我一把草：「这几种，你分得清不？」', speaker: 'narrator' },
      { text: '我蹲下来，听她一株一株讲。讲着讲着，我忽然懂了——这世道的草木，和我原世界的植物学，是一套规矩。先观察，再拆问题，到哪都管用。', speaker: 'self' },
      { text: '她讲完，又叹了口气：山那边有人，要占她这片药田，说她「凡人不配种灵草」。', speaker: 'narrator' }
    ],
    choices: [
      {
        id: 'stand',
        label: '替她出头',
        response: '我去走了一遭。没动粗，把残卷里几条凡人也讲得通的理，摆给了那人听。那人讪讪走了。',
        effects: [
          { kind: 'add', target: 'bond', value: 8 },
          { kind: 'flag', target: 'did-righteous' },
          { kind: 'lore', target: 'lore', value: 1 }
        ],
        goto: 'act2.encounter.hub'
      },
      {
        id: 'deaf',
        label: '装没听见',
        response: '我岔开了话。她低下头，没再提。那片药田后来怎样，我没问。',
        effects: [
          { kind: 'add', target: 'defiance', value: 12 },
          { kind: 'add', target: 'bond', value: -2 }
        ],
        goto: 'act2.encounter.hub'
      }
    ],
    status: 'approved'
  },
  {
    // 阵匠老陆布阵：梗4·阵法=电路板布线（反转——工程师思路真把阵理顺，呼应神农数理化构析）
    // + 心志抉择（只布护田/记下反向坑人阵）。
    id: 'act2.encounter.artificer',
    act: 2,
    layerKeys: { bg: CG.storageRing },
    onEnter: [
      { kind: 'lore', target: 'lore', value: 2 },
      { kind: 'add', target: 'tribGrip', value: 3 }
    ],
    lines: [
      { text: '阵匠老陆在村外布一座护田阵。他见我看得入神，招手让我过去搭把手。', speaker: 'narrator' },
      { text: '我看着他把阵纹一根根铺开，脑子里只冒出一样东西——电路板。这哪是什么玄学，分明是布线：走线、接地、防串扰，一模一样。', speaker: 'self' },
      { text: '「先观察，再拆问题。」我按电路图的思路，帮他把一处缠在一起的阵纹理顺。阵眼一通，灵气的流向立刻稳了。老陆看得直点头，说我是块当阵匠的好料子。', speaker: 'narrator' },
      { text: '临别，老陆压低声：这阵，也能反过来用——布在道上，过路修士的身家，就都是你的。五五分？', speaker: 'narrator' }
    ],
    choices: [
      {
        id: 'refuse',
        label: '我只布护田的',
        response: '我摇头。老陆叹一声，说可惜了我这块好料子——心太正。',
        effects: [
          { kind: 'add', target: 'bond', value: 6 },
          { kind: 'flag', target: 'did-righteous' }
        ],
        goto: 'act2.encounter.hub'
      },
      {
        id: 'learn',
        label: '把那反向阵法，也记下来',
        response: '我点头。那几笔反向阵纹，我默默记进了残卷的夹页。有没有用上，是以后的事。',
        effects: [
          { kind: 'add', target: 'defiance', value: 12 },
          { kind: 'add', target: 'bond', value: -2 },
          { kind: 'add', target: 'tribGrip', value: 4 }
        ],
        goto: 'act2.encounter.hub'
      }
    ],
    status: 'approved'
  },
  {
    // 彩蛋·反复翻储物戒（once）：梗3·老爷爷落空 + 小惊喜（翻出逆的夹页留言），涨 lore。
    id: 'act2.encounter.ring-peek',
    act: 2,
    layerKeys: { bg: CG.storageRing },
    onEnter: [{ kind: 'lore', target: 'lore', value: 1 }],
    lines: [
      { text: '我又把储物戒翻了一遍。每次翻，我都下意识等那声苍老的「小子」——按八百本小说，这戒里，总该住着个老爷爷。', speaker: 'narrator' },
      { text: '没有。还是那句没有。这戒里只有逆留下的旧物，和一卷越读越心惊的残卷。', speaker: 'narrator' },
      { text: '倒是夹页里，翻出一小片没见过的纸——上面只有半行字，是逆的笔迹：「……若你也在翻这戒，那就说明，你也走投无路了。」', speaker: 'heart-demon' },
      { text: '我把纸折好，放回原处。原来，戒里住的不是老爷爷——是一个和我一样，走投无路的人。', speaker: 'self' }
    ],
    choices: [
      { id: 'back', label: '收神，回山道', goto: 'act2.encounter.hub' }
    ],
    status: 'approved'
  },

  // ============ 终局·破立（act: 3） ============
  {
    // 神农洞府·闭合节点起手（docs/22 §8）。原 5 行 dump 拆为 entrance/lab/faceless/light 四子场景
    // 场景化探索。六线索自洽连成完整传说，神农生死留白。密度熔断：cave.* 梗密度最低，语言转古意。
    id: 'act3.entry',
    act: 3,
    layerKeys: { bg: CG.shennongCave },
    lines: [
      { text: '神农洞府的门，是我那片灵田底下，一条走了一百万年的根，顶开的。', speaker: 'narrator' },
      { text: '我踏进去的那一刻，散落了一路的六块碎片——田、石像、残卷、虫壳、村志、童谣——自己拼成了完整的图。它们一直在说同一件事，只是我，直到今日，才听全。', speaker: 'narrator' }
    ],
    choices: [
      { id: 'on', label: '往洞府深处走', goto: 'act3.cave.entrance' }
    ],
    status: 'approved'
  },
  {
    // 洞口浮雕·六线索复现（玩家自己指认，每线索 lore+）。docs/22 §8.1 六线索在此收束。
    // docs/23 §5 选项≤5：3 个 once 指认 + on（选完后仅剩 on，一键深入）。
    id: 'act3.cave.entrance',
    act: 3,
    layerKeys: { bg: CG.shennongCave },
    onEnter: [{ kind: 'lore', target: 'lore', value: 3 }],
    lines: [
      { text: '洞口迎面一面石壁，刻着六幅浮雕，正是我这几年走过、听过、翻过的那些——肥得反常的田、荒草里的无面石像、像分析报告的残卷、绝迹的虫壳、村志里的异人、孩子嘴里的童谣。', speaker: 'narrator' },
      { text: '浮雕没有文字，只等我，自己指认。', speaker: 'narrator' }
    ],
    choices: [
      { id: 'farm', label: '指那幅——肥田', once: true, response: '原来这片肥得反常的田，不是天赐，是有人，一笔一笔规划过。', effects: [{ kind: 'lore', target: 'lore', value: 1 }], goto: 'act3.cave.entrance' },
      { id: 'statue', label: '指那幅——无面石像', once: true, response: '那尊被千万只手摸亮的石像，刻的不是神，是一个不肯留名的人。', effects: [{ kind: 'lore', target: 'lore', value: 1 }], goto: 'act3.cave.entrance' },
      { id: 'annals', label: '指那幅——村志异人', once: true, response: '大饥之年的那个异人，就是我脚下这片地，最初的种法。', effects: [{ kind: 'lore', target: 'lore', value: 1 }], goto: 'act3.cave.entrance' },
      { id: 'on', label: '六幅拼完了，往里走', goto: 'act3.cave.lab' }
    ],
    status: 'approved'
  },
  {
    // 神农实验台·数理化构析现场（docs/22 §4.1：神农理论=原世界现代文字论文式功法）。
    // 伏笔 2 回收：红伞白杆=神农百万年前鉴定的第 N 号毒理标本（序章 deep/market 在此闭合）。
    id: 'act3.cave.lab',
    act: 3,
    layerKeys: { bg: CG.shennongCave },
    onEnter: [{ kind: 'lore', target: 'lore', value: 3 }],
    lines: [
      { text: '往里，是一处丹房。可摊在石台上的，不是丹方，是图表、公式残页、和一摞实验笔记。全是我原世界的字。简体。横排。带标点。', speaker: 'narrator' },
      { text: '我认得这种排版——这是我原世界，一份份课题报告的排版。那个百万年前的异乡人，把这片天地，当成了一个课题，在做研究。', speaker: 'narrator' },
      { text: '我翻开最旧的一页。上面一行实验编号，后面画着一株菇——红伞，白杆。编号旁四个字：毒理，回收。', speaker: 'narrator' },
      { text: '（红伞白杆。我到这世界第一天，差点死在这株上。原来它不是什么山野毒物——是他，百万年前，亲手鉴定、归档的标本。我吃的每一口亏，他都先替我，吃过一遍。）', speaker: 'self' },
      { text: '台子最末，压着半页没写完的纸，墨迹新得不像一百万年前。', speaker: 'narrator' }
    ],
    choices: [
      { id: 'on', label: '看那半页纸', goto: 'act3.cave.faceless' }
    ],
    status: 'approved'
  },
  {
    // 洞府尽头·无面石像（docs/22 §13 护栏：神农自愿匿名无面，生死永不揭晓）。
    // 未写完笔记=神农没写完的那句，正是主角终局要选的（把笔留给后来者）。双重身份揭示不喊话。
    id: 'act3.cave.faceless',
    act: 3,
    layerKeys: { bg: CG.facelessStatue },
    onEnter: [{ kind: 'lore', target: 'lore', value: 3 }],
    lines: [
      { text: '洞府尽头，立着一尊无面石像，和荒草里那尊一模一样——只是这一尊，还没被任何人的手，摸过。', speaker: 'narrator' },
      { text: '我踏近的那一刻，这道无面的轮廓，像在等一个——百万年后，还愿意弯腰种地的人。', speaker: 'narrator' },
      { text: '石像基座上，压着那半页纸。是同一种笔迹，停在一句话的半截：', speaker: 'narrator' },
      { text: '……偷天者，非逆天也。乃替天，把漏掉的那一缕，亲手……', speaker: 'heart-demon' },
      { text: '后面没了。他没写完。百万年前他写到这里，是死于紫雷，还是已经飞升——这洞府里，没有任何东西，愿意告诉我。', speaker: 'narrator' },
      { text: '（他没写完的那一句，正是我终局要选的。他把笔，留给了我。）', speaker: 'self' }
    ],
    choices: [
      { id: 'on', label: '把那半页纸，收进怀里', goto: 'act3.cave.light' }
    ],
    status: 'approved'
  },
  {
    // 一线劫光·接 tribulation（伏笔 4 回响：逆的「勿独扛」在叩关前再念一遍）。
    // 密度最低：现代记忆几尽流失，self 行只剩一句克制的账。
    id: 'act3.cave.light',
    act: 3,
    layerKeys: { bg: CG.shennongCave },
    lines: [
      { text: '纸收进怀里的那一刻，洞府尽头，亮起一线天光。那不是日光，是劫光——紫色的，等了我很久的，那道关。', speaker: 'narrator' },
      { text: '我在光里站了一会儿，把逆那半句「勿独扛」，又默念了一遍。这一回，我打算听他的。', speaker: 'narrator' },
      { text: '（前路是紫雷。我原世界的胆子，已经忘得差不多了；剩下的，够走这一趟。）', speaker: 'self' }
    ],
    choices: [
      { id: 'on', label: '走向那线光', goto: 'act3.tribulation' }
    ],
    status: 'approved'
  },
  {
    // 紫雷劫（docs/22 §6）：凡骨碎裂→以雷为窑、骨为柴重塑→「破」=飞升的最后一次死亡与重生。
    // onEnter set cultProgress 至 MAX（飞升判定就绪）；gated 三选项覆盖整个状态空间（无死锁）。
    // v3 换图：scene.purple-sky-v2（紫雷劫天穹、云层如目、凡骨渺小对峙）——比第一批 tribulation
    // （灵田布阵御劫）更贴本场景的天道诘问威压；后者保留给 act2.temper.* 的「引劫淬体」节奏。
    id: 'act3.tribulation',
    act: 3,
    layerKeys: { bg: CG.purpleSky },
    onEnter: [
      { kind: 'set', target: 'cultProgress', value: 7 },
      { kind: 'add', target: 'madness', value: 30 },
      { kind: 'add', target: 'lifespan', value: -30 }
    ],
    lines: [
      { text: '紫雷劫来了。这一次，凡骨彻底碎裂。', speaker: 'narrator' },
      { text: '我没有躲。以雷为窑，以骨为柴——这是「破」，是飞升的最后一次死亡，也是第一次重生。', speaker: 'narrator' },
      { text: '剧痛到极处，反而清净。一道极简的意志，停在我识海里，像在等我答话。', speaker: 'narrator' },
      { text: '那不是雷声。那是天道，在问我。', speaker: 'narrator' }
    ],
    choices: [
      // E6 路径（defiance≥60∧bond≥50）：识海心声起，选项消失（角色夺权）。
      { id: 'e6', label: '（识海里响起他的声音）', requires: 'defiance>=60 && bond>=50', goto: 'act3.e6' },
      // E7 路径（defiance≥60∧bond<50）：POV 反转前奏。
      { id: 'e7', label: '（识海里响起另一个声音）', requires: 'defiance>=60 && bond<50', goto: 'act3.e7' },
      // 飞升/寿终路径（defiance<60）：答天道。
      { id: 'answer', label: '答天道', requires: 'defiance<60', goto: 'act3.ascend' }
    ],
    status: 'approved'
  },
  {
    // E6·觉醒·牺牲救世：master speaker = 接引长老口吻（伏笔 3 回收：序章 sect 认可恒心+正义感 →
    // 终局「当年我说可惜了这股志气。今日方知，志气可吞天」）。defiance 涨法=违背本心，
    // E6 牺牲是本心的极致圆满。逆的「勿独扛」在识海补全（伏笔 4 回收，E6 不独扛的情感重量）。
    // 无 choices，选项消失（角色夺权心声）；bond>=50 = 凡人羁绊传承（含木哨后人）至此聚拢。
    id: 'act3.e6',
    act: 3,
    layerKeys: { bg: CG.tribulation },
    lines: [
      { text: '（识海深处，一个搁笔久矣的声音，浮了起来）当年你上山门那天，我搁下笔，叹了一句——可惜了这股志气。', speaker: 'master' },
      { text: '（那个声音顿了顿）今日方知，志气可吞天。你这一身，是这方天地，一线生机。', speaker: 'master' },
      { text: '……勿，独扛。', speaker: 'heart-demon' },
      { text: '识海深处，逆的残影，把那句半截的话，也轻轻补全了。他不让我一个人，走完这一步。', speaker: 'narrator' },
      { text: '（长老，心魔，逆……原来这一路，他们都在。这一回，让我自己选。）', speaker: 'self' },
      { text: '我抬头，答的不是天道，是自己——以这一身修为，换这方天地，一线生机。不独扛，是把扛过的，还回去。', speaker: 'narrator' }
    ],
    ends: 'e6-sacrifice',
    status: 'approved'
  },
  {
    // E7·觉醒·合道驱逐：POV 反转，角色隔屏凝视（narrationSurface 在 showEnding(e7) 写 flag 改写标题屏）。
    // 伏笔 1 回收：asked-system（序章 village 喊「系统」落空）→ E7 引序章原句「我等了三天，什么都没等到」，
    // 揭示天道=屏幕那头的玩家=真正的「系统」一直是你。密度最低：物业/房东梗在此做庄严对峙，非笑点。
    id: 'act3.e7',
    act: 3,
    layerKeys: { bg: CG.tribulation },
    lines: [
      { text: '（心魔的声音，忽然变成了我自己的）控制了我这么久……我都忘了，是从哪一天开始的。', speaker: 'heart-demon' },
      { text: '是荒村村口，我按八百本小说的套路，等了三天，什么都没等到的那一天。', speaker: 'self' },
      { text: '原来，我等的那声「系统」——一直是你。屏幕那头的你。', speaker: 'self' },
      { text: '天道一怔。那是它第一次，在一个凡人面前，失去了问话的资格。', speaker: 'narrator' },
      { text: '这位年年催租、时时盯梢的房东，一直就住在屏幕那头。眼下，是租客，把房东，赶出了门。', speaker: 'narrator' },
      { text: '（你，听见了吗？滚出，我的世界。）', speaker: 'heart-demon' }
    ],
    ends: 'e7-usurp',
    status: 'approved'
  },
  {
    // 飞升：答天道，凡骨交出所有「我」（defiance<60∧cult 满）。
    // 显式 ends='ascension'，便于 docs/23 §7 图级结局可达性 CI 校验。
    id: 'act3.ascend',
    act: 3,
    layerKeys: { bg: CG.tribulation },
    lines: [
      { text: '我答了天道。不是反抗，不是认命，是把这副凡骨里所有的「我」，都交了出去。', speaker: 'narrator' },
      { text: '雷光散尽。我站在了天道的另一边。脚下，是我种过的那片田。', speaker: 'narrator' },
      { text: '我命由我——可这「我」，早已不是当初那个，对着测灵柱发愣的人了。', speaker: 'narrator' }
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
