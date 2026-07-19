import { describe, expect, it } from 'vitest';
import { applyAction, archiveDonationFlag, claimNpcQuest, createSimContext, createWorld, DEFAULT_BALANCE, getCurrentNpcQuest, getNpcQuestLine, isNpcQuestClaimed, npcQuestFlag, relationshipEventFlag, specialOrderCompleteFlag, type GameState, type SimContext } from '@sim';
import { roundTripEqual } from '@sim/serialize';
import { buildRegistry } from '@content/registry';
import { itemCount, mutateItem } from '@sim/world/player';

function setup(seed = 1): { state: GameState; ctx: SimContext } {
  const reg = buildRegistry();
  const state = createWorld({ seed, width: 6, height: 6, content: reg, params: DEFAULT_BALANCE });
  const ctx = createSimContext(seed, reg, DEFAULT_BALANCE);
  return { state, ctx };
}

describe('NPC 人物委托线', () => {
  it('按 NPC 好感事件与前序进度开放当前人物委托', () => {
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

  it('人物委托未完成、未解锁、重复领取均被拒绝', () => {
    const { state } = setup();
    expect(claimNpcQuest(state, 'npc-quest.herb-gatherer-bone-guard')).toMatchObject({ ok: false, reason: '人物委托未解锁' });

    state.flags.add(relationshipEventFlag('herb-gatherer-160'));
    expect(claimNpcQuest(state, 'npc-quest.herb-gatherer-bone-guard')).toMatchObject({ ok: false, reason: '进度未成' });

    mutateItem(state.player, 'herb.dewroot', 4);
    mutateItem(state.player, 'herb.mistfern', 2);
    state.player.bodyFoundation = 1200;
    state.player.cultivation = 1200;
    expect(claimNpcQuest(state, 'npc-quest.herb-gatherer-bone-guard').ok).toBe(true);
    expect(claimNpcQuest(state, 'npc-quest.herb-gatherer-bone-guard')).toMatchObject({ ok: false, reason: '已领取' });
  });

  it('人物委托奖励物因储物戒满无法接收时不写入领取标记', () => {
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

  it('人物委托线会衔接藏经、特别订单、引劫与巡守兽进度', () => {
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
    expect(getNpcQuestLine(state, 'npc.array-smith').find(quest => quest.id === 'npc-quest.array-smith-ruin-proof')?.current).toBe(true);
    expect(roundTripEqual(state)).toBe(true);
  });

  it('游方散修深交（320）解锁“故交引路”终章人物委托', () => {
    const { state } = setup();
    // 未深交前不解锁
    expect(claimNpcQuest(state, 'npc-quest.wandering-cultivator-deep-road')).toMatchObject({ ok: false, reason: '人物委托未解锁' });

    state.flags.add(relationshipEventFlag('wandering-cultivator-320'));
    // 深交但进度未成
    expect(claimNpcQuest(state, 'npc-quest.wandering-cultivator-deep-road')).toMatchObject({ ok: false, reason: '进度未成' });

    mutateItem(state.player, 'item.sealed-herb', 2);
    mutateItem(state.player, 'item.herbal-wine', 1);
    state.player.bodyFoundation = 2000;
    state.player.cultivation = 2000;
    const beforeLifespan = state.player.lifespanRemainingDays;
    const beforeWillpower = state.player.willpower;

    const r = claimNpcQuest(state, 'npc-quest.wandering-cultivator-deep-road');

    expect(r.ok).toBe(true);
    expect(isNpcQuestClaimed(state, 'npc-quest.wandering-cultivator-deep-road')).toBe(true);
    expect(itemCount(state.player, 'item.recipe-fragment')).toBe(2);
    expect(state.player.willpower).toBe(beforeWillpower + 320);
    expect(state.player.lifespanRemainingDays).toBe(beforeLifespan + 12);
    expect(getCurrentNpcQuest(state, 'npc.wandering-cultivator')).toBeNull();
  });

  it('采药女与阵匠深交（320）各自解锁终章人物委托', () => {
    const { state } = setup();

    // 采药女·空苔养骨：需自种绝灵苔 + 体魄 2200
    state.flags.add(relationshipEventFlag('herb-gatherer-320'));
    expect(claimNpcQuest(state, 'npc-quest.herb-gatherer-voidmoss-bond')).toMatchObject({ ok: false, reason: '进度未成' });
    mutateItem(state.player, 'herb.voidmoss', 2);
    state.player.bodyFoundation = 2200;
    state.player.cultivation = 2200;
    const hr = claimNpcQuest(state, 'npc-quest.herb-gatherer-voidmoss-bond');
    expect(hr.ok).toBe(true);
    expect(isNpcQuestClaimed(state, 'npc-quest.herb-gatherer-voidmoss-bond')).toBe(true);
    expect(itemCount(state.player, 'item.sealed-herb')).toBe(2);

    // 阵匠·以阵淬骨：需阵核 + 破损法宝 + 定力 1500
    state.flags.add(relationshipEventFlag('array-smith-320'));
    expect(claimNpcQuest(state, 'npc-quest.array-smith-formation-master')).toMatchObject({ ok: false, reason: '进度未成' });
    mutateItem(state.player, 'item.array-core', 2);
    mutateItem(state.player, 'item.broken-talisman', 3);
    state.player.willpower = 1500;
    const ar = claimNpcQuest(state, 'npc-quest.array-smith-formation-master');
    expect(ar.ok).toBe(true);
    expect(isNpcQuestClaimed(state, 'npc-quest.array-smith-formation-master')).toBe(true);
    expect(itemCount(state.player, 'item.array-core')).toBe(4); // 持有 2 + 奖励 2
  });
});
