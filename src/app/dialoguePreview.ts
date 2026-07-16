import type { NarrativeBeat } from '@content/narrative';
import type { LocationEncounter, LocationId } from '@sim/world/locations';
import { previewNpcPortraitAssetId, previewNpcPortraitAssetIdFromName } from './locationPreview';

export type DialogueBeatWithAsset = NarrativeBeat & { assetId?: string };

export interface RelationshipDialogueInput {
  id: string;
  npcName: string;
  title: string;
  lines: readonly string[];
  npcId?: string | null;
}

function encounterNextStepLine(locationId: LocationId, encounter: LocationEncounter): string {
  if (encounter.npcId === 'npc.wandering-cultivator') {
    if (locationId === 'valley-market') return '现在可做：去集市交易或委托板，把手头灵草、丹药和兽核变成后路。';
    if (locationId === 'spirit-vein') return '现在可做：若想补炼体材料，先探残脉，再回来和他换路。';
    if (locationId === 'tea-shed') return '现在可做：先把茶棚传闻记下，再决定去集市还是遗迹补下一步资源。';
  }
  if (encounter.npcId === 'npc.herb-gatherer') {
    if (locationId === 'herb-plot') return '现在可做：先补露根草，把下一轮温骨药材备起来。';
    if (locationId === 'creek-field') return '现在可做：趁水汽正盛先收药露，再回农庄安排后续加工。';
    if (locationId === 'drying-yard') return '现在可做：先看晾晒架还有没有空位，把秋收药材及时转成稳定货。';
    if (locationId === 'greenhouse') return '现在可做：先照看过冬灵苗，稳住离季种植的节奏。';
  }
  if (encounter.npcId === 'npc.array-smith') {
    if (locationId === 'array-shed') return '现在可做：去阵法面板核对阵核和符炉，再决定补哪一块控场能力。';
    if (locationId === 'ore-slope') return '现在可做：先补导雷矿砂或阵材，再回棚里熔炼阵核。';
    if (locationId === 'ruin-gate') return '现在可做：若想推进旧阵线，先去遗迹寻访或捐藏经。';
  }
  return `现在可做：先记住${encounter.npcName}今日在此，围绕这条动线安排接下来的半天。`;
}

function relationshipNextStepLine(event: RelationshipDialogueInput): string | null {
  switch (event.id) {
    case 'herb-gatherer-160':
      return '现在可做：去露根药圃补露根草和雾蕨，再把体魄练到 1200。';
    case 'array-smith-160':
      return '现在可做：去遗迹和矿石坡补破损法宝、阵核，把第一条人物任务线拉起来。';
    case 'wandering-cultivator-160':
      return '现在可做：去集市或残脉补妖兽内丹和灵石，把散修这条换路线先跑通。';
    default:
      return null;
  }
}

export function buildEncounterDialogueBeat(locationId: LocationId, encounter: LocationEncounter, sequence: number): DialogueBeatWithAsset {
  return {
    id: `encounter-${locationId}-${encounter.npcId}-${sequence}`,
    lines: [`${encounter.npcName}·${encounter.title}`, ...encounter.lines, encounterNextStepLine(locationId, encounter)],
    trigger: () => true,
    assetId: previewNpcPortraitAssetId(encounter.npcId) ?? previewNpcPortraitAssetIdFromName(encounter.npcName)
  };
}

export function buildRelationshipDialogueBeat(event: RelationshipDialogueInput, npcNameToId: ReadonlyMap<string, string>): DialogueBeatWithAsset {
  const resolvedNpcId = event.npcId ?? npcNameToId.get(event.npcName);
  const nextStepLine = relationshipNextStepLine(event);
  return {
    id: event.id,
    lines: [`${event.npcName}·${event.title}`, ...event.lines, ...(nextStepLine ? [nextStepLine] : [])],
    trigger: () => true,
    assetId: (resolvedNpcId ? previewNpcPortraitAssetId(resolvedNpcId) : undefined) ?? previewNpcPortraitAssetIdFromName(event.npcName)
  };
}
