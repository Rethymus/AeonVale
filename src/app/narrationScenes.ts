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
const ALL_NARRATION_SCENES: readonly NarrationScene[] = [
  // ============ 序章·幻灭（act: 'prologue'） ============
  {
    id: 'prologue.awaken',
    act: 'prologue',
    layerKeys: { bg: CG.valley },
    lines: [
      { text: '——睁眼。', speaker: 'narrator' },
      { text: '眼皮先感到冷。雨水顺着额角钻进耳后，泥土贴在掌心，带着草根被踩断后的涩味。', speaker: 'narrator' },
      { text: '我撑起身子。身后没有车声，口袋里没有会亮的屏幕，远山却悬在云上，几道人影踩着剑光从天边掠过。', speaker: 'narrator' },
      { text: '惊讶只维持了很短的一会儿。胃里的空响更近，也更有说服力。', speaker: 'self' },
      { text: '山涧在左边，水声清楚；右边隔着湿林，有一缕被雨压低的炊烟。这里没有路牌，而我得在天黑以前先活下来。', speaker: 'narrator' }
    ],
    choices: [
      { id: 'deep', label: '先找水，沿山涧往林深处走', goto: 'prologue.deep' },
      { id: 'village', label: '循着炊烟，去敲一扇门', goto: 'prologue.village' }
    ],
    status: 'approved'
  },
  {
    // 炊烟抉择·深处：迷路断粮，在信息不足与饥饿之间作出生存判断（docs/22 §6）。
    id: 'prologue.deep',
    act: 'prologue',
    layerKeys: { bg: CG.memeMushroom },
    lines: [
      { text: '水找到了，路却没有。山涧把我领进更深的林子，第一夜还能听见远处的犬吠，第二夜以后，只有雨。', speaker: 'narrator' },
      { text: '第三天，我开始拿石头在树皮上刻记号；第四天，同一个记号从前方又出现了一次。', speaker: 'narrator' },
      { text: '树根下长着一丛菌子，伞盖鲜红，菌柄白得干净。它们好看得不像食物，也不像警告，只像山林对一个饿昏的人保持沉默。', speaker: 'narrator' },
      { text: '若有毒，吃下去以后才会死；若不吃，我大概熬不过今晚。选择有时并不宽阔，只比绝路多半步。', speaker: 'self' },
      { text: '我挑了最小的一朵，咬下去。舌尖发麻时，我终于知道，山林没有义务把答案写在颜色上。', speaker: 'narrator' },
      { text: '来到仙山的第四天，我没见到仙人，只见到一朵比我更懂得如何活下去的蘑菇。', speaker: 'self' }
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
      { text: '炊烟落在一座荒村里。最靠外的院墙塌了半边，一个妇人正用肩膀顶住歪斜的木闸，浑水从她脚边漫进菜地。', speaker: 'narrator' },
      { text: '我站在篱笆外，她先看我的湿衣和空手，再把自己的水瓢递过来：「喝。喝完再说你从哪儿来。」', speaker: 'narrator' },
      { text: '水有井绳和木桶的味道。我喝得太急，呛得弯下腰；她没有笑，只把瓢接回去，继续顶那扇闸。', speaker: 'narrator' },
      { text: '村口坐着个瘦老头，斗笠压得很低。后来我才知道，人们叫他忘言叟。此刻他只是隔着雨，看我会先开口，还是先伸手。', speaker: 'narrator' }
    ],
    choices: [
      {
        id: 'help',
        label: '先帮她把木闸扶正',
        tags: ['major'],
        responseLines: [
          { text: '我踩进水里，和她一起把木闸抬高。闸脚不是断了，而是被上游冲来的石块顶歪；搬开石头以后，水终于重新回到渠里。', speaker: 'narrator' },
          { text: '忙完时天已经黑了。妇人把我领进灶屋，让我坐在最靠火的地方，又把一双旧布鞋推过来：「先穿着。明天再想明天的事。」', speaker: 'narrator' },
          { text: '那是我来到这里以后，第一件没有附带谜语的善意。', speaker: 'self' }
        ],
        effects: [
          { kind: 'add', target: 'bond', value: 14 },
          { kind: 'flag', target: 'did-righteous' }
        ],
        goto: 'prologue.village.calm'
      },
      {
        id: 'ask',
        label: '先说明来意，请她指一条活路',
        tags: ['major'],
        responseLines: [
          { text: '我说自己醒在山里，不记得来路，也没有可以投奔的人。话说出口以后，连我自己都觉得像个拙劣的谎。', speaker: 'narrator' },
          { text: '妇人却只问了一句：「会干活吗？」我说会学。她便朝屋檐下努了努嘴，给我留出一块不漏雨的地方。', speaker: 'narrator' },
          { text: '她没有相信我的故事。她只是决定，今晚不让我死在门外。', speaker: 'self' }
        ],
        effects: [{ kind: 'flag', target: 'village-sheltered' }],
        goto: 'prologue.village.calm'
      }
    ],
    status: 'approved'
  },
  {
    id: 'prologue.village.calm',
    act: 'prologue',
    layerKeys: { bg: CG.village },
    lines: [
      { text: '我在荒村住了七天。白日劈柴、挑水、学着分辨田里的草；夜里听人讲山外的宗门和能活几百年的修士。', speaker: 'narrator' },
      { text: '那双旧布鞋不合脚，走路时总磨左脚后跟，却比赤脚踩在碎石上好得多。', speaker: 'narrator', requires: 'flag:did-righteous' },
      { text: '屋檐下的草席每天都会被人往灶火边挪一点。没人问我什么时候走，也没人说我可以永远留下。', speaker: 'narrator', requires: 'flag:village-sheltered' },
      { text: '第七天清晨，忘言叟第一次主动叫住我。他看着山外，说太一宗正在收徒，凡人若想知道自己有没有仙缘，总要去测一次灵根。', speaker: 'narrator' },
      { text: '我知道那不算承诺。可在一个什么都不认识的世界里，“去看看”已经足够像一条路。', speaker: 'self' }
    ],
    choices: [
      { id: 'on', label: '向收留我的人辞行', goto: 'prologue.depart' }
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
        tags: ['major'],
        responseLines: [
          { text: '我先蹲进泥里摸车辙，让车夫别再硬推。左轮下垫进两块碎石，歪掉的车轴慢慢回正，骡子终于把车拖上硬地。', speaker: 'narrator' },
          { text: '两个散修已经把小贩逼到路边。我没拔锄头，只当着过路人的面念出他们腰牌上的外门编号，再问了一遍：太一宗山门就在前头，你们真要我替你们把规矩问清楚？', speaker: 'narrator' },
          { text: '他们骂了几句，还是走了。我的手心全是汗——不是因为赢了，而是因为我直到他们转身以后，才确定自己猜对了。', speaker: 'self' }
        ],
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
        tags: ['major'],
        responseLines: [
          { text: '我沿着路边最窄的石脊绕过去，没有看那两个散修，也没有看泥里的粮。', speaker: 'narrator' },
          { text: '小贩在身后喊了一声「大哥」。那两个字追了十几步，便被山风吹散。', speaker: 'narrator' },
          { text: '我告诉自己，若真测出灵根，往后能救的人会更多。这个理由听起来很像远见，也很像把眼前的人交给以后。', speaker: 'self' }
        ],
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
      { text: '排到我时，先前那支商队也到了。车夫隔着人群冲我抬了抬手，山门执事便多看了我一眼。', speaker: 'narrator', requires: 'flag:road-helped' },
      { text: '排到我时，没人知道我从哪条山路来。只有鞋底磨出的血，在白石阶上留下很浅的印。', speaker: 'narrator', requires: 'flag:road-bypassed' },
      { text: '接引长老看了看我沾泥的衣摆和磨破的手，搁下笔：「凡人能走到这里，至少不是一时兴起。」', speaker: 'narrator' },
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
      { text: '下山时下了雨。盘缠贴在胸口，那句“与修仙无缘”却比钱袋更沉，一步一步跟我回到永恒山谷。', speaker: 'narrator' },
      { text: '路过当初那处泥坑时，车辙已经干了。有人用碎石把最深的坑填平，木哨在我怀里轻轻碰了一下。', speaker: 'narrator', requires: 'flag:road-helped' },
      { text: '路过当初那处泥坑时，地上只剩被踩进土里的几粒干果。我没有停，鞋底却像又听见了那声没接住的呼喊。', speaker: 'narrator', requires: 'flag:road-bypassed' },
      { text: '忘言叟在田边等我。他没有问测出了什么，只把一把锈锄头递过来，说：「先把今夜的饭种出来。」', speaker: 'narrator' },
      { text: '我接过锄头。难道没有灵根，就真的不能修仙了吗？这一次我没有把问题问出口。田里还有水，草也不会因为我失望就少长一寸。', speaker: 'self' }
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
      { text: '我在荒村种了三个月的地。最难的不是劳累，而是日子太具体：哪一畦缺水，哪一袋谷种发霉，今晚还能不能多添半碗饭。', speaker: 'narrator' },
      { text: '那天下午，我正蹲在田里拔草，头顶忽然炸开两道身影——一青一灰，撞在农庄上空。灵光把云层撕成两半，半块田在我眼前焦黑。', speaker: 'narrator' },
      { text: '我甚至来不及害怕。下一道光已经在他们剑下成形，而田埂无遮无挡。', speaker: 'self' }
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
      { text: '我扑进田沟，泥水灌进衣领。青光中的剑修每一剑都干净得近乎冷漠；灰衣人却像在逆着一条看不见的河走，退一步，云中的紫雷便追近一步。', speaker: 'narrator' },
      { text: '远处太一宗的遁光仍照常升落。雷没有劈山，没有劈田，只追着灰衣人身上那股不合常轨的气息。', speaker: 'narrator' },
      { text: '我第一次看清，所谓天意并不是一张盖住所有人的天幕。它会挑中某一个人，然后耐心地把他改回去。', speaker: 'self' }
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
      { text: '我咬破指头，滴了一滴血。血珠滚落，仍旧没有反应。若这是故事里常见的机缘，它显然不打算配合我的见识。', speaker: 'self' },
      { text: '天边残余的剑光忽然扫过田地。戒面在我掌心轻轻一震，里面那道绷紧的阻力随之断开。', speaker: 'narrator' },
      { text: '不是它认了我。是原主连神魂都不在了，最后一道门失去了要拦的人。', speaker: 'narrator' }
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
      { text: '戒里很安静。没有谁从黑暗里醒来，也没有一句替死者补完的遗言。', speaker: 'narrator' },
      { text: '我把那枚刻着「逆」的玉佩放在膝上。方才还活着的人，如今只剩一个字、一层灰，以及一些来不及决定由谁继承的东西。', speaker: 'narrator' },
      { text: '……你会拿走。走投无路的人，总会把遗物看成邀请。', speaker: 'heart-demon' },
      { text: '我没有反驳。只是把每件东西依次摆开，像在替一个陌生人整理无人认领的行囊。', speaker: 'self' }
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
      { text: '这些字是简体，横排，甚至保留着修改时画下的箭头和括号。纸已经旧得发脆，句子的习惯却来自我认识的世界。', speaker: 'narrator' },
      { text: '正文的笔迹更早，像一篇被反复修订的研究记录；页边另有一层新墨，记录骨折的位置、失败的阵线，以及每次活下来以后改动了什么。', speaker: 'narrator' },
      { text: '整条路只归纳成四件事：先看见雷力从哪里漏走；再替它刻出一条不会烧穿心脉的路；顺着来势与回势借力；最后让旧骨死去，用劫后的余烬重塑。', speaker: 'narrator' },
      { text: '正文旁画着一条田渠。忘言叟那句“先看水往哪里走”，忽然从三个月前走回来，落在了纸上。', speaker: 'self' },
      { text: '越往后，页边的字越乱。有人在第五次骨裂后写：右手仍抖；第六次后写：不要相信不疼的丹；最后一页只有一句——我走通了。后来者，愿你也是。', speaker: 'narrator' },
      { text: '正文和批注不是同一个人。一个人留下方法，另一个人用一身伤证明它不是妄想。', speaker: 'self' }
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
      { text: '我在田埂上坐到天黑，把玉佩、日记和残卷排在膝前。雨后的泥土慢慢返潮，纸页也跟着卷起边。', speaker: 'narrator' },
      { text: '化成劫灰的那个人把自己称作「逆」。日记和页边批注属于他；他也读得懂简体字，也曾被测灵柱判作无灵根。', speaker: 'narrator' },
      { text: '正文却比他的日记古老得多。开头没有名号，只有一行自述：承一户农家三年饭，先还他们三年收成。', speaker: 'narrator' },
      { text: '村里关于无面人的传说、田渠里过分规整的灵气、这卷用另一种文字写成的功法，第一次在我眼前有了同一个方向。', speaker: 'narrator' },
      { text: '也许后来的人叫他神农。也许那只是凡人为了记住恩情，给一个不留名的人添上的名字。', speaker: 'self' },
      { text: '至于我——测灵柱看不见的，不是迟来的天赋，而是一处无法蓄气的空。它使我像凡人，也使天劫舍弃的那一线力量可以从我这里经过。', speaker: 'narrator' },
      { text: '这不是翻身的证明，只是一条有人活着走过、也有人刚刚死在我面前的路。', speaker: 'self' }
    ],
    choices: [
      {
        id: 'seclude',
        label: '把残卷埋回劫灰旁，留下来种田',
        tags: ['major'],
        responseLines: [
          { text: '我把纸页重新包好。逆的死离我太近，近得任何“我会不同”都像一句轻薄的话。', speaker: 'narrator' },
          { text: '锄头至少不会承诺飞升。它只要求我明早仍起得来。', speaker: 'self' }
        ],
        goto: 'act1.seclude'
      },
      {
        id: 'practice',
        label: '把第一页压在膝上，从“察漏”开始',
        tags: ['major'],
        responseLines: [
          { text: '我没有说“我偏要胜天”。那种话在一摊尚未冷透的劫灰旁边，显得太响。', speaker: 'narrator' },
          { text: '我只点亮一盏油灯，把正文和逆的批注逐句抄开：哪里是方法，哪里是伤，哪里只是一个活下来的人给自己的安慰。', speaker: 'narrator' },
          { text: '第一夜，我读到灯油烧尽。第二天清晨，田还是要浇。修行并没有替生活让路；它只是从生活最窄的缝里开始。', speaker: 'self' }
        ],
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
    // 第二幕改为线性主脊：修炼、关系与代价按季节交错，不再回菜单式 hub 刷 storylet。
    id: 'act2.train',
    act: 2,
    layerKeys: { bg: CG.spiritFarm },
    lines: [
      { text: '我花了一个冬天修复被斗法毁掉的田。焦土翻到第三遍时开始返黑，逆留下的异种也终于从最冷的一畦里冒出两片叶。', speaker: 'narrator' },
      { text: '白日我跟着村人下地，夜里抄残卷。正文写方法，逆的批注写疼痛；两种字迹叠在一起，像一条路同时留下方向和尸骨。', speaker: 'narrator' },
      { text: '第一道小劫来临前，我在田中央埋下引雷石。忘言叟站在田外看了很久，只问：「水路看清了？」', speaker: 'narrator' },
      { text: '我说还没有。他便点头：「那就先别逞能。」', speaker: 'narrator' },
      { text: '雷云压低时，我才明白，真正的开始不是抬手接雷，而是忍住立刻证明自己的冲动。', speaker: 'self' }
    ],
    choices: [
      { id: 'temper', label: '等雷尾显形，再做第一个动作', goto: 'act2.temper.stage1' }
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
        tags: ['major'],
        responseLines: [
          { text: '我让主力先落。锁骨裂开的声音比雷更近，眼前也白了一瞬；直到那缕失去天意约束的余量越过旧伤，我才收拢空灵根。', speaker: 'narrator' },
          { text: '它被留在臂骨里，细得几乎不算力量，却有清楚的来处和去处。疼痛没有变小，只第一次有了可以复述的形状。', speaker: 'self' },
          { text: '雷停以后，忘言叟没有扶我。他把掉在泥里的粉笔捡起来，等我自己把那条漏口画完。', speaker: 'narrator' }
        ],
        effects: [
          { kind: 'add', target: 'cultProgress', value: 1 },
          { kind: 'add', target: 'tribGrip', value: 10 },
          { kind: 'add', target: 'madness', value: 3 },
          { kind: 'add', target: 'lifespan', value: -5 },
          { kind: 'flag', target: 'temper-stage1-steady' }
        ],
        goto: 'act2.temper.stage2'
      },
      {
        id: 'force',
        label: '在雷尾显形前强行攥住它',
        tags: ['major'],
        responseLines: [
          { text: '我在看清以前就伸手。空灵根吞进了更多雷，也把我从指尖一直掀到肩头。', speaker: 'narrator' },
          { text: '我确实抓住了那一线，只是从此右手多了一阵细颤。它在雷雨前最明显，像身体替我记着：那天我没有等。', speaker: 'self' },
          { text: '忘言叟看见我把粉笔握断，没有训斥，只把另一截放到地上：「既然抢了这一步，下一步就别再骗自己说没付钱。」', speaker: 'narrator' }
        ],
        effects: [
          { kind: 'add', target: 'cultProgress', value: 1 },
          { kind: 'add', target: 'tribGrip', value: 6 },
          { kind: 'add', target: 'madness', value: 7 },
          { kind: 'add', target: 'lifespan', value: -8 },
          { kind: 'add', target: 'defiance', value: 4 },
          { kind: 'flag', target: 'temper-stage1-forced' }
        ],
        goto: 'act2.temper.stage2'
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
        tags: ['major'],
        responseLines: [
          { text: '我用指甲刮开半层药泥。雷被迫收窄，沿右臂、肩骨、脊柱一节节走完；每经过一处，先热，再痛，最后留下短暂的麻木。', speaker: 'narrator' },
          { text: '它没有听我的命令。它只是发现，别的方向都比这条路更难走。', speaker: 'self' },
          { text: '当晚我重新挖了田渠最窄的弯口。骨里的路和田里的路原来一样，所谓控制，多半只是提前替洪水准备好一个愿意接受它的地方。', speaker: 'narrator' }
        ],
        effects: [
          { kind: 'add', target: 'cultProgress', value: 1 },
          { kind: 'add', target: 'tribGrip', value: 10 },
          { kind: 'add', target: 'madness', value: 4 },
          { kind: 'add', target: 'lifespan', value: -6 },
          { kind: 'flag', target: 'temper-stage2-steady' }
        ],
        goto: 'act2.side.herb'
      },
      {
        id: 'force',
        label: '加深骨线，让整道雷一次灌入',
        tags: ['major'],
        responseLines: [
          { text: '我把骨线又压深一分。雷走得更快，也更凶，肩后的皮肉被热流从里面撕开，血沿着衣摆滴进田里。', speaker: 'narrator' },
          { text: '引路成功了。只是这条路太像刀刻出来的沟，下一道雷会更容易认出它。', speaker: 'self' },
          { text: '伤口结痂用了十二天。第十三天，我仍旧抬不起右臂，却已经在纸上画下一次要把线刻得更深的位置。', speaker: 'heart-demon' }
        ],
        effects: [
          { kind: 'add', target: 'cultProgress', value: 1 },
          { kind: 'add', target: 'tribGrip', value: 6 },
          { kind: 'add', target: 'madness', value: 8 },
          { kind: 'add', target: 'lifespan', value: -9 },
          { kind: 'add', target: 'defiance', value: 4 },
          { kind: 'flag', target: 'temper-stage2-forced' }
        ],
        goto: 'act2.side.herb'
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
        tags: ['major'],
        responseLines: [
          { text: '我顺着来势跪下，双膝砸进泥里。雷从脊柱贯到脚底，又在离身前猛地回卷。', speaker: 'narrator' },
          { text: '我等的就是那一刻。骨线收紧，离开的仍是雷，留下的余劲却在膝骨外凝成一层更密的白。', speaker: 'self' },
          { text: '我用了很久才站起来。采药女留在门边的木杖正好够高——她没进屋，只在杖头绑了一小包止痛草。', speaker: 'narrator', requires: 'flag:herb-saved' },
          { text: '我用了很久才站起来。门外没有人，只有风把一截断草吹到台阶上。我忽然想起崖边那条没有回头确认的路。', speaker: 'narrator', requires: 'flag:herb-abandoned' }
        ],
        effects: [
          { kind: 'add', target: 'cultProgress', value: 1 },
          { kind: 'add', target: 'tribGrip', value: 10 },
          { kind: 'add', target: 'madness', value: 4 },
          { kind: 'add', target: 'lifespan', value: -6 },
          { kind: 'flag', target: 'temper-stage3-steady' }
        ],
        goto: 'act2.alchemy'
      },
      {
        id: 'force',
        label: '逆势站起，把来势和去势一并压住',
        tags: ['major'],
        responseLines: [
          { text: '我逆着雷站了起来。第一步成功，第二步却把来势和回势一并锁进腿骨，细碎的裂声从膝弯一路爬到髋骨。', speaker: 'narrator' },
          { text: '我站住了。往后每逢阴雨，膝骨也会比天空更早知道雷要来。', speaker: 'self' },
          { text: '采药女把止痛草放在门边，没有问我为什么总把能慢慢做的事，逼成必须当场赢下来的事。', speaker: 'narrator', requires: 'flag:herb-saved' },
          { text: '我扶着门框熬过那一夜。疼得最厉害时，崖边那句“我会找人回来”又在脑中响了一遍。', speaker: 'narrator', requires: 'flag:herb-abandoned' }
        ],
        effects: [
          { kind: 'add', target: 'cultProgress', value: 1 },
          { kind: 'add', target: 'tribGrip', value: 7 },
          { kind: 'add', target: 'madness', value: 8 },
          { kind: 'add', target: 'lifespan', value: -9 },
          { kind: 'add', target: 'defiance', value: 5 },
          { kind: 'flag', target: 'temper-stage3-forced' }
        ],
        goto: 'act2.alchemy'
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
        tags: ['major'],
        responseLines: [
          { text: '我压下继续引雷的手。第一息，药泥封住血；第二息，引雷石替我崩掉一角；第三息，脚下湿土吞走余热。', speaker: 'narrator' },
          { text: '新骨在这三口喘息里一寸寸接回。它没有因此变弱，只不再把“全由我承担”误认成勇气。', speaker: 'self' },
          { text: '逆的纸条被汗浸软。我终于把他没说完的那个“勿”字，读成了一句可以照做的话。', speaker: 'narrator' }
        ],
        effects: [
          { kind: 'add', target: 'cultProgress', value: 1 },
          { kind: 'add', target: 'tribGrip', value: 10 },
          { kind: 'add', target: 'madness', value: 6 },
          { kind: 'add', target: 'lifespan', value: -7 },
          { kind: 'flag', target: 'temper-stage4-shared' }
        ],
        goto: 'act2.encounter.hub'
      },
      {
        id: 'force',
        label: '不停雷，让新骨在雷中一次长成',
        tags: ['major'],
        responseLines: [
          { text: '我把纸条压回残卷，没有停雷。新骨在旧骨尚未完全崩落时强行长出，两层骨质彼此挤压，像身体里同时住着两个方向相反的人。', speaker: 'narrator' },
          { text: '它们长得更快，也带着未散的雷意。平静时服从，夜深以后却时时想把我从里面烧开。', speaker: 'self' },
          { text: '我又一次证明自己能独自撑过去。至于为什么非要证明，雷没有问。', speaker: 'heart-demon' }
        ],
        effects: [
          { kind: 'add', target: 'cultProgress', value: 1 },
          { kind: 'add', target: 'tribGrip', value: 7 },
          { kind: 'add', target: 'madness', value: 10 },
          { kind: 'add', target: 'lifespan', value: -10 },
          { kind: 'add', target: 'defiance', value: 6 },
          { kind: 'flag', target: 'temper-stage4-forced' }
        ],
        goto: 'act2.encounter.hub'
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
        tags: ['major'],
        responseLines: [
          { text: '我先想起一双旧布鞋，再想起木闸边递来的水瓢、泥路上的车辙、有人把止痛草绑在杖头的手。', speaker: 'narrator' },
          { text: '旧名仍有缺口，可这些人的动作留了下来。它们不能证明我还是原来的人，却阻止我变成一条只会运转的功法。', speaker: 'self' },
          { text: '雷声退远时，我听见村里有人在敲粮仓的门。第五劫保住了记忆，接下来要决定的，是这些记忆是否只用来安慰我自己。', speaker: 'narrator' }
        ],
        effects: [
          { kind: 'add', target: 'cultProgress', value: 1 },
          { kind: 'add', target: 'tribGrip', value: 9 },
          { kind: 'add', target: 'madness', value: 5 },
          { kind: 'add', target: 'lifespan', value: -7 },
          { kind: 'add', target: 'bond', value: 4 },
          { kind: 'flag', target: 'kept-human-anchor' }
        ],
        goto: 'act2.side.famine'
      },
      {
        id: 'force',
        label: '放弃旧名，让空灵根运转得更彻底',
        tags: ['major'],
        responseLines: [
          { text: '我不再追那两个已经模糊的字。它们从舌尖退开以后，雷在识海里骤然顺畅，像终于清掉一块碍事的石头。', speaker: 'narrator' },
          { text: '安静随之落下来。那不是平和，更像一间被搬空的屋子：走动更容易了，也再没有什么会在深夜碰响。', speaker: 'self' },
          { text: '雷声退远时，村里有人敲响粮仓。那声音传进来，我花了一息才想起，自己为什么应该在意。', speaker: 'heart-demon' }
        ],
        effects: [
          { kind: 'add', target: 'cultProgress', value: 1 },
          { kind: 'add', target: 'tribGrip', value: 8 },
          { kind: 'add', target: 'madness', value: 9 },
          { kind: 'add', target: 'lifespan', value: -9 },
          { kind: 'add', target: 'defiance', value: 7 },
          { kind: 'add', target: 'bond', value: -2 },
          { kind: 'flag', target: 'shed-old-name' }
        ],
        goto: 'act2.side.famine'
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
        tags: ['major'],
        responseLines: [
          { text: '雷落下时，田渠亮成一张巨大的脉络。根须替我引路，湿土替我卸势，引雷石替我先碎。', speaker: 'narrator' },
          { text: '我仍旧受伤，仍旧听见胸骨裂开，却第一次没有把所有疼痛都关在自己体内。分出去的力量没有消失，它变成田边同时亮起的许多微小回应。', speaker: 'self' },
          { text: '云散以后，倒伏的稻叶一片片重新抬起。我终于走完残卷前六重，也终于知道“圆满”不等于身上再无裂缝。', speaker: 'narrator' }
        ],
        effects: [
          { kind: 'add', target: 'cultProgress', value: 1 },
          { kind: 'add', target: 'tribGrip', value: 12 },
          { kind: 'add', target: 'madness', value: 6 },
          { kind: 'add', target: 'lifespan', value: -8 },
          { kind: 'add', target: 'bond', value: 4 },
          { kind: 'flag', target: 'full-cycle-field' }
        ],
        goto: 'act3.entry'
      },
      {
        id: 'force',
        label: '以自身为唯一阵眼，独吞整道雷',
        tags: ['major'],
        responseLines: [
          { text: '我切断田渠，让所有泄口只指向自己。雷在体内完成四步，干净、迅速，没有一丝力量分给脚下的根和水。', speaker: 'narrator' },
          { text: '云散时，周围的草全伏倒了，只有我还站着。那一刻的确像胜利——若不去看田边被灼黑的那一圈。', speaker: 'self' },
          { text: '我走完了前六重。也把那张劝我分担的纸，留在了身后。', speaker: 'heart-demon' }
        ],
        effects: [
          { kind: 'add', target: 'cultProgress', value: 1 },
          { kind: 'add', target: 'tribGrip', value: 8 },
          { kind: 'add', target: 'madness', value: 10 },
          { kind: 'add', target: 'lifespan', value: -11 },
          { kind: 'add', target: 'defiance', value: 8 },
          { kind: 'flag', target: 'full-cycle-self' }
        ],
        goto: 'act3.entry'
      },
      {
        id: 'break',
        label: '撕开全部旧骨线，让六道雷一次完成',
        tags: ['major'],
        responseLines: [
          { text: '我已经知道每一步该怎么走，于是开始相信，次序只是给不够强的人准备的扶手。', speaker: 'self' },
          { text: '止劫符被撕开的声音很轻。天上的六道雷却同时找到了入口。', speaker: 'narrator' }
        ],
        goto: 'act2.madness-death'
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
      { text: '炉开时，一丝铁腥味从丹香里钻出来。逆在丹谱边写过同样的气味：药力越完整，毒越会藏进没有立刻疼痛的地方。', speaker: 'narrator' },
      { text: '我可以牺牲药性，把毒逼出去；也可以把药力全部封进丹里，承认它会在以后讨债。', speaker: 'self' }
    ],
    choices: [
      {
        id: 'back',
        label: '弃去三成药力，慢火逼出毒性',
        tags: ['major'],
        responseLines: [
          { text: '我把炉火压低，守了整整一夜。黑烟从丹丸里一点点逼出，药香随之变淡，最后只剩一枚拇指大的灰白小丹。', speaker: 'narrator' },
          { text: '它不能替我渡劫，也不能让疼痛消失；它只够在骨头碎开时，替心脉留住一口气。', speaker: 'self' },
          { text: '我把那口气看得比完美更重要。', speaker: 'narrator' }
        ],
        effects: [
          { kind: 'add', target: 'pillPoison', value: 8 },
          { kind: 'add', target: 'tribGrip', value: 8 },
          { kind: 'add', target: 'lifespan', value: -2 },
          { kind: 'flag', target: 'alchemy-purified' }
        ],
        goto: 'act2.village.hub'
      },
      {
        id: 'seal',
        label: '保全药力，把丹毒一并封入',
        tags: ['major'],
        responseLines: [
          { text: '我封死最后一道出烟口。丹丸成得近乎完美，表面连一丝裂纹都没有。', speaker: 'narrator' },
          { text: '吞下去时不疼，只在舌根留下一点铁锈味。那份安静让我满意，也让我想起逆写在页边的话：不要相信不疼的丹。', speaker: 'self' },
          { text: '我没有吐出来。代价既然已经咽下去，沉默并不会让它变轻。', speaker: 'heart-demon' }
        ],
        effects: [
          { kind: 'add', target: 'pillPoison', value: 35 },
          { kind: 'add', target: 'tribGrip', value: 12 },
          { kind: 'add', target: 'lifespan', value: -5 },
          { kind: 'add', target: 'madness', value: 4 },
          { kind: 'add', target: 'defiance', value: 15 },
          { kind: 'flag', target: 'alchemy-sealed-poison' }
        ],
        goto: 'act2.village.hub'
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
      { text: '第二劫后的第十二天，我去山腰找封骨草。回程时，崖下传来一声很短的呼救，像喊的人已经试过很多次，不敢再浪费力气。', speaker: 'narrator' },
      { text: '采药女一条腿卡在石缝里，背篓早已坠下去。她看见我，先看我的肩伤，再看天色：「你一个人背不动我。」', speaker: 'narrator' },
      { text: '她说得没错。若现在下崖，我会错过今晚最稳的一场雷；若继续赶路，她也许能等到别人，也许不能。', speaker: 'self' }
    ],
    choices: [
      {
        id: 'save',
        label: '拆下背带固定伤腿，背她下山',
        tags: ['major'],
        responseLines: [
          { text: '我把背带绕过她的膝弯，又削了两根树枝固定伤腿。真正把她背起来时，肩后的裂口立刻重新渗血。', speaker: 'narrator' },
          { text: '她一路咬着衣袖，没有催我。我们在天黑以后才到村口，那场原本要接的雷已经散了。', speaker: 'narrator' },
          { text: '她把一包止血草塞给我，说这不是谢礼：「是让你下次救人以前，先别把自己也弄断。」我疼得笑了一声——这句话比仙门的教诲实用。', speaker: 'self' }
        ],
        effects: [
          { kind: 'add', target: 'bond', value: 8 },
          { kind: 'add', target: 'lifespan', value: -2 },
          { kind: 'flag', target: 'herb-saved' }
        ],
        goto: 'act2.temper.stage3'
      },
      {
        id: 'abandon',
        label: '记下位置，先赶回田里接雷',
        tags: ['major'],
        responseLines: [
          { text: '我把附近的山势和那棵歪松记住，答应她会去村里叫人，然后转身赶路。', speaker: 'narrator' },
          { text: '那道雷来得准时。我也准时站进阵里。等云散时天已经全黑，肩伤没有加重，第三劫的准备一项不少。', speaker: 'narrator' },
          { text: '我没有再下山确认她是否等到别人。往后每次想起这件事，我最先记得的不是她的脸，而是自己那晚准备得多么周全。', speaker: 'self' }
        ],
        effects: [
          { kind: 'add', target: 'defiance', value: 15 },
          { kind: 'add', target: 'bond', value: -2 },
          { kind: 'flag', target: 'herb-abandoned' }
        ],
        goto: 'act2.temper.stage3'
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
        tags: ['major'],
        responseLines: [
          { text: '我把剑意引进田脉，六条旧渠同时亮起。整片田替我藏住一息，也替我承受了被剑光削断的根。', speaker: 'narrator' },
          { text: '我没有赢。萧无极收剑时说，下次再见，不会再给我退路。', speaker: 'narrator' },
          { text: '他离开后，我跪在田里把断根一株株接回。逃走并不比迎战轻，它只是把活下来的工作全部留给以后。', speaker: 'self' }
        ],
        effects: [
          { kind: 'add', target: 'defiance', value: 5 },
          { kind: 'add', target: 'tribGrip', value: 2 },
          { kind: 'flag', target: 'escaped-xiao' }
        ],
        goto: 'act2.temper.stage5'
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
      { text: '我的灵田还能保住第六劫所需，也能拆掉一座阵眼，赶在霜前多种一季凡粮。两件事不能同时做到。', speaker: 'narrator' },
      { text: '没有哪个选项能让所有人毫发无伤。一个会把风险留给我的终劫，一个会把饥饿留在别人的冬天。', speaker: 'self' }
    ],
    choices: [
      {
        id: 'share',
        label: '拆一座引雷阵，把田让给凡粮',
        tags: ['major'],
        responseLines: [
          { text: '我拆掉东侧阵眼，把灵土翻成能种凡粮的浅畦。那一季我少了一处渡劫泄口，也少睡了许多夜。', speaker: 'narrator' },
          { text: '霜降前，村里收下最后一批稻谷。孩子们把第一捆放在我门前，稻穗还带着潮气。', speaker: 'narrator' },
          { text: '这不是免费的善意。第六劫会更难；只是到了那时，我至少知道自己为什么少了一块阵石。', speaker: 'self' }
        ],
        effects: [
          { kind: 'add', target: 'bond', value: 10 },
          { kind: 'add', target: 'lifespan', value: -10 },
          { kind: 'add', target: 'tribGrip', value: -3 },
          { kind: 'flag', target: 'shared-famine-grain' }
        ],
        goto: 'act2.temper.stage6'
      },
      {
        id: 'keep',
        label: '封住灵田，只把仓中余粮分出去',
        tags: ['major'],
        responseLines: [
          { text: '我没有拆阵，只把自己能省下的粮全部搬进公仓。那点粮让最难熬的几户多撑了半月，却填不满整个冬天。', speaker: 'narrator' },
          { text: '有人理解，有人不再来我门前。两种反应都合理；我保住了第六劫，也让别人替这个决定承担了看得见的部分。', speaker: 'self' },
          { text: '第一场雪落下时，灵田的阵纹一笔未缺。村里的炊烟却比往年少了几处。', speaker: 'narrator' }
        ],
        effects: [
          { kind: 'add', target: 'defiance', value: 15 },
          { kind: 'add', target: 'bond', value: -5 },
          { kind: 'add', target: 'tribGrip', value: 4 },
          { kind: 'flag', target: 'kept-tribulation-field' }
        ],
        goto: 'act2.temper.stage6'
      }
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
    lines: [
      { text: '第三劫以后，我在床上躺了二十多天。荒村的人轮流送饭，没有谁问我修到了哪一重，只问伤口还渗不渗血。', speaker: 'narrator' },
      { text: '能下地时，秋收已经近了。老李家的旧渠又堵，集市来了一批便宜得反常的灵米，村口的孩子则在学一首关于无面人的旧歌。', speaker: 'narrator' },
      { text: '第四劫前只剩半日。我不可能把所有事都做完，只能决定这半日要留在哪一处。', speaker: 'self' }
    ],
    choices: [
      { id: 'ditch', label: '把半日留给那条总会淤堵的旧渠', goto: 'act2.village.ditch' },
      { id: 'market', label: '陪老李去集市，把那批灵米查清', goto: 'act2.village.market' },
      { id: 'song', label: '坐到村口，听完无面人的旧歌', goto: 'act2.village.song' }
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
      { text: '忙到日落，老李蹲在渠边看了很久，说这条水路至少还能用十年。', speaker: 'narrator' },
      { text: '忘言叟当年那句“先看水往哪里走”，到这里才真正回到我手上。功法教我借雷，村里却先教会我，路若只够自己活，就不算修好。', speaker: 'self' }
    ],
    choices: [
      { id: 'back', label: '洗掉手上的泥，去迎第四劫', goto: 'act2.temper.stage4' }
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
      { text: '若不是那夜守着丹炉闻过同一种铁腥，这批米会在冬天进许多人的锅。修行第一次没有只改变我的骨头。', speaker: 'self' }
    ],
    choices: [
      { id: 'back', label: '陪老李把真米买齐，去迎第四劫', goto: 'act2.temper.stage4' }
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
        label: '把木哨还给认出它的孩子',
        requires: 'flag:got-wooden-whistle',
        tags: ['hide-when-unavailable'],
        responseLines: [
          { text: '领唱的孩子认出了哨面那穗歪斜的稻子：「这是我娘小时候刻给外祖父的。」', speaker: 'narrator' },
          { text: '外祖父总说，年轻时在山路上遇见过一个背锄头的人。木哨绕了许多年，终于回到那家人的手里；那桩小事也终于有了后来。', speaker: 'self' }
        ],
        effects: [
          { kind: 'add', target: 'bond', value: 4 },
          { kind: 'flag', target: 'wooden-whistle-returned' },
          { kind: 'unflag', target: 'got-wooden-whistle' }
        ],
        goto: 'act2.temper.stage4'
      },
      {
        id: 'keep-whistle',
        label: '把木哨留在腕间，记住山路上的那一刻',
        requires: 'flag:got-wooden-whistle',
        tags: ['hide-when-unavailable'],
        responseLines: [
          { text: '我没有拿出木哨，只隔着衣袖摸到它的轮廓。孩子们唱完时，最后一个音落在暮色里。', speaker: 'narrator' },
          { text: '有些东西回到原主手里才算圆满；有些东西被留下，是因为持有它的人还没有学会告别。我分不清自己属于哪一种。', speaker: 'self' }
        ],
        effects: [{ kind: 'flag', target: 'wooden-whistle-kept' }],
        goto: 'act2.temper.stage4'
      },
      {
        id: 'back',
        label: '等歌唱完，把最后一句记进残卷',
        requires: '!flag:got-wooden-whistle',
        tags: ['hide-when-unavailable'],
        responseLines: [
          { text: '歌里没有神通，只有一个人怎样除虫、改渠，又怎样不肯留下名字。孩子们把许多词唱错了，做过的事却一件没有少。', speaker: 'narrator' },
          { text: '我把最后一句记进残卷。传说也许不准确，但它至少知道该感谢什么。', speaker: 'self' }
        ],
        goto: 'act2.temper.stage4'
      }
    ],
    status: 'approved'
  },
  {
    id: 'act2.encounter.hub',
    act: 2,
    layerKeys: { bg: CG.villageDawn },
    lines: [
      { text: '第四劫以后，我收到几封口信。有人见过逆最后一次借宿；采药女的药田出了麻烦；阵匠老陆找到一张能改变终劫的图；萧无极也再次到了山谷外。', speaker: 'narrator' },
      { text: '第五劫已经在识海里起雷。我只来得及赴一处约——不是因为其余的人不重要，而是时间终于开始像寿元一样，可以被花完。', speaker: 'self' }
    ],
    choices: [
      { id: 'wanderer', label: '去破庙，见最后收留过逆的人', goto: 'act2.encounter.wanderer' },
      {
        id: 'herbgirl',
        label: '去药田，见被我背下山的采药女',
        requires: 'flag:herb-saved',
        tags: ['hide-when-unavailable'],
        goto: 'act2.encounter.herbgirl'
      },
      {
        id: 'herbgirl-cold',
        label: '去药田，面对那位我没有回头救的人',
        requires: 'flag:herb-abandoned',
        tags: ['hide-when-unavailable'],
        goto: 'act2.encounter.herbgirl-cold'
      },
      { id: 'artificer', label: '去阵坊，和老陆校完那张反向阵图', goto: 'act2.encounter.artificer' },
      { id: 'xiao', label: '留在田界，等萧无极的剑落下来', goto: 'act2.side.xiao' }
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
        tags: ['major'],
        responseLines: [
          { text: '我借田脉制造三处假雷痕，把追兵引向不同山口。游方散修背着那半张图先走，直到安全处才回头。', speaker: 'narrator' },
          { text: '他没有道谢，只说：「紫雷关外见——如果我们都活得到那里。」这句约定没有保证，却比任何誓言都诚实。', speaker: 'self' }
        ],
        effects: [
          { kind: 'add', target: 'bond', value: 8 },
          { kind: 'flag', target: 'wanderer-helped' }
        ],
        goto: 'act2.temper.stage5'
      },
      {
        id: 'stay-out',
        label: '不认玉佩，也不认这桩旧账',
        tags: ['major'],
        responseLines: [
          { text: '我把玉佩收回衣内，退开一步。追兵带走他时，那半张图从袖中滑落，被泥水一点点泡开。', speaker: 'narrator' },
          { text: '我没有失去一件本来属于我的东西。可正因为如此，站在原地看它烂掉才显得如此容易。', speaker: 'self' }
        ],
        effects: [
          { kind: 'add', target: 'defiance', value: 12 },
          { kind: 'add', target: 'bond', value: -2 },
          { kind: 'flag', target: 'wanderer-refused' }
        ],
        goto: 'act2.temper.stage5'
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
        tags: ['major'],
        responseLines: [
          { text: '我们把药田接进公共水渠，又把界碑和旧地契一起抬到村议前。对方还能仗修为，却不能再假装这里从来无人耕种。', speaker: 'narrator' },
          { text: '界碑最终被移到山脊外。她把一包淬骨药交给我，条件是渡劫后若还活着，回来告诉她哪一味最疼。', speaker: 'narrator' },
          { text: '我答应了。承诺未必能让我活下来，却让“活下来”第一次有了一个具体的去处。', speaker: 'self' }
        ],
        effects: [
          { kind: 'add', target: 'bond', value: 8 },
          { kind: 'lore', target: 'lore', value: 1 },
          { kind: 'flag', target: 'herb-allied' }
        ],
        goto: 'act2.temper.stage5'
      },
      {
        id: 'deaf',
        label: '收下配方，不介入她与修士的争端',
        tags: ['major'],
        responseLines: [
          { text: '我说第五劫将至，不能再卷进一场没有把握的争端。她听完，把刚递出的配方从我手里抽了回去。', speaker: 'narrator' },
          { text: '「救命和站在谁那边，原来真是两回事。」她说得很平静。药田后来是否保住，我没有再问。', speaker: 'narrator' },
          { text: '我救过她。那件事没有因此变成一张可以反复抵扣的凭证。', speaker: 'self' }
        ],
        effects: [
          { kind: 'add', target: 'defiance', value: 12 },
          { kind: 'add', target: 'bond', value: -2 },
          { kind: 'flag', target: 'herb-help-refused' }
        ],
        goto: 'act2.temper.stage5'
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
        tags: ['major'],
        responseLines: [
          { text: '我承认那晚没有叫人，也没有回去。解释说完以后，事实没有变轻。', speaker: 'narrator' },
          { text: '她没有原谅我，也没有赶我走。天黑前我们只谈石料该放哪里；她指，我搬，木杖敲在地上替我们计算距离。', speaker: 'narrator' },
          { text: '临走前，她丢来一小包最普通的封血草：「不是原谅。你第五劫若死在路上，今天这些石头就白搬了。」', speaker: 'narrator' },
          { text: '有些关系不能恢复原样，只能从真实的损伤上重新开始。能开始，已经不是理所当然。', speaker: 'self' }
        ],
        effects: [
          { kind: 'add', target: 'bond', value: 6 },
          { kind: 'add', target: 'lifespan', value: -3 },
          { kind: 'flag', target: 'herb-atone' }
        ],
        goto: 'act2.temper.stage5'
      },
      {
        id: 'leave',
        label: '不为已经发生的事停下',
        tags: ['major'],
        responseLines: [
          { text: '我说第五劫将至，过去的事已经无法补回。她没有争辩，只把一块石料拖向自己。', speaker: 'narrator' },
          { text: '我转身离开。木杖敲在石头上的声音没有追来，可我知道，下一次也不会再有求救声。', speaker: 'self' }
        ],
        effects: [
          { kind: 'add', target: 'defiance', value: 8 },
          { kind: 'add', target: 'bond', value: -2 },
          { kind: 'flag', target: 'herb-abandoned-again' }
        ],
        goto: 'act2.temper.stage5'
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
        tags: ['major'],
        responseLines: [
          { text: '我把四笔夺流纹从自己的抄本上划掉，又按村里每块田的坡势重排泄口。', speaker: 'narrator' },
          { text: '老陆说这法子不够狠，终劫时少不了吃亏。我问他能不能让更多田活下来。他看了半晌，重新拿起笔：「能。那就把吃亏也算进图里。」', speaker: 'narrator' }
        ],
        effects: [
          { kind: 'add', target: 'bond', value: 6 },
          { kind: 'flag', target: 'array-guarded' }
        ],
        goto: 'act2.temper.stage5'
      },
      {
        id: 'learn',
        label: '连夺流纹一起记下，终局或许用得上',
        tags: ['major'],
        responseLines: [
          { text: '我把四笔夺流纹一并抄下。它们简单、有效，甚至不需要现在决定要从谁那里夺走力量。', speaker: 'narrator' },
          { text: '可从记住它们开始，邻人的雷力就多了一种可能的去处。工具尚未伤人，并不等于选择它时没有方向。', speaker: 'self' }
        ],
        effects: [
          { kind: 'add', target: 'defiance', value: 12 },
          { kind: 'add', target: 'bond', value: -2 },
          { kind: 'add', target: 'tribGrip', value: 4 },
          { kind: 'flag', target: 'array-stolen' }
        ],
        goto: 'act2.temper.stage5'
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
      { text: '第六劫后的第三夜，灵田中央那条最老的根在月下裂开，泥土缓慢下陷，露出一扇埋了不知多少年的石门。', speaker: 'narrator' },
      { text: '门上没有禁制，只有“察漏、引路、借势、淬骨”四道刻痕。我的血落上去毫无反应；把手掌贴进田泥，门却从根系深处传来一声闷响。', speaker: 'narrator' },
      { text: '它认的不是血脉，也不是修为。它认这片田是否仍活着。', speaker: 'self' },
      { text: '石门开启时，一股干燥的纸灰味从地下涌上来。百万年前有人把答案留在这里，也把不能回答的部分一起留下。', speaker: 'narrator' }
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
      { text: '石阶尽头是一条狭长的廊。墙上没有仙人乘云的图，只有荒年、破屋和一张低矮饭桌：一个衣着异样的人坐在农户中间，手里端着借来的碗。', speaker: 'narrator' },
      { text: '再往前，是被逐只剖开的虫壳、改了又填的田渠、写满失败年份的稻种。许多试验旁都刻着同一句小字：本季仍有人要吃饭。', speaker: 'narrator' },
      { text: '我在村里见过这些结果，却直到这里才看见它们曾经失败的样子。神迹把三年压成一句话，石壁却把每一次虫灾和歉收都还了回来。', speaker: 'self' },
      { text: '廊道后半才出现引雷石。那个人先学会让水与灵气穿过田，再把同样的路刻进自己的骨头。功法不是从天上落下来的；它从一顿欠下的饭开始。', speaker: 'narrator' },
      { text: '最后一幅浮雕没有脸。农户们把收成堆在他门前，他却背着行囊走进雷云，只在田边留下四道刻痕。', speaker: 'narrator' }
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
      { text: '洞府深处是一间停在某次试验后的石室。土样、虫壳、断骨和引雷石按年份排满墙面，每件都贴着简体编号。', speaker: 'narrator' },
      { text: '最早的记录只问怎样让一季庄稼活下来。几百页以后，问题才变成：为什么天劫总能找到那些不合常轨的人。', speaker: 'narrator' },
      { text: '《偷天换劫诀》就长在这些记录中间。每一条像口诀的结论，背后都压着被划掉的旧方案、坏死的骨样和一行“此法不可再试”。', speaker: 'narrator' },
      { text: '另一只石匣里放着逆的抄本。正文是神农的旧字，页边则是我已经熟悉的那层新墨：右手颤、膝骨痛、勿独扛。', speaker: 'narrator' },
      { text: '他们相隔得太久，从未彼此说过一句话。可一个人认真记下失败，另一个人便能少死在同一个错误里。', speaker: 'self' }
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
      { text: '句子停在这里。石室没有尸骨，没有飞升遗痕，也没有一封替后人收束疑问的遗书。', speaker: 'narrator' },
      { text: '我在像前站了很久。原来一个故事真正留下的空白，不是等后来者随意填满，而是提醒后来者：你只能从这里开始回答自己的问题。', speaker: 'self' }
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
      { text: '我把逆的便笺压在残卷最后一页，然后沿田埂走了一圈。旧渠、药包、阵图、木哨或一截空绳，各自在它们该在的位置。', speaker: 'narrator' },
      { text: '有些位置空着。我没有把空处当作遗漏；那也是一路选择留下的形状。', speaker: 'self' }
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
        responseLines: [
          { text: '我把木哨系在左腕。它不是法器，挡不住一道雷；木纹里却还留着那条山路上的雨和泥。', speaker: 'narrator' },
          { text: '终劫会烧掉许多东西。至少在它落下以前，我想清楚自己为何不愿把这一件忘掉。', speaker: 'self' }
        ],
        effects: [
          { kind: 'add', target: 'bond', value: 4 },
          { kind: 'flag', target: 'prep-memory-anchor' }
        ],
        goto: 'act3.preparation'
      },
      {
        id: 'herbs',
        label: '把采药女的淬骨药放进停雷位',
        requires: '(flag:herb-allied || flag:herb-atone)',
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
      { kind: 'add', target: 'lifespan', value: -4 }
    ],
    lines: [
      { text: '紫雷不是一道光，而是一整片天同时收紧。它先压住呼吸，再让旧伤一处处发亮，像在核对我六次淬体留下的全部记录。', speaker: 'narrator' },
      { text: '右手先轻轻一颤。第一劫留下的抢早并没有被后来的力量治好，它只是比我更早认出了雷。', speaker: 'narrator', requires: 'flag:temper-stage1-forced' },
      { text: '右肩旧伤先泛起一线凉意。第一劫留下的耐心没有变成天赋，只变成身体知道该再等半息。', speaker: 'narrator', requires: 'flag:temper-stage1-steady' },
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
      { kind: 'add', target: 'lifespan', value: -4 }
    ],
    lines: [
      { text: '我扣住雷尾，六次淬体留下的旧槽同时亮起。紫雷想冲向心脉，预先刻好的骨线便一层层把它挤回正路。', speaker: 'narrator' },
      { text: '第二劫强刻的那道深槽先承住雷，也先从肩后重新裂开。捷径没有消失，只在终局按原价回来。', speaker: 'narrator', requires: 'flag:temper-stage2-forced' },
      { text: '第二劫留下的细线仍旧狭窄，却没有一处争抢方向。雷走得慢，我也因此多出一口能调整阵势的气。', speaker: 'narrator', requires: 'flag:temper-stage2-steady' },
      { text: '修好的旧渠在田外接住第一股泄雷，水面瞬间亮成一条弯曲的银线。', speaker: 'narrator', requires: 'flag:village-ditch-repaired' },
      { text: '阵外有多少人、多少物，并不由最后一刻决定。它们只是把一路上真实发生过的事，重新送到我手边。', speaker: 'self' }
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
      { kind: 'add', target: 'lifespan', value: -5 }
    ],
    lines: [
      { text: '紫雷走到脊柱时骤然回卷。来势要把我压入地底，去势又要把刚长成的骨全部带走。', speaker: 'narrator' },
      { text: '四处护阵泄口依次崩开，没有一处向邻田夺力。风险没有消失，只被分到各自承受得住的位置。', speaker: 'narrator', requires: 'flag:prep-guard-array' },
      { text: '夺流纹亮起时，远处几块田同时暗下去。我的阵势骤然变强，代价也在同一瞬有了方向。', speaker: 'narrator', requires: 'flag:prep-stolen-array' },
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
      { kind: 'add', target: 'lifespan', value: -6 }
    ],
    lines: [
      { text: '旧骨终于承受不住。先是锁骨断开，随后肋骨、脊柱、膝骨依次失去形状；我听见身体内部像一座木屋在火中倒塌。', speaker: 'narrator' },
      { text: '淬骨不是疼过以后恢复原样。劫的余烬沿着六次旧痕填入裂口，长出的每一寸都更能承雷，也更难回到凡人的轻盈。', speaker: 'narrator' },
      { text: '右手先重新有了知觉，细颤仍在；膝骨随后闭合，阴雨前的旧痛也没有离开。力量没有抹掉代价，只把代价编进新身体。', speaker: 'narrator' },
      { text: '腕间的木哨被热浪烤得发烫。我已经听不见它的声音，却记得那条泥路和一双把家传之物递出来的手。', speaker: 'narrator', requires: 'flag:wooden-whistle-kept' },
      { text: '腕间只系着一截旧绳。木哨已经回到孩子手里，记忆却没有因此离开。', speaker: 'narrator', requires: 'flag:wooden-whistle-returned' },
      { text: '采药女写下的次序一一应验：左肩、膝骨、胸口。药不能替我受雷，却让每处伤在最坏以前多留了一息。', speaker: 'narrator', requires: 'flag:prep-herbs' },
      { text: '最后闭合的是胸骨。那里压着逆的便笺，也压着我仍愿意承认属于自己的那些人和事。', speaker: 'self' }
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

/**
 * 2026-07 人工复测后的线性化裁剪：旧版第二幕把支线、线索和修炼都摊成可反复返回的菜单，
 * 虽然图论可达，却把阅读切成许多彼此孤立的短卡片。保留数据一轮便于对照，运行时只发布
 * 新主脊；待下一次内容清扫可物理删除这些旧节点。
 */
const RETIRED_MENU_SCENES = new Set<string>([
  'act2.train.lore-hub',
  'act2.temper',
  'act2.temper.late',
  'act2.peek',
  'act2.farm-lore',
  'act2.relic-lore',
  'act2.annals-lore',
  'act2.side.hub',
  'act2.side.more-hub',
  'act2.side.bully',
  'act2.side.bribe',
  'act2.side.whistle',
  'act2.famine-death',
  'act2.encounter.ring-peek'
]);

export const NARRATION_SCENES: readonly NarrationScene[] = ALL_NARRATION_SCENES.filter(
  scene => !RETIRED_MENU_SCENES.has(scene.id)
);

function buildScenesById(scenes: readonly NarrationScene[]): ReadonlyMap<string, NarrationScene> {
  const map = new Map<string, NarrationScene>();
  for (const scene of scenes) map.set(scene.id, scene);
  return map;
}

/** id → scene 查表。narrationSurface 推进循环按 `nextSceneId` 在此取下一场景。 */
export const NARRATION_SCENES_BY_ID: ReadonlyMap<string, NarrationScene> = buildScenesById(NARRATION_SCENES);
