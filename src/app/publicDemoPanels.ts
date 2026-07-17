import { TUTORIAL_ALCHEMY_BREWED_FLAG, TUTORIAL_ALCHEMY_KIT_FLAG, TUTORIAL_TRIBULATION_BOLT_COUNT, resolveBrew, type GameState, type SimContext } from '@sim';
import { lookupRelation } from '@sim/alchemy/compatibility';
import { itemCount } from '@sim/world/player';

const TUTORIAL_RECIPE_ID = 'recipe.ward-pill';
const TUTORIAL_PILL_ID = 'pill.ward-basic';

export interface PublicDemoMaterialView {
  readonly name: string;
  readonly quantity: number;
}

export interface PublicDemoAlchemyView {
  readonly recipeName: string;
  readonly pillName: string;
  readonly materials: readonly PublicDemoMaterialView[];
  readonly heatPercent: number;
  readonly idealHeatLabel: string;
  /** 七情配伍「一口」：教学丹方材料关系，供玩家读到修仙差异化。 */
  readonly pairingLabel: string;
  readonly previewLabel: string;
  readonly resultLabel: string;
  readonly primaryLabel: string;
  readonly primaryDisabled: boolean;
  readonly brewed: boolean;
}

export interface PublicDemoTribulationView {
  readonly phase: GameState['tutorialTribulation']['phase'];
  readonly hpLabel: string;
  readonly pillLabel: string;
  readonly wardLabel: string;
  readonly warningLabel: string;
  readonly positionLabel: string;
  readonly lastBoltLabel: string;
  readonly primaryLabel: string;
  readonly primaryDisabled: boolean;
  readonly takePillDisabled: boolean;
  readonly movementDisabled: boolean;
  /** 当前预警区内：主确认将尝试擦弹 PerfectBlock。 */
  readonly perfectBlockAvailable: boolean;
}

export interface PublicDemoAftermathView {
  readonly heading: string;
  readonly outcomeLabel: string;
  readonly hpLabel: string;
  readonly hitLabel: string;
  readonly temperingLabel: string;
  readonly rewardLabel: string;
  readonly nextLabel: string;
  readonly continueDisabled: boolean;
}

interface TutorialBrewPayload {
  readonly outcome?: 'exploded' | 'pill' | 'flawed' | 'waste';
  readonly completed?: boolean;
  readonly retryable?: boolean;
}

interface TutorialBoltPayload {
  readonly boltIndex?: number;
  readonly hitType?: 'direct' | 'rod' | 'miss' | 'blocked';
  readonly damageMilli?: number;
}

function latestPayload<T>(state: GameState, type: string): T | null {
  const event = [...state.events].reverse().find(entry => entry.type === type);
  return (event?.payload as T | undefined) ?? null;
}

function outcomePreview(outcome: ReturnType<typeof resolveBrew>['outcome']): string {
  switch (outcome) {
    case 'pill':
      return '火候稳定，预计可炼成完整丹药。';
    case 'flawed':
      return '可以成丹，但药性会略有偏差。';
    case 'waste':
      return '火候偏离丹方，当前只会留下药渣。';
    case 'exploded':
      return '药性冲突，继续炼制会有炸炉风险。';
  }
}

function brewResultLabel(payload: TutorialBrewPayload | null, brewed: boolean): string {
  if (brewed) return '首枚避雷丹已经出炉。教学药包已转化为一枚正式丹药。';
  if (!payload) return '教学药包不会占用背包；失败后材料会保留，可继续调整火候。';
  switch (payload.outcome) {
    case 'waste':
      return '本炉化为药渣，但教学药包仍在。调整火候后可以立即重试。';
    case 'exploded':
      return '本炉未能成丹，教学药包已完整保留。先把火候调回安全区间。';
    case 'flawed':
    case 'pill':
      return payload.completed ? '避雷丹已经出炉。' : '本炉尚未完成教学丹药，可以继续重试。';
    default:
      return '教学药包仍在，可以继续调整火候。';
  }
}

