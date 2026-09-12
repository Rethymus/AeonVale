import { APP_SURFACE_LABELS, type AppFlowPresentation } from './appFlowView';
import type { SemanticGameState } from './responsiveShell';
import { deriveSaveHealthPresentation, type SaveHealth } from './saveHealth';

export interface SemanticGameStateInput {
  readonly presentation: AppFlowPresentation | null;
  readonly saveHealth?: SaveHealth;
}

function stripTerminalPunctuation(value: string): string {
  return value.trim().replace(/[。；]+$/u, '');
}

function field(label: string, value: string): string {
  return `${label}：${stripTerminalPunctuation(value)}。`;
}

function actionsField(actions: readonly string[]): string {
  const normalized = actions.map(stripTerminalPunctuation).filter(Boolean);
  return field('当前可用动作', normalized.length > 0 ? normalized.join('；') : '无');
}

function panelField(panel: string | null): string {
  return panel ? field('已打开面板', panel) : '当前没有打开面板。';
}

interface SemanticPageContent {
  readonly surfaceLabel?: string;
  readonly status: string;
  readonly objective: string;
  readonly actions: readonly string[];
  readonly panel: string | null;
}

function pageContent(input: SemanticGameStateInput): SemanticPageContent {
  const surface = input.presentation?.surface ?? 'loading';
  const save = input.saveHealth ? deriveSaveHealthPresentation(input.saveHealth) : null;
  switch (surface) {
    case 'loading':
      return { status: '游戏正在载入', objective: '载入游戏', actions: ['请稍候'], panel: null };
    case 'boot-error':
      return { status: '游戏载入失败', objective: '恢复游戏载入', actions: ['刷新页面'], panel: '载入错误' };
    case 'title':
      return {
        status: '标题菜单',
        objective: '开始一段本地旅程',
        actions: input.presentation?.continueAvailable ? ['开始游戏', '继续旅程', '设置'] : ['开始游戏', '设置'],
        panel: null
      };
    case 'settings':
      return { status: save?.settingsStatus ?? '查看系统与可访问性设置', objective: '查看系统与可访问性设置', actions: ['调整主音量', '切换减少动态效果', '返回'], panel: '设置' };
    case 'narration':
      return { status: '灵韵叙录进行中', objective: '阅读第一人称叙事，或在叙录界面回看章节与结局', actions: ['继续', '略过', '前文', '叙录'], panel: '灵韵叙录' };
    case 'roguelite-proto':
      return { status: '偷天换劫进行中', objective: '安排一世日课，并让资源、肉身与天劫形成因果链', actions: ['阅读入世录', '安排日课', '处理事件', '参悟残卷', '主动引劫'], panel: '偷天换劫' };
    case 'portrait-blocked':
      return { status: save?.portraitStatus ?? '当前存档状态尚未确认', objective: '旋转设备后继续', actions: ['请将设备横置'], panel: '设备方向提示' };
    default:
      return { status: '在当前页面选择下一步行动', objective: '在当前页面选择下一步行动', actions: ['返回', '继续'], panel: null };
  }
}

export function deriveSemanticGameState(input: SemanticGameStateInput): SemanticGameState {
  const surface = input.presentation?.surface ?? 'loading';
  const content = pageContent(input);
  return {
    instructions: '使用 Tab 浏览当前页面控件，Enter 或 Space 激活。',
    surface: field('当前页面', content.surfaceLabel ?? APP_SURFACE_LABELS[surface]),
    status: field('当前状态', content.status),
    objective: field('当前目标', content.objective),
    actions: actionsField(content.actions),
    panel: panelField(content.panel),
    announcement: ''
  };
}
