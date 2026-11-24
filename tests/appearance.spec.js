import { expect, test } from '@playwright/test';

test('캐릭터 색상을 꾸미면 모델에 적용되고 새로고침 후에도 유지된다', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto(process.env.PLAYWRIGHT_BASE_URL || '/', { waitUntil: 'domcontentloaded' });

  const hasE2EDiagnostics = await page.evaluate(() => Boolean(window.__krwLupinE2E));
  if (!process.env.PLAYWRIGHT_BASE_URL) {
    expect(hasE2EDiagnostics).toBe(true);
  }

  if (hasE2EDiagnostics) {
    const getShirt = () => page.evaluate(() => window.__krwLupinE2E.getAppearance().shirt);
    const getShirtModelColor = () =>
      page.evaluate(() => window.__krwLupinE2E.getAvatarPartColor('shirt'));

    // 초기 상의 색상은 기본값(흰색)
    await expect.poll(getShirt).toBe('#ffffff');
    await expect.poll(getShirtModelColor).toBe('#ffffff');

    // 패널 열고 상의 색상을 빨강으로 변경
    await page.locator('#appearance-button').click();
    await expect(page.locator('#appearance-panel')).toBeVisible();

    const shirtInput = page.locator('#appearance-shirt');
    await shirtInput.fill('#ff0000');

    // 상태 + 3D 모델 + localStorage 세 곳 모두 반영
    await expect.poll(getShirt).toBe('#ff0000');
    await expect.poll(getShirtModelColor).toBe('#ff0000');
    await expect.poll(() =>
      page.evaluate(() => JSON.parse(localStorage.getItem('krw-lupin-appearance')).shirt)
    ).toBe('#ff0000');

    // 초기화 버튼 → 기본값 복원
    await page.locator('#appearance-reset').click();
    await expect.poll(getShirt).toBe('#ffffff');
    await expect.poll(getShirtModelColor).toBe('#ffffff');

    // 다시 빨강으로 바꾸고 새로고침 → localStorage에서 복원
    await shirtInput.fill('#ff0000');
    await expect.poll(getShirt).toBe('#ff0000');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect.poll(() => page.evaluate(() => window.__krwLupinE2E.getAppearance().shirt)).toBe('#ff0000');
    await expect.poll(() => page.evaluate(() => window.__krwLupinE2E.getAvatarPartColor('shirt'))).toBe('#ff0000');
  }

  expect(pageErrors).toEqual([]);
});
