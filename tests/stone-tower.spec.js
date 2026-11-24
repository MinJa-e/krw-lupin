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

    // 층별 무너질 확률 공식 검증: 1층 0%, 2층 10%, 3층 20%, 4층 30%, 5층 40%, 6층 50% 도달, 이후 50% 고정
    await expect.poll(() => getChance(1)).toBe(0);
    await expect.poll(() => getChance(2)).toBeCloseTo(0.10, 5);
    await expect.poll(() => getChance(3)).toBeCloseTo(0.20, 5);
    await expect.poll(() => getChance(4)).toBeCloseTo(0.30, 5);
    await expect.poll(() => getChance(5)).toBeCloseTo(0.40, 5);
    await expect.poll(() => getChance(6)).toBe(0.50);
    await expect.poll(() => getChance(50)).toBe(0.50);

    // 원래 Math.random 백업
    await page.evaluate(() => { window.__origRandom = Math.random; });

    // 1층은 0% → 무조건 안 무너지고 쌓인다
    await page.evaluate(() => { Math.random = () => 0.99; });
    await towerButton.click();
    await expect.poll(async () => towerCounter.textContent()).toBe('1');
    await expect.poll(getHeight).toBe(1);

    // E 키로 2층까지 쌓인다 (2층 확률 10%, 난수 0.99라 안 무너짐)
    await page.keyboard.press('e');
    await expect.poll(async () => towerCounter.textContent()).toBe('2');
    await expect.poll(getHeight).toBe(2);

    // 무너뜨리기 버튼으로 0이 된다
    await page.locator('#stone-tower-collapse-button').click();
    await expect.poll(getHeight).toBe(0);
    await expect.poll(async () => towerCounter.textContent(), { timeout: 10000 }).toBe('0');

    // 다시 쌓고 R 키로 무너뜨린다
    await towerButton.click();
    await expect.poll(getHeight).toBe(1);
    await page.keyboard.press('r');
    await expect.poll(getHeight).toBe(0);

    // 2층에서 10% 확률에 걸리는 경우 (난수 0.05 < 0.10) → 쌓자마자 무너진다
    await page.evaluate(() => { Math.random = () => 0.05; });
    await towerButton.click(); // 1층: 0% → 안전
    await expect.poll(getHeight).toBe(1);
    await towerButton.click(); // 2층: 10%, 0.05 < 0.10 → 무너짐
    await expect.poll(getHeight).toBe(0);
    await expect.poll(async () => towerCounter.textContent()).toBe('💥');

    // 원래 Math.random 복구
    await page.evaluate(() => { Math.random = window.__origRandom; });
  }

  expect(pageErrors).toEqual([]);
});
