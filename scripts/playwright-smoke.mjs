import { promises as fs } from 'node:fs';
import { chromium, firefox } from 'playwright';

const createScreenshots = async (browserType) => {
  const launchOptions = browserType === chromium
    ? { args: ['--disable-gpu', '--disable-dev-shm-usage', '--no-sandbox'] }
    : {};
  const browser = await browserType.launch(launchOptions);
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

    await page.goto('http://localhost:8000/index.html', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('domcontentloaded');
    await page.waitForFunction(() => Boolean(window.__debug?.showStageSelect));

    await page.evaluate(() => {
      const progress = {
        clearedStageIds: ['w1-1'],
        lastPlayedStageId: 'w1-2',
        updatedAt: new Date().toISOString(),
      };
      window.localStorage.setItem('calc-sprint::default::stageProgress.v1', JSON.stringify(progress));
      window.__debug.showStageSelect();
    });
    await page.waitForSelector('#stage-select-screen:not([hidden])');
    await page.screenshot({ path: 'artifacts/stage-map.png', fullPage: true });
  } finally {
    await browser.close();
  }
};

const run = async () => {
  await fs.mkdir('artifacts', { recursive: true });
  try {
    await createScreenshots(chromium);
  } catch (error) {
    console.warn('Chromium screenshot failed, falling back to Firefox.', error);
    await createScreenshots(firefox);
  }
};

run();
