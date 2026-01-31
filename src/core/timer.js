let intervalId = null;
let tickHandler = null;
let timeUpHandler = null;
let timeLeft = 0;
let hasTimeUpFired = false;

const timer = {
  start(durationSec, onTick, onTimeUp) {
    timer.stop();
    timeLeft = Math.max(0, Math.floor(Number(durationSec)));
    tickHandler = onTick;
    timeUpHandler = onTimeUp;
    hasTimeUpFired = false;

    if (timeLeft === 0) {
      if (typeof tickHandler === 'function') {
        tickHandler(0);
      }
      if (typeof timeUpHandler === 'function') {
        hasTimeUpFired = true;
        timeUpHandler();
      }
      return;
    }

    intervalId = window.setInterval(() => {
      timeLeft = Math.max(0, timeLeft - 1);
      if (typeof tickHandler === 'function') {
        tickHandler(timeLeft);
      }
      if (timeLeft <= 0) {
        timer.stop();
        if (!hasTimeUpFired && typeof timeUpHandler === 'function') {
          hasTimeUpFired = true;
          timeUpHandler();
        }
      }
    }, 1000);
  },
  stop() {
    if (intervalId !== null) {
      window.clearInterval(intervalId);
      intervalId = null;
    }
  },
  isRunning() {
    return intervalId !== null;
  },
};

export default timer;
