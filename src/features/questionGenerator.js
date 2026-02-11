import { randomInt } from '../core/utils.js';
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
const mixRecentModes = [];

const pickMixMode = (candidates) => {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return 'add';
  }

  const [prev2, prev1] = mixRecentModes.slice(-2);
  const avoidTriple = prev1 && prev1 === prev2;
  const filteredCandidates = avoidTriple
    ? candidates.filter((mode) => mode !== prev1)
    : candidates;
  const availableCandidates = filteredCandidates.length > 0 ? filteredCandidates : candidates;
  const pickedMode = availableCandidates[randomInt(0, availableCandidates.length - 1)];

  mixRecentModes.push(pickedMode);
  if (mixRecentModes.length > 8) {
    mixRecentModes.shift();
  }

  return pickedMode;
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
  const fallbackMode = settings.mode === 'mix' ? pickMixMode(mixModes) : settings.mode;
  const requestedMode = modes.includes(settings.questionMode) ? settings.questionMode : null;

  if (reviewModes.length > 0) {
    return { mode: reviewModes[randomInt(0, reviewModes.length - 1)], stageId, useDashStagePolicy: false };
  }
  if (requestedMode) {
    return { mode: requestedMode, stageId, useDashStagePolicy: true };
  }
  if (stageId) {
    const stageMode = toQuestionMode(stageId);
    return {
      mode: stageMode === 'mix' ? pickMixMode(modes) : stageMode,
      stageId,
      useDashStagePolicy: true,
    };
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
  const maxAttempts = 50;
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
  if (Math.random() < 0.75) {
    return {
      a: randomInt(10, 99),
      b: randomInt(1, 9),
    };
  }

  let a = randomInt(10, 99);
  let b = randomInt(10, 99);
  if (a < b) {
    [a, b] = [b, a];
  }
  return { a, b };
};

const nextDashDivOperands = () => {
  let dividend = 0;
  let divisor = 0;
  let quotient = 0;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    divisor = randomInt(2, 9);
    quotient = randomInt(2, 12);
    dividend = divisor * quotient;
    if (dividend >= 10 && dividend <= 99) {
      return { a: dividend, b: divisor };
    }
  }

  return { a: 12, b: 3 };
};

const questionGenerator = {
  next(settings) {
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
      let dividend = 0;
      let divisor = 0;
      let quotient = 0;
      let attempts = 0;
      if (settings.digit === 1) {
        do {
          divisor = randomInt(2, 9);
          quotient = randomInt(1, 9);
          dividend = divisor * quotient;
          attempts += 1;
        } while (attempts < maxAttempts && (quotient < 1 || quotient > 9));
        if (attempts >= maxAttempts) {
          divisor = 2;
          quotient = 1;
          dividend = 2;
        }
      } else {
        const divisorMin = 2;
        const divisorMax = 12;
        const quotientMin = 2;
        const quotientMax = 12;
        do {
          divisor = randomInt(divisorMin, divisorMax);
          quotient = randomInt(quotientMin, quotientMax);
          dividend = divisor * quotient;
          attempts += 1;
        } while (attempts < maxAttempts && (dividend < min || dividend > max));
        if (attempts >= maxAttempts) {
          divisor = 2;
          quotient = 5;
          dividend = 10;
        }
      }
      a = dividend;
      b = divisor;
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
