import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { JSDOM } from 'jsdom';

import {
  EXPLORE_ACCOUNT_RESULT_TESTID,
  EXPLORE_HIDE_CLASS,
  EXPLORE_SEARCH_INPUT_TESTID,
  buildExploreHideCssRule,
  isExploreRoute,
  isExploreSidebarSearchHref,
} from '../extension/lib/explore-discovery-block.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionDir = path.join(__dirname, '..', 'extension');
const fixtureDir = path.join(__dirname, 'fixtures', 'explore');
const homeScriptPath = path.join(extensionDir, 'content', 'home-for-you-block.js');
const reelsScriptPath = path.join(extensionDir, 'content', 'reels-viewer-block.js');
const exploreScriptPath = path.join(extensionDir, 'content', 'explore-discovery-block.js');
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

function loadScripts(window) {
  window.eval(`${fs.readFileSync(homeScriptPath, 'utf8')}\n//# sourceURL=home-for-you-block.js`);
  window.eval(`${fs.readFileSync(reelsScriptPath, 'utf8')}\n//# sourceURL=reels-viewer-block.js`);
  window.eval(`${fs.readFileSync(exploreScriptPath, 'utf8')}\n//# sourceURL=explore-discovery-block.js`);
}

function installWwwHomeNavigation(window, handler) {
  window.__IRB_NAVIGATE_WWW_HOME__ = handler;
}

async function applySwitches(window, switches) {
  window.__IRB_EXPLORE_DISCOVERY__.applySwitchesFromStorage(switches);
  window.__IRB_REELS_VIEWER__.applySwitchesFromStorage(switches);
  window.__IRB_HOME_FOR_YOU__.applySwitchesFromStorage(switches);
  await settle();
}

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

  loadScripts(window);

  assert.ok(window.__IRB_EXPLORE_DISCOVERY__);

  openDomSessions.push({ dom, api: window.__IRB_HOME_FOR_YOU__ });
  return { window, dom };
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
  loadScripts(window);
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

function getExplorePostTileLinks(window) {
  return window.document.querySelectorAll(
    'main a[href^="/p/"], main a[href^="/reel/"], main a[href^="/reels/"]',
  );
}

function getExploreTileGrid(window) {
  return (
    window.document.querySelector('main [role="grid"]') ||
    window.document.querySelector('[data-testid="explore-tile-feed"]')
  );
}

function assertElementVisible(window, testid) {
  const el = window.document.querySelector(`[data-testid="${testid}"]`);
  assert.ok(el, `expected [data-testid="${testid}"]`);
  assert.notEqual(window.getComputedStyle(el).display, 'none');
}

function assertTileGridHidden(window) {
  const tiles = getExplorePostTileLinks(window);
  assert.ok(tiles.length > 0, 'expected explore post/reel tile links in DOM');
  for (const tile of tiles) {
    assert.equal(
      window.getComputedStyle(tile).display,
      'none',
      `tile link should be hidden: ${tile.getAttribute('href')}`,
    );
  }
  const grid = window.document.querySelector('main [role="grid"]');
  if (grid) {
    assert.equal(window.getComputedStyle(grid).display, 'none');
  }
}

function assertTileGridVisible(window) {
  const tiles = getExplorePostTileLinks(window);
  assert.ok(tiles.length > 0, 'expected explore post/reel tile links in DOM');
  for (const tile of tiles) {
    assert.notEqual(window.getComputedStyle(tile).display, 'none');
  }
}

function assertExploreBlockingClass(window, expected) {
  const has = window.document.documentElement.classList.contains(EXPLORE_HIDE_CLASS);
  assert.equal(has, expected);
}

function assertExploreTablistUsable(window) {
  const tablist = window.document.querySelector('main [role="tablist"]');
  assert.ok(tablist);
  assert.notEqual(window.getComputedStyle(tablist).display, 'none');
  assert.ok(tablist.textContent.includes('For you'));
  assert.ok(tablist.textContent.includes('Not personalized'));
}

