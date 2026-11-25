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

    // 패널 열고 팔레트 스와치(파스텔 핑크)를 상의에 적용
    await page.locator('#appearance-button').click();
    await expect(page.locator('#appearance-panel')).toBeVisible();

    await page.locator('#appearance-swatches .appearance-swatch[data-color="#fcaf79"]').click();
    await expect.poll(getShirt).toBe('#fcaf79');
    await expect.poll(getShirtModelColor).toBe('#fcaf79');

    // 부위를 하의로 바꾸면 상의 색은 유지되고 하의만 바뀐다
    await page.locator('#appearance-parts .appearance-part[data-part="pants"]').click();
    await page.locator('#appearance-swatches .appearance-swatch[data-color="#b15d25"]').click();
    await expect.poll(() => page.evaluate(() => window.__krwLupinE2E.getAppearance().pants)).toBe('#b15d25');
    await expect.poll(getShirt).toBe('#fcaf79');

    // 직접 선택 피커: 상의를 활성 부위로 선택 후 임의 색상(#00ff88) 적용
    await page.locator('#appearance-parts .appearance-part[data-part="shirt"]').click();
    const customInput = page.locator('#appearance-custom');
    await customInput.fill('#00ff88');
    await customInput.dispatchEvent('input');
    await expect.poll(getShirt).toBe('#00ff88');
    await expect.poll(getShirtModelColor).toBe('#00ff88');
    // 하의는 그대로 유지 (부위 격리 확인)
    await expect.poll(() => page.evaluate(() => window.__krwLupinE2E.getAppearance().pants)).toBe('#b15d25');

    // 초기화 버튼 → 선택한 부위(상의)만 기본값 복원, 하의는 유지
    await page.locator('#appearance-reset').click();
    await expect.poll(getShirt).toBe('#ffffff');
    await expect.poll(getShirtModelColor).toBe('#ffffff');
    await expect.poll(() => page.evaluate(() => window.__krwLupinE2E.getAppearance().pants)).toBe('#b15d25');

    // 다시 상의를 황인 피부색으로 바꾸고 새로고침 → localStorage에서 복원
    await page.locator('#appearance-parts .appearance-part[data-part="shirt"]').click();
    await page.locator('#appearance-swatches .appearance-swatch[data-color="#fcaf79"]').click();
    await expect.poll(getShirt).toBe('#fcaf79');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect.poll(() => page.evaluate(() => window.__krwLupinE2E.getAppearance().shirt)).toBe('#fcaf79');
    await expect.poll(() => page.evaluate(() => window.__krwLupinE2E.getAvatarPartColor('shirt'))).toBe('#fcaf79');
  }

  expect(pageErrors).toEqual([]);
});
