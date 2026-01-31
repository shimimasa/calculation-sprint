let intervalId = null;
let tickHandler = null;

const timer = {
  start(onTick, intervalMs = 1000) {
    timer.stop();
    tickHandler = onTick;
    intervalId = window.setInterval(() => {
      if (typeof tickHandler === 'function') {
        tickHandler();
      }
    }, intervalMs);
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
