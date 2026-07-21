import {
  bodyFoundationCap,
  getActiveLocationDirectory,
  getActiveSpecialOrders,
  getCurrentMainlineQuest,
  getCurrentStayingWorldIncident,
  getDailyCommission,
  getDailySpecialOrder,
  getLocationEncounters,
  getLocationServiceOptions,
  getPrimaryStayingWorldGoal,
  upcomingCalendarEntries,
  type GameState,
  type LocationId,
  type LocationServiceCommand,
  type LocationStatus,
  type SimContext
} from '@sim';
import { tList } from '@content/i18n';
import { inventoryUsed, itemCount } from '@sim/world/player';
import { MILLI } from '@sim/world/types';
import { computePrepScore, readyForBreakthrough } from '@sim/progression/progression';
import { activeTribulationArrayCount, hasWardPillReady, tribulationPrepStatusLine } from './tribulationPrepText';

interface LocationMapPoint {
  readonly x: number;
  readonly y: number;
  readonly region: string;
  readonly risk: '安' | '低' | '中' | '高';
  readonly travel: string;
}

export interface SurfaceAssetUrls {
  readonly locationNetwork?: string;
  readonly valleyOverview?: string;
  readonly playerAvatar?: string;
}

const LOCATION_MAP_POINTS: Readonly<Record<LocationId, LocationMapPoint>> = {
  farmstead: { x: 46, y: 53, region: '农庄中枢', risk: '安', travel: '当前' },
  'valley-market': { x: 20, y: 31, region: '人烟市井', risk: '低', travel: '半日' },
  'festival-ground': { x: 72, y: 79, region: '节令会场', risk: '低', travel: '半日' },
  'valley-outskirts': { x: 30, y: 58, region: '山谷外缘', risk: '中', travel: '半日' },
  'ruin-gate': { x: 58, y: 25, region: '旧阵残垣', risk: '高', travel: '一日' },
  'spirit-vein': { x: 80, y: 32, region: '残脉深处', risk: '高', travel: '一日' },
  'tea-shed': { x: 42, y: 24, region: '旧路茶棚', risk: '低', travel: '半日' },
  'herb-plot': { x: 39, y: 52, region: '露根药圃', risk: '低', travel: '短程' },
  'creek-field': { x: 35, y: 65, region: '溪边药田', risk: '低', travel: '短程' },
  'drying-yard': { x: 21, y: 77, region: '晾晒院角', risk: '安', travel: '当前' },
  greenhouse: { x: 56, y: 52, region: '暖棚', risk: '安', travel: '当前' },
  'array-shed': { x: 65, y: 45, region: '阵器棚', risk: '安', travel: '当前' },
  'ore-slope': { x: 84, y: 60, region: '矿石坡', risk: '中', travel: '半日' }
};

