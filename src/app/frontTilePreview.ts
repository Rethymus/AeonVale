import type { ContentRegistry } from '@content/defs';
import type { Tile } from '@sim/farm/tile';
import type { CropInstance } from '@sim/farm/crop';
import type { GameState } from '@sim/world/state';
import { FACILITY_LABEL } from '@sim';
import { hasActiveArrayCoverage } from '@sim/tribulation/arrays';
import { itemIconAssetId } from './itemIcons';
import { arrayCoreFacilityKind } from '@render/arrayPreview';
import { tileAssetId } from '@render/tileAsset';

export interface FrontTilePreview {
  title: string;
  details: string;
  assetId?: string;
}

const STAGE_LABEL: Record<string, string> = {
  seed: '种子',
  sprout: '幼苗',
  growing: '生长期',
  mature: '成熟',
  withered: '枯萎'
};

const SOIL_LABEL: Record<string, string> = {
  loam: '普通壤土',
  'wet-loam': '湿润壤土',
  'dry-sand': '干沙地',
  insulated: '绝缘垫层',
  scorched: '焦土地',
  'spirit-loam': '灵壤',
  rock: '岩地',
  water: '水面',
  'metal-ore': '金矿露头'
};

function moistureStatus(tile: Tile): string {
  if (!tile.tilled) return '未整地';
  if (tile.wateredToday || tile.moisture >= 55_000) return '湿润';
  if (tile.moisture >= 20_000) return '尚可';
  return '偏干';
}

function qiStatus(tile: Tile): string {
  if (!tile.tilled) return '未整地';
  if (tile.channeledToday || tile.qiDensity >= 55_000) return '充盈';
  if (tile.qiDensity >= 20_000) return '平稳';
  return '稀薄';
}

function isInsulationCovered(state: GameState, tileId: number): boolean {
  return hasActiveArrayCoverage(state, tileId, 'array.insulation');
}

function protectedLine(state: GameState, tileId: number): string {
  return isInsulationCovered(state, tileId) ? '阵法护持：绝缘阵已覆盖' : '阵法护持：暂无';
}

function hasCarriedSeed(state: GameState): boolean {
  return Object.entries(state.player.inventory).some(([itemId, stack]) => itemId.startsWith('seed.') && (stack?.count ?? 0) > 0);
}

function describeEmptyTile(state: GameState, tile: Tile): FrontTilePreview {
  const insulationCovered = isInsulationCovered(state, tile.id);
  if (tile.blockType !== 'none' || tile.soilType === 'rock' || tile.soilType === 'water' || tile.soilType === 'metal-ore') {
    return {
      title: SOIL_LABEL[tile.soilType] ?? '障碍地块',
      details: `面前地块\n不可耕作\n先绕开或换一块田处理`,
      assetId: tileAssetId(tile, { insulationCovered })
    };
  }

  if (!tile.tilled) {
    if (tile.soilType === 'scorched') {
      return {
        title: '焦土地',
        details: '面前地块\n雷火灼过，暂难播种\n先翻新土层，再恢复耕作',
        assetId: tileAssetId(tile, { insulationCovered })
      };
    }
    return {
      title: '未翻土地',
      details: `面前地块\n土质：${SOIL_LABEL[tile.soilType] ?? tile.soilType}\n先翻地，再播种`,
      assetId: tileAssetId(tile, { insulationCovered })
    };
  }

  const needsWater = !tile.wateredToday && tile.moisture < 55_000;
  const needsQi = !tile.channeledToday && tile.qiDensity < 55_000;
  const hasSeed = hasCarriedSeed(state);

  const assetId = needsWater ? 'icon.item.water-pail' : needsQi ? 'icon.item.array-core' : hasSeed ? 'icon.seed.mossling' : 'loc.valley-market';

  const actionLine = needsWater ? '先补水，再播种或补肥' : needsQi ? '先补灵，再播种或补肥' : hasSeed ? '现在可播种或补肥' : '身上没有种子，先去集市补货';

  return {
    title: insulationCovered ? '护持灵田' : '已翻灵田',
    details: `面前地块\n湿润：${moistureStatus(tile)}｜灵气：${qiStatus(tile)}\n${protectedLine(state, tile.id)}｜${actionLine}`,
    assetId
  };
}

