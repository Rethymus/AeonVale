import { expect, test, type Page } from '@playwright/test';
import { gameEntryPath } from './openGame';

interface CultivationKeypointSnapshot {
  readonly phase: string;
  readonly outcome: string | null;
  readonly fatal: boolean;
  readonly deathPrevented: boolean;
  readonly settlementApplied: boolean;
  readonly runStatus: string;
  readonly herbs: number;
  readonly pills: number;
  readonly legacyReady: boolean;
  readonly generation: number;
  readonly stage: number;
  readonly settlementKind: string | null;
}

async function finishFirstLifeOpening(page: Page): Promise<void> {
  await expect(page.locator('.cr-opening')).toBeVisible();
  for (let beat = 0; beat < 4; beat += 1) {
    await page.locator('.cr-opening__button[data-primary="true"]').click();
  }
}

async function enterCultivation(page: Page): Promise<void> {
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto(gameEntryPath());
  const orientationOverride = page.locator('#orientation-override');
  if (await orientationOverride.isVisible().catch(() => false)) await orientationOverride.click();
  await page.locator('#flow-title-new-game').click();
  await finishFirstLifeOpening(page);
  await page.getByRole('button', { name: '翻开今世日课' }).click();
  await page.getByRole('button', { name: '记下劫兆，安排日课' }).click();
  await expect(page.locator('.rp-planning')).toBeVisible();
}

async function continueFromLifeIntroAndOmen(page: Page): Promise<void> {
  await expect(page.getByRole('button', { name: '翻开今世日课' })).toBeVisible();
  await page.getByRole('button', { name: '翻开今世日课' }).click();
  await page.getByRole('button', { name: '记下劫兆，安排日课' }).click();
  await expect(page.locator('.rp-planning')).toBeVisible();
}

async function configureOverloadKeypoint(page: Page, withWardPill: boolean): Promise<CultivationKeypointSnapshot> {
  const client = await page.context().newCDPSession(page);
  try {
    const result = await client.send('Runtime.evaluate', {
      expression: `window.__AEON_TEST__?.configureCultivationOverloadKeypoint?.(${String(withWardPill)})`,
      returnByValue: true
    });
    expect(result.exceptionDetails, JSON.stringify(result.exceptionDetails ?? null)).toBeUndefined();
    expect(result.result.value).toBeTruthy();
    return result.result.value as CultivationKeypointSnapshot;
  } finally {
    await client.detach();
  }
}

async function configurePlanningKeypoint(page: Page, mode: 'default' | 'pressure'): Promise<CultivationKeypointSnapshot> {
  const client = await page.context().newCDPSession(page);
  try {
    const result = await client.send('Runtime.evaluate', {
      expression: `window.__AEON_TEST__?.configureCultivationPlanningKeypoint?.(${JSON.stringify(mode)})`,
      returnByValue: true
    });
    expect(result.exceptionDetails, JSON.stringify(result.exceptionDetails ?? null)).toBeUndefined();
    expect(result.result.value).toBeTruthy();
    return result.result.value as CultivationKeypointSnapshot;
  } finally {
    await client.detach();
  }
}

async function configureLifespanKeypoint(page: Page): Promise<CultivationKeypointSnapshot> {
  return page.evaluate(() => {
    const target = window as typeof window & {
      __AEON_TEST__?: { configureCultivationLifespanKeypoint?: () => CultivationKeypointSnapshot };
    };
    const snapshot = target.__AEON_TEST__?.configureCultivationLifespanKeypoint?.();
    if (!snapshot) throw new Error('configureCultivationLifespanKeypoint test hook is unavailable');
    return snapshot;
  });
}

async function configureAscensionKeypoint(page: Page): Promise<CultivationKeypointSnapshot> {
  return page.evaluate(() => {
    const target = window as typeof window & {
      __AEON_TEST__?: { configureCultivationAscensionKeypoint?: () => CultivationKeypointSnapshot };
    };
    const snapshot = target.__AEON_TEST__?.configureCultivationAscensionKeypoint?.();
    if (!snapshot) throw new Error('configureCultivationAscensionKeypoint test hook is unavailable');
    return snapshot;
  });
}

async function fillAgenda(page: Page, activities: readonly string[]): Promise<void> {
  for (const activity of activities) {
    await page.getByRole('button', { name: new RegExp(`^${activity}，\\d+ 日`) }).click();
  }
}

