import { describe, expect, it } from 'vitest';
import {
 applyAction,
 archiveDonationFlag,
 claimNpcQuest,
 createSimContext,
 createWorld,
 DEFAULT_BALANCE,
 getCurrentNpcQuest,
 getNpcQuestLine,
 isNpcQuestClaimed,
 npcQuestFlag,
 relationshipEventFlag,
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

describe('NPC 人物任务线', () => {
 it('按 NPC 好感事件与前序进度开放当前人物任务', () => {
 const { state } = setup();
 expect(getCurrentNpcQuest(state, 'npc.herb-gatherer')).toBeNull;

state.flags.add(relationshipEventFlag('herb-gatherer-160'));
 expect(getCurrentNpcQuest(state, 'npc.herb-gatherer')?.id).toBe('npc-quest.herb-gatherer-bone-guard');

mutateItem(state.player, 'herb.dewroot', 4);
 mutateItem(state.player, 'herb.mistfern', 2);
 state.player.bodyFoundation = 1200;
 state.player.cultivation = 1200;
 expect(claimNpcQuest(state, 'npc-quest.herb-gatherer-bone-guard').ok).toBe(true);
 expect(getCurrentNpcQuest(state, 'npc.herb-gatherer')?.id).toBe('npc-quest.herb-gatherer-thunder-brew');
 });

it('人物任务未完成、未解锁、重复领取均被拒绝', () => {
 const { state } = setup();
 expect(claimNpcQuest(state, 'npc-quest.herb-gatherer-bone-guard')).toMatchObject({ ok: false, reason: '人物任务未解锁' });

state.flags.add(relationshipEventFlag('herb-gatherer-160'));
 expect(claimNpcQuest(state, 'npc-quest.herb-gatherer-bone-guard')).toMatchObject({ ok: false, reason: '进度未成' });

mutateItem(state.player, 'herb.dewroot', 4);
 mutateItem(state.player, 'herb.mistfern', 2);
 state.player.bodyFoundation = 1200;
 state.player.cultivation = 1200;
 expect(claimNpcQuest(state, 'npc-quest.herb-gatherer-bone-guard').ok).toBe(true);
 expect(claimNpcQuest(state, 'npc-quest.herb-gatherer-bone-guard')).toMatchObject({ ok: false, reason: '已领取' });
 });

it('人物任务奖励物因储物戒满无法接收时不写入领取标记', () => {
 const { state } = setup();
 state.flags.add(relationshipEventFlag('herb-gatherer-160'));
 mutateItem(state.player, 'herb.dewroot', 4);
 mutateItem(state.player, 'herb.mistfern', 2);
 state.player.inventoryCapacity = 2;
 mutateItem(state.player, 'item.recipe-fragment', 1);
 state.player.bodyFoundation = 1200;
 state.player.cultivation = 1200;

const result = claimNpcQuest(state, 'npc-quest.herb-gatherer-bone-guard');

expect(result).toMatchObject({ ok: false, reason: '储物戒已满' });
 expect(isNpcQuestClaimed(state, 'npc-quest.herb-gatherer-bone-guard')).toBe(false);
 expect(itemCount(state.player, 'item.spirit-compost')).toBe(0);
 expect(state.player.bodyFoundation).toBe(1200);
 });

it('人物任务线会衔接藏经、特别订单、引劫与巡守兽进度', () => {
 const { state } = setup();

state.flags.add(relationshipEventFlag('array-smith-160'));
 mutateItem(state.player, 'item.broken-talisman', 2);
 mutateItem(state.player, 'item.array-core', 1);
 expect(claimNpcQuest(state, 'npc-quest.array-smith-circle-step').ok).toBe(true);
 state.flags.add(archiveDonationFlag('archive.recipe-fragment-primer'));
 state.flags.add(archiveDonationFlag('archive.broken-talisman-anatomy'));
 state.flags.add(specialOrderCompleteFlag('special-order.array-scrap'));
 expect(claimNpcQuest(state, 'npc-quest.array-smith-ruin-proof').ok).toBe(true);

state.flags.add(relationshipEventFlag('wandering-cultivator-160'));
 mutateItem(state.player, 'item.beast-core', 2);
 mutateItem(state.player, 'item.spirit-stone', 10);
 expect(claimNpcQuest(state, 'npc-quest.wandering-cultivator-market-path').ok).toBe(true);
 state.flags.add(specialOrderCompleteFlag('special-order.beast-watch'));
 state.guardBeasts.push({ id: 1, vigor: 10, maxVigor: 10, bond: 20, specialty: null });
 expect(claimNpcQuest(state, 'npc-quest.wandering-cultivator-field-watch').ok).toBe(true);

state.flags.add(relationshipEventFlag('herb-gatherer-160'));
 mutateItem(state.player, 'herb.dewroot', 4);
 mutateItem(state.player, 'herb.mistfern', 2);
 state.player.bodyFoundation = 1200;
 state.player.cultivation = 1200;
 expect(claimNpcQuest(state, 'npc-quest.herb-gatherer-bone-guard').ok).toBe(true);
 state.flags.add(specialOrderCompleteFlag('special-order.herb-stockpile'));
 state.player.heavenDebt = 3000;
 expect(claimNpcQuest(state, 'npc-quest.herb-gatherer-thunder-brew').ok).toBe(true);
 expect(state.player.lifespanRemainingDays).toBe(DEFAULT_BALANCE.bodyCultivation.lifespanStartDays + 20);
 });

it('claim-npc-quest 玩家动作接入动作系统，状态可存档往返', () => {
 const { state, ctx } = setup();
 state.flags.add(relationshipEventFlag('array-smith-160'));
 mutateItem(state.player, 'item.broken-talisman', 2);
 mutateItem(state.player, 'item.array-core', 1);

applyAction(state, { kind: 'claim-npc-quest', questId: 'npc-quest.array-smith-circle-step' }, ctx);

expect(state.flags.has(npcQuestFlag('npc-quest.array-smith-circle-step'))).toBe(true);
 expect(getNpcQuestLine(state, 'npc.array-smith').find((quest) => quest.id === 'npc-quest.array-smith-ruin-proof')?.current).toBe(true);
 expect(roundTripEqual(state)).toBe(true);
 });
});
