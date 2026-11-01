import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

import { JSDOM } from 'jsdom';

import {
  buildFollowingSearch,
  canonicalHomeFollowingHref,
  findForYouTab,
  getVariant,
  isHomeRoute,
  needsFollowingVariant,
} from '../extension/lib/home-for-you-block.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionDir = path.join(__dirname, '..', 'extension');
const fixtureDir = path.join(__dirname, 'fixtures', 'home');
const homeScriptPath = path.join(extensionDir, 'content', 'home-for-you-block.js');
const contentScriptPath = path.join(extensionDir, 'content', 'content.js');
const manifestPath = path.join(extensionDir, 'manifest.json');

/** @type {Array<{ dom: import('jsdom').JSDOM, api?: { teardown?: () => void } }>} */
const openDomSessions = [];

function readFixture(name) {
  return fs.readFileSync(path.join(fixtureDir, name), 'utf8');
}

function createStorageMock(initialStore = {}) {
  /** @type {Record<string, unknown>} */
  const store = { ...initialStore };
  /** @type {Array<(changes: object, area: string) => void>} */
  const listeners = [];
  let getGate = Promise.resolve();
  /** @type {(() => void) | null} */
  let releaseGetGate = null;

  const storage = {
    blockGet() {
      getGate = new Promise((resolve) => {
        releaseGetGate = resolve;
      });
    },
    unblockGet() {
      if (releaseGetGate) {
        releaseGetGate();
        releaseGetGate = null;
      }
      getGate = Promise.resolve();
    },
    get(keys) {
      return getGate.then(() =>
        keys.reduce((out, key) => {
          if (key in store) {
            out[key] = store[key];
          }
          return out;
        }, {}),
      );
    },
    set(partial, callback) {
      const changes = {};
      for (const [key, value] of Object.entries(partial)) {
        changes[key] = { oldValue: store[key], newValue: value };
        store[key] = value;
      }
      for (const listener of listeners) {
        listener(changes, 'local');
      }
      const done = Promise.resolve();
      if (typeof callback === 'function') {
        done.then(() => callback());
      }
      return done;
    },
    remove(keys) {
      for (const key of keys) {
        delete store[key];
      }
      return Promise.resolve();
    },
    snapshot() {
      return { ...store };
    },
  };

  return {
    store,
    storage,
    chrome: {
      storage: {
        local: storage,
        onChanged: { addListener(fn) { listeners.push(fn); } },
      },
    },
  };
}

async function settle() {
  for (let i = 0; i < 12; i += 1) {
    await Promise.resolve();
  }
}

/**
 * @param {Window} window
 * @param {(url: string) => void} handler
 */
function installWwwHomeNavigation(window, handler) {
  window.__IRB_NAVIGATE_WWW_HOME__ = handler;
}

async function applySwitches(window, switches) {
  window.__IRB_HOME_FOR_YOU__.applySwitchesFromStorage(switches);
  await settle();
}

function assertManifestLoadsHomeScriptFirst() {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const scripts = manifest.content_scripts[0].js;
  assert.equal(scripts[0], 'content/home-for-you-block.js');
  assert.equal(scripts[1], 'content/reels-viewer-block.js');
  assert.equal(scripts[2], 'content/explore-discovery-block.js');
  assert.equal(scripts[3], 'content/content.js');
}

function assertPureUrlHelpers() {
  assert.equal(needsFollowingVariant(true, ''), true);
  assert.equal(needsFollowingVariant(true, '?hl=en'), true);
  assert.equal(needsFollowingVariant(true, '?variant=following'), false);
  assert.equal(needsFollowingVariant(true, '?variant=favorites'), false);
  assert.equal(needsFollowingVariant(false, ''), false);

  assert.equal(buildFollowingSearch('?hl=en'), '?hl=en&variant=following');
  assert.equal(
    canonicalHomeFollowingHref('https://instagram.com/?hl=en'),
    'https://www.instagram.com/?hl=en&variant=following',
  );
  assert.equal(
    canonicalHomeFollowingHref('https://www.instagram.com'),
    'https://www.instagram.com/?variant=following',
  );

  assert.equal(isHomeRoute({ hostname: 'www.instagram.com', pathname: '/' }), true);
  assert.equal(isHomeRoute({ hostname: 'instagram.com', pathname: '/' }), true);
  assert.equal(isHomeRoute({ hostname: 'www.instagram.com', pathname: '/explore/' }), false);
}

