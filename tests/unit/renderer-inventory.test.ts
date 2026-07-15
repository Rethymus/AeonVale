import { describe, expect, it } from 'vitest';
import { buildRegistry } from '@content/registry';
import { createSimContext, createWorld, DEFAULT_BALANCE } from '@sim';
import { mutateItem, mutateQualityItem } from '@sim/world/player';
import { renderCultivationOverview, renderInventory, renderPostAscensionGoals, renderShippingBin, renderStorage } from '@render/renderer';

describe('背包渲染', () => {
 it('显示品质灵草批次并计入容量占用', () => {
 const reg = buildRegistry();
 const state = createWorld({ seed: 9, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
 mutateItem(state.player, 'seed.mossling', 2);
 mutateQualityItem(state.player, 'herb.mossling', 'spirit', 3);
 mutateQualityItem(state.player, 'herb.dewroot', 'treasure', 1);

const text = renderInventory(state, reg);

expect(text).toContain('—— 背包 —— 3/16');
 expect(text).toContain('[品质灵草]');
 expect(text).toContain('青苔·灵品 ×3');
 expect(text).toContain('露根草·珍品 ×1');
 expect(text).toContain('[种子]');
 });

it('显示仓库容量、普通物资和品质灵草批次', () => {
 const reg = buildRegistry();
 const state = createWorld({ seed: 10, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
 state.storage.inventory['item.spirit-stone'] = { itemId: 'item.spirit-stone', count: 5 };
 state.storage.qualityInventory.spirit = { 'herb.mossling': 2 };

const text = renderStorage(state, reg);

expect(text).toContain('—— 仓库 —— 2/48');
 expect(text).toContain('[物资]');
 expect(text).toContain('灵石 ×5');
 expect(text).toContain('[品质灵草]');
 expect(text).toContain('青苔·灵品 ×2');
 });

it('显示出货箱普通物品、品质批次与预计灵石', () => {
 const reg = buildRegistry();
 const state = createWorld({ seed: 11, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
 const ctx = createSimContext(11, reg, DEFAULT_BALANCE);
 state.shippingBin['item.dried-herb'] = 2;
 state.qualityShippingBin.spirit = { 'herb.mossling': 3 };

const text = renderShippingBin(state, reg, ctx);

expect(text).toContain('—— 出货箱 —— 预计灵石 16');
 expect(text).toContain('晾晒灵草 ×2 @2 = 4');
 expect(text).toContain('青苔·灵品 ×3 @4 = 12');
 });

it('在出货箱中标记当日热需物品的溢价来源', () => {
 const reg = buildRegistry();
 const state = createWorld({ seed: 12, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
 const ctx = createSimContext(12, reg, DEFAULT_BALANCE);
 state.player.stage = 1;
 state.shippingBin['herb.dewroot'] = 1;
 state.shippingBin['herb.mossling'] = 1;

const text = renderShippingBin(state, reg, ctx);

expect(text).toContain('露根草 ×1 @3 = 3 〔委托热需+2〕');
 expect(text).toContain('凡间青苔 ×1 @3 = 3 〔订单热需+2〕');
 });

it('留世后显示镇守与闲居双线目标摘要', () => {
 const reg = buildRegistry();
 const state = createWorld({ seed: 12, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
 state.player.stage = 7;
 state.postAscension.mode = 'stayed-in-world';
 state.postAscension.ascensionDay = state.day - 3;

const text = renderPostAscensionGoals(state);

expect(text).toContain('—— 留世目标 ——');
 expect(text).toContain('[闲居] 旧茶棚歇脚');
 expect(text).toContain('[闲居] 暖棚养护');
 expect(text).toContain('[镇守]');
 });

it('显示功法面板的体修根基、寿元与引劫状态', () => {
 const reg = buildRegistry();
 const state = createWorld({ seed: 13, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
 const ctx = createSimContext(13, reg, DEFAULT_BALANCE);
 state.player.stage = 1;
 state.player.bodyFoundation = DEFAULT_BALANCE.bodyCultivation.foundationCap[0]!;
 state.player.endurance = 12_000;
 state.player.willpower = 8_000;
 state.player.heavenDebt = 3_000;
 state.player.daoAttention = 5_000;

const text = renderCultivationOverview(state, ctx);

expect(text).toContain('—— 功法 / 修炼 ——');
 expect(text).toContain('《偷天换劫诀》');
 expect(text).toContain('寿元：840日');
 expect(text).toContain('命数：因果债 3｜天道注视 5');
 expect(text).toContain('劫势：可主动引劫');
 });

it('留世胜后会在功法面板中明确标记胜后存档', () => {
 const reg = buildRegistry();
 const state = createWorld({ seed: 14, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
 const ctx = createSimContext(14, reg, DEFAULT_BALANCE);
 state.player.stage = 7;
 state.postAscension.mode = 'stayed-in-world';
 state.postAscension.ascensionDay = state.day;
 state.postAscension.victoryRecorded = true;

const text = renderCultivationOverview(state, ctx);

expect(text).toContain('命数：已登天门｜留世守境');
 expect(text).toContain('胜后存档：已完成飞升，可继续留世经营');
 });
});
