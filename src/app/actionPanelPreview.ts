import type { ContentRegistry } from '@content/defs';
import type { NpcDailySchedule, NpcQuestStatus, RelationshipState, SimContext } from '@sim';
import { canShipItem, farmExpansionTier, getAvailableUpgrades, storageUsed, type GameState } from '@sim';
import type { FarmActionKind } from './interactionPanels';
import { itemIconAssetId } from './itemIcons';
import { npcPortraitAssetId, previewNpcPortraitAssetId } from './locationPreview';
import { upgradePreviewAssetId } from './facilityPanelPreview';
import { farmsteadRootContextAssetId, getFarmsteadFocus } from './farmsteadFocus';

export interface ActionPanelPreview {
  title: string;
  details: string;
  assetId?: string;
}

export interface ActionMenuToastPresentation {
  message: string;
  assetId?: string;
}

export interface NpcPanelToastPresentation {
  message: string;
  assetId?: string;
}

const NPC_QUEST_OBJECTIVE_ASSET_IDS: Readonly<Record<string, string>> = {
  'npc-quest.herb-gatherer-bone-guard': 'sprite.npc.herb-gatherer',
  'npc-quest.herb-gatherer-thunder-brew': 'sprite.npc.herb-gatherer',
  'npc-quest.array-smith-circle-step': 'sprite.npc.array-smith',
  'npc-quest.array-smith-ruin-proof': 'sprite.npc.array-smith',
  'npc-quest.wandering-cultivator-market-path': 'sprite.npc.wandering-cultivator',
  'npc-quest.wandering-cultivator-field-watch': 'sprite.npc.wandering-cultivator'
};

function carriedInventorySlots(state: GameState): number {
  return Object.values(state.player.inventory).filter(slot => (slot?.count ?? 0) > 0).length;
}

function storageFreeSlots(state: GameState): number {
  return Math.max(0, state.storage.capacity - storageUsed(state.storage));
}

function readyFacilityCount(state: GameState): number {
  return Array.from(state.facilities.values()).filter(facility => facility.job?.daysRemaining === 0).length;
}

function nextUpgradeAssetId(state: GameState): string {
  const nextUpgrade = getAvailableUpgrades(state)[0];
  return nextUpgrade ? upgradePreviewAssetId(nextUpgrade) : farmsteadRootContextAssetId(state);
}

function shippableNormalEntryCount(state: GameState, ctx: SimContext): number {
  return Object.entries(state.player.inventory).filter(([itemId, slot]) => (slot?.count ?? 0) > 0 && canShipItem(ctx, itemId)).length;
}

function queuedNormalShippingEntryCount(state: GameState): number {
  return Object.values(state.shippingBin).filter(count => count > 0).length;
}

function carriedQualityEntryCount(state: GameState): number {
  return Object.values(state.player.qualityInventory).reduce((sum, batch) => sum + Object.values(batch ?? {}).filter(count => count > 0).length, 0);
}

function queuedQualityShippingEntryCount(state: GameState): number {
  return Object.values(state.qualityShippingBin).reduce((sum, batch) => sum + Object.values(batch ?? {}).filter(count => count > 0).length, 0);
}

function dryingHerbKinds(state: GameState): number {
  return Object.entries(state.player.inventory).filter(([itemId, slot]) => itemId.startsWith('herb.') && (slot?.count ?? 0) > 0).length;
}

function idleFacilityCount(state: GameState, kind: 'sealing-cabinet' | 'talisman-furnace'): number {
  return Array.from(state.facilities.values()).filter(facility => facility.kind === kind && !facility.job).length;
}

function npcBrowseNextStepLine(npc: { id: string; affection: number }, schedule: NpcDailySchedule | null, quest: NpcQuestStatus | null): string {
  if (quest?.completed) return '现在可做：去人物任务面板领奖，接上后续支线。';
  if (quest) return `现在可做：去${schedule?.location ?? '对方所在处'}推进“${quest.title}”。`;
  if (schedule?.birthday) return '现在可做：今日生辰，优先带礼去拜访。';
  if (npc.affection >= 160) return `现在可做：去${schedule?.location ?? '对方所在处'}继续深聊，等人物任务线索出现。`;
  if (npc.affection >= 80) return '现在可做：可继续送偏好礼物，尽快冲到下一档好感。';
  return '现在可做：先记住今日行程，带上合适礼物再来。';
}

