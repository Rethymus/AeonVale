import { describe, expect, it } from 'vitest';
import { deriveSemanticGameState, type SemanticGameStateInput } from '@app/semanticGameState';
import type { AppFlowPresentation, AppSurfaceId } from '@app/appFlowView';
import type { UiMode } from '@app/uiMode';

const worldJourney = {
  progressLabel: '第 1/4 段 · 获得灵草',
  currentAction: '面对空地翻出第一块灵田',
  motivation: '灵草是炼丹与备劫的起点',
  cta: '开始翻地'
};

function presentation(surface: AppSurfaceId, mode: UiMode, continueAvailable = false): AppFlowPresentation {
  return { surface, mode, focusTarget: '#test-focus', continueAvailable };
}

function input(surface: AppSurfaceId, mode: UiMode, overrides: Partial<SemanticGameStateInput> = {}): SemanticGameStateInput {
  return {
    presentation: presentation(surface, mode),
    worldStatus: '第 1 日，春季第 1 日。气血 100，体力 100。',
    announcement: '翻地成功',
    journey: worldJourney,
    ...overrides
  };
}

function expectNoWorldJourney(state: ReturnType<typeof deriveSemanticGameState>): void {
  expect(state.objective).not.toContain(worldJourney.currentAction);
  expect(state.actions).not.toContain(worldJourney.cta);
  expect(state.actions).not.toContain('方向移动');
  expect(state.actions).not.toContain('点击目标');
}