/**
 * @param {string} html
 * @param {string} href
 */
function createSession(html, href, { chrome } = {}) {
  const dom = new JSDOM(html, {
    url: href,
    pretendToBeVisual: true,
    runScripts: 'outside-only',
  });

  const { window } = dom;
  if (chrome) {
    window.chrome = chrome;
  }
  installWwwHomeNavigation(window, (url) => {
    dom.reconfigure({ url: String(url) });
  });

  window.eval(`${fs.readFileSync(homeScriptPath, 'utf8')}\n//# sourceURL=home-for-you-block.js`);

  const api = window.__IRB_HOME_FOR_YOU__;
  assert.ok(api, 'home script must expose __IRB_HOME_FOR_YOU__');

  openDomSessions.push({ dom, api });
  return { window, api, dom };
}

function bootContentSession(html, href, storageBundle) {
  const dom = new JSDOM(html, {
    url: href,
    pretendToBeVisual: true,
    runScripts: 'outside-only',
  });
  const { window } = dom;
  window.chrome = storageBundle.chrome;
  window.eval(`${fs.readFileSync(homeScriptPath, 'utf8')}\n//# sourceURL=home-for-you-block.js`);
  window.eval(`${fs.readFileSync(contentScriptPath, 'utf8')}\n//# sourceURL=content.js`);
  openDomSessions.push({ dom, api: window.__IRB_HOME_FOR_YOU__ });
  return { window, dom, storageBundle };
}

function closeDomSessions() {
  for (const session of openDomSessions) {
    session.api?.teardown?.();
    session.dom.window.close();
  }
  openDomSessions.length = 0;
}

function getHomeTablist(window) {
  return window.document.querySelector('[data-testid="home-feed-tablist"]') ||
    window.document.querySelector('main [role="tablist"]');
}

function assertSingleSelectedTab(tablist, label) {
  const selected = tablist.querySelectorAll('[role="tab"][aria-selected="true"]');
  assert.equal(selected.length, 1);
  assert.equal(selected[0].textContent.trim(), label);
}

async function assertLoggedInHomeColdLoad() {
  for (const href of [
    'https://www.instagram.com/',
    'https://www.instagram.com/?hl=en',
  ]) {
    const storageBundle = createStorageMock();
    const { window } = createSession(readFixture('logged-in-home.html'), href, {
      chrome: storageBundle.chrome,
    });
    await applySwitches(window, { blockForYou: true });

    assert.equal(window.location.hostname, 'www.instagram.com');
    assert.match(window.location.search, /variant=following/);
    if (href.includes('hl=en')) {
      assert.match(window.location.search, /hl=en/);
      assert.equal(
        window.location.href,
        'https://www.instagram.com/?hl=en&variant=following',
      );
    } else if (href.includes('instagram.com')) {
      assert.equal(window.location.href, 'https://www.instagram.com/?variant=following');
    }

    const tablist = getHomeTablist(window);
    assert.ok(tablist);
    assert.equal(findForYouTab(tablist), null);
    assert.equal(
      tablist.querySelector('[role="tab"][aria-selected="true"]').textContent.trim(),
      'Following',
    );
    assert.equal(window.document.documentElement.classList.contains('irb-home-blocking'), false);
  }

  for (const href of ['https://instagram.com', 'https://instagram.com/?hl=en']) {
    const storageBundle = createStorageMock();
    /** @type {string | null} */
    let navigatedTo = null;
    const { window } = createSession(readFixture('logged-in-home.html'), href, {
      chrome: storageBundle.chrome,
    });
    installWwwHomeNavigation(window, (url) => {
      navigatedTo = url;
    });
    await applySwitches(window, { blockForYou: true });

    assert.equal(
      navigatedTo,
      href.includes('hl=en')
        ? 'https://www.instagram.com/?hl=en&variant=following'
        : 'https://www.instagram.com/?variant=following',
    );
    assert.ok(!('extensionCommittedHomeFollowing' in storageBundle.storage.snapshot()));

    const landed = bootContentSession(
      readFixture('logged-in-home.html'),
      navigatedTo,
      createStorageMock({ blockForYou: true }),
    );
    await settle();
    assert.match(landed.window.location.search, /variant=following/);
    assert.equal(findForYouTab(getHomeTablist(landed.window)), null);
  }
}

