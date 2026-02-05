import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { basename, resolve } from 'node:path';
import fs from 'node:fs/promises';

const execFileAsync = promisify(execFile);

const reportPath = resolve('spec/test-results/adr-acceptance-latest.md');
const repoName = basename(resolve('.'));
const baseUrl = 'http://127.0.0.1:8082/';
const subpathUrl = `http://127.0.0.1:8083/${repoName}/`;

const startServer = (args) => {
  const proc = spawn('./tools/serve', args, {
    stdio: 'ignore',
  });
  return proc;
};

const stopServer = (proc) => {
  if (!proc) {
    return;
  }
  proc.kill('SIGTERM');
};

const waitForHttp = async (url, attempts = 15) => {
  let lastCode = null;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const { stdout } = await execFileAsync('curl', ['-s', '-o', '/dev/null', '-w', '%{http_code}', url]);
      lastCode = stdout.trim();
      if (lastCode === '200') {
        return { ok: true, code: lastCode };
      }
    } catch (error) {
      lastCode = String(error?.code ?? 'error');
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 300));
  }
  return { ok: false, code: lastCode ?? 'unknown' };
};

const buildLocalStorage = () => {
  const store = new Map();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key) {
      if (!store.has(key)) {
        return null;
      }
      return store.get(key);
    },
    key(index) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key) {
      store.delete(key);
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
  };
};

const ensureReportDir = async () => {
  await fs.mkdir(resolve('spec/test-results'), { recursive: true });
};

const formatResult = (result) => `- [${result.pass ? 'PASS' : 'FAIL'}] ${result.id} ${result.title}`;

const renderReport = async (results, callLog) => {
  const overallPass = results.every((result) => result.pass);
  const lines = [
    '# ADR Acceptance Checklist (Manual Runner)',
    `- Timestamp: ${new Date().toISOString()}`,
    `- Overall: ${overallPass ? 'PASS' : 'FAIL'}`,
    '',
    '## Checks',
    ...results.map(formatResult),
    '',
    '## Evidence',
    ...results.flatMap((result) => [
      `### ${result.id} ${result.title}`,
      result.pass ? 'Status: PASS' : 'Status: FAIL',
      '',
      result.details,
      '',
    ]),
    '## Call Log',
    ...callLog.map((line) => `- ${line}`),
    '',
  ];
  await ensureReportDir();
  await fs.writeFile(reportPath, lines.join('\n'), 'utf8');
  return overallPass;
};

