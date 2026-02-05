import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { basename, resolve, dirname, join, normalize, sep } from 'node:path';
import fs from 'node:fs/promises';
import http from 'node:http';
import { createReadStream, existsSync } from 'node:fs';

const execFileAsync = promisify(execFile);

const reportPath = resolve('spec/test-results/adr-acceptance-latest.md');
const repoName = basename(resolve('.'));
const baseUrl = 'http://127.0.0.1:8082/';
const subpathUrl = `http://127.0.0.1:8083/${repoName}/`;

const isWindows = process.platform === 'win32';

const guessRepoRoot = () => resolve('.');

const parsePort = (args, fallback) => {
  const idx = args.findIndex((value) => value === '--port');
  if (idx !== -1 && args[idx + 1]) {
    const parsed = Number(args[idx + 1]);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.floor(parsed);
    }
  }
  return fallback;
};

const hasFlag = (args, flag) => args.includes(flag);

const contentTypeByExt = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.mp3': 'audio/mpeg',
});

const getExt = (path) => {
  const dot = path.lastIndexOf('.');
  return dot === -1 ? '' : path.slice(dot).toLowerCase();
};

const safeJoin = (root, requestPath) => {
  const cleaned = requestPath.split('?')[0].split('#')[0];
  const withoutLeading = cleaned.replace(/^\/+/, '');
  const candidate = normalize(join(root, withoutLeading));
  const rootNorm = normalize(root.endsWith(sep) ? root : `${root}${sep}`);
  if (!candidate.startsWith(rootNorm)) {
    return null;
  }
  return candidate;
};

const startStaticServer = ({ port, rootDir }) => {
  const server = http.createServer((req, res) => {
    try {
      const urlPath = decodeURIComponent(req.url || '/');
      let pathname = urlPath.split('?')[0] || '/';
      if (pathname.endsWith('/')) {
        pathname = `${pathname}index.html`;
      }
      const filePath = safeJoin(rootDir, pathname);
      if (!filePath) {
        res.statusCode = 403;
        res.end('Forbidden');
        return;
      }
      if (!existsSync(filePath)) {
        res.statusCode = 404;
        res.end('Not Found');
        return;
      }
      const ext = getExt(filePath);
      res.statusCode = 200;
      res.setHeader('Content-Type', contentTypeByExt[ext] || 'application/octet-stream');
      createReadStream(filePath).pipe(res);
    } catch (error) {
      res.statusCode = 500;
      res.end('Server Error');
    }
  });
  server.listen(port, '127.0.0.1');
  return server;
};

const startServer = (args) => {
  if (!isWindows) {
    const proc = spawn('./tools/serve', args, {
      stdio: 'ignore',
    });
    return proc;
  }

  const port = parsePort(args, 8082);
  const repoRoot = guessRepoRoot();
  const shouldSubpath = hasFlag(args, '--subpath');
  const rootDir = shouldSubpath ? dirname(repoRoot) : repoRoot;
  const server = startStaticServer({ port, rootDir });
  return server;
};

