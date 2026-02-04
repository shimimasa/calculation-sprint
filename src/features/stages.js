import { PRESETS } from './presets.js';

const STAGE_ORDER = ['p3-basic', 'p4-nocarry', 'p4-carry', 'p5-mul'];

export const STAGES = STAGE_ORDER.map((id, index) => {
  const preset = PRESETS[id];
  return {
    id,
    order: index + 1,
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

export const applyStageSettings = (stage, state) => {
  if (!stage || !state) {
    return;
  }
  state.settings.mode = stage.settings.mode;
  state.settings.digit = stage.settings.digit;
  state.settings.carry = stage.settings.carry;
};
