import type { GameState } from '@sim/world/state';
import { emit } from '@sim/world/state';
import { MILLI } from '@sim/world/types';
import { ensureStayingWorldState } from './stayingWorld';
import { inventoryCanFitRewards, itemCount, mutateItem } from '@sim/world/player';
import { applyGuardBeastIncidentAssistBond, applyGuardBeastSpecialtyProgress, guardBeastMasteryReady, guardBeastSpecialtyReady, preferredGuardBeastForPatrol } from '@sim/celestial/beastSystem';
import type { SimContext } from '@sim/world/context';
import { activeArraysCoveringTile } from '@sim/tribulation/arrays';
import { greenhouseVisitFlag } from '@sim/social/greenhouse';

export interface StayingWorldIncidentDef {
  id: string;
  title: string;
  summary: string;
  itemId: string;
  count: number;
  pressureRelief: number;
}

export interface ResolveStayingWorldIncidentResult {
  ok: boolean;
  incident: StayingWorldIncidentDef | null;
  reason?: string;
}

interface GuardBeastIncidentAssist {
  beastId: number;
  vigorCost: number;
  pressureReliefBonus: number;
  patrolTileId?: number;
  spentCountOverride?: number;
  specialtyProgress?: 'field-ward' | 'array-warden' | 'courier';
  mastery?: boolean;
}

