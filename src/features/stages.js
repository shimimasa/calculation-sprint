import { PRESETS } from './presets.js';

const STAGE_DEFINITIONS = [
  {
    id: 'w1-1',
    unlock: 'always',
    themeId: 'w1',
    bgThemeId: 'bg_add',
    bgmId: 'bgm_add',
    label: '🟢 ひとけたプラス',
    description: 'ねらい: 1けたのたし算 / くり上がりなし',
    settings: { mode: 'add', digit: 1, carry: false },
  },
  {
    id: 'w1-2',
    unlock: { clear: 'w1-1' },
    themeId: 'w1',
    bgThemeId: 'bg_add',
    bgmId: 'bgm_add',
    label: '🟢 ひとけたプラス+',
    description: 'ねらい: 1けたのたし算 / くり上がりあり',
    settings: { mode: 'add', digit: 1, carry: true },
  },
  {
    id: 'w1-3',
    unlock: { clear: 'w1-2' },
    themeId: 'w1',
    bgThemeId: 'bg_add',
    bgmId: 'bgm_add',
    label: '🔵 ふたけたプラス',
    description: 'ねらい: 2けたのたし算 / くり上がりなし',
    settings: { mode: 'add', digit: 2, carry: false },
  },
  {
    id: 'w1-4',
    unlock: { clear: 'w1-3' },
    themeId: 'w1',
    bgThemeId: 'bg_add',
    bgmId: 'bgm_add',
    label: '🔵 ふたけたプラス+',
    description: 'ねらい: 2けたのたし算 / くり上がりあり',
    settings: { mode: 'add', digit: 2, carry: true },
  },
  {
    id: 'w2-1',
    unlock: { clear: 'w1-4' },
    themeId: 'w2',
    bgThemeId: 'bg_sub',
    bgmId: 'bgm_sub',
    label: '🟢 ひとけたマイナス',
    description: 'ねらい: 1けたのひき算 / くり下がりなし',
    settings: { mode: 'sub', digit: 1, carry: false },
  },
  {
    id: 'w2-2',
    unlock: { clear: 'w2-1' },
    themeId: 'w2',
    bgThemeId: 'bg_sub',
    bgmId: 'bgm_sub',
    label: '🟢 ひとけたマイナス+',
    description: 'ねらい: 1けたのひき算 / くり下がりあり',
    settings: { mode: 'sub', digit: 1, carry: true },
  },
  {
    id: 'w2-3',
    unlock: { clear: 'w2-2' },
    themeId: 'w2',
    bgThemeId: 'bg_sub',
    bgmId: 'bgm_sub',
    label: '🔵 ふたけたマイナス',
    description: 'ねらい: 2けたのひき算 / くり下がりなし',
    settings: { mode: 'sub', digit: 2, carry: false },
  },
  {
    id: 'w2-4',
    unlock: { clear: 'w2-3' },
    themeId: 'w2',
    bgThemeId: 'bg_sub',
    bgmId: 'bgm_sub',
    label: '🔵 ふたけたマイナス+',
    description: 'ねらい: 2けたのひき算 / くり下がりあり',
    settings: { mode: 'sub', digit: 2, carry: true },
  },
  {
    id: 'w3-1',
    unlock: { clear: 'w2-4' },
    themeId: 'w3',
    bgThemeId: 'bg_mul',
    bgmId: 'bgm_mul',
    label: '🟣 かけ算チャレンジ',
    description: 'ねらい: 1けたのかけ算 / 九九に慣れる',
    settings: { mode: 'mul', digit: 1, carry: true },
  },
  {
    id: 'w4-1',
    unlock: { clear: 'w3-1' },
    themeId: 'w4',
    bgThemeId: 'bg_div',
    bgmId: 'bgm_div',
    label: '🟡 わり算スターター',
    description: 'ねらい: 1けたのわり算 / きれいな割り算',
    settings: { mode: 'div', digit: 1, carry: true },
  },
  {
    id: 'w4-2',
    unlock: { clear: 'w4-1' },
    themeId: 'w4',
    bgThemeId: 'bg_div',
    bgmId: 'bgm_div',
    label: '🟡 わり算ステップ',
    description: 'ねらい: 2けたのわり算 / ちょっと挑戦',
    settings: { mode: 'div', digit: 2, carry: true },
  },
  {
    id: 'w5-1',
    unlock: { clear: 'w4-2' },
    themeId: 'w5',
    bgThemeId: 'bg_mix',
    bgmId: 'bgm_mix',
    label: '🟠 ミックス初級',
    description: 'ねらい: たし算・ひき算ミックス / 1けた中心',
    settings: { mode: 'mix', digit: 1, carry: false, allowedModes: ['add', 'sub'] },
  },
  {
    id: 'w5-2',
    unlock: { clear: 'w5-1' },
    themeId: 'w5',
    bgThemeId: 'bg_mix',
    bgmId: 'bgm_mix',
    label: '🟠 ミックス中級',
    description: 'ねらい: 4種類ミックス / 2けた中心',
    settings: {
      mode: 'mix',
      digit: 2,
      carry: true,
      allowedModes: ['add', 'sub', 'mul', 'div'],
    },
  },
];

const getWorldId = (stageId) => stageId.split('-')[0] ?? 'world';

export const STAGES = STAGE_DEFINITIONS.map((definition, index) => {
  const preset = PRESETS[definition.presetKey];
  const worldId = getWorldId(definition.id);
  const bgThemeId = definition.bgThemeId ?? worldId;
  const bgmId = definition.bgmId ?? worldId;
  const label = definition.label ?? preset?.label ?? `ステージ${index + 1}`;
  const description = definition.description ?? preset?.description ?? '';
  const resolvedSettings = {
    mode: definition.settings?.mode ?? preset?.mode ?? 'add',
    digit: definition.settings?.digit ?? preset?.digit ?? 1,
    carry: definition.settings?.carry ?? preset?.carry ?? false,
    allowedModes: definition.settings?.allowedModes ?? preset?.allowedModes ?? null,
  };
  return {
    id: definition.id,
    order: index + 1,
    worldId,
    themeId: definition.themeId ?? worldId,
    theme: {
      bgThemeId,
      bgmId,
    },
    unlock: definition.unlock,
    label,
    description,
    settings: resolvedSettings,
  };
});

export const findStageById = (stageId) => STAGES.find((stage) => stage.id === stageId) ?? null;

export const getNextStage = (stageId) => {
  const currentIndex = STAGES.findIndex((stage) => stage.id === stageId);
  if (currentIndex === -1) {
    return null;
  }
  return STAGES[currentIndex + 1] ?? null;
};

export const isStageUnlocked = (stage, progress) => {
  if (!stage) {
    return false;
  }
  if (stage.unlock === 'always') {
    return true;
  }
  const unlockClearId = stage.unlock?.clear;
  if (!unlockClearId) {
    return false;
  }
  return progress?.clearedStageIds?.includes(unlockClearId);
};

export const applyStageSettings = (stage, state) => {
  if (!stage || !state) {
    return;
  }
  state.settings.mode = stage.settings.mode;
  state.settings.digit = stage.settings.digit;
  state.settings.carry = stage.settings.carry;
  state.settings.allowedModes = stage.settings.allowedModes ?? null;
};
