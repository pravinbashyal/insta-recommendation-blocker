import { SWITCH_KEYS, readSwitches, writeSwitch } from './switch-logic.js';

const storage = globalThis.chrome?.storage?.local ?? globalThis.browser?.storage?.local;

/**
 * @returns {Promise<import('./switch-logic.js').SwitchKey extends infer K ? Record<K, boolean> : never>}
 */
export async function loadSwitches() {
  const stored = await storage.get(SWITCH_KEYS);
  return readSwitches(stored);
}

/**
 * @param {import('./switch-logic.js').SwitchKey} key
 * @param {boolean} on
 * @returns {Promise<void>}
 */
export async function saveSwitch(key, on) {
  await storage.set(writeSwitch(key, on));
}

/**
 * @param {(switches: Record<import('./switch-logic.js').SwitchKey, boolean>) => void} listener
 * @returns {() => void}
 */
export function onSwitchesChanged(listener) {
  const api = globalThis.chrome ?? globalThis.browser;
  const handler = (changes, areaName) => {
    if (areaName !== 'local') {
      return;
    }
    const touched = SWITCH_KEYS.some((key) => key in changes);
    if (!touched) {
      return;
    }
    void loadSwitches().then(listener);
  };
  api.storage.onChanged.addListener(handler);
  return () => api.storage.onChanged.removeListener(handler);
}
