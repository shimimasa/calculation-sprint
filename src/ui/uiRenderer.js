import domRefs from './domRefs.js';

const uiRenderer = {
  showScreen(name) {
    Object.entries(domRefs.screens).forEach(([key, screen]) => {
      if (!screen) {
        return;
      }
      screen.classList.toggle('is-active', key === name);
    });
  },
  setFeedback(message, type = 'correct') {
    domRefs.game.feedback.textContent = message;
    domRefs.game.feedback.classList.remove('is-correct', 'is-wrong');
    if (type === 'correct') {
      domRefs.game.feedback.classList.add('is-correct');
    } else if (type === 'wrong') {
      domRefs.game.feedback.classList.add('is-wrong');
    }
  },
  clearFeedback() {
    domRefs.game.feedback.textContent = '';
    domRefs.game.feedback.classList.remove('is-correct', 'is-wrong');
  },
};

export default uiRenderer;