/** 教学丹方两味药的七情关系文案（只读 compatibility 表，不改 sim 规则）。 */
export function tutorialAlchemyPairingLabel(
  inputs: readonly { herbId: string }[],
  content: SimContext['content']
): string {
  if (inputs.length < 2) return '七情配伍：单味药方，暂无对药关系。';
  const a = inputs[0]!;
  const b = inputs[1]!;
  const nameA = content.items.get(a.herbId)?.displayName ?? a.herbId;
  const nameB = content.items.get(b.herbId)?.displayName ?? b.herbId;
  const rule = lookupRelation(a.herbId, b.herbId);
  if (!rule) return `七情配伍：${nameA} 与 ${nameB} 平和同炉，火候仍是成败关键。`;
  switch (rule.relation) {
    case '相使':
      return `七情配伍：${nameA} 相使 ${nameB}，辅药引经，略增药力。`;
    case '相须':
      return `七情配伍：${nameA} 与 ${nameB} 相须，同气增效。`;
    case '相畏':
      return `七情配伍：${nameA} 相畏 ${nameB}，可制毒势。`;
    case '相杀':
      return `七情配伍：${nameA} 相杀 ${nameB}，净化解毒。`;
    case '相恶':
      return `七情配伍：${nameA} 与 ${nameB} 相恶，药力相减，易成废丹。`;
    case '相反':
      return `七情配伍：${nameA} 与 ${nameB} 相反——强行同炉必炸炉。`;
    default:
      return `七情配伍：${nameA} 与 ${nameB} · ${rule.relation}。`;
  }
}

export function buildPublicDemoAlchemyView(state: GameState, ctx: SimContext, heatPercent: number): PublicDemoAlchemyView {
  const recipe = ctx.content.recipes.get(TUTORIAL_RECIPE_ID);
  const normalizedHeat = Math.max(0, Math.min(100, Math.round(Number.isFinite(heatPercent) ? heatPercent : 0)));
  const brewed = state.player.flags.has(TUTORIAL_ALCHEMY_BREWED_FLAG);
  const kitReady = state.player.flags.has(TUTORIAL_ALCHEMY_KIT_FLAG);
  const materials =
    recipe?.inputs.map(input => ({
      name: ctx.content.items.get(input.herbId)?.displayName ?? input.herbId,
      quantity: input.qty
    })) ?? [];
  const preview = recipe
    ? resolveBrew(
        state,
        {
          materials: recipe.inputs.map(input => ({ herbId: input.herbId, qty: input.qty })),
          avgHeatMilli: normalizedHeat * 1_000
        },
        ctx
      )
    : null;
  const latestBrew = latestPayload<TutorialBrewPayload>(state, 'tutorial-brew-resolved');

  return {
    recipeName: recipe?.displayName ?? '教学丹方不可用',
    pillName: recipe ? (ctx.content.items.get(recipe.outputPillId)?.displayName ?? recipe.outputPillId) : '避雷丹',
    materials,
    heatPercent: normalizedHeat,
    idealHeatLabel: recipe ? `${Math.round(recipe.idealHeatRange[0] / 1_000)}–${Math.round(recipe.idealHeatRange[1] / 1_000)}%` : '不可用',
    pairingLabel: recipe ? tutorialAlchemyPairingLabel(recipe.inputs, ctx.content) : '七情配伍：丹方数据缺失。',
    previewLabel: preview ? outcomePreview(preview.outcome) : '丹方数据缺失，暂时无法炼制。',
    resultLabel: !brewed && !kitReady ? '先在灵田收获第一批灵草，山谷才会交付一次性教学药包。' : brewResultLabel(latestBrew, brewed),
    primaryLabel: brewed ? '携丹返回农庄' : latestBrew?.retryable ? '重新炼制' : '炼制备劫丹',
    primaryDisabled: !brewed && (!kitReady || recipe == null),
    brewed
  };
}

function hitLabel(hitType: TutorialBoltPayload['hitType']): string {
  switch (hitType) {
    case 'direct':
      return '正面承雷';
    case 'rod':
      return '引雷阵承接';
    case 'miss':
      return '走位避开';
    case 'blocked':
      return '擦弹完美格挡';
    default:
      return '尚未落雷';
  }
}

