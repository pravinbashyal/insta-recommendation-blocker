import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

import {
  SWITCH_KEYS,
  SWITCH_LABELS,
  isSwitchOn,
  readSwitches,
} from '../extension/lib/switch-logic.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionDir = path.join(__dirname, '..', 'extension');
const manifestPath = path.join(extensionDir, 'manifest.json');
const contentScriptPath = path.join(extensionDir, 'content', 'content.js');

function assertManifest() {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ['storage']);
  assert.deepEqual(manifest.host_permissions, ['*://*.instagram.com/*']);
  assert.ok(manifest.browser_specific_settings?.gecko?.id);
  assert.ok(manifest.browser_specific_settings?.gecko?.strict_min_version);

  const forbidden = [
    'tabs',
    'scripting',
    'activeTab',
    'webNavigation',
    'declarativeNetRequest',
    'cookies',
    'history',
  ];
  for (const perm of forbidden) {
    assert.ok(!manifest.permissions?.includes(perm), `unexpected permission: ${perm}`);
  }

  const allHosts = [
    ...(manifest.host_permissions ?? []),
    ...(manifest.optional_host_permissions ?? []),
    ...(manifest.content_scripts ?? []).flatMap((entry) => entry.matches ?? []),
  ];
  for (const host of allHosts) {
    assert.equal(host, '*://*.instagram.com/*', `unexpected host/match: ${host}`);
  }

  const script = manifest.content_scripts?.[0];
  assert.equal(script.run_at, 'document_start');
  assert.deepEqual(script.matches, ['*://*.instagram.com/*']);
  assert.ok(
    script.type === undefined || script.type !== 'module',
    'content script must not use type module',
  );
}

function assertContentScriptIsClassic() {
  const src = fs.readFileSync(contentScriptPath, 'utf8');
  assert.doesNotMatch(src, /^\s*import\s/m, 'content script must not use import');
  assert.doesNotMatch(src, /^\s*export\s/m, 'content script must not use export');
  assert.match(src, /onChanged\.addListener/, 'content script must subscribe to storage');
}

function assertPopupLabels() {
  const popupHtml = fs.readFileSync(
    path.join(extensionDir, 'popup', 'popup.html'),
    'utf8',
  );
  assert.match(popupHtml, /popup\.js/);
  assert.deepEqual(SWITCH_LABELS, [
    'Block For you',
    'Block Reels',
    'Block Explore contents',
  ]);
  const popupJs = fs.readFileSync(path.join(extensionDir, 'popup', 'popup.js'), 'utf8');
  for (const label of SWITCH_LABELS) {
    assert.ok(popupJs.includes(label) || popupJs.includes('SWITCH_LABELS'));
  }
}

function assertMissingKeyMeansOn() {
  assert.equal(isSwitchOn(undefined), true);
  assert.equal(isSwitchOn(true), true);
  assert.equal(isSwitchOn(false), false);

  const allOn = readSwitches({});
  for (const key of SWITCH_KEYS) {
    assert.equal(allOn[key], true, `${key} should default on`);
  }

  const partial = readSwitches({ blockReels: false });
  assert.equal(partial.blockForYou, true);
  assert.equal(partial.blockReels, false);
  assert.equal(partial.blockExploreContents, true);
}

/** Simulates chrome.storage.local + onChanged for popup-side storage helpers. */
async function assertOpenTabStorageListener() {
  /** @type {Record<string, unknown>} */
  let store = {};
  /** @type {Array<(changes: object, area: string) => void>} */
  const listeners = [];

  const storage = {
    async get(keys) {
      /** @type {Record<string, unknown>} */
      const out = {};
      for (const key of keys) {
        if (key in store) {
          out[key] = store[key];
        }
      }
      return out;
    },
    async set(partial) {
      /** @type {Record<string, { oldValue?: unknown, newValue: unknown }>} */
      const changes = {};
      for (const [key, value] of Object.entries(partial)) {
        changes[key] = { oldValue: store[key], newValue: value };
        store[key] = value;
      }
      for (const listener of listeners) {
        listener(changes, 'local');
      }
    },
  };

  const chromeMock = {
    storage: {
      local: storage,
      onChanged: {
        addListener(fn) {
          listeners.push(fn);
        },
        removeListener(fn) {
          const idx = listeners.indexOf(fn);
          if (idx >= 0) {
            listeners.splice(idx, 1);
          }
        },
      },
    },
  };

  globalThis.chrome = chromeMock;

  const { loadSwitches, onSwitchesChanged, saveSwitch } = await import(
    '../extension/lib/browser-storage.js'
  );

  const seen = [];
  onSwitchesChanged((switches) => {
    seen.push({ ...switches });
  });

  const initial = await loadSwitches();
  assert.deepEqual(initial, readSwitches({}));

  await saveSwitch('blockForYou', false);

  assert.equal(seen.length, 1);
  assert.equal(seen[0].blockForYou, false);
  assert.equal(seen[0].blockReels, true);
  assert.equal(seen[0].blockExploreContents, true);

  const afterRestart = await loadSwitches();
  assert.equal(afterRestart.blockForYou, false);
  assert.equal(afterRestart.blockReels, true);

  delete globalThis.chrome;
}