describe('页面语义镜像', () => {
  it('Title 只发布当前可执行的标题动作，不泄漏世界旅程', () => {
    const withoutSave = deriveSemanticGameState(input('title', 'title'));
    expect(withoutSave).toMatchObject({
      instructions: '使用 Tab 浏览当前页面控件，Enter 或 Space 激活。',
      surface: '当前页面：标题。',
      status: '当前状态：标题菜单。',
      objective: '当前目标：开始一段本地旅程。',
      actions: '当前可用动作：开始游戏；设置。',
      panel: '当前没有打开面板。',
      announcement: ''
    });
    expectNoWorldJourney(withoutSave);

    const withSave = deriveSemanticGameState({ ...input('title', 'title'), presentation: presentation('title', 'title', true) });
    expect(withSave.actions).toBe('当前可用动作：开始游戏；继续旅程；设置。');
  });

  it('World 只在 world mode 发布旅程目标与世界动作', () => {
    const state = deriveSemanticGameState(input('world', 'world'));

    expect(state).toMatchObject({
      instructions: '点击目标移动或互动；行囊常驻，丹炉、山河图与修行收在更多中；键盘仅需 B、Enter、Escape。',
      surface: '当前页面：农庄世界。',
      status: '当前状态：第 1 日，春季第 1 日。气血 100，体力 100。',
      objective: `当前目标：${worldJourney.progressLabel}。${worldJourney.currentAction}。${worldJourney.motivation}。`,
      actions: `当前可用动作：${worldJourney.cta}；点击目标移动或互动；行囊；丹炉；山河图；修行。`,
      panel: '当前没有打开面板。',
      announcement: '翻地成功'
    });
  });

  it('World 内旧 panel/dialogue/location mode 使用当前注意力层语义', () => {
    const panel = deriveSemanticGameState(
      input('world', 'panel', {
        worldAttention: { panel: '农务', objective: '选择一项农庄操作', actions: '切换选项；确认；返回农庄' }
      })
    );
    expect(panel).toMatchObject({
      objective: '当前目标：选择一项农庄操作。',
      actions: '当前可用动作：切换选项；确认；返回农庄。',
      panel: '已打开面板：农务。'
    });
    expectNoWorldJourney(panel);

    const dialogue = deriveSemanticGameState(input('world', 'dialogue'));
    expect(dialogue).toMatchObject({ objective: '当前目标：阅读当前对话。', actions: '当前可用动作：继续对话。', panel: '已打开面板：对话。' });

    const location = deriveSemanticGameState(input('world', 'location'));
    expect(location).toMatchObject({ objective: '当前目标：选择地点与服务。', actions: '当前可用动作：切换地点或服务；确认；返回农庄。', panel: '已打开面板：地点目录。' });
  });

  it('系统 overlay 与信息 overlay 发布自身动作及面板', () => {
    const pause = deriveSemanticGameState(input('pause', 'pause', { pauseWorldNavigationAvailable: true }));
    expect(pause).toMatchObject({
      surface: '当前页面：暂停。',
      objective: '当前目标：选择系统页面，或继续游戏。',
      actions: '当前可用动作：农务；行囊；地点；修行；丹炉；设置；继续游戏。',
      panel: '已打开面板：暂停菜单。'
    });
    expectNoWorldJourney(pause);

    const tribulationPause = deriveSemanticGameState(input('pause', 'pause', { pauseWorldNavigationAvailable: false }));
    expect(tribulationPause.actions).toBe('当前可用动作：设置；继续游戏。');

    const settings = deriveSemanticGameState(input('settings', 'panel'));
    expect(settings).toMatchObject({ objective: '当前目标：查看系统与可访问性设置。', actions: '当前可用动作：调整主音量；切换减少动态效果；返回。', panel: '已打开面板：设置。' });

    const overlays = [
      ['inventory', '物品管理', '整理随身行囊、农庄仓库与出货箱', '切换行囊/仓库/出货箱/丹炉；拖拽换位或转移；拆分/使用/丢弃；返回农庄'],
      ['map', '地点', '查看山谷地点', '返回农庄'],
      ['cultivation', '修行', '查看体魄与备劫状态', '返回农庄']
    ] as const;
    for (const [surface, label, objective, action] of overlays) {
      const state = deriveSemanticGameState(input(surface, surface === 'map' ? 'location' : 'panel'));
      expect(state.surface).toBe(`当前页面：${label}。`);
      expect(state.objective).toBe(`当前目标：${objective}。`);
      expect(state.actions).toBe(`当前可用动作：${action}。`);
      expect(state.panel).toBe(`已打开面板：${label}。`);
      expectNoWorldJourney(state);
    }
  });

  it('丹炉聚焦模式通过 inventory overlay 发布独立语义', () => {
    const furnace = deriveSemanticGameState(
      input('inventory', 'panel', {
        inventory: { viewMode: 'furnace-focus' }
      })
    );
    expect(furnace).toMatchObject({
      surface: '当前页面：丹炉。',
      objective: '当前目标：按丹方投影填入九宫药盘并开炉炼制。',
      actions: '当前可用动作：自动入药；调整炉火；开炉炼制；返回农庄。',
      panel: '已打开面板：丹炉。'
    });
    expectNoWorldJourney(furnace);
  });

  it('Tribulation 只发布当前可用的服丹、走位、确认和暂停动作', () => {
    const idle = deriveSemanticGameState(
      input('tribulation', 'tribulation', {
        tribulation: {
          warningLabel: '服丹后开始教学。',
          primaryLabel: '开始三雷教学',
          primaryDisabled: false,
          takePillDisabled: false,
          movementDisabled: true
        }
      })
    );
    expect(idle).toMatchObject({
      objective: '当前目标：服丹后开始教学。',
      actions: '当前可用动作：服用承雷丹；开始三雷教学；暂停。',
      panel: '已打开面板：教学天劫。'
    });
    expectNoWorldJourney(idle);

    const active = deriveSemanticGameState(
      input('tribulation', 'tribulation', {
        tribulation: {
          warningLabel: '第 2/3 雷将落在 (1, 1)。',
          primaryLabel: '确认第 2 雷',
          primaryDisabled: false,
          takePillDisabled: true,
          movementDisabled: false
        }
      })
    );
    expect(active.actions).toBe('当前可用动作：预警后走位；确认第 2 雷；暂停。');
  });

  it('Aftermath 与 Ending 发布各自结算动作，不泄漏旅程 CTA', () => {
    const aftermath = deriveSemanticGameState(
      input('aftermath', 'aftermath', {
        aftermath: { outcomeLabel: '你完成了教学小天劫。', nextLabel: '返回农庄，四段试玩旅程即告完成。', continueDisabled: false }
      })
    );
    expect(aftermath).toMatchObject({
      surface: '当前页面：战后结算。',
      objective: '当前目标：你完成了教学小天劫。返回农庄，四段试玩旅程即告完成。',
      actions: '当前可用动作：返回农庄。',
      panel: '已打开面板：战后结算。'
    });
    expectNoWorldJourney(aftermath);

    const ending = deriveSemanticGameState(input('ending', 'ending'));
    expect(ending).toMatchObject({
      surface: '当前页面：结局。',
      status: '当前状态：旅程已经结束。',
      objective: '当前目标：查看本次旅程结局。',
      actions: '当前可用动作：返回标题。',
      panel: '已打开面板：结局。',
      announcement: ''
    });
    expectNoWorldJourney(ending);
  });

  it('loading、boot error、prologue 与 portrait gate 也使用页面自身语义', () => {
    const cases = [
      ['loading', 'loading', '载入中', '载入游戏', '请稍候', null],
      ['boot-error', 'boot-error', '载入失败', '恢复游戏载入', '刷新页面', '载入错误'],
      ['prologue', 'prologue', '序章', '阅读序章，或跳过后进入农庄', '继续；跳过序章', '序章'],
      ['portrait-blocked', 'portrait-blocked', '请横置设备', '旋转设备后继续', '请将设备横置', '设备方向提示']
    ] as const;

    for (const [surface, mode, label, objective, actions, panel] of cases) {
      const state = deriveSemanticGameState(input(surface, mode));
      expect(state.surface).toBe(`当前页面：${label}。`);
      expect(state.objective).toBe(`当前目标：${objective}。`);
      expect(state.actions).toBe(`当前可用动作：${actions}。`);
      expect(state.panel).toBe(panel ? `已打开面板：${panel}。` : '当前没有打开面板。');
      expectNoWorldJourney(state);
    }
  });
});
