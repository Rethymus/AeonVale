import type { AssetId } from '@io/assets';
import type { CultivationStaticPhaseSurface } from './interludeSurfaceShared';

export interface CultivationOpeningBeat {
  readonly mark: string;
  readonly kicker: string;
  readonly title: string;
  readonly body: readonly string[];
  readonly consequence: string;
  readonly assetId: AssetId;
  readonly artworkUrl?: string;
  readonly artworkAlt: string;
  readonly artworkCaption: string;
}

interface CultivationOpeningSurfaceOptions {
  readonly root: HTMLElement;
  readonly beats: readonly CultivationOpeningBeat[];
  readonly initialBeat: number;
  readonly onBeatChange: (beatIndex: number) => void;
  readonly onContinue: () => void;
}

export function createCultivationOpeningSurface(options: CultivationOpeningSurfaceOptions): CultivationStaticPhaseSurface {
  const { root, beats, onBeatChange, onContinue } = options;
  let beatIndex = Math.max(0, Math.min(beats.length - 1, Math.trunc(options.initialBeat)));
  let destroyed = false;

  root.replaceChildren();
  root.classList.add('cr-opening-host');
  root.setAttribute('data-cultivation-interlude-host', '');

  const style = document.createElement('style');
  style.textContent = [
    '.cr-opening{min-height:min(720px,calc(100dvh - 150px));display:grid;grid-template-columns:minmax(0,1.08fr) minmax(320px,.92fr);color:var(--color-paperBright);background:radial-gradient(circle at 76% 18%,rgb(var(--rgb-giltUi) / .12),transparent 34%),rgb(var(--rgb-shellInk) / .92);}',
    '.cr-opening,.cr-opening *{box-sizing:border-box}',
    '.cr-opening__scene{position:relative;min-height:520px;overflow:hidden;border-inline-end:1px solid rgb(var(--rgb-paperBorder) / .55);background:rgb(var(--rgb-shellPine) / .76);}',
    '.cr-opening__art{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:saturate(.72) contrast(1.08) brightness(.72);}',
    '.cr-opening__scene::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent 35%,rgb(var(--rgb-shellInk) / .88)),linear-gradient(0deg,rgb(var(--rgb-shellInk) / .84),transparent 48%);}',
    '.cr-opening__fallback{position:absolute;inset:0;display:grid;place-items:center;color:rgb(var(--rgb-giltUi) / .5);font-family:"Noto Serif CJK SC","Songti SC",serif;font-size:clamp(90px,15vw,180px);}',
    '.cr-opening__caption{position:absolute;z-index:1;inset-inline:24px;inset-block-end:22px;margin:0;color:var(--color-paperUi);font-size:13px;line-height:1.6;letter-spacing:.08em;}',
    '.cr-opening__story{min-width:0;display:flex;flex-direction:column;padding:clamp(24px,4vw,54px);}',
    '.cr-opening__progress{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:0 0 auto;padding:0;list-style:none;}',
    '.cr-opening__progress li{height:3px;background:rgb(var(--rgb-paperBorder) / .38);}',
    '.cr-opening__progress li[data-active="true"]{background:var(--color-giltUi);box-shadow:0 0 14px rgb(var(--rgb-giltUi) / .48);}',
    '.cr-opening__kicker{margin:clamp(26px,5vh,64px) 0 8px;color:var(--color-giltPale);font-size:12px;letter-spacing:.18em;}',
    '.cr-opening__title{margin:0;font-family:"Noto Serif CJK SC","Songti SC",serif;font-size:clamp(34px,4.2vw,58px);font-weight:600;line-height:1.16;letter-spacing:.06em;}',
    '.cr-opening__body{display:grid;gap:12px;margin:24px 0 0;color:var(--color-paperUi);font-size:16px;line-height:1.85;}',
    '.cr-opening__body p{margin:0}',
    '.cr-opening__consequence{margin:22px 0 0;padding:13px 15px;border-inline-start:3px solid var(--color-giltUi);background:rgb(var(--rgb-shellPine) / .58);color:var(--color-paperBright);line-height:1.7;}',
    '.cr-opening__actions{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:auto;padding-top:28px;}',
    '.cr-opening__counter{color:var(--color-paperMuted);font-size:13px;font-variant-numeric:tabular-nums;}',
    '.cr-opening__buttons{display:flex;gap:10px;}',
    '.cr-opening__button{min-height:48px;padding:10px 18px;border:1px solid rgb(var(--rgb-paperBorder) / .72);border-radius:4px;background:rgb(var(--rgb-shellPine) / .66);color:var(--color-paperUi);font-weight:700;cursor:pointer;}',
    '.cr-opening__button[data-primary="true"]{border-color:var(--color-giltUi);background:rgb(var(--rgb-giltUi) / .15);color:var(--color-giltPale);}',
    '.cr-opening__button:focus-visible{outline:3px solid var(--color-giltUi);outline-offset:3px}',
    '@container(max-width:760px){.cr-opening{grid-template-columns:1fr;min-height:0}.cr-opening__scene{min-height:220px;border-inline-end:0;border-block-end:1px solid rgb(var(--rgb-paperBorder) / .55)}.cr-opening__story{padding:22px}.cr-opening__kicker{margin-top:26px}.cr-opening__actions{align-items:stretch;flex-direction:column}.cr-opening__buttons{width:100%}.cr-opening__button{flex:1}}',
    '@media(prefers-reduced-motion:reduce){.cr-opening *{scroll-behavior:auto!important}}'
  ].join('\n');
  root.appendChild(style);

  const section = document.createElement('section');
  section.className = 'cr-opening';
  section.setAttribute('aria-labelledby', 'cr-opening-heading');
  root.appendChild(section);

  const scene = document.createElement('div');
  scene.className = 'cr-opening__scene';
  section.appendChild(scene);
  const fallback = document.createElement('span');
  fallback.className = 'cr-opening__fallback';
  fallback.setAttribute('aria-hidden', 'true');
  scene.appendChild(fallback);
  const image = document.createElement('img');
  image.className = 'cr-opening__art';
  image.alt = '';
  image.setAttribute('aria-hidden', 'true');
  image.decoding = 'async';
  scene.appendChild(image);
  const caption = document.createElement('p');
  caption.className = 'cr-opening__caption';
  scene.appendChild(caption);

  const story = document.createElement('div');
  story.className = 'cr-opening__story';
  section.appendChild(story);
  const progress = document.createElement('ol');
  progress.className = 'cr-opening__progress';
  progress.setAttribute('aria-label', '入世录进度');
  const progressItems = beats.map(() => {
    const item = document.createElement('li');
    progress.appendChild(item);
    return item;
  });
  story.appendChild(progress);
  const kicker = document.createElement('p');
  kicker.className = 'cr-opening__kicker';
  story.appendChild(kicker);
  const heading = document.createElement('h2');
  heading.id = 'cr-opening-heading';
  heading.className = 'cr-opening__title';
  heading.tabIndex = -1;
  story.appendChild(heading);
  const body = document.createElement('div');
  body.className = 'cr-opening__body';
  story.appendChild(body);
  const consequence = document.createElement('p');
  consequence.className = 'cr-opening__consequence';
  story.appendChild(consequence);
  const actions = document.createElement('div');
  actions.className = 'cr-opening__actions';
  story.appendChild(actions);
  const counter = document.createElement('span');
  counter.className = 'cr-opening__counter';
  actions.appendChild(counter);
  const buttons = document.createElement('div');
  buttons.className = 'cr-opening__buttons';
  actions.appendChild(buttons);
  const previous = document.createElement('button');
  previous.type = 'button';
  previous.className = 'cr-opening__button';
  previous.textContent = '上一页';
  const next = document.createElement('button');
  next.type = 'button';
  next.className = 'cr-opening__button';
  next.dataset.primary = 'true';
  buttons.append(previous, next);

  function render(focus = true): void {
    const beat = beats[beatIndex];
    if (!beat) return;
    progressItems.forEach((item, index) => {
      item.dataset.active = String(index <= beatIndex);
    });
    kicker.textContent = beat.kicker;
    heading.textContent = beat.title;
    body.replaceChildren(...beat.body.map(line => {
      const paragraph = document.createElement('p');
      paragraph.textContent = line;
      return paragraph;
    }));
    consequence.textContent = beat.consequence;
    fallback.textContent = beat.mark;
    caption.textContent = beat.artworkCaption;
    scene.setAttribute('role', 'img');
    scene.setAttribute('aria-label', beat.artworkAlt);
    image.hidden = !beat.artworkUrl;
    if (beat.artworkUrl) image.src = beat.artworkUrl;
    counter.textContent = `入世录 ${beatIndex + 1} / ${beats.length}`;
    previous.hidden = beatIndex === 0;
    next.textContent = beatIndex === beats.length - 1 ? '立下第一世日课' : '继续';
    onBeatChange(beatIndex);
    if (focus) heading.focus({ preventScroll: true });
  }

  previous.addEventListener('click', () => {
    beatIndex = Math.max(0, beatIndex - 1);
    render();
  });
  next.addEventListener('click', () => {
    if (beatIndex >= beats.length - 1) {
      onContinue();
      return;
    }
    beatIndex += 1;
    render();
  });
  render(false);

  return {
    focusInitial(): void {
      heading.focus({ preventScroll: true });
    },
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      root.classList.remove('cr-opening-host');
      root.removeAttribute('data-cultivation-interlude-host');
      root.replaceChildren();
    }
  };
}
