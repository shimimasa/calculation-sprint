import { PRESETS } from './presets.js';

const STAGE_DEFINITIONS = [
  { id: 'w1-1', presetKey: 'p3-basic', unlock: 'always' },
  { id: 'w1-2', presetKey: 'p4-nocarry', unlock: { clear: 'w1-1' } },
  { id: 'w1-3', presetKey: 'p4-carry', unlock: { clear: 'w1-2' } },
  { id: 'w1-4', presetKey: 'p5-mul', unlock: { clear: 'w1-3' } },
];

export const STAGES = STAGE_DEFINITIONS.map((definition, index) => {
  const preset = PRESETS[definition.presetKey];
  return {
    id: definition.id,
    order: index + 1,
    unlock: definition.unlock,
    label: preset?.label ?? `ステージ${index + 1}`,
    description: preset?.description ?? '',
    settings: {
      mode: preset?.mode ?? 'add',
      digit: preset?.digit ?? 1,
      carry: preset?.carry ?? false,
    },
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
};
