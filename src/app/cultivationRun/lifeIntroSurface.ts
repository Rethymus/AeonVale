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
    phaseMark: '身',
    phaseLabel: view.generation === 1 ? '凡骨初卷' : '余灰续卷',
    kicker: view.generation === 1 ? '雨夜拾生 · 尚未入境' : `第 ${view.generation - 1} 位承火者 · 凡骨入局`,
    title: view.identityName,
    lede: view.premise,
    artwork: options.artwork ?? {
      assetId: CULTIVATION_LIFE_INTRO_ART_ASSET_ID,
      alt: `${view.identityName}在破屋中醒来，准备面对第一道劫兆`,
      caption: '凡骨仍轻，旧愿已经压在手中'
    }
  });

  appendCultivationFacts(frame.copy, [
    { label: '当前境阶', value: view.stageLabel },
    { label: '此身余寿', value: `${view.lifespanRemainingDays} 日`, tone: 'warning' }
  ]);
  appendCultivationList(
    frame.copy,
    (view.inheritedMarks ?? []).map(mark => `${mark.label}：${mark.value}`),
    '此身没有旧物护持，只能从第一段修途开始。'
  ).setAttribute('aria-label', '此身所得');

  const status = appendCultivationStatus(frame.actions, `${frame.section.getAttribute('aria-labelledby')}-status`, '继续后先读取本境劫兆，再安排六段修途。');
  const continueButton = appendCultivationAction(frame.actions, '查看第一道劫兆', status.id);
  const unbindContinue = bindSingleUseAction(continueButton, onContinue);

  return {
    focusInitial(): void {
      frame.heading.focus({ preventScroll: true });
    },
    destroy(): void {
      unbindContinue();
      frame.destroy();
    }
  };
}