function assertHideCssPrefixesEverySelector() {
  const css = buildExploreHideCssRule(EXPLORE_HIDE_CLASS);
  const selectorList = css.split('{')[0];
  for (const part of selectorList.split(',')) {
    assert.match(
      part.trim(),
      new RegExp('^html\\.' + EXPLORE_HIDE_CLASS + ' '),
      `selector must be scoped under html.${EXPLORE_HIDE_CLASS}: ${part.trim()}`,
    );
  }

  const dom = new JSDOM(readFixture('explore-keyword.html'), {
    url: 'https://www.instagram.com/explore/search/keyword/?q=cats',
    pretendToBeVisual: true,
    runScripts: 'outside-only',
  });
  const { window } = dom;
  window.eval(`${fs.readFileSync(exploreScriptPath, 'utf8')}\n//# sourceURL=explore-discovery-block.js`);
  const injected = window.__IRB_EXPLORE_DISCOVERY__.buildHideCssRule();
  const injectedSelectors = injected.split('{')[0];
  for (const part of injectedSelectors.split(',')) {
    assert.match(part.trim(), /^html\.irb-explore-blocking /);
  }
  dom.window.close();
}

function assertPureRouteHelpers() {
  assert.equal(isExploreRoute({ hostname: 'www.instagram.com', pathname: '/explore/' }), true);
  assert.equal(isExploreRoute({ hostname: 'www.instagram.com', pathname: '/explore/search/keyword/' }), true);
  assert.equal(isExploreRoute({ hostname: 'www.instagram.com', pathname: '/' }), false);
  assert.equal(isExploreSidebarSearchHref('/explore/'), true);
  assert.equal(isExploreSidebarSearchHref('https://www.instagram.com/explore/'), true);
  assert.equal(isExploreSidebarSearchHref('/reels/'), false);
}

function assertManifestLoadsExploreScript() {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const scripts = manifest.content_scripts[0].js;
  assert.equal(scripts[2], 'content/explore-discovery-block.js');
}

async function assertExploreRouteHidesGridBeforeStorage() {
  const dom = new JSDOM(readFixture('explore-main.html'), {
    url: 'https://www.instagram.com/explore/',
    pretendToBeVisual: true,
    runScripts: 'outside-only',
  });
  const { window } = dom;
  window.eval(`${fs.readFileSync(exploreScriptPath, 'utf8')}\n//# sourceURL=explore-discovery-block.js`);
  assert.equal(window.__IRB_EXPLORE_DISCOVERY__.isSwitchesReady(), false);
  assertExploreBlockingClass(window, true);
  assertTileGridHidden(window);
  assert.equal(window.document.querySelector('main [role="grid"]'), null);
  dom.window.close();
}

async function assertExploreMainBlocked() {
  for (const href of [
    'https://www.instagram.com/explore/',
    'https://www.instagram.com/explore/?hl=en',
  ]) {
    const { window } = createSession(readFixture('explore-main.html'), href);
    await applySwitches(window, {
      blockExploreContents: true,
      blockForYou: true,
      blockReels: true,
    });

    assert.match(window.location.pathname, /^\/explore\/?$/);
    assertElementVisible(window, EXPLORE_SEARCH_INPUT_TESTID);
    assertTileGridHidden(window);
    assertExploreTablistUsable(window);
  }
}

async function assertBothExploreTabsHideGrid() {
  const { window } = createSession(
    readFixture('explore-main.html'),
    'https://www.instagram.com/explore/',
  );
  await applySwitches(window, { blockExploreContents: true, blockForYou: false, blockReels: true });

  const notPersonalized = window.document.querySelector('[data-testid="explore-tab-not-personalized"]');
  assert.ok(notPersonalized);
  notPersonalized.setAttribute('aria-selected', 'true');
  window.document.querySelector('[data-testid="explore-tab-for-you"]')?.setAttribute('aria-selected', 'false');

  getExploreTileGrid(window)?.remove();
  const replacement = window.document.createElement('div');
  replacement.setAttribute('role', 'grid');
  replacement.setAttribute('aria-label', 'Not personalized posts');
  const article = window.document.createElement('article');
  const link = window.document.createElement('a');
  link.setAttribute('href', '/p/NEW999/');
  link.textContent = 'New tile';
  article.appendChild(link);
  replacement.appendChild(article);
  window.document.querySelector('main')?.appendChild(replacement);
  window.__IRB_EXPLORE_DISCOVERY__.sync();
  await settle();

  assertTileGridHidden(window);
  assertElementVisible(window, EXPLORE_SEARCH_INPUT_TESTID);
  assertExploreTablistUsable(window);
}

