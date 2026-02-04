export const PRESETS = {
  'p3-basic': {
    label: '🟢 はじめてラン',
    description: 'たし算・ひき算の1けたをゆっくりれんしゅう。',
    mode: 'mix',
    allowedModes: ['add', 'sub'],
    digit: 1,
    carry: false,
  },
  'p4-nocarry': {
    label: '🔵 ふつうラン',
    description: '2けたのたし算・ひき算をくり上がりなしで。',
    mode: 'mix',
    allowedModes: ['add', 'sub'],
    digit: 2,
    carry: false,
  },
  'p4-carry': {
    label: '🟠 ちょうせんラン',
    description: '2けたのたし算・ひき算をくり上がりありで。',
    mode: 'mix',
    allowedModes: ['add', 'sub'],
    digit: 2,
    carry: true,
  },
  'p5-mul': {
    label: '🟣 きゅうきゅうラン',
    description: '九九の1けたかけ算にチャレンジ！',
    mode: 'mul',
    digit: 1,
    carry: true,
  },
};
