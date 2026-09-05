import { CULTIVATION_ACTIVITY_LABELS, type CultivationAshEpitaph, type CultivationLegacyCandidates, type CultivationLegacySelection, type CultivationLegacyStartingEffect, type CultivationLifeConclusion } from '@sim/cultivation-run';
import { appendTextElement } from './surfaceShared';

export interface CultivationLegacySurfaceOptions {
  readonly root: HTMLElement;
  readonly epitaph: CultivationAshEpitaph;
  readonly candidates: CultivationLegacyCandidates;
  readonly portraitUrl?: string;
  readonly epitaphArtUrl?: string;
  readonly onConfirm: (selection: CultivationLegacySelection) => void;
}

export interface CultivationLegacySurface {
  focusInitial(): void;
  destroy(): void;
}

const EFFECT_LABELS: Readonly<Record<keyof CultivationLegacyStartingEffect, string>> = {
  insight: '悟痕',
  mortalHeart: '凡心',
  herbs: '灵草',
  food: '食物',
  spiritStones: '灵石',
  pills: '丹药'
};

let legacySurfaceSequence = 0;

function conclusionLabel(conclusion: CultivationLifeConclusion): string {
  if (conclusion.kind === 'ending') {
    if (conclusion.ending === 'ascended') return '结局：紫雷飞升';
    if (conclusion.ending === 'survived') return '结局：此世善终';
    return '结局：路仍未尽';
  }
  if (conclusion.cause === 'tribulation-overload') return '死因：雷威过载';
  if (conclusion.cause === 'tribulation-timeout') return '死因：步数耗尽，天道强落雷';
  if (conclusion.cause === 'lifespan-ended') return '死因：寿元耗尽';
  return '死因：未载明';
}

function startingEffectText(effect: CultivationLegacyStartingEffect): string {
  const entries = Object.entries(effect) as [keyof CultivationLegacyStartingEffect, number][];
  const visible = entries.filter(([, value]) => value !== 0).map(([field, value]) => `${EFFECT_LABELS[field]} ${value > 0 ? '+' : ''}${value}`);
  return visible.length > 0 ? visible.join(' · ') : '不增加开局数值';
}

function summaryRow(list: HTMLDListElement, label: string, value: string): void {
  appendTextElement(list, 'dt', 'cr-legacy__summary-term', label);
  appendTextElement(list, 'dd', 'cr-legacy__summary-value', value);
}

