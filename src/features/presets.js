export const PRESETS = {
  'p3-basic': {
    label: '小3 基本',
    mode: 'mix',
    allowedModes: ['add', 'sub'],
    digit: 1,
    carry: false,
  },
  'p4-nocarry': {
    label: '小4 繰上がりなし',
    mode: 'mix',
    allowedModes: ['add', 'sub'],
    digit: 2,
    carry: false,
  },
  'p4-carry': {
    label: '小4 繰上がりあり',
    mode: 'mix',
    allowedModes: ['add', 'sub'],
    digit: 2,
    carry: true,
  },
  'p5-mul': {
    label: '小5 九九',
    mode: 'mul',
    digit: 1,
    carry: true,
  },
};
