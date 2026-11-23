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

    // 초기 상태는 0개
    await expect.poll(getHeight).toBe(0);

    // 돌탑 옆으로 순간이동하면 버튼이 보여야 한다
    await page.evaluate(() => window.__krwLupinE2E.teleportPlayer(-10, -23));
    await expect(towerButton).toBeVisible();
    await expect(towerCounter).toHaveText('0');

    // 무너지지 않는 경우로 고정 (Math.random >= 0.5)
    await page.evaluate(() => { window.__origRandom = Math.random; Math.random = () => 0.99; });

    // 버튼 클릭으로 돌을 쌓는다
    await towerButton.click();
    await expect.poll(async () => towerCounter.textContent()).toBe('1');
    await expect.poll(getHeight).toBe(1);

    // E 키로도 쌓인다 (제한 없이 계속 쌓임)
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

    // 무너지는 경우로 고정 (Math.random < 0.5) → 쌓자마자 50% 무너짐 로직 발동
    await page.evaluate(() => { Math.random = () => 0.1; });
    await towerButton.click();
    await expect.poll(getHeight).toBe(0);
    await expect.poll(async () => towerCounter.textContent()).toBe('💥');

    // 원래 Math.random 복구
    await page.evaluate(() => { Math.random = window.__origRandom; });
  }

  expect(pageErrors).toEqual([]);
});
