/** @typedef {'blockForYou' | 'blockReels' | 'blockExploreContents'} SwitchKey */

/** @type {readonly SwitchKey[]} */
export const SWITCH_KEYS = Object.freeze([
  'blockForYou',
  'blockReels',
  'blockExploreContents',
]);

/** @type {readonly string[]} */
export const SWITCH_LABELS = Object.freeze([
  'Block For you',
  'Block Reels',
  'Block Explore contents',
]);

/**
 * Missing or any value except explicit `false` means the switch is on.
 * @param {boolean | undefined} storedValue
 * @returns {boolean}
 */
export function isSwitchOn(storedValue) {
  return storedValue !== false;
}

/**
 * @param {Partial<Record<SwitchKey, boolean>>} stored
 * @returns {Record<SwitchKey, boolean>}
 */
export function readSwitches(stored) {
  return {
    blockForYou: isSwitchOn(stored.blockForYou),
    blockReels: isSwitchOn(stored.blockReels),
    blockExploreContents: isSwitchOn(stored.blockExploreContents),
  };
}

/**
 * @param {SwitchKey} key
 * @param {boolean} on
 * @returns {Partial<Record<SwitchKey, boolean>>}
 */
export function writeSwitch(key, on) {
  return on ? { [key]: true } : { [key]: false };
}
