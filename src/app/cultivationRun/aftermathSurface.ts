import type { AssetId } from '@io/assets';
import { appendCultivationAction, appendCultivationFacts, appendCultivationList, appendCultivationStatus, bindSingleUseAction, createCultivationInterludeFrame, type CultivationInterludeArtwork, type CultivationInterludeFact, type CultivationStaticPhaseSurface } from './interludeSurfaceShared';

export type CultivationAftermathKind = 'breakthrough' | 'recovery' | 'repelled';

export const CULTIVATION_AFTERMATH_ART_ASSET_IDS: Readonly<Record<CultivationAftermathKind, AssetId>> = {
  breakthrough: 'cg.first-person.tribulation.purple-v2',
  recovery: 'cg.first-person.scene.spirit-farm-v2',
  repelled: 'cg.first-person.scene.farm-autumn-v2'
};

export interface CultivationAftermathView {
  readonly kind: CultivationAftermathKind;
  readonly stageLabel: string;
  readonly title: string;
  readonly detail: string;
  readonly consequences: readonly CultivationInterludeFact[];
  readonly rememberedMoments?: readonly string[];
  readonly nextActionLabel: string;
}

export interface CultivationAftermathSurfaceOptions {
  readonly root: HTMLElement;
  readonly view: CultivationAftermathView;
  readonly artwork?: CultivationInterludeArtwork;
  readonly onContinue: () => void;
}

const AFTERMATH_COPY: Readonly<Record<CultivationAftermathKind, { readonly mark: string; readonly label: string; readonly kicker: string; readonly caption: string }>> = {
  breakthrough: { mark: '破', label: '雷后新境', kicker: '劫雷入骨 · 境阶已破', caption: '雷光退去，留下的是一副更能承受天意的身体' },
  recovery: { mark: '生', label: '带伤归田', kicker: '护持生效 · 此身未断', caption: '命保住了，代价会写进下一轮修途' },
  repelled: { mark: '退', label: '劫后清点', kicker: '天劫暂退 · 功行未成', caption: '失败没有抹去准备，也没有替你免除代价' }
};

export function createCultivationAftermathSurface(options: CultivationAftermathSurfaceOptions): CultivationStaticPhaseSurface {
  const { root, view, onContinue } = options;
  const copy = AFTERMATH_COPY[view.kind];
  const frame = createCultivationInterludeFrame({
    root,
    hostClass: 'cr-aftermath-host',
    sectionClass: 'cr-aftermath',
    phaseMark: copy.mark,
    phaseLabel: copy.label,
    kicker: `${copy.kicker} · ${view.stageLabel}`,
    title: view.title,
    lede: view.detail,
    artwork: options.artwork ?? {
      assetId: CULTIVATION_AFTERMATH_ART_ASSET_IDS[view.kind],
      alt: `${view.title}后的劫场余景`,
      caption: copy.caption
    },
    extraStyles: ['[data-cultivation-interlude-host] .cr-aftermath .cr-interlude__rail{border-inline-end-width:3px;border-color:rgb(var(--rgb-paperBorder) / .7);}', '[data-cultivation-interlude-host] .cr-aftermath .cr-interlude__mark{border-radius:2px;}']
  });

  appendCultivationFacts(frame.copy, view.consequences);
  appendCultivationList(frame.copy, view.rememberedMoments ?? [], '这一劫没有留下额外记述。').setAttribute('aria-label', '本次天劫留下的记忆');

  const status = appendCultivationStatus(frame.actions, `${frame.section.getAttribute('aria-labelledby')}-status`, view.kind === 'breakthrough' ? '继续后进入下一境，新修途与劫兆将随之显现。' : '继续后回到修途，伤势与损耗会保留。');
  const continueButton = appendCultivationAction(frame.actions, view.nextActionLabel, status.id);
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
