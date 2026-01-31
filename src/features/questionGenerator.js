import { randomInt } from '../core/utils.js';

const operators = {
  add: { symbol: '+', calc: (a, b) => a + b },
  sub: { symbol: '-', calc: (a, b) => a - b },
  mul: { symbol: '×', calc: (a, b) => a * b },
  div: { symbol: '÷', calc: (a, b) => a / b },
};

const modes = ['add', 'sub', 'mul', 'div'];

const questionGenerator = {
  next(settings) {
    const mode = settings.mode === 'mix'
      ? modes[randomInt(0, modes.length - 1)]
      : settings.mode;
    const operator = operators[mode];
    if (!operator) {
      return { text: '1 + 1', answer: 2 };
    }
    const min = settings.digit === 1 ? 1 : 10;
    const max = settings.digit === 1 ? 9 : 99;
    let a = randomInt(min, max);
    let b = randomInt(min, max);

    if (mode === 'sub' && a < b) {
      [a, b] = [b, a];
    }
    if (mode === 'div') {
      b = randomInt(1, settings.digit === 1 ? 9 : 12);
      const quotient = randomInt(1, settings.digit === 1 ? 9 : 12);
      a = b * quotient;
    }

    const answer = operator.calc(a, b);
    return {
      text: `${a} ${operator.symbol} ${b}`,
      answer,
    };
  },
};

export default questionGenerator;