const run = async () => {
  const callLog = [];
  const serverRoot = startServer(['--port', '8082']);
  const serverSub = startServer(['--port', '8083', '--subpath']);
  process.on('exit', () => {
    stopServer(serverRoot);
    stopServer(serverSub);
  });

  const results = [];
  const rootCheck = await waitForHttp(baseUrl);
  callLog.push(`curl ${baseUrl} -> ${rootCheck.code}`);
  results.push({
    id: 'M1',
    title: 'Root server responds with 200',
    pass: rootCheck.ok,
    details: `curl ${baseUrl} returned ${rootCheck.code}.`,
  });

  const subpathCheck = await waitForHttp(subpathUrl);
  callLog.push(`curl ${subpathUrl} -> ${subpathCheck.code}`);
  results.push({
    id: 'M2',
    title: 'Subpath server responds with 200',
    pass: subpathCheck.ok,
    details: `curl ${subpathUrl} returned ${subpathCheck.code}.`,
  });

  const localStorage = buildLocalStorage();
  globalThis.window = { localStorage };
  globalThis.localStorage = localStorage;

  const { default: dailyStatsStore } = await import('../src/core/dailyStatsStore.js');
  const { default: todayRankStore } = await import('../src/core/todayRankStore.js');
  const { default: stageProgressStore } = await import('../src/core/stageProgressStore.js');
  const { resetProfileData } = await import('../src/core/dataReset.js');
  const { makeKey, STORE_NAMES } = await import('../src/core/storageKeys.js');
  const { findStageById, getNextStage, isStageUnlocked } = await import('../src/features/stages.js');

  const dateKey = '2099-01-01';
  dailyStatsStore.upsert(dateKey, { attemptTotal: 3, wrongTotal: 1, avgSec: 2.3, distanceM: 5 }, 'A');
  dailyStatsStore.upsert(dateKey, { attemptTotal: 5, wrongTotal: 0, avgSec: 1.8, distanceM: 9 }, 'B');
  todayRankStore.update(dateKey, 12.3, 'A');
  todayRankStore.update(dateKey, 8.8, 'B');
  stageProgressStore.markCleared('w1-1', 'A');
  stageProgressStore.markCleared('w1-1', 'B');
  callLog.push('dailyStatsStore.upsert(A/B), todayRankStore.update(A/B), stageProgressStore.markCleared(A/B)');

  const dailyKeyA = makeKey(STORE_NAMES.daily, 'A');
  const dailyKeyB = makeKey(STORE_NAMES.daily, 'B');
  const rankKeyA = makeKey(STORE_NAMES.todayRankDistance, 'A');
  const rankKeyB = makeKey(STORE_NAMES.todayRankDistance, 'B');
  const stageKeyA = makeKey(STORE_NAMES.stageProgress, 'A');
  const stageKeyB = makeKey(STORE_NAMES.stageProgress, 'B');

  const separationPass = dailyKeyA !== dailyKeyB
    && rankKeyA !== rankKeyB
    && stageKeyA !== stageKeyB
    && localStorage.getItem(dailyKeyA)
    && localStorage.getItem(dailyKeyB)
    && localStorage.getItem(rankKeyA)
    && localStorage.getItem(rankKeyB)
    && localStorage.getItem(stageKeyA)
    && localStorage.getItem(stageKeyB);

  results.push({
    id: 'M3',
    title: 'Profile storage keys are separated',
    pass: Boolean(separationPass),
    details: [
      `daily keys: ${dailyKeyA} | ${dailyKeyB}`,
      `rank keys: ${rankKeyA} | ${rankKeyB}`,
      `stage keys: ${stageKeyA} | ${stageKeyB}`,
      `daily(A): ${localStorage.getItem(dailyKeyA)}`,
      `daily(B): ${localStorage.getItem(dailyKeyB)}`,
      `rank(A): ${localStorage.getItem(rankKeyA)}`,
      `rank(B): ${localStorage.getItem(rankKeyB)}`,
    ].join('\n'),
  });

  resetProfileData('A');
  callLog.push('resetProfileData(A)');
  const resetPass = !localStorage.getItem(dailyKeyA)
    && !localStorage.getItem(rankKeyA)
    && !localStorage.getItem(stageKeyA)
    && Boolean(localStorage.getItem(dailyKeyB))
    && Boolean(localStorage.getItem(rankKeyB))
    && Boolean(localStorage.getItem(stageKeyB));

  results.push({
    id: 'M4',
    title: 'Profile reset clears only targeted keys',
    pass: resetPass,
    details: [
      `after reset A daily: ${localStorage.getItem(dailyKeyA)}`,
      `after reset A rank: ${localStorage.getItem(rankKeyA)}`,
      `after reset A stage: ${localStorage.getItem(stageKeyA)}`,
      `remaining B daily: ${localStorage.getItem(dailyKeyB)}`,
      `remaining B rank: ${localStorage.getItem(rankKeyB)}`,
      `remaining B stage: ${localStorage.getItem(stageKeyB)}`,
    ].join('\n'),
  });

  stageProgressStore.reset('C');
  stageProgressStore.setLastPlayed('w1-1', 'C');
  const stageOne = findStageById('w1-1');
  const nextStage = getNextStage('w1-1');
  const progressBefore = stageProgressStore.getProgress('C');
  const beforeUnlocked = isStageUnlocked(nextStage, progressBefore);
  stageProgressStore.markCleared(stageOne?.id, 'C');
  const progressAfter = stageProgressStore.getProgress('C');
  const afterUnlocked = isStageUnlocked(nextStage, progressAfter);
  callLog.push('stageProgressStore.setLastPlayed(w1-1, C)');
  callLog.push('stageProgressStore.markCleared(w1-1, C)');

  results.push({
    id: 'M5',
    title: 'ADR-001 unlocks next stage only after result (markCleared)',
    pass: beforeUnlocked === false && afterUnlocked === true,
    details: [
      `before markCleared -> next unlocked: ${beforeUnlocked}`,
      `after markCleared -> next unlocked: ${afterUnlocked}`,
    ].join('\n'),
  });

  const passAll = await renderReport(results, callLog);
  if (!passAll) {
    process.exitCode = 1;
  }
};

run().catch(async (error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  await ensureReportDir();
  await fs.writeFile(
    reportPath,
    `# ADR Acceptance Checklist (Manual Runner)\n- Timestamp: ${new Date().toISOString()}\n- Overall: FAIL\n\n## Error\n${message}\n`,
    'utf8',
  );
  process.exitCode = 1;
});
