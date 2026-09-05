import { describe, expect, it } from 'vitest';
import {
  cultivationReplayFixturePath,
  loadCultivationReplayFixture,
  runCultivationReplayFixture
} from './cultivation-harness';

/**
 * 修途主模式 Golden Replay：跨版本漂移检测。
 *
 * 与 golden.replay.test.ts（旧世界农场）互补：本 fixture 只经纯 sim API 驱动
 * 偷天换劫完整生命周期（议程 → 事件 → 参悟 → 引劫 → 渡劫结算 → 劫灰换代），
 * 任何 src/sim/cultivation-run、src/sim/sokoban 或其消费参数的行为漂移都会
 * 改变逐步 sha256 并在此失败。更新 fixture 必须走
 * `pnpm replay:cultivation:update`（先确认是已被接受的行为变更，见
 * .claude/skills/golden-replay-update/SKILL.md）。
 */
describe('Cultivation Golden Replay · 修途主模式全生命周期', () => {
  it('fixture 存在于版本控制且带烘焙输入脚本', () => {
    const fixture = loadCultivationReplayFixture(cultivationReplayFixturePath);
    expect(fixture.plan.tribulationOneActions.length).toBeGreaterThan(0);
    expect(fixture.steps.length).toBeGreaterThan(0);
  });

  it('固定 seed 的完整输入脚本复放出与 golden 完全一致的逐步状态哈希', () => {
    const fixture = loadCultivationReplayFixture();
    const actual = runCultivationReplayFixture(fixture);
    expect(actual.steps).toEqual(
      fixture.steps.map(step => ({ phase: step.phase, label: step.label, hash: step.expected }))
    );
  });

  it('同输入二次运行产生完全一致的哈希序列与生命周期事实', () => {
    const fixture = loadCultivationReplayFixture();
    const first = runCultivationReplayFixture(fixture);
    const second = runCultivationReplayFixture(fixture);
    expect(second.steps).toEqual(first.steps);
    expect(second.facts).toEqual(first.facts);
  });

  it('生命周期事实与 fixture pin 一致，且换代从凡骨重新开始', () => {
    const fixture = loadCultivationReplayFixture();
    const actual = runCultivationReplayFixture(fixture);
    expect(actual.facts).toEqual(fixture.facts);
    // 结构性契约（不应随普通调参漂移）：一世身死进入传承，后来人从 stage 0 重开。
    expect(actual.facts.finalStatus).toBe('tribulation-ended');
    expect(actual.facts.heirStage).toBe(0);
    expect(actual.facts.unlockedNodeIds).toEqual(['foundation-rhythm', 'field-breathing']);
  });
});