/** Loads extension/content/content.js like Chromium (classic script) on an open tab. */
async function assertContentScriptOnOpenTab() {
  /** @type {Record<string, unknown>} */
  let store = {};
  /** @type {Array<(changes: object, area: string) => void>} */
  const listeners = [];

  const storage = {
    get(keys) {
      return Promise.resolve(
        keys.reduce((out, key) => {
          if (key in store) {
            out[key] = store[key];
          }
          return out;
        }, {}),
      );
    },
    set(partial) {
      /** @type {Record<string, { oldValue?: unknown, newValue: unknown }>} */
      const changes = {};
      for (const [key, value] of Object.entries(partial)) {
        changes[key] = { oldValue: store[key], newValue: value };
        store[key] = value;
      }
      for (const listener of listeners) {
        listener(changes, 'local');
      }
      return Promise.resolve();
    },
  };

  const html = { dataset: {} };
  /** @type {Record<string, Array<() => void>>} */
  const eventHandlers = { readystatechange: [] };

  const documentMock = {
    documentElement: null,
    readyState: 'loading',
    addEventListener(type, handler) {
      (eventHandlers[type] ??= []).push(handler);
    },
    removeEventListener(type, handler) {
      const list = eventHandlers[type];
      if (!list) {
        return;
      }
      const idx = list.indexOf(handler);
      if (idx >= 0) {
        list.splice(idx, 1);
      }
    },
  };

  class MutationObserverMock {
    /** @param {() => void} callback */
    constructor(callback) {
      this.callback = callback;
    }

    observe() {}

    disconnect() {}

    trigger() {
      this.callback();
    }
  }

  const observerInstances = [];
  MutationObserverMock.prototype.observe = function observe() {
    observerInstances.push(this);
  };

  const chromeMock = {
    storage: {
      local: storage,
      onChanged: {
        addListener(fn) {
          listeners.push(fn);
        },
      },
    },
  };

  const sandbox = {
    chrome: chromeMock,
    browser: undefined,
    document: documentMock,
    MutationObserver: MutationObserverMock,
    console,
  };
  sandbox.globalThis = sandbox;

  vm.createContext(sandbox);
  const contentSrc = fs.readFileSync(contentScriptPath, 'utf8');
  assert.doesNotThrow(() => {
    vm.runInContext(contentSrc, sandbox, { filename: 'content/content.js' });
  });

  for (let i = 0; i < 8; i += 1) {
    await Promise.resolve();
  }

  documentMock.documentElement = html;
  for (const handler of [...(eventHandlers.readystatechange ?? [])]) {
    handler();
  }
  for (const observer of observerInstances) {
    observer.trigger();
  }

  assert.equal(html.dataset.irbBlockForYou, 'true');
  assert.equal(html.dataset.irbBlockReels, 'true');
  assert.equal(html.dataset.irbBlockExploreContents, 'true');

  await storage.set({ blockReels: false });
  await Promise.resolve();

  assert.equal(html.dataset.irbBlockReels, 'false');
  assert.equal(html.dataset.irbBlockForYou, 'true');
}

assertManifest();
assertContentScriptIsClassic();
assertPopupLabels();
assertMissingKeyMeansOn();
await assertOpenTabStorageListener();
await assertContentScriptOnOpenTab();

console.log('task-1.1-verify: all checks passed');
