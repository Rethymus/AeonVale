import type { AssetId } from '@io/assets';
import { appendTextElement } from './surfaceShared';

export interface CultivationInterludeArtwork {
  readonly assetId: AssetId;
  readonly url?: string;
  readonly alt: string;
  readonly caption?: string;
  readonly objectPosition?: string;
}

export interface CultivationInterludeFact {
  readonly label: string;
  readonly value: string;
  readonly tone?: 'neutral' | 'good' | 'warning' | 'danger';
}

export interface CultivationStaticPhaseSurface {
  focusInitial(): void;
  destroy(): void;
}

interface CultivationInterludeFrameOptions {
  readonly root: HTMLElement;
  readonly hostClass: string;
  readonly sectionClass: string;
  readonly phaseMark: string;
  readonly phaseLabel: string;
  readonly kicker: string;
  readonly title: string;
  readonly lede: string;
  readonly artwork?: CultivationInterludeArtwork;
  readonly extraStyles?: readonly string[];
}

interface CultivationInterludeFrame {
  readonly section: HTMLElement;
  readonly heading: HTMLHeadingElement;
  readonly body: HTMLElement;
  readonly copy: HTMLElement;
  readonly actions: HTMLElement;
  destroy(): void;
}

let interludeSurfaceSequence = 0;