async function assertTablistRerenderDropsForYou() {
  const storageBundle = createStorageMock();
  const { window, api } = createSession(
    readFixture('logged-in-home.html'),
    'https://www.instagram.com/?variant=following',
    { chrome: storageBundle.chrome },
  );
  await applySwitches(window, { blockForYou: true });

  const tablist = getHomeTablist(window);
  assert.ok(tablist);

  const rerender = window.document.createElement('div');
  rerender.setAttribute('role', 'tablist');
  rerender.innerHTML =
    '<div role="tab" aria-selected="false" class="disabled" aria-disabled="true">For you</div>' +
    '<div role="tab" aria-selected="true">Following</div>';
  tablist.replaceWith(rerender);

  api.sync();

  assert.equal(findForYouTab(rerender), null);
  assert.equal(api.hasDisabledForYouTab(rerender), false);
  assert.equal(
    rerender.querySelector('[role="tab"][aria-selected="true"]').textContent.trim(),
    'Following',
  );
}

async function assertSidebarHomeFromOffHomePages() {
  const paths = [
    'https://www.instagram.com/explore/',
    'https://www.instagram.com/reels/',
    'https://www.instagram.com/direct/inbox/',
    'https://www.instagram.com/someuser/',
  ];

  for (const startHref of paths) {
    const storageBundle = createStorageMock();
    const { window, api } = createSession(readFixture('sidebar-context.html'), startHref, {
      chrome: storageBundle.chrome,
    });
    await applySwitches(window, { blockForYou: true });

    window.history.pushState({}, '', 'https://www.instagram.com/');
    api.sync();
    await settle();

    assert.match(window.location.search, /variant=following/);
    assert.equal(getVariant(window.location.search), 'following');
  }
}

async function assertDirectFollowingUrl() {
  const storageBundle = createStorageMock();
  const { window } = createSession(
    readFixture('logged-in-home.html'),
    'https://www.instagram.com/?variant=following&hl=en',
    { chrome: storageBundle.chrome },
  );
  await applySwitches(window, { blockForYou: true });

  assert.equal(getVariant(window.location.search), 'following');
  assert.match(window.location.search, /hl=en/);
  const tablist = getHomeTablist(window);
  assert.equal(findForYouTab(tablist), null);
}

async function assertFavoritesVariant() {
  const storageBundle = createStorageMock();
  const { window } = createSession(
    readFixture('logged-in-home-favorites.html'),
    'https://www.instagram.com/?variant=favorites',
    { chrome: storageBundle.chrome },
  );
  await applySwitches(window, { blockForYou: true });

  assert.equal(getVariant(window.location.search), 'favorites');
  const tablist = getHomeTablist(window);
  assert.equal(findForYouTab(tablist), null);
  assert.ok(tablist.textContent.includes('Favorites'));
  assert.equal(
    tablist.querySelector('[role="tab"]:not([aria-selected="false"])')?.textContent.trim(),
    'Favorites',
  );
  assert.equal(
    tablist.querySelector('[role="tab"][aria-selected="true"]')?.textContent.trim(),
    'Favorites',
  );
}

async function assertExploreTablistUntouched() {
  const storageBundle = createStorageMock();
  const { window } = createSession(
    readFixture('explore.html'),
    'https://www.instagram.com/explore/',
    { chrome: storageBundle.chrome },
  );
  await applySwitches(window, { blockForYou: true });

  const exploreTablist = window.document.querySelector('[data-testid="explore-tablist"]');
  assert.ok(exploreTablist);
  assert.ok(exploreTablist.textContent.includes('For you'));
  assert.ok(exploreTablist.textContent.includes('Not personalized'));
  assert.ok(window.document.querySelector('[data-testid="explore-grid"]'));
}

