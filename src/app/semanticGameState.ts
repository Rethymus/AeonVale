import type { InteractionPanelState } from './interactionPanels';
import { APP_SURFACE_LABELS, type AppFlowPresentation } from './appFlowView';
import type { SemanticGameState } from './responsiveShell';
import { deriveSaveHealthPresentation, type SaveHealth } from './saveHealth';

export interface SemanticJourneyState {
  readonly progressLabel: string;
  readonly currentAction: string;
  readonly motivation: string;
  readonly cta: string;
}

export interface SemanticWorldAttention {
  readonly panel: string;
  readonly objective?: string;
  readonly actions?: string;
}

export interface SemanticInventoryState {
  readonly viewMode: 'full' | 'furnace-focus';
}

export interface SemanticTribulationState {
  readonly warningLabel: string;
  readonly primaryLabel: string;
  readonly primaryDisabled: boolean;
  readonly takePillDisabled: boolean;
  readonly movementDisabled: boolean;
}

export interface SemanticAftermathState {
  readonly outcomeLabel: string;
  readonly nextLabel: string;
  readonly continueDisabled: boolean;
}

export interface SemanticGameStateInput {
  readonly presentation: AppFlowPresentation | null;
  readonly worldStatus: string;
  readonly announcement: string;
  readonly journey?: SemanticJourneyState;
  readonly worldAttention?: SemanticWorldAttention;
  readonly pauseWorldNavigationAvailable?: boolean;
  readonly inventory?: SemanticInventoryState;
  readonly tribulation?: SemanticTribulationState;
  readonly aftermath?: SemanticAftermathState;
  readonly saveHealth?: SaveHealth;
}

interface SemanticPageContent {
  readonly surfaceLabel?: string;
  readonly status: string;
  readonly objective: string;
  readonly actions: readonly string[];
  readonly panel: string | null;
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

function worldContent(input: SemanticGameStateInput): SemanticPageContent {
  const mode = input.presentation?.mode;
  if (mode === 'dialogue') {
    return {
      status: input.worldStatus,
      objective: input.worldAttention?.objective ?? '阅读当前对话',
      actions: input.worldAttention?.actions ? [input.worldAttention.actions] : ['继续对话'],
      panel: input.worldAttention?.panel ?? '对话'
    };
  }
  if (mode === 'panel') {
    const panel = input.worldAttention?.panel ?? '交互面板';
    return {
      status: input.worldStatus,
      objective: input.worldAttention?.objective ?? `使用${panel}`,
      actions: input.worldAttention?.actions ? [input.worldAttention.actions] : ['切换选项', '确认', '返回农庄'],
      panel
    };
  }
  if (mode === 'location') {
    return {
      status: input.worldStatus,
      objective: input.worldAttention?.objective ?? '选择地点与服务',
      actions: input.worldAttention?.actions ? [input.worldAttention.actions] : ['切换地点或服务', '确认', '返回农庄'],
      panel: input.worldAttention?.panel ?? '地点目录'
    };
  }

  const journey = input.journey;
  return {
    status: input.worldStatus,
    objective: journey ? `${journey.progressLabel}。${journey.currentAction}。${journey.motivation}` : '在农庄中选择下一步行动',
    actions: journey ? [journey.cta, '点击目标移动或互动', '行囊', '丹炉', '山河图', '修行'] : ['点击目标移动或互动', '行囊', '丹炉', '山河图', '修行'],
    panel: null
  };
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
    case 'prologue':
      return { status: '序章进行中', objective: '阅读序章，或跳过后进入农庄', actions: ['继续', '跳过序章'], panel: '序章' };
    case 'world':
      return worldContent(input);
    case 'settings':
      return { status: save?.settingsStatus ?? input.worldStatus, objective: '查看系统与可访问性设置', actions: ['调整主音量', '切换减少动态效果', '返回'], panel: '设置' };
    case 'pause':
      return {
        status: save ? `${input.worldStatus} ${save.pauseStatus}` : input.worldStatus,
        objective: '选择系统页面，或继续游戏',
        actions: input.pauseWorldNavigationAvailable ? ['农务', '行囊', '地点', '修行', '丹炉', '设置', '继续游戏'] : ['设置', '继续游戏'],
        panel: '暂停菜单'
      };
    case 'inventory':
      if (input.inventory?.viewMode === 'furnace-focus') {
        return {
          surfaceLabel: '丹炉',
          status: input.worldStatus,
          objective: '按丹方投影填入九宫药盘并开炉炼制',
          actions: ['自动入药', '调整炉火', '开炉炼制', '返回农庄'],
          panel: '丹炉'
        };
      }
      return {
        surfaceLabel: '物品管理',
        status: input.worldStatus,
        objective: '整理随身行囊、农庄仓库与出货箱',
        actions: ['切换行囊/仓库/出货箱/丹炉', '拖拽换位或转移', '拆分/使用/丢弃', '返回农庄'],
        panel: '物品管理'
      };
    case 'map':
      return { status: input.worldStatus, objective: '查看山谷地点', actions: ['返回农庄'], panel: '地点' };
    case 'cultivation':
      return { status: input.worldStatus, objective: '查看体魄与备劫状态', actions: ['返回农庄'], panel: '修行' };
    case 'tribulation': {
      const tribulation = input.tribulation;
      const actions: string[] = [];
      if (tribulation && !tribulation.takePillDisabled) actions.push('服用承雷丹');
      if (tribulation && !tribulation.movementDisabled) actions.push('预警后走位');
      if (tribulation && !tribulation.primaryDisabled) actions.push(tribulation.primaryLabel);
      actions.push('暂停');
      return {
        status: input.worldStatus,
        objective: tribulation?.warningLabel ?? '查看下一雷预警并决定行动',
        actions,
        panel: '教学天劫'
      };
    }
    case 'aftermath': {
      const aftermath = input.aftermath;
      const objective = aftermath ? `${stripTerminalPunctuation(aftermath.outcomeLabel)}。${stripTerminalPunctuation(aftermath.nextLabel)}` : '查看教学天劫结算';
      return {
        status: input.worldStatus,
        objective,
        actions: aftermath?.continueDisabled === false ? ['返回农庄'] : ['等待结算'],
        panel: '战后结算'
      };
    }
    case 'ending':
      return { status: save?.endingStatus ?? '旅程已经结束', objective: '查看本次旅程结局', actions: ['返回标题'], panel: '结局' };
    case 'narration':
      return { status: '灵韵叙录进行中', objective: '阅读第一人称叙事，或在叙录界面回看章节与结局', actions: ['继续', '略过', '前文', '叙录'], panel: '灵韵叙录' };
    case 'roguelite-proto':
      return { status: '偷天换劫进行中', objective: '安排一世日课，并让资源、肉身与天劫形成因果链', actions: ['阅读入世录', '安排日课', '处理事件', '参悟残卷', '主动引劫'], panel: '偷天换劫' };
    case 'portrait-blocked':
      return { status: save?.portraitStatus ?? '当前存档状态尚未确认', objective: '旋转设备后继续', actions: ['请将设备横置'], panel: '设备方向提示' };
    default:
      return { status: input.worldStatus, objective: '在当前页面选择下一步行动', actions: ['返回', '继续'], panel: null };
  }
}