const stopServer = (proc) => {
  if (!proc) {
    return;
  }
  if (typeof proc.kill === 'function') {
    proc.kill('SIGTERM');
    return;
  }
  if (typeof proc.close === 'function') {
    proc.close();
  }
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

const countBraces = (text) => {
  let open = 0;
  let close = 0;
  for (const ch of text) {
    if (ch === '{') {
      open += 1;
    } else if (ch === '}') {
      close += 1;
    }
  }
  return { open, close };
};

// ADR-004 static check (CSS non-invasive):
// - Evaluate "selector lines" only: after stripping leading '}' and whitespace, the text contains '{'
// - Allow at-rule lines themselves (@media/@supports/@property/@font-face/@layer/etc.)
// - Ignore @keyframes blocks and their internal from/to/xx% steps
const checkScopedCssSelectors = async () => {
  const cssPath = resolve('styles/style.scoped.css');
  const raw = await fs.readFile(cssPath, 'utf8');
  const lines = raw.split(/\r?\n/);

  const offenders = [];
  let keyframesDepth = 0;

  for (let i = 0; i < lines.length; i += 1) {
    const originalLine = lines[i];
    const trimmed = originalLine.trim();
    if (!trimmed) {
      continue;
    }

    const withoutLead = trimmed.replace(/^[}\s]+/, '');

    // Track keyframes block depth to ignore from/to/xx% selectors.
    if (withoutLead.startsWith('@keyframes')) {
      const { open, close } = countBraces(withoutLead);
      keyframesDepth += Math.max(1, open) - close;
      continue;
    }
    if (keyframesDepth > 0) {
      const { open, close } = countBraces(trimmed);
      keyframesDepth += open - close;
      if (keyframesDepth <= 0) {
        keyframesDepth = 0;
      }
      continue;
    }

    // At-rule lines are allowed as-is.
    if (withoutLead.startsWith('@')) {
      continue;
    }

    // Selector line heuristic: must contain '{' after stripping leading braces/spaces.
    if (!withoutLead.includes('{')) {
      continue;
    }

    // Keyframe step lines are selector-like but exempt.
    if (/^(from|to|\d+%)(\s*,\s*(from|to|\d+%))*\s*\{/.test(withoutLead)) {
      continue;
    }

    if (!withoutLead.startsWith('.calc-sprint')) {
      offenders.push({ line: i + 1, text: withoutLead.slice(0, 160) });
    }
  }

  return {
    pass: offenders.length === 0,
    offenders,
    details: offenders.length === 0
      ? 'All selector lines are scoped under .calc-sprint.'
      : [
        `Found ${offenders.length} unscoped selector line(s).`,
        'Examples (up to 10):',
        ...offenders.slice(0, 10).map((o) => `- L${o.line}: ${o.text}`),
        '',
        'Rules:',
        '- Check only selector lines (contains "{", after stripping leading "}" and whitespace).',
        '- Allow at-rule lines: @media/@supports/@property/@font-face/@layer/etc.',
        '- Ignore @keyframes blocks and their from/to/xx% steps.',
      ].join('\n'),
  };
};

// ADR-004 static check (asset-safe):
// - index.html must reference styles/style.scoped.css
// - index.html must NOT reference styles/style.css (or legacy style.css)
const checkIndexHtmlCssLinks = async () => {
  const htmlPath = resolve('index.html');
  const html = await fs.readFile(htmlPath, 'utf8');
  const hasScoped = html.includes('href="styles/style.scoped.css"') || html.includes("href='styles/style.scoped.css'");
  const hasStyleCss = html.includes('styles/style.css');
  const hasLegacyCss = html.includes('styles/legacy/style.css');
  const hasAnyLegacyRef = hasStyleCss || hasLegacyCss;

  return {
    pass: Boolean(hasScoped && !hasAnyLegacyRef),
    details: [
      `index.html references styles/style.scoped.css: ${hasScoped ? 'YES' : 'NO'}`,
      `index.html references styles/style.css: ${hasStyleCss ? 'YES' : 'NO'}`,
      `index.html references styles/legacy/style.css: ${hasLegacyCss ? 'YES' : 'NO'}`,
      '',
      'Rule: index.html must reference styles/style.scoped.css and must not reference styles/style.css.',
    ].join('\n'),
  };
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

  // ADR-004 static guards (CSS non-invasive).
  const cssScope = await checkScopedCssSelectors();
  results.push({
    id: 'S1',
    title: 'ADR-004 CSS selectors are fully scoped under .calc-sprint',
    pass: cssScope.pass,
    details: cssScope.details,
  });

  const htmlLinks = await checkIndexHtmlCssLinks();
  results.push({
    id: 'S2',
    title: 'ADR-004 index.html references scoped CSS only',
    pass: htmlLinks.pass,
    details: htmlLinks.details,
  });

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

  const gameScreenSource = await fs.readFile(resolve('src/screens/gameScreen.js'), 'utf8');
  const hasNextAction = gameScreenSource.includes('ACTIONS.NEXT');
  const hasNextHandler = gameScreenSource.includes('handleNextAction');
  const hasNextSubmit = gameScreenSource.includes('submitAnswer');
  results.push({
    id: 'M6',
    title: 'ADR-003 NEXT action is wired to submit in gameScreen',
    pass: hasNextAction && hasNextHandler && hasNextSubmit,
    details: [
      `gameScreen references ACTIONS.NEXT: ${hasNextAction}`,
      `gameScreen defines handleNextAction: ${hasNextHandler}`,
      `gameScreen can submit (submitAnswer reference): ${hasNextSubmit}`,
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
