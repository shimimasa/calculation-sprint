import { randomInt } from '../core/utils.js';

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

const nextAddNoCarry = (digit) => {
  if (digit === 1) {
    const a = randomInt(1, 8);
    const b = randomInt(1, 9 - a);
    return { a, b };
  }
  const aTens = randomInt(1, 8);
  const bTens = randomInt(1, 9 - aTens);
  const aOnes = randomInt(0, 9);
  const bOnes = randomInt(0, 9 - aOnes);
  return {
    a: buildNumberFromDigits(aTens, aOnes),
    b: buildNumberFromDigits(bTens, bOnes),
  };
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

const questionGenerator = {
  next(settings) {
    const mode = settings.mode === 'mix'
      ? modes[randomInt(0, modes.length - 1)]
      : settings.mode;
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
      if (settings.carry === false) {
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
      const divisorMin = settings.digit === 1 ? 1 : 2;
      const divisorMax = settings.digit === 1 ? 9 : 12;
      const quotientMin = settings.digit === 1 ? 1 : 2;
      const quotientMax = settings.digit === 1 ? 9 : 12;
      let dividend = 0;
      let divisor = 0;
      let quotient = 0;
      do {
        divisor = randomInt(divisorMin, divisorMax);
        quotient = randomInt(quotientMin, quotientMax);
        dividend = divisor * quotient;
      } while (dividend < min || dividend > max);
      a = dividend;
      b = divisor;
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