function describeCrop(state: GameState, tile: Tile, crop: CropInstance, content: ContentRegistry): FrontTilePreview {
  const herb = content.herbs.get(crop.defId);
  const title = herb?.displayName ?? crop.defId;
  const stage = STAGE_LABEL[crop.stage] ?? crop.stage;
  const actionable = crop.stage === 'mature' ? '现在可收获' : crop.stage === 'withered' ? '已枯萎，收掉后再补种' : `湿润：${moistureStatus(tile)}｜灵气：${qiStatus(tile)}｜${protectedLine(state, tile.id)}`;

  const assetId = crop.stage === 'mature' ? itemIconAssetId(crop.defId, content) : crop.stage === 'withered' ? itemIconAssetId(crop.defId, content) : !tile.wateredToday && tile.moisture < 55_000 ? 'icon.item.water-pail' : !tile.channeledToday && tile.qiDensity < 55_000 ? 'icon.item.array-core' : itemIconAssetId(crop.defId, content);

  return {
    title,
    details: `面前灵草\n阶段：${stage}\n${actionable}`,
    assetId
  };
}

function facilityJobLine(inputItemId: string | undefined, outputItemId: string | undefined, content: ContentRegistry): string {
  const inputName = inputItemId ? (content.items.get(inputItemId)?.displayName ?? inputItemId) : '';
  const outputName = outputItemId ? (content.items.get(outputItemId)?.displayName ?? outputItemId) : '';
  if (inputName && outputName) return `当前：${inputName} -> ${outputName}`;
  if (outputName) return `当前：${outputName}`;
  if (inputName) return `当前：${inputName}`;
  return '当前：待投料';
}

function describeFacility(state: GameState, tileId: number, content: ContentRegistry): FrontTilePreview | null {
  const facility = [...state.facilities.values()].find(entry => entry.tileId === tileId);
  if (!facility) return null;

  const status = facility.job == null ? '设施空闲，可立即投入使用' : facility.job.daysRemaining <= 0 ? '产物已完成，可立即收取' : `加工中，还需 ${facility.job.daysRemaining} 日`;
  const jobLine = facility.job == null ? '' : facilityJobLine(facility.job.inputItemId, facility.job.outputItemId, content);
  return {
    title: FACILITY_LABEL[facility.kind],
    details: ['面前设施', status, jobLine, '靠近后可通过农庄操作继续处理'].filter(line => line.length > 0).join('\n'),
    assetId: `facility.${facility.kind}`
  };
}

function describeArray(state: GameState, tileId: number, content: ContentRegistry): FrontTilePreview | null {
  const array = [...state.arrays.values()].find(entry => entry.coreTileId === tileId);
  if (!array) return null;

  const def = content.arrays.get(array.defId);
  const title = def?.displayName ?? array.defId;
  const radius = def?.radius ?? 0;
  const status = array.active ? (array.power > 0 ? `阵势运转中｜覆盖 ${array.coverageTileIds.length} 格｜半径 ${radius}` : '阵势尚在，但灵力已尽') : '阵势未激活';
  const nextStep = def?.needsMetalCore ? '以金属性灵草为阵眼，外围可作引兽避雷田' : '护住核心药草区，减少雷击与失养风险';

  return {
    title,
    details: `面前阵法\n${status}\n${nextStep}`,
    assetId: `facility.${arrayCoreFacilityKind(array.defId)}`
  };
}

export function frontTilePreview(state: GameState, content: ContentRegistry): FrontTilePreview | null {
  const p = state.player;
  const dx = p.facing === 'left' ? -1 : p.facing === 'right' ? 1 : 0;
  const dy = p.facing === 'up' ? -1 : p.facing === 'down' ? 1 : 0;
  const x = p.position.x + dx;
  const y = p.position.y + dy;
  const tile = state.tiles.find(entry => entry.x === x && entry.y === y);
  if (!tile) return null;
  const facilityPreview = describeFacility(state, tile.id, content);
  if (facilityPreview) return facilityPreview;
  const arrayPreview = describeArray(state, tile.id, content);
  if (arrayPreview) return arrayPreview;
  if (tile.cropId != null) {
    const crop = state.crops.get(tile.id);
    if (crop) return describeCrop(state, tile, crop, content);
  }
  return describeEmptyTile(state, tile);
}
