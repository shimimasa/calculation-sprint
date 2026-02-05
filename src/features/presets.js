export const PRESETS = {
  'p3-basic': {
    label: '🟢 はじめてラン',
    description: 'ねらい: 1けたのたし算・ひき算に慣れる / 目安: ゆっくり',
    mode: 'mix',
    allowedModes: ['add', 'sub'],
    digit: 1,
    carry: false,
  },
  'p4-nocarry': {
    label: '🔵 ふつうラン',
    description: 'ねらい: 2けたのたし算・ひき算 / 傾向: くり上がりなし',
    mode: 'mix',
    allowedModes: ['add', 'sub'],
    digit: 2,
    carry: false,
  },
  'p4-carry': {
    label: '🟠 ちょうせんラン',
    description: 'ねらい: 2けたのたし算・ひき算 / 傾向: くり上がりあり',
    mode: 'mix',
    allowedModes: ['add', 'sub'],
    digit: 2,
    carry: true,
  },
  'p5-mul': {
    label: '🟣 きゅうきゅうラン',
    description: 'ねらい: 九九の1けたかけ算 / 目安: じっくり',
    mode: 'mul',
    digit: 1,
    carry: true,
  },
};
