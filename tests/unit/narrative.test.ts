/**
  * 叙事系统触发逻辑。
  * 触发是 state 的纯函数，确定性可测；渲染由 browser smoke 覆盖。
 */
import { describe, it, expect } from 'vitest';
import { createWorld, createSimContext, DEFAULT_BALANCE } from '@sim';
import { buildRegistry } from '@content/registry';
import { nextPendingBeat, markSeen, isSeen, NARRATIVE_BEATS } from '@content/narrative';
import { mutateItem } from '@sim/world/player';
import type { GameState, SimContext } from '@sim';

function setup(seed = 1): { state: GameState; ctx: SimContext } {
 const reg = buildRegistry();
 const state = createWorld({ seed, width: 6, height: 6, content: reg, params: DEFAULT_BALANCE });
 const ctx = createSimContext(seed, reg, DEFAULT_BALANCE);
 return { state, ctx };
}

describe('叙事系统', () => {
 it('节拍表非空且每个有 id+lines', () => {
 expect(NARRATIVE_BEATS.length).toBeGreaterThanOrEqual(12);
 for (const b of NARRATIVE_BEATS) {
 expect(b.id.length).toBeGreaterThan(0);
 expect(b.lines.length).toBeGreaterThan(0);
 }
 });

it('开场三连顺序：awaken → spirit-test → intro', () => {
 const { state } = setup();
 expect(nextPendingBeat(state)?.id).toBe('awaken');
 markSeen(state, 'awaken');
 expect(nextPendingBeat(state)?.id).toBe('spirit-test');
 markSeen(state, 'spirit-test');
 expect(nextPendingBeat(state)?.id).toBe('intro');
 markSeen(state, 'intro');
 expect(isSeen(state, 'intro')).toBe(true);
 });

it('first-till：翻地后触发', () => {
 const { state } = setup();
 markSeen(state, 'awaken'); markSeen(state, 'spirit-test'); markSeen(state, 'intro');
 expect(nextPendingBeat(state)).toBeNull;
 state.tiles[0]!.tilled = true;
 expect(nextPendingBeat(state)?.id).toBe('first-till');
 });

it('tribulation-art-reveal：体魄根基增长后触发', () => {
 const { state } = setup();
 for (const b of NARRATIVE_BEATS) markSeen(state, b.id); // 全标记见过
 state.player.flags.delete('narr-tribulation-art-reveal'); // 仅留此节拍
 expect(nextPendingBeat(state)).toBeNull;
 state.player.bodyFoundation = 1000;
 expect(nextPendingBeat(state)?.id).toBe('tribulation-art-reveal');
 });

it('残卷文案不再把空灵根写成入场券', () => {
 const beat = NARRATIVE_BEATS.find((b) => b.id === 'tribulation-art-reveal')!;
 const text = beat.lines.join('\n');
 expect(text).not.toContain('入场券');
 expect(text).toContain('《偷天换劫诀》残卷第一页');
 expect(text).toContain('以劫为薪，以骨为柴');
 });

it('first-pill：背包有丹药时触发', () => {
 const { state } = setup();
 markSeen(state, 'awaken'); markSeen(state, 'spirit-test'); markSeen(state, 'intro');
 markSeen(state, 'first-till'); markSeen(state, 'first-mature'); markSeen(state, 'tribulation-art-reveal');
 expect(nextPendingBeat(state)).toBeNull;
 mutateItem(state.player, 'pill.ward-basic', 1);
 expect(nextPendingBeat(state)?.id).toBe('first-pill');
 });

it('天象节拍：qi-tide / beast-tide / demonic-pass 按 state 触发', () => {
 const { state } = setup();
 for (const b of NARRATIVE_BEATS) markSeen(state, b.id);
 state.player.flags.delete('narr-qi-tide');
 state.activeEvent = { defId: 'event.qi-tide', displayName: '灵气潮汐', daysLeft: 5, growthMod: 1.5, qiMod: 1.5 };
 expect(nextPendingBeat(state)?.id).toBe('qi-tide');
 markSeen(state, 'qi-tide');

state.player.flags.delete('narr-beast-tide');
 state.activeEvent = null;
 state.beastSurge = { beastsRemaining: 4, daysLeft: 2 };
 expect(nextPendingBeat(state)?.id).toBe('beast-tide');
 markSeen(state, 'beast-tide');

state.player.flags.delete('narr-demonic-pass');
 state.beastSurge = null;
 state.activeEvent = { defId: 'event.demonic-pass', displayName: '魔修过境', daysLeft: 1, growthMod: 1, qiMod: 1 };
 expect(nextPendingBeat(state)?.id).toBe('demonic-pass');
 });

it('节拍按数组优先级顺序浮现（同时满足多个时取靠前者）', () => {
 const { state } = setup();
 markSeen(state, 'awaken'); markSeen(state, 'spirit-test'); markSeen(state, 'intro');
 state.tiles[0]!.tilled = true;
 state.player.stage = 7 as GameState['player']['stage']; // 也满足 stage-7 等
 expect(nextPendingBeat(state)?.id).toBe('first-till'); // 数组中更靠前
 });

it('已见标记存于 flags（前缀 narr-），可随存档持久化', () => {
 const { state } = setup();
 markSeen(state, 'awaken');
 expect(state.player.flags.has('narr-awaken')).toBe(true);
 });
});