export function interactionPanelSemanticLabel(panel: InteractionPanelState): string | null {
  switch (panel.kind) {
    case 'none':
      return null;
    case 'farm-action':
      return '农务';
    case 'npc-action':
      return '人物操作';
    case 'build':
      return '建造/布阵';
    case 'upgrade':
      return '扩建';
    case 'npc':
      return panel.mode === 'browse' ? '人物浏览' : panel.mode === 'gift' ? '赠礼' : '人物委托';
    case 'festival':
      return '节庆活动';
    case 'shop':
      return panel.festival ? '节庆摊位' : '坊市';
    case 'trade':
      return '交易';
    case 'commission':
      return '委托与差事';
    case 'tea-shed':
      return '旧茶棚';
    case 'greenhouse':
      return '暖棚养护';
    case 'location-action':
      return '地点行动';
    case 'storage':
      return panel.mode === 'deposit' ? '仓储存入' : '仓储取出';
    case 'shipping':
      return panel.mode === 'normal' ? '出货' : '品质出货';
    case 'processing':
      return panel.mode === 'drying' ? '加工晾晒' : panel.mode === 'sealing' ? '加工封藏' : '加工熔炼';
    case 'facility-collect':
      return '设施收取';
  }
}

export function deriveSemanticGameState(input: SemanticGameStateInput): SemanticGameState {
  const surface = input.presentation?.surface ?? 'loading';
  const content = pageContent(input);
  return {
    instructions: surface === 'world' ? '点击目标移动或互动；行囊常驻，丹炉、山河图与修行收在更多中；键盘仅需 B、Enter、Escape。' : '使用 Tab 浏览当前页面控件，Enter 或 Space 激活。',
    surface: field('当前页面', content.surfaceLabel ?? APP_SURFACE_LABELS[surface]),
    status: field('当前状态', content.status),
    objective: field('当前目标', content.objective),
    actions: actionsField(content.actions),
    panel: panelField(content.panel),
    announcement: surface === 'world' ? input.announcement : ''
  };
}
