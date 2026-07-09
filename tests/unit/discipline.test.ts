import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const SIM_DIR = resolve(process.cwd(), 'src/sim');

function listTs(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) listTs(p, out);
    else if (name.endsWith('.ts')) out.push(p);
  }
  return out;
}

/** 剥离 JS 注释（块 + 行），避免注释里的示例文字（如"禁止 Math.random"）误触发禁用规则。 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
}

/**
 * sim 层纪律 (C3 确定性 / C4 逻辑-渲染解耦)。
 * 任何违反都立刻红——这是 Golden Replay 能成立的前提（docs/17 §7 / docs/10 §4.3）。
 */
describe('sim 层纪律 (C3/C4)', () => {
  const files = listTs(SIM_DIR);
  const sources = files.map((f) => ({ f, code: stripComments(readFileSync(f, 'utf8')) }));

  it('sim 目录存在且有源文件', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('src/sim 禁止 Math.random（必须用注入 Rng）', () => {
    for (const { f, code } of sources) {
      expect(code, `${f} 含 Math.random`).not.toMatch(/\bMath\.random\s*\(/);
    }
  });

  it('src/sim 禁止 Date.now / performance.now（时间不进 sim）', () => {
    for (const { f, code } of sources) {
      expect(code, `${f} 含 Date.now/performance.now`).not.toMatch(/\b(Date|performance)\.now\s*\(/);
    }
  });

  it('src/sim 禁止渲染/DOM 依赖（pixi / document / window）', () => {
    for (const { f, code } of sources) {
      expect(code, `${f} 引入渲染层`).not.toMatch(/from\s+['"](pixi\.js|@pixi)/);
      expect(code, `${f} 引用 DOM`).not.toMatch(/\bdocument\s*\.\s*(getElementById|querySelector|createElement)\b/);
      expect(code, `${f} 引用 canvas/window`).not.toMatch(/\b(HTMLCanvasElement|window\.requestAnimationFrame| OffscreenCanvas)\b/);
    }
  });
});