const BASE_STYLES = [
  '[data-cultivation-interlude-host]{container-type:inline-size;}',
  '[data-cultivation-interlude-host] .cr-interlude{display:grid;grid-template-columns:44px minmax(0,1fr);width:100%;max-width:1240px;min-height:100%;margin:0 auto;padding:clamp(14px,2vw,28px);color:var(--color-paperBright);}',
  '[data-cultivation-interlude-host] .cr-interlude__rail{grid-row:1/span 3;display:flex;flex-direction:column;align-items:center;gap:10px;border-inline-end:1px solid rgb(var(--rgb-paperBorder) / .5);padding-inline-end:12px;color:var(--color-giltPale);}',
  '[data-cultivation-interlude-host] .cr-interlude__mark{display:grid;place-items:center;inline-size:30px;block-size:30px;border:1px solid currentColor;border-radius:50%;font-family:"Noto Serif CJK SC","Songti SC",serif;font-size:17px;}',
  '[data-cultivation-interlude-host] .cr-interlude__phase{writing-mode:vertical-rl;color:var(--color-paperMuted);font-size:11px;letter-spacing:.16em;}',
  '[data-cultivation-interlude-host] .cr-interlude__main{min-width:0;display:grid;gap:18px;padding-inline-start:clamp(14px,3vw,28px);}',
  '[data-cultivation-interlude-host] .cr-interlude__header{display:grid;gap:6px;border-block-end:1px solid rgb(var(--rgb-paperBorder) / .42);padding-block-end:14px;}',
  '[data-cultivation-interlude-host] .cr-interlude__kicker{margin:0;color:var(--color-giltPale);font-size:12px;letter-spacing:.14em;}',
  '[data-cultivation-interlude-host] .cr-interlude__title{margin:0;font-family:"Noto Serif CJK SC","Songti SC",serif;font-size:clamp(28px,6vw,48px);font-weight:600;line-height:1.16;text-wrap:balance;}',
  '[data-cultivation-interlude-host] .cr-interlude__lede{max-width:66ch;margin:0;color:var(--color-paperUi);font-size:15px;line-height:1.75;text-wrap:pretty;}',
  '[data-cultivation-interlude-host] .cr-interlude__body{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(230px,.85fr);gap:clamp(14px,3vw,24px);align-items:start;}',
  '[data-cultivation-interlude-host] .cr-interlude__copy{min-width:0;display:grid;gap:14px;}',
  '[data-cultivation-interlude-host] .cr-interlude__art{position:relative;min-block-size:210px;overflow:hidden;margin:0;border:1px solid rgb(var(--rgb-paperBorder) / .55);background:radial-gradient(circle at 65% 20%,rgb(var(--rgb-giltUi) / .13),transparent 44%),rgb(var(--rgb-shellPine) / .68);}',
  '[data-cultivation-interlude-host] .cr-interlude__art-image{inline-size:100%;block-size:100%;min-block-size:210px;display:block;object-fit:cover;filter:saturate(.72) contrast(1.05);}',
  '[data-cultivation-interlude-host] .cr-interlude__art-fallback{min-block-size:210px;display:grid;place-items:center;color:rgb(var(--rgb-giltUi) / .62);font-family:"Noto Serif CJK SC","Songti SC",serif;font-size:clamp(48px,10vw,86px);}',
  '[data-cultivation-interlude-host] .cr-interlude__art::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,transparent 50%,rgb(var(--rgb-shellInk) / .78));pointer-events:none;}',
  '[data-cultivation-interlude-host] .cr-interlude__art-caption{position:absolute;z-index:1;inset-inline:12px;inset-block-end:10px;color:var(--color-paperBright);font-size:12px;line-height:1.5;letter-spacing:.08em;}',
  '[data-cultivation-interlude-host] .cr-interlude__facts{display:grid;grid-template-columns:max-content minmax(0,1fr);gap:8px 14px;margin:0;padding:13px 14px;border:1px solid rgb(var(--rgb-paperBorder) / .44);background:rgb(var(--rgb-shellPine) / .5);}',
  '[data-cultivation-interlude-host] .cr-interlude__fact-label{color:var(--color-paperMuted);}',
  '[data-cultivation-interlude-host] .cr-interlude__fact-value{margin:0;color:var(--color-paperBright);}',
  '[data-cultivation-interlude-host] .cr-interlude__fact-value[data-tone="good"]{color:var(--color-giltPale);}',
  '[data-cultivation-interlude-host] .cr-interlude__fact-value[data-tone="warning"]{color:var(--color-giltUi);}',
  '[data-cultivation-interlude-host] .cr-interlude__fact-value[data-tone="danger"]{color:var(--color-dangerUi);}',
  '[data-cultivation-interlude-host] .cr-interlude__list{display:grid;gap:8px;margin:0;padding:0;list-style:none;}',
  '[data-cultivation-interlude-host] .cr-interlude__list-item{display:grid;grid-template-columns:auto minmax(0,1fr);gap:9px;align-items:start;padding:10px 12px;border-inline-start:3px solid rgb(var(--rgb-paperBorder) / .72);background:rgb(var(--rgb-shellPine) / .42);line-height:1.55;}',
  '[data-cultivation-interlude-host] .cr-interlude__list-item::before{content:"◆";color:var(--color-giltUi);font-size:10px;line-height:2;}',
  '[data-cultivation-interlude-host] .cr-interlude__actions{display:flex;flex-wrap:wrap;justify-content:flex-end;align-items:center;gap:10px;border-block-start:1px solid rgb(var(--rgb-paperBorder) / .42);padding-block-start:14px;}',
  '[data-cultivation-interlude-host] .cr-interlude__status{flex:1 1 280px;min-block-size:1.5em;margin:0;color:var(--color-paperMuted);line-height:1.5;}',
  '[data-cultivation-interlude-host] .cr-interlude__button{min-block-size:48px;padding:10px 18px;border:1px solid var(--color-giltUi);border-radius:4px;background:rgb(var(--rgb-giltUi) / .14);color:var(--color-giltPale);font-weight:700;cursor:pointer;touch-action:manipulation;}',
  '[data-cultivation-interlude-host] .cr-interlude__button[data-variant="quiet"]{border-color:rgb(var(--rgb-paperBorder) / .66);background:rgb(var(--rgb-shellPine) / .58);color:var(--color-paperUi);}',
  '[data-cultivation-interlude-host] .cr-interlude__button:hover:not(:disabled){border-color:var(--color-paperBright);}',
  '[data-cultivation-interlude-host] .cr-interlude__button:focus-visible{outline:3px solid var(--color-giltUi);outline-offset:3px;}',
  '[data-cultivation-interlude-host] .cr-interlude__button:disabled{cursor:default;opacity:.58;}',
  '@media(prefers-reduced-motion:reduce){[data-cultivation-interlude-host] *,[data-cultivation-interlude-host] *::before,[data-cultivation-interlude-host] *::after{scroll-behavior:auto!important;transition-duration:.01ms!important;animation-duration:.01ms!important;animation-iteration-count:1!important}}',
  '@container(max-width:700px){[data-cultivation-interlude-host] .cr-interlude__body{grid-template-columns:1fr}[data-cultivation-interlude-host] .cr-interlude__art{order:-1;min-block-size:160px}[data-cultivation-interlude-host] .cr-interlude__art-image,[data-cultivation-interlude-host] .cr-interlude__art-fallback{min-block-size:160px;max-block-size:240px}}',
  '@container(max-width:460px){[data-cultivation-interlude-host] .cr-interlude{grid-template-columns:30px minmax(0,1fr)}[data-cultivation-interlude-host] .cr-interlude__rail{padding-inline-end:7px}[data-cultivation-interlude-host] .cr-interlude__mark{inline-size:25px;block-size:25px;font-size:14px}[data-cultivation-interlude-host] .cr-interlude__main{padding-inline-start:12px}[data-cultivation-interlude-host] .cr-interlude__facts{grid-template-columns:1fr}[data-cultivation-interlude-host] .cr-interlude__fact-value{margin-block-end:5px}[data-cultivation-interlude-host] .cr-interlude__button{inline-size:100%}}'
];

export function appendCultivationFacts(parent: HTMLElement, facts: readonly CultivationInterludeFact[]): HTMLDListElement {
  const list = document.createElement('dl');
  list.className = 'cr-interlude__facts';
  for (const fact of facts) {
    appendTextElement(list, 'dt', 'cr-interlude__fact-label', fact.label);
    const value = appendTextElement(list, 'dd', 'cr-interlude__fact-value', fact.value);
    value.dataset.tone = fact.tone ?? 'neutral';
  }
  parent.appendChild(list);
  return list;
}

