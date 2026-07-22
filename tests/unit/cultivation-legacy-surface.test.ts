// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createCultivationAshEpitaph,
  deriveCultivationLegacyCandidates
} from '@sim/cultivation-run';
import { createCultivationLegacySurface } from '@app/cultivationRun/legacySurface';

function fixture() {
  const epitaph = createCultivationAshEpitaph({
    identity: { name: '沈砚', portraitId: 'portrait.cultivator.01' },
    highestStage: 3,
    conclusion: { kind: 'death', cause: 'tribulation-overload' },
    activityCounts: { training: 2, farming: 6, alchemy: 3, insight: 4, rest: 1 },
    eventHistoryTags: ['kept-mother-seeds', 'patched-furnace-by-hand'],
    unlockedKnowledgeNodeIds: ['foundation-rhythm', 'field-breathing'],
    herbsScorched: 2,
    herbsPreserved: 3,
    representativeHerb: '引雷草'
  });
  return { epitaph, candidates: deriveCultivationLegacyCandidates(epitaph) };
}

function rootElement(): HTMLElement {
  const root = document.createElement('div');
  document.body.appendChild(root);
  return root;
}

beforeEach(() => {
  document.body.replaceChildren();
});

describe('D27-e · 劫灰传承玩家面', () => {
  it('完整展示碑记身份、结局、凡业、遗书与灵草遗痕', () => {
    const root = rootElement();
    const { epitaph, candidates } = fixture();
    createCultivationLegacySurface({ root, epitaph, candidates, onConfirm: vi.fn() });

    expect(root.querySelector('h2')?.textContent).toBe('沈砚');
    expect(root.querySelector('.cr-legacy__portrait')?.getAttribute('role')).toBe('img');
    expect(root.querySelector('.cr-legacy__portrait')?.getAttribute('aria-label')).toContain('沈砚');
    expect(root.querySelector('.cr-legacy__portrait')?.getAttribute('data-portrait-id')).toBe('portrait.cultivator.01');
    expect(root.querySelector('.cr-legacy__summary')?.textContent).toContain('第 4 阶');
    expect(root.querySelector('.cr-legacy__summary')?.textContent).toContain('雷威过载');
    expect(root.querySelector('.cr-legacy__summary')?.textContent).toContain('灵田');
    expect(root.querySelector('.cr-legacy__summary')?.textContent).toContain('烧毁 2 · 保全 3');
    expect(root.querySelector('.cr-legacy__summary')?.textContent).toContain('引雷草');
    expect(root.querySelector('.cr-legacy__testament-text')?.textContent).toContain('炉缝');
  });

  it('使用两个原生单选组，选满前禁用确认并解释缺失项', () => {
    const root = rootElement();
    const { epitaph, candidates } = fixture();
    createCultivationLegacySurface({ root, epitaph, candidates, onConfirm: vi.fn() });

    const fieldsets = root.querySelectorAll('fieldset');
    const knowledge = root.querySelectorAll<HTMLInputElement>('input[type="radio"][name$="-knowledge"]');
    const relics = root.querySelectorAll<HTMLInputElement>('input[type="radio"][name$="-relic"]');
    const confirm = root.querySelector<HTMLButtonElement>('.cr-legacy__confirm')!;
    const status = root.querySelector('.cr-legacy__status')!;

    expect(fieldsets).toHaveLength(2);
    expect(fieldsets[0]?.querySelector('legend')?.textContent).toBe('留下一项知识');
    expect(fieldsets[1]?.querySelector('legend')?.textContent).toBe('带走一件遗物');
    expect(knowledge).toHaveLength(candidates.knowledge.length);
    expect(relics).toHaveLength(candidates.relics.length);
    expect(new Set(Array.from(knowledge, input => input.name)).size).toBe(1);
    expect(new Set(Array.from(relics, input => input.name)).size).toBe(1);
    expect(knowledge[0]?.name).not.toBe(relics[0]?.name);
    expect(status.getAttribute('role')).toBe('status');
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(confirm.getAttribute('aria-describedby')).toBe(status.id);
    expect(confirm.disabled).toBe(true);
    expect(status.textContent).toContain('一项知识和一件遗物');

    knowledge[0]?.click();
    expect(confirm.disabled).toBe(true);
    expect(status.textContent).toContain('一件遗物');
    relics[0]?.click();
    expect(confirm.disabled).toBe(false);
    expect(status.textContent).toContain('可以交给后来人');
  });

  it('确认后只派发所选一项知识与一件遗物，并锁定重复提交', () => {
    const root = rootElement();
    const { epitaph, candidates } = fixture();
    const onConfirm = vi.fn();
    createCultivationLegacySurface({ root, epitaph, candidates, onConfirm });

    root.querySelector<HTMLInputElement>('[data-legacy-id="knowledge:foundation-rhythm"]')?.click();
    root.querySelector<HTMLInputElement>('[data-legacy-id="relic:cracked-furnace"]')?.click();
    const confirm = root.querySelector<HTMLButtonElement>('.cr-legacy__confirm')!;
    confirm.click();
    confirm.click();

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith({
      knowledgeId: 'knowledge:foundation-rhythm',
      relicId: 'relic:cracked-furnace'
    });
    expect(confirm.disabled).toBe(true);
    expect(root.querySelector('.cr-legacy__status')?.textContent).toContain('传承已立碑');
    expect(Array.from(root.querySelectorAll<HTMLInputElement>('.cr-legacy__radio')).every(input => input.disabled)).toBe(true);
  });

  it('原生控件支持键盘焦点与整卡触控，销毁后清理宿主', () => {
    const root = rootElement();
    const { epitaph, candidates } = fixture();
    const surface = createCultivationLegacySurface({ root, epitaph, candidates, onConfirm: vi.fn() });
    const firstRadio = root.querySelector<HTMLInputElement>('.cr-legacy__radio')!;
    const firstLabel = firstRadio.closest('label');

    expect(firstRadio.type).toBe('radio');
    expect(firstLabel?.htmlFor).toBe(firstRadio.id);
    expect(firstLabel?.textContent).toContain('后来人开局');
    expect(root.querySelector('style')?.textContent).toContain('touch-action:manipulation');
    surface.focusInitial();
    expect(document.activeElement).toBe(root.querySelector('h2'));
    firstRadio.click();
    expect(firstRadio.checked).toBe(true);

    surface.destroy();
    expect(root.childElementCount).toBe(0);
    expect(root.classList.contains('cr-legacy-host')).toBe(false);
  });
});
