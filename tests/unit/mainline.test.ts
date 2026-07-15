/**
  * 主线任务链：把 Stardew 式持续推进目标收束为修仙化的章节任务。
 */
import { describe, expect, it } from 'vitest';
import {
 applyAction,
 archiveDonationFlag,
 claimMainlineQuest,
 createSimContext,
 createWorld,
 DEFAULT_BALANCE,
 getCurrentMainlineQuest,
 getMainlineQuests,
 isMainlineQuestClaimed,
 mainlineQuestFlag,
 specialOrderCompleteFlag,
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

describe('主线任务链', () => {
 it('按顺序开放当前主线任务，并在领取后切换到下一步', () => {
 const { state } = setup();
 expect(getCurrentMainlineQuest(state)?.id).toBe('mainline.mortal-discipline');

state.player.bodyFoundation = 400;
 state.player.cultivation = 400;
 state.player.endurance = 80;
 state.player.willpower = 80;

const claimed = claimMainlineQuest(state, 'mainline.mortal-discipline');
 expect(claimed.ok).toBe(true);
 expect(isMainlineQuestClaimed(state, 'mainline.mortal-discipline')).toBe(true);
 expect(getCurrentMainlineQuest(state)?.id).toBe('mainline.herb-path');
 });

it('主线未完成、未解锁、重复领取均被拒绝', () => {
 const { state } = setup();
 expect(claimMainlineQuest(state, 'mainline.mortal-discipline')).toMatchObject({ ok: false, reason: '进度未成' });
 expect(claimMainlineQuest(state, 'mainline.herb-path')).toMatchObject({ ok: false, reason: '主线未解锁' });

state.player.bodyFoundation = 400;
 state.player.cultivation = 400;
 state.player.endurance = 80;
 state.player.willpower = 80;
 expect(claimMainlineQuest(state, 'mainline.mortal-discipline').ok).toBe(true);
 expect(claimMainlineQuest(state, 'mainline.mortal-discipline')).toMatchObject({ ok: false, reason: '已领取' });
 });

it('主线奖励物因储物戒满无法接收时不写入领取标记', () => {
 const { state } = setup();
 state.player.inventoryCapacity = 1;
 mutateItem(state.player, 'item.recipe-fragment', 1);
 state.player.bodyFoundation = 400;
 state.player.cultivation = 400;
 state.player.endurance = 80;
 state.player.willpower = 80;

const result = claimMainlineQuest(state, 'mainline.mortal-discipline');

expect(result).toMatchObject({ ok: false, reason: '储物戒已满' });
 expect(isMainlineQuestClaimed(state, 'mainline.mortal-discipline')).toBe(false);
 expect(state.player.bodyFoundation).toBe(400);
 expect(itemCount(state.player, 'item.spirit-compost')).toBe(0);
 });

it('后续主线会衔接藏经、特别订单与主动引劫进度', () => {
 const { state } = setup();
 state.flags.add(mainlineQuestFlag('mainline.mortal-discipline'));
 state.flags.add(mainlineQuestFlag('mainline.herb-path'));
 expect(getCurrentMainlineQuest(state)?.id).toBe('mainline.archive-clue');

state.flags.add(archiveDonationFlag('archive.recipe-fragment-primer'));
 expect(claimMainlineQuest(state, 'mainline.archive-clue').ok).toBe(true);
 expect(getCurrentMainlineQuest(state)?.id).toBe('mainline.valley-order');

state.flags.add(specialOrderCompleteFlag('special-order.herb-stockpile'));
 expect(claimMainlineQuest(state, 'mainline.valley-order').ok).toBe(true);
 expect(getCurrentMainlineQuest(state)?.id).toBe('mainline.defy-heaven');

state.player.heavenDebt = 3000;
 state.player.daoAttention = 5000;
 expect(claimMainlineQuest(state, 'mainline.defy-heaven').ok).toBe(true);
 expect(state.player.lifespanRemainingDays).toBe(DEFAULT_BALANCE.bodyCultivation.lifespanStartDays + 30);
 });

it('claim-mainline-quest 玩家动作接入动作系统，状态可存档往返', () => {
 const { state, ctx } = setup();
 state.player.bodyFoundation = 400;
 state.player.cultivation = 400;
 state.player.endurance = 80;
 state.player.willpower = 80;

applyAction(state, { kind: 'claim-mainline-quest', questId: 'mainline.mortal-discipline' }, ctx);

expect(state.flags.has(mainlineQuestFlag('mainline.mortal-discipline'))).toBe(true);
 expect(getMainlineQuests(state).find((quest) => quest.id === 'mainline.herb-path')?.current).toBe(true);
 expect(roundTripEqual(state)).toBe(true);
 });
});
