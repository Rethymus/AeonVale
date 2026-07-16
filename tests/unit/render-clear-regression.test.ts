import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const renderSources = ['../../src/render/renderer.ts', '../../src/render/furnacePanel.ts', '../../src/render/sprites.ts'] as const;

describe('render cleanup regression', () => {
  it.each(renderSources)('%s invokes clear methods instead of referencing them', relativePath => {
    const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8');

    expect(source).not.toMatch(/\.clear\s*;/);
  });

  it('guards retained canvas Text writes in renderer hot paths', () => {
    const renderer = readFileSync(new URL('../../src/render/renderer.ts', import.meta.url), 'utf8');
    const furnace = readFileSync(new URL('../../src/render/furnacePanel.ts', import.meta.url), 'utf8');
    const guardedAssignment = 'target.text = nextText;';

    expect(renderer.match(/\.text\s*=(?!=)/g)).toHaveLength(1);
    expect(renderer).toContain(guardedAssignment);
    expect(renderer.replace(guardedAssignment, '')).not.toMatch(/\.text\s*=(?!=)/);
    expect(furnace).not.toMatch(/\.text\s*=(?!=)/);
    expect(renderer).toContain('setTextIfChanged');
    expect(furnace).toContain('setTextIfChanged');
  });

  it('does not clear or reconstruct retained world display objects inside drawWorld', () => {
    const renderer = readFileSync(new URL('../../src/render/renderer.ts', import.meta.url), 'utf8');
    const drawWorldStart = renderer.indexOf('export function drawWorld');
    const drawWorldEnd = renderer.indexOf('export function setToast', drawWorldStart);
    const drawWorld = renderer.slice(drawWorldStart, drawWorldEnd);

    expect(drawWorldStart).toBeGreaterThanOrEqual(0);
    expect(drawWorldEnd).toBeGreaterThan(drawWorldStart);
    expect(drawWorld).not.toMatch(/removeChildren|\.destroy\s*\(|new Sprite\s*\(|new Graphics\s*\(/);
    expect(renderer).not.toContain('clearTileSprites');
    expect(renderer).not.toContain('clearSceneSprites');
  });

  it('keeps terminal Ending presentation in the DOM flow instead of reviving the legacy Pixi layer', () => {
    const renderer = readFileSync(new URL('../../src/render/renderer.ts', import.meta.url), 'utf8');
    const terminalStart = renderer.indexOf('if (state.gameOver)');
    const terminalEnd = renderer.indexOf("} else if (state.postAscension.mode === 'choice-pending')", terminalStart);
    const terminalBranch = renderer.slice(terminalStart, terminalEnd);

    expect(terminalStart).toBeGreaterThanOrEqual(0);
    expect(terminalEnd).toBeGreaterThan(terminalStart);
    expect(terminalBranch).not.toContain('layers.ending.visible = true');
    expect(terminalBranch).not.toContain("t('ending.");
    expect(terminalBranch).not.toContain("t('ui.restart')");
  });

  it('does not preload or retain the legacy Pixi ending CG pipeline', () => {
    const main = readFileSync(new URL('../../src/app/main.ts', import.meta.url), 'utf8');
    const previewTexture = readFileSync(new URL('../../src/app/previewTexture.ts', import.meta.url), 'utf8');
    const renderer = readFileSync(new URL('../../src/render/renderer.ts', import.meta.url), 'utf8');
    const choiceStart = renderer.indexOf("state.postAscension.mode === 'choice-pending'");
    const choiceEnd = renderer.indexOf('} else {', choiceStart);
    const choiceBranch = renderer.slice(choiceStart, choiceEnd);

    expect(main).not.toMatch(/cg\.ending-(?:ascension|lifespan-death|poison-death)/);
    expect(main).not.toContain('endingCg:');
    expect(previewTexture).not.toContain("assetId.startsWith('cg.ending-')");
    expect(renderer).not.toContain('endingCg:');
    expect(renderer).not.toContain('endingImage');

    expect(choiceStart).toBeGreaterThanOrEqual(0);
    expect(choiceEnd).toBeGreaterThan(choiceStart);
    expect(choiceBranch).toContain('layers.ending.visible = true');
    expect(choiceBranch).toContain('紫雷尽散，天门已开');
  });
});