async function assertSidebarSearchOpensExploreWithBlock() {
  const { window, dom } = createSession(
    readFixture('explore-main.html'),
    'https://www.instagram.com/direct/inbox/',
  );
  await applySwitches(window, { blockExploreContents: true, blockForYou: true, blockReels: true });

  const searchLink = window.document.querySelector('[data-testid="sidebar-search"]');
  assert.ok(searchLink);
  window.history.pushState({}, '', 'https://www.instagram.com/explore/');
  dom.reconfigure({ url: 'https://www.instagram.com/explore/' });
  window.__IRB_EXPLORE_DISCOVERY__.sync();
  await settle();

  assert.match(window.location.pathname, /^\/explore\/?$/);
  assertElementVisible(window, EXPLORE_SEARCH_INPUT_TESTID);
  assertTileGridHidden(window);
}

async function assertAccountChoiceOpensProfile() {
  const { window } = createSession(
    readFixture('explore-keyword.html'),
    'https://www.instagram.com/explore/search/keyword/?q=cats',
  );
  await applySwitches(window, { blockExploreContents: true, blockForYou: true, blockReels: true });

  assertTileGridHidden(window);
  assertElementVisible(window, EXPLORE_ACCOUNT_RESULT_TESTID);

  const accountLink = window.document.querySelector(`[data-testid="${EXPLORE_ACCOUNT_RESULT_TESTID}"]`);
  assert.ok(accountLink);
  assert.equal(accountLink.getAttribute('href'), '/catlover/');

  window.history.pushState({}, '', 'https://www.instagram.com/catlover/');
  window.document.body.innerHTML = `
    <main>
      <h1 data-testid="profile-username">catlover</h1>
      <div role="grid" aria-label="Profile posts">
        <article><a href="/p/PROF111/">Posts and reels</a></article>
      </div>
    </main>`;
  window.__IRB_EXPLORE_DISCOVERY__.sync();
  await settle();

  assert.equal(window.location.pathname, '/catlover/');
  assertExploreBlockingClass(window, false);
  assertTileGridVisible(window);
}

async function assertSearchContentGridsHiddenWhileOn() {
  const cases = [
    {
      fixture: 'explore-keyword.html',
      href: 'https://www.instagram.com/explore/search/keyword/?q=cats',
    },
    {
      fixture: 'explore-hashtag.html',
      href: 'https://www.instagram.com/explore/tags/cats/',
    },
    {
      fixture: 'explore-place.html',
      href: 'https://www.instagram.com/explore/locations/12345/central-park/',
    },
  ];

  for (const { fixture, href } of cases) {
    const { window } = createSession(readFixture(fixture), href);
    await applySwitches(window, { blockExploreContents: true, blockForYou: true, blockReels: true });

    assertTileGridHidden(window);
    assertElementVisible(window, EXPLORE_SEARCH_INPUT_TESTID);
    assertElementVisible(window, EXPLORE_ACCOUNT_RESULT_TESTID);
  }
}

