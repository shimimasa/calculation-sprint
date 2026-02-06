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

  const forgetRegistration = (target, type, handler) => {
    const typeMap = registry.get(target);
    if (!typeMap) {
      return;
    }
    const handlers = typeMap.get(type);
    if (!handlers) {
      return;
    }
    handlers.delete(handler);
    if (handlers.size === 0) {
      typeMap.delete(type);
    }
  };

  const on = (target, type, handler, options, meta) => {
    if (!target) {
      console.warn(`[eventRegistry] ${owner}: target missing for ${type}.`, { meta });
      return;
    }
    if (typeof handler !== 'function') {
      console.warn(`[eventRegistry] ${owner}: handler missing for ${type}.`, { meta });
      return;
    }
    if (hasRegistration(target, type, handler)) {
      console.warn(`[eventRegistry] ${owner}: duplicate listener ignored for ${type}.`, { meta });
      return;
    }
    target.addEventListener(type, handler, options);
    rememberRegistration(target, type, handler);
    entries.push({ target, type, handler, options, meta });
  };

  const clearTarget = (target) => {
    if (!target) {
      console.warn(`[eventRegistry] ${owner}: clearTarget called without target.`);
      return;
    }
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      const entry = entries[index];
      if (entry.target !== target) {
        continue;
      }
      entry.target.removeEventListener(entry.type, entry.handler, entry.options);
      forgetRegistration(entry.target, entry.type, entry.handler);
      entries.splice(index, 1);
    }
  };

  const clearAll = (scopeId = owner) => {
    entries.forEach(({ target, type, handler, options }) => {
      target.removeEventListener(type, handler, options);
    });
    entries.length = 0;
    registry = new WeakMap();
    if (scopeId && scopeId !== owner) {
      console.warn(`[eventRegistry] ${owner}: clearAll invoked for ${scopeId}.`);
    }
  };

  const clear = () => {
    clearAll();
  };

  return {
    on,
    clear,
    clearAll,
    clearTarget,
  };
};

export { createEventRegistry };