async function cultivationSnapshot(page: Page): Promise<CultivationKeypointSnapshot> {
  return page.evaluate(() => {
    const target = window as typeof window & {
      __AEON_TEST__?: { cultivationSnapshot?: () => CultivationKeypointSnapshot };
    };
    const snapshot = target.__AEON_TEST__?.cultivationSnapshot?.();
    if (!snapshot) throw new Error('cultivationSnapshot test hook is unavailable');
    return snapshot;
  });
}

test.describe('D27 CDP 关键态门禁', () => {
  test('同一开局的资源活动先后顺序决定日程成败', async ({ page }) => {
    await enterCultivation(page);
    await configurePlanningKeypoint(page, 'default');
    await fillAgenda(page, ['炼丹', '灵田', '灵田', '灵田', '灵田', '灵田']);
    await page.getByRole('button', { name: '结清本轮日课' }).click();
    await expect(page.locator('#rp-plan-feedback')).toContainText('第 1 格「炼丹」缺少灵草');

    await configurePlanningKeypoint(page, 'default');
    await fillAgenda(page, ['灵田', '炼丹', '灵田', '灵田', '灵田', '灵田']);
    await page.getByRole('button', { name: '结清本轮日课' }).click();
    let slots = page.locator('.cr-resolution__slot');
    await expect(slots.nth(0)).toContainText(/灵草 \+\d/);
    await expect(slots.nth(1)).toContainText(/灵草 -2/);
    await expect(slots.nth(1)).toContainText(/丹药 \+1/);

    await configurePlanningKeypoint(page, 'default');
    await fillAgenda(page, ['参悟', '谋生', '灵田', '灵田', '灵田', '灵田']);
    await page.getByRole('button', { name: '结清本轮日课' }).click();
    await expect(page.locator('#rp-plan-feedback')).toContainText('第 1 格「参悟」缺少灵石');

    await configurePlanningKeypoint(page, 'default');
    await fillAgenda(page, ['谋生', '参悟', '灵田', '灵田', '灵田', '灵田']);
    await page.getByRole('button', { name: '结清本轮日课' }).click();
    slots = page.locator('.cr-resolution__slot');
    await expect(slots.nth(0)).toContainText(/灵石 \+\d/);
    await expect(slots.nth(1)).toContainText(/灵石 -1/);
    await expect(slots.nth(1)).toContainText(/悟痕 \+\d/);
  });

  test('高压下歇息会恢复后续格效率并提高凡心', async ({ page }) => {
    await enterCultivation(page);
    await configurePlanningKeypoint(page, 'pressure');
    await fillAgenda(page, ['谋生', '灵田', '歇息', '灵田', '灵田', '灵田']);
    await page.getByRole('button', { name: '结清本轮日课' }).click();

    const slots = page.locator('.cr-resolution__slot');
    await expect(slots.nth(0)).toContainText('效率 100%');
    await expect(slots.nth(1)).toContainText('效率 75%');
    await expect(slots.nth(2)).toContainText(/心压 -\d+/);
    await expect(slots.nth(2)).toContainText(/凡心 \+\d+/);
    await expect(slots.nth(3)).toContainText('效率 100%');
  });

  test('一步过载通过真实方向输入进入劫灰碑记', async ({ page }) => {
    await enterCultivation(page);
    const configured = await configureOverloadKeypoint(page, false);
    expect(configured).toMatchObject({ phase: 'tribulation', outcome: null, herbs: 1, pills: 0 });

    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.rp-outcome')).toContainText('雷威过载');
    expect(await cultivationSnapshot(page)).toMatchObject({
      outcome: 'overload',
      fatal: true,
      deathPrevented: false,
      settlementApplied: true,
      runStatus: 'tribulation-ended',
      herbs: 0,
      pills: 0,
      legacyReady: true
    });

    await page.getByRole('button', { name: '立劫灰碑记 →' }).click();
    await expect(page.getByRole('heading', { name: '沈砚' })).toBeVisible();
    await expect(page.locator('.cr-legacy__portrait-image')).toHaveAttribute('src', /portrait\.player-default-v1/);
    await expect(page.locator('.cr-legacy__art-image')).toHaveAttribute('src', /ending-tribulation-death-v2/);
    await expect(page.locator('.cr-legacy__summary')).toContainText('死因：雷威过载');
    const legacyChoices = page.locator('.cr-legacy__radio');
    await expect(legacyChoices).toHaveCount(2);
    await legacyChoices.nth(0).check();
    await legacyChoices.nth(1).check();
    await page.getByRole('button', { name: '立碑，交给后来人' }).click();
    await continueFromLifeIntroAndOmen(page);
    await expect(page.locator('.rp-planning')).toBeVisible();
    expect(await cultivationSnapshot(page)).toMatchObject({
      phase: 'planning',
      runStatus: 'active',
      herbs: 1,
      pills: 0,
      legacyReady: false
    });
  });

  test('显式启用护脉丹把同一步过载降为补修', async ({ page }) => {
    await enterCultivation(page);
    await configureOverloadKeypoint(page, true);
    await page.getByRole('button', { name: '护脉丹：未启用' }).click();
    await page.keyboard.press('ArrowRight');

    await expect(page.locator('.rp-outcome')).toContainText('护脉保命');
    expect(await cultivationSnapshot(page)).toMatchObject({
      outcome: 'overload',
      fatal: false,
      deathPrevented: true,
      settlementApplied: true,
      runStatus: 'active',
      herbs: 0,
      pills: 0,
      legacyReady: false
    });

    await page.getByRole('button', { name: '护脉保命·补修一轮' }).click();
    await expect(page.locator('.cr-aftermath')).toBeVisible();
    await page.getByRole('button', { name: '带着结果补修一轮' }).click();
    await page.getByRole('button', { name: '记下劫兆，安排日课' }).click();
    await expect(page.locator('.rp-planning')).toBeVisible();
    await expect(page.locator('.rp-round-seal')).toContainText('第 1 轮');
  });

  test('余寿不足一整轮时封卷寿终，并从劫灰碑记进入后来人的新世开场', async ({ page }) => {
    await enterCultivation(page);
    expect(await configureLifespanKeypoint(page)).toMatchObject({
      phase: 'planning',
      stage: 2,
      runStatus: 'active'
    });

    const conclude = page.getByRole('button', { name: '余寿不足 · 封卷归灰' });
    await expect(conclude).toBeVisible();
    await expect(page.getByRole('button', { name: /结算本轮/ })).toBeDisabled();
    await conclude.click();

    await expect(page.locator('.cr-legacy')).toBeVisible();
    await expect(page.locator('.cr-legacy__summary')).toContainText('死因：寿元耗尽');
    await expect(page.locator('.cr-legacy__art-image')).toHaveAttribute('src', /ending-lifespan-death-v2/);
    expect(await cultivationSnapshot(page)).toMatchObject({
      phase: 'legacy',
      runStatus: 'lifespan-ended',
      legacyReady: true,
      stage: 2
    });

    const choices = page.locator('.cr-legacy__radio');
    await choices.nth(0).check();
    await choices.nth(1).check();
    await page.getByRole('button', { name: '立碑，交给后来人' }).click();
    await expect(page.getByRole('button', { name: '翻开今世日课' })).toBeVisible();
    expect(await cultivationSnapshot(page)).toMatchObject({
      phase: 'life-intro',
      runStatus: 'active',
      generation: 2,
      stage: 0,
      legacyReady: false
    });
  });

  test('第六境终劫原子收束为劫后与飞升终局，不创建第七境日课', async ({ page }) => {
    await enterCultivation(page);
    expect(await configureAscensionKeypoint(page)).toMatchObject({
      phase: 'tribulation',
      stage: 6,
      runStatus: 'active'
    });

    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.rp-outcome')).toContainText('归一飞升');
    expect(await cultivationSnapshot(page)).toMatchObject({
      phase: 'tribulation',
      outcome: 'perfect',
      settlementApplied: true,
      settlementKind: 'ascended',
      runStatus: 'ascended',
      stage: 6
    });

    await page.getByRole('button', { name: '查看归一终局 →' }).click();
    await expect(page.locator('.cr-aftermath')).toBeVisible();
    await expect(page.getByRole('heading', { name: '归一境成，凡骨没有化灰' })).toBeVisible();
    await page.getByRole('button', { name: '越过天门，见证终局' }).click();

    await expect(page.locator('.cr-cultivation-ending')).toBeVisible();
    await expect(page.getByRole('heading', { name: '一世日课，终于留下了没有化灰的身体' })).toBeVisible();
    await expect(page.locator('.cr-interlude__art-image')).toHaveAttribute('src', /ending-ascension-v2/);
    await expect(page.locator('.rp-planning')).toBeHidden();
    expect(await cultivationSnapshot(page)).toMatchObject({
      phase: 'ending',
      settlementKind: 'ascended',
      runStatus: 'ascended',
      stage: 6
    });
  });
});
