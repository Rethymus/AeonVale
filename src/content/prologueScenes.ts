/**
 * 序章视觉小说场景数据（演示版）。
 *
 * 复用 src/content/narrative.ts 中 awaken / spirit-test / intro 三连节拍的原文，
 * 仅在节拍之间补一句过渡。护栏（设定 §16/§17、决策 D-34/D-39）：
 *  1. 序章只出现「无灵根」事实判定——用户订正：不用旧的弃子判词，改为长老先看出
 *     主角意志坚定、测出无灵根后叹「可惜」、给盘缠、说「这里不是凡人该待的地方」
 *     让其离去；「空灵根」一词严禁在序章点破；
 *  2. 主角经典梗哀鸣「难道没有灵根，就真的不能修仙了吗」作为收束；
 *  3. S1 三条「伪选项」皆败，构成漏斗，冷幽默保持克制（一句一行）；
 *  4. 功法《偷天换劫诀》与「偷天」一词均不进序章——功法由第一幕「修士斗法、败者逆
 *     化劫灰、遗落储物戒、主角以空灵根吞吐冲刷神识锁后捡到残卷」主线引出；神农传说
 *     为暗线，由物件/闲谈/遗迹分散铺垫。「种田以炼丹…渡劫以偷天，凡骨一线，硬撼天道」
 *     为 §1 题旨，迁至第一幕功法入手处，不在序章出现。
 *
 * 当前序章已接入 2026-07 美术重做批次 CG；缺失 cg 或加载失败时由 prologueVN
 * 退化为水墨氛围层，保证演出可读。
 */
export interface PrologueChoice {
  /** 选项按钮文案。 */
  readonly label: string;
  /** 选中后立刻浮现的一句（克制冷幽默）。 */
  readonly response: string;
  /** 选中后可切换的 manifest CG AssetId。 */
  readonly cgAssetId?: string;
}

export type PrologueSceneId = 'awaken' | 'spirit-test' | 'intro';

export interface PrologueScene {
  readonly id: PrologueSceneId;
  /** 可选 manifest CG AssetId；缺失或加载失败时退化为 CSS 水墨氛围。 */
  readonly cgAssetId?: string;
  /** 按顺序浮现的旁白/对白行（取自 narrative.ts 对应节拍原文）。 */
  readonly lines: readonly string[];
  /** 末尾可出现的伪选项（漏斗：三条皆败）；可选。 */
  readonly choices?: readonly PrologueChoice[];
  /** 任一选项后浮现的收敛行；可选。 */
  readonly converge?: string;
}

/** 序章三幕场景（顺序演出）。 */
export const PROLOGUE_SCENES: readonly PrologueScene[] = [
  {
    id: 'awaken',
    cgAssetId: 'cg.prologue.awakening-v1',
    lines: [
      '穿越了——按八百本小说的套路，此刻该有「系统绑定」，或脑海里一声苍老的「小子，老夫等你三千年」。',
      '我等了三天。什么都没等到。'
    ],
    choices: [
      { label: '高呼『系统！』', response: '……似乎什么都没有发生。', cgAssetId: 'cg.prologue.system-fails-v1' },
      { label: '找戒指里的老爷爷', response: '你翻了翻口袋，只有一把不知是谁的锄头。', cgAssetId: 'cg.prologue.system-fails-v1' },
      { label: '默念『戒中残魂，速来！』', response: '脑海死寂。什么都没来。', cgAssetId: 'cg.prologue.system-fails-v1' }
    ],
    // 取自 narrative.ts awaken 节拍末行（原文保留前导省略号）。
    converge: '……也许，我就是那个，穿越了也没人要的废柴。'
  },
  {
    id: 'spirit-test',
    cgAssetId: 'cg.prologue.spirit-test-silent-v1',
    // 用户订正：测灵只是告知事实；长老先看出主角意志坚定，测出无灵根后叹「可惜」、
    // 给盘缠、说「这里不是凡人该待的地方」让其离去。不使用旧的弃子判词。
    lines: [
      '太一宗山门前，少年天才们挨个按上测灵柱，掌心绽出五色光华，长老颔首记录。',
      '轮到我时，那长老多看我几眼，搁下笔：「根骨虽凡，这一身不肯服输的硬气，倒少见。」',
      '他让我上前，掌心贴上测灵柱。死寂——像按在一块冷石头上。换更高阶的柱，依旧死寂。',
      '长老的神识探过我丹田，沉默良久，长叹一声：「可惜了这股志气。无灵根——此生与修仙无缘。」',
      '他解下一袋盘缠，塞进我怀里：「回去吧。这里，不是凡人该待的地方。」'
    ]
  },
  {
    id: 'intro',
    cgAssetId: 'cg.prologue.return-valley-v1',
    // §6 收束梗。功法/「偷天」不在此出现——属第一幕内容（见文件头护栏 4）。
    lines: [
      '揣着那袋盘缠，我回到这破败的永恒山谷，认命种地。',
      '谷口的老者——人们叫他「忘言叟」——远远看着，一言不发，只把一把锈锄头塞进你手里。',
      '难道没有灵根，就真的不能修仙了吗？——没人回答。'
    ]
  }
];