function npcGiftStatusLine(giftName: string | null, birthday: boolean): string {
  if (giftName) return `携礼：${giftName}${birthday ? '｜今日生辰加成' : '｜可直接赠礼'}`;
  return birthday ? '携礼：暂无合适礼物｜今日若补礼可翻倍' : '携礼：暂无合适礼物｜建议先补社交物资';
}

function farmActionPreviewAssetId(kind: FarmActionKind): string {
  switch (kind) {
    case 'storage-deposit':
    case 'storage-withdraw':
    case 'processing-drying':
    case 'processing-sealing':
    case 'processing-furnace':
    case 'shipping-normal':
    case 'shipping-quality':
      return 'loc.farmstead';
    default:
      return 'loc.farmstead';
  }
}

export function farmActionMenuPreview(kind: FarmActionKind, state: GameState, ctx: SimContext): ActionPanelPreview {
  switch (kind) {
    case 'build':
      return {
        title: '建造',
        details: `农庄建设\n当前扩建 ${farmExpansionTier(state)} 阶\n铺开炼丹、布阵与备劫设施位`,
        assetId: farmsteadRootContextAssetId(state)
      };
    case 'facility-collect': {
      const ready = state.facilities.size === 0 ? 0 : readyFacilityCount(state);
      const statusLine = state.facilities.size === 0 ? '身旁暂无已建设施，可先去建造铺开经营位' : ready > 0 ? '优先巡看已完工设施，把这一轮产物收住' : '当前暂无待收产物，先等加工完成或继续安排农务';
      return {
        title: '设施收取',
        details: `设施轮转\n已建 ${state.facilities.size} 座｜待收 ${ready} 座\n${statusLine}`,
        assetId: 'loc.farmstead'
      };
    }
    case 'storage-deposit': {
      const carried = carriedInventorySlots(state);
      const free = storageFreeSlots(state);
      return {
        title: '仓储-存入',
        details: `仓流整理\n背包 ${carried} 格｜仓余 ${free} 格\n先卸灵草材料，给采收、炼丹与布阵腾位`,
        assetId: farmActionPreviewAssetId(kind)
      };
    }
    case 'storage-withdraw': {
      const used = storageUsed(state.storage);
      const free = storageFreeSlots(state);
      return {
        title: '仓储-取出',
        details: `仓流整理\n仓占 ${used}/${state.storage.capacity}｜余 ${free} 格\n为加工、出货与委托补货`,
        assetId: farmActionPreviewAssetId(kind)
      };
    }
    case 'processing-drying': {
      const herbs = dryingHerbKinds(state);
      return {
        title: '加工-晾晒',
        details: `基础加工\n鲜草 ${herbs} 种可投\n把鲜草转成封藏、炼丹与阵材前置`,
        assetId: farmActionPreviewAssetId(kind)
      };
    }
    case 'processing-sealing': {
      const idle = idleFacilityCount(state, 'sealing-cabinet');
      return {
        title: '加工-封藏',
        details: `进阶加工\n空闲封藏柜 ${idle} 座\n把晾晒灵草压成丹药与订单底料`,
        assetId: farmActionPreviewAssetId(kind)
      };
    }
    case 'processing-furnace': {
      const idle = idleFacilityCount(state, 'talisman-furnace');
      return {
        title: '加工-熔炼',
        details: `进阶加工\n空闲炼符炉 ${idle} 座\n消耗残件与灵石熔出阵核`,
        assetId: farmActionPreviewAssetId(kind)
      };
    }
    case 'shipping-normal': {
      const shippable = shippableNormalEntryCount(state, ctx);
      const queued = queuedNormalShippingEntryCount(state);
      return {
        title: '出货',
        details: `日常回款\n可出 ${shippable} 项｜已入箱 ${queued} 项\n回笼灵石，补种子、炉料与备劫消耗`,
        assetId: farmActionPreviewAssetId(kind)
      };
    }
    case 'shipping-quality': {
      const qualityKinds = carriedQualityEntryCount(state);
      const queued = queuedQualityShippingEntryCount(state);
      return {
        title: '品质出货',
        details: `精品回款\n品质库存 ${qualityKinds} 项｜已入箱 ${queued} 项\n高品灵草优先换取更高阶修行资源`,
        assetId: farmActionPreviewAssetId(kind)
      };
    }
    case 'upgrade':
      return {
        title: '升级',
        details: `长期经营\n留世模式 ${state.postAscension.mode === 'stayed-in-world' ? '已开启' : '未开启'}\n扩建农庄、暖棚与工具能力`,
        assetId: nextUpgradeAssetId(state)
      };
  }
}

