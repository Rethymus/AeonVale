import { describe, expect, it } from 'vitest';
import { inferOnboardingObjectiveId, normalizeGuidanceLine, onboardingEndDayWarning, onboardingEndDayWarningToastPresentation, onboardingHelpText, onboardingObjectiveActionLine, onboardingObjectiveAdvanceToast, onboardingObjectiveAdvanceToastPresentation, onboardingObjectiveCultivationHandoffLine, onboardingObjectiveHeadline, onboardingObjectivePayoffLine, onboardingObjectiveProgressLine, onboardingObjectivePurposeLine, onboardingObjectiveRouteLine, onboardingObjectiveText, onboardingRestockReturnToastPresentation, onboardingSecondWaterCompletionToastPresentation, onboardingWelcomeToastPresentation, stripObjectivePrefix } from '@app/onboardingObjective';

describe('onboarding objective helper', () => {
 it('reads objective text from i18n and strips the prefix for compact surfaces', () => {
 expect(onboardingObjectiveText('first-market-restock')).toBe('当前目标：去山谷集市补几颗种子，把第二轮药材接上。');
 expect(onboardingObjectiveHeadline('first-market-restock')).toBe('去山谷集市补几颗种子，把第二轮药材接上。');
 });

it('provides a route line for the first-loop objectives', () => {
 expect(onboardingObjectiveRouteLine('first-second-sow')).toBe('动线：回到农庄，把新买到的种子立刻播回田里。');
 expect(onboardingObjectiveRouteLine('first-loop-complete')).toBe('动线：农务闭环已成，回农庄按 Shift+M 进入加工或阵法入口，把余货转成炉料与防线。');
 });

it('provides a direct action hint for each onboarding step', () => {
 expect(onboardingObjectiveActionLine('first-till')).toBe('操作：站到空地前，按 空格 / E 翻地。');
 expect(onboardingObjectiveActionLine('first-market-restock')).toContain('Shift+Tab 打开地点目录');
 });

it('summarizes first-session progress as a compact task-log line', () => {
 expect(onboardingObjectiveProgressLine('first-till')).toBe('首轮进度：1/10 灵草→灵石→补种→备劫');
 expect(onboardingObjectiveProgressLine('first-market-restock')).toBe('首轮进度：7/10 灵草→灵石→补种→备劫');
 expect(onboardingObjectiveProgressLine('first-loop-complete')).toBe('首轮进度：10/10 灵草→灵石→补种→备劫');
 expect(onboardingObjectiveProgressLine(null)).toBe('');
 });

it('explains why the first farm loop matters for the cultivation fantasy', () => {
 expect(onboardingObjectivePurposeLine('first-till')).toContain('炼丹、布阵和引劫');
 expect(onboardingObjectivePurposeLine('first-loop-complete')).toContain('丹药、阵法与抗劫底气');
 expect(onboardingObjectivePayoffLine('first-harvest')).toContain('出货换灵石');
 expect(onboardingObjectivePayoffLine('first-loop-complete')).toContain('炼丹、设施和引劫准备');
 expect(onboardingObjectiveCultivationHandoffLine('first-loop-complete')).toBe('修行接力：炼丹备避雷丹、布引雷/绝缘阵、淬体满后按 T 主动引劫。');
 expect(onboardingObjectiveCultivationHandoffLine('first-till')).toBe('');
 });

it('builds combined help text for the HUD hint area', () => {
 expect(onboardingHelpText('first-sleep')).toBe([
 '当前目标：按 Enter 过夜，等次日结算换回灵石。',
 '意义：过夜结算会证明农务不是装饰，而是资源循环。',
 '回报：结算后的灵石会直接支持补种，把一次收获变成循环。',
 '操作：确认今日农务已收尾，直接按 Enter 过夜。',
 '动线：把今日农务收尾，直接过夜等次日结算。',
 ].join('\n'));
 });

it('handles empty state and raw string cleanup safely', () => {
 expect(onboardingHelpText(null)).toBe('');
 expect(stripObjectivePrefix('当前目标：先翻出一块地。')).toBe('先翻出一块地。');
 expect(stripObjectivePrefix('')).toBe('');
 });

it('normalizes multi-line guidance text down to one usable next-step line', () => {
 expect(normalizeGuidanceLine(onboardingHelpText('first-market-restock'))).toBe(
 '下一步：去山谷集市补几颗种子，把第二轮药材接上。',
 );
 expect(normalizeGuidanceLine('下一步：按 Enter 过夜，等次日出货结算。\n动线：先收尾今日农务。')).toBe(
 '下一步：按 Enter 过夜，等次日出货结算。',
 );
 });

it('can infer the onboarding objective id back from the current headline text', () => {
 expect(inferOnboardingObjectiveId('当前目标：去山谷集市补几颗种子，把第二轮药材接上。')).toBe('first-market-restock');
 expect(inferOnboardingObjectiveId('当前目标：第二轮药材动线已成立，继续照料新苗、卖余货，或再扩一小片田。')).toBe('first-loop-complete');
 expect(inferOnboardingObjectiveId('当前目标：今天继续稳住节奏，有余力再做别的。')).toBeNull;
 });

it('builds concise next-step toasts for onboarding objective transitions', () => {
 expect(onboardingObjectiveAdvanceToast('first-market-restock')).toBe(
 '下一步：去山谷集市补几颗种子，把第二轮药材接上。｜按 Shift+Tab 打开地点目录，选集市服务后确认补种。',
 );
 expect(onboardingObjectiveAdvanceToast('first-second-water')).toContain('下一步：给刚补种的新苗浇上第一轮水');
 expect(onboardingObjectiveAdvanceToast(null)).toBeNull;
 expect(onboardingObjectiveAdvanceToastPresentation('first-market-restock')).toEqual({
 message: '下一步：去山谷集市补几颗种子，把第二轮药材接上。｜按 Shift+Tab 打开地点目录，选集市服务后确认补种。',
 assetId: 'loc.valley-market',
 });
 });

it('blocks end-day during the few onboarding steps that would otherwise be easy to skip by mistake', () => {
 expect(onboardingEndDayWarning('first-ship')).toBe(
 '先别过夜：把第一株灵草投进出货箱。｜动线：收下成熟灵草后，顺手投进出货箱。',
 );
 expect(onboardingEndDayWarning('first-second-water')).toContain('先别过夜：给刚补种的新苗浇上第一轮水');
 expect(onboardingEndDayWarning('first-sleep')).toBeNull;
 expect(onboardingEndDayWarning(null)).toBeNull;
 expect(onboardingEndDayWarningToastPresentation('first-ship')).toEqual({
 message: '先别过夜：把第一株灵草投进出货箱。｜动线：收下成熟灵草后，顺手投进出货箱。',
 assetId: 'loc.farmstead',
 });
 });

it('anchors first-session loop handoff toasts to the current onboarding subject', () => {
 expect(onboardingRestockReturnToastPresentation()).toEqual({
 message: '补种完成：回农庄把新买到的种子播回田里。',
 assetId: 'loc.herb-plot',
 });

expect(onboardingSecondWaterCompletionToastPresentation()).toEqual({
 message: '第二轮药材已接上：稳住农务；有余货时按 Shift+M 转去炼丹、阵法与备劫。',
 assetId: 'loc.herb-plot',
 });

expect(onboardingWelcomeToastPresentation('当前目标：先翻出一块地。')).toEqual({
 message: '修仙农庄开局：灵草换灵石，灵石撑备劫。当前目标：先翻出一块地。',
 assetId: 'loc.herb-plot',
 });

expect(onboardingWelcomeToastPresentation(onboardingObjectiveText('first-sow'))).toEqual({
 message: `修仙农庄开局：灵草换灵石，灵石撑备劫。${onboardingObjectiveText('first-sow')}`,
 assetId: 'icon.seed.mossling',
 });

expect(onboardingWelcomeToastPresentation(onboardingObjectiveText('first-water'))).toEqual({
 message: `修仙农庄开局：灵草换灵石，灵石撑备劫。${onboardingObjectiveText('first-water')}`,
 assetId: 'icon.item.water-pail',
 });

expect(onboardingWelcomeToastPresentation('当前目标：去山谷集市补几颗种子，把第二轮药材接上。')).toEqual({
 message: '修仙农庄开局：灵草换灵石，灵石撑备劫。当前目标：去山谷集市补几颗种子，把第二轮药材接上。',
 assetId: 'loc.valley-market',
 });

expect(onboardingWelcomeToastPresentation('当前目标：把第一株灵草投进出货箱。')).toEqual({
 message: '修仙农庄开局：灵草换灵石，灵石撑备劫。当前目标：把第一株灵草投进出货箱。',
 assetId: 'loc.farmstead',
 });

expect(onboardingWelcomeToastPresentation('当前目标：今天继续稳住节奏，有余力再做别的。')).toEqual({
 message: '修仙农庄开局：灵草换灵石，灵石撑备劫。当前目标：今天继续稳住节奏，有余力再做别的。',
 assetId: 'loc.farmstead',
 });
 });

it('maps shipping and restock onboarding steps to more specific follow-up assets', () => {
 expect(onboardingObjectiveAdvanceToastPresentation('first-till')).toEqual({
 message: '下一步：先翻出一块地。｜站到空地前，按 空格 / E 翻地。',
 assetId: 'loc.herb-plot',
 });

expect(onboardingObjectiveAdvanceToastPresentation('first-sow')).toEqual({
 message: '下一步：播下第一颗青苔种或露根草种。｜保持站在已翻土地前，按 Z 播下热栏中的种子。',
 assetId: 'icon.seed.mossling',
 });

expect(onboardingObjectiveAdvanceToastPresentation('first-water')).toEqual({
 message: '下一步：给刚种下的幼苗浇一次水。｜面向刚播下的幼苗，按 X 浇第一轮水。',
 assetId: 'icon.item.water-pail',
 });

expect(onboardingObjectiveAdvanceToastPresentation('first-ship')).toEqual({
 message: '下一步：把第一株灵草投进出货箱。｜靠近出货箱，打开出货面板后按 Enter 投货。',
 assetId: 'loc.farmstead',
 });

expect(onboardingObjectiveAdvanceToastPresentation('first-sleep')).toEqual({
 message: '下一步：按 Enter 过夜，等次日结算换回灵石。｜确认今日农务已收尾，直接按 Enter 过夜。',
 assetId: 'loc.farmstead',
 });

expect(onboardingEndDayWarningToastPresentation('first-second-sow')).toEqual({
 message: '先别过夜：把刚补到的种子播回田里，接上第二轮药材。｜动线：回到农庄，把新买到的种子立刻播回田里。',
 assetId: 'loc.herb-plot',
 });
 });
});
