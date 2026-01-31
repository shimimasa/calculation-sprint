const gameState = {
  timeLimit: 60,
  timeLeft: 60,
  currentQuestion: null,
  correctCount: 0,
  wrongCount: 0,
  totalAnswered: 0,
  totalAnswerTimeMs: 0,
  questionStartAtMs: 0,
  answeredCountForTiming: 0,
  settings: {
    mode: 'add',
    digit: 1,
    carry: false,
  },
};

export default gameState;
