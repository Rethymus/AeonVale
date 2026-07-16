import { describe, expect, it } from 'vitest';
import { fixtureName, listReplayFixturePaths, loadReplayFixture, runReplayFixture } from './harness';

describe('Golden Replay fixtures', () => {
  const fixturePaths = listReplayFixturePaths();

  it('至少有一条受版本控制的 replay fixture', () => {
    expect(fixturePaths.length).toBeGreaterThan(0);
  });

  for (const path of fixturePaths) {
    it(`${fixtureName(path)} 的事件、逐步状态哈希与存档续跑完全匹配`, () => {
      const fixture = loadReplayFixture(path);
      expect(fixture.params.celestial.eventGateProbability).toBe(0);
      expect(fixture.params.celestial.beast.surgeChancePerDay).toBe(0);

      const actual = runReplayFixture(fixture);
      expect(actual.steps).toEqual(fixture.steps.map(step => step.expected));

      const resumeStart = fixture.saveResumeAfterStep + 1;
      expect(actual.resumedSteps).toEqual(actual.steps.slice(resumeStart));
    });
  }
});
