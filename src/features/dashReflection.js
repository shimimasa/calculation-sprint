import { getDashStageLevels, normalizeDashStageId } from './dashStages.js';

const QUESTION_MODES = Object.freeze(['add', 'sub', 'mul', 'div']);

const MODE_LABELS = Object.freeze({
  add: 'たしざん',
  sub: 'ひきざん',
  mul: 'かけざん',
  div: 'わりざん',
});

// レガシー reviewSummary.js の練習提案を Dash の文体に移植したもの。
const MODE_ADVICE = Object.freeze({
  add: 'くりあがりなしから ゆっくりれんしゅうしてみよう。',
  sub: 'くりさがりなし→ありの じゅんばんで れんしゅうしてみよう。',
  mul: '九九を ゆっくり たしかめてみよう。',
  div: '「かけざんに もどす」かくにんを してみよう。',
});

export const createEmptyWrongByMode = () => ({ add: 0, sub: 0, mul: 0, div: 0 });

export const normalizeWrongByMode = (raw) => {
  const normalized = createEmptyWrongByMode();
  if (!raw || typeof raw !== 'object') {
    return normalized;
  }
  QUESTION_MODES.forEach((mode) => {
    const value = Number(raw[mode]);
    normalized[mode] = Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  });
  return normalized;
};

export const sumWrongByMode = (entries) => {
  const total = createEmptyWrongByMode();
  (Array.isArray(entries) ? entries : []).forEach((entry) => {
    const normalized = normalizeWrongByMode(entry);
    QUESTION_MODES.forEach((mode) => {
      total[mode] += normalized[mode];
    });
  });
  return total;
};

const pickTopWrongMode = (wrongByMode) => {
  let topMode = null;
  let topCount = 0;
  QUESTION_MODES.forEach((mode) => {
    if (wrongByMode[mode] > topCount) {
      topMode = mode;
      topCount = wrongByMode[mode];
    }
  });
  return topMode ? { mode: topMode, count: topCount } : null;
};

/**
 * 「きょうのふりかえり」の本文行を組み立てる。
 * 行が空配列のときはカード自体を出さない。
 */
export const buildDashReflectionLines = ({
  todayWrongByMode,
  totalAnswered = 0,
  revengeSuccessCount = 0,
}) => {
  if (!Number.isFinite(totalAnswered) || totalAnswered <= 0) {
    return [];
  }
  const lines = [];
  const wrongByMode = normalizeWrongByMode(todayWrongByMode);
  const top = pickTopWrongMode(wrongByMode);
  if (!top) {
    lines.push('きょうのミスは 0！すばらしい！');
  } else {
    lines.push(`きょうは ${MODE_LABELS[top.mode]}で ${top.count}回 まちがえたよ。${MODE_ADVICE[top.mode]}`);
  }
  if (Number.isFinite(revengeSuccessCount) && revengeSuccessCount > 0) {
    lines.push(`リベンジせいこう ${Math.floor(revengeSuccessCount)}回！まちがいを そのままにしなかったね。`);
  }
  return lines;
};

/**
 * つぎのおすすめ(レベル推薦)。自動でレベルを変えることはせず、提案だけを返す。
 */
export const buildNextLevelRecommendation = ({
  stageId,
  levelId,
  accuracy = 0,
  hits = 0,
  totalAnswered = 0,
}) => {
  const normalizedStageId = normalizeDashStageId(stageId);
  const level = Number(levelId);
  if (!normalizedStageId || !Number.isInteger(level) || level < 1 || totalAnswered <= 0) {
    return null;
  }
  const levels = getDashStageLevels(normalizedStageId);
  const maxLevel = levels[levels.length - 1] ?? 1;
  if (accuracy >= 95 && hits <= 1) {
    if (level < maxLevel) {
      return `せいかいりつ${accuracy.toFixed(0)}%！つぎは Lv${level + 1}に ちょうせんしてみよう！`;
    }
    return 'このレベルは バッチリ！べつのステージにも ちょうせんしてみよう！';
  }
  if (accuracy < 60 && level > 1) {
    return `Lv${level - 1}で スピードアップをねらうのも アリだよ！`;
  }
  return 'このレベルを もういちど。せいかいりつ95%を めざそう！';
};

export default {
  createEmptyWrongByMode,
  normalizeWrongByMode,
  sumWrongByMode,
  buildDashReflectionLines,
  buildNextLevelRecommendation,
};
