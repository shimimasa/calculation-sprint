const domRefs = {
  screens: {
    title: document.getElementById('title-screen'),
    settings: document.getElementById('settings-screen'),
    game: document.getElementById('game-screen'),
    result: document.getElementById('result-screen'),
  },
  title: {
    startButton: document.getElementById('title-start-button'),
  },
  settings: {
    modeInputs: document.querySelectorAll('input[name="mode"]'),
    digitInputs: document.querySelectorAll('input[name="digit"]'),
    carryCheckbox: document.getElementById('settings-carry'),
    playButton: document.getElementById('settings-play-button'),
  },
  game: {
    timeLeft: document.getElementById('game-time-left'),
    correctCount: document.getElementById('game-correct-count'),
    question: document.getElementById('game-question'),
    answerInput: document.getElementById('game-answer-input'),
    feedback: document.getElementById('game-feedback'),
  },
  result: {
    correctCount: document.getElementById('result-correct-count'),
    wrongCount: document.getElementById('result-wrong-count'),
    accuracy: document.getElementById('result-accuracy'),
    retryButton: document.getElementById('result-retry-button'),
    backButton: document.getElementById('result-back-button'),
  },
};

export default domRefs;
