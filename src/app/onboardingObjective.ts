import type { OnboardingObjectiveId } from '@sim/story/onboarding';
import { t } from '@content/i18n';

export interface OnboardingToastPresentation {
 message: string;
 assetId?: string;
}

const ONBOARDING_ROUTE_LINES: Readonly<Record<OnboardingObjectiveId, string>> = {
 'first-till': '动线：先留在农庄，从任意一块空地起手。',
 'first-sow': '动线：继续留在农庄，把种子播进刚翻好的地里。',
 'first-water': '动线：别离开农庄，先给刚播下的幼苗补上第一桶水。',
 'first-harvest': '动线：先稳住日常照料，等第一株灵草成熟再收。',
 'first-ship': '动线：收下成熟灵草后，顺手投进出货箱。',
 'first-sleep': '动线：把今日农务收尾，直接过夜等次日结算。',
 'first-market-restock': '动线：先去山谷集市补种，再回农庄接上第二轮。',
 'first-second-sow': '动线：回到农庄，把新买到的种子立刻播回田里。',
 'first-second-water': '动线：别让第二轮断掉，先给新苗浇上第一轮水。',
 'first-loop-complete': '动线：农务闭环已成，回农庄按 Shift+M 进入加工或阵法入口，把余货转成炉料与防线。',
};

const ONBOARDING_ACTION_LINES: Readonly<Record<OnboardingObjectiveId, string>> = {
 'first-till': '操作：站到空地前，按 空格 / E 翻地。',
 'first-sow': '操作：保持站在已翻土地前，按 Z 播下热栏中的种子。',
 'first-water': '操作：面向刚播下的幼苗，按 X 浇第一轮水。',
 'first-harvest': '操作：先照料灵田，成熟后面向作物按 V 收获。',
 'first-ship': '操作：靠近出货箱，打开出货面板后按 Enter 投货。',
 'first-sleep': '操作：确认今日农务已收尾，直接按 Enter 过夜。',
 'first-market-restock': '操作：按 Shift+Tab 打开地点目录，选集市服务后确认补种。',
 'first-second-sow': '操作：回农庄后面向已翻土地，按 Z 把新种子补回去。',
 'first-second-water': '操作：刚补种完别停，面向新苗按 X 补第一轮水。',
 'first-loop-complete': '操作：继续补种浇水；有余货时按 Shift+M 打开农庄加工或阵法面板。',
};

const ONBOARDING_PURPOSE_LINES: Readonly<Record<OnboardingObjectiveId, string>> = {
 'first-till': '意义：这块田会产出炼丹、布阵和引劫的第一批资源。',
 'first-sow': '意义：种子入土后，农务才会转成丹药、阵法和抗劫底气。',
 'first-water': '意义：浇稳第一轮水，才能把灵草养成后续炼丹材料。',
 'first-harvest': '意义：第一株成熟灵草会把种田接到炼丹、出货和备劫。',
 'first-ship': '意义：出货换回灵石，下一轮补种和修行才不断档。',
 'first-sleep': '意义：过夜结算会证明农务不是装饰，而是资源循环。',
 'first-market-restock': '意义：补种把一次收获变成稳定经营，后续才有炼丹库存。',
 'first-second-sow': '意义：第二轮播种接上后，农庄才从教程变成循环。',
 'first-second-water': '意义：第二轮浇水完成，种田即备战的节奏才真正成立。',
 'first-loop-complete': '意义：稳定农务后，灵草会持续转成丹药、阵法与抗劫底气。',
};

const ONBOARDING_PAYOFF_LINES: Readonly<Record<OnboardingObjectiveId, string>> = {
 'first-till': '回报：开出第一块灵田，后面才有药材、灵石和备劫材料。',
 'first-sow': '回报：种子入土后，等待会变成可收获的修行资源。',
 'first-water': '回报：浇水会把成长推进到可收获状态，避免首轮药材断档。',
 'first-harvest': '回报：收下灵草后，可以选择出货换灵石，也能留作炼丹库存。',
 'first-ship': '回报：投进出货箱后，过夜会把灵草兑现成下一轮经营资金。',
 'first-sleep': '回报：结算后的灵石会直接支持补种，把一次收获变成循环。',
 'first-market-restock': '回报：补到新种子后，农庄能立刻接上第二轮药材生产。',
 'first-second-sow': '回报：第二轮播种证明这不是一次性教程，而是稳定日常。',
 'first-second-water': '回报：第二轮浇稳后，农务、出货、炼丹和备劫进入可重复节奏。',
 'first-loop-complete': '回报：日常循环已成立，下一步可以把药材投入炼丹、设施和引劫准备。',
};

const ONBOARDING_OBJECTIVE_IDS: readonly OnboardingObjectiveId[] = [
 'first-till',
 'first-sow',
 'first-water',
 'first-harvest',
 'first-ship',
 'first-sleep',
 'first-market-restock',
 'first-second-sow',
 'first-second-water',
 'first-loop-complete',
];

export function onboardingObjectiveProgressLine(objectiveId: OnboardingObjectiveId | null): string {
 if (!objectiveId) return '';
 const step = ONBOARDING_OBJECTIVE_IDS.indexOf(objectiveId) + 1;
 if (step <= 0) return '';
 return `首轮进度：${step}/${ONBOARDING_OBJECTIVE_IDS.length} 灵草→灵石→补种→备劫`;
}

