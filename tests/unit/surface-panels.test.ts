import { describe, expect, it } from 'vitest';
import { buildRegistry } from '@content/registry';
import { renderCultivationSurface, renderMapSurface } from '@app/surfacePanels';
import { createSimContext, createWorld, DEFAULT_BALANCE, type GameState, type SimContext } from '@sim';
import { stageQiCap } from '@sim/progression/progression';

function setup(seed = 21): { state: GameState; ctx: SimContext } {
  const reg = buildRegistry();
  const state = createWorld({ seed, width: 6, height: 6, content: reg, params: DEFAULT_BALANCE });
  const ctx = createSimContext(seed, reg, DEFAULT_BALANCE);
  return { state, ctx };
}

function makeBreakthroughReady(state: GameState): void {
  state.player.stage = 1;
  const cap = stageQiCap(state.player.stage, DEFAULT_BALANCE);
  state.player.bodyFoundation = cap;
  state.player.cultivation = cap;
}

describe('世界覆盖页呈现', () => {
  it('把地点页渲染为山河图节点、首推地点和可点击服务', () => {
    const { state, ctx } = setup();

    const html = renderMapSurface(state, ctx, {
      locationNetwork: 'maps/map.location-network-v1.png',
      valleyOverview: 'maps/map.valley-overview-v1.png'
    });

    expect(html).toContain('map-surface-panel');
    expect(html).toContain('map-board');
    expect(html).toContain('map-board-art');
    expect(html).toContain('data-asset-id="map.location-network-v1"');
    expect(html).toContain('maps/map.location-network-v1.png');
    expect(html).toContain('data-asset-id="map.valley-overview-v1"');
    expect(html).toContain('当前首推');
    expect(html).toContain('农庄');
    expect(html).toContain('data-map-service-command="show-farm-work"');
    expect(html).not.toBe('山谷尚未显露新的去处。');
  });

  it('地图资源缺失时保留纯 CSS 山河图 fallback', () => {
    const { state, ctx } = setup();

    const html = renderMapSurface(state, ctx);

    expect(html).toContain('map-board');
    expect(html).not.toContain('map-board-art');
    expect(html).toContain('data-map-service-command="show-farm-work"');
  });

  it('把修行页渲染为体魄、备劫和下一步动作面板', () => {
    const { state, ctx } = setup();
    makeBreakthroughReady(state);

    const html = renderCultivationSurface(state, ctx, {
      playerAvatar: 'portraits/avatar.player-v1.png'
    });

    expect(html).toContain('cultivation-sheet');
    expect(html).toContain('portraits/avatar.player-v1.png');
    expect(html).toContain('data-asset-id="portrait.avatar.player-v1"');
    expect(html).toContain('体魄根基');
    expect(html).toContain('备劫');
    expect(html).toContain('确认引劫');
    expect(html).toContain('data-cultivation-command="tribulation"');
    expect(html).not.toContain('按 T');
    expect(html).not.toContain('Shift+');
  });
});