export const STAYING_WORLD_INCIDENT_CATALOG: readonly StayingWorldIncidentDef[] = [
  {
    id: 'incident.beast-trace',
    title: '妖兽侵田痕',
    summary: '田埂边留下妖兽抓痕，需补上守境用的内丹药引，免得下一夜再来试探。',
    itemId: 'item.beast-core',
    count: 1,
    pressureRelief: 8 * MILLI
  },
  {
    id: 'incident.array-fray',
    title: '残脉阵脚松动',
    summary: '村口护田阵的旧残件又松了一处，得补上破损法宝碎件，先把阵脚重新压稳。',
    itemId: 'item.broken-talisman',
    count: 1,
    pressureRelief: 7 * MILLI
  },
  {
    id: 'incident.herb-relief',
    title: '村镇求援药包',
    summary: '邻里来求止血与调息药草，先把药包凑齐，别让小伤拖成乱象。',
    itemId: 'herb.mossling',
    count: 2,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.wanderer-aid',
    title: '散修求援',
    summary: '过路散修伤了根基，求一份晾晒灵草调息，别让坊间见死不救的传闻散开。',
    itemId: 'item.dried-herb',
    count: 1,
    pressureRelief: 7 * MILLI
  },
  {
    id: 'incident.seasonal-blight',
    title: '节令灾异',
    summary: '反季寒流夜扫灵田，护不稳的苗根要伤一阵；得借棚里稳住的微气候，再以灵壤肥培根固本。',
    itemId: 'item.spirit-compost',
    count: 1,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.warden-commission',
    title: '巡守委托',
    summary: '镇上邻里凑份灵石，请巡守加一段夜防；备好酬金，换几夜安稳。',
    itemId: 'item.spirit-stone',
    count: 2,
    pressureRelief: 5 * MILLI
  },
  {
    id: 'incident.spirit-vein-flare',
    title: '灵脉波动',
    summary: '地下灵脉忽生波动，田里灵气乱窜；得以残卷镇脉，或借修为深厚的体修与巡守兽合力稳住。',
    itemId: 'item.recipe-fragment',
    count: 1,
    pressureRelief: 7 * MILLI
  },
  {
    id: 'incident.inner-demon-flare',
    title: '心魔反扑',
    summary: '留世日久，心魔借旧念反扑；得以封藏灵草稳住神识，或凭定力与巡守兽镇住心神。',
    itemId: 'item.sealed-herb',
    count: 1,
    pressureRelief: 7 * MILLI
  },
  {
    id: 'incident.frost-blight',
    title: '霜害侵田',
    summary: '夜里骤霜扫过灵田，未护住的苗易冻伤；得以露根草覆根御寒，或借巡守兽连夜护田。',
    itemId: 'herb.dewroot',
    count: 2,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.lifespan-omen',
    title: '寿元警报',
    summary: '寿元将尽之兆隐隐浮现，得以灵药酒固本培元，或借巡守兽夜守分忧，把这一截时日再争回来。',
    itemId: 'item.herbal-wine',
    count: 1,
    pressureRelief: 7 * MILLI
  },
  {
    id: 'incident.beast-tide-omen',
    title: '妖潮预兆',
    summary: '远山妖气翻涌，似有妖潮将至；得以灵药膏备好疗伤底药，或借巡守兽提前巡守，把这一波压在山外。',
    itemId: 'item.spirit-poultice',
    count: 1,
    pressureRelief: 7 * MILLI
  },
  {
    id: 'incident.qi-drift',
    title: '灵气涣散',
    summary: '田里灵气忽然涣散难聚；得以阵核压稳灵脉，或借巡守兽巡田引气，把涣散的灵机重新拢回土里。',
    itemId: 'item.array-core',
    count: 1,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.wind-erosion',
    title: '风蚀灵田',
    summary: '连日干风刮走表土灵机，苗根松动；得以朝阳菇培土固根，或借巡守兽挡风护苗。',
    itemId: 'herb.suncap',
    count: 2,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.miasma-seep',
    title: '瘴气渗田',
    summary: '残脉深处渗出瘴气，伤苗伤根；得以和合叶化浊解毒，或借巡守兽巡田驱瘴。',
    itemId: 'herb.balmleaf',
    count: 2,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.spirit-stone-tribute',
    title: '灵石献祭',
    summary: '镇上祭坛需一份灵石献祭以安地脉；备好灵石，或借巡守兽代为押运，把这一祭办稳。',
    itemId: 'item.spirit-stone',
    count: 3,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.merchant-caravan',
    title: '商队过境',
    summary: '远来商队缺干粮调息，求一份晾晒灵草应急；得以晾晒灵草接济，或借巡守兽代为押货。',
    itemId: 'item.dried-herb',
    count: 2,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.formation-collapse',
    title: '阵势崩塌',
    summary: '村口旧阵终于撑不住崩了一角，碎件四散；得以破损法宝补阵，或借巡守兽清场固基。',
    itemId: 'item.broken-talisman',
    count: 2,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.hermit-visit',
    title: '隐士造访',
    summary: '云游隐士登门论道，求一份丹方残卷印证；得以残卷相赠，或借巡守兽引路护行。',
    itemId: 'item.recipe-fragment',
    count: 2,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.beast-core-bounty',
    title: '内丹悬赏',
    summary: '镇上悬赏收购妖兽内丹以炼镇山阵；备好内丹应募，或借巡守兽猎妖代缴。',
    itemId: 'item.beast-core',
    count: 2,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.mistfern-ritual',
    title: '雾蕨祭礼',
    summary: '村中祭礼需雾蕨熏香净场；得以雾蕨应供，或借巡守兽入山采办。',
    itemId: 'herb.mistfern',
    count: 2,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.frostmarrow-ward',
    title: '寒髓镇邪',
    summary: '阴邪夜犯，需寒髓莲镇阴护场；得以寒髓莲应供，或借巡守兽守夜驱邪。',
    itemId: 'herb.frostmarrow',
    count: 2,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.compost-offering',
    title: '灵壤供奉',
    summary: '春耕前需灵壤肥祭土祈丰；得以灵壤肥供奉，或借巡守兽押运培土。',
    itemId: 'item.spirit-compost',
    count: 2,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.array-core-tribute',
    title: '阵核供奉',
    summary: '镇山阵需阵核压阵镇煞；得以阵核应供，或借巡守兽押运镇守。',
    itemId: 'item.array-core',
    count: 2,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.sealed-tribute',
    title: '封藏供奉',
    summary: '祭典需封藏灵草作高阶供奉；得以封藏灵草应供，或借巡守兽押运入库。',
    itemId: 'item.sealed-herb',
    count: 2,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.mossling-cleanup',
    title: '青苔清理',
    summary: '田埂青苔疯长壅住灵苗，需连根清理；得以青苔堆肥，或借巡守兽翻地清场。',
    itemId: 'herb.mossling',
    count: 3,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.wine-offering',
    title: '药酒供奉',
    summary: '祭祖需灵药酒洒地敬先；得以药酒应供，或借巡守兽押运奠酒。',
    itemId: 'item.herbal-wine',
    count: 2,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.poultice-stockpile',
    title: '药膏备储',
    summary: '镇上医馆需灵药膏备储疗伤；得以药膏应供，或借巡守兽押运入库。',
    itemId: 'item.spirit-poultice',
    count: 2,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.dried-herb-stockpile',
    title: '晾晒灵草备储',
    summary: '过冬前需大量晾晒灵草备储；得以晾晒灵草应供，或借巡守兽晒场翻理。',
    itemId: 'item.dried-herb',
    count: 3,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.guard-relief',
    title: '守军劳军',
    summary: '镇守军连日疲劳，需灵石犒赏提振；备好灵石劳军，或借巡守兽代为押饷。',
    itemId: 'item.spirit-stone',
    count: 4,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.beast-pelt-tribute',
    title: '兽皮供奉',
    summary: '祭典需妖兽内丹作镇煞供奉；备好内丹应供，或借巡守兽猎妖代缴。',
    itemId: 'item.beast-core',
    count: 3,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.stonegrain-relief',
    title: '粟石草济荒',
    summary: '荒月粮荒，邻里需粟石草度日；得以粟石草接济，或借巡守兽押粮放赈。',
    itemId: 'herb.stonegrain',
    count: 2,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.broken-talisman-tribute',
    title: '法宝碎件供奉',
    summary: '铸器坊需大量破损法宝熔炼阵核；得以碎件应供，或借巡守兽拆解代缴。',
    itemId: 'item.broken-talisman',
    count: 3,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.mistfern-feast',
    title: '雾蕨宴',
    summary: '村宴需大量雾蕨入菜待客；得以雾蕨应供，或借巡守兽入山采办。',
    itemId: 'herb.mistfern',
    count: 3,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.compost-field-rite',
    title: '灵壤肥田祭',
    summary: '丰年祭需灵壤肥撒田谢土；得以灵壤肥应供，或借巡守兽押运培土。',
    itemId: 'item.spirit-compost',
    count: 3,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.dewroot-tonic',
    title: '露根草汤药',
    summary: '时疫流行，医馆需露根草熬汤防疫；得以露根草应供，或借巡守兽掘根采办。',
    itemId: 'herb.dewroot',
    count: 3,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.balmleaf-tonic',
    title: '和合叶汤药',
    summary: '时疫后期需和合叶调息养神；得以和合叶应供，或借巡守兽入山采办。',
    itemId: 'herb.balmleaf',
    count: 3,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.suncap-feast',
    title: '朝阳菇宴',
    summary: '丰收宴需大量朝阳菇入席；得以朝阳菇应供，或借巡守兽采办。',
    itemId: 'herb.suncap',
    count: 3,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.stonegrain-feast',
    title: '粟石草宴',
    summary: '丰收宴需粟石草酿酒待客；得以粟石草应供，或借巡守兽押粮。',
    itemId: 'herb.stonegrain',
    count: 3,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.recipe-archive',
    title: '残卷归档',
    summary: '藏经阁需残卷归档补全传承；得以残卷应供，或借巡守兽押运入库。',
    itemId: 'item.recipe-fragment',
    count: 3,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.array-core-stockpile',
    title: '阵核备储',
    summary: '阵坊需大量阵核备储修阵；得以阵核应供，或借巡守兽熔炼代缴。',
    itemId: 'item.array-core',
    count: 3,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.sealed-archive',
    title: '封藏归档',
    summary: '藏经阁需封藏灵草归档存证；得以封藏灵草应供，或借巡守兽押运入库。',
    itemId: 'item.sealed-herb',
    count: 3,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.wine-archive',
    title: '药酒归档',
    summary: '藏经阁需灵药酒归档品鉴存证；得以药酒应供，或借巡守兽押运入库。',
    itemId: 'item.herbal-wine',
    count: 3,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.poultice-archive',
    title: '药膏归档',
    summary: '医馆需灵药膏归档备灾；得以药膏应供，或借巡守兽押运入库。',
    itemId: 'item.spirit-poultice',
    count: 3,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.spirit-stone-festival',
    title: '灵石节祭',
    summary: '岁末大祭需大量灵石镇场；备好灵石应祭，或借巡守兽代为押运。',
    itemId: 'item.spirit-stone',
    count: 5,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.talisman-forge',
    title: '法宝铸坊',
    summary: '铸坊需大量破损法宝批量熔炼；得以碎件应供，或借巡守兽拆解代缴。',
    itemId: 'item.broken-talisman',
    count: 4,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.beast-core-forge',
    title: '内丹铸坊',
    summary: '铸坊需大量妖兽内丹炼制镇器；得以内丹应供，或借巡守兽猎妖代缴。',
    itemId: 'item.beast-core',
    count: 4,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.array-core-forge',
    title: '阵核铸坊',
    summary: '阵坊需大量阵核批量铸阵；得以阵核应供，或借巡守兽熔炼代缴。',
    itemId: 'item.array-core',
    count: 4,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.compost-forge',
    title: '灵壤堆坊',
    summary: '农社需大量灵壤肥批量堆沤；得以灵壤肥应供，或借巡守兽押运堆沤。',
    itemId: 'item.spirit-compost',
    count: 4,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.sealed-forge',
    title: '封藏铸坊',
    summary: '工坊需大量封藏灵草批量炼材；得以封藏灵草应供，或借巡守兽押运入库。',
    itemId: 'item.sealed-herb',
    count: 4,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.dried-herb-forge',
    title: '晾晒铸坊',
    summary: '工坊需大量晾晒灵草批量脱水；得以晾晒灵草应供，或借巡守兽晒场翻理。',
    itemId: 'item.dried-herb',
    count: 4,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.wine-forge',
    title: '药酒铸坊',
    summary: '工坊需大量灵药酒批量陈酿；得以药酒应供，或借巡守兽押运入库。',
    itemId: 'item.herbal-wine',
    count: 4,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.poultice-forge',
    title: '药膏铸坊',
    summary: '医馆需大量灵药膏批量熬制备灾；得以药膏应供，或借巡守兽押运入库。',
    itemId: 'item.spirit-poultice',
    count: 4,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.recipe-archive-bulk',
    title: '残卷大批归档',
    summary: '藏经阁岁末需大量残卷大批归档补全；得以残卷应供，或借巡守兽押运入库。',
    itemId: 'item.recipe-fragment',
    count: 4,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.spirit-stone-tribute-bulk',
    title: '灵石大批献祭',
    summary: '岁末大祭需海量灵石献祭镇场；备好灵石应祭，或借巡守兽代为押运。',
    itemId: 'item.spirit-stone',
    count: 6,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.beast-core-bulk',
    title: '内丹大批',
    summary: '铸坊岁末需大量内丹大批炼制镇器；得以内丹应供，或借巡守兽猎妖代缴。',
    itemId: 'item.beast-core',
    count: 5,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.talisman-bulk',
    title: '碎件大批',
    summary: '铸坊岁末需大量碎件大批熔炼阵核；得以碎件应供，或借巡守兽拆解代缴。',
    itemId: 'item.broken-talisman',
    count: 5,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.mossling-bulk',
    title: '青苔大批',
    summary: '农社岁末需大量青苔大批堆肥备春耕；得以青苔应供，或借巡守兽翻地清场。',
    itemId: 'herb.mossling',
    count: 4,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.sealed-bulk',
    title: '封藏大批',
    summary: '工坊岁末需大量封藏灵草大批炼材；得以封藏灵草应供，或借巡守兽押运入库。',
    itemId: 'item.sealed-herb',
    count: 5,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.dewroot-bulk',
    title: '露根草大批',
    summary: '农社岁末需大量露根草大批储药备冬；得以露根草应供，或借巡守兽掘根采办。',
    itemId: 'herb.dewroot',
    count: 4,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.suncap-bulk',
    title: '朝阳菇大批',
    summary: '农社岁末需大量朝阳菇大批晒干备冬；得以朝阳菇应供，或借巡守兽采办。',
    itemId: 'herb.suncap',
    count: 4,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.stonegrain-bulk',
    title: '粟石草大批',
    summary: '农社岁末需大量粟石草大批储粮备冬；得以粟石草应供，或借巡守兽押粮。',
    itemId: 'herb.stonegrain',
    count: 4,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.balmleaf-bulk',
    title: '和合叶大批',
    summary: '医馆岁末需大量和合叶大批储药备冬；得以和合叶应供，或借巡守兽入山采办。',
    itemId: 'herb.balmleaf',
    count: 4,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.recipe-bulk',
    title: '残卷大批',
    summary: '藏经阁岁末需大量残卷大批归档；得以残卷应供，或借巡守兽押运入库。',
    itemId: 'item.recipe-fragment',
    count: 5,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.wine-bulk',
    title: '药酒大批',
    summary: '工坊岁末需大量灵药酒大批陈酿入库；得以药酒应供，或借巡守兽押运入库。',
    itemId: 'item.herbal-wine',
    count: 5,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.poultice-bulk',
    title: '药膏大批',
    summary: '医馆岁末需大量灵药膏大批熬制备灾；得以药膏应供，或借巡守兽押运入库。',
    itemId: 'item.spirit-poultice',
    count: 5,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.dried-herb-bulk',
    title: '晾晒灵草大批',
    summary: '工坊岁末需大量晾晒灵草大批脱水备冬；得以晾晒灵草应供，或借巡守兽晒场翻理。',
    itemId: 'item.dried-herb',
    count: 5,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.array-core-bulk',
    title: '阵核大批',
    summary: '阵坊岁末需大量阵核大批铸阵备冬；得以阵核应供，或借巡守兽熔炼代缴。',
    itemId: 'item.array-core',
    count: 5,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.compost-bulk',
    title: '灵壤肥大批',
    summary: '农社岁末需大量灵壤肥大批堆沤备春耕；得以灵壤肥应供，或借巡守兽押运堆沤。',
    itemId: 'item.spirit-compost',
    count: 5,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.spirit-stone-grand',
    title: '灵石大祭',
    summary: '十年大典需海量灵石镇场祭天；备好灵石应祭，或借巡守兽代为押运。',
    itemId: 'item.spirit-stone',
    count: 8,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.beast-core-grand',
    title: '内丹大祭',
    summary: '十年大典需海量妖兽内丹炼制镇山重器；备好内丹应供，或借巡守兽猎妖代缴。',
    itemId: 'item.beast-core',
    count: 6,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.talisman-grand',
    title: '碎件大祭',
    summary: '十年大典需海量破损法宝熔炼镇山重器；得以碎件应供，或借巡守兽拆解代缴。',
    itemId: 'item.broken-talisman',
    count: 6,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.sealed-grand',
    title: '封藏大祭',
    summary: '十年大典需海量封藏灵草炼制镇山灵丹；得以封藏灵草应供，或借巡守兽押运入库。',
    itemId: 'item.sealed-herb',
    count: 6,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.array-core-grand',
    title: '阵核大祭',
    summary: '十年大典需海量阵核铸制镇山大阵；得以阵核应供，或借巡守兽熔炼代缴。',
    itemId: 'item.array-core',
    count: 6,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.compost-grand',
    title: '灵壤肥大祭',
    summary: '十年大典需海量灵壤肥祭土祈福丰年；得以灵壤肥应供，或借巡守兽押运培土。',
    itemId: 'item.spirit-compost',
    count: 6,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.dried-herb-grand',
    title: '晾晒灵草大祭',
    summary: '十年大典需海量晾晒灵草祭祖；得以晾晒灵草应供，或借巡守兽晒场翻理。',
    itemId: 'item.dried-herb',
    count: 6,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.wine-grand',
    title: '药酒大祭',
    summary: '十年大典需海量灵药酒洒地敬先；得以药酒应供，或借巡守兽押运奠酒。',
    itemId: 'item.herbal-wine',
    count: 6,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.poultice-grand',
    title: '药膏大祭',
    summary: '十年大典需海量灵药膏熬制镇灾灵丹；得以药膏应供，或借巡守兽押运入库。',
    itemId: 'item.spirit-poultice',
    count: 6,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.recipe-grand',
    title: '残卷大祭',
    summary: '十年大典需海量丹方残卷补全传承大典；得以残卷应供，或借巡守兽押运入库。',
    itemId: 'item.recipe-fragment',
    count: 6,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.mossling-grand',
    title: '青苔大祭',
    summary: '十年大典需海量青苔堆肥祭土祈福；得以青苔应供，或借巡守兽翻地清场。',
    itemId: 'herb.mossling',
    count: 5,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.dewroot-grand',
    title: '露根草大祭',
    summary: '十年大典需海量露根草熬汤祈福防疫；得以露根草应供，或借巡守兽掘根采办。',
    itemId: 'herb.dewroot',
    count: 5,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.suncap-grand',
    title: '朝阳菇大祭',
    summary: '十年大典需海量朝阳菇入宴待客；得以朝阳菇应供，或借巡守兽采办。',
    itemId: 'herb.suncap',
    count: 5,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.stonegrain-grand',
    title: '粟石草大祭',
    summary: '十年大典需海量粟石草酿酒祭祖；得以粟石草应供，或借巡守兽押粮。',
    itemId: 'herb.stonegrain',
    count: 5,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.balmleaf-grand',
    title: '和合叶大祭',
    summary: '十年大典需海量和合叶熬汤祈福防疫；得以和合叶应供，或借巡守兽入山采办。',
    itemId: 'herb.balmleaf',
    count: 5,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.mistfern-grand',
    title: '雾蕨大祭',
    summary: '十年大典需海量雾蕨熏香净场祈福；得以雾蕨应供，或借巡守兽入山采办。',
    itemId: 'herb.mistfern',
    count: 5,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.frostmarrow-grand',
    title: '寒髓莲大祭',
    summary: '百年大典需海量寒髓莲镇阴护场；得以寒髓莲应供，或借巡守兽守夜驱邪。',
    itemId: 'herb.frostmarrow',
    count: 5,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.spirit-stone-centennial',
    title: '百年灵石祭',
    summary: '百年大典需海量灵石祭天镇脉；备好灵石应祭，或借巡守兽代为押运。',
    itemId: 'item.spirit-stone',
    count: 10,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.beast-core-centennial',
    title: '百年内丹祭',
    summary: '百年大典需海量妖兽内丹炼制镇山重器；备好内丹应供，或借巡守兽猎妖代缴。',
    itemId: 'item.beast-core',
    count: 8,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.talisman-centennial',
    title: '百年碎件祭',
    summary: '百年大典需海量破损法宝熔炼镇山重器；得以碎件应供，或借巡守兽拆解代缴。',
    itemId: 'item.broken-talisman',
    count: 8,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.sealed-centennial',
    title: '百年封藏祭',
    summary: '百年大典需海量封藏灵草炼制镇山灵丹；得以封藏灵草应供，或借巡守兽押运入库。',
    itemId: 'item.sealed-herb',
    count: 8,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.dried-herb-centennial',
    title: '百年晾晒祭',
    summary: '百年大典需海量晾晒灵草祭祖；得以晾晒灵草应供，或借巡守兽晒场翻理。',
    itemId: 'item.dried-herb',
    count: 8,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.wine-centennial',
    title: '百年药酒祭',
    summary: '百年大典需海量灵药酒洒地敬先；得以药酒应供，或借巡守兽押运奠酒。',
    itemId: 'item.herbal-wine',
    count: 8,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.poultice-centennial',
    title: '百年药膏祭',
    summary: '百年大典需海量灵药膏熬制镇灾灵丹；得以药膏应供，或借巡守兽押运入库。',
    itemId: 'item.spirit-poultice',
    count: 8,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.recipe-centennial',
    title: '百年残卷祭',
    summary: '百年大典需海量丹方残卷补全传承大典；得以残卷应供，或借巡守兽押运入库。',
    itemId: 'item.recipe-fragment',
    count: 8,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.array-core-centennial',
    title: '百年阵核祭',
    summary: '百年大典需海量阵核铸制镇山大阵；得以阵核应供，或借巡守兽熔炼代缴。',
    itemId: 'item.array-core',
    count: 8,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.compost-centennial',
    title: '百年灵壤肥祭',
    summary: '百年大典需海量灵壤肥祭土祈福万年丰年；得以灵壤肥应供，或借巡守兽押运培土。',
    itemId: 'item.spirit-compost',
    count: 8,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.spirit-stone-millennium',
    title: '千年纪元灵石祭',
    summary: '千年纪元大典需海量灵石镇场祭天；备好灵石应祭，或借巡守兽代为押运。',
    itemId: 'item.spirit-stone',
    count: 12,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.beast-core-millennium',
    title: '千年内丹祭',
    summary: '千年纪元大典需海量妖兽内丹炼制镇山重器；备好内丹应供，或借巡守兽猎妖代缴。',
    itemId: 'item.beast-core',
    count: 10,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.talisman-millennium',
    title: '千年碎件祭',
    summary: '千年纪元大典需海量破损法宝熔炼镇山重器；得以碎件应供，或借巡守兽拆解代缴。',
    itemId: 'item.broken-talisman',
    count: 10,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.sealed-millennium',
    title: '千年封藏祭',
    summary: '千年纪元大典需海量封藏灵草炼制镇山灵丹；得以封藏灵草应供，或借巡守兽押运入库。',
    itemId: 'item.sealed-herb',
    count: 10,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.dried-herb-millennium',
    title: '千年晾晒祭',
    summary: '千年纪元大典需海量晾晒灵草祭祖；得以晾晒灵草应供，或借巡守兽晒场翻理。',
    itemId: 'item.dried-herb',
    count: 10,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.wine-millennium',
    title: '千年药酒祭',
    summary: '千年纪元大典需海量灵药酒洒地敬先；得以药酒应供，或借巡守兽押运奠酒。',
    itemId: 'item.herbal-wine',
    count: 10,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.poultice-millennium',
    title: '千年药膏祭',
    summary: '千年纪元大典需海量灵药膏熬制镇灾灵丹；得以药膏应供，或借巡守兽押运入库。',
    itemId: 'item.spirit-poultice',
    count: 10,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.recipe-millennium',
    title: '千年残卷祭',
    summary: '千年纪元大典需海量丹方残卷补全传承大典；得以残卷应供，或借巡守兽押运入库。',
    itemId: 'item.recipe-fragment',
    count: 10,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.array-core-millennium',
    title: '千年阵核祭',
    summary: '千年纪元大典需海量阵核铸制镇山大阵；得以阵核应供，或借巡守兽熔炼代缴。',
    itemId: 'item.array-core',
    count: 10,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.compost-millennium',
    title: '千年灵壤肥祭',
    summary: '千年纪元大典需海量灵壤肥祭土祈福万年丰年；得以灵壤肥应供，或借巡守兽押运培土。',
    itemId: 'item.spirit-compost',
    count: 10,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.spirit-stone-eternal',
    title: '万古灵石祭',
    summary: '万古纪元大典需海量灵石镇场祭天永镇山门；备好灵石应祭，或借巡守兽代为押运。',
    itemId: 'item.spirit-stone',
    count: 15,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.beast-core-eternal',
    title: '万古内丹祭',
    summary: '万古纪元大典需海量妖兽内丹炼制镇山重器永镇山门；备好内丹应供，或借巡守兽猎妖代缴。',
    itemId: 'item.beast-core',
    count: 12,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.talisman-eternal',
    title: '万古碎件祭',
    summary: '万古纪元大典需海量破损法宝熔炼镇山重器永镇山门；得以碎件应供，或借巡守兽拆解代缴。',
    itemId: 'item.broken-talisman',
    count: 12,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.sealed-eternal',
    title: '万古封藏祭',
    summary: '万古纪元大典需海量封藏灵草炼制镇山灵丹永镇山门；得以封藏灵草应供，或借巡守兽押运入库。',
    itemId: 'item.sealed-herb',
    count: 12,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.dried-herb-eternal',
    title: '万古晾晒祭',
    summary: '万古纪元大典需海量晾晒灵草祭祖永镇山门；得以晾晒灵草应供，或借巡守兽晒场翻理。',
    itemId: 'item.dried-herb',
    count: 12,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.wine-eternal',
    title: '万古药酒祭',
    summary: '万古纪元大典需海量灵药酒洒地敬先永镇山门；得以药酒应供，或借巡守兽押运奠酒。',
    itemId: 'item.herbal-wine',
    count: 12,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.poultice-eternal',
    title: '万古药膏祭',
    summary: '万古纪元大典需海量灵药膏熬制镇灾灵丹永镇山门；得以药膏应供，或借巡守兽押运入库。',
    itemId: 'item.spirit-poultice',
    count: 12,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.recipe-eternal',
    title: '万古残卷祭',
    summary: '万古纪元大典需海量丹方残卷补全传承大典永镇山门；得以残卷应供，或借巡守兽押运入库。',
    itemId: 'item.recipe-fragment',
    count: 12,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.array-core-eternal',
    title: '万古阵核祭',
    summary: '万古纪元大典需海量阵核铸制镇山大阵永镇山门；得以阵核应供，或借巡守兽熔炼代缴。',
    itemId: 'item.array-core',
    count: 12,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.compost-eternal',
    title: '万古灵壤肥祭',
    summary: '万古纪元大典需海量灵壤肥祭土祈福万年丰年永镇山门；得以灵壤肥应供，或借巡守兽押运培土。',
    itemId: 'item.spirit-compost',
    count: 12,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.spirit-stone-final',
    title: '终焉灵石祭',
    summary: '终焉大典需终量灵石镇场祭天永定山门气运；备好灵石应祭，或借巡守兽代为押运。',
    itemId: 'item.spirit-stone',
    count: 20,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.beast-core-final',
    title: '终焉内丹祭',
    summary: '终焉大典需终量妖兽内丹炼制镇山重器永定山门；备好内丹应供，或借巡守兽猎妖代缴。',
    itemId: 'item.beast-core',
    count: 15,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.talisman-final',
    title: '终焉碎件祭',
    summary: '终焉大典需终量破损法宝熔炼镇山重器永定山门；得以碎件应供，或借巡守兽拆解代缴。',
    itemId: 'item.broken-talisman',
    count: 15,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.sealed-final',
    title: '终焉封藏祭',
    summary: '终焉大典需终量封藏灵草炼制镇山灵丹永定山门；得以封藏灵草应供，或借巡守兽押运入库。',
    itemId: 'item.sealed-herb',
    count: 15,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.dried-herb-final',
    title: '终焉晾晒祭',
    summary: '终焉大典需终量晾晒灵草祭祖永定山门；得以晾晒灵草应供，或借巡守兽晒场翻理。',
    itemId: 'item.dried-herb',
    count: 15,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.wine-final',
    title: '终焉药酒祭',
    summary: '终焉大典需终量灵药酒洒地敬先永定山门；得以药酒应供，或借巡守兽押运奠酒。',
    itemId: 'item.herbal-wine',
    count: 15,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.poultice-final',
    title: '终焉药膏祭',
    summary: '终焉大典需终量灵药膏熬制镇灾灵丹永定山门；得以药膏应供，或借巡守兽押运入库。',
    itemId: 'item.spirit-poultice',
    count: 15,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.recipe-final',
    title: '终焉残卷祭',
    summary: '终焉大典需终量丹方残卷补全传承大典永定山门；得以残卷应供，或借巡守兽押运入库。',
    itemId: 'item.recipe-fragment',
    count: 15,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.array-core-final',
    title: '终焉阵核祭',
    summary: '终焉大典需终量阵核铸制镇山大阵永定山门；得以阵核应供，或借巡守兽熔炼代缴。',
    itemId: 'item.array-core',
    count: 15,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.compost-final',
    title: '终焉灵壤肥祭',
    summary: '终焉大典需终量灵壤肥祭土祈福万年丰年永定山门；得以灵壤肥应供，或借巡守兽押运培土。',
    itemId: 'item.spirit-compost',
    count: 15,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.spirit-stone-ultimate',
    title: '终极灵石祭',
    summary: '终极大典需终极量灵石镇场祭天永定山门气运；备好灵石应祭，或借巡守兽代为押运。',
    itemId: 'item.spirit-stone',
    count: 25,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.beast-core-ultimate',
    title: '终极内丹祭',
    summary: '终极大典需终极量妖兽内丹炼制镇山重器永定山门；备好内丹应供，或借巡守兽猎妖代缴。',
    itemId: 'item.beast-core',
    count: 20,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.talisman-ultimate',
    title: '终极碎件祭',
    summary: '终极大典需终极量破损法宝熔炼镇山重器永定山门；得以碎件应供，或借巡守兽拆解代缴。',
    itemId: 'item.broken-talisman',
    count: 20,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.sealed-ultimate',
    title: '终极封藏祭',
    summary: '终极大典需终极量封藏灵草炼制镇山灵丹永定山门；得以封藏灵草应供，或借巡守兽押运入库。',
    itemId: 'item.sealed-herb',
    count: 20,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.dried-herb-ultimate',
    title: '终极晾晒祭',
    summary: '终极大典需终极量晾晒灵草祭祖永定山门；得以晾晒灵草应供，或借巡守兽晒场翻理。',
    itemId: 'item.dried-herb',
    count: 20,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.wine-ultimate',
    title: '终极药酒祭',
    summary: '终极大典需终极量灵药酒洒地敬先永定山门；得以药酒应供，或借巡守兽押运奠酒。',
    itemId: 'item.herbal-wine',
    count: 20,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.poultice-ultimate',
    title: '终极药膏祭',
    summary: '终极大典需终极量灵药膏熬制镇灾灵丹永定山门；得以药膏应供，或借巡守兽押运入库。',
    itemId: 'item.spirit-poultice',
    count: 20,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.recipe-ultimate',
    title: '终极残卷祭',
    summary: '终极大典需终极量丹方残卷补全传承大典永定山门；得以残卷应供，或借巡守兽押运入库。',
    itemId: 'item.recipe-fragment',
    count: 20,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.array-core-ultimate',
    title: '终极阵核祭',
    summary: '终极大典需终极量阵核铸制镇山大阵永定山门；得以阵核应供，或借巡守兽熔炼代缴。',
    itemId: 'item.array-core',
    count: 20,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.compost-ultimate',
    title: '终极灵壤肥祭',
    summary: '终极大典需终极量灵壤肥祭土祈福万年丰年永定山门；得以灵壤肥应供，或借巡守兽押运培土。',
    itemId: 'item.spirit-compost',
    count: 20,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.spirit-stone-supreme',
    title: '无上灵石祭',
    summary: '无上大典需无上量灵石镇场祭天永定山门气运；备好灵石应祭，或借巡守兽代为押运。',
    itemId: 'item.spirit-stone',
    count: 30,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.beast-core-supreme',
    title: '无上内丹祭',
    summary: '无上大典需无上量妖兽内丹炼制镇山重器永定山门；备好内丹应供，或借巡守兽猎妖代缴。',
    itemId: 'item.beast-core',
    count: 25,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.talisman-supreme',
    title: '无上碎件祭',
    summary: '无上大典需无上量破损法宝熔炼镇山重器永定山门；得以碎件应供，或借巡守兽拆解代缴。',
    itemId: 'item.broken-talisman',
    count: 25,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.sealed-supreme',
    title: '无上封藏祭',
    summary: '无上大典需无上量封藏灵草炼制镇山灵丹永定山门；得以封藏灵草应供，或借巡守兽押运入库。',
    itemId: 'item.sealed-herb',
    count: 25,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.dried-herb-supreme',
    title: '无上晾晒祭',
    summary: '无上大典需无上量晾晒灵草祭祖永定山门；得以晾晒灵草应供，或借巡守兽晒场翻理。',
    itemId: 'item.dried-herb',
    count: 25,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.wine-supreme',
    title: '无上药酒祭',
    summary: '无上大典需无上量灵药酒洒地敬先永定山门；得以药酒应供，或借巡守兽押运奠酒。',
    itemId: 'item.herbal-wine',
    count: 25,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.poultice-supreme',
    title: '无上药膏祭',
    summary: '无上大典需无上量灵药膏熬制镇灾灵丹永定山门；得以药膏应供，或借巡守兽押运入库。',
    itemId: 'item.spirit-poultice',
    count: 25,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.recipe-supreme',
    title: '无上残卷祭',
    summary: '无上大典需无上量丹方残卷补全传承大典永定山门；得以残卷应供，或借巡守兽押运入库。',
    itemId: 'item.recipe-fragment',
    count: 25,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.array-core-supreme',
    title: '无上阵核祭',
    summary: '无上大典需无上量阵核铸制镇山大阵永定山门；得以阵核应供，或借巡守兽熔炼代缴。',
    itemId: 'item.array-core',
    count: 25,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.compost-supreme',
    title: '无上灵壤肥祭',
    summary: '无上大典需无上量灵壤肥祭土祈福万年丰年永定山门；得以灵壤肥应供，或借巡守兽押运培土。',
    itemId: 'item.spirit-compost',
    count: 25,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.spirit-stone-apex',
    title: '巅峰灵石祭',
    summary: '巅峰大典需巅峰量灵石镇场祭天永定山门气运；备好灵石应祭，或借巡守兽代为押运。',
    itemId: 'item.spirit-stone',
    count: 40,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.beast-core-apex',
    title: '巅峰内丹祭',
    summary: '巅峰大典需巅峰量妖兽内丹炼制镇山重器永定山门；备好内丹应供，或借巡守兽猎妖代缴。',
    itemId: 'item.beast-core',
    count: 30,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.talisman-apex',
    title: '巅峰碎件祭',
    summary: '巅峰大典需巅峰量破损法宝熔炼镇山重器永定山门；得以碎件应供，或借巡守兽拆解代缴。',
    itemId: 'item.broken-talisman',
    count: 30,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.sealed-apex',
    title: '巅峰封藏祭',
    summary: '巅峰大典需巅峰量封藏灵草炼制镇山灵丹永定山门；得以封藏灵草应供，或借巡守兽押运入库。',
    itemId: 'item.sealed-herb',
    count: 30,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.dried-herb-apex',
    title: '巅峰晾晒祭',
    summary: '巅峰大典需巅峰量晾晒灵草祭祖永定山门；得以晾晒灵草应供，或借巡守兽晒场翻理。',
    itemId: 'item.dried-herb',
    count: 30,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.wine-apex',
    title: '巅峰药酒祭',
    summary: '巅峰大典需巅峰量灵药酒洒地敬先永定山门；得以药酒应供，或借巡守兽押运奠酒。',
    itemId: 'item.herbal-wine',
    count: 30,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.poultice-apex',
    title: '巅峰药膏祭',
    summary: '巅峰大典需巅峰量灵药膏熬制镇灾灵丹永定山门；得以药膏应供，或借巡守兽押运入库。',
    itemId: 'item.spirit-poultice',
    count: 30,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.recipe-apex',
    title: '巅峰残卷祭',
    summary: '巅峰大典需巅峰量丹方残卷补全传承大典永定山门；得以残卷应供，或借巡守兽押运入库。',
    itemId: 'item.recipe-fragment',
    count: 30,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.array-core-apex',
    title: '巅峰阵核祭',
    summary: '巅峰大典需巅峰量阵核铸制镇山大阵永定山门；得以阵核应供，或借巡守兽熔炼代缴。',
    itemId: 'item.array-core',
    count: 30,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.compost-apex',
    title: '巅峰灵壤肥祭',
    summary: '巅峰大典需巅峰量灵壤肥祭土祈福万年丰年永定山门；得以灵壤肥应供，或借巡守兽押运培土。',
    itemId: 'item.spirit-compost',
    count: 30,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.spirit-stone-zenith',
    title: '极巅灵石祭',
    summary: '极巅大典需极巅量灵石镇场祭天永定山门气运；备好灵石应祭，或借巡守兽代为押运。',
    itemId: 'item.spirit-stone',
    count: 50,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.beast-core-zenith',
    title: '极巅内丹祭',
    summary: '极巅大典需极巅量妖兽内丹炼制镇山重器永定山门；备好内丹应供，或借巡守兽猎妖代缴。',
    itemId: 'item.beast-core',
    count: 40,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.talisman-zenith',
    title: '极巅碎件祭',
    summary: '极巅大典需极巅量破损法宝熔炼镇山重器永定山门；得以碎件应供，或借巡守兽拆解代缴。',
    itemId: 'item.broken-talisman',
    count: 40,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.sealed-zenith',
    title: '极巅封藏祭',
    summary: '极巅大典需极巅量封藏灵草炼制镇山灵丹永定山门；得以封藏灵草应供，或借巡守兽押运入库。',
    itemId: 'item.sealed-herb',
    count: 40,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.dried-herb-zenith',
    title: '极巅晾晒祭',
    summary: '极巅大典需极巅量晾晒灵草祭祖永定山门；得以晾晒灵草应供，或借巡守兽晒场翻理。',
    itemId: 'item.dried-herb',
    count: 40,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.wine-zenith',
    title: '极巅药酒祭',
    summary: '极巅大典需极巅量灵药酒洒地敬先永定山门；得以药酒应供，或借巡守兽押运奠酒。',
    itemId: 'item.herbal-wine',
    count: 40,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.poultice-zenith',
    title: '极巅药膏祭',
    summary: '极巅大典需极巅量灵药膏熬制镇灾灵丹永定山门；得以药膏应供，或借巡守兽押运入库。',
    itemId: 'item.spirit-poultice',
    count: 40,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.recipe-zenith',
    title: '极巅残卷祭',
    summary: '极巅大典需极巅量丹方残卷补全传承大典永定山门；得以残卷应供，或借巡守兽押运入库。',
    itemId: 'item.recipe-fragment',
    count: 40,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.array-core-zenith',
    title: '极巅阵核祭',
    summary: '极巅大典需极巅量阵核铸制镇山大阵永定山门；得以阵核应供，或借巡守兽熔炼代缴。',
    itemId: 'item.array-core',
    count: 40,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.compost-zenith',
    title: '极巅灵壤肥祭',
    summary: '极巅大典需极巅量灵壤肥祭土祈福万年丰年永定山门；得以灵壤肥应供，或借巡守兽押运培土。',
    itemId: 'item.spirit-compost',
    count: 40,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.spirit-stone-eternal-zenith',
    title: '永镇灵石祭',
    summary: '永镇大典需永镇量灵石镇场祭天永镇山门气运；备好灵石应祭，或借巡守兽代为押运。',
    itemId: 'item.spirit-stone',
    count: 60,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.beast-core-eternal-zenith',
    title: '永镇内丹祭',
    summary: '永镇大典需永镇量妖兽内丹炼制镇山重器永镇山门；备好内丹应供，或借巡守兽猎妖代缴。',
    itemId: 'item.beast-core',
    count: 50,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.talisman-eternal-zenith',
    title: '永镇碎件祭',
    summary: '永镇大典需永镇量破损法宝熔炼镇山重器永镇山门；得以碎件应供，或借巡守兽拆解代缴。',
    itemId: 'item.broken-talisman',
    count: 50,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.sealed-eternal-zenith',
    title: '永镇封藏祭',
    summary: '永镇大典需永镇量封藏灵草炼制镇山灵丹永镇山门；得以封藏灵草应供，或借巡守兽押运入库。',
    itemId: 'item.sealed-herb',
    count: 50,
    pressureRelief: 6 * MILLI
  },
  {
    id: 'incident.dried-herb-eternal-zenith',
    title: '永镇晾晒祭',
    summary: '永镇大典需永镇量晾晒灵草祭祖永镇山门；得以晾晒灵草应供，或借巡守兽晒场翻理。',
    itemId: 'item.dried-herb',
    count: 50,
    pressureRelief: 6 * MILLI
  }
];

