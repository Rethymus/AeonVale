import { describe, expect, it } from 'vitest';
import { buildRegistry } from '@content/registry';
import type { CommissionDef, MainlineQuestStatus, RuinChapterStatus, SpecialOrderStatus, StayingWorldIncidentDef } from '@sim';
import {
 activeSpecialOrderPanelPreview,
 archiveDonationFailureToastPresentation,
 archiveDonationToastPresentation,
 archiveEmptyToastPresentation,
 archiveMilestoneFailureToastPresentation,
 archiveMilestoneToastPresentation,
 commissionBoardEmptyToastPresentation,
 commissionCompleteToastPresentation,
 commissionIncompleteToastPresentation,
 commissionToastPresentation,
 dailyCommissionPanelPreview,
 dailySpecialOrderPanelPreview,
 mainlineQuestClaimFailureToastPresentation,
 mainlineQuestClaimToastPresentation,
 mainlineQuestUnavailableToastPresentation,
 mainlineQuestPanelPreview,
 ruinChapterClaimFailureToastPresentation,
 ruinChapterClaimToastPresentation,
 ruinChapterUnavailableToastPresentation,
 ruinChapterPanelPreview,
 specialOrderAcceptFailureToastPresentation,
 specialOrderAcceptToastPresentation,
 specialOrderClaimFailureToastPresentation,
 specialOrderClaimToastPresentation,
 specialOrderPendingToastPresentation,
 specialOrderProgressToastPresentation,
 specialOrderSubmitFailureToastPresentation,
 stayingWorldIncidentPanelPreview,
 stayingWorldIncidentResolveFailureToastPresentation,
 stayingWorldIncidentResolveToastPresentation,
} from '@app/commissionPreview';

