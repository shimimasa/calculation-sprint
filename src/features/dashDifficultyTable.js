import { toDashStageId } from './dashStages.js';

export const DASH_DIFFICULTY_TABLE = Object.freeze({
  plus: Object.freeze({
    1: Object.freeze({
      labelShort: '1けた やさしい',
      labelLong: '1けた+1けた（くり上がりなし）',
      params: Object.freeze({ mode: 'add', aMin: 1, aMax: 9, bMin: 1, bMax: 9, carry: 'avoid' }),
    }),
    2: Object.freeze({
      labelShort: '1けた くり上がり少し',
      labelLong: '1けた+1けた（くり上がりを少し）',
      params: Object.freeze({ mode: 'add', aMin: 1, aMax: 9, bMin: 1, bMax: 9, carry: 'some' }),
    }),
    3: Object.freeze({
      labelShort: '2けた+1けた',
      labelLong: '2けた+1けた（くり上がり混在）',
      params: Object.freeze({ mode: 'add', aMin: 10, aMax: 99, bMin: 1, bMax: 9, carry: 'mixed' }),
    }),
    4: Object.freeze({
      labelShort: '2けた+2けた',
      labelLong: '2けた+2けた（くり上がり多め）',
      params: Object.freeze({ mode: 'add', aMin: 10, aMax: 99, bMin: 10, bMax: 99, carry: 'prefer' }),
    }),
    5: Object.freeze({
      labelShort: '3けた ちょうせん',
      labelLong: '3けた+2けた（くり上がりあり）',
      params: Object.freeze({ mode: 'add', aMin: 100, aMax: 999, bMin: 10, bMax: 99, carry: 'prefer' }),
    }),
  }),
  minus: Object.freeze({
    1: Object.freeze({
      labelShort: '1けた ひき算',
      labelLong: '1けた-1けた（くり下がりなし）',
      params: Object.freeze({ mode: 'sub', aMin: 1, aMax: 9, bMin: 1, bMax: 9, borrow: 'avoid', allowZero: false }),
    }),
    2: Object.freeze({
      labelShort: '1けた 0もでる',
      labelLong: '1けた-1けた（0を含む・くり下がり少し）',
      params: Object.freeze({ mode: 'sub', aMin: 1, aMax: 9, bMin: 1, bMax: 9, borrow: 'some', allowZero: true }),
    }),
    3: Object.freeze({
      labelShort: '2けた-1けた',
      labelLong: '2けた-1けた（くり下がり混在）',
      params: Object.freeze({ mode: 'sub', aMin: 10, aMax: 99, bMin: 1, bMax: 9, borrow: 'mixed', allowZero: true }),
    }),
    4: Object.freeze({
      labelShort: '2けた-2けた',
      labelLong: '2けた-2けた（くり下がり多め）',
      params: Object.freeze({ mode: 'sub', aMin: 10, aMax: 99, bMin: 10, bMax: 99, borrow: 'prefer', allowZero: true }),
    }),
    5: Object.freeze({
      labelShort: '3けた ひき算',
      labelLong: '3けた-2けた（くり下がりあり）',
      params: Object.freeze({ mode: 'sub', aMin: 100, aMax: 999, bMin: 10, bMax: 99, borrow: 'prefer', allowZero: true }),
    }),
  }),
  multi: Object.freeze({
    1: Object.freeze({
      labelShort: '2・5・10のだん',
      labelLong: '2,5,10 のかけ算中心',
      params: Object.freeze({ mode: 'mul', factorsA: Object.freeze([2, 5, 10]), factorsB: Object.freeze([1, 2, 3, 4, 5]) }),
    }),
    2: Object.freeze({
      labelShort: '3・4・6のだん',
      labelLong: '3,4,6 のかけ算中心',
      params: Object.freeze({ mode: 'mul', factorsA: Object.freeze([3, 4, 6]), factorsB: Object.freeze([1, 2, 3, 4, 5, 6]) }),
    }),
    3: Object.freeze({
      labelShort: '九九 フル',
      labelLong: '7,8,9 を含む1けた×1けた',
      params: Object.freeze({ mode: 'mul', aMin: 1, aMax: 9, bMin: 1, bMax: 9 }),
    }),
    4: Object.freeze({
      labelShort: '2けた×1けた',
      labelLong: '2けた×1けた（やさしめ）',
      params: Object.freeze({ mode: 'mul', aMin: 10, aMax: 15, bMin: 2, bMax: 6 }),
    }),
    5: Object.freeze({
      labelShort: '2けた×1けた+ ',
      labelLong: '2けた×1けた（むずかしめ）',
      params: Object.freeze({ mode: 'mul', aMin: 12, aMax: 19, bMin: 3, bMax: 9 }),
    }),
  }),
  divide: Object.freeze({
    1: Object.freeze({
      labelShort: '÷2・5・10',
      labelLong: '2,5,10 で割る（割り切れる）',
      params: Object.freeze({ mode: 'div', divisors: Object.freeze([2, 5, 10]), quotientMin: 1, quotientMax: 9, remainderRate: 0 }),
    }),
    2: Object.freeze({
      labelShort: '÷3・4・6',
      labelLong: '3,4,6 で割る（割り切れる）',
      params: Object.freeze({ mode: 'div', divisors: Object.freeze([3, 4, 6]), quotientMin: 1, quotientMax: 9, remainderRate: 0 }),
    }),
    3: Object.freeze({
      labelShort: '÷7・8・9',
      labelLong: '7,8,9 を含む（割り切れる）',
      params: Object.freeze({ mode: 'div', divisors: Object.freeze([4, 6, 7, 8, 9]), quotientMin: 1, quotientMax: 9, remainderRate: 0 }),
    }),
    4: Object.freeze({
      labelShort: '2けた÷1けた',
      labelLong: '2けた ÷ 1けた（割り切れる）',
      params: Object.freeze({ mode: 'div', divisors: Object.freeze([2, 3, 4, 5, 6, 7, 8, 9]), quotientMin: 2, quotientMax: 12, remainderRate: 0 }),
    }),
    5: Object.freeze({
      labelShort: '2けた÷1けた+あまり',
      labelLong: '2けた ÷ 1けた（あまりを少量）',
      params: Object.freeze({ mode: 'div', divisors: Object.freeze([2, 3, 4, 5, 6, 7, 8, 9]), quotientMin: 2, quotientMax: 12, remainderRate: 0.2, remainderMin: 1, remainderMax: 2 }),
    }),
  }),
  mix: Object.freeze({
    1: Object.freeze({
      labelShort: 'たし・ひき ミックス',
      labelLong: '足し算＋引き算（やさしめ）',
      params: Object.freeze({
        operatorSet: Object.freeze(['add', 'sub']),
        add: Object.freeze({ aMin: 1, aMax: 9, bMin: 1, bMax: 9, carry: 'some' }),
        sub: Object.freeze({ aMin: 1, aMax: 9, bMin: 1, bMax: 9, borrow: 'some', allowZero: true }),
      }),
    }),
    2: Object.freeze({
      labelShort: '4えんざん ミックス',
      labelLong: '4演算（難しすぎない範囲）',
      params: Object.freeze({
        operatorSet: Object.freeze(['add', 'sub', 'mul', 'div']),
        add: Object.freeze({ aMin: 10, aMax: 99, bMin: 1, bMax: 9, carry: 'mixed' }),
        sub: Object.freeze({ aMin: 10, aMax: 99, bMin: 1, bMax: 9, borrow: 'mixed', allowZero: true }),
        mul: Object.freeze({ aMin: 2, aMax: 9, bMin: 2, bMax: 6 }),
        div: Object.freeze({ divisors: Object.freeze([2, 3, 4, 5, 6]), quotientMin: 1, quotientMax: 9, remainderRate: 0 }),
      }),
    }),
  }),
});

export const getDashDifficultyEntry = (stageId, levelId) => {
  const normalizedStageId = toDashStageId(stageId);
  const stageTable = DASH_DIFFICULTY_TABLE[normalizedStageId] ?? DASH_DIFFICULTY_TABLE.plus;
  const numericLevel = Number(levelId);
  const normalizedLevelId = Number.isInteger(numericLevel) && numericLevel > 0 ? numericLevel : 1;
  return stageTable[normalizedLevelId] ?? stageTable[1];
};

export const getDashDifficultyLabelShort = (stageId, levelId) =>
  getDashDifficultyEntry(stageId, levelId)?.labelShort ?? 'ベーシック';
