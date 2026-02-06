import domRefs from '../ui/domRefs.js';
import uiRenderer from '../ui/uiRenderer.js';
import screenManager from '../core/screenManager.js';
import audioManager from '../core/audioManager.js';
import { createEventRegistry } from '../core/eventRegistry.js';
import gameState from '../core/gameState.js';
import dashStatsStore from '../core/dashStatsStore.js';

const dashResultScreen = {
  enter() {
    uiRenderer.showScreen('dash-result');
    this.events = createEventRegistry('dash-result');
    const result = gameState.dash?.result;
    if (result && typeof result === 'object') {
      const totalAnswered = (result.correctCount || 0) + (result.wrongCount || 0);
      const accuracy = totalAnswered > 0
        ? Math.round((result.correctCount / totalAnswered) * 1000) / 10
        : 0;
      const timeSeconds = Math.max(0, Math.ceil((result.timeLeftMs || 0) / 1000));
      if (domRefs.dashResult.record) {
        domRefs.dashResult.record.hidden = false;
      }
      if (domRefs.dashResult.message) {
        domRefs.dashResult.message.hidden = true;
      }
      if (domRefs.dashResult.distance) {
        domRefs.dashResult.distance.textContent = Number.isFinite(result.distanceM)
          ? result.distanceM.toFixed(1)
          : '0.0';
      }
      if (domRefs.dashResult.correctCount) {
        domRefs.dashResult.correctCount.textContent = String(result.correctCount || 0);
      }
      if (domRefs.dashResult.wrongCount) {
        domRefs.dashResult.wrongCount.textContent = String(result.wrongCount || 0);
      }
      if (domRefs.dashResult.accuracy) {
        domRefs.dashResult.accuracy.textContent = accuracy.toFixed(1);
      }
      if (domRefs.dashResult.maxStreak) {
        domRefs.dashResult.maxStreak.textContent = String(result.maxStreak || 0);
      }
      if (domRefs.dashResult.timeRemaining) {
        domRefs.dashResult.timeRemaining.textContent = String(timeSeconds);
      }
      dashStatsStore.saveSession(result);
    } else {
      if (domRefs.dashResult.record) {
        domRefs.dashResult.record.hidden = true;
      }
      if (domRefs.dashResult.message) {
        domRefs.dashResult.message.hidden = false;
      }
    }
    this.handleBack = () => {
      audioManager.playSfx('sfx_cancel');
      screenManager.changeScreen('title');
    };
    this.events.on(domRefs.dashResult.backButton, 'click', this.handleBack);
  },
  render() {},
  exit() {
    this.events?.clear();
    this.events = null;
  },
};

export default dashResultScreen;
