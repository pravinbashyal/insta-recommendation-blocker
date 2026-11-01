(function () {
  'use strict';

  var SWITCH_KEYS = ['blockForYou', 'blockReels', 'blockExploreContents'];

  /** @type {Record<string, boolean> | null} */
  var pendingSwitches = null;

  function isSwitchOn(storedValue) {
    return storedValue !== false;
  }

  function readSwitches(stored) {
    return {
      blockForYou: isSwitchOn(stored.blockForYou),
      blockReels: isSwitchOn(stored.blockReels),
      blockExploreContents: isSwitchOn(stored.blockExploreContents),
    };
  }

  var storageApi = globalThis.chrome || globalThis.browser;
  var storage = storageApi.storage.local;

  function loadSwitches() {
    return storage.get(SWITCH_KEYS).then(readSwitches);
  }

  function writeDataset(root, switches) {
    root.dataset.irbBlockForYou = String(switches.blockForYou);
    root.dataset.irbBlockReels = String(switches.blockReels);
    root.dataset.irbBlockExploreContents = String(switches.blockExploreContents);
  }

  function applyHomeForYouBlock(switches) {
    var home = globalThis.__IRB_HOME_FOR_YOU__;
    if (home && typeof home.applySwitchesFromStorage === 'function') {
      home.applySwitchesFromStorage(switches);
      return;
    }
    if (home && typeof home.setBlockForYou === 'function') {
      home.setBlockForYou(switches.blockForYou);
    }
  }

  function applySwitchesToDocument(switches) {
    var root = document.documentElement;
    if (!root) {
      pendingSwitches = switches;
      return;
    }
    pendingSwitches = null;
    writeDataset(root, switches);
    applyHomeForYouBlock(switches);
  }

  function flushPendingSwitches() {
    if (pendingSwitches && document.documentElement) {
      var switches = pendingSwitches;
      pendingSwitches = null;
      writeDataset(document.documentElement, switches);
      applyHomeForYouBlock(switches);
    }
  }

  function watchForDocumentElement() {
    flushPendingSwitches();
    if (document.documentElement) {
      return;
    }

    document.addEventListener('readystatechange', flushPendingSwitches);

    if (typeof MutationObserver !== 'undefined') {
      var observer = new MutationObserver(flushPendingSwitches);
      observer.observe(document, { childList: true, subtree: true });
    }
  }

  function onSwitchesChanged(listener) {
    storageApi.storage.onChanged.addListener(function (changes, areaName) {
      if (areaName !== 'local') {
        return;
      }
      var touched = SWITCH_KEYS.some(function (key) {
        return Object.prototype.hasOwnProperty.call(changes, key);
      });
      if (!touched) {
        return;
      }
      loadSwitches().then(listener);
    });
  }

  watchForDocumentElement();
  loadSwitches().then(applySwitchesToDocument);
  onSwitchesChanged(applySwitchesToDocument);
})();
