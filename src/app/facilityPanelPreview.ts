import type { ContentRegistry } from '@content/defs';
import type { FacilityKind } from '@sim/world/state';
import type { UpgradeDef, ToolActionKind } from '@sim';
import { FACILITY_BUILD_COSTS, FACILITY_EXPANSION_REQUIREMENT, FACILITY_LABEL, facilityPlacementRuleText } from '@sim';
import { upgradeToolAssetId } from './toolAsset';

export interface FacilityPanelPreview {
  title: string;
  details: string;
  assetId?: string;
}

export interface FacilityToastPresentation {
  message: string;
  assetId?: string;
}

export function buildResultToastPresentation(kind: FacilityKind, outcome: 'success' | 'failure', detail?: string): FacilityToastPresentation {
  return {
    message: outcome === 'success' ? `建造完成：${FACILITY_LABEL[kind]}${detail ? `｜${detail}` : ''}` : `建造失败：${detail ?? FACILITY_LABEL[kind]}`,
    assetId: facilityAssetId(kind)
  };
}

export function upgradeResultToastPresentation(upgrade: UpgradeDef, outcome: 'success' | 'failure', content: ContentRegistry, detail?: string): FacilityToastPresentation {
  const preview = upgradePanelPreview(upgrade, content);
  return {
    message: outcome === 'success' ? `${upgrade.displayName}完成${detail ? `｜${detail}` : ''}` : `扩建未成：${detail ?? upgrade.displayName}`,
    assetId: preview.assetId
  };
}

export function buildToastPresentation(kind: FacilityKind, indexLabel: string, confirmHint: string, content: ContentRegistry): FacilityToastPresentation {
  const preview = buildPanelPreview(kind, content);
  return {
    message: `建造${indexLabel}：${preview.title}｜Tab切换·${confirmHint}`,
    assetId: preview.assetId
  };
}

export function upgradeToastPresentation(upgrade: UpgradeDef, indexLabel: string, confirmHint: string, content: ContentRegistry): FacilityToastPresentation {
  const preview = upgradePanelPreview(upgrade, content);
  return {
    message: `扩建${indexLabel}：${preview.title}｜Tab切换·${confirmHint}`,
    assetId: preview.assetId
  };
}

export function upgradeUnavailableToastPresentation(assetIdOverride?: string): FacilityToastPresentation {
  return {
    message: '暂无可扩建设施',
    assetId: assetIdOverride ?? 'loc.farmstead'
  };
}

export interface FacilityCollectPreviewChoice {
  kind: FacilityKind;
  ready: boolean;
  daysRemaining: number | null;
}

function facilityAssetId(kind: FacilityKind): string {
  return `facility.${kind}`;
}

function costLine(itemId: string, count: number, content: ContentRegistry): string {
  const name = content.items.get(itemId)?.displayName ?? itemId;
  return `${name} × ${count}`;
}

function upgradeCostLine(upgrade: UpgradeDef, content: ContentRegistry): string {
  return upgrade.costs.map(cost => costLine(cost.itemId, cost.count, content)).join('、');
}

function actionLabel(action: ToolActionKind): string {
  switch (action) {
    case 'till':
      return '翻地';
    case 'water':
      return '浇水';
    case 'harvest':
      return '收获';
  }
}

function upgradeEffectSummary(upgrade: UpgradeDef): string {
  if (upgrade.farmExpansionTier) return `扩展农庄至 ${upgrade.farmExpansionTier} 阶`;
  if (upgrade.inventoryCapacityBonus) return `储物戒容量 +${upgrade.inventoryCapacityBonus}`;

  const toolEffects: string[] = [];
  for (const [action, mult] of Object.entries(upgrade.toolStaminaMult ?? {}) as Array<[ToolActionKind, number]>) {
    toolEffects.push(`${actionLabel(action)}耗体 ${Math.round(mult * 100)}%`);
  }
  for (const [action, bonus] of Object.entries(upgrade.toolAreaBonus ?? {}) as Array<[ToolActionKind, number]>) {
    toolEffects.push(`${actionLabel(action)}范围 +${bonus}`);
  }
  if (toolEffects.length > 0) return toolEffects.join('、');

  if (upgrade.id.startsWith('greenhouse-nursery-')) return '提升暖棚苗床与养护能力';
  if (upgrade.id === 'farm-autoload-1') return '解锁巡守兽搬运与仓流联动';
  return '长期经营能力提升';
}

export function upgradePreviewAssetId(upgrade: UpgradeDef): string {
  if (upgrade.farmExpansionTier) return 'loc.herb-plot';
  if (upgrade.inventoryCapacityBonus) return 'loc.farmstead';

  const toolAssetId = upgradeToolAssetId(upgrade.id);
  if (toolAssetId) return toolAssetId;
  if (upgrade.id.startsWith('greenhouse-nursery-')) return 'loc.greenhouse';
  if (upgrade.id === 'farm-autoload-1') return 'sprite.guard-beast-wolf';

  return 'icon.item.array-core';
}

export function buildPanelPreview(kind: FacilityKind, content: ContentRegistry): FacilityPanelPreview {
  const costs = FACILITY_BUILD_COSTS[kind].map(cost => costLine(cost.itemId, cost.count, content)).join('、');
  const requiredTier = FACILITY_EXPANSION_REQUIREMENT[kind];
  const unlock = requiredTier <= 0 ? '初始可建' : `农庄扩建 ${requiredTier} 阶解锁`;

  return {
    title: FACILITY_LABEL[kind],
    details: `设施建造\n材料：${costs}\n${unlock}\n${facilityPlacementRuleText(kind)}`,
    assetId: 'loc.farmstead'
  };
}

export function upgradePanelPreview(upgrade: UpgradeDef, content: ContentRegistry): FacilityPanelPreview {
  const lines = [`扩建设施`, `材料：${upgradeCostLine(upgrade, content)}`, `效果：${upgradeEffectSummary(upgrade)}`];

  if (upgrade.requiresStayedInWorld) lines.push('条件：需留世后继续经营');
  if (upgrade.requiresUpgradeId) lines.push('条件：需先完成前置扩建');

  return {
    title: upgrade.displayName,
    details: lines.join('\n'),
    assetId: upgradePreviewAssetId(upgrade)
  };
}

export function facilityCollectPanelPreview(choice: FacilityCollectPreviewChoice): FacilityPanelPreview {
  let status = '设施空闲';
  if (choice.ready) {
    status = '产物已完成，可立即收取';
  } else if (choice.daysRemaining != null) {
    status = `加工中，还需 ${choice.daysRemaining} 日`;
  }

  return {
    title: FACILITY_LABEL[choice.kind],
    details: `设施收取\n${status}`,
    assetId: facilityAssetId(choice.kind)
  };
}

export function facilityCollectToastPresentation(choice: FacilityCollectPreviewChoice, indexLabel: string, confirmHint: string): FacilityToastPresentation {
  return {
    message: `设施收取${indexLabel}：${FACILITY_LABEL[choice.kind]}｜${choice.ready ? '可收取' : '未完成'}｜Tab切换·${confirmHint}`,
    assetId: facilityAssetId(choice.kind)
  };
}

export function facilityCollectUnavailableToastPresentation(assetIdOverride?: string): FacilityToastPresentation {
  return {
    message: '身旁无可收取设施',
    assetId: assetIdOverride ?? 'loc.farmstead'
  };
}