function assistingGuardBeast(state: GameState, incident: StayingWorldIncidentDef): GuardBeastIncidentAssist | null {
  if (incident.id === 'incident.herb-relief') {
    if (!state.flags.has(greenhouseVisitFlag(state.day))) return null;
    const best = preferredGuardBeastForPatrol(state);
    if (!best) return null;

    return {
      beastId: best.id,
      vigorCost: 1,
      pressureReliefBonus: guardBeastMasteryReady(best) ? 3 * MILLI : best.specialty === 'courier' || guardBeastSpecialtyReady(best) ? 2 * MILLI : MILLI,
      mastery: guardBeastMasteryReady(best) || undefined,
      spentCountOverride: Math.max(0, incident.count - 1),
      specialtyProgress: 'courier'
    };
  }
  if (incident.id === 'incident.array-fray') {
    let best: { beast: GameState['guardBeasts'][number]; tileId: number } | null = null;
    for (const assignment of state.guardBeastPatrols) {
      const beast = state.guardBeasts.find(entry => entry.id === assignment.beastId);
      if (!beast || beast.vigor <= 0) continue;
      if (activeArraysCoveringTile(state, assignment.tileId).length <= 0) continue;
      if (!best || beast.bond > best.beast.bond || (beast.bond === best.beast.bond && beast.id < best.beast.id)) {
        best = { beast, tileId: assignment.tileId };
      }
    }
    if (!best) return null;

    return {
      beastId: best.beast.id,
      vigorCost: 1,
      pressureReliefBonus: guardBeastMasteryReady(best.beast) ? 4 * MILLI : best.beast.specialty === 'array-warden' || guardBeastSpecialtyReady(best.beast) ? 3 * MILLI : 2 * MILLI,
      mastery: guardBeastMasteryReady(best.beast) || undefined,
      patrolTileId: best.tileId,
      spentCountOverride: 0,
      specialtyProgress: 'array-warden'
    };
  }
  if (incident.id === 'incident.wanderer-aid') {
    const best = preferredGuardBeastForPatrol(state);
    if (!best) return null;

    return {
      beastId: best.id,
      vigorCost: 1,
      pressureReliefBonus: guardBeastMasteryReady(best) ? 3 * MILLI : best.specialty === 'courier' || guardBeastSpecialtyReady(best) ? 2 * MILLI : MILLI,
      mastery: guardBeastMasteryReady(best) || undefined,
      spentCountOverride: Math.max(0, incident.count - 1),
      specialtyProgress: 'courier'
    };
  }
  if (incident.id === 'incident.seasonal-blight') {
    // 节令灾异：暖棚稳住的微气候（greenhouseClimate≥50）+ 巡逻巡守兽可代为护苗，
    // 免去灵壤肥消耗并额外减压。门槛锚定留世暖棚经营标量，与阵法巡逻协防互不重叠。
    const staying = ensureStayingWorldState(state);
    if (staying.greenhouseClimate < 50 * MILLI) return null;
    const best = preferredGuardBeastForPatrol(state);
    if (!best) return null;
    return {
      beastId: best.id,
      vigorCost: 1,
      pressureReliefBonus: guardBeastMasteryReady(best) ? 5 * MILLI : best.specialty === 'field-ward' || guardBeastSpecialtyReady(best) ? 4 * MILLI : 3 * MILLI,
      mastery: guardBeastMasteryReady(best) || undefined,
      spentCountOverride: 0,
      specialtyProgress: 'field-ward'
    };
  }
  if (incident.id === 'incident.spirit-vein-flare') {
    // 灵脉波动：玩家修为深厚（stage≥4）+ 巡逻巡守兽可合力稳脉，免去残卷消耗。
    if (state.player.stage < 4) return null;
    const best = preferredGuardBeastForPatrol(state);
    if (!best) return null;
    return {
      beastId: best.id,
      vigorCost: 1,
      pressureReliefBonus: guardBeastMasteryReady(best) ? 5 * MILLI : best.specialty === 'field-ward' || guardBeastSpecialtyReady(best) ? 4 * MILLI : 3 * MILLI,
      mastery: guardBeastMasteryReady(best) || undefined,
      spentCountOverride: 0,
      specialtyProgress: 'field-ward'
    };
  }
  if (incident.id === 'incident.inner-demon-flare') {
    // 心魔反扑：玩家定力深厚（willpower≥500）+ 巡逻巡守兽可镇住心神，免去封藏灵草消耗。
    if (state.player.willpower < 500) return null;
    const best = preferredGuardBeastForPatrol(state);
    if (!best) return null;
    return {
      beastId: best.id,
      vigorCost: 1,
      pressureReliefBonus: guardBeastMasteryReady(best) ? 5 * MILLI : best.specialty === 'field-ward' || guardBeastSpecialtyReady(best) ? 4 * MILLI : 3 * MILLI,
      mastery: guardBeastMasteryReady(best) || undefined,
      spentCountOverride: 0,
      specialtyProgress: 'field-ward'
    };
  }
  if (incident.id === 'incident.lifespan-omen') {
    // 寿元警报：巡逻巡守兽可夜守分忧，免去灵药酒消耗并额外减压。
    const best = preferredGuardBeastForPatrol(state);
    if (!best) return null;
    return {
      beastId: best.id,
      vigorCost: 1,
      pressureReliefBonus: guardBeastMasteryReady(best) ? 5 * MILLI : best.specialty === 'field-ward' || guardBeastSpecialtyReady(best) ? 4 * MILLI : 3 * MILLI,
      mastery: guardBeastMasteryReady(best) || undefined,
      spentCountOverride: 0,
      specialtyProgress: 'field-ward'
    };
  }
  if (incident.id === 'incident.beast-tide-omen') {
    // 妖潮预兆：巡逻巡守兽可提前巡守，免去灵药膏消耗并额外减压。
    const best = preferredGuardBeastForPatrol(state);
    if (!best) return null;
    return {
      beastId: best.id,
      vigorCost: 1,
      pressureReliefBonus: guardBeastMasteryReady(best) ? 5 * MILLI : best.specialty === 'field-ward' || guardBeastSpecialtyReady(best) ? 4 * MILLI : 3 * MILLI,
      mastery: guardBeastMasteryReady(best) || undefined,
      spentCountOverride: 0,
      specialtyProgress: 'field-ward'
    };
  }
  if (incident.id === 'incident.qi-drift') {
    // 灵气涣散：巡逻巡守兽可巡田引气，免去阵核消耗并额外减压。
    const best = preferredGuardBeastForPatrol(state);
    if (!best) return null;
    return {
      beastId: best.id,
      vigorCost: 1,
      pressureReliefBonus: guardBeastMasteryReady(best) ? 5 * MILLI : best.specialty === 'field-ward' || guardBeastSpecialtyReady(best) ? 4 * MILLI : 3 * MILLI,
      mastery: guardBeastMasteryReady(best) || undefined,
      spentCountOverride: 0,
      specialtyProgress: 'field-ward'
    };
  }
  if (incident.id === 'incident.beast-trace') {
    let best: GameState['guardBeasts'][number] | null = preferredGuardBeastForPatrol(state);
    if (!best) {
      for (const beast of state.guardBeasts) {
        if (beast.vigor <= 0) continue;
        if (!best || beast.bond > best.bond || (beast.bond === best.bond && beast.id < best.id)) best = beast;
      }
    }
    if (!best) return null;

    return {
      beastId: best.id,
      vigorCost: 1,
      pressureReliefBonus: guardBeastMasteryReady(best) ? 5 * MILLI : best.specialty === 'field-ward' || guardBeastSpecialtyReady(best) ? 4 * MILLI : 3 * MILLI,
      mastery: guardBeastMasteryReady(best) || undefined,
      spentCountOverride: 0,
      specialtyProgress: 'field-ward'
    };
  }
  const best = preferredGuardBeastForPatrol(state);
  if (!best) return null;
  return { beastId: best.id, vigorCost: 1, pressureReliefBonus: guardBeastMasteryReady(best) ? 5 * MILLI : best.specialty === 'field-ward' || guardBeastSpecialtyReady(best) ? 4 * MILLI : 3 * MILLI, mastery: guardBeastMasteryReady(best) || undefined, spentCountOverride: Math.max(0, incident.count - 1), specialtyProgress: 'field-ward' };
}

