import type { AssetId } from '@io/assets';
import { appendCultivationAction, appendCultivationFacts, appendCultivationList, appendCultivationStatus, bindSingleUseAction, createCultivationInterludeFrame, type CultivationInterludeArtwork, type CultivationInterludeFact, type CultivationStaticPhaseSurface } from './interludeSurfaceShared';

export type CultivationEndingKind = 'ascended' | 'survived' | 'unfinished';

export const CULTIVATION_ENDING_ART_ASSET_IDS: Readonly<Record<CultivationEndingKind, AssetId>> = {
  ascended: 'cg.first-person.ending.ascension-v2',
  survived: 'cg.first-person.scene.mortal-montage-v2',
  unfinished: 'cg.first-person.scene.farm-autumn-v2'
};

export interface CultivationEndingView {
  readonly kind: CultivationEndingKind;
  readonly identityName: string;
  readonly title: string;
  readonly epilogue: string;
  readonly records: readonly CultivationInterludeFact[];
  readonly closingLines?: readonly string[];
}

export interface CultivationEndingSurfaceOptions {
  readonly root: HTMLElement;
  readonly view: CultivationEndingView;
  readonly artwork?: CultivationInterludeArtwork;
  readonly onReturnToTitle: () => void;
  readonly onBeginAnotherLife?: () => void;
}

const ENDING_COPY: Readonly<Record<CultivationEndingKind, { readonly mark: string; readonly phase: string; readonly kicker: string; readonly caption: string }>> = {
  ascended: { mark: '升', phase: '此道已成', kicker: '紫雷尽处 · 凡骨飞升', caption: '这一回，身体与道统一同越过了天门' },
  survived: { mark: '归', phase: '此身善终', kicker: '雷声已远 · 人间仍在', caption: '没有飞升，此身也留下了完整的名字' },
  unfinished: { mark: '续', phase: '此路未尽', kicker: '卷尾留白 · 后来人可续', caption: '未竟之志不会自动变成胜利，只会等待下一双手' }
};

export function createCultivationEndingSurface(options: CultivationEndingSurfaceOptions): CultivationStaticPhaseSurface {
  const { root, view, onReturnToTitle, onBeginAnotherLife } = options;
  const copy = ENDING_COPY[view.kind];
  const frame = createCultivationInterludeFrame({
    root,
    hostClass: 'cr-ending-host',
    sectionClass: 'cr-cultivation-ending',
    phaseMark: copy.mark,
    phaseLabel: copy.phase,
    kicker: `${copy.kicker} · ${view.identityName}`,
    title: view.title,
    lede: view.epilogue,
    artwork: options.artwork ?? {
      assetId: CULTIVATION_ENDING_ART_ASSET_IDS[view.kind],
      alt: `${view.identityName}的结局留影：${view.title}`,
      caption: copy.caption
    },
    extraStyles: ['[data-cultivation-interlude-host] .cr-cultivation-ending .cr-interlude__rail{border-inline-end:4px double rgb(var(--rgb-paperBorder) / .76);}', '[data-cultivation-interlude-host] .cr-cultivation-ending .cr-interlude__mark{border-radius:2px;box-shadow:inset 0 0 0 3px rgb(var(--rgb-shellPine) / .72);}']
  });

  appendCultivationFacts(frame.copy, view.records);
  appendCultivationList(frame.copy, view.closingLines ?? [], '碑上只余姓名，余下的话交给玩家记住。').setAttribute('aria-label', '结局余韵');

  const statusText = onBeginAnotherLife ? '可以回到标题，也可以让另一位凡人接过未尽之路。' : '此身历程已经完整收束，可以回到标题。';
  const status = appendCultivationStatus(frame.actions, `${frame.section.getAttribute('aria-labelledby')}-status`, statusText);
  const buttons: HTMLButtonElement[] = [];
  const returnButton = appendCultivationAction(frame.actions, '返回标题', status.id, onBeginAnotherLife ? 'quiet' : 'primary');
  buttons.push(returnButton);
  const anotherLifeButton = onBeginAnotherLife ? appendCultivationAction(frame.actions, '让后来人接续', status.id) : null;
  if (anotherLifeButton) buttons.push(anotherLifeButton);
  const unbindReturn = bindSingleUseAction(returnButton, onReturnToTitle, buttons);
  const unbindAnotherLife = anotherLifeButton && onBeginAnotherLife ? bindSingleUseAction(anotherLifeButton, onBeginAnotherLife, buttons) : null;

  return {
    focusInitial(): void {
      frame.heading.focus({ preventScroll: true });
    },
    destroy(): void {
      unbindReturn();
      unbindAnotherLife?.();
      frame.destroy();
    }
  };
}
