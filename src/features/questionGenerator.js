import { randomInt } from '../core/utils.js';
import { getDashDifficultyRule } from '../data/dashDifficultySchema.js';
import { normalizeDashStageId, toQuestionMode } from './dashStages.js';

const operators = {
  add: { symbol: '+', calc: (a, b) => a + b },
  sub: { symbol: '-', calc: (a, b) => a - b },
  mul: { symbol: '×', calc: (a, b) => a * b },
  div: { symbol: '÷', calc: (a, b) => a / b },
};

const modes = ['add', 'sub', 'mul', 'div'];

const digitRange = (digit) => (digit === 1
  ? { min: 1, max: 9 }
  : { min: 10, max: 99 });

const buildNumberFromDigits = (tens, ones) => tens * 10 + ones;
const maxAttempts = 50;
const normalizeQuestionMode = (mode) => (modes.includes(mode) ? mode : null);
const isCarryCase = (a, b) => ((a % 10) + (b % 10)) >= 10;
const isBorrowCase = (a, b) => (a % 10) < (b % 10);
const pickOperandByDigits = (digits) => (digits === 1 ? randomInt(1, 9) : randomInt(10, 99));

const pickRandomMode = (candidates = modes) => {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return 'add';
  }
  const idx = Math.floor(Math.random() * candidates.length);
  return candidates[idx] ?? 'add';
};

const resolveMode = (settings) => {
  const stageId = normalizeDashStageId(settings.stageId);
  const reviewModes = Array.isArray(settings.reviewModes)
    ? settings.reviewModes.filter((mode) => modes.includes(mode))
    : [];
  const allowedMixModes = Array.isArray(settings.allowedModes)
    ? settings.allowedModes.filter((mode) => modes.includes(mode))
    : [];
  const mixModes = allowedMixModes.length > 0 ? allowedMixModes : modes;
  const fallbackMode = settings.mode === 'mix'
    ? pickRandomMode(mixModes)
    : (normalizeQuestionMode(settings.mode) ?? 'add');
  const requestedMode = normalizeQuestionMode(settings.questionMode);

  if (reviewModes.length > 0) {
    return {
      mode: reviewModes[randomInt(0, reviewModes.length - 1)],
      stageId,
      useDashStagePolicy: false,
    };
  }

  if (stageId) {
    const stageMode = toQuestionMode(stageId);
    if (stageMode === 'mix') {
      return {
        mode: pickRandomMode(modes),
        stageId,
        useDashStagePolicy: true,
      };
    }

    return {
      mode: normalizeQuestionMode(stageMode) ?? 'add',
      stageId,
      useDashStagePolicy: true,
    };
  }

  if (requestedMode) {
    return { mode: requestedMode, stageId: null, useDashStagePolicy: true };
  }

  return {
    mode: fallbackMode,
    stageId: null,
    useDashStagePolicy: false,
  };
};

const nextAddNoCarry = (digit) => {
  if (digit === 1) {
    const a = randomInt(1, 8);
    const b = randomInt(1, 9 - a);
    return { a, b };
  }
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const aTens = randomInt(1, 8);
    const bTens = randomInt(1, 9 - aTens);
    const aOnes = randomInt(0, 9);
    const bOnes = randomInt(0, 9 - aOnes);
    const a = buildNumberFromDigits(aTens, aOnes);
    const b = buildNumberFromDigits(bTens, bOnes);
    if (a + b <= 99) {
      return { a, b };
    }
  }
  return { a: 10, b: 10 };
};

const nextSubNoBorrow = (digit) => {
  if (digit === 1) {
    const b = randomInt(1, 9);
    const a = randomInt(b, 9);
    return { a, b };
  }
  const bTens = randomInt(1, 9);
  const aTens = randomInt(bTens, 9);
  const bOnes = randomInt(0, 9);
  const aOnes = randomInt(bOnes, 9);
  return {
    a: buildNumberFromDigits(aTens, aOnes),
    b: buildNumberFromDigits(bTens, bOnes),
  };
};

const nextSubOneDigit = (allowBorrow) => {
  let a = 1;
  let b = 1;
  let attempts = 0;
  do {
    a = randomInt(1, 9);
    b = randomInt(1, 9);
    if (!allowBorrow && a < b) {
      [a, b] = [b, a];
    }
    if (allowBorrow && a < b) {
      [a, b] = [b, a];
    }
    attempts += 1;
  } while (attempts < maxAttempts && a - b < 1);

  if (a - b < 1) {
    a = 9;
    b = 1;
  }

  return { a, b };
};

const nextDashSubOperands = () => {
  if (Math.random() < 0.35) {
    const b = randomInt(1, 9);
    const a = randomInt(b, 9);
    return { a, b };
  }

  return {
    a: randomInt(10, 99),
    b: randomInt(1, 9),
  };
};

const generateDivisionOperands = ({
  minDividend,
  maxDividend,
  minDivisor,
  maxDivisor,
  minQuotient,
  maxQuotient,
  fallback,
}) => {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const divisor = randomInt(minDivisor, maxDivisor);
    const quotient = randomInt(minQuotient, maxQuotient);
    const dividend = divisor * quotient;
    if (
      divisor > 0
      && quotient > 0
      && dividend >= minDividend
      && dividend <= maxDividend
    ) {
      return { a: dividend, b: divisor };
    }
  }
  return fallback;
};

const nextDashDivOperands = () => generateDivisionOperands({
  minDividend: 10,
  maxDividend: 99,
  minDivisor: 2,
  maxDivisor: 9,
  minQuotient: 2,
  maxQuotient: 12,
  fallback: { a: 12, b: 3 },
});