export function getCurrentStayingWorldIncident(state: GameState): StayingWorldIncidentDef | null {
  const staying = ensureStayingWorldState(state);
  if (state.postAscension.mode === 'stayed-in-world' && (staying.currentIncidentDay !== state.day || !staying.currentIncidentId)) {
    return refreshStayingWorldIncident(state);
  }
  if (!staying.currentIncidentId) return null;
  return STAYING_WORLD_INCIDENT_CATALOG.find(incident => incident.id === staying.currentIncidentId) ?? null;
}

function incidentIndexForDay(day: number): number {
  return (Math.max(1, day) - 1) % STAYING_WORLD_INCIDENT_CATALOG.length;
}

export function refreshStayingWorldIncident(state: GameState): StayingWorldIncidentDef | null {
  if (state.postAscension.mode !== 'stayed-in-world') return null;
  const staying = ensureStayingWorldState(state);
  if (staying.currentIncidentDay === state.day && staying.currentIncidentId) {
    return getCurrentStayingWorldIncident(state);
  }
  const incident = STAYING_WORLD_INCIDENT_CATALOG[incidentIndexForDay(state.day)] ?? null;
  staying.currentIncidentId = incident?.id ?? null;
  staying.currentIncidentDay = state.day;
  if (incident) emit(state, 'staying-world-incident-rotated', { day: state.day, incidentId: incident.id });
  return incident;
}

