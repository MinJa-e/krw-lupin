import { expect, test } from '@playwright/test';

test('앱이 오류 없이 시작하고 앉기 버튼이 자세 상태를 토글한다', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto(process.env.PLAYWRIGHT_BASE_URL || '/', { waitUntil: 'domcontentloaded' });

  const sitButton = page.locator('#avatar-sit-button');
  await expect(sitButton).toBeVisible();
  await expect(page.locator('#avatar-select')).toHaveCount(0);

  const hasE2EDiagnostics = await page.evaluate(() => Boolean(window.__krwLupinE2E));
  if (!process.env.PLAYWRIGHT_BASE_URL) {
    expect(hasE2EDiagnostics).toBe(true);
  }
  await expect.poll(() => sitButton.getAttribute('data-avatar-type')).toBe('human');
  await expect.poll(() => sitButton.getAttribute('data-companion-avatar-type')).toBe('dog');
  await expect.poll(async () => Number(await sitButton.getAttribute('data-sit-progress'))).toBeLessThan(0.1);
  const standingHeadY = Number(await sitButton.getAttribute('data-head-y'));
  expect(standingHeadY).toBeGreaterThan(1.45);
  if (hasE2EDiagnostics) {
    await expect.poll(() => page.evaluate(() => window.__krwLupinE2E.getAvatarState().type)).toBe('human');
    await expect.poll(() => page.evaluate(() => window.__krwLupinE2E.detectCompanionType())).toBe('dog');
  }

  await sitButton.click();
  await expect(page.getByRole('button', { name: '일어서기', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => sitButton.getAttribute('data-pose')).toBe('sit');
  await expect.poll(async () => Number(await sitButton.getAttribute('data-sit-progress'))).toBeGreaterThan(0.95);
  await expect.poll(async () => Number(await sitButton.getAttribute('data-head-y'))).toBeLessThan(standingHeadY - 0.25);
  await expect.poll(async () => Number(await sitButton.getAttribute('data-torso-bottom-y'))).toBeLessThan(0.1);
  expect(Number(await sitButton.getAttribute('data-torso-bottom-y'))).toBeGreaterThan(-0.05);
  if (hasE2EDiagnostics) {
    await expect.poll(() => page.evaluate(() => window.__krwLupinE2E.getAvatarState().pose)).toBe('sit');
  }

  await page.getByRole('button', { name: '일어서기', exact: true }).click();
  await expect(page.getByRole('button', { name: '앉기', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await expect.poll(() => sitButton.getAttribute('data-pose')).toBe('idle');
  await expect.poll(async () => Number(await sitButton.getAttribute('data-sit-progress'))).toBeLessThan(0.1);
  await expect.poll(async () => Number(await sitButton.getAttribute('data-head-y'))).toBeGreaterThan(standingHeadY - 0.05);
  if (hasE2EDiagnostics) {
    await expect.poll(() => page.evaluate(() => window.__krwLupinE2E.getAvatarState().pose)).toBe('idle');
  }

  expect(pageErrors).toEqual([]);
});
