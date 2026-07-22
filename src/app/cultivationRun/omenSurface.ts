import type { AssetId } from '@io/assets';
import { appendCultivationAction, appendCultivationFacts, appendCultivationList, appendCultivationStatus, bindSingleUseAction, createCultivationInterludeFrame, type CultivationInterludeArtwork, type CultivationStaticPhaseSurface } from './interludeSurfaceShared';

export const CULTIVATION_OMEN_ART_ASSET_ID: AssetId = 'cg.first-person.scene.purple-sky-v2';

export interface CultivationOmenRisk {
  readonly label: string;
  readonly detail: string;
  readonly severity: 'known' | 'warning' | 'danger';
}

export interface CultivationOmenView {
  readonly stageLabel: string;
  readonly tribulationName: string;
  readonly objective: string;
  readonly lifespanRemainingDays: number;
  readonly knownSigns: readonly string[];
  readonly risks: readonly CultivationOmenRisk[];
}

export interface CultivationOmenSurfaceOptions {
  readonly root: HTMLElement;
  readonly view: CultivationOmenView;
  readonly artwork?: CultivationInterludeArtwork;
  readonly onContinue: () => void;
}

export function createCultivationOmenSurface(options: CultivationOmenSurfaceOptions): CultivationStaticPhaseSurface {
  const { root, view, onContinue } = options;
  const frame = createCultivationInterludeFrame({
    root,
    hostClass: 'cr-omen-host',
    sectionClass: 'cr-omen',
    phaseMark: '兆',
    phaseLabel: '天书示警',
    kicker: `${view.stageLabel} · 下一道境门`,
    title: view.tribulationName,
    lede: view.objective,
    artwork: options.artwork ?? {
      assetId: CULTIVATION_OMEN_ART_ASSET_ID,
      alt: `${view.tribulationName}的紫色劫云正在远天聚拢`,
      caption: '劫云尚远，准备已经开始计入结果',
      objectPosition: 'center 38%'
    },
    extraStyles: ['[data-cultivation-interlude-host] .cr-omen .cr-interlude__rail{border-color:rgb(var(--rgb-qiFlow) / .72);}', '[data-cultivation-interlude-host] .cr-omen .cr-interlude__mark{border-color:var(--color-qiFlow);}', '[data-cultivation-interlude-host] .cr-omen__risks{display:grid;gap:8px;margin:0;padding:0;list-style:none;}', '[data-cultivation-interlude-host] .cr-omen__risk{display:grid;gap:3px;padding:10px 12px;border-inline-start:3px solid rgb(var(--rgb-paperBorder) / .72);background:rgb(var(--rgb-shellPine) / .42);}', '[data-cultivation-interlude-host] .cr-omen__risk[data-severity="warning"]{border-color:var(--color-giltUi);}', '[data-cultivation-interlude-host] .cr-omen__risk[data-severity="danger"]{border-color:var(--color-dangerUi);}', '[data-cultivation-interlude-host] .cr-omen__risk-label{color:var(--color-paperBright);font-weight:700;}', '[data-cultivation-interlude-host] .cr-omen__risk-detail{color:var(--color-paperMuted);font-size:13px;line-height:1.5;}']
  });

  appendCultivationFacts(frame.copy, [
    { label: '阶段目标', value: view.objective },
    { label: '当前余寿', value: `${view.lifespanRemainingDays} 日`, tone: 'warning' }
  ]);
  appendCultivationList(frame.copy, view.knownSigns, '此劫尚无更多预告，只能保守准备。').setAttribute('aria-label', '已知劫兆');

  const risks = document.createElement('ul');
  risks.className = 'cr-omen__risks';
  risks.setAttribute('aria-label', '主要风险');
  for (const risk of view.risks) {
    const item = document.createElement('li');
    item.className = 'cr-omen__risk';
    item.dataset.severity = risk.severity;
    const label = document.createElement('strong');
    label.className = 'cr-omen__risk-label';
    label.textContent = risk.label;
    const detail = document.createElement('span');
    detail.className = 'cr-omen__risk-detail';
    detail.textContent = risk.detail;
    item.append(label, detail);
    risks.appendChild(item);
  }
  frame.copy.appendChild(risks);

  const status = appendCultivationStatus(frame.actions, `${frame.section.getAttribute('aria-labelledby')}-status`, '劫兆只说明风险，不替你决定修途。');
  const continueButton = appendCultivationAction(frame.actions, '记下劫兆，安排修途', status.id);
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
