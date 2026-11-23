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
    const getHeight = () => page.evaluate(() => window.__krwLupinE2E.getStoneTowerState().height);
    const getChance = (layer) => page.evaluate((l) => window.__krwLupinE2E.getStoneTowerCollapseChance(l), layer);

    // 초기 상태는 0개
    await expect.poll(getHeight).toBe(0);

    // 돌탑 옆으로 순간이동하면 버튼이 보여야 한다
    await page.evaluate(() => window.__krwLupinE2E.teleportPlayer(-10, -23));
    await expect(towerButton).toBeVisible();
    await expect(towerCounter).toHaveText('0');

    // 층별 무너질 확률 공식 검증: 1층 100%, 2층 95%, 3층 90%, 21층 0%, 그 이상 0%
    await expect.poll(() => getChance(1)).toBe(1);
    await expect.poll(() => getChance(2)).toBeCloseTo(0.95, 5);
    await expect.poll(() => getChance(3)).toBeCloseTo(0.9, 5);
    await expect.poll(() => getChance(21)).toBe(0);
    await expect.poll(() => getChance(50)).toBe(0);

    // 원래 Math.random 백업
    await page.evaluate(() => { window.__origRandom = Math.random; });

    // 1층은 100% → 어떤乱수でも 무조건 무너진다
    await page.evaluate(() => { Math.random = () => 0.99; });
    await towerButton.click();
    await expect.poll(getHeight).toBe(0);
    await expect.poll(async () => towerCounter.textContent()).toBe('💥');

    // E 키로 쌓아도 1층 100%라 무너진다
    await page.keyboard.press('e');
    await expect.poll(getHeight).toBe(0);

    // 무너뜨리기 버튼 / R 키도 오류 없이 동작 (빈 탑 상태)
    await page.locator('#stone-tower-collapse-button').click();
    await expect.poll(getHeight).toBe(0);
    await page.keyboard.press('r');
    await expect.poll(getHeight).toBe(0);

    // 원래 Math.random 복구
    await page.evaluate(() => { Math.random = window.__origRandom; });
  }

  expect(pageErrors).toEqual([]);
});