export function farmActionMenuToastPresentation(kind: FarmActionKind, indexLabel: string, confirmHint: string, state: GameState, ctx: SimContext): ActionMenuToastPresentation {
  const preview = farmActionMenuPreview(kind, state, ctx);
  return {
    message: `农庄操作${indexLabel}：${preview.title}｜数字1-0直达·Tab切换·${confirmHint}`,
    assetId: preview.assetId
  };
}

export function npcActionMenuPreview(mode: 'browse' | 'gift' | 'quest', currentNpcId?: string | null): ActionPanelPreview {
  const currentNpcPortrait = currentNpcId ? previewNpcPortraitAssetId(currentNpcId) : undefined;

  switch (mode) {
    case 'browse':
      return {
        title: '人物浏览',
        details: '人物社交\n查看今日行程、好感与任务线索\n为拜访、赠礼与委托做准备',
        assetId: currentNpcPortrait ?? 'sprite.npc.wandering-cultivator'
      };
    case 'gift':
      return {
        title: '赠礼',
        details: '人物社交\n按偏好送出背包礼物\n提高好感并推进后续事件',
        assetId: currentNpcPortrait ?? 'sprite.npc.herb-gatherer'
      };
    case 'quest':
      return {
        title: '人物任务',
        details: '人物社交\n核对个人任务进度与奖励\n完成后可推进角色支线',
        assetId: currentNpcPortrait ?? 'sprite.npc.array-smith'
      };
  }
}

export function npcActionMenuToastPresentation(mode: 'browse' | 'gift' | 'quest', indexLabel: string, confirmHint: string, currentNpcId?: string | null): ActionMenuToastPresentation {
  const preview = npcActionMenuPreview(mode, currentNpcId);
  return {
    message: `人物操作${indexLabel}：${preview.title}｜数字1-3直达·Tab切换·${confirmHint}`,
    assetId: preview.assetId
  };
}

export function npcBrowsePanelPreview(npc: { id: string; displayName: string; role: string } & RelationshipState, schedule: NpcDailySchedule | null, quest: NpcQuestStatus | null, giftName: string | null = null): ActionPanelPreview {
  const lines = [`${npc.role}｜好感 ${npc.affection}/1000`, schedule ? `${schedule.location}｜${schedule.activity}` : '今日行踪未明'];
  if (schedule?.birthday) lines.push('今日生辰｜赠礼收益翻倍');
  lines.push(npcGiftStatusLine(giftName, Boolean(schedule?.birthday)));
  if (quest) lines.push(`人物任务｜${quest.title}${quest.completed ? '（可领取）' : ''}`);
  lines.push(npcBrowseNextStepLine(npc, schedule, quest));
  return {
    title: npc.displayName,
    details: lines.join('\n'),
    assetId: previewNpcPortraitAssetId(npc.id)
  };
}

export function npcBrowseToastPresentation(npc: { id: string; displayName: string; role: string } & RelationshipState, schedule: NpcDailySchedule | null, quest: NpcQuestStatus | null, indexLabel: string, giftName: string | null = null): NpcPanelToastPresentation {
  const preview = npcBrowsePanelPreview(npc, schedule, quest, giftName);
  return {
    message: `人物${indexLabel}：${preview.title}｜Tab切换人物·Esc返回`,
    assetId: preview.assetId
  };
}

export function npcUnavailableToastPresentation(): NpcPanelToastPresentation {
  return {
    message: '今日暂无可访人物｜先按农庄与地点动线推进',
    assetId: 'sprite.npc.wandering-cultivator'
  };
}

export function npcGiftPanelPreview(npc: { id: string; displayName: string }, giftName: string | null, birthday: boolean, giftItemId?: string | null, content?: ContentRegistry): ActionPanelPreview {
  void giftItemId;
  void content;
  return {
    title: npc.displayName,
    details: giftName ? `当前最适礼物：${giftName}\n赠予 ${npc.displayName}\n${birthday ? '今日生辰｜好感收益翻倍' : '背包已备好｜可直接赠礼'}` : `赠予 ${npc.displayName}\n暂无合适礼物\n${birthday ? '今日生辰｜若补到礼物可翻倍' : '建议先去集市、药圃或仓库补货'}`,
    assetId: previewNpcPortraitAssetId(npc.id)
  };
}

