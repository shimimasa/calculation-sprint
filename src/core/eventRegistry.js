const createEventRegistry = (owner = 'unknown') => {
  let registry = new WeakMap();
  const entries = [];

  const hasRegistration = (target, type, handler) => {
    const typeMap = registry.get(target);
    if (!typeMap) {
      return false;
    }
    const handlers = typeMap.get(type);
    return Boolean(handlers && handlers.has(handler));
  };

  const rememberRegistration = (target, type, handler) => {
    let typeMap = registry.get(target);
    if (!typeMap) {
      typeMap = new Map();
      registry.set(target, typeMap);
    }
    let handlers = typeMap.get(type);
    if (!handlers) {
      handlers = new Set();
      typeMap.set(type, handlers);
    }
    handlers.add(handler);
  };

  const on = (target, type, handler, options) => {
    if (!target) {
      console.warn(`[eventRegistry] ${owner}: target missing for ${type}.`);
      return;
    }
    if (typeof handler !== 'function') {
      console.warn(`[eventRegistry] ${owner}: handler missing for ${type}.`);
      return;
    }
    if (hasRegistration(target, type, handler)) {
      return;
    }
    target.addEventListener(type, handler, options);
    rememberRegistration(target, type, handler);
    entries.push({ target, type, handler, options });
  };

  const clear = () => {
    entries.forEach(({ target, type, handler, options }) => {
      target.removeEventListener(type, handler, options);
    });
    entries.length = 0;
    registry = new WeakMap();
  };

  return { on, clear };
};

export { createEventRegistry };
