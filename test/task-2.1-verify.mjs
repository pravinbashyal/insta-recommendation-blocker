import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { JSDOM } from 'jsdom';

import {
  buildFollowingSearch,
  buildWwwHomeHref,
  findForYouTab,
  findFavoritesTab,
  getVariant,
  isHomeRoute,
  needsFollowingRedirect,
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

function installWwwHomeNavigation(window, handler) {
  window.__IRB_NAVIGATE_WWW_HOME__ = handler;
}

async function applySwitches(window, switches) {
  window.__IRB_HOME_FOR_YOU__.applySwitchesFromStorage(switches);
  await settle();
}

function createSession(html, href, { chrome, reconfigureOnNavigate = true } = {}) {
  const dom = new JSDOM(html, {
    url: href,
    pretendToBeVisual: true,
    runScripts: 'outside-only',
  });

  const { window } = dom;
  if (chrome) {
    window.chrome = chrome;
  }
  /** @type {string[]} */
  const navigations = [];
  installWwwHomeNavigation(window, (url) => {
    navigations.push(String(url));
    if (reconfigureOnNavigate) {
      dom.reconfigure({ url: String(url) });
    }
  });

  window.eval(`${fs.readFileSync(homeScriptPath, 'utf8')}\n//# sourceURL=home-for-you-block.js`);
  const api = window.__IRB_HOME_FOR_YOU__;
  assert.ok(api, 'home script must expose __IRB_HOME_FOR_YOU__');

  openDomSessions.push({ dom, api });
  return { window, api, dom, navigations };
}

function bootContentSession(html, href, storageBundle) {
  const dom = new JSDOM(html, {
    url: href,
    pretendToBeVisual: true,
    runScripts: 'outside-only',
  });
  const { window } = dom;
  window.chrome = storageBundle.chrome;
  installWwwHomeNavigation(window, (url) => {
    dom.reconfigure({ url: String(url) });
  });
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

// ---------------------------------------------------------------------------

function assertManifestLoadsHomeScriptFirst() {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const scripts = manifest.content_scripts[0].js;
  assert.deepEqual(scripts, [
    'content/home-for-you-block.js',
    'content/reels-viewer-block.js',
    'content/explore-discovery-block.js',
    'content/content.js',
  ]);
}

function assertPureUrlHelpers() {
  const home = { hostname: 'www.instagram.com', pathname: '/' };
  const apex = { hostname: 'instagram.com', pathname: '/' };

  assert.equal(needsFollowingRedirect(true, { ...home, search: '' }), true);
  assert.equal(needsFollowingRedirect(true, { ...home, search: '?hl=en' }), true);
  assert.equal(needsFollowingRedirect(true, { ...apex, search: '' }), true);
  assert.equal(needsFollowingRedirect(true, { ...home, search: '?variant=following' }), false);
  assert.equal(needsFollowingRedirect(true, { ...home, search: '?variant=favorites' }), false);
  assert.equal(needsFollowingRedirect(false, { ...home, search: '' }), false);
  assert.equal(
    needsFollowingRedirect(true, { hostname: 'www.instagram.com', pathname: '/explore/', search: '' }),
    false,
  );

  assert.equal(buildFollowingSearch(''), '?variant=following');
  assert.equal(buildFollowingSearch('?hl=en'), '?hl=en&variant=following');
  assert.equal(buildWwwHomeHref('?variant=following'), 'https://www.instagram.com/?variant=following');
  assert.equal(buildWwwHomeHref('?hl=en&variant=following'), 'https://www.instagram.com/?hl=en&variant=following');

  assert.equal(isHomeRoute(home), true);
  assert.equal(isHomeRoute(apex), true);
  assert.equal(isHomeRoute({ hostname: 'www.instagram.com', pathname: '/explore/' }), false);
}

async function assertColdLoadBareHomeRedirectsAndStripsForYou() {
  for (const [href, expectedTarget] of [
    ['https://www.instagram.com/', 'https://www.instagram.com/?variant=following'],
    ['https://www.instagram.com/?hl=en', 'https://www.instagram.com/?hl=en&variant=following'],
  ]) {
    const storageBundle = createStorageMock();
    const { window, navigations } = createSession(readFixture('logged-in-home.html'), href, {
      chrome: storageBundle.chrome,
    });
    await applySwitches(window, { blockForYou: true });

    // For you tab stripped and the bare feed sent to Following (query preserved).
    assert.equal(findForYouTab(getHomeTablist(window)), null);
    assert.ok(navigations.includes(expectedTarget), `expected redirect to ${expectedTarget}`);
    assert.match(window.location.search, /variant=following/);
    assert.equal(
      window.document.documentElement.classList.contains('irb-home-blocking'),
      false,
    );
  }

  // Apex host redirects onto the www home Following URL.
  for (const [href, expectedTarget] of [
    ['https://instagram.com/', 'https://www.instagram.com/?variant=following'],
    ['https://instagram.com/?hl=en', 'https://www.instagram.com/?hl=en&variant=following'],
  ]) {
    const storageBundle = createStorageMock();
    const { window, navigations } = createSession(readFixture('logged-in-home.html'), href, {
      chrome: storageBundle.chrome,
      reconfigureOnNavigate: false,
    });
    await applySwitches(window, { blockForYou: true });
    assert.equal(navigations[navigations.length - 1], expectedTarget);
  }
}

async function assertFollowingUrlStripsForYouNoRedirect() {
  for (const href of [
    'https://www.instagram.com/?variant=following',
    'https://www.instagram.com/?variant=following&hl=en',
  ]) {
    const storageBundle = createStorageMock();
    const { window, navigations } = createSession(readFixture('logged-in-home.html'), href, {
      chrome: storageBundle.chrome,
    });
    await applySwitches(window, { blockForYou: true });

    assert.equal(findForYouTab(getHomeTablist(window)), null);
    assert.equal(navigations.length, 0, 'already on Following: no redirect');
    assert.equal(getVariant(window.location.search), 'following');
    assert.equal(window.location.href, href);
  }
}

async function assertFavoritesUrlStripsForYouKeepsFavorites() {
  const storageBundle = createStorageMock();
  const { window, navigations } = createSession(
    readFixture('logged-in-home-favorites.html'),
    'https://www.instagram.com/?variant=favorites',
    { chrome: storageBundle.chrome },
  );
  await applySwitches(window, { blockForYou: true });

  const tablist = getHomeTablist(window);
  assert.equal(navigations.length, 0, 'favorites URL left alone: no redirect');
  assert.equal(getVariant(window.location.search), 'favorites');
  assert.equal(findForYouTab(tablist), null, 'For you still stripped');
  const favorites = findFavoritesTab(tablist);
  assert.ok(favorites, 'Favorites tab present');
  assert.equal(favorites.getAttribute('aria-selected'), 'true', 'Favorites selection untouched');
}

async function assertTablistRerenderDropsForYou() {
  const storageBundle = createStorageMock();
  const { window, api } = createSession(
    readFixture('logged-in-home.html'),
    'https://www.instagram.com/?variant=following',
    { chrome: storageBundle.chrome },
  );
  await applySwitches(window, { blockForYou: true });
  assert.equal(findForYouTab(getHomeTablist(window)), null);

  // Instagram re-renders the tablist (adds For you back).
  const tablist = getHomeTablist(window);
  const rerender = window.document.createElement('div');
  rerender.setAttribute('role', 'tablist');
  rerender.setAttribute('data-testid', 'home-feed-tablist');
  rerender.innerHTML =
    '<div role="tab" aria-selected="false">For you</div>' +
    '<div role="tab" aria-selected="true">Following</div>';
  tablist.replaceWith(rerender);
  await settle();

  assert.equal(findForYouTab(getHomeTablist(window)), null, 'For you re-stripped after re-render');
}

async function assertSidebarHomeFromOffHomePages() {
  for (const startHref of [
    'https://www.instagram.com/explore/',
    'https://www.instagram.com/reels/',
    'https://www.instagram.com/direct/inbox/',
    'https://www.instagram.com/someuser/',
  ]) {
    const storageBundle = createStorageMock();
    const { window, api, navigations } = createSession(readFixture('sidebar-context.html'), startHref, {
      chrome: storageBundle.chrome,
    });
    await applySwitches(window, { blockForYou: true });
    assert.equal(navigations.length, 0, `off-home route ${startHref}: no redirect`);

    window.history.pushState({}, '', 'https://www.instagram.com/');
    api.sync();
    await settle();

    assert.equal(getVariant(window.location.search), 'following');
  }
}

async function assertExploreTablistUntouched() {
  const storageBundle = createStorageMock();
  const { window, navigations } = createSession(
    readFixture('explore.html'),
    'https://www.instagram.com/explore/',
    { chrome: storageBundle.chrome },
  );
  await applySwitches(window, { blockForYou: true });

  const exploreTablist = window.document.querySelector('[data-testid="explore-tablist"]');
  assert.ok(exploreTablist);
  assert.ok(exploreTablist.textContent.includes('For you'));
  assert.ok(exploreTablist.textContent.includes('Not personalized'));
  assert.equal(navigations.length, 0, 'explore route is not redirected');
}

async function assertLoggedOutReachesLoginNoBounce() {
  const storageBundle = createStorageMock();
  const { window, api, navigations } = createSession(
    readFixture('logged-out.html'),
    'https://www.instagram.com/',
    { chrome: storageBundle.chrome },
  );
  await applySwitches(window, { blockForYou: true });

  // The login UI stays reachable; the bare home redirects at most once onto a
  // Following URL and then settles (no / <-> /?variant=following bounce).
  assert.ok(window.document.querySelector('input[name="username"]'), 'login form present');
  const uniqueTargets = new Set(navigations);
  assert.ok(uniqueTargets.size <= 1, `at most one redirect target, saw ${[...uniqueTargets]}`);
  if (navigations.length) {
    assert.equal(navigations[navigations.length - 1], 'https://www.instagram.com/?variant=following');
    assert.equal(getVariant(window.location.search), 'following');
  }

  // A repeated sync on the committed URL does not navigate again.
  const before = navigations.length;
  api.sync();
  await settle();
  assert.equal(navigations.length, before, 'no further redirect after commit');
}

async function assertToggleOffRestoresForYou() {
  const storageBundle = createStorageMock();
  const { window, api } = createSession(
    readFixture('logged-in-home.html'),
    'https://www.instagram.com/?variant=following',
    { chrome: storageBundle.chrome },
  );
  await applySwitches(window, { blockForYou: true });
  assert.equal(findForYouTab(getHomeTablist(window)), null);

  await applySwitches(window, { blockForYou: false });
  const tablist = getHomeTablist(window);
  assert.ok(findForYouTab(tablist), 'For you restored when block turns off');
  assert.ok(tablist.textContent.includes('For you'));
}

async function assertBlockOffNeverRedirectsOrStrips() {
  const storageBundle = createStorageMock();
  const { window, api, navigations } = createSession(
    readFixture('logged-in-home.html'),
    'https://www.instagram.com/',
    { chrome: storageBundle.chrome },
  );
  await applySwitches(window, { blockForYou: false });

  assert.equal(navigations.length, 0);
  assert.equal(window.location.search, '');
  assert.ok(findForYouTab(getHomeTablist(window)), 'For you left in place when block is off');

  window.history.pushState({}, '', 'https://www.instagram.com/?variant=following');
  api.sync();
  await settle();
  assert.equal(getVariant(window.location.search), 'following');
  assert.ok(findForYouTab(getHomeTablist(window)), 'user-chosen Following keeps For you with block off');
}

async function assertRepeatedToggleStaysStable() {
  const storageBundle = createStorageMock();
  const { window, navigations } = createSession(
    readFixture('logged-in-home.html'),
    'https://www.instagram.com/',
    { chrome: storageBundle.chrome },
  );
  for (let i = 0; i < 5; i += 1) {
    navigations.length = 0;
    await applySwitches(window, { blockForYou: true });
    assert.equal(findForYouTab(getHomeTablist(window)), null, `round ${i}: stripped`);
    assert.match(window.location.search, /variant=following/);

    await applySwitches(window, { blockForYou: false });
    assert.ok(findForYouTab(getHomeTablist(window)), `round ${i}: restored`);
  }
}

function assertPendingFlushAppliesHomeSwitches() {
  const contentSrc = fs.readFileSync(contentScriptPath, 'utf8');
  assert.match(
    contentSrc,
    /function flushPendingSwitches\(\) \{[\s\S]*applyBlockingSwitches\(switches\)/,
  );
}

async function assertContentScriptWiresHomeBlock() {
  const storageBundle = createStorageMock({ blockForYou: false });
  const { window } = bootContentSession(
    readFixture('logged-in-home.html'),
    'https://www.instagram.com/',
    storageBundle,
  );
  await settle();

  // Block off: For you present, no redirect.
  assert.equal(window.location.search, '');
  assert.ok(findForYouTab(getHomeTablist(window)));

  // Turn the switch on through storage.
  await storageBundle.chrome.storage.local.set({ blockForYou: true });
  await settle();
  assert.match(window.location.search, /variant=following/);
  assert.equal(findForYouTab(getHomeTablist(window)), null);

  // Turn it back off through storage.
  await storageBundle.chrome.storage.local.set({ blockForYou: false });
  await settle();
  assert.ok(findForYouTab(getHomeTablist(window)));
}

async function runTask21Verify() {
  assertManifestLoadsHomeScriptFirst();
  assertPureUrlHelpers();
  await assertColdLoadBareHomeRedirectsAndStripsForYou();
  await assertFollowingUrlStripsForYouNoRedirect();
  await assertFavoritesUrlStripsForYouKeepsFavorites();
  await assertTablistRerenderDropsForYou();
  await assertSidebarHomeFromOffHomePages();
  await assertExploreTablistUntouched();
  await assertLoggedOutReachesLoginNoBounce();
  await assertToggleOffRestoresForYou();
  await assertBlockOffNeverRedirectsOrStrips();
  await assertRepeatedToggleStaysStable();
  assertPendingFlushAppliesHomeSwitches();
  await assertContentScriptWiresHomeBlock();

  closeDomSessions();
  console.log('task-2.1-verify: all checks passed');
}

await runTask21Verify();