export function npcGiftToastPresentation(npc: { id: string; displayName: string }, giftName: string | null, birthday: boolean, indexLabel: string, confirmHint: string, giftItemId?: string | null, content?: ContentRegistry): NpcPanelToastPresentation {
  const preview = npcGiftPanelPreview(npc, giftName, birthday, giftItemId);
  return {
    message: `赠礼${indexLabel}：${npc.displayName}｜${giftName ?? '暂无合适礼物'}｜Tab切换人物·${confirmHint}`,
    assetId: preview.assetId
  };
}

export function npcGiftResultToastPresentation(npc: { id: string; displayName: string }, outcome: 'success' | 'failure', giftName: string | null, birthday: boolean, affectionGain?: number, giftItemId?: string | null, content?: ContentRegistry): NpcPanelToastPresentation {
  const successAssetId = giftItemId ? (itemIconAssetId(giftItemId, content) ?? previewNpcPortraitAssetId(npc.id)) : previewNpcPortraitAssetId(npc.id);
  return {
    message: outcome === 'success' ? `赠予${npc.displayName}${giftName ?? '礼物'}，好感 +${affectionGain ?? 0}${birthday ? '（生辰）' : ''}` : `${npc.displayName}：${giftName ? '今日已赠或物品不足' : '没有合适礼物'}`,
    assetId: outcome === 'success' ? successAssetId : previewNpcPortraitAssetId(npc.id)
  };
}

export function npcQuestPanelPreview(npc: { displayName: string }, quest: NpcQuestStatus | null, content?: ContentRegistry): ActionPanelPreview {
  if (!quest) {
    return {
      title: npc.displayName,
      details: '人物任务\n暂无可推进任务\n先提升好感或完成前置条件'
    };
  }

  const rewardAssetId = quest.reward.itemId ? (itemIconAssetId(quest.reward.itemId, content) ?? previewNpcPortraitAssetId(quest.npcId)) : previewNpcPortraitAssetId(quest.npcId);
  const objectiveAssetId = NPC_QUEST_OBJECTIVE_ASSET_IDS[quest.id] ?? rewardAssetId;

  return {
    title: quest.title,
    details: `委托人 ${npc.displayName}\n${quest.completed ? '已满足条件，可领取奖励' : '当前可做'}\n${quest.completed ? '返回人物面板领取本次谢礼' : quest.objective}`,
    assetId: objectiveAssetId
  };
}

export function npcQuestToastPresentation(npc: { displayName: string }, quest: NpcQuestStatus | null, indexLabel: string, confirmHint: string, content?: ContentRegistry): NpcPanelToastPresentation {
  const preview = npcQuestPanelPreview(npc, quest, content);
  return {
    message: `人物任务${indexLabel}：${npc.displayName}｜${quest ? `${preview.title}${quest.completed ? '｜可领取' : '｜未完成'}` : '暂无人物任务'}｜Tab切换人物·${confirmHint}`,
    assetId: preview.assetId
  };
}

export function npcQuestResultToastPresentation(npc: { displayName: string }, quest: NpcQuestStatus | null, outcome: 'advance' | 'complete' | 'failure' | 'missing', content?: ContentRegistry, nextQuestTitle?: string | null): NpcPanelToastPresentation {
  const preview = npcQuestPanelPreview(npc, quest, content);
  switch (outcome) {
    case 'advance':
      return {
        message: `${npc.displayName}任务推进：${preview.title} → ${nextQuestTitle ?? '后续任务'}`,
        assetId: preview.assetId
      };
    case 'complete':
      return {
        message: `${npc.displayName}任务完成：${preview.title}`,
        assetId: preview.assetId
      };
    case 'failure':
      return {
        message: quest?.completed ? `${npc.displayName}任务领取失败：${preview.title}` : `${npc.displayName}任务未成：${preview.title}`,
        assetId: preview.assetId
      };
    case 'missing':
      return {
        message: `${npc.displayName}：暂无人物任务`,
        assetId: preview.assetId
      };
  }
}
