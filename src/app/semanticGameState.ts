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

export interface SemanticAlchemyState {
  readonly resultLabel: string;
  readonly primaryLabel: string;
  readonly primaryDisabled: boolean;
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
  readonly alchemy?: SemanticAlchemyState;
  readonly tribulation?: SemanticTribulationState;
  readonly aftermath?: SemanticAftermathState;
  readonly saveHealth?: SaveHealth;
}

interface SemanticPageContent {
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
    actions: journey ? [journey.cta, '方向移动', '主要操作', '切换', '菜单'] : ['方向移动', '主要操作', '菜单'],
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
        actions: input.presentation?.continueAvailable ? ['新游戏', '继续旅程', '设置'] : ['新游戏', '设置'],
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
        actions: input.pauseWorldNavigationAvailable ? ['农务', '背包', '地点', '修行', '丹炉', '设置', '继续游戏'] : ['设置', '继续游戏'],
        panel: '暂停菜单'
      };
    case 'inventory':
      return { status: input.worldStatus, objective: '查看随身物品', actions: ['返回农庄'], panel: '背包' };
    case 'map':
      return { status: input.worldStatus, objective: '查看山谷地点', actions: ['返回农庄'], panel: '地点' };
    case 'cultivation':
      return { status: input.worldStatus, objective: '查看体魄与备劫状态', actions: ['返回农庄'], panel: '修行' };
    case 'alchemy': {
      const alchemy = input.alchemy;
      const actions = ['调整炉火'];
      if (alchemy && !alchemy.primaryDisabled) actions.push(alchemy.primaryLabel);
      actions.push('返回农庄');
      return {
        status: input.worldStatus,
        objective: alchemy?.resultLabel ?? '控制炉火，炼制首枚备劫丹',
        actions,
        panel: '炼丹'
      };
    }
    case 'tribulation': {
      const tribulation = input.tribulation;
      const actions: string[] = [];
      if (tribulation && !tribulation.takePillDisabled) actions.push('服用避雷丹');
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
    case 'portrait-blocked':
      return { status: save?.portraitStatus ?? '当前存档状态尚未确认', objective: '旋转设备后继续', actions: ['请将设备横置'], panel: '设备方向提示' };
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
      return '建造';
    case 'upgrade':
      return '升级';
    case 'npc':
      return panel.mode === 'browse' ? '人物浏览' : panel.mode === 'gift' ? '赠礼' : '人物任务';
    case 'festival':
      return '节庆活动';
    case 'shop':
      return panel.festival ? '节庆摊位' : '商店';
    case 'trade':
      return '交易';
    case 'commission':
      return '委托与差事';
    case 'tea-shed':
      return '旧茶棚';
    case 'greenhouse':
      return '暖棚养护';
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
    instructions: surface === 'world' ? '使用方向键或 WASD 移动，空格或 E 执行当前操作，Escape 返回。' : '使用 Tab 浏览当前页面控件，Enter 或 Space 激活。',
    surface: field('当前页面', APP_SURFACE_LABELS[surface]),
    status: field('当前状态', content.status),
    objective: field('当前目标', content.objective),
    actions: actionsField(content.actions),
    panel: panelField(content.panel),
    announcement: surface === 'world' ? input.announcement : ''
  };
}