export function resolveStayingWorldIncident(state: GameState, ctx?: SimContext): ResolveStayingWorldIncidentResult {
  if (state.postAscension.mode !== 'stayed-in-world') return { ok: false, incident: null, reason: '未留世' };
  const incident = refreshStayingWorldIncident(state);
  if (!incident) return { ok: false, incident: null, reason: '今日无镇守事件' };
  const staying = ensureStayingWorldState(state);
  if (staying.resolvedIncidentDay === state.day) return { ok: false, incident, reason: '今日已处置' };
  const assist = assistingGuardBeast(state, incident);
  const requiredCount = assist?.spentCountOverride ?? incident.count;
  if (itemCount(state.player, incident.itemId) < requiredCount) return { ok: false, incident, reason: '物资不足' };

  let spentCount = requiredCount;
  if (spentCount > 0) mutateItem(state.player, incident.itemId, -spentCount);
  let beastVigor: number | undefined;
  if (assist) {
    const beast = state.guardBeasts.find(entry => entry.id === assist.beastId);
    if (!beast || beast.vigor < assist.vigorCost) return { ok: false, incident, reason: '巡守兽精力不足' };
    beast.vigor -= assist.vigorCost;
    beastVigor = beast.vigor;
  }
  const beastBond = assist && ctx ? applyGuardBeastIncidentAssistBond(state, ctx, assist.beastId) : undefined;
  const beastSpecialty = assist?.specialtyProgress ? applyGuardBeastSpecialtyProgress(state, assist.beastId, assist.specialtyProgress) : undefined;
  // 递送专长巡守兽协防后，邻里以灵石酬谢其跑腿之劳；精通递送酬谢更高。
  let courierStipend = 0;
  if (assist) {
    const assistBeast = state.guardBeasts.find(entry => entry.id === assist.beastId);
    if (assistBeast?.specialty === 'courier') {
      courierStipend = guardBeastMasteryReady(assistBeast) ? 2 : 1;
      if (ctx && !inventoryCanFitRewards(state.player, [{ itemId: 'item.spirit-stone', count: courierStipend }], ctx.content)) {
        courierStipend = 0;
        emit(state, 'staying-world-stipend-blocked', { itemId: 'item.spirit-stone', count: guardBeastMasteryReady(assistBeast) ? 2 : 1 });
      } else {
        mutateItem(state.player, 'item.spirit-stone', courierStipend);
      }
    }
  }
  staying.resolvedIncidentDay = state.day;
  staying.wardingPressure = Math.max(0, staying.wardingPressure - incident.pressureRelief - (assist?.pressureReliefBonus ?? 0));
  emit(state, 'staying-world-incident-resolved', {
    day: state.day,
    incidentId: incident.id,
    itemId: incident.itemId,
    count: spentCount,
    beastId: assist?.beastId,
    beastVigor,
    beastBond,
    beastBondGain: assist && ctx ? ctx.params.celestial.beast.guardBondGainPerIncidentAssist : 0,
    beastSpecialty,
    beastMastery: assist?.mastery,
    patrolTileId: assist?.patrolTileId,
    pressureReliefBonus: assist?.pressureReliefBonus ?? 0,
    courierStipend,
    wardingPressure: staying.wardingPressure
  });
  return { ok: true, incident };
}

export function hasResolvedStayingWorldIncidentForDay(state: GameState, day: number): boolean {
  const staying = ensureStayingWorldState(state);
  return staying.resolvedIncidentDay === day;
}
