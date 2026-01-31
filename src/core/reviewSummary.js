const MODE_PRIORITY = ['add', 'sub', 'mul', 'div'];

const MODE_MESSAGES = {
  add: '加算のミスが多め。まずは繰り上がりなしで正確に練習しよう。',
  sub: '減算のミスが多め。繰り下がりなし→ありの順で練習しよう。',
  mul: 'かけ算のミスが多め。九九をゆっくり確実に言えるか確認しよう。',
  div: 'わり算のミスが多め。『かけ算に戻す』確認を入れて練習しよう。',
};

const ZERO_MESSAGE = 'ミスが減ってきたね。次はスピードを意識しよう！';

const buildReviewSummary = (wrongByMode = {}, attemptByMode = {}, settings = {}) => {
  const totalWrong = MODE_PRIORITY.reduce(
    (sum, mode) => sum + (wrongByMode[mode] || 0),
    0,
  );
  if (totalWrong === 0) {
    return { topMode: null, message: ZERO_MESSAGE };
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
  };
};

export default buildReviewSummary;
