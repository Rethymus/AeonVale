import type { GameState, LocationId } from '@sim';
import type { LocationServiceCommand } from '@sim/world/locations';
import type { OnboardingObjectiveId } from '@sim/story/onboarding';
import { DEFAULT_BALANCE, greenhouseClimate, greenhouseVisitFlag, teaShedVisitFlag } from '@sim';
import { readyForBreakthrough } from '@sim/progression/progression';
import { getFarmsteadFocus } from './farmsteadFocus';
import { tribulationPrepFocusReason } from './tribulationPrepText';

export function locationPreviewFocusReason(state: GameState, objectiveId: OnboardingObjectiveId | null, locationId: LocationId, command: LocationServiceCommand | null, encounterCount: number): string | undefined {
  if (objectiveId === 'first-market-restock' && locationId === 'valley-market' && command === 'browse-shop') {
    return '先补几颗种子，把第二轮药材和炼丹材料接上。';
  }
  if (objectiveId === 'first-second-sow' && locationId === 'farmstead' && command === 'show-farm-work') {
    return '回农庄把刚买到的种子播回田里，让药材不断档。';
  }
  if (objectiveId === 'first-loop-complete' && locationId === 'farmstead' && command === 'show-processing') {
    return '首轮农务已成，回农庄点“农务”把余货先排进加工，再接炼丹、阵法与备劫。';
  }
  if (objectiveId === 'first-sleep' && locationId === 'farmstead') {
    return '今日农务已收尾，直接过夜等次日结算。';
  }

  if (command === 'show-location-encounter' && encounterCount > 0) {
    return '这里有人停留，顺手摸清今日动向。';
  }

  if (locationId === 'farmstead' && readyForBreakthrough(state, DEFAULT_BALANCE)) {
    return tribulationPrepFocusReason(state);
  }

  if (locationId === 'farmstead') {
    const farmsteadFocus = getFarmsteadFocus(state);
    if (farmsteadFocus.locationReason) return farmsteadFocus.locationReason;
  }

  switch (command) {
    case 'browse-shop':
      return '缺种子、药包或补给时，先从这里续上节奏。';
    case 'browse-trade':
      return '手里有余货时，先看看今天能换到什么。';
    case 'show-commission':
      return '委托与差事都从这里接续。';
    case 'show-farm-work':
      return '翻地、补种、浇水、收获与出货都从这里收口。';
    case 'show-processing':
      return '库存要封藏、炼丹或转阵材时，先来排加工。';
    case 'show-archive':
      return '多余收获能在这里换成长期推进。';
    case 'explore-ruin':
      return '想摸遗迹收益时，先从外层稳着试探。';
    case 'delve-ruin':
      return '状态足够再往深处压，别让体力断在半路。';
    case 'explore-valley':
      return '缺早期素材时，这里是最稳的外出起点。';
    case 'explore-spirit-vein':
      return '收益更高，但先确认体力和补给扛得住。';
    case 'show-tea-shed':
      if (state.postAscension.mode !== 'stayed-in-world') {
        return '留世后可来这里歇脚听闻，先记住这处日常落点。';
      }
      if (state.flags.has(teaShedVisitFlag(state.day))) {
        return '今日茶棚已歇过脚，先把传闻记下，再转去别处推进。';
      }
      return '先来歇脚回气，把今日传闻和人情一起收下。';
    case 'show-greenhouse':
      if (state.postAscension.mode !== 'stayed-in-world') {
        return '留世后可来这里养护育苗，先把这条后续经营线记住。';
      }
      if (state.flags.has(greenhouseVisitFlag(state.day))) {
        return '今日暖棚已养护过，先把棚里成果接走，再回主线农务。';
      }
      if (greenhouseClimate(state) < 35_000) {
        return '棚势偏弱，今天先来回暖，免得离季苗势继续塌。';
      }
      return '先巡暖棚，把育苗与回养节奏稳在今天这轮。';
    case 'show-arrays':
      return '阵器与农庄小阵在这里维护，把产出转成导雷阵势。';
    case 'browse-festival-stall':
      return '节日限定货只在当下，先看完再回日常。';
    case 'show-festival':
      return '节日事件窗口短，先把当期内容吃满。';
    default:
      return encounterCount > 0 ? '这里今日有些动静，值得顺手看一眼。' : undefined;
  }
}
