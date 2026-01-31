const MODE_PRIORITY = ['add', 'sub', 'mul', 'div'];

const MODE_MESSAGES = {
  add: '加算のミスが多め。まずは繰り上がりなしで正確に練習しよう。',
  sub: '減算のミスが多め。繰り下がりなし→ありの順で練習しよう。',
  mul: 'かけ算のミスが多め。九九をゆっくり確実に言えるか確認しよう。',
  div: 'わり算のミスが多め。『かけ算に戻す』確認を入れて練習しよう。',
};

const ZERO_MESSAGE = 'ミスが減ってきたね。次はスピードを意識しよう！';

const NEXT_ACTIONS = {
  add: {
    label: "次は『繰り上がりなし（2桁）加算』で練習",
    presetPatch: { mode: 'add', digit: 2, carry: false },
  },
  sub: {
    label: "次は『繰り下がりなし（2桁）減算』で練習",
    presetPatch: { mode: 'sub', digit: 2, carry: false },
  },
  mul: {
    label: "次は『九九（かけ算）』で練習",
    presetPatch: { mode: 'mul', digit: 1, carry: true },
  },
  div: {
    label: "次は『わり算（割り切れる）』で練習",
    presetPatch: { mode: 'div', digit: 1, carry: true },
  },
};

const buildReviewSummary = (wrongByMode = {}, attemptByMode = {}, settings = {}) => {
  const totalWrong = MODE_PRIORITY.reduce(
    (sum, mode) => sum + (wrongByMode[mode] || 0),
    0,
  );
  if (totalWrong === 0) {
    return { topMode: null, message: ZERO_MESSAGE, nextAction: null };
  }
  let topMode = MODE_PRIORITY[0];
  let maxWrong = wrongByMode[topMode] || 0;
  MODE_PRIORITY.slice(1).forEach((mode) => {
    const wrong = wrongByMode[mode] || 0;
    if (wrong > maxWrong) {
      maxWrong = wrong;
      topMode = mode;
    }
  });
  return {
    topMode,
    message: MODE_MESSAGES[topMode] || '',
    nextAction: NEXT_ACTIONS[topMode] || null,
  };
};

export default buildReviewSummary;
