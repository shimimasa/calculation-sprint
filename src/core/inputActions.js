const ACTIONS = Object.freeze({
  SUBMIT: 'submit',
  BACK: 'back',
  NEXT: 'next',
  TOGGLE_KEYPAD: 'toggle_keypad',
});

const listeners = new Map(
  Object.values(ACTIONS).map((action) => [action, new Set()]),
);

const on = (action, handler) => {
  if (!listeners.has(action)) {
    listeners.set(action, new Set());
  }
  listeners.get(action).add(handler);
};

const off = (action, handler) => {
  const bucket = listeners.get(action);
  if (!bucket) {
    return;
  }
  bucket.delete(handler);
};

const dispatch = (action, payload = {}) => {
  const bucket = listeners.get(action);
  if (!bucket) {
    return;
  }
  bucket.forEach((handler) => handler({ action, ...payload }));
};

const createKeyHandler = (
  keyMap = {
    Enter: ACTIONS.SUBMIT,
    ' ': ACTIONS.NEXT,
    Spacebar: ACTIONS.NEXT,
    ArrowRight: ACTIONS.NEXT,
  },
) => (event) => {
  const action = keyMap[event.key];
  if (!action) {
    return;
  }
  event.preventDefault();
  dispatch(action, { source: 'keyboard', event });
};

const inputActions = {
  ACTIONS,
  on,
  off,
  dispatch,
  createKeyHandler,
};

export { ACTIONS };
export default inputActions;