const CURRENCY_ITEM_ID = 'item.spirit-stone';

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function clampRatio(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function pct(value: number): number {
  return Math.round(clampRatio(value) * 100);
}

function milli(value: number): number {
  return Math.round(value / MILLI);
}

function itemLabel(ctx: SimContext, itemId: string): string {
  return ctx.content.items.get(itemId)?.displayName ?? itemId;
}

function activeTaskLine(state: GameState, ctx: SimContext): string {
  if (state.postAscension.mode === 'stayed-in-world') {
    const incident = getCurrentStayingWorldIncident(state);
    if (incident) return `镇守事件：交付 ${itemLabel(ctx, incident.itemId)} ×${incident.count}`;
    const order = getActiveSpecialOrders(state)[0] ?? null;
    if (order) return `镇守事务：${order.title}，还差 ${order.remaining}`;
    const commission = getDailyCommission(state);
    if (commission) return `差事：${commission.title}`;
    const goal = getPrimaryStayingWorldGoal(state);
    if (goal) return `${goal.track === 'warding' ? '镇守' : '闲居'}目标：${goal.title}（${goal.progressLabel}）`;
    return '留世：农庄暂稳，可以照料灵田、暖棚或旧茶棚。';
  }

  const mainline = getCurrentMainlineQuest(state);
  if (mainline) return `主线：${mainline.title}${mainline.completed ? '（可领取）' : ''}`;
  const order = getActiveSpecialOrders(state)[0] ?? null;
  if (order) return `订单：${order.title}，还差 ${order.remaining}`;
  const dailyOrder = getDailySpecialOrder(state);
  if (dailyOrder) return `今日订单：${dailyOrder.title}`;
  const commission = getDailyCommission(state);
  if (commission) return `今日委托：${commission.title}`;
  const upcoming = upcomingCalendarEntries(state, ctx, 7).find(entry => (entry.daysFromNow ?? 0) > 0) ?? null;
  if (upcoming) return `将至：${upcoming.daysFromNow}日后 ${upcoming.title}`;
  return '当前：先稳住灵田，再决定炼丹、出货或外出。';
}

function recommendedLocationId(state: GameState, ctx: SimContext): LocationId {
  if (readyForBreakthrough(state, ctx.params)) {
    if (!hasWardPillReady(state)) return 'farmstead';
    if (activeTribulationArrayCount(state) < 2) return 'array-shed';
    return 'ruin-gate';
  }
  if (getActiveSpecialOrders(state)[0] || getDailySpecialOrder(state) || getDailyCommission(state)) return 'valley-market';
  const mainline = getCurrentMainlineQuest(state);
  if (mainline?.completed) return 'ruin-gate';
  if (state.postAscension.mode === 'stayed-in-world' && getPrimaryStayingWorldGoal(state)?.id.includes('tea-shed')) return 'tea-shed';
  if (state.postAscension.mode === 'stayed-in-world' && getPrimaryStayingWorldGoal(state)?.id.includes('greenhouse')) return 'greenhouse';
  return 'farmstead';
}

function locationNodeClass(location: LocationStatus, recommended: boolean): string {
  const classes = ['map-node'];
  if (recommended) classes.push('map-node-recommended');
  if (location.npcs.length > 0) classes.push('map-node-has-npc');
  if (location.serviceLabels.length === 0) classes.push('map-node-quiet');
  return classes.join(' ');
}

function serviceButton(locationId: LocationId, command: LocationServiceCommand, label: string): string {
  return `<button class="map-service-button" type="button" data-map-location="${escapeHtml(locationId)}" data-map-service-command="${escapeHtml(command)}" data-flow-focusable="true">${escapeHtml(label)}</button>`;
}

function renderLocationServices(state: GameState, location: LocationStatus): string {
  const services = getLocationServiceOptions(state, location.id);
  if (services.length === 0) {
    return '<span class="map-service-empty">暂无可执行服务</span>';
  }
  return services.map(service => serviceButton(location.id, service.command, service.commandLabel)).join('');
}

function renderLocationCard(state: GameState, location: LocationStatus, recommendedId: LocationId): string {
  const point = LOCATION_MAP_POINTS[location.id];
  const services = [...location.serviceLabels, ...location.closedServiceLabels];
  const encounters = getLocationEncounters(state, location.id);
  const meta = [point.region, `风险 ${point.risk}`, point.travel].join(' · ');
  const status = services.length > 0 ? services.join(' / ') : '无常驻服务';
  const npcLine = location.npcs.length > 0 ? `今日可遇：${location.npcs.join('、')}` : encounters.length > 0 ? `今日可遇：${encounters.map(entry => entry.npcName).join('、')}` : '今日无固定来客';
  return [
    `<article class="map-location-card${location.id === recommendedId ? ' map-location-card-recommended' : ''}">`,
    `<div class="map-location-heading"><h2>${escapeHtml(location.displayName)}</h2><span>${escapeHtml(meta)}</span></div>`,
    `<p>${escapeHtml(location.description)}</p>`,
    `<p class="map-location-status">${escapeHtml(status)}｜${escapeHtml(npcLine)}</p>`,
    `<div class="map-service-row">${renderLocationServices(state, location)}</div>`,
    '</article>'
  ].join('');
}

export function renderMapSurface(state: GameState, ctx: SimContext, assets: SurfaceAssetUrls = {}): string {
  const locations = getActiveLocationDirectory(state);
  if (locations.length === 0) {
    return '<div class="surface-empty-state"><strong>山河图未显</strong><span>先推进当前旅程，新的去处会随主线、节令和人情逐步显露。</span></div>';
  }

  const byId = new Map(locations.map(location => [location.id, location]));
  const recommendedId = byId.has(recommendedLocationId(state, ctx)) ? recommendedLocationId(state, ctx) : locations[0]!.id;
  const recommended = byId.get(recommendedId) ?? locations[0]!;
  const nodeHtml = locations
    .map(location => {
      const point = LOCATION_MAP_POINTS[location.id];
      const label = `${location.displayName}${location.id === recommendedId ? '，当前建议' : ''}`;
      return `<span class="${locationNodeClass(location, location.id === recommendedId)}" style="--map-x: ${point.x}; --map-y: ${point.y};" aria-label="${escapeHtml(label)}"><span>${escapeHtml(location.displayName)}</span></span>`;
    })
    .join('');
  const locationCards = locations.map(location => renderLocationCard(state, location, recommendedId)).join('');
  const mapArt = assets.locationNetwork
    ? `<img class="map-board-art" src="${escapeHtml(assets.locationNetwork)}" alt="" aria-hidden="true" decoding="async" data-asset-id="map.location-network-v1" />`
    : '';
  const priorityArt = assets.valleyOverview
    ? `<img class="map-priority-art" src="${escapeHtml(assets.valleyOverview)}" alt="" aria-hidden="true" decoding="async" data-asset-id="map.valley-overview-v1" />`
    : '';

  return [
    '<section class="map-surface-panel" aria-label="山河图与地点决策">',
    `<div class="map-board${mapArt ? ' map-board-with-art' : ''}" aria-label="山河图">`,
    mapArt,
    '<div class="map-route map-route-a" aria-hidden="true"></div>',
    '<div class="map-route map-route-b" aria-hidden="true"></div>',
    nodeHtml,
    '</div>',
    `<aside class="map-priority-panel${priorityArt ? ' map-priority-panel-with-art' : ''}">`,
    priorityArt,
    '<p class="surface-kicker">当前首推</p>',
    `<h2>${escapeHtml(recommended.displayName)}</h2>`,
    `<p>${escapeHtml(activeTaskLine(state, ctx))}</p>`,
    `<p class="map-priority-meta">${escapeHtml(LOCATION_MAP_POINTS[recommended.id].region)}｜${escapeHtml(LOCATION_MAP_POINTS[recommended.id].travel)}｜风险 ${escapeHtml(LOCATION_MAP_POINTS[recommended.id].risk)}</p>`,
    `<div class="map-service-row">${renderLocationServices(state, recommended)}</div>`,
    '</aside>',
    '<div class="map-location-list" aria-label="地点服务清单">',
    locationCards,
    '</div>',
    '</section>'
  ].join('');
}

function statusCard(title: string, value: string, detail: string, tone: 'normal' | 'good' | 'warn' | 'danger' = 'normal'): string {
  return `<div class="cultivation-status-card" data-tone="${tone}"><span>${escapeHtml(title)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(detail)}</small></div>`;
}

function meter(label: string, value: number, detail: string): string {
  return `<div class="cultivation-meter"><div><span>${escapeHtml(label)}</span><strong>${pct(value)}%</strong></div><span class="cultivation-meter-track" style="--meter-value: ${pct(value)}"><i></i></span><small>${escapeHtml(detail)}</small></div>`;
}

function actionButton(command: string, label: string, primary = false): string {
  return `<button class="cultivation-action${primary ? ' cultivation-action-primary' : ''}" type="button" data-cultivation-command="${escapeHtml(command)}" data-flow-focusable="true">${escapeHtml(label)}</button>`;
}

function nextCultivationActions(state: GameState, ctx: SimContext): string[] {
  if (state.postAscension.mode === 'stayed-in-world') {
    return [actionButton('map', '查看镇守去处', true), actionButton('farm', '整理农庄事务'), actionButton('furnace', '开炉备药')];
  }
  if (readyForBreakthrough(state, ctx.params)) {
    const actions = [actionButton('tribulation', '确认引劫', true)];
    if (!hasWardPillReady(state)) actions.push(actionButton('furnace', '先炼承雷丹'));
    if (activeTribulationArrayCount(state) < 2) actions.push(actionButton('arrays', '补两座阵法'));
    actions.push(actionButton('map', '查看备劫去处'));
    return actions;
  }
  return [actionButton('farm', '回农庄苦练与农务', true), actionButton('furnace', '整理丹炉药材'), actionButton('map', '查看山河图')];
}

export function renderCultivationSurface(state: GameState, ctx: SimContext, assets: SurfaceAssetUrls = {}): string {
  const p = state.player;
  const stageNames = tList('ui.hud.stages');
  const stageName = stageNames[p.stage] ?? `${p.stage}`;
  const cap = p.stage <= 6 ? bodyFoundationCap(p.stage, ctx.params) : null;
  const hasFiniteCap = cap != null && Number.isFinite(cap) && cap > 0;
  const foundationRatio = hasFiniteCap ? p.bodyFoundation / cap : 0;
  const hpRatio = p.maxHp <= 0 ? 0 : p.hp / p.maxHp;
  const poisonRatio = p.pillPoison / (ctx.params.pillPoison.cap * MILLI);
  const staminaRatio = p.stamina / (ctx.params.player.staminaCap * MILLI);
  const prepScore = computePrepScore(state);
  const arrayCount = activeTribulationArrayCount(state);
  const wardReady = hasWardPillReady(state);
  const frozen = state.postAscension.mode === 'stayed-in-world';
  const ready = readyForBreakthrough(state, ctx.params);
  const spiritStones = itemCount(p, CURRENCY_ITEM_ID);
  const inventoryLine = `${inventoryUsed(p)}/${p.inventoryCapacity} 格｜灵石 ${spiritStones}`;
  const fateLine = frozen ? '留世守境，境界止步但人间事务仍会流动。' : `因果债 ${milli(p.heavenDebt)}｜天道注视 ${milli(p.daoAttention)}｜走火 ${milli(p.madnessValue)}`;
  const tribulationLine = frozen ? '镇守人间' : ready ? '体魄已满，可选择主动引劫' : state.tribulation.status === 'countdown' ? `劫期倒计时 ${state.tribulation.daysRemaining} 日` : state.tribulation.status === 'due' ? '天劫已临门' : '尚未到引劫节点';
  const avatarUrl = assets.playerAvatar ?? 'portraits/avatar.player-v1.png';

  return [
    '<section class="cultivation-sheet" aria-label="修行与备劫面板">',
    `<div class="cultivation-portrait" aria-hidden="true"><span class="cultivation-portrait-ring"></span><img class="cultivation-avatar" src="${escapeHtml(avatarUrl)}" alt="" decoding="async" data-asset-id="portrait.avatar.player-v1" /><span class="cultivation-portrait-mark">凡</span></div>`,
    '<div class="cultivation-core">',
    '<p class="surface-kicker">凡骨逆修 · 偷天换劫诀</p>',
    `<h2>${escapeHtml(stageName)}</h2>`,
    `<p>${escapeHtml(fateLine)}</p>`,
    `<div class="cultivation-inline-actions" aria-label="修行下一步动作">${nextCultivationActions(state, ctx).join('')}</div>`,
    '<div class="cultivation-meters">',
    meter('体魄根基', foundationRatio, hasFiniteCap ? `${milli(p.bodyFoundation)} / ${milli(cap)} 点` : `${milli(p.bodyFoundation)} 点｜未开脉积累`),
    meter('气血', hpRatio, `${milli(p.hp)} / ${milli(p.maxHp)}`),
    meter('体力', staminaRatio, `${milli(p.stamina)} / ${ctx.params.player.staminaCap}`),
    meter('丹毒', poisonRatio, `${milli(p.pillPoison)} / ${ctx.params.pillPoison.cap}`),
    '</div>',
    '</div>',
    '<div class="cultivation-status-grid">',
    statusCard('寿元', `${p.lifespanRemainingDays}日`, '大限倒计时', p.lifespanRemainingDays <= 60 ? 'danger' : p.lifespanRemainingDays <= 180 ? 'warn' : 'normal'),
    statusCard('备劫', `${Math.round(prepScore * 100)}%`, tribulationPrepStatusLine(state), prepScore >= 1 ? 'good' : prepScore > 0 ? 'warn' : 'danger'),
    statusCard('阵法', `${arrayCount}/2`, arrayCount >= 2 ? '引雷与绝缘已成' : '至少补齐两座基础阵', arrayCount >= 2 ? 'good' : 'warn'),
    statusCard('丹药', wardReady ? '已备' : '缺承雷丹', wardReady ? '可在渡劫前服用确认' : '先从丹炉炼制或整理库存', wardReady ? 'good' : 'danger'),
    statusCard('行囊', inventoryLine, '丹药、阵材与出货物共用容量', inventoryUsed(p) >= p.inventoryCapacity ? 'warn' : 'normal'),
    statusCard('劫势', tribulationLine, ready ? '引劫会进入准备窗，不是即时结算' : '继续积累体魄与资源', ready ? 'warn' : 'normal'),
    '</div>',
    '</section>'
  ].join('');
}