async function assertLoggedOutNoBounce() {
  const storageBundle = createStorageMock();
  const { window } = createSession(readFixture('logged-out.html'), 'https://www.instagram.com/', {
    chrome: storageBundle.chrome,
  });
  await applySwitches(window, { blockForYou: true });

  assert.equal(window.location.pathname, '/');
  assert.equal(window.location.search, '');
  assert.ok(window.document.querySelector('input[name="username"]'));
}

async function assertLoggedOutHomeLogoNoRewriteLoop() {
  const storageBundle = createStorageMock();
  const { window, api } = createSession(
    readFixture('logged-out-with-home-logo.html'),
    'https://www.instagram.com/',
    { chrome: storageBundle.chrome },
  );
  await applySwitches(window, { blockForYou: true });

  assert.equal(window.location.href, 'https://www.instagram.com/');
  assert.equal(window.location.search, '');

  window.history.pushState({}, '', 'https://www.instagram.com/');
  api.sync();
  assert.equal(window.location.href, 'https://www.instagram.com/');
  assert.equal(window.location.search, '');

  window.history.pushState({}, '', 'https://www.instagram.com/');
  api.sync();
  assert.equal(window.location.search, '');
}

async function assertToggleOffAfterExtensionCommitAndHistoryEcho() {
  const storageBundle = createStorageMock();
  const { window, api } = createSession(readFixture('logged-in-home.html'), 'https://www.instagram.com/', {
    chrome: storageBundle.chrome,
  });
  await applySwitches(window, { blockForYou: true });
  assert.match(window.location.search, /variant=following/);

  window.history.replaceState({}, '', window.location.href);
  api.sync();
  await settle();
  assert.match(window.location.search, /variant=following/);

  await applySwitches(window, { blockForYou: false });

  assert.equal(window.location.search, '');
  const tablist = getHomeTablist(window);
  assert.equal(
    tablist.querySelectorAll('[role="tab"][aria-selected="true"]').length,
    1,
  );
  assert.equal(
    tablist.querySelector('[role="tab"][aria-selected="true"]').textContent.trim(),
    'For you',
  );
}

async function assertUserFollowingUrlSurvivesBlockOff() {
  const storageBundle = createStorageMock();
  const { window } = createSession(
    readFixture('logged-in-home.html'),
    'https://www.instagram.com/?variant=following',
    { chrome: storageBundle.chrome },
  );
  await applySwitches(window, { blockForYou: false });

  assert.equal(getVariant(window.location.search), 'following');
  const tablist = getHomeTablist(window);
  assert.ok(findForYouTab(tablist));
}

async function assertBlockForYouOffRestoresForYou() {
  const storageBundle = createStorageMock();
  const { window, api } = createSession(readFixture('logged-in-home.html'), 'https://www.instagram.com/', {
    chrome: storageBundle.chrome,
  });
  await applySwitches(window, { blockForYou: false });

  assert.equal(window.location.search, '');
  const tablist = getHomeTablist(window);
  assert.ok(findForYouTab(tablist));
  assert.ok(tablist.textContent.includes('For you'));

  window.history.pushState({}, '', 'https://www.instagram.com/?variant=following');
  api.sync();
  assert.equal(getVariant(window.location.search), 'following');
  assert.ok(findForYouTab(tablist));
}

async function assertNoApexRewriteBeforeStorageReady() {
  const storageBundle = createStorageMock({ blockForYou: false });
  storageBundle.storage.blockGet();
  /** @type {string | null} */
  let navigatedTo = null;
  const { window } = bootContentSession(
    readFixture('logged-in-home.html'),
    'https://instagram.com/?hl=en',
    storageBundle,
  );
  installWwwHomeNavigation(window, (url) => {
    navigatedTo = url;
  });
  window.__IRB_HOME_FOR_YOU__.sync();
  await settle();
  assert.equal(navigatedTo, null);
  assert.equal(window.location.hostname, 'instagram.com');
  assert.equal(window.location.search, '?hl=en');

  storageBundle.storage.unblockGet();
  await settle();
  assert.equal(navigatedTo, null);
  assert.equal(window.location.search, '?hl=en');
}

