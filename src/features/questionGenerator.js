import { randomInt } from '../core/utils.js';
import { normalizeDashStageId, toQuestionMode } from './dashStages.js';
import { getDashDifficultyEntry } from './dashDifficultyTable.js';

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
const normalizeLevelId = (levelId) => {
  const numericLevel = Number(levelId);
  return Number.isInteger(numericLevel) && numericLevel > 0 ? numericLevel : 1;
};

const pickRandomMode = (candidates = modes) => {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return 'add';
  }
  const idx = Math.floor(Math.random() * candidates.length);
  return candidates[idx] ?? 'add';
};

const resolveMode = (settings) => {
  const stageId = normalizeDashStageId(settings.stageId);
  const levelId = normalizeLevelId(settings.levelId);
  const dashDifficulty = stageId ? getDashDifficultyEntry(stageId, levelId) : null;
  const dashParams = dashDifficulty?.params ?? null;
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
      const dashMixModes = Array.isArray(dashParams?.operatorSet)
        ? dashParams.operatorSet.filter((mode) => modes.includes(mode))
        : [];
      return {
        mode: pickRandomMode(dashMixModes.length > 0 ? dashMixModes : modes),
        stageId,
        levelId,
        useDashStagePolicy: true,
        dashDifficulty,
        dashParams,
      };
    }

    return {
      mode: normalizeQuestionMode(stageMode) ?? 'add',
      stageId,
      levelId,
      useDashStagePolicy: true,
      dashDifficulty,
      dashParams,
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

const isCarryPair = (a, b) => ((a % 10) + (b % 10)) >= 10;
const isBorrowPair = (a, b) => (a % 10) < (b % 10);

const generateOperandsByRule = (mode, rule) => {
  if (!rule || typeof rule !== 'object') {
    return null;
  }

  if (mode === 'add') {
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const a = randomInt(rule.aMin, rule.aMax);
      const b = randomInt(rule.bMin, rule.bMax);
      const carry = isCarryPair(a, b);
      if (rule.carry === 'avoid' && carry) {
        continue;
      }
      if (rule.carry === 'some' && carry && Math.random() >= 0.25) {
        continue;
      }
      if (rule.carry === 'mixed' && carry && Math.random() >= 0.5) {
        continue;
      }
      if (rule.carry === 'prefer' && !carry) {
        continue;
      }
      return { a, b };
    }
    return { a: rule.aMin, b: rule.bMin };
  }

  if (mode === 'sub') {
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      let a = randomInt(rule.aMin, rule.aMax);
      let b = randomInt(rule.bMin, rule.bMax);
      if (a < b) {
        [a, b] = [b, a];
      }
      const borrow = isBorrowPair(a, b);
      if (rule.borrow === 'avoid' && borrow) {
        continue;
      }
      if (rule.borrow === 'some' && borrow && Math.random() >= 0.25) {
        continue;
      }
      if (rule.borrow === 'mixed' && borrow && Math.random() >= 0.5) {
        continue;
      }
      if (rule.borrow === 'prefer' && !borrow) {
        continue;
      }
      if (a - b < 0 || (!rule.allowZero && a - b === 0)) {
        continue;
      }
      return { a, b };
    }
    return { a: Math.max(rule.aMin, rule.bMin + 1), b: rule.bMin };
  }

  if (mode === 'mul') {
    if (Array.isArray(rule.factorsA) && Array.isArray(rule.factorsB)) {
      return {
        a: rule.factorsA[randomInt(0, rule.factorsA.length - 1)],
        b: rule.factorsB[randomInt(0, rule.factorsB.length - 1)],
      };
    }
    return {
      a: randomInt(rule.aMin, rule.aMax),
      b: randomInt(rule.bMin, rule.bMax),
    };
  }

  if (mode === 'div') {
    const divisor = Array.isArray(rule.divisors) && rule.divisors.length > 0
      ? rule.divisors[randomInt(0, rule.divisors.length - 1)]
      : randomInt(rule.divisorMin, rule.divisorMax);
    const quotient = randomInt(rule.quotientMin, rule.quotientMax);
    const baseDividend = divisor * quotient;
    const remainderRate = Number(rule.remainderRate) || 0;
    if (remainderRate > 0 && Math.random() < remainderRate) {
      const remainderMin = Number(rule.remainderMin) || 1;
      const remainderMax = Number(rule.remainderMax) || 2;
      const remainder = randomInt(remainderMin, Math.min(remainderMax, divisor - 1));
      return { a: baseDividend + remainder, b: divisor };
    }
    return { a: baseDividend, b: divisor };
  }

  return null;
};

const questionGenerator = {
  next(settings) {
    const {
      mode,
      stageId,
      levelId,
      useDashStagePolicy,
      dashDifficulty,
      dashParams,
    } = resolveMode(settings);
    const operator = operators[mode];
    if (!operator) {
      return { text: '1 + 1', answer: 2, meta: { mode: 'add', a: 1, b: 1 } };
    }
    const { min, max } = digitRange(settings.digit);
    let a = randomInt(min, max);
    let b = randomInt(min, max);

    const dashRuleForMode = useDashStagePolicy
      ? (dashParams?.[mode] ?? (dashParams?.mode === mode ? dashParams : null))
      : null;
    const stageLevelOperands = generateOperandsByRule(mode, dashRuleForMode);
    if (stageLevelOperands) {
      ({ a, b } = stageLevelOperands);
    }

    if (!stageLevelOperands && mode === 'add' && settings.carry === false) {
      ({ a, b } = nextAddNoCarry(settings.digit));
    }
    if (!stageLevelOperands && mode === 'sub') {
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
    if (!stageLevelOperands && mode === 'mul') {
      a = randomInt(1, 9);
      b = randomInt(1, 9);
    }
    if (!stageLevelOperands && mode === 'div') {
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
      meta: {
        mode,
        a,
        b,
        difficulty: useDashStagePolicy
          ? {
            stageId,
            levelId,
            operatorSet: stageId === 'mix'
              ? (dashParams?.operatorSet ?? modes)
              : [mode],
            labelShort: dashDifficulty?.labelShort ?? null,
            labelLong: dashDifficulty?.labelLong ?? null,
            operandRule: dashRuleForMode ?? null,
          }
          : null,
      },
    };
  },
};

export default questionGenerator;
