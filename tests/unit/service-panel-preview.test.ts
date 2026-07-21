import { describe, expect, it } from 'vitest';
import { buildRegistry } from '@content/registry';
import { createWorld, DEFAULT_BALANCE, type GameState } from '@sim';
import { arraysServiceToastPresentation, farmWorkServiceToastPresentation, festivalPanelPreview, festivalResultToastPresentation, festivalToastPresentation, festivalUnavailableToastPresentation, greenhousePanelPreview, greenhouseResultToastPresentation, greenhouseToastPresentation, processingServiceToastPresentation, quickServiceUnavailableToastPresentation, teaShedPanelPreview, teaShedResultToastPresentation, teaShedToastPresentation } from '@app/servicePanelPreview';

function setup(seed = 7): { state: GameState; reg: ReturnType<typeof buildRegistry> } {
  const reg = buildRegistry();
  const state = createWorld({ seed, width: 6, height: 6, content: reg, params: DEFAULT_BALANCE });
  return { state, reg };
}

describe('service panel preview', () => {
  it('describes festival panel with stall count', () => {
    const { state } = setup();
    state.activeEvent = {
      defId: 'event.spring-festival',
      displayName: '春集节',
      daysLeft: 1,
      growthMod: 1,
      qiMod: 1
    };

    const preview = festivalPanelPreview(state);

    expect(preview.title).toBe('春集节');
    expect(preview.details).toBe('节庆会场\n摊位 2 项\n可先逛摊补节货，再顺手参与会场试礼');
    expect(preview.assetId).toBe('loc.festival-ground');
  });

  it('changes festival entry guidance based on whether the fair is actually worth shopping today', () => {
    const { state: activeState } = setup();
    activeState.activeEvent = {
      defId: 'event.spring-festival',
      displayName: '春集节',
      daysLeft: 1,
      growthMod: 1,
      qiMod: 1
    };
    const { state: emptyState } = setup(71);
    emptyState.activeEvent = {
      defId: 'event.debug-empty-festival',
      displayName: '空场节',
      daysLeft: 1,
      growthMod: 1,
      qiMod: 1
    };

    expect(festivalPanelPreview(activeState).details).toContain('可先逛摊补节货，再顺手参与会场试礼');
    expect(festivalPanelPreview(emptyState).details).toContain('先去会场探风声，别把今日补货指望压在这里');
  });

  it('describes tea shed panel with rumor headline and unlock state', () => {
    const { state } = setup();

    const preview = teaShedPanelPreview(state);

    expect(preview.title.startsWith('旧茶棚·')).toBe(true);
    expect(preview.details.includes('茶棚歇脚')).toBe(true);
    expect(preview.details.includes('留世后解锁歇脚')).toBe(true);
    expect(preview.assetId).toBe('loc.tea-shed');
  });

  it('marks tea shed as already used after today visit is consumed', () => {
    const { state } = setup();
    state.postAscension.mode = 'stayed-in-world';
    state.flags.add(`tea-shed-visit.${state.day}`);

    const preview = teaShedPanelPreview(state);

    expect(preview.details).toContain('今日已歇脚｜明日可再来');
  });

  it('describes greenhouse panel with climate, streak, and nursery info', () => {
    const { state, reg } = setup();
    state.postAscension.mode = 'stayed-in-world';
    state.stayingWorld.greenhouseClimate = 68_000;
    state.stayingWorld.greenhouseCareStreak = 3;

    const preview = greenhousePanelPreview(state, reg);

    expect(preview.title.startsWith('暖棚·')).toBe(true);
    expect(preview.details.includes('四时育苗')).toBe(true);
    expect(preview.details.includes('今日可领')).toBe(true);
    expect(preview.details.includes('棚温 68%｜连护 3 日｜棚势已稳｜离季育苗更顺手')).toBe(true);
    expect(preview.details.includes('苗床 0 阶｜槽位 0/0｜待扩建后可护苗')).toBe(true);
    expect(preview.assetId).toBe('loc.greenhouse');
  });

  it('marks greenhouse as already tended and nursery full when those states apply', () => {
    const { state, reg } = setup();
    state.postAscension.mode = 'stayed-in-world';
    state.stayingWorld.greenhouseClimate = 32_000;
    state.stayingWorld.greenhouseCareStreak = 1;
    state.flags.add('upgrade.greenhouse-nursery-1');
    state.flags.add(`greenhouse-tended.${state.day}`);
    const protectedTiles = state.tiles.filter(tile => tile.blockType === 'none').slice(0, 3);
    for (const tile of protectedTiles) {
      tile.tilled = true;
      tile.cropId = tile.id;
      state.crops.set(tile.id, {
        id: tile.id,
        defId: 'herb.dewroot',
        tileId: tile.id,
        growth: 0,
        health: 100_000,
        stage: 'seed',
        plantedDay: state.day,
        property: { cold: 0, hot: 0, warm: 0, neutral: 1_000 },
        tempered: false,
        greenhouseProtected: true
      });
    }

    const preview = greenhousePanelPreview(state, reg);

    expect(preview.details).toContain('今日已养护｜明日可再来');
    expect(preview.details).toContain('棚温 32%｜连护 1 日｜棚势偏弱｜今日宜先回暖');
    expect(preview.details).toContain('苗床 1 阶｜槽位 3/3｜护苗 3｜已满');
  });

  it('keeps festival preview on location art even when stall goods exist or not', () => {
    const { state: activeState } = setup();
    activeState.activeEvent = {
      defId: 'event.spring-festival',
      displayName: '春集节',
      daysLeft: 1,
      growthMod: 1,
      qiMod: 1
    };
    const { state } = setup(71);
    state.activeEvent = {
      defId: 'event.debug-empty-festival',
      displayName: '空场节',
      daysLeft: 1,
      growthMod: 1,
      qiMod: 1
    };

    expect(festivalPanelPreview(activeState).assetId).toBe('loc.festival-ground');
    expect(festivalPanelPreview(state).assetId).toBe('loc.festival-ground');
  });

  it('builds festival and tea shed toasts from preview assets', () => {
    const { state } = setup();
    state.activeEvent = {
      defId: 'event.spring-festival',
      displayName: '春集节',
      daysLeft: 1,
      growthMod: 1,
      qiMod: 1
    };

    expect(festivalToastPresentation(state, '空格/E/回车参与·Esc返回')).toEqual({
      message: '春集节：节庆会场｜摊位 2 项｜可先逛摊补节货，再顺手参与会场试礼｜空格/E/回车参与·Esc返回',
      assetId: 'loc.festival-ground'
    });

    expect(teaShedToastPresentation(state)).toEqual({
      message: expect.stringContaining('旧茶棚·'),
      assetId: 'map-sprite.tea-shed-elder-v1'
    });
    expect(teaShedToastPresentation(state).message).toContain('留世后可来此歇脚听闻');
  });

  it('keeps festival-unavailable failures anchored to the festival-ground thread', () => {
    expect(festivalUnavailableToastPresentation('already-participated-or-full')).toEqual({
      message: '本次节日已参与或背包已满',
      assetId: 'loc.festival-ground'
    });
    expect(festivalUnavailableToastPresentation('no-active-event')).toEqual({
      message: '当前没有可参与节日',
      assetId: 'loc.festival-ground'
    });
  });

  it('uses reward-led art for festival participation success when a concrete reward exists', () => {
    const { reg } = setup();

    expect(festivalResultToastPresentation([], reg)).toEqual({
      message: '参与节日',
      assetId: 'loc.festival-ground'
    });

    expect(
      festivalResultToastPresentation(
        [
          { itemId: 'seed.dewroot', count: 2 },
          { itemId: 'fertilizer.basic', count: 1 }
        ],
        reg
      )
    ).toEqual({
      message: '参与节日：露根草种子×2、fertilizer.basic×1',
      assetId: 'icon.seed.dewroot'
    });
  });

  it('keeps quick-service unavailable failures anchored to the relevant place thread', () => {
    const { state } = setup();

    expect(quickServiceUnavailableToastPresentation('staying-commission')).toEqual({
      message: '公告板暂不可直达｜日常委托通常从集市接续',
      assetId: 'loc.valley-market'
    });
    expect(quickServiceUnavailableToastPresentation('staying-commission', true)).toEqual({
      message: '镇守告示暂不可直达｜留世线索与事务从这里接续',
      assetId: 'loc.ruin-gate'
    });

    expect(quickServiceUnavailableToastPresentation('tea-shed', false, state)).toEqual({
      message: '旧茶棚尚未开放快捷歇脚｜留世后可直达',
      assetId: 'loc.tea-shed'
    });

    expect(quickServiceUnavailableToastPresentation('greenhouse', false, state)).toEqual({
      message: '暖棚尚未开放快捷养护｜留世后可直达',
      assetId: 'loc.greenhouse'
    });
  });

  it('explains festival-day commission shortcut failures with the current route change instead of a generic block', () => {
    const { state } = setup();
    state.activeEvent = {
      defId: 'event.spring-festival',
      displayName: '春集节',
      daysLeft: 1,
      growthMod: 1,
      qiMod: 1
    };

    expect(quickServiceUnavailableToastPresentation('staying-commission', false, state)).toEqual({
      message: '公告板今日随节停市｜先去会场看当期事务',
      assetId: 'loc.valley-market'
    });

    state.postAscension.mode = 'stayed-in-world';
    expect(quickServiceUnavailableToastPresentation('staying-commission', true, state)).toEqual({
      message: '镇守告示今日随节停摆｜先去会场看当期事务',
      assetId: 'loc.ruin-gate'
    });
  });

  it('uses today-state guidance for tea shed and greenhouse shortcut failure feedback after unlock', () => {
    const { state } = setup();
    state.postAscension.mode = 'stayed-in-world';

    state.flags.add(`tea-shed-visit.${state.day}`);
    expect(quickServiceUnavailableToastPresentation('tea-shed', false, state)).toEqual({
      message: '旧茶棚今日已歇脚｜明日再来',
      assetId: 'loc.tea-shed'
    });

    state.flags.add(`greenhouse-tended.${state.day}`);
    expect(quickServiceUnavailableToastPresentation('greenhouse', false, state)).toEqual({
      message: '暖棚今日已养护｜明日再来',
      assetId: 'loc.greenhouse'
    });
  });

  it('builds greenhouse and service shortcut toasts with the mapped art ids', () => {
    const { state, reg } = setup();
    state.postAscension.mode = 'stayed-in-world';
    state.stayingWorld.greenhouseClimate = 68_000;
    state.stayingWorld.greenhouseCareStreak = 3;

    const greenhouseToast = greenhouseToastPresentation(state, reg, '空格/E/回车养护暖棚·Esc返回');

    expect(greenhouseToast.assetId).toBe('portrait.avatar.herb-gatherer-v1');
    expect(greenhouseToast.message.startsWith('暖棚·')).toBe(true);
    expect(greenhouseToast.message).toContain('四时育苗');
    expect(greenhouseToast.message).toContain('棚温 68%｜连护 3 日｜棚势已稳｜离季育苗更顺手');
    expect(greenhouseToast.message).toContain('苗床 0 阶｜槽位 0/0｜待扩建后可护苗');
    expect(greenhouseToast.message.endsWith('空格/E/回车养护暖棚·Esc返回')).toBe(true);

    expect(processingServiceToastPresentation('空格/E/回车进入')).toEqual({
      message: '加工：余货先晾晒，封藏稳药性，熔炼出阵核接炼丹与阵法｜选择农庄加工项·空格/E/回车进入',
      assetId: 'loc.farmstead'
    });
    expect(arraysServiceToastPresentation('点阵器棚或农务入口布阵')).toEqual({
      message: '阵法：布设引雷阵与绝缘阵，把农庄产出转成导雷阵势｜点阵器棚或农务入口布阵',
      assetId: 'loc.farmstead'
    });
    expect(farmWorkServiceToastPresentation('空格/E主交互·农务入口打开面板')).toEqual({
      message: '农事：翻地、补种、浇水、收获与出货从这里收口，先稳住修行资源循环｜点击地块/设施执行·空格/E主交互·农务入口打开面板',
      assetId: 'loc.farmstead'
    });
  });

  it('connects farmstead service shortcuts to the public demo cultivation loop', () => {
    expect(farmWorkServiceToastPresentation('确认').message).toContain('翻地、补种、浇水、收获与出货');
    expect(processingServiceToastPresentation('确认').message).toContain('余货先晾晒');
    expect(processingServiceToastPresentation('确认').message).toContain('炼丹与阵法');
    expect(arraysServiceToastPresentation('确认').message).toContain('导雷阵势');
  });

  it('reuses the shared person-led service actor mapping for tea shed and greenhouse open toasts', () => {
    const { state, reg } = setup();

    expect(teaShedToastPresentation(state).assetId).toBe('map-sprite.tea-shed-elder-v1');
    expect(greenhouseToastPresentation(state, reg).assetId).toBe('portrait.avatar.herb-gatherer-v1');
  });

  it('keeps child-location service toasts on the child place art when processing or arrays are entered there directly', () => {
    expect(processingServiceToastPresentation('空格/E/回车进入', 'drying-yard')).toEqual({
      message: '加工：余货先晾晒，封藏稳药性，熔炼出阵核接炼丹与阵法｜选择农庄加工项·空格/E/回车进入',
      assetId: 'loc.drying-yard'
    });

    expect(arraysServiceToastPresentation('点阵器棚或农务入口布阵', 'array-shed')).toEqual({
      message: '阵法：布设引雷阵与绝缘阵，把农庄产出转成导雷阵势｜点阵器棚或农务入口布阵',
      assetId: 'loc.array-shed'
    });
  });

  it('lets farm-work shortcut toasts reuse the current farmstead focus asset when one is provided', () => {
    expect(farmWorkServiceToastPresentation('空格/E主交互·农务入口打开面板')).toEqual({
      message: '农事：翻地、补种、浇水、收获与出货从这里收口，先稳住修行资源循环｜点击地块/设施执行·空格/E主交互·农务入口打开面板',
      assetId: 'loc.farmstead'
    });

    expect(farmWorkServiceToastPresentation('空格/E主交互·农务入口打开面板', 'facility.shipping-bin')).toEqual({
      message: '农事：翻地、补种、浇水、收获与出货从这里收口，先稳住修行资源循环｜点击地块/设施执行·空格/E主交互·农务入口打开面板',
      assetId: 'loc.farmstead'
    });

    expect(farmWorkServiceToastPresentation('空格/E主交互·农务入口打开面板', 'loc.herb-plot')).toEqual({
      message: '农事：翻地、补种、浇水、收获与出货从这里收口，先稳住修行资源循环｜点击地块/设施执行·空格/E主交互·农务入口打开面板',
      assetId: 'loc.herb-plot'
    });
  });

  it('uses elder portrait for tea shed success and keeps location art for failures', () => {
    expect(teaShedResultToastPresentation('failure', '今日已在旧茶棚歇过脚')).toEqual({
      message: '旧茶棚：今日已在旧茶棚歇过脚',
      assetId: 'loc.tea-shed'
    });

    expect(
      teaShedResultToastPresentation('success', {
        rumor: { title: '炉火旧闻' },
        hpGain: 8_000,
        poisonRelief: 1_000,
        willpowerGain: 180
      })
    ).toEqual({
      message: '旧茶棚：炉火旧闻｜养神歇脚，气血+8，丹毒-1，意志+0',
      assetId: 'map-sprite.tea-shed-elder-v1'
    });
  });

  it('reuses greenhouse item or location art for result toasts', () => {
    const { reg } = setup();

    expect(greenhouseResultToastPresentation('failure', '今日已养护过暖棚', reg)).toEqual({
      message: '暖棚：今日已养护过暖棚',
      assetId: 'loc.greenhouse'
    });

    expect(
      greenhouseResultToastPresentation(
        'success',
        {
          rumor: { title: '温渠回春' },
          grantedSeedId: 'seed.dewroot',
          grantedSeedCount: 2,
          revivedTiles: 3,
          nurseryTier: 1,
          nurseryCapacity: 3,
          nurserySlotsRemaining: 1,
          greenhouseClimate: 68_000,
          greenhouseCareStreak: 3
        },
        reg
      )
    ).toEqual({
      message: '暖棚：温渠回春｜得露根草种子×2，回养田地3格，苗床1阶·槽位2/3，棚温68%，连护3日',
      assetId: 'icon.seed.dewroot'
    });
  });
});
