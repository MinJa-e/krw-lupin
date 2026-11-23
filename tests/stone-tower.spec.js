import { expect, test } from '@playwright/test';

test('해변 돌탑이 오류 없이 생성되고 상호작용으로 돌이 쌓인다', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto(process.env.PLAYWRIGHT_BASE_URL || '/', { waitUntil: 'domcontentloaded' });

  const hasE2EDiagnostics = await page.evaluate(() => Boolean(window.__krwLupinE2E));
  if (!process.env.PLAYWRIGHT_BASE_URL) {
    expect(hasE2EDiagnostics).toBe(true);
  }

  const towerButton = page.locator('#stone-tower-button');
  const towerCounter = page.locator('#stone-tower-counter');

  if (hasE2EDiagnostics) {
    // 초기 상태는 0개
    await expect.poll(() => page.evaluate(() => window.__krwLupinE2E.getStoneTowerState().height)).toBe(0);

    // 돌탑 옆으로 순간이동하면 버튼이 보여야 한다
    await page.evaluate(() => window.__krwLupinE2E.teleportPlayer(-10, -23));
    await expect(towerButton).toBeVisible();
    await expect(towerCounter).toHaveText('0/7');

    // 버튼 클릭으로 돌을 쌓는다
    await towerButton.click();
    await expect.poll(async () => towerCounter.textContent()).toBe('1/7');
    await expect.poll(() => page.evaluate(() => window.__krwLupinE2E.getStoneTowerState().height)).toBe(1);

    // E 키로도 쌓인다
    await page.keyboard.press('e');
    await expect.poll(async () => towerCounter.textContent()).toBe('2/7');
    await expect.poll(() => page.evaluate(() => window.__krwLupinE2E.getStoneTowerState().height)).toBe(2);
  }

  expect(pageErrors).toEqual([]);
});