export function appendCultivationList(parent: HTMLElement, items: readonly string[], emptyText: string): HTMLUListElement {
  const list = document.createElement('ul');
  list.className = 'cr-interlude__list';
  list.setAttribute('aria-label', '当前要点');
  for (const text of items.length > 0 ? items : [emptyText]) {
    appendTextElement(list, 'li', 'cr-interlude__list-item', text);
  }
  parent.appendChild(list);
  return list;
}

export function appendCultivationStatus(actions: HTMLElement, id: string, text: string): HTMLParagraphElement {
  const status = appendTextElement(actions, 'p', 'cr-interlude__status', text);
  status.id = id;
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-atomic', 'true');
  return status;
}

export function appendCultivationAction(actions: HTMLElement, label: string, descriptionId?: string, variant: 'primary' | 'quiet' = 'primary'): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'cr-interlude__button';
  button.dataset.variant = variant;
  button.textContent = label;
  if (descriptionId) button.setAttribute('aria-describedby', descriptionId);
  actions.appendChild(button);
  return button;
}

export function createCultivationInterludeFrame(options: CultivationInterludeFrameOptions): CultivationInterludeFrame {
  const { root, hostClass, sectionClass, phaseMark, phaseLabel, kicker, title, lede, artwork, extraStyles = [] } = options;
  const instanceId = `cultivation-interlude-${++interludeSurfaceSequence}`;
  let destroyed = false;

  root.replaceChildren();
  root.classList.add(hostClass);
  root.setAttribute('data-cultivation-interlude-host', '');

  const style = document.createElement('style');
  style.textContent = [...BASE_STYLES, ...extraStyles].join('\n');
  root.appendChild(style);

  const section = document.createElement('section');
  section.className = `cr-interlude ${sectionClass}`;
  section.setAttribute('aria-labelledby', `${instanceId}-heading`);
  root.appendChild(section);

  const rail = document.createElement('aside');
  rail.className = 'cr-interlude__rail';
  rail.setAttribute('aria-hidden', 'true');
  appendTextElement(rail, 'span', 'cr-interlude__mark', phaseMark);
  appendTextElement(rail, 'span', 'cr-interlude__phase', phaseLabel);
  section.appendChild(rail);

  const main = document.createElement('div');
  main.className = 'cr-interlude__main';
  section.appendChild(main);

  const header = document.createElement('header');
  header.className = 'cr-interlude__header';
  main.appendChild(header);
  appendTextElement(header, 'p', 'cr-interlude__kicker', kicker);
  const heading = appendTextElement(header, 'h2', 'cr-interlude__title', title);
  heading.id = `${instanceId}-heading`;
  heading.tabIndex = -1;
  appendTextElement(header, 'p', 'cr-interlude__lede', lede);

  const body = document.createElement('div');
  body.className = 'cr-interlude__body';
  main.appendChild(body);
  const copy = document.createElement('div');
  copy.className = 'cr-interlude__copy';
  body.appendChild(copy);

  if (artwork) {
    const figure = document.createElement('figure');
    figure.className = 'cr-interlude__art';
    figure.dataset.assetId = artwork.assetId;
    figure.setAttribute('role', 'img');
    figure.setAttribute('aria-label', artwork.alt);
    if (artwork.url) {
      const image = document.createElement('img');
      image.className = 'cr-interlude__art-image';
      image.src = artwork.url;
      image.alt = '';
      image.setAttribute('aria-hidden', 'true');
      image.decoding = 'async';
      if (artwork.objectPosition) image.style.objectPosition = artwork.objectPosition;
      figure.appendChild(image);
    } else {
      const fallback = appendTextElement(figure, 'span', 'cr-interlude__art-fallback', phaseMark);
      fallback.setAttribute('aria-hidden', 'true');
    }
    if (artwork.caption) appendTextElement(figure, 'figcaption', 'cr-interlude__art-caption', artwork.caption);
    body.appendChild(figure);
  }

  const actions = document.createElement('div');
  actions.className = 'cr-interlude__actions';
  main.appendChild(actions);

  return {
    section,
    heading,
    body,
    copy,
    actions,
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      root.classList.remove(hostClass);
      root.removeAttribute('data-cultivation-interlude-host');
      root.replaceChildren();
    }
  };
}

export function bindSingleUseAction(button: HTMLButtonElement, callback: () => void, relatedButtons: readonly HTMLButtonElement[] = [button]): () => void {
  let used = false;
  const activate = (): void => {
    if (used || button.disabled) return;
    used = true;
    for (const related of relatedButtons) related.disabled = true;
    callback();
  };
  button.addEventListener('click', activate);
  return () => {
    used = true;
    button.removeEventListener('click', activate);
  };
}