export function onboardingObjectiveAssetId(objectiveId: OnboardingObjectiveId | null): string {
 switch (objectiveId) {
 case 'first-till':
 return 'loc.herb-plot';
 case 'first-sow':
 return 'icon.seed.mossling';
 case 'first-water':
 return 'icon.item.water-pail';
 case 'first-harvest':
 case 'first-second-sow':
 case 'first-second-water':
 case 'first-loop-complete':
 return 'loc.herb-plot';
 case 'first-ship':
 case 'first-sleep':
 return 'loc.farmstead';
 case 'first-market-restock':
 return 'loc.valley-market';
 default:
 return 'loc.farmstead';
 }
}

export function onboardingObjectiveText(objectiveId: OnboardingObjectiveId | null): string {
 if (!objectiveId) return '';
 return t(`ui.objective.${objectiveId}`);
}

export function stripObjectivePrefix(objectiveText: string): string {
	return objectiveText.replace(/^当前目标：/, '').trim();
}

export function primaryObjectiveLine(objectiveText: string): string {
 const [firstLine = ''] = objectiveText
 .split('\n')
	.map((line) => line.trim())
 .filter((line) => line.length > 0);
 return firstLine;
}

export function normalizeGuidanceLine(guidanceText: string): string {
 const line = primaryObjectiveLine(guidanceText);
 if (!line) return '';
 if (line.startsWith('当前目标：')) return `下一步：${stripObjectivePrefix(line)}`;
 return line;
}

export function onboardingObjectiveHeadline(objectiveId: OnboardingObjectiveId | null): string {
 return stripObjectivePrefix(onboardingObjectiveText(objectiveId));
}

export function inferOnboardingObjectiveId(objectiveText: string): OnboardingObjectiveId | null {
 const headline = stripObjectivePrefix(primaryObjectiveLine(objectiveText));
 if (!headline) return null;
 for (const objectiveId of ONBOARDING_OBJECTIVE_IDS) {
 if (onboardingObjectiveHeadline(objectiveId) === headline) return objectiveId;
 }
 return null;
}

export function onboardingObjectiveRouteLine(objectiveId: OnboardingObjectiveId | null): string {
 if (!objectiveId) return '';
 return ONBOARDING_ROUTE_LINES[objectiveId];
}

export function onboardingObjectiveActionLine(objectiveId: OnboardingObjectiveId | null): string {
 if (!objectiveId) return '';
 return ONBOARDING_ACTION_LINES[objectiveId];
}

export function onboardingObjectivePurposeLine(objectiveId: OnboardingObjectiveId | null): string {
 if (!objectiveId) return '';
 return ONBOARDING_PURPOSE_LINES[objectiveId];
}

export function onboardingObjectivePayoffLine(objectiveId: OnboardingObjectiveId | null): string {
 if (!objectiveId) return '';
 return ONBOARDING_PAYOFF_LINES[objectiveId];
}

export function onboardingHelpText(objectiveId: OnboardingObjectiveId | null): string {
 if (!objectiveId) return '';
 const headline = onboardingObjectiveText(objectiveId);
 const purpose = onboardingObjectivePurposeLine(objectiveId);
 const payoff = onboardingObjectivePayoffLine(objectiveId);
 const action = onboardingObjectiveActionLine(objectiveId);
 const route = onboardingObjectiveRouteLine(objectiveId);
 return [headline, purpose, payoff, action, route].filter((line) => line.length > 0).join('\n');
}

export function onboardingObjectiveAdvanceToast(objectiveId: OnboardingObjectiveId | null): string | null {
 if (!objectiveId) return null;
 const headline = onboardingObjectiveHeadline(objectiveId);
 const action = onboardingObjectiveActionLine(objectiveId).replace(/^操作：/, '');
 if (!headline) return null;
 return action ? `下一步：${headline}｜${action}` : `下一步：${headline}`;
}

export function onboardingObjectiveAdvanceToastPresentation(objectiveId: OnboardingObjectiveId | null): OnboardingToastPresentation | null {
 const message = onboardingObjectiveAdvanceToast(objectiveId);
 if (!message) return null;
 return {
 message,
 assetId: onboardingObjectiveAssetId(objectiveId),
 };
}

const END_DAY_BLOCKED_OBJECTIVES = new Set<OnboardingObjectiveId>([
 'first-ship',
 'first-market-restock',
 'first-second-sow',
 'first-second-water',
]);

export function onboardingEndDayWarning(objectiveId: OnboardingObjectiveId | null): string | null {
 if (!objectiveId || !END_DAY_BLOCKED_OBJECTIVES.has(objectiveId)) return null;
 const headline = onboardingObjectiveHeadline(objectiveId);
 const route = onboardingObjectiveRouteLine(objectiveId);
 return route ? `先别过夜：${headline}｜${route}` : `先别过夜：${headline}`;
}

export function onboardingEndDayWarningToastPresentation(objectiveId: OnboardingObjectiveId | null): OnboardingToastPresentation | null {
 const message = onboardingEndDayWarning(objectiveId);
 if (!message) return null;
 return {
 message,
 assetId: onboardingObjectiveAssetId(objectiveId),
 };
}

export function onboardingWelcomeToastPresentation(helpText: string): OnboardingToastPresentation {
 const objectiveId = inferOnboardingObjectiveId(helpText);
 return {
 message: `修仙农庄开局：灵草换灵石，灵石撑备劫。${helpText}`,
 assetId: onboardingObjectiveAssetId(objectiveId),
 };
}

export function onboardingRestockReturnToastPresentation(): OnboardingToastPresentation {
 return {
 message: '补种完成：回农庄把新买到的种子播回田里。',
 assetId: 'loc.herb-plot',
 };
}

export function onboardingSecondWaterCompletionToastPresentation(): OnboardingToastPresentation {
 return {
 message: '第二轮药材已接上：稳住农务；有余货时按 Shift+M 转去炼丹、阵法与备劫。',
 assetId: 'loc.herb-plot',
 };
}