export function createCultivationLegacySurface(options: CultivationLegacySurfaceOptions): CultivationLegacySurface {
  const { root, epitaph, candidates, portraitUrl, epitaphArtUrl, onConfirm } = options;
  const instanceId = `cultivation-legacy-${++legacySurfaceSequence}`;
  let knowledgeId: string | null = null;
  let relicId: string | null = null;
  let confirmed = false;
  let destroyed = false;

  root.replaceChildren();
  root.classList.add('cr-legacy-host');

  const style = document.createElement('style');
  style.textContent = [
    '.cr-legacy-host{height:100%;min-height:0;overflow:hidden;}',
    '.cr-legacy{display:grid;grid-template-columns:minmax(220px,.78fr) minmax(360px,1.22fr);grid-template-rows:auto minmax(0,1fr) auto;grid-template-areas:"header header" "details selections" "details actions";gap:10px 14px;width:min(100%,1040px);height:100%;min-height:0;margin:0 auto;padding:clamp(8px,2vw,16px);overflow:hidden;color:var(--color-paperBright);}',
    '.cr-legacy__header{grid-area:header;}',
    '.cr-legacy__details{grid-area:details;min-width:0;min-height:0;display:grid;grid-template-rows:minmax(100px,1fr) auto auto;gap:8px;overflow:hidden;}',
    '.cr-legacy__selections{grid-area:selections;min-width:0;min-height:0;display:grid;align-content:start;gap:12px;padding:1px 5px 1px 1px;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin;}',
    '.cr-legacy__header{display:grid;grid-template-columns:auto minmax(0,1fr);gap:14px;align-items:center;border-block-end:1px solid rgb(var(--rgb-paperBorder) / .5);padding-block-end:14px;}',
    '.cr-legacy__portrait{inline-size:72px;block-size:72px;display:grid;place-items:center;margin:0;border:1px solid var(--color-giltUi);border-radius:50%;background:rgb(var(--rgb-shellPine) / .78);color:var(--color-giltPale);font-family:"Noto Serif CJK SC","Songti SC",serif;font-size:26px;}',
    '.cr-legacy__portrait-image{inline-size:100%;block-size:100%;display:block;object-fit:cover;object-position:center 18%;border-radius:inherit;filter:saturate(.72) contrast(1.04);}',
    '.cr-legacy__kicker{margin:0;color:var(--color-giltPale);font-size:12px;letter-spacing:.16em;}',
    '.cr-legacy__title{margin:4px 0 0;font-family:"Noto Serif CJK SC","Songti SC",serif;font-size:clamp(26px,5vw,40px);font-weight:600;text-wrap:balance;}',
    '.cr-legacy__art{position:relative;min-block-size:100px;overflow:hidden;margin:0;border:1px solid rgb(var(--rgb-paperBorder) / .55);background:rgb(var(--rgb-shellPine) / .72);}',
    '.cr-legacy__art::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,transparent 42%,rgb(var(--rgb-shellInk) / .55) 72%,rgb(var(--rgb-shellInk) / .92));pointer-events:none;}',
    '.cr-legacy__art-image{inline-size:100%;block-size:100%;min-block-size:100px;display:block;object-fit:cover;object-position:center 52%;filter:saturate(.7) contrast(1.06);}',
    '.cr-legacy__art-caption{position:absolute;z-index:1;inset-inline:14px;inset-block-end:12px;color:var(--color-paperBright);font-family:"Noto Serif CJK SC","Songti SC",serif;font-size:13px;letter-spacing:.12em;text-shadow:0 1px 6px rgb(var(--rgb-shellInk) / .95),0 0 2px rgb(var(--rgb-shellInk) / .9);}',
    '.cr-legacy__summary{display:grid;grid-template-columns:max-content minmax(0,1fr);gap:7px 14px;margin:0;padding:12px;border:1px solid rgb(var(--rgb-paperBorder) / .45);background:rgb(var(--rgb-shellPine) / .48);}',
    '.cr-legacy__summary-term{color:var(--color-paperMuted);}',
    '.cr-legacy__summary-value{margin:0;color:var(--color-paperBright);}',
    '.cr-legacy__testament{display:grid;gap:7px;margin:0;padding:14px 16px;border-inline-start:4px solid var(--color-giltUi);background:rgb(var(--rgb-shellPine) / .62);}',
    '.cr-legacy__testament-label{color:var(--color-giltPale);font-size:12px;letter-spacing:.12em;}',
    '.cr-legacy__testament-text{margin:0;color:var(--color-paperUi);font-family:"Noto Serif CJK SC","Songti SC",serif;font-size:18px;line-height:1.75;}',
    '.cr-legacy__fieldset{min-width:0;display:grid;gap:10px;margin:0;padding:0;border:0;}',
    '.cr-legacy__legend{padding:0;font-family:"Noto Serif CJK SC","Songti SC",serif;font-size:21px;font-weight:700;}',
    '.cr-legacy__helper{margin:0;color:var(--color-paperMuted);font-size:13px;line-height:1.55;}',
    '.cr-legacy__options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;list-style:none;margin:0;padding:0;}',
    '.cr-legacy__option{min-width:0;}',
    '.cr-legacy__option-label{min-block-size:76px;display:grid;grid-template-columns:auto minmax(0,1fr);gap:10px;align-items:start;padding:12px;border:1px solid rgb(var(--rgb-paperBorder) / .55);border-radius:4px;background:rgb(var(--rgb-shellPine) / .7);cursor:pointer;touch-action:manipulation;}',
    '.cr-legacy__option-label:hover{border-color:var(--color-giltUi);}',
    '.cr-legacy__radio{inline-size:20px;block-size:20px;margin:2px 0 0;accent-color:var(--color-giltUi);}',
    '.cr-legacy__radio:focus-visible{outline:3px solid var(--color-giltUi);outline-offset:3px;}',
    '.cr-legacy__option-label:has(.cr-legacy__radio:checked){border-color:var(--color-giltUi);background:rgb(var(--rgb-giltUi) / .13);}',
    '.cr-legacy__option-copy{display:grid;gap:5px;}',
    '.cr-legacy__option-name{font-family:"Noto Serif CJK SC","Songti SC",serif;font-size:18px;font-weight:700;}',
    '.cr-legacy__option-effect{color:var(--color-paperUi);font-size:13px;line-height:1.55;}',
    '.cr-legacy__actions{grid-area:actions;display:flex;flex-wrap:wrap;justify-content:flex-end;align-items:center;gap:12px;}',
    '.cr-legacy__status{flex:1 1 260px;min-height:1.5em;margin:0;color:var(--color-paperMuted);line-height:1.5;}',
    '.cr-legacy__confirm{min-block-size:48px;padding:10px 18px;border:1px solid var(--color-giltUi);border-radius:4px;background:rgb(var(--rgb-giltUi) / .14);color:var(--color-giltPale);font-weight:700;cursor:pointer;touch-action:manipulation;}',
    '.cr-legacy__confirm:focus-visible{outline:3px solid var(--color-giltUi);outline-offset:3px;}',
    '.cr-legacy__confirm:disabled{cursor:default;opacity:.58;}',
    '@media(max-width:620px){.cr-legacy{grid-template-columns:1fr;grid-template-rows:auto auto minmax(0,1fr) auto;grid-template-areas:"header" "details" "selections" "actions";gap:6px;padding:6px}.cr-legacy__header{grid-template-columns:auto minmax(0,1fr);gap:8px;padding-block-end:6px}.cr-legacy__portrait{inline-size:48px;block-size:48px;font-size:18px}.cr-legacy__title{font-size:21px}.cr-legacy__details{display:block}.cr-legacy__art,.cr-legacy__testament{display:none}.cr-legacy__summary{grid-template-columns:repeat(2,max-content minmax(0,1fr));gap:3px 7px;padding:5px;font-size:9px}.cr-legacy__selections{gap:8px}.cr-legacy__fieldset{gap:5px}.cr-legacy__legend{font-size:16px}.cr-legacy__helper{font-size:10px}.cr-legacy__options{grid-template-columns:1fr}.cr-legacy__option-label{min-block-size:0;padding:7px}.cr-legacy__option-name{font-size:14px}.cr-legacy__option-effect{font-size:10px}.cr-legacy__actions{gap:5px}.cr-legacy__status{font-size:10px}.cr-legacy__confirm{min-block-size:44px;padding:6px 10px}}'
  ].join('\n');
  root.appendChild(style);

  const section = document.createElement('section');
  section.className = 'cr-legacy';
  section.setAttribute('aria-labelledby', `${instanceId}-heading`);
  root.appendChild(section);

  const header = document.createElement('header');
  header.className = 'cr-legacy__header';
  section.appendChild(header);
  const portrait = document.createElement('figure');
  portrait.className = 'cr-legacy__portrait';
  portrait.dataset.portraitId = epitaph.identity.portraitId;
  portrait.setAttribute('role', 'img');
  portrait.setAttribute('aria-label', `${epitaph.identity.name}的劫灰肖像`);
  if (portraitUrl) {
    const image = document.createElement('img');
    image.className = 'cr-legacy__portrait-image';
    image.src = portraitUrl;
    image.alt = '';
    image.setAttribute('aria-hidden', 'true');
    image.decoding = 'async';
    portrait.appendChild(image);
  } else {
    portrait.textContent = '灰';
  }
  header.appendChild(portrait);
  const titleGroup = document.createElement('div');
  header.appendChild(titleGroup);
  appendTextElement(titleGroup, 'p', 'cr-legacy__kicker', '此世已结 · 劫灰碑记');
  const heading = appendTextElement(titleGroup, 'h2', 'cr-legacy__title', epitaph.identity.name);
  heading.id = `${instanceId}-heading`;
  heading.tabIndex = -1;

  const details = document.createElement('div');
  details.className = 'cr-legacy__details';
  section.appendChild(details);

  if (epitaphArtUrl) {
    const art = document.createElement('figure');
    art.className = 'cr-legacy__art';
    const image = document.createElement('img');
    image.className = 'cr-legacy__art-image';
    image.src = epitaphArtUrl;
    image.alt = '';
    image.setAttribute('aria-hidden', 'true');
    image.decoding = 'async';
    const caption = document.createElement('figcaption');
    caption.className = 'cr-legacy__art-caption';
    caption.textContent = '雷散之后，只余旧物与未竟之字';
    art.append(image, caption);
    details.appendChild(art);
  }

  const summary = document.createElement('dl');
  summary.className = 'cr-legacy__summary';
  summaryRow(summary, '最高阶段', `第 ${epitaph.highestStage + 1} 阶`);
  summaryRow(summary, '死因或结局', conclusionLabel(epitaph.conclusion));
  summaryRow(summary, '凡业倾向', epitaph.vocation.primaryActivity === null ? '尚未形成' : CULTIVATION_ACTIVITY_LABELS[epitaph.vocation.primaryActivity]);
  summaryRow(summary, '灵草遗痕', `烧毁 ${epitaph.herbLegacy.scorchedCount} · 保全 ${epitaph.herbLegacy.preservedCount}`);
  summaryRow(summary, '代表灵草', epitaph.herbLegacy.representativeHerb ?? '无');
  details.appendChild(summary);

  const testament = document.createElement('blockquote');
  testament.className = 'cr-legacy__testament';
  appendTextElement(testament, 'span', 'cr-legacy__testament-label', '遗书');
  appendTextElement(testament, 'p', 'cr-legacy__testament-text', epitaph.testament);
  details.appendChild(testament);

  const selections = document.createElement('div');
  selections.className = 'cr-legacy__selections';
  selections.setAttribute('aria-label', '传承选择');
  section.appendChild(selections);

  function createCandidateGroup(kind: 'knowledge' | 'relic', legendText: string, helperText: string): { readonly fieldset: HTMLFieldSetElement; readonly list: HTMLUListElement } {
    const fieldset = document.createElement('fieldset');
    fieldset.className = 'cr-legacy__fieldset';
    const legend = document.createElement('legend');
    legend.className = 'cr-legacy__legend';
    legend.textContent = legendText;
    fieldset.appendChild(legend);
    const helper = appendTextElement(fieldset, 'p', 'cr-legacy__helper', helperText);
    helper.id = `${instanceId}-${kind}-helper`;
    fieldset.setAttribute('aria-describedby', helper.id);
    const list = document.createElement('ul');
    list.className = 'cr-legacy__options';
    list.setAttribute('aria-label', `${legendText}候选`);
    fieldset.appendChild(list);
    selections.appendChild(fieldset);
    return { fieldset, list };
  }

  const knowledgeGroup = createCandidateGroup('knowledge', '留下一项知识', '只保留一页真正读懂的残卷或批注。');
  const relicGroup = createCandidateGroup('relic', '带走一件遗物', '旧物只提供有限开局帮助，不继承前人的身体和库存。');

  const actions = document.createElement('div');
  actions.className = 'cr-legacy__actions';
  const status = document.createElement('p');
  status.id = `${instanceId}-status`;
  status.className = 'cr-legacy__status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-atomic', 'true');
  actions.appendChild(status);
  const confirm = document.createElement('button');
  confirm.type = 'button';
  confirm.className = 'cr-legacy__confirm';
  confirm.textContent = '立碑，交给后来人';
  confirm.setAttribute('aria-describedby', status.id);
  actions.appendChild(confirm);
  section.appendChild(actions);

  function renderSelectionStatus(): void {
    if (confirmed) {
      status.textContent = '传承已立碑，等待后来人接过残卷。';
      confirm.disabled = true;
      return;
    }
    const missing: string[] = [];
    if (knowledgeId === null) missing.push('一项知识');
    if (relicId === null) missing.push('一件遗物');
    confirm.disabled = missing.length > 0;
    status.textContent = missing.length > 0 ? `继续前还需选择${missing.join('和')}。` : '知识与遗物都已选定，可以交给后来人。';
  }

  function appendOption(list: HTMLUListElement, kind: 'knowledge' | 'relic', index: number, id: string, labelText: string, effect: CultivationLegacyStartingEffect): void {
    const item = document.createElement('li');
    item.className = 'cr-legacy__option';
    const label = document.createElement('label');
    label.className = 'cr-legacy__option-label';
    const input = document.createElement('input');
    input.type = 'radio';
    input.className = 'cr-legacy__radio';
    input.name = `${instanceId}-${kind}`;
    input.value = id;
    input.id = `${instanceId}-${kind}-${index}`;
    input.dataset.legacyId = id;
    input.addEventListener('change', () => {
      if (destroyed || confirmed || !input.checked) return;
      if (kind === 'knowledge') knowledgeId = id;
      else relicId = id;
      renderSelectionStatus();
    });
    label.htmlFor = input.id;
    const copy = document.createElement('span');
    copy.className = 'cr-legacy__option-copy';
    appendTextElement(copy, 'span', 'cr-legacy__option-name', labelText);
    appendTextElement(copy, 'span', 'cr-legacy__option-effect', `后来人开局：${startingEffectText(effect)}`);
    label.append(input, copy);
    item.appendChild(label);
    list.appendChild(item);
  }

  candidates.knowledge.forEach((candidate, index) => {
    appendOption(knowledgeGroup.list, 'knowledge', index, candidate.id, candidate.label, candidate.startingEffect);
  });
  candidates.relics.forEach((candidate, index) => {
    appendOption(relicGroup.list, 'relic', index, candidate.id, candidate.label, candidate.startingEffect);
  });

  confirm.addEventListener('click', () => {
    if (destroyed || confirmed || knowledgeId === null || relicId === null) return;
    confirmed = true;
    for (const input of root.querySelectorAll<HTMLInputElement>('.cr-legacy__radio')) input.disabled = true;
    renderSelectionStatus();
    onConfirm({ knowledgeId, relicId });
  });

  renderSelectionStatus();

  return {
    focusInitial(): void {
      if (destroyed) return;
      heading.focus({ preventScroll: true });
    },
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      root.classList.remove('cr-legacy-host');
      root.replaceChildren();
    }
  };
}
