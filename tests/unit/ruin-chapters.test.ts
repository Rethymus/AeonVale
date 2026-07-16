import { describe, expect, it } from 'vitest';
import {
 applyAction,
 claimRuinChapter,
 createSimContext,
 createWorld,
 DEFAULT_BALANCE,
 getCurrentRuinChapter,
 getRuinChapters,
 isRuinChapterClaimed,
 ruinChapterFlag,
 type GameState,
 type SimContext,
} from '@sim';
import { roundTripEqual } from '@sim/serialize';
import { buildRegistry } from '@content/registry';
import { itemCount, mutateItem } from '@sim/world/player';

function setup(seed = 1): { state: GameState; ctx: SimContext } {
 const reg = buildRegistry();
 const state = createWorld({ seed, width: 6, height: 6, content: reg, params: DEFAULT_BALANCE });
 const ctx = createSimContext(seed, reg, DEFAULT_BALANCE);
 return { state, ctx };
}

describe('遗迹章节推进', () => {
 it('按最深层数顺序开放当前遗迹章节，并在领取后切换到下一章', () => {
 const { state } = setup();
 expect(getCurrentRuinChapter(state)?.id).toBe('ruin-chapter.bone-trial');

state.exploration.deepestRuinLevel = 5;
 const claimed = claimRuinChapter(state, 'ruin-chapter.bone-trial');
 expect(claimed.ok).toBe(true);
 expect(isRuinChapterClaimed(state, 'ruin-chapter.bone-trial')).toBe(true);
 expect(getCurrentRuinChapter(state)?.id).toBe('ruin-chapter.array-echo');
 });

it('遗迹章节未完成、未解锁、重复领取均被拒绝', () => {
 const { state } = setup();
 expect(claimRuinChapter(state, 'ruin-chapter.bone-trial')).toMatchObject({ ok: false, reason: '进度未成' });
 expect(claimRuinChapter(state, 'ruin-chapter.array-echo')).toMatchObject({ ok: false, reason: '遗迹章节未解锁' });

state.exploration.deepestRuinLevel = 5;
 expect(claimRuinChapter(state, 'ruin-chapter.bone-trial').ok).toBe(true);
 expect(claimRuinChapter(state, 'ruin-chapter.bone-trial')).toMatchObject({ ok: false, reason: '已领取' });
 });

it('遗迹章节奖励物因储物戒满无法接收时不写入领取标记', () => {
 const { state } = setup();
 state.exploration.deepestRuinLevel = 5;
 state.player.inventoryCapacity = 1;
 mutateItem(state.player, 'item.recipe-fragment', 1);

const result = claimRuinChapter(state, 'ruin-chapter.bone-trial');

expect(result).toMatchObject({ ok: false, reason: '储物戒已满' });
 expect(isRuinChapterClaimed(state, 'ruin-chapter.bone-trial')).toBe(false);
 expect(itemCount(state.player, 'item.spirit-compost')).toBe(0);
 expect(state.player.bodyFoundation).toBe(0);
 });

it('后续遗迹章节衔接更深层数与寿元奖励', () => {
 const { state } = setup();

state.exploration.deepestRuinLevel = 5;
 expect(claimRuinChapter(state, 'ruin-chapter.bone-trial').ok).toBe(true);
 state.exploration.deepestRuinLevel = 10;
 expect(claimRuinChapter(state, 'ruin-chapter.array-echo').ok).toBe(true);
 state.exploration.deepestRuinLevel = 15;
 expect(claimRuinChapter(state, 'ruin-chapter.beast-scar').ok).toBe(true);
 state.exploration.deepestRuinLevel = 20;
 expect(claimRuinChapter(state, 'ruin-chapter.heaven-gate').ok).toBe(true);
 expect(state.player.lifespanRemainingDays).toBe(DEFAULT_BALANCE.bodyCultivation.lifespanStartDays + 12);
 });

it('claim-ruin-chapter 玩家动作接入动作系统，状态可存档往返', () => {
 const { state, ctx } = setup();
 state.exploration.deepestRuinLevel = 5;

applyAction(state, { kind: 'claim-ruin-chapter', chapterId: 'ruin-chapter.bone-trial' }, ctx);

expect(state.flags.has(ruinChapterFlag('ruin-chapter.bone-trial'))).toBe(true);
 expect(getRuinChapters(state).find((chapter) => chapter.id === 'ruin-chapter.array-echo')?.current).toBe(true);
 expect(roundTripEqual(state)).toBe(true);
 });
});