async function assertSearchContentGridsVisibleWhenOff() {
  const cases = [
    {
      fixture: 'explore-keyword.html',
      href: 'https://www.instagram.com/explore/search/keyword/?q=cats',
    },
    {
      fixture: 'explore-hashtag.html',
      href: 'https://www.instagram.com/explore/tags/cats/',
    },
    {
      fixture: 'explore-place.html',
      href: 'https://www.instagram.com/explore/locations/12345/central-park/',
    },
  ];

  for (const { fixture, href } of cases) {
    const { window } = createSession(readFixture(fixture), href);
    await applySwitches(window, { blockExploreContents: false, blockForYou: true, blockReels: true });

    assertExploreBlockingClass(window, false);
    assertTileGridVisible(window);
    assertElementVisible(window, EXPLORE_SEARCH_INPUT_TESTID);
    assertElementVisible(window, EXPLORE_ACCOUNT_RESULT_TESTID);
  }
}

async function assertBlockExploreContentsOffRestoresGrid() {
  const { window } = createSession(
    readFixture('explore-main.html'),
    'https://www.instagram.com/explore/',
  );
  await applySwitches(window, { blockExploreContents: false, blockForYou: true, blockReels: true });

  assertExploreBlockingClass(window, false);
  assertTileGridVisible(window);
  assertElementVisible(window, EXPLORE_SEARCH_INPUT_TESTID);
}

async function assertIndependentOfBlockForYou() {
  const { window } = createSession(
    readFixture('explore-main.html'),
    'https://www.instagram.com/explore/',
  );
  await applySwitches(window, { blockExploreContents: true, blockForYou: false, blockReels: true });

  assertTileGridHidden(window);
  assertExploreTablistUsable(window);
}

async function assertClientNavigationToExploreBlocksGrid() {
  const { window } = createSession(
    readFixture('explore-main.html'),
    'https://www.instagram.com/',
  );
  await applySwitches(window, { blockExploreContents: true, blockForYou: false, blockReels: true });

  window.history.pushState({}, '', 'https://www.instagram.com/explore/');
  await settle();

  assertTileGridHidden(window);
  assertElementVisible(window, EXPLORE_SEARCH_INPUT_TESTID);
}

async function assertContentScriptWiresExploreBlock() {
  const storageBundle = createStorageMock({ blockExploreContents: false });
  const { window } = bootContentSession(
    readFixture('explore-main.html'),
    'https://www.instagram.com/explore/',
    storageBundle,
  );
  await settle();

  assertTileGridVisible(window);

  await storageBundle.chrome.storage.local.set({ blockExploreContents: true });
  await settle();

  assertTileGridHidden(window);
  assertElementVisible(window, EXPLORE_SEARCH_INPUT_TESTID);

  await storageBundle.chrome.storage.local.set({ blockExploreContents: false });
  await settle();

  assertTileGridVisible(window);
}

async function assertContentScriptWiresSearchContentGridViaStorage() {
  const storageBundle = createStorageMock({ blockExploreContents: true });
  const { window } = bootContentSession(
    readFixture('explore-keyword.html'),
    'https://www.instagram.com/explore/search/keyword/?q=cats',
    storageBundle,
  );
  await settle();

  assertTileGridHidden(window);

  await storageBundle.chrome.storage.local.set({ blockExploreContents: false });
  await settle();

  assertTileGridVisible(window);
  assertElementVisible(window, EXPLORE_ACCOUNT_RESULT_TESTID);
}

async function runTask41Verify() {
  assertPureRouteHelpers();
  assertHideCssPrefixesEverySelector();
  assertManifestLoadsExploreScript();
  await assertExploreRouteHidesGridBeforeStorage();
  await assertExploreMainBlocked();
  await assertBothExploreTabsHideGrid();
  await assertSidebarSearchOpensExploreWithBlock();
  await assertAccountChoiceOpensProfile();
  await assertSearchContentGridsHiddenWhileOn();
  await assertSearchContentGridsVisibleWhenOff();
  await assertBlockExploreContentsOffRestoresGrid();
  await assertIndependentOfBlockForYou();
  await assertClientNavigationToExploreBlocksGrid();
  await assertContentScriptWiresExploreBlock();
  await assertContentScriptWiresSearchContentGridViaStorage();

  closeDomSessions();
  console.log('task-4.1-verify: all checks passed');
}

await runTask41Verify();
