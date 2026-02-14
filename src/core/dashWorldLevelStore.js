import { getDashWorldLevel, toDashWorldKey } from '../features/dashWorldLevels.js';

let state = Object.freeze({
  worldKey: toDashWorldKey('plus'),
  levelId: 1,
});

const cloneState = () => ({ worldKey: state.worldKey, levelId: state.levelId });

const dashWorldLevelStore = {
  get() {
    return cloneState();
  },

  getSelectedWorldKey() {
    return state.worldKey;
  },
  setSelectedWorldKey(worldKey) {
    return this.save({ worldKey, levelId: state.levelId });
  },
  getSelectedLevelId() {
    return state.levelId;
  },
  setSelectedLevelId(levelId) {
    return this.save({ worldKey: state.worldKey, levelId });
  },
  save(nextState) {
    const worldLevel = getDashWorldLevel(nextState?.worldKey, nextState?.levelId);
    state = Object.freeze({
      worldKey: worldLevel.worldKey,
      levelId: worldLevel.levelId,
    });
    return cloneState();
  },
  setFromStageId(stageId) {
    return this.save({ worldKey: toDashWorldKey(stageId), levelId: 1 });
  },
};

export default dashWorldLevelStore;