async function assertFreshDocumentFollowingWithBlockOffIsUserFollowing() {
  const landed = bootContentSession(
    readFixture('logged-in-home.html'),
    'https://www.instagram.com/?hl=en&variant=following',
    createStorageMock({ blockForYou: false }),
  );
  await settle();
  assert.equal(landed.window.location.search, '?hl=en&variant=following');
  assert.equal(getVariant(landed.window.location.search), 'following');
  assert.ok(findForYouTab(getHomeTablist(landed.window)));
}

async function assertStaleFavoritesOnHomeSelectsFollowing() {
  const storageBundle = createStorageMock();
  const { window } = createSession(
    readFixture('logged-in-home-stale-favorites.html'),
    'https://www.instagram.com/?hl=en',
    { chrome: storageBundle.chrome },
  );
  await applySwitches(window, { blockForYou: true });
  assert.match(window.location.search, /variant=following/);
  assert.match(window.location.search, /hl=en/);
  const tablist = getHomeTablist(window);
  assert.equal(findForYouTab(tablist), null);
  assert.ok(tablist.textContent.includes('Favorites'));
  assert.equal(
    tablist.querySelector('[role="tab"][aria-selected="true"]').textContent.trim(),
    'Following',
  );
  const favoritesTab = [...tablist.querySelectorAll('[role="tab"]')].find(
    (tab) => tab.textContent.trim() === 'Favorites',
  );
  assert.equal(favoritesTab?.getAttribute('aria-selected'), 'false');
}

async function assertFollowingAfterFavoritesRouteWithBlockOff() {
  const storageBundle = createStorageMock();
  const { window, api } = createSession(readFixture('logged-in-home.html'), 'https://www.instagram.com/', {
    chrome: storageBundle.chrome,
  });
  await applySwitches(window, { blockForYou: true });
  assert.match(window.location.search, /variant=following/);

  window.history.pushState({}, '', 'https://www.instagram.com/?variant=favorites');
  api.sync();
  await settle();
  await applySwitches(window, { blockForYou: false });

  window.history.pushState({}, '', 'https://www.instagram.com/?variant=following');
  api.sync();
  await settle();

  const tablist = getHomeTablist(window);
  assert.equal(getVariant(window.location.search), 'following');
  assert.ok(findForYouTab(tablist));
  assertSingleSelectedTab(tablist, 'Following');
}

async function assertRepeatedBlockOnOffStillCommitsFollowing() {
  const storageBundle = createStorageMock();
  const { window } = createSession(readFixture('logged-in-home.html'), 'https://www.instagram.com/', {
    chrome: storageBundle.chrome,
  });
  for (let i = 0; i < 5; i += 1) {
    await applySwitches(window, { blockForYou: true });
    assert.match(window.location.search, /variant=following/);
    await applySwitches(window, { blockForYou: false });
    assert.equal(window.location.search, '');
  }
  await applySwitches(window, { blockForYou: true });
  assert.match(window.location.search, /variant=following/);
  assert.equal(
    window.document.documentElement.classList.contains('irb-home-blocking'),
    false,
  );
}

async function assertStaleFavoritesOnFollowingUrlSelectsFollowing() {
  const storageBundle = createStorageMock();
  const { window } = createSession(
    readFixture('logged-in-home-favorites.html'),
    'https://www.instagram.com/?variant=following',
    { chrome: storageBundle.chrome },
  );
  await applySwitches(window, { blockForYou: true });
  const tablist = getHomeTablist(window);
  assert.equal(getVariant(window.location.search), 'following');
  assertSingleSelectedTab(tablist, 'Following');
}

async function assertArrivalAtHomeAfterFavoritesCommitsFollowing() {
  const storageBundle = createStorageMock();
  const { window, api } = createSession(
    readFixture('logged-in-home-favorites.html'),
    'https://www.instagram.com/?variant=favorites',
    { chrome: storageBundle.chrome },
  );
  await applySwitches(window, { blockForYou: true });
  assert.equal(getVariant(window.location.search), 'favorites');

  window.history.pushState({}, '', 'https://www.instagram.com/');
  api.sync();
  await settle();

  const tablist = getHomeTablist(window);
  assert.equal(getVariant(window.location.search), 'following');
  assertSingleSelectedTab(tablist, 'Following');
}

