/**
 * 叙事系统。
 *
 * 把四幕主线的"关键节点"以数据驱动对白接入游戏：触发谓词读 sim state，
 * 命中且未见过的节拍按优先顺序浮现。确定性：触发是 state 的纯函数（无 RNG），
 * "已见"记在 player.flags（前缀 narr-），存档往返保留。
 *
 * 节拍文案取自 叙事圣经（§1 四幕 / §2 关键节点 / §0.3 失败即叙事）。
 * 触发条件刻意映射到可由 state 推导的事件，避免依赖 RNG 或渲染。
 */
import type { GameState } from '@sim/world/state';

export interface NarrativeBeat {
  id: string;
  trigger: (state: GameState) => boolean;
  lines: string[];
}

const hasPill = (s: GameState): boolean => Object.keys(s.player.inventory).some(id => id.startsWith('pill.'));
const activeEventIs = (s: GameState, defId: string): boolean => s.activeEvent?.defId === defId;

/**
 * 按 四幕节奏编排的叙事节拍（顺序即浮现优先级）。
 * 开场三连（awaken→spirit-test→intro）构成序章；其后按玩法里程碑与天象插入。
 */
export const NARRATIVE_BEATS: readonly NarrativeBeat[] = [
  {
    id: 'awaken',
    trigger: () => true,
    lines: ['穿越了——按八百本小说的套路，此刻该有「系统绑定」，或脑海里一声苍老的「小子，老夫等你三千年」。', '我等了三天。什么都没等到。', '……也许，我就是那个，穿越了也没人要的废柴。']
  },
  {
    id: 'spirit-test',
    trigger: () => true,
    lines: ['太一宗测灵柱前，少年天才们手中绽五色光华，长老颔首记录。', '我按上去。死寂——像按在一块石头上。换更高阶的柱，依然死寂。', '长老亲自以神识探我丹田，猛地缩手：「无灵根，天道弃子——逐。」']
  },
  {
    id: 'intro',
    trigger: () => true,
    lines: ['被扫地出门，回到这破败的永恒山谷，认命种地。', '种田以炼丹，炼丹以渡劫，渡劫以偷天。', '凡骨一线，硬撼天道。']
  },
  {
    id: 'first-till',
    trigger: s => s.tiles.some(t => t.tilled),
    lines: ['锄头落下，泥土翻起。', '凡人的手，比灵根更实在——这是你唯一的本钱。']
  },
  {
    id: 'first-mature',
    trigger: s => [...s.crops.values()].some(c => c.stage === 'mature'),
    lines: ['灵草熟了。', '这是你以凡骨养出的，第一缕天地灵气。', '别人存灵气抠抠搜搜，你倒好——吸进来全漏进地里。可你猜，谁的灵草长得快？']
  },
  {
    id: 'tribulation-art-reveal',
    trigger: s => (s.player.bodyFoundation ?? s.player.cultivation) > 0,
    lines: ['《偷天换劫诀》残卷第一页，字迹有的发烫、有的发冷：', '「此诀非人所修。无灵根者，方可习之。以劫为薪，以骨为柴。偷天一线，换劫三生。习此诀者，已死。」', '——你笑了。没有灵力不是答案，只是开局；往后的路，要用肉身一寸寸打出来。']
  },
  {
    id: 'first-pill',
    trigger: hasPill,
    lines: ['丹成。', '药性平衡的瞬间，你隐约摸到了「偷天」的门槛。']
  },
  {
    id: 'first-tribulation',
    trigger: s => s.player.temperingStack > 0,
    lines: ['劫雷淬体——剧痛之后，凡骨里多了一丝天雷的余韵。', '「原来这就是偷天。它劈我，我吃它——亏的是血，赚的是命。」']
  },
  {
    id: 'qi-tide',
    trigger: s => activeEventIs(s, 'event.qi-tide'),
    lines: ['灵气潮汐降临，远方大能突破的余波震荡天地，灵草疯长。', '但灵气也会引来不该来的东西——抢收，布防。']
  },
  {
    id: 'beast-tide',
    trigger: s => s.beastSurge != null,
    lines: ['妖兽潮！灵气引来的群兽趁夜啃食灵草。', '连夜的守田与猎杀——这是凡人守山的代价。']
  },
  {
    id: 'demonic-pass',
    trigger: s => activeEventIs(s, 'event.demonic-pass'),
    lines: ['正魔交战的遁光掠过山谷，余波毁田。', '但战后的灰烬里，或有残卷与法宝可拾——蝼蚁的晚餐，是仙人的尸骸。']
  },
  {
    id: 'stage-3',
    trigger: s => s.player.stage >= 3,
    lines: ['通脉。你已能引动小天劫。', '紫雷的传闻，开始在山外流传。']
  },
  {
    id: 'purple-omen',
    trigger: s => activeEventIs(s, 'event.purple-omen'),
    lines: ['天穹泛紫。', '紫雷前兆——七日后，终局将至。备好飞升丹，或，粉身碎骨。']
  },
  {
    id: 'stage-5',
    trigger: s => s.player.stage >= 5,
    lines: ['凝血。', '天劫愈烈，你却愈从容——这是偷天者的从容。']
  },
  {
    id: 'stage-7',
    trigger: s => s.player.stage >= 7,
    lines: ['飞升前夜。紫雷劫池，已在地平线上聚集。', '吞下飞升丹，引劫，白日飞升——或，化为劫灰。']
  }
];

const SEEN_PREFIX = 'narr-';

/** 已见节拍标记读写（存于 player.flags，随存档持久化）。 */
export function markSeen(state: GameState, beatId: string): void {
  state.player.flags.add(SEEN_PREFIX + beatId);
}
export function isSeen(state: GameState, beatId: string): boolean {
  return state.player.flags.has(SEEN_PREFIX + beatId);
}

/** 下一个应浮现的节拍（首个 trigger 命中且未见）。null=无待显示。 */
export function nextPendingBeat(state: GameState): NarrativeBeat | null {
  for (const b of NARRATIVE_BEATS) {
    if (!isSeen(state, b.id) && b.trigger(state)) return b;
  }
  return null;
}
