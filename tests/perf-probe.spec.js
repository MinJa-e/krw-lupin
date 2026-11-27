// 렌더 성능 프로브: 드로우콜/삼각형 수 + 구간 FPS 측정 (배포 전 렉 판단용)
import { test } from '@playwright/test';

test('렌더 통계와 FPS 측정', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__krwLupinE2E, null, { timeout: 20000 });
  await page.waitForTimeout(3000);

  const stats1 = await page.evaluate(() => window.__krwLupinE2E.getRenderStats());
  const frames1 = stats1.fps;

  // 5초간 프레임 수집
  await page.waitForTimeout(5000);
  const stats2 = await page.evaluate(() => window.__krwLupinE2E.getRenderStats());
  const measuredFps = (stats2.fps - frames1) / 5;
  const sceneStats = await page.evaluate(() => window.__krwLupinE2E.getSceneStats());

  console.log('\n=== 렌더 성능 ===');
  console.log(`드로우콜/프레임: ${stats2.calls}`);
  console.log(`삼각형/프레임: ${stats2.triangles.toLocaleString()}`);
  console.log(`지오메트리: ${stats2.geometries} / 텍스처: ${stats2.textures}`);
  console.log(`측정 FPS(headless swiftshader, 실기기보다 낮음): ${measuredFps.toFixed(1)}`);
  console.log(`메시 ${sceneStats.meshes}개 (그림자 캐스터 ${sceneStats.shadowCasters}개)`);
  const roots = Object.entries(sceneStats.byRoot).sort((a, b) => b[1] - a[1]).slice(0, 10);
  console.log('메시 상위 루트:', roots.map(([k, v]) => `${k}=${v}`).join(', '));
});
