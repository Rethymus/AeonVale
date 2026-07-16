import type { GameState } from '@sim/world/state';
import { emit } from '@sim/world/state';
import { mutateItem } from '@sim/world/player';

export interface RuinChapterReward {
  itemId?: string;
  count?: number;
  bodyFoundation?: number;
  willpower?: number;
  lifespanDays?: number;
}

export interface RuinChapterDef {
  id: string;
  title: string;
  description: string;
  objective: string;
  floorStart: number;
  floorEnd: number;
  reward: RuinChapterReward;
  isAvailable: (state: GameState) => boolean;
}

export interface RuinChapterStatus extends RuinChapterDef {
  claimed: boolean;
  available: boolean;
  completed: boolean;
  current: boolean;
}

export interface RuinChapterResult {
  ok: boolean;
  chapter: RuinChapterDef | null;
  reason?: string;
}

const FLAG_PREFIX = 'ruin-chapter:';

export function ruinChapterFlag(chapterId: string): string {
  return FLAG_PREFIX + chapterId;
}

export function isRuinChapterClaimed(state: GameState, chapterId: string): boolean {
  return state.flags.has(ruinChapterFlag(chapterId));
}

export const RUIN_CHAPTER_CATALOG: readonly RuinChapterDef[] = [
  {
    id: 'ruin-chapter.bone-trial',
    title: '裂骨试阶',
    description: '遗迹前五层像在替早已绝迹的古体修筛骨，凡骨扛不住的人连门槛都看不见。',
    objective: '把遗迹推进至第 5 层，证明你已能承受第一轮裂骨试炼。',
    floorStart: 1,
    floorEnd: 5,
    reward: { itemId: 'item.spirit-compost', count: 2, bodyFoundation: 180 },
    isAvailable: () => true
  },
  {
    id: 'ruin-chapter.array-echo',
    title: '残阵回音',
    description: '第六到第十层开始出现断裂阵纹，像是前人故意给后来者留下的逆推题面。',
    objective: '把遗迹推进至第 10 层，拿到能支撑体修近战控场的残阵线索。',
    floorStart: 6,
    floorEnd: 10,
    reward: { itemId: 'item.array-core', count: 1, willpower: 260 },
    isAvailable: state => isRuinChapterClaimed(state, 'ruin-chapter.bone-trial')
  },
  {
    id: 'ruin-chapter.beast-scar',
    title: '妖痕磨骨',
    description: '更深处的墙面满是妖兽抓痕与人形拳印，说明这里从来不是给灵修留的传承。',
    objective: '把遗迹推进至第 15 层，经住遗迹深处的妖痕磨骨。',
    floorStart: 11,
    floorEnd: 15,
    reward: { itemId: 'item.recipe-fragment', count: 2, bodyFoundation: 260, willpower: 220 },
    isAvailable: state => isRuinChapterClaimed(state, 'ruin-chapter.array-echo')
  },
  {
    id: 'ruin-chapter.heaven-gate',
    title: '逆命门',
    description: '最后五层残留着引劫痕迹，像有人曾在这里主动向天要过一次活路。',
    objective: '把遗迹推进至第 20 层，探尽遗迹最深处的逆命门。',
    floorStart: 16,
    floorEnd: 20,
    reward: { itemId: 'item.spirit-stone', count: 10, lifespanDays: 12, willpower: 400 },
    isAvailable: state => isRuinChapterClaimed(state, 'ruin-chapter.beast-scar')
  }
];

function grantReward(state: GameState, reward: RuinChapterReward): boolean {
  if (reward.itemId && reward.count) {
    if (!mutateItem(state.player, reward.itemId, reward.count)) return false;
  }
  state.player.bodyFoundation += reward.bodyFoundation ?? 0;
  state.player.cultivation += reward.bodyFoundation ?? 0;
  state.player.willpower += reward.willpower ?? 0;
  state.player.lifespanRemainingDays += reward.lifespanDays ?? 0;
  return true;
}

export function getRuinChapters(state: GameState): RuinChapterStatus[] {
  const current = getCurrentRuinChapter(state)?.id ?? null;
  return RUIN_CHAPTER_CATALOG.map(chapter => ({
    ...chapter,
    claimed: isRuinChapterClaimed(state, chapter.id),
    available: chapter.isAvailable(state),
    completed: state.exploration.deepestRuinLevel >= chapter.floorEnd,
    current: current === chapter.id
  }));
}

export function getCurrentRuinChapter(state: GameState): RuinChapterStatus | null {
  for (const chapter of RUIN_CHAPTER_CATALOG) {
    if (!chapter.isAvailable(state)) continue;
    if (isRuinChapterClaimed(state, chapter.id)) continue;
    return {
      ...chapter,
      claimed: false,
      available: true,
      completed: state.exploration.deepestRuinLevel >= chapter.floorEnd,
      current: true
    };
  }
  return null;
}

export function claimRuinChapter(state: GameState, chapterId: string): RuinChapterResult {
  const chapter = RUIN_CHAPTER_CATALOG.find(entry => entry.id === chapterId) ?? null;
  if (!chapter) return { ok: false, chapter: null, reason: '无此遗迹章节' };
  if (!chapter.isAvailable(state)) return { ok: false, chapter, reason: '遗迹章节未解锁' };
  if (isRuinChapterClaimed(state, chapter.id)) return { ok: false, chapter, reason: '已领取' };
  if (state.exploration.deepestRuinLevel < chapter.floorEnd) return { ok: false, chapter, reason: '进度未成' };
  if (!grantReward(state, chapter.reward)) return { ok: false, chapter, reason: '储物戒已满' };

  state.flags.add(ruinChapterFlag(chapter.id));
  const nextChapter = RUIN_CHAPTER_CATALOG.find(entry => entry.isAvailable(state) && !isRuinChapterClaimed(state, entry.id)) ?? null;
  emit(state, 'ruin-chapter-claim', {
    chapterId: chapter.id,
    title: chapter.title,
    floorEnd: chapter.floorEnd,
    reward: chapter.reward,
    nextChapterId: nextChapter?.id ?? null,
    nextChapterTitle: nextChapter?.title ?? null,
    nextFloorStart: nextChapter?.floorStart ?? null,
    nextFloorEnd: nextChapter?.floorEnd ?? null
  });
  return { ok: true, chapter };
}
