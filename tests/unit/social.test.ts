/**
 * NPC 社交：每日赠礼、偏好、好感持久化。
 */
import { describe, expect, it } from 'vitest';
import { applyAction, availableRelationshipEvents, bestGiftItemForNpc, claimRelationshipEvent, createSimContext, createWorld, DEFAULT_BALANCE, getNpcDailySchedules, getNpcList, getRelationship, giveGift, hasRelationshipPerk, isRelationshipEventSeen, npcScheduleForDay, relationshipEventFlag, type GameState, type SimContext } from '@sim';
import { roundTripEqual } from '@sim/serialize';
import { buildRegistry } from '@content/registry';
import { itemCount, mutateItem } from '@sim/world/player';

function setup(seed = 1): { state: GameState; ctx: SimContext } {
  const reg = buildRegistry();
  const state = createWorld({ seed, width: 6, height: 6, content: reg, params: DEFAULT_BALANCE });
  const ctx = createSimContext(seed, reg, DEFAULT_BALANCE);
  return { state, ctx };
}

describe('NPC 社交与赠礼', () => {
  it('列出固定 NPC 并初始化好感记录', () => {
    const { state } = setup();
    const npcs = getNpcList(state);
    expect(npcs.map(n => n.id)).toEqual(['npc.wandering-cultivator', 'npc.herb-gatherer', 'npc.array-smith']);
    expect(npcs.find(n => n.id === 'npc.herb-gatherer')?.birthday).toEqual({ season: 'summer', day: 8 });
    expect(getRelationship(state, 'npc.herb-gatherer').affection).toBe(0);
  });

  it('偏好礼物增加好感、消耗物品、同日不可重复赠礼', () => {
    const { state } = setup();
    mutateItem(state.player, 'herb.dewroot', 2);

    const first = giveGift(state, 'npc.herb-gatherer', 'herb.dewroot');
    expect(first.ok).toBe(true);
    expect(first.affectionGain).toBe(80);
    expect(itemCount(state.player, 'herb.dewroot')).toBe(1);
    expect(getRelationship(state, 'npc.herb-gatherer').affection).toBe(80);
    expect(state.events.some(e => e.type === 'gift')).toBe(true);

    const second = giveGift(state, 'npc.herb-gatherer', 'herb.dewroot');
    expect(second.ok).toBe(false);
    expect(second.reason).toBe('今日已赠礼');
    expect(itemCount(state.player, 'herb.dewroot')).toBe(1);
  });

  it('普通喜欢与无偏好礼物给不同好感值', () => {
    const { state } = setup();
    mutateItem(state.player, 'seed.mossling', 1);
    mutateItem(state.player, 'item.water-pail', 1);
    expect(giveGift(state, 'npc.herb-gatherer', 'seed.mossling').affectionGain).toBe(35);
    state.day += 1;
    expect(giveGift(state, 'npc.herb-gatherer', 'item.water-pail').affectionGain).toBe(10);
  });

  it('生辰赠礼翻倍并在事件中标记', () => {
    const { state } = setup();
    state.season = 'summer';
    state.seasonDay = 8;
    mutateItem(state.player, 'herb.dewroot', 1);

    const result = giveGift(state, 'npc.herb-gatherer', 'herb.dewroot');
    expect(result).toMatchObject({ ok: true, affectionGain: 160, birthday: true });
    expect(state.events.at(-1)).toMatchObject({ type: 'gift', payload: { birthday: true, affectionGain: 160 } });
  });

  it('NPC 日程随季节派生，节日当天改到节日会场', () => {
    const { state } = setup();
    state.season = 'winter';
    state.seasonDay = 3;
    expect(npcScheduleForDay(state, 'npc.array-smith')).toMatchObject({ location: '遗迹门口', activity: '测绘旧阵残纹', birthday: false });

    state.activeEvent = { defId: 'event.winter-festival', displayName: '寒岁祭', daysLeft: 2, growthMod: 0.9, qiMod: 0.9 };
    expect(getNpcDailySchedules(state).map(entry => entry.location)).toEqual(['节日会场', '节日会场', '节日会场']);
    expect(npcScheduleForDay(state, 'npc.missing')).toBeNull;
  });

  it('自动选择 NPC 最佳可用礼物', () => {
    const { state } = setup();
    mutateItem(state.player, 'seed.mossling', 1);
    expect(bestGiftItemForNpc(state, 'npc.herb-gatherer')).toBe('seed.mossling');
    mutateItem(state.player, 'herb.dewroot', 1);
    expect(bestGiftItemForNpc(state, 'npc.herb-gatherer')).toBe('herb.dewroot');
  });

  it('give-gift 玩家动作接入动作系统，社交状态可存档往返', () => {
    const { state, ctx } = setup();
    mutateItem(state.player, 'item.spirit-stone', 1);
    applyAction(state, { kind: 'give-gift', npcId: 'npc.wandering-cultivator', itemId: 'item.spirit-stone' }, ctx);
    expect(getRelationship(state, 'npc.wandering-cultivator').affection).toBe(80);
    expect(roundTripEqual(state)).toBe(true);
  });

  it('好感达到门槛后派生一次性 NPC 关系事件', () => {
    const { state } = setup();
    mutateItem(state.player, 'herb.dewroot', 2);

    giveGift(state, 'npc.herb-gatherer', 'herb.dewroot');
    state.day += 1;
    giveGift(state, 'npc.herb-gatherer', 'herb.dewroot');

    const events = availableRelationshipEvents(state, 'npc.herb-gatherer');
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ id: 'herb-gatherer-160', npcName: '采药女', title: '药性护骨' });
    expect(events[0]?.lines.join('')).toContain('炼体');
    expect(hasRelationshipPerk(state, 'herb-gatherer-160')).toBe(false);

    const claimed = claimRelationshipEvent(state, 'npc.herb-gatherer');
    expect(claimed?.id).toBe('herb-gatherer-160');
    expect(isRelationshipEventSeen(state, 'herb-gatherer-160')).toBe(true);
    expect(hasRelationshipPerk(state, 'herb-gatherer-160')).toBe(true);
    expect(state.flags.has(relationshipEventFlag('herb-gatherer-160'))).toBe(true);
    expect(claimRelationshipEvent(state, 'npc.herb-gatherer')).toBeNull;
    expect(roundTripEqual(state)).toBe(true);
  });
});