async function assertRepeatedFavoritesRoundTripCommitsFollowing() {
  const storageBundle = createStorageMock();
  const { window, api } = createSession(readFixture('logged-in-home.html'), 'https://www.instagram.com/', {
    chrome: storageBundle.chrome,
  });
  await applySwitches(window, { blockForYou: true });
  assert.match(window.location.search, /variant=following/);

  for (let round = 0; round < 3; round += 1) {
    window.history.pushState({}, '', 'https://www.instagram.com/?variant=favorites');
    api.sync();
    await settle();
    window.history.pushState({}, '', 'https://www.instagram.com/?hl=en');
    api.sync();
    await settle();

    const tablist = getHomeTablist(window);
    assert.equal(getVariant(window.location.search), 'following', `round ${round + 1}`);
    assert.match(window.location.search, /hl=en/);
    assertSingleSelectedTab(tablist, 'Following');
    assert.equal(
      window.document.documentElement.classList.contains('irb-home-blocking'),
      false,
      `round ${round + 1}`,
    );
  }
}

async function assertApexFavoritesRevealedWithBlockOn() {
  const storageBundle = createStorageMock();
  const { window } = createSession(
    readFixture('logged-in-home-favorites.html'),
    'https://instagram.com/?variant=favorites&hl=en',
    { chrome: storageBundle.chrome },
  );
  await applySwitches(window, { blockForYou: true });

  assert.equal(window.location.hostname, 'instagram.com');
  assert.equal(getVariant(window.location.search), 'favorites');
  assert.match(window.location.search, /hl=en/);
  assert.equal(
    window.document.documentElement.classList.contains('irb-home-blocking'),
    false,
  );
  assertSingleSelectedTab(getHomeTablist(window), 'Favorites');
}

async function assertFollowingAfterExploreDetourSingleSelected() {
  const storageBundle = createStorageMock();
  const { window, api } = createSession(readFixture('logged-in-home.html'), 'https://www.instagram.com/', {
    chrome: storageBundle.chrome,
  });
  await applySwitches(window, { blockForYou: true });
  window.history.pushState({}, '', 'https://www.instagram.com/explore/');
  api.sync();
  await settle();
  window.history.pushState({}, '', 'https://www.instagram.com/?variant=following');
  api.sync();
  await settle();
  await applySwitches(window, { blockForYou: false });
  const tablist = getHomeTablist(window);
  assert.equal(getVariant(window.location.search), 'following');
  assertSingleSelectedTab(tablist, 'Following');
}

