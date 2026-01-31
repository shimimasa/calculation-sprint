import domRefs from '../ui/domRefs.js';
import uiRenderer from '../ui/uiRenderer.js';
import screenManager from '../core/screenManager.js';
import gameState from '../core/gameState.js';
import timer from '../core/timer.js';
import questionGenerator from '../features/questionGenerator.js';

const gameScreen = {
  enter() {
    uiRenderer.showScreen('game');
    gameState.timeLeft = gameState.timeLimit;
    gameState.correctCount = 0;
    gameState.wrongCount = 0;
    gameState.totalAnswered = 0;
    uiRenderer.clearFeedback();
    this.feedbackTimeoutId = null;

    this.handleKeyDown = (event) => {
      if (event.key !== 'Enter') {
        return;
      }
      this.submitAnswer();
    };

    domRefs.game.answerInput.addEventListener('keydown', this.handleKeyDown);
    this.loadNextQuestion();
    this.startTimer();
    domRefs.game.answerInput.focus();
  },
  startTimer() {
    timer.start(() => {
      gameState.timeLeft = Math.max(0, gameState.timeLeft - 1);
      if (gameState.timeLeft <= 0) {
        timer.stop();
        screenManager.changeScreen('result');
      }
    });
  },
  loadNextQuestion() {
    gameState.currentQuestion = questionGenerator.next(gameState.settings);
    domRefs.game.answerInput.value = '';
  },
  submitAnswer() {
    const rawValue = domRefs.game.answerInput.value.trim();
    const answerValue = Number(rawValue);
    const isCorrect = Number.isFinite(answerValue)
      && gameState.currentQuestion
      && answerValue === gameState.currentQuestion.answer;

    gameState.totalAnswered += 1;
    if (isCorrect) {
      gameState.correctCount += 1;
      uiRenderer.setFeedback('◯', 'correct');
    } else {
      gameState.wrongCount += 1;
      uiRenderer.setFeedback(`× 正解: ${gameState.currentQuestion.answer}`, 'wrong');
    }

    if (this.feedbackTimeoutId) {
      window.clearTimeout(this.feedbackTimeoutId);
    }
    this.feedbackTimeoutId = window.setTimeout(() => {
      uiRenderer.clearFeedback();
    }, 500);

    this.loadNextQuestion();
    domRefs.game.answerInput.focus();
  },
  render() {
    if (gameState.currentQuestion) {
      domRefs.game.question.textContent = gameState.currentQuestion.text;
    }
    domRefs.game.timeLeft.textContent = String(gameState.timeLeft);
    domRefs.game.correctCount.textContent = String(gameState.correctCount);
  },
  exit() {
    timer.stop();
    if (this.handleKeyDown) {
      domRefs.game.answerInput.removeEventListener('keydown', this.handleKeyDown);
    }
    if (this.feedbackTimeoutId) {
      window.clearTimeout(this.feedbackTimeoutId);
    }
  },
};

export default gameScreen;