describe('commission preview', () => {
 const reg = buildRegistry();

it('prefers issuer location art for daily commission previews', () => {
 const commission: CommissionDef = {
 id: 'commission.dewroot-tonic',
 title: '露根草调息汤',
 npcId: 'npc.herb-gatherer',
 stageMin: 0,
 request: { itemId: 'herb.dewroot', count: 2 },
 rewardSpiritStones: 3,
 affectionReward: 45,
 };

expect(dailyCommissionPanelPreview(commission, reg)).toEqual({
 title: '露根草调息汤',
 details: '公告委托\n采药女托付｜露根药圃交付\n露根草 × 2\n今日可交｜酬 3',
 assetId: 'loc.herb-plot',
 });
 });

it('adds carry-status guidance to daily commission previews when current inventory is known', () => {
 const commission: CommissionDef = {
 id: 'commission.dewroot-tonic',
 title: '露根草调息汤',
 npcId: 'npc.herb-gatherer',
 stageMin: 0,
 request: { itemId: 'herb.dewroot', count: 2 },
 rewardSpiritStones: 3,
 affectionReward: 45,
 };

expect(dailyCommissionPanelPreview(commission, reg, '公告委托', 1)).toEqual({
 title: '露根草调息汤',
 details: '公告委托\n采药女托付｜露根药圃交付\n露根草 × 2\n今日可交｜酬 3\n现持 1/2｜还差 1',
 assetId: 'loc.herb-plot',
 });
 });

it('falls back to item icon when issuer location and npc portrait mappings are unavailable', () => {
 const commission: CommissionDef = {
 id: 'commission.debug-fallback',
 title: '测试委托',
 npcId: 'npc.unknown-issuer',
 stageMin: 0,
 request: { itemId: 'herb.dewroot', count: 1 },
 rewardSpiritStones: 5,
 affectionReward: 10,
 };

expect(dailyCommissionPanelPreview(commission, reg).assetId).toBe('icon.herb.dewroot');
 });

it('prefers location art for preview-only npc issuers on commission entry surfaces', () => {
 const commission: CommissionDef = {
 id: 'commission.tea-shed-rumor',
 title: '茶棚托付',
 npcId: 'npc.tea-shed-elder',
 stageMin: 0,
 request: { itemId: 'herb.dewroot', count: 1 },
 rewardSpiritStones: 2,
 affectionReward: 5,
 };

expect(dailyCommissionPanelPreview(commission, reg).assetId).toBe('loc.tea-shed');
 });

it('keeps archive donation and milestone flows anchored to ruin-gate as a place thread', () => {
 expect(archiveEmptyToastPresentation()).toEqual({
 message: '藏经阁暂无可捐条目',
 assetId: 'loc.ruin-gate',
 });

expect(ruinChapterUnavailableToastPresentation()).toEqual({
 message: '当前遗迹章节已尽',
 assetId: 'loc.ruin-gate',
 });

expect(mainlineQuestUnavailableToastPresentation()).toEqual({
 message: '当前主线已告一段落',
 assetId: 'loc.ruin-gate',
 });

expect(archiveDonationFailureToastPresentation({ itemId: 'item.recipe-fragment', count: 1 }, reg)).toEqual({
 message: '藏经未成：需残卷×1',
 assetId: 'loc.ruin-gate',
 });

expect(archiveDonationToastPresentation('残卷启蒙', { itemId: 'item.spirit-stone', count: 4 }, reg)).toEqual({
 message: '藏经：残卷启蒙，灵石×4',
 assetId: 'icon.item.spirit-stone',
 });

expect(archiveMilestoneToastPresentation('一架初成', { itemId: 'item.spirit-compost', count: 2 }, reg)).toEqual({
 message: '藏经里程碑：一架初成，灵壤肥×2',
 assetId: 'icon.item.spirit-compost',
 });

expect(archiveMilestoneFailureToastPresentation()).toEqual({
 message: '藏经里程碑未成：储物戒已满',
 assetId: 'loc.ruin-gate',
 });

expect(archiveDonationToastPresentation('凡骨初记', { bodyFoundation: 200, willpower: 120 }, reg)).toEqual({
 message: '藏经：凡骨初记，体魄+0、意志+0',
 assetId: 'loc.ruin-gate',
 });
 });

it('keeps commission board empty states anchored to their governing place threads', () => {
 expect(commissionBoardEmptyToastPresentation()).toEqual({
 message: '公告板眼下暂无委托｜先回农庄、集市或人物动线推进',
 assetId: 'loc.farmstead',
 });

expect(commissionBoardEmptyToastPresentation(true)).toEqual({
 message: '镇守告示今日暂无差事｜先巡农庄与会场动线，稍后再看',
 assetId: 'loc.ruin-gate',
 });
 });

it('maps preview-only special-order issuers to their location art before falling back to portraits', () => {
 const orders: SpecialOrderStatus[] = [
 {
 id: 'special-order.market-request',
 title: '市集代采',
 npcId: 'npc.market-merchant',
 stageMin: 0,
 durationDays: 5,
 request: { itemId: 'herb.dewroot', count: 2 },
 rewardSpiritStones: 6,
 affectionReward: 20,
 active: false,
 completed: false,
 progress: 0,
 remaining: 2,
 daysLeft: 5,
 available: true,
 },
 {
 id: 'special-order.drying-yard-batch',
 title: '晒坊补料',
 npcId: 'npc.processing-artisan',
 stageMin: 0,
 durationDays: 6,
 request: { itemId: 'item.broken-talisman', count: 1 },
 rewardSpiritStones: 7,
 affectionReward: 25,
 active: false,
 completed: false,
 progress: 0,
 remaining: 1,
 daysLeft: 6,
 available: true,
 },
 {
 id: 'special-order.ruin-watch',
 title: '谷口巡守',
 npcId: 'npc.patrol-guard',
 stageMin: 0,
 durationDays: 4,
 request: { itemId: 'item.recipe-fragment', count: 1 },
 rewardSpiritStones: 8,
 affectionReward: 30,
 active: true,
 completed: false,
 progress: 0,
 remaining: 1,
 daysLeft: 4,
 available: true,
 },
 ];

expect(dailySpecialOrderPanelPreview(orders[0]!, reg).assetId).toBe('loc.valley-market');
 expect(dailySpecialOrderPanelPreview(orders[1]!, reg).assetId).toBe('loc.drying-yard');
 expect(activeSpecialOrderPanelPreview(orders[2]!, reg).assetId).toBe('loc.ruin-gate');
 });

it('builds active special order summary with progress and issuer location', () => {
 const order: SpecialOrderStatus = {
 id: 'special-order.array-scrap',
 title: '旧阵残件清点',
 npcId: 'npc.array-smith',
 stageMin: 1,
 durationDays: 10,
 request: { itemId: 'item.broken-talisman', count: 3 },
 rewardSpiritStones: 18,
 affectionReward: 120,
 willpowerReward: 500,
 active: true,
 completed: false,
 progress: 2,
 remaining: 1,
 daysLeft: 6,
 available: true,
 };

expect(activeSpecialOrderPanelPreview(order, reg, '镇守事务')).toEqual({
 title: '旧阵残件清点',
 details: '镇守事务\n阵匠老陆托付｜遗迹门口交付\n破损法宝 × 3\n已交 2/3｜余 1｜酬 18',
 assetId: 'loc.ruin-gate',
 });
 });

it('adds carry-status guidance to active special orders when player can make partial progress now', () => {
 const order: SpecialOrderStatus = {
 id: 'special-order.array-scrap',
 title: '旧阵残件清点',
 npcId: 'npc.array-smith',
 stageMin: 1,
 durationDays: 10,
 request: { itemId: 'item.broken-talisman', count: 3 },
 rewardSpiritStones: 18,
 affectionReward: 120,
 willpowerReward: 500,
 active: true,
 completed: false,
 progress: 1,
 remaining: 2,
 daysLeft: 6,
 available: true,
 };

expect(activeSpecialOrderPanelPreview(order, reg, '特别订单', 1)).toEqual({
 title: '旧阵残件清点',
 details: '特别订单\n阵匠老陆托付｜遗迹门口交付\n破损法宝 × 3\n已交 1/3｜余 2｜酬 18\n现持 1｜本次最多再交 1',
 assetId: 'loc.ruin-gate',
 });
 });

it('marks active special orders as ready to claim when all items are submitted', () => {
 const order: SpecialOrderStatus = {
 id: 'special-order.beast-watch',
 title: '守田兽口粮试验',
 npcId: 'npc.wandering-cultivator',
 stageMin: 1,
 durationDays: 8,
 request: { itemId: 'item.beast-core', count: 2 },
 rewardSpiritStones: 16,
 affectionReward: 110,
 bodyFoundationReward: 700,
 active: true,
 completed: false,
 progress: 2,
 remaining: 0,
 daysLeft: 4,
 available: true,
 };

expect(activeSpecialOrderPanelPreview(order, reg)).toEqual({
 title: '守田兽口粮试验',
 details: '特别订单\n游方散修托付｜残脉入口交付\n妖兽内丹 × 2\n已齐，可回执领奖｜酬 16',
 assetId: 'loc.spirit-vein',
 });
 });

it('keeps beast-core daily commissions location-first in both copy and art', () => {
 const commission: CommissionDef = {
 id: 'commission.beast-core-sample',
 title: '妖兽内丹样本',
 npcId: 'npc.wandering-cultivator',
 stageMin: 1,
 request: { itemId: 'item.beast-core', count: 1 },
 rewardSpiritStones: 7,
 affectionReward: 55,
 };

expect(dailyCommissionPanelPreview(commission, reg)).toEqual({
 title: '妖兽内丹样本',
 details: '公告委托\n游方散修托付｜残脉入口交付\n妖兽内丹 × 1\n今日可交｜酬 7',
 assetId: 'loc.spirit-vein',
 });
 });

it('keeps beast-core pending special orders aligned to spirit-vein before acceptance', () => {
 const order: SpecialOrderStatus = {
 id: 'special-order.beast-watch',
 title: '守田兽口粮试验',
 npcId: 'npc.wandering-cultivator',
 stageMin: 1,
 durationDays: 8,
 request: { itemId: 'item.beast-core', count: 2 },
 rewardSpiritStones: 16,
 affectionReward: 110,
 bodyFoundationReward: 700,
 active: false,
 completed: false,
 progress: 0,
 remaining: 2,
 daysLeft: 8,
 available: true,
 };

expect(dailySpecialOrderPanelPreview(order, reg)).toEqual({
 title: '守田兽口粮试验',
 details: '待接特别订单\n游方散修托付｜残脉入口交付\n妖兽内丹 × 2\n待接｜限 8 日｜酬 16',
 assetId: 'loc.spirit-vein',
 });
 });

it('builds pending special order summary with duration line and issuer location-first art', () => {
 const order: SpecialOrderStatus = {
 id: 'special-order.herb-stockpile',
 title: '淬体药草储备',
 npcId: 'npc.herb-gatherer',
 stageMin: 0,
 durationDays: 7,
 request: { itemId: 'herb.mossling', count: 10 },
 rewardSpiritStones: 12,
 affectionReward: 100,
 bodyFoundationReward: 500,
 active: false,
 completed: false,
 progress: 0,
 remaining: 10,
 daysLeft: 7,
 available: true,
 };

expect(dailySpecialOrderPanelPreview(order, reg)).toEqual({
 title: '淬体药草储备',
 details: '待接特别订单\n采药女托付｜露根药圃交付\n凡间青苔 × 10\n待接｜限 7 日｜酬 12',
 assetId: 'loc.creek-field',
 });
 });

it('marks pending special orders as immediately turn-in ready when inventory already covers the request', () => {
 const order: SpecialOrderStatus = {
 id: 'special-order.herb-stockpile',
 title: '淬体药草储备',
 npcId: 'npc.herb-gatherer',
 stageMin: 0,
 durationDays: 7,
 request: { itemId: 'herb.mossling', count: 10 },
 rewardSpiritStones: 12,
 affectionReward: 100,
 bodyFoundationReward: 500,
 active: false,
 completed: false,
 progress: 0,
 remaining: 10,
 daysLeft: 7,
 available: true,
 };

expect(dailySpecialOrderPanelPreview(order, reg, '待接特别订单', 12)).toEqual({
 title: '淬体药草储备',
 details: '待接特别订单\n采药女托付｜露根药圃交付\n凡间青苔 × 10\n待接｜限 7 日｜酬 12\n现持 12/10｜已齐，可直接交付',
 assetId: 'loc.creek-field',
 });
 });

it('keeps staying-world incident previews anchored to the incident-driving location', () => {
 const incident: StayingWorldIncidentDef = {
 id: 'incident.array-fray',
 title: '残脉阵脚松动',
 summary: '阵脚需要维护。',
 itemId: 'item.broken-talisman',
 count: 1,
 pressureRelief: 7000,
 };

expect(stayingWorldIncidentPanelPreview(incident, reg)).toEqual({
 title: '残脉阵脚松动',
 details: '镇守事件\n破损法宝 × 1\n待处置｜缓解护田压力',
 assetId: 'loc.ruin-gate',
 });
 });

it('falls back to the farmstead location for unmapped staying-world incidents before dropping to item art', () => {
 const incident: StayingWorldIncidentDef = {
 id: 'incident.custom-watch',
 title: '村口守望加固',
 summary: '需要临时补上几件守境物资。',
 itemId: 'item.broken-talisman',
 count: 1,
 pressureRelief: 5000,
 };

expect(stayingWorldIncidentPanelPreview(incident, reg)).toEqual({
 title: '村口守望加固',
 details: '镇守事件\n破损法宝 × 1\n待处置｜缓解护田压力',
 assetId: 'loc.farmstead',
 });
 });

it('builds commission toast presentations from preview details and asset', () => {
 const order: SpecialOrderStatus = {
 id: 'special-order.array-scrap',
 title: '旧阵残件清点',
 npcId: 'npc.array-smith',
 stageMin: 1,
 durationDays: 10,
 request: { itemId: 'item.broken-talisman', count: 3 },
 rewardSpiritStones: 18,
 affectionReward: 120,
 willpowerReward: 500,
 active: true,
 completed: false,
 progress: 2,
 remaining: 1,
 daysLeft: 6,
 available: true,
 };

expect(commissionToastPresentation(
 activeSpecialOrderPanelPreview(order, reg, '镇守事务', 1),
 '镇守告示',
 '空格/E/回车提交或领奖·Esc返回',
 )).toEqual({
 message: '镇守告示：旧阵残件清点｜阵匠老陆托付｜遗迹门口交付｜破损法宝 × 3｜已交 2/3｜余 1｜酬 18｜现持 1｜本次可补齐剩余 1｜空格/E/回车提交或领奖·Esc返回',
 assetId: 'loc.ruin-gate',
 });
 });

it('keeps the preview title while flattening remaining lines for board toasts', () => {
 const quest: MainlineQuestStatus = {
 id: 'mainline.herb-path',
 title: '药草入骨',
 description: '凡人不能吞吐灵力，就让灵草先入手、再入炉、最后入骨。',
 objective: '持有青苔与露根草各 1 份，证明灵田已能支撑早期淬体。',
 reward: { itemId: 'item.recipe-fragment', count: 1, willpower: 120 },
 claimed: false,
 available: true,
 completed: false,
 current: true,
 isAvailable: () => true,
 isComplete: () => false,
 };

expect(commissionToastPresentation(
 mainlineQuestPanelPreview(quest, reg),
 '告示板',
 '空格/E/回车推进·Esc返回',
 )).toEqual({
 message: '告示板：药草入骨｜持有青苔与露根草各 1 份，证明灵田已能支撑早期淬体。｜当前推进中｜空格/E/回车推进·Esc返回',
 assetId: 'loc.herb-plot',
 });
 });

it('prefers herb-plot location art for herb-path mainline board previews', () => {
 const quest: MainlineQuestStatus = {
 id: 'mainline.herb-path',
 title: '药草入骨',
 description: '凡人不能吞吐灵力，就让灵草先入手、再入炉、最后入骨。',
 objective: '持有青苔与露根草各 1 份，证明灵田已能支撑早期淬体。',
 reward: { itemId: 'item.recipe-fragment', count: 1, willpower: 120 },
 claimed: false,
 available: true,
 completed: false,
 current: true,
 isAvailable: () => true,
 isComplete: () => false,
 };

expect(mainlineQuestPanelPreview(quest, reg)).toEqual({
 title: '药草入骨',
 details: '主线任务\n持有青苔与露根草各 1 份，证明灵田已能支撑早期淬体。\n当前推进中',
 assetId: 'loc.herb-plot',
 });
 });

it('prefers ruin-gate location art for archive-clue mainline board previews', () => {
 const quest: MainlineQuestStatus = {
 id: 'mainline.archive-clue',
 title: '残篇问路',
 description: '体修既要能打，也要知道自己在打什么。先去旧阵边缘摸清残篇线索。',
 objective: '前往遗迹门口推进旧阵线索，拿到第一份残篇。',
 reward: { itemId: 'item.array-core', count: 1, willpower: 180 },
 claimed: false,
 available: true,
 completed: false,
 current: true,
 isAvailable: () => true,
 isComplete: () => false,
 };

expect(mainlineQuestPanelPreview(quest, reg)).toEqual({
 title: '残篇问路',
 details: '主线任务\n前往遗迹门口推进旧阵线索，拿到第一份残篇。\n当前推进中',
 assetId: 'loc.ruin-gate',
 });
 });

it('prefers creek-field location art for valley-order mainline board previews', () => {
 const quest: MainlineQuestStatus = {
 id: 'mainline.valley-order',
 title: '山谷立名',
 description: '体修在低境界常被视作粗鄙蛮力，先靠做事立名，再让山谷的人承认你不是废物。',
 objective: '完成特别订单“淬体药草储备”，证明你已能稳定供应炼体资源。',
 reward: { itemId: 'item.array-core', count: 1, willpower: 240 },
 claimed: false,
 available: true,
 completed: false,
 current: true,
 isAvailable: () => true,
 isComplete: () => false,
 };

expect(mainlineQuestPanelPreview(quest, reg)).toEqual({
 title: '山谷立名',
 details: '主线任务\n完成特别订单“淬体药草储备”，证明你已能稳定供应炼体资源。\n当前推进中',
 assetId: 'loc.creek-field',
 });
 });

it('falls back to ruin-gate location art for unknown mainline board previews instead of reward icons', () => {
 const quest: MainlineQuestStatus = {
 id: 'mainline.debug-future-path',
 title: '后续旧阵线',
 description: '测试未来新增主线时的默认入口语义。',
 objective: '继续追查旧阵后的去向。',
 reward: { itemId: 'item.array-core', count: 1, willpower: 320 },
 claimed: false,
 available: true,
 completed: false,
 current: true,
 isAvailable: () => true,
 isComplete: () => false,
 };

expect(mainlineQuestPanelPreview(quest, reg)).toEqual({
 title: '后续旧阵线',
 details: '主线任务\n继续追查旧阵后的去向。\n当前推进中',
 assetId: 'loc.ruin-gate',
 });
 });

it('keeps completed mainline board previews anchored to the quest-driving location', () => {
 const quest: MainlineQuestStatus = {
 id: 'mainline.mortal-discipline',
 title: '凡骨开篇',
 description: '以穿越者最朴素的苦练法硬扛凡身，把这具被判无灵根的凡骨先练到能承药承痛。',
 objective: '累计完成四项基础苦练，让体魄达到 400、耐力达到 80、意志达到 80。',
 reward: { itemId: 'item.spirit-compost', count: 2, bodyFoundation: 200 },
 claimed: false,
 available: true,
 completed: true,
 current: true,
 isAvailable: () => true,
 isComplete: () => true,
 };

expect(mainlineQuestPanelPreview(quest, reg)).toEqual({
 title: '凡骨开篇',
 details: '主线任务\n累计完成四项基础苦练，让体魄达到 400、耐力达到 80、意志达到 80。\n已满足条件，可领取奖励',
 assetId: 'loc.farmstead',
 });
 });

it('prefers ruin-gate location art for in-progress ruin chapter board previews', () => {
 const chapter: RuinChapterStatus = {
 id: 'ruin-chapter.array-echo',
 title: '残阵回音',
 description: '第六到第十层开始出现断裂阵纹，像是前人故意给后来者留下的逆推题面。',
 objective: '把遗迹推进至第 10 层，拿到能支撑体修近战控场的残阵线索。',
 floorStart: 6,
 floorEnd: 10,
 reward: { itemId: 'item.array-core', count: 1, willpower: 260 },
 claimed: false,
 available: true,
 completed: false,
 current: true,
 isAvailable: () => true,
 };

expect(ruinChapterPanelPreview(chapter, 7, reg)).toEqual({
 title: '残阵回音',
 details: '遗迹章节\n把遗迹推进至第 10 层，拿到能支撑体修近战控场的残阵线索。\n遗迹 7/10｜目标 6-10 层',
 assetId: 'loc.ruin-gate',
 });
 });

it('keeps completed ruin chapter board previews anchored to ruin-gate location art', () => {
 const chapter: RuinChapterStatus = {
 id: 'ruin-chapter.array-echo',
 title: '残阵回音',
 description: '第六到第十层开始出现断裂阵纹，像是前人故意给后来者留下的逆推题面。',
 objective: '把遗迹推进至第 10 层，拿到能支撑体修近战控场的残阵线索。',
 floorStart: 6,
 floorEnd: 10,
 reward: { itemId: 'item.array-core', count: 1, willpower: 260 },
 claimed: false,
 available: true,
 completed: true,
 current: true,
 isAvailable: () => true,
 };

expect(ruinChapterPanelPreview(chapter, 10, reg)).toEqual({
 title: '残阵回音',
 details: '遗迹章节\n把遗迹推进至第 10 层，拿到能支撑体修近战控场的残阵线索。\n已达 10 层，可领取章节奖励',
 assetId: 'loc.ruin-gate',
 });
 });

it('keeps completed mainline and ruin claim result toasts on the board-driving location asset', () => {
 const completedMainline: MainlineQuestStatus = {
 id: 'mainline.mortal-discipline',
 title: '凡骨开篇',
 description: '以穿越者最朴素的苦练法硬扛凡身，把这具被判无灵根的凡骨先练到能承药承痛。',
 objective: '累计完成四项基础苦练，让体魄达到 400、耐力达到 80、意志达到 80。',
 reward: { itemId: 'item.spirit-compost', count: 2, bodyFoundation: 200 },
 claimed: false,
 available: true,
 completed: true,
 current: true,
 isAvailable: () => true,
 isComplete: () => true,
 };

expect(mainlineQuestClaimToastPresentation(completedMainline, reg)).toEqual({
 message: '主线完成：凡骨开篇',
 assetId: 'loc.farmstead',
 });
 expect(mainlineQuestClaimFailureToastPresentation(completedMainline, reg)).toEqual({
 message: '主线领取失败：凡骨开篇',
 assetId: 'loc.farmstead',
 });

const completedChapter: RuinChapterStatus = {
 id: 'ruin-chapter.array-echo',
 title: '残阵回音',
 description: '第六到第十层开始出现断裂阵纹，像是前人故意给后来者留下的逆推题面。',
 objective: '把遗迹推进至第 10 层，拿到能支撑体修近战控场的残阵线索。',
 floorStart: 6,
 floorEnd: 10,
 reward: { itemId: 'item.array-core', count: 1, willpower: 260 },
 claimed: false,
 available: true,
 completed: true,
 current: true,
 isAvailable: () => true,
 };

expect(ruinChapterClaimToastPresentation(completedChapter, 10, reg)).toEqual({
 message: '遗迹章节完成：残阵回音',
 assetId: 'loc.ruin-gate',
 });
 expect(ruinChapterClaimFailureToastPresentation(completedChapter, 10, reg)).toEqual({
 message: '遗迹章节领取失败：残阵回音',
 assetId: 'loc.ruin-gate',
 });
 });

it('switches commission completion toasts to spirit-stone reward art while keeping incomplete toasts on the thread location', () => {
 const commission: CommissionDef = {
 id: 'commission.dewroot-tonic',
 title: '露根草调息汤',
 npcId: 'npc.herb-gatherer',
 stageMin: 0,
 request: { itemId: 'herb.dewroot', count: 2 },
 rewardSpiritStones: 3,
 affectionReward: 45,
 };

expect(commissionCompleteToastPresentation(commission, reg)).toEqual({
 message: '完成委托：露根草调息汤｜得灵石×3',
 assetId: 'icon.item.spirit-stone',
 });

expect(commissionIncompleteToastPresentation(commission, reg, true)).toEqual({
 message: '镇守差事未完成：露根草调息汤',
 assetId: 'loc.herb-plot',
 });
 });

it('keeps special-order progress states location-led but switches successful claim toasts to spirit-stone reward art', () => {
 const activeOrder: SpecialOrderStatus = {
 id: 'special-order.array-scrap',
 title: '旧阵残件清点',
 npcId: 'npc.array-smith',
 stageMin: 1,
 durationDays: 10,
 request: { itemId: 'item.broken-talisman', count: 3 },
 rewardSpiritStones: 18,
 affectionReward: 120,
 willpowerReward: 500,
 active: true,
 completed: false,
 progress: 1,
 remaining: 2,
 daysLeft: 6,
 available: true,
 };

expect(specialOrderPendingToastPresentation(activeOrder, reg, true)).toEqual({
 message: '镇守事务待交：旧阵残件清点',
 assetId: 'loc.ruin-gate',
 });

expect(specialOrderProgressToastPresentation(activeOrder, 2, 3, reg)).toEqual({
 message: '特别订单进度：旧阵残件清点｜2/3',
 assetId: 'loc.ruin-gate',
 });

expect(specialOrderSubmitFailureToastPresentation(activeOrder, reg)).toEqual({
 message: '特别订单未提交：旧阵残件清点',
 assetId: 'loc.ruin-gate',
 });

expect(specialOrderClaimToastPresentation(activeOrder, reg)).toEqual({
 message: '完成特别订单：旧阵残件清点｜得灵石×18',
 assetId: 'icon.item.spirit-stone',
 });

expect(specialOrderClaimFailureToastPresentation(activeOrder, reg, true)).toEqual({
 message: '镇守事务领奖失败：旧阵残件清点',
 assetId: 'loc.ruin-gate',
 });
 });

it('reuses pending special order art for accept result toasts', () => {
 const pendingOrder: SpecialOrderStatus = {
 id: 'special-order.herb-stockpile',
 title: '淬体药草储备',
 npcId: 'npc.herb-gatherer',
 stageMin: 0,
 durationDays: 7,
 request: { itemId: 'herb.mossling', count: 10 },
 rewardSpiritStones: 12,
 affectionReward: 100,
 bodyFoundationReward: 500,
 active: false,
 completed: false,
 progress: 0,
 remaining: 10,
 daysLeft: 7,
 available: true,
 };

expect(specialOrderAcceptToastPresentation(pendingOrder, reg)).toEqual({
 message: '接取特别订单：淬体药草储备｜限7日',
 assetId: 'loc.creek-field',
 });

expect(specialOrderAcceptFailureToastPresentation(pendingOrder, reg)).toEqual({
 message: '无法接取特别订单：淬体药草储备',
 assetId: 'loc.creek-field',
 });
 });

it('reuses incident preview art for resolve result toasts', () => {
 const incident: StayingWorldIncidentDef = {
 id: 'incident.array-fray',
 title: '残脉阵脚松动',
 summary: '阵脚需要维护。',
 itemId: 'item.broken-talisman',
 count: 1,
 pressureRelief: 7000,
 };

expect(stayingWorldIncidentResolveToastPresentation(incident, reg)).toEqual({
 message: '处置镇守事件：残脉阵脚松动',
 assetId: 'loc.ruin-gate',
 });

expect(stayingWorldIncidentResolveToastPresentation(incident, reg, { beastId: 4 })).toEqual({
 message: '处置镇守事件：残脉阵脚松动',
 assetId: 'sprite.guard-beast-boar',
 });

expect(stayingWorldIncidentResolveFailureToastPresentation(incident, reg)).toEqual({
 message: '镇守事件未处置：残脉阵脚松动',
 assetId: 'loc.ruin-gate',
 });
 });

it('reuses mainline and ruin preview art for claim result toasts', () => {
 const quest: MainlineQuestStatus = {
 id: 'mainline.archive-clue',
 title: '残篇问路',
 description: '体修既要能打，也要知道自己在打什么。先去旧阵边缘摸清残篇线索。',
 objective: '前往遗迹门口推进旧阵线索，拿到第一份残篇。',
 reward: { itemId: 'item.array-core', count: 1, willpower: 180 },
 claimed: false,
 available: true,
 completed: false,
 current: true,
 isAvailable: () => true,
 isComplete: () => false,
 };

expect(mainlineQuestClaimToastPresentation(quest, reg, '山谷立名')).toEqual({
 message: '主线推进：残篇问路 → 山谷立名',
 assetId: 'loc.ruin-gate',
 });

expect(mainlineQuestClaimFailureToastPresentation(quest, reg)).toEqual({
 message: '主线未成：残篇问路',
 assetId: 'loc.ruin-gate',
 });

const chapter: RuinChapterStatus = {
 id: 'ruin-chapter.array-echo',
 title: '残阵回音',
 description: '第六到第十层开始出现断裂阵纹，像是前人故意给后来者留下的逆推题面。',
 objective: '把遗迹推进至第 10 层，拿到能支撑体修近战控场的残阵线索。',
 floorStart: 6,
 floorEnd: 10,
 reward: { itemId: 'item.array-core', count: 1, willpower: 260 },
 claimed: false,
 available: true,
 completed: false,
 current: true,
 isAvailable: () => true,
 };

expect(ruinChapterClaimToastPresentation(chapter, 7, reg, {
 title: '兽痕留书',
 floorStart: 11,
 floorEnd: 15,
 })).toEqual({
 message: '遗迹推进：残阵回音 → 兽痕留书（11-15层）',
 assetId: 'loc.ruin-gate',
 });

expect(ruinChapterClaimFailureToastPresentation(chapter, 7, reg)).toEqual({
 message: '遗迹章节未成：残阵回音',
 assetId: 'loc.ruin-gate',
 });
 });
});