function assertPendingFlushAppliesHomeSwitches() {
  const contentSrc = fs.readFileSync(contentScriptPath, 'utf8');
  assert.match(
    contentSrc,
    /function flushPendingSwitches\(\) \{[\s\S]*applyBlockingSwitches\(switches\)/,
  );
}

async function assertFavoritesStaysSelectedWhenBlockOffAfterFollowingCommit() {
  const storageBundle = createStorageMock();
  const { window, api } = createSession(readFixture('logged-in-home-favorites.html'), 'https://www.instagram.com/', {
    chrome: storageBundle.chrome,
  });
  await applySwitches(window, { blockForYou: true });
  assert.match(window.location.search, /variant=following/);

  window.history.pushState({}, '', 'https://www.instagram.com/?variant=favorites');
  const tablist = getHomeTablist(window);
  for (const tab of tablist.querySelectorAll('[role="tab"]')) {
    tab.setAttribute('aria-selected', tab.textContent.trim() === 'Favorites' ? 'true' : 'false');
  }
  api.sync();
  await settle();

  await applySwitches(window, { blockForYou: false });
  assert.equal(getVariant(window.location.search), 'favorites');
  assert.equal(
    tablist.querySelector('[role="tab"][aria-selected="true"]').textContent.trim(),
    'Favorites',
  );
}

async function assertContentScriptWiresHomeBlock() {
  let store = { blockForYou: false };
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
    set(partial, callback) {
      const changes = {};
      for (const [key, value] of Object.entries(partial)) {
        changes[key] = { oldValue: store[key], newValue: value };
        store[key] = value;
      }
      for (const listener of listeners) {
        listener(changes, 'local');
      }
      const done = Promise.resolve();
      if (typeof callback === 'function') {
        done.then(() => callback());
      }
      return done;
    },
    remove(keys) {
      for (const key of keys) {
        delete store[key];
      }
      return Promise.resolve();
    },
  };

  const dom = new JSDOM(readFixture('logged-in-home.html'), {
    url: 'https://www.instagram.com/',
    pretendToBeVisual: true,
    runScripts: 'outside-only',
  });
  const { window } = dom;
  installWwwHomeNavigation(window, dom);
  window.chrome = {
    storage: {
      local: storage,
      onChanged: { addListener(fn) { listeners.push(fn); } },
    },
  };
  window.eval(`${fs.readFileSync(homeScriptPath, 'utf8')}\n//# sourceURL=home-for-you-block.js`);
  window.eval(`${fs.readFileSync(contentScriptPath, 'utf8')}\n//# sourceURL=content.js`);

  openDomSessions.push({ dom, api: window.__IRB_HOME_FOR_YOU__ });

  for (let i = 0; i < 8; i += 1) {
    await Promise.resolve();
  }

  assert.equal(window.location.search, '');
  const tablist = getHomeTablist(window);
  assert.ok(findForYouTab(tablist));
  window.__IRB_HOME_FOR_YOU__?.teardown?.();

  store = {};

  const domOn = new JSDOM(readFixture('logged-in-home.html'), {
    url: 'https://www.instagram.com/',
    pretendToBeVisual: true,
    runScripts: 'outside-only',
  });
  const windowOn = domOn.window;
  installWwwHomeNavigation(windowOn, domOn);
  windowOn.chrome = {
    storage: {
      local: storage,
      onChanged: { addListener(fn) { listeners.push(fn); } },
    },
  };
  windowOn.eval(`${fs.readFileSync(homeScriptPath, 'utf8')}\n//# sourceURL=home-for-you-block.js`);
  windowOn.eval(`${fs.readFileSync(contentScriptPath, 'utf8')}\n//# sourceURL=content.js`);
  openDomSessions.push({ dom: domOn, api: windowOn.__IRB_HOME_FOR_YOU__ });

  for (let i = 0; i < 8; i += 1) {
    await Promise.resolve();
  }

  assert.match(windowOn.location.search, /variant=following/);
  const tablistOn = getHomeTablist(windowOn);
  assert.equal(findForYouTab(tablistOn), null);

  await storage.set({ blockForYou: false });
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(windowOn.location.search, '');
  assert.ok(findForYouTab(tablistOn));
  assert.equal(
    tablistOn.querySelectorAll('[role="tab"][aria-selected="true"]').length,
    1,
  );
}

async function runTask21Verify() {
  assertManifestLoadsHomeScriptFirst();
  assertPureUrlHelpers();
  await assertLoggedInHomeColdLoad();
  await assertTablistRerenderDropsForYou();
  await assertSidebarHomeFromOffHomePages();
  await assertDirectFollowingUrl();
  await assertFavoritesVariant();
  await assertExploreTablistUntouched();
  await assertLoggedOutNoBounce();
  await assertLoggedOutHomeLogoNoRewriteLoop();
  await assertToggleOffAfterExtensionCommitAndHistoryEcho();
  await assertUserFollowingUrlSurvivesBlockOff();
  await assertBlockForYouOffRestoresForYou();
  await assertNoApexRewriteBeforeStorageReady();
  await assertFreshDocumentFollowingWithBlockOffIsUserFollowing();
  await assertStaleFavoritesOnHomeSelectsFollowing();
  await assertFollowingAfterFavoritesRouteWithBlockOff();
  await assertRepeatedBlockOnOffStillCommitsFollowing();
  await assertStaleFavoritesOnFollowingUrlSelectsFollowing();
  await assertArrivalAtHomeAfterFavoritesCommitsFollowing();
  await assertRepeatedFavoritesRoundTripCommitsFollowing();
  await assertApexFavoritesRevealedWithBlockOn();
  await assertFollowingAfterExploreDetourSingleSelected();
  await assertFavoritesStaysSelectedWhenBlockOffAfterFollowingCommit();
  await assertPendingFlushAppliesHomeSwitches();
  await assertContentScriptWiresHomeBlock();

  closeDomSessions();

  console.log('task-2.1-verify: all checks passed');
}

await runTask21Verify();