const tryGenerateDashWorldLevelQuestion = (settings) => {
  if (settings.worldLevelEnabled !== true) {
    return null;
  }
  const worldKey = typeof settings.worldKey === 'string' ? settings.worldKey : null;
  if (!worldKey) {
    return null;
  }
  const resolved = getDashDifficultyRule(worldKey, settings.levelId);
  const rule = resolved.rule;
  if (!rule || rule.mode === 'mix') {
    return null;
  }

  if (rule.mode === 'add') {
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const a = pickOperandByDigits(rule.aDigits);
      const b = pickOperandByDigits(rule.bDigits);
      if ((rule.carry === true && !isCarryCase(a, b)) || (rule.carry === false && isCarryCase(a, b))) {
        continue;
      }
      return {
        text: `${a} + ${b}`,
        answer: a + b,
        meta: { mode: 'add', a, b, worldKey: resolved.worldKey, levelId: resolved.levelId, difficultyKey: resolved.difficultyKey },
      };
    }
    return null;
  }

  if (rule.mode === 'sub') {
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      let a = pickOperandByDigits(rule.aDigits);
      let b = pickOperandByDigits(rule.bDigits);
      if (rule.nonNegative && a < b) {
        [a, b] = [b, a];
      }
      if ((rule.borrow === true && !isBorrowCase(a, b)) || (rule.borrow === false && isBorrowCase(a, b))) {
        continue;
      }
      if (rule.nonNegative && a < b) {
        continue;
      }
      return {
        text: `${a} - ${b}`,
        answer: a - b,
        meta: { mode: 'sub', a, b, worldKey: resolved.worldKey, levelId: resolved.levelId, difficultyKey: resolved.difficultyKey },
      };
    }
    return null;
  }

  if (rule.mode === 'mul') {
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const a = pickOperandByDigits(rule.aDigits);
      const b = pickOperandByDigits(rule.bDigits);
      return {
        text: `${a} × ${b}`,
        answer: a * b,
        meta: { mode: 'mul', a, b, worldKey: resolved.worldKey, levelId: resolved.levelId, difficultyKey: resolved.difficultyKey },
      };
    }
    return null;
  }

  if (rule.mode === 'div') {
    if (rule.divisible === true) {
      const { a, b } = generateDivisionOperands({
        minDividend: 2,
        maxDividend: 99,
        minDivisor: 2,
        maxDivisor: 12,
        minQuotient: 1,
        maxQuotient: 12,
        fallback: { a: 12, b: 3 },
      });
      return {
        text: `${a} ÷ ${b}`,
        answer: a / b,
        meta: { mode: 'div', a, b, worldKey: resolved.worldKey, levelId: resolved.levelId, difficultyKey: resolved.difficultyKey },
      };
    }
    if (rule.divisible === false && rule.integerAnswerOnly === true) {
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const b = randomInt(2, 9);
        const quotient = randomInt(1, 9);
        const remainder = randomInt(1, b - 1);
        const a = b * quotient + remainder;
        if (a <= 99) {
          return {
            text: `${a} ÷ ${b}（しょう）`,
            answer: quotient,
            meta: {
              mode: 'div',
              a,
              b,
              remainder,
              worldKey: resolved.worldKey,
              levelId: resolved.levelId,
              difficultyKey: resolved.difficultyKey,
            },
          };
        }
      }
    }
  }

  return null;
};

const questionGenerator = {
  next(settings) {
    const worldLevelQuestion = tryGenerateDashWorldLevelQuestion(settings);
    if (worldLevelQuestion) {
      return worldLevelQuestion;
    }

    const { mode, stageId, useDashStagePolicy } = resolveMode(settings);
    const operator = operators[mode];
    if (!operator) {
      return { text: '1 + 1', answer: 2, meta: { mode: 'add', a: 1, b: 1 } };
    }
    const { min, max } = digitRange(settings.digit);
    let a = randomInt(min, max);
    let b = randomInt(min, max);

    if (mode === 'add' && settings.carry === false) {
      ({ a, b } = nextAddNoCarry(settings.digit));
    }
    if (mode === 'sub') {
      const isDashMinus = useDashStagePolicy && stageId === 'minus';
      if (isDashMinus) {
        ({ a, b } = nextDashSubOperands());
      } else if (settings.digit === 1) {
        ({ a, b } = nextSubOneDigit(settings.carry !== false));
      } else if (settings.carry === false) {
        ({ a, b } = nextSubNoBorrow(settings.digit));
      } else if (a < b) {
        [a, b] = [b, a];
      }
    }
    if (mode === 'mul') {
      a = randomInt(1, 9);
      b = randomInt(1, 9);
    }
    if (mode === 'div') {
      const isDashDivide = useDashStagePolicy && stageId === 'divide';
      if (isDashDivide) {
        ({ a, b } = nextDashDivOperands());
      } else {
        ({ a, b } = settings.digit === 1
          ? generateDivisionOperands({
            minDividend: 1,
            maxDividend: 9,
            minDivisor: 2,
            maxDivisor: 9,
            minQuotient: 1,
            maxQuotient: 4,
            fallback: { a: 8, b: 2 },
          })
          : generateDivisionOperands({
            minDividend: min,
            maxDividend: max,
            minDivisor: 2,
            maxDivisor: 12,
            minQuotient: 2,
            maxQuotient: 12,
            fallback: { a: 10, b: 2 },
          }));
      }
    }

    const answer = operator.calc(a, b);
    return {
      text: `${a} ${operator.symbol} ${b}`,
      answer,
      meta: { mode, a, b },
    };
  },
};

export default questionGenerator;
