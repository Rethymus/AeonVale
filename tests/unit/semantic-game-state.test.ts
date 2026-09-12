import { describe, expect, it } from 'vitest';
import { deriveSemanticGameState, type SemanticGameStateInput } from '@app/semanticGameState';
import type { AppFlowPresentation, AppSurfaceId } from '@app/appFlowView';
import type { UiMode } from '@app/uiMode';

function presentation(surface: AppSurfaceId, mode: UiMode, continueAvailable = false): AppFlowPresentation {
  return { surface, mode, focusTarget: '#test-focus', continueAvailable };
}

function input(surface: AppSurfaceId, mode: UiMode, overrides: Partial<SemanticGameStateInput> = {}): SemanticGameStateInput {
  return {
    presentation: presentation(surface, mode),
    ...overrides
  };
}

describe('页面语义镜像', () => {
  it('Title 只发布当前可执行的标题动作', () => {
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

    const withSave = deriveSemanticGameState(input('title', 'title', { presentation: presentation('title', 'title', true) }));
    expect(withSave.actions).toContain('继续旅程');
  });

  it('叙述与修途 surface 发布各自页面语义', () => {
    const narration = deriveSemanticGameState(input('narration', 'narration'));
    expect(narration.status).toContain('灵韵叙录');
    expect(narration.actions).toContain('叙录');

    const journey = deriveSemanticGameState(input('roguelite-proto', 'roguelite-proto'));
    expect(journey.surface).toContain('偷天换劫');
    expect(journey.actions).toContain('主动引劫');
  });

  it('settings 覆盖层发布设置面板语义并反映存档健康', () => {
    const settings = deriveSemanticGameState(input('settings', 'title'));
    expect(settings.panel).toContain('设置');
    expect(settings.actions).toContain('调整主音量');
    expect(settings.surface).toContain('设置');
  });

  it('loading、boot error 与 portrait gate 也使用页面自身语义', () => {
    const loading = deriveSemanticGameState(input('loading', 'loading'));
    expect(loading.status).toContain('载入');

    const bootError = deriveSemanticGameState(input('boot-error', 'boot-error'));
    expect(bootError.actions).toContain('刷新页面');
    expect(bootError.panel).toContain('载入错误');

    const portrait = deriveSemanticGameState(input('portrait-blocked', 'portrait-blocked'));
    expect(portrait.actions).toContain('请将设备横置');
    expect(portrait.surface).toContain('请横置设备');
  });

  it('未知 surface 走兜底语义而不是抛错', () => {
    const fallback = deriveSemanticGameState({ presentation: null });
    expect(fallback.surface).toContain('载入中');
    expect(fallback.actions).toContain('请稍候');
  });
});
