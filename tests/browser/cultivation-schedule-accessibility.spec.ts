import { expect, test, type Locator, type Page } from '@playwright/test';
import { gameEntryPath } from './openGame';

const ACTIVITY_LABELS = ['苦练', '灵田', '谋生', '歇息'] as const;

async function dismissOrientationIfPresent(page: Page): Promise<void> {
  const override = page.locator('#orientation-override');
  if (await override.isVisible().catch(() => false)) await override.click();
}

async function finishFirstLifeOpening(page: Page): Promise<void> {
  await expect(page.locator('.cr-opening')).toBeVisible();
  for (let beat = 0; beat < 5; beat += 1) {
    await page.locator('.cr-opening__button[data-primary="true"]').click();
  }
}

async function enterCultivationSchedule(page: Page): Promise<void> {
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto(gameEntryPath());
  const entry = page.locator('#flow-title-new-game');
  await expect
    .poll(
      async () => {
        if (await entry.isVisible().catch(() => false)) return true;
        await dismissOrientationIfPresent(page);
        return entry.isVisible().catch(() => false);
      },
      { timeout: 20_000 }
    )
    .toBe(true);
  await entry.click();
  await dismissOrientationIfPresent(page);
  await expect(page.locator('[data-app-surface="roguelite-proto"]')).toBeVisible({ timeout: 8_000 });
  await finishFirstLifeOpening(page);
  await page.getByRole('button', { name: '查看第一道劫兆' }).click();
  await page.getByRole('button', { name: '记下劫兆，安排修途' }).click();
  await expect(page.locator('.rp-planning')).toBeVisible();
}

async function expectFocusable(locator: Locator): Promise<void> {
  await expect(locator).toBeEnabled();
  await locator.focus();
  await expect(locator).toBeFocused();
}

async function expectScrollReachable(locator: Locator, page: Page): Promise<void> {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(box!.y).toBeLessThan(viewport!.height);
  expect(box!.y + box!.height).toBeGreaterThan(0);
}

async function expectMinimumTouchTarget(locator: Locator, minimum = 44): Promise<void> {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThanOrEqual(minimum);
  expect(box!.height).toBeGreaterThanOrEqual(minimum);
}

async function expectFixedViewport(page: Page): Promise<void> {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    clientHeight: document.documentElement.clientHeight,
    scrollHeight: document.documentElement.scrollHeight
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
  expect(dimensions.scrollHeight).toBeLessThanOrEqual(dimensions.clientHeight + 1);
}

async function fillAgendaWithFarming(page: Page): Promise<void> {
  const slots = page.locator('.rp-agenda-slot');
  const farming = page.getByRole('button', { name: /^灵田，/ });
  for (let slotIndex = 0; slotIndex < 6; slotIndex += 1) {
    await slots.nth(slotIndex).click();
    await farming.click();
  }
}

async function finishRoundWithAccessiblePhases(page: Page, destination: 'planning' | 'tribulation'): Promise<void> {
  const resolution = page.locator('.cr-resolution');
  await expect(resolution).toBeVisible();
  const resolutionSlots = resolution.locator('.cr-resolution__slot');
  await expect(resolutionSlots).toHaveCount(6);
  await expect(resolution.locator('.cr-resolution__slots')).toHaveAttribute('aria-label', '六段修途逐项结算');
  const continueToEvent = resolution.getByRole('button', {
    name: '收起竹简，处理本轮事件'
  });
  await expectFocusable(continueToEvent);
  await expectMinimumTouchTarget(continueToEvent);
  await expectScrollReachable(continueToEvent, page);
  await expectFixedViewport(page);
  await continueToEvent.click();

  const event = page.locator('.cr-event');
  await expect(event).toBeVisible();
  await expect(event.locator('.cr-event__feedback')).toHaveAttribute('aria-live', 'polite');
  const eventChoices = event.locator('.cr-event__button');
  await expect(eventChoices).toHaveCount(2);
  for (let index = 0; index < 2; index += 1) {
    await expectFocusable(eventChoices.nth(index));
    await expectMinimumTouchTarget(eventChoices.nth(index));
  }
  const affordableChoice = event.locator('.cr-event__button[data-affordable="true"]').first();
  await expect(affordableChoice).toBeVisible();
  await expectScrollReachable(affordableChoice, page);
  await expectFixedViewport(page);
  await affordableChoice.click();

  const insight = page.locator('.cr-insight');
  await expect(insight).toBeVisible();
  await expect(insight.locator('.cr-insight__feedback')).toHaveAttribute('aria-live', 'polite');
  const nodes = insight.locator('.cr-insight__node-button');
  await expect(nodes).toHaveCount(7);
  for (let index = 0; index < 7; index += 1) {
    await expectFocusable(nodes.nth(index));
    await expectMinimumTouchTarget(nodes.nth(index));
  }
  const continueFromInsight = insight.locator('.cr-insight__continue');
  await expect(continueFromInsight).toHaveText(/，查看劫兆$/);
  await expectFocusable(continueFromInsight);
  await expectMinimumTouchTarget(continueFromInsight);
  await expectScrollReachable(continueFromInsight, page);
  await expectFixedViewport(page);
  await continueFromInsight.click();

  const timing = page.locator('.cr-tribulation-choice');
  await expect(timing).toBeVisible();
  const timingChoice = timing.getByRole('button', { name: destination === 'planning' ? /再备一轮/ : /现在引劫/ });
  await expectFocusable(timingChoice);
  await expectMinimumTouchTarget(timingChoice);
  await expectScrollReachable(timingChoice, page);
  await expectFixedViewport(page);
  await timingChoice.click();
}