export function buildPublicDemoTribulationView(state: GameState): PublicDemoTribulationView {
  const tutorial = state.tutorialTribulation;
  const warnedTile = tutorial.warnedTileId == null ? null : (state.tiles.find(tile => tile.id === tutorial.warnedTileId) ?? null);
  const player = state.player.position;
  const inWarningZone = warnedTile != null && Math.max(Math.abs(player.x - warnedTile.x), Math.abs(player.y - warnedTile.y)) <= 1;
  const lastBolt = latestPayload<TutorialBoltPayload>(state, 'tutorial-tribulation-bolt-resolved');
  const pillCount = itemCount(state.player, TUTORIAL_PILL_ID);
  const activeBolt = Math.min(TUTORIAL_TRIBULATION_BOLT_COUNT, tutorial.boltIndex + 1);
  const canStart = state.player.flags.has(TUTORIAL_ALCHEMY_BREWED_FLAG) && state.player.hp > 0;
  const perfectBlockAvailable = tutorial.phase === 'active' && inWarningZone;

  return {
    phase: tutorial.phase,
    hpLabel: `${Math.max(0, Math.round(state.player.hp / 1_000))} / ${Math.round(state.player.maxHp / 1_000)}`,
    pillLabel: `避雷丹 ×${pillCount}`,
    wardLabel: state.player.wardMitigation > 0 ? `避雷护体 ${Math.round(state.player.wardMitigation * 100)}%` : '尚未服用备劫丹',
    warningLabel:
      tutorial.phase === 'active' && warnedTile
        ? `第 ${activeBolt}/${TUTORIAL_TRIBULATION_BOLT_COUNT} 雷将落在 (${warnedTile.x}, ${warnedTile.y})。${
            inWarningZone ? '你仍在落雷区内——可就地擦弹，或先走位再确认落雷。' : '你已离开落雷区，确认后将安全避过本雷。'
          }`
        : tutorial.phase === 'aftermath'
          ? '三雷已经结束，战后结算正在等待确认。'
          : '服丹后开始教学。每一雷先标落点：可走位离开，或在区内确认时擦弹。',
    positionLabel: `当前位置 (${player.x}, ${player.y})`,
    lastBoltLabel: lastBolt ? `第 ${lastBolt.boltIndex ?? tutorial.boltIndex} 雷：${hitLabel(lastBolt.hitType)}，损失 ${Math.round((lastBolt.damageMilli ?? 0) / 1_000)} 气血。` : '尚无雷击结果。',
    primaryLabel: tutorial.phase === 'active' ? (perfectBlockAvailable ? `擦弹·第 ${activeBolt} 雷` : `确认第 ${activeBolt} 雷`) : '开始三雷教学',
    primaryDisabled: tutorial.phase === 'aftermath' || (tutorial.phase === 'idle' && !canStart),
    takePillDisabled: tutorial.phase !== 'idle' || pillCount <= 0 || state.player.wardMitigation > 0,
    movementDisabled: tutorial.phase !== 'active',
    perfectBlockAvailable
  };
}

export function buildPublicDemoAftermathView(state: GameState): PublicDemoAftermathView {
  const tutorial = state.tutorialTribulation;
  const survived = tutorial.outcome === 'survived';
  const hits = tutorial.hits;

  return {
    heading: survived ? '三雷已过' : tutorial.outcome === 'rescued' ? '山谷将你救回' : '等待天劫结果',
    outcomeLabel: survived ? '你完成了教学小天劫，正式境界保持不变。' : '本次未能撑过三雷，但不会永久死亡，可以重新准备。',
    hpLabel: `${Math.round(tutorial.startingHpMilli / 1_000)} → ${Math.round((tutorial.finalHpBeforeRescueMilli ?? state.player.hp) / 1_000)}，当前 ${Math.round(state.player.hp / 1_000)}`,
    hitLabel: `正面 ${hits.direct} · 走位 ${hits.miss} · 引雷 ${hits.rod} · 擦弹 ${hits.blocked}`,
    temperingLabel: `${Math.round(tutorial.rawTemperingMilli / 1_000)} 点雷劫淬炼记录`,
    rewardLabel: survived ? `淬体与修为各 +${Math.round(tutorial.rewardMilli / 1_000)}` : '本次不发放淬体奖励',
    nextLabel: survived ? '返回农庄，四段试玩旅程即告完成。' : '返回后会补回教学药包，可重新炼丹再试。',
    continueDisabled: tutorial.phase !== 'aftermath'
  };
}
