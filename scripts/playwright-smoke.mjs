import { promises as fs } from 'node:fs';
import { chromium } from 'playwright';

const run = async () => {
  await fs.mkdir('artifacts', { recursive: true });
  const browser = await chromium.launch({
    args: ['--disable-gpu', '--disable-dev-shm-usage', '--no-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  await page.goto('http://localhost:8000/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => Boolean(window.__debug?.showStageSelect));

  await page.evaluate(() => window.__debug.showStageSelect());
  await page.waitForSelector('#stage-select-screen:not([hidden])');
  await page.screenshot({ path: 'artifacts/stage-select.png', fullPage: true });

  await page.evaluate(() => window.__debug.showResultStageSample());
  await page.waitForSelector('#result-screen:not([hidden])');
  await page.screenshot({ path: 'artifacts/result-stage.png', fullPage: true });

  await browser.close();
};

run();