function parseMoves(hudText: string): { used: number; budget: number } {
  const match = /步数\s+(\d+)\/(\d+)/.exec(hudText);
  if (!match) throw new Error(`HUD 中未找到步数：${hudText}`);
  return { used: Number(match[1]), budget: Number(match[2]) };
}

test.describe('修仙日程 · 无障碍与触控门禁', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('桌面活动说明完整换行，主操作控件达标且两列参悟节点不重叠', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await enterCultivationSchedule(page);

    const desktopGeometry = await page.evaluate(() => {
      const planning = document.querySelector<HTMLElement>('.rp-planning');
      const confirm = [...document.querySelectorAll<HTMLButtonElement>('.rp-plan-buttons .rp-btn')]
        .find(button => button.textContent?.includes('结算本轮'));
      return {
        planningScrollHeight: planning?.scrollHeight ?? 0,
        planningClientHeight: planning?.clientHeight ?? 0,
        confirmBottom: confirm?.getBoundingClientRect().bottom ?? Number.POSITIVE_INFINITY,
        viewportHeight: window.innerHeight
      };
    });
    expect(desktopGeometry.planningScrollHeight).toBeLessThanOrEqual(desktopGeometry.planningClientHeight + 1);
    expect(desktopGeometry.confirmBottom).toBeLessThanOrEqual(desktopGeometry.viewportHeight);

    const notes = page.locator('.rp-activity-note:visible');
    await expect(notes).toHaveCount(4);
    const noteMetrics = await notes.evaluateAll(elements => elements.map(element => {
      const style = getComputedStyle(element);
      return {
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        whiteSpace: style.whiteSpace,
        overflowX: style.overflowX
      };
    }));
    for (const metric of noteMetrics) {
      expect(metric.scrollWidth).toBeLessThanOrEqual(metric.clientWidth + 1);
      expect(metric.whiteSpace).not.toBe('nowrap');
      expect(metric.overflowX).not.toBe('hidden');
    }

    const planningButtons = page.locator('.rp-activity-btn:visible, .rp-plan-buttons .rp-btn:visible');
    for (let index = 0; index < await planningButtons.count(); index += 1) {
      await expectMinimumTouchTarget(planningButtons.nth(index));
    }
    await expectFixedViewport(page);

    await fillAgendaWithFarming(page);
    await page.getByRole('button', { name: '结清本轮修途' }).click();
    await page.getByRole('button', { name: '收起竹简，处理本轮事件' }).click();
    await page.locator('.cr-event__button[data-affordable="true"]').first().click();

    const insightNodes = page.locator('.cr-insight__node-button');
    await expect(insightNodes).toHaveCount(7);
    const nodeMetrics = await insightNodes.evaluateAll(elements => elements.map(element => {
      const box = element.getBoundingClientRect();
      const effect = element.querySelector('.cr-insight__node-effect');
      const status = element.querySelector('.cr-insight__node-status');
      return {
        left: box.left,
        top: box.top,
        right: box.right,
        bottom: box.bottom,
        width: box.width,
        effectFontSize: effect ? Number.parseFloat(getComputedStyle(effect).fontSize) : 0,
        statusFontSize: status ? Number.parseFloat(getComputedStyle(status).fontSize) : 0
      };
    }));
    for (const [index, node] of nodeMetrics.entries()) {
      expect(node.width).toBeGreaterThanOrEqual(150);
      expect(node.effectFontSize).toBeGreaterThanOrEqual(14);
      expect(node.statusFontSize).toBeGreaterThanOrEqual(13);
      for (const other of nodeMetrics.slice(index + 1)) {
        const overlapWidth = Math.min(node.right, other.right) - Math.max(node.left, other.left);
        const overlapHeight = Math.min(node.bottom, other.bottom) - Math.max(node.top, other.top);
        expect(overlapWidth > 1 && overlapHeight > 1).toBe(false);
      }
    }
    await expectFixedViewport(page);
  });

  test('键盘可排日程，触控可引劫，移动端控件与语义均可达', async ({ page }) => {
    await enterCultivationSchedule(page);

    const slots = page.locator('.rp-agenda-slot');
    const activities = page.locator('.rp-activity-btn:visible');
    await expect(slots).toHaveCount(6);
    await expect(activities).toHaveCount(4);
    for (let index = 0; index < 6; index += 1) {
      await expectFocusable(slots.nth(index));
      await expectMinimumTouchTarget(slots.nth(index));
    }
    for (let index = 0; index < 4; index += 1) {
      await expectFocusable(activities.nth(index));
      await expectMinimumTouchTarget(activities.nth(index));
    }

    await slots.first().focus();
    const shortcutSequence = [1, 2, 3, 4, 1, 2] as const;
    for (const [index, shortcut] of shortcutSequence.entries()) {
      await page.keyboard.press(String(shortcut));
      await expect(slots.nth(index)).toHaveAttribute('aria-label', new RegExp(ACTIVITY_LABELS[shortcut - 1]!));
    }

    await page.keyboard.press('ArrowLeft');
    await expect(slots.nth(4)).toBeFocused();
    await expect(slots.nth(4)).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Delete');
    await expect(slots.nth(4)).toHaveAttribute('aria-label', /第 5 格，空白/);
    await expect(slots.nth(4)).toContainText('待安排');
    await expect(page.locator('.rp-agenda-meta')).toContainText('已排 5/6');

    await expectScrollReachable(page.getByRole('button', { name: /^灵田，/ }), page);
    await fillAgendaWithFarming(page);
    await expectFixedViewport(page);
    const settleFirstRound = page.getByRole('button', { name: '结清本轮修途' });
    await expectScrollReachable(settleFirstRound, page);
    await settleFirstRound.click();
    await finishRoundWithAccessiblePhases(page, 'planning');

    await expect(page.locator('.rp-round-seal')).toContainText('第 2 轮');
    await fillAgendaWithFarming(page);
    const summonTribulation = page.getByRole('button', { name: '结清本轮并引劫' });
    await expectScrollReachable(summonTribulation, page);
    await summonTribulation.click();
    await finishRoundWithAccessiblePhases(page, 'tribulation');

    const tribulation = page.locator('.rp-tribulation');
    const hud = tribulation.locator('.rp-hud');
    const help = tribulation.locator('.rp-help');
    const canvas = tribulation.locator('.rp-canvas');
    await expect(tribulation).toBeVisible();
    await expect(hud).toHaveAttribute('aria-live', 'polite');
    await expect(help).toHaveAttribute('aria-live', 'polite');
    await expect(canvas).toHaveAttribute('aria-label', /布阵导流灵田/);
    await expect(canvas).toHaveAttribute('aria-describedby', 'rp-tribulation-help');
    await expect(help).not.toBeEmpty();

    const dpad = tribulation.getByRole('group', { name: '移动方向' });
    const directions = ['向上', '向左', '向下', '向右'] as const;
    for (const direction of directions) {
      const button = dpad.getByRole('button', { name: direction });
      await expect(button).toBeVisible();
      await expectMinimumTouchTarget(button);
    }

    const tribulationActions = tribulation.locator('.rp-actions .rp-btn');
    for (let index = 0; index < await tribulationActions.count(); index += 1) {
      await expectMinimumTouchTarget(tribulationActions.nth(index));
    }

    await expectScrollReachable(dpad, page);
    await expectFixedViewport(page);
    let moves = parseMoves(await hud.innerText());
    let moved = false;
    for (const direction of directions) {
      await dpad.getByRole('button', { name: direction }).click();
      const nextMoves = parseMoves(await hud.innerText());
      expect(nextMoves.used).toBeGreaterThanOrEqual(moves.used);
      expect(nextMoves.used).toBeLessThanOrEqual(nextMoves.budget);
      if (nextMoves.used > moves.used) {
        moved = true;
        break;
      }
      moves = nextMoves;
    }
    expect(moved).toBe(true);
  });
});
