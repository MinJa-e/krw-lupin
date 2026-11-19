import { expect, test } from '@playwright/test';

test('앱이 오류 없이 시작하고 앉기 버튼이 자세 상태를 토글한다', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto(process.env.PLAYWRIGHT_BASE_URL || '/', { waitUntil: 'domcontentloaded' });

  const sitButton = page.getByRole('button', { name: '앉기', exact: true });
  await expect(sitButton).toBeVisible();
  await expect(page.locator('#avatar-select')).toHaveCount(0);

  const hasE2EDiagnostics = await page.evaluate(() => Boolean(window.__krwLupinE2E));
  if (!process.env.PLAYWRIGHT_BASE_URL) {
    expect(hasE2EDiagnostics).toBe(true);
  }
  if (hasE2EDiagnostics) {
    await expect.poll(() => page.evaluate(() => window.__krwLupinE2E.getAvatarState().type)).toBe('human');
    await expect.poll(() => page.evaluate(() => window.__krwLupinE2E.detectCompanionType())).toBe('dog');
    await expect.poll(() => page.evaluate(() => window.__krwLupinE2E.getAvatarState().sitProgress)).toBeLessThan(0.1);
  }

  await sitButton.click();
  await expect(page.getByRole('button', { name: '일어서기', exact: true })).toHaveAttribute('aria-pressed', 'true');
  if (hasE2EDiagnostics) {
    await expect.poll(() => page.evaluate(() => window.__krwLupinE2E.getAvatarState().pose)).toBe('sit');
    await expect.poll(() => page.evaluate(() => window.__krwLupinE2E.getAvatarState().sitProgress)).toBeGreaterThan(0.8);
  }

  await page.getByRole('button', { name: '일어서기', exact: true }).click();
  await expect(page.getByRole('button', { name: '앉기', exact: true })).toHaveAttribute('aria-pressed', 'false');
  if (hasE2EDiagnostics) {
    await expect.poll(() => page.evaluate(() => window.__krwLupinE2E.getAvatarState().pose)).toBe('idle');
    await expect.poll(() => page.evaluate(() => window.__krwLupinE2E.getAvatarState().sitProgress)).toBeLessThan(0.1);
  }

  expect(pageErrors).toEqual([]);
});
