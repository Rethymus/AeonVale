import type { ContentRegistry } from '@content/defs';
import type { GameEvent } from '@sim';
import { normalizeFarmsteadRootAssetId } from './farmsteadFocus';
import { locationPreviewAssetId } from './locationPreview';
import { itemIconAssetId } from './itemIcons';

export interface ExplorationGrantLike {
  itemId: string;
  count: number;
}

export interface ExplorationToastPresentation {
  message: string;
  assetId?: string;
}

export interface RuinDelveToastResult {
  level?: number;
  damage?: number;
  grants?: readonly ExplorationGrantLike[];
  milestone?: boolean;
  chapterTitle?: string;
  chapterProgress?: string;
  chapterReadyToClaim?: boolean;
}

type ExploreSite = 'valley' | 'ruin' | 'spirit-vein';

function explorationAssetId(site: ExploreSite): string {
  switch (site) {
    case 'valley':
      return locationPreviewAssetId('valley-outskirts');
    case 'ruin':
      return locationPreviewAssetId('ruin-gate');
    case 'spirit-vein':
      return locationPreviewAssetId('spirit-vein');
  }
}

function describeGrants(grants: readonly ExplorationGrantLike[], content: ContentRegistry): string {
  return grants.map(grant => `${content.items.get(grant.itemId)?.displayName ?? grant.itemId}×${grant.count}`).join('、');
}

export function explorationFailureToastPresentation(site: ExploreSite): ExplorationToastPresentation {
  return {
    message: site === 'spirit-vein' ? '体力不足，无法探查残脉' : '体力不足，无法外出寻访',
    assetId: explorationAssetId(site)
  };
}

export function beastHuntUnavailableToastPresentation(): ExplorationToastPresentation {
  return {
    message: '附近无妖兽潮',
    assetId: explorationAssetId('spirit-vein')
  };
}

export function beastHuntResultToastPresentation(events: readonly GameEvent[], content: ContentRegistry): ExplorationToastPresentation {
  const coreEv = [...events].reverse().find(event => event.type === 'beast-loot');
  const seedEv = [...events].reverse().find(event => event.type === 'beast-seed');
  const seedItemId = (seedEv?.payload as { itemId?: string } | undefined)?.itemId;
  const seedName = seedItemId ? (content.items.get(seedItemId)?.displayName ?? '种子') : null;
  const rewardAssetId = coreEv ? itemIconAssetId((coreEv.payload as { itemId?: string } | undefined)?.itemId ?? '', content) : seedItemId ? itemIconAssetId(seedItemId, content) : undefined;

  const parts = ['猎妖成功'];
  if (coreEv) parts.push('得内丹');
  if (seedName) parts.push(`获${seedName}`);

  return {
    message: parts.join('·'),
    assetId: rewardAssetId ?? explorationAssetId('spirit-vein')
  };
}

export function explorationResultToastPresentation(site: ExploreSite, grants: readonly ExplorationGrantLike[], content: ContentRegistry): ExplorationToastPresentation {
  const names = describeGrants(grants, content);
  const rewardAssetId = grants[0]?.itemId ? itemIconAssetId(grants[0].itemId, content) : undefined;
  if (site === 'spirit-vein') {
    return {
      message: names ? `残脉所得：${names}` : '残脉空竭',
      assetId: names ? (rewardAssetId ?? explorationAssetId(site)) : explorationAssetId(site)
    };
  }
  if (grants.length === 0) {
    return {
      message: site === 'valley' ? '山谷寻访无获' : '遗迹寻访无获',
      assetId: explorationAssetId(site)
    };
  }
  return {
    message: `寻访所得：${names}`,
    assetId: rewardAssetId ?? explorationAssetId(site)
  };
}

export function ruinDelveFailureToastPresentation(): ExplorationToastPresentation {
  return {
    message: '无法深入遗迹：体力或气血不足',
    assetId: locationPreviewAssetId('ruin-gate')
  };
}

export function tribulationBlockedToastPresentation(kind: 'purple-omen' | 'body-not-ready', options?: { daysLeft?: number; currentFoundation?: number; requiredFoundation?: number }): ExplorationToastPresentation {
  if (kind === 'purple-omen') {
    const days = options?.daysLeft ?? 7;
    return {
      message: `紫雷前兆未散，还需 ${days} 日｜先补避雷丹、阵法与药田库存`,
      assetId: 'loc.array-shed'
    };
  }

  const current = Math.floor((options?.currentFoundation ?? 0) / 1000);
  const rawRequired = options?.requiredFoundation ?? 0;
  // 体魄根基上限在 stage 越界（默认凡骨 stage=0，或飞升后）时会取到 Infinity 哨兵；
  // 这里必须做有限性守卫，否则会向玩家吐出「还差 Infinity」这种字面泄露。
  const required = Number.isFinite(rawRequired) ? Math.floor(rawRequired / 1000) : 0;
  const missing = Math.max(0, required - current);
  return {
    message: required > 0 ? `体魄根基未满，还差 ${missing}｜先收灵草、炼丹或修行再引劫` : '体魄根基未满｜先收灵草、炼丹或修行再引劫',
    assetId: 'loc.farmstead'
  };
}

export function tribulationResultToastPresentation(kind: 'death' | 'breakthrough' | 'survived', options?: { stage?: number; temperingGain?: number }): ExplorationToastPresentation {
  switch (kind) {
    case 'death':
      return {
        message: '陨于天劫！',
        assetId: 'loc.array-shed'
      };
    case 'breakthrough':
      return {
        message: `渡劫成功！突破至 ${options?.stage ?? '?'} 阶`,
        assetId: 'loc.array-shed'
      };
    case 'survived':
      return {
        message: `扛过天劫（体魄+${options?.temperingGain ?? 0}）`,
        assetId: 'loc.array-shed'
      };
  }
}

export function tribulationEndingToastPresentation(kind: 'ascension' | 'death' | 'stay-in-world', assetIdOverride?: string): ExplorationToastPresentation {
  const normalizedRootAssetId = assetIdOverride ? normalizeFarmsteadRootAssetId(assetIdOverride) : undefined;
  return {
    message: kind === 'ascension' ? '白日飞升！' : kind === 'stay-in-world' ? '你留在了此界。境界止步，山河未尽。' : '陨于天劫',
    assetId: kind === 'stay-in-world' ? (normalizedRootAssetId ?? 'loc.farmstead') : 'loc.array-shed'
  };
}

export function ruinDelveToastPresentation(result: RuinDelveToastResult, content: ContentRegistry): ExplorationToastPresentation {
  const grants = result.grants ?? [];
  const names = describeGrants(grants, content);
  const chapterText = result.chapterTitle ? `｜${result.chapterTitle} ${result.chapterProgress ?? '?'}${result.chapterReadyToClaim ? ' 可领' : ''}` : '';
  return {
    message: `遗迹第${result.level ?? '?'}层·伤${result.damage ?? 0}${result.milestone ? '·传承石室' : ''}${chapterText}${names ? `：${names}` : ''}`,
    assetId: locationPreviewAssetId('ruin-gate')
  };
}
