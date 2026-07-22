import type { AssetId } from '@io/assets';
import { appendCultivationAction, appendCultivationFacts, appendCultivationList, appendCultivationStatus, bindSingleUseAction, createCultivationInterludeFrame, type CultivationInterludeArtwork, type CultivationInterludeFact, type CultivationStaticPhaseSurface } from './interludeSurfaceShared';

export const CULTIVATION_LIFE_INTRO_ART_ASSET_ID: AssetId = 'cg.prologue.awakening-v1';

export interface CultivationLifeIntroView {
  readonly identityName: string;
  readonly generation: number;
  readonly stageLabel: string;
  readonly lifespanRemainingDays: number;
  readonly premise: string;
  readonly inheritedMarks?: readonly CultivationInterludeFact[];
}

export interface CultivationLifeIntroSurfaceOptions {
  readonly root: HTMLElement;
  readonly view: CultivationLifeIntroView;
  readonly artwork?: CultivationInterludeArtwork;
  readonly onContinue: () => void;
}

export function createCultivationLifeIntroSurface(options: CultivationLifeIntroSurfaceOptions): CultivationStaticPhaseSurface {
  const { root, view, onContinue } = options;
  const frame = createCultivationInterludeFrame({
    root,
    hostClass: 'cr-life-intro-host',
    sectionClass: 'cr-life-intro',
    phaseMark: '世',
    phaseLabel: '新世启卷',
    kicker: `第 ${view.generation} 世 · 凡骨入局`,
    title: view.identityName,
    lede: view.premise,
    artwork: options.artwork ?? {
      assetId: CULTIVATION_LIFE_INTRO_ART_ASSET_ID,
      alt: `${view.identityName}在破屋中醒来，准备翻开这一世的日课`,
      caption: '凡骨仍轻，旧愿已经压在手中'
    }
  });

  appendCultivationFacts(frame.copy, [
    { label: '当前境阶', value: view.stageLabel },
    { label: '此世余寿', value: `${view.lifespanRemainingDays} 日`, tone: 'warning' }
  ]);
  appendCultivationList(
    frame.copy,
    (view.inheritedMarks ?? []).map(mark => `${mark.label}：${mark.value}`),
    '这一世没有旧物护身，只能从第一格日课开始。'
  ).setAttribute('aria-label', '此世继承');

  const status = appendCultivationStatus(frame.actions, `${frame.section.getAttribute('aria-labelledby')}-status`, '继续后先读取本阶段劫兆，再安排六格日课。');
  const continueButton = appendCultivationAction(frame.actions, '翻开今世日课', status.id);
  const unbindContinue = bindSingleUseAction(continueButton, onContinue);

  return {
    focusInitial(): void {
      frame.section.scrollIntoView?.({ block: 'start', behavior: 'auto' });
      frame.heading.focus({ preventScroll: true });
    },
    destroy(): void {
      unbindContinue();
      frame.destroy();
    }
  };
}
