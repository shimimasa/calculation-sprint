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
    presetSelect: document.getElementById('settings-preset'),
    modeInputs: document.querySelectorAll('input[name="mode"]'),
    digitInputs: document.querySelectorAll('input[name="digit"]'),
    carryCheckbox: document.getElementById('settings-carry'),
    playButton: document.getElementById('settings-play-button'),
  },
  game: {
    timeLeft: document.getElementById('game-time-left'),
    correctCount: document.getElementById('game-correct-count'),
    wrongCount: document.getElementById('game-wrong-count'),
    question: document.getElementById('game-question'),
    answerInput: document.getElementById('game-answer-input'),
    feedback: document.getElementById('game-feedback'),
  },
  result: {
    correctCount: document.getElementById('result-correct-count'),
    wrongCount: document.getElementById('result-wrong-count'),
    totalAnswered: document.getElementById('result-total-answered'),
    accuracy: document.getElementById('result-accuracy'),
    avgTime: document.getElementById('result-avg-time'),
    wrongAdd: document.getElementById('result-wrong-add'),
    wrongSub: document.getElementById('result-wrong-sub'),
    wrongMul: document.getElementById('result-wrong-mul'),
    wrongDiv: document.getElementById('result-wrong-div'),
    retryButton: document.getElementById('result-retry-button'),
    backButton: document.getElementById('result-back-button'),
  },
};

export default domRefs;
