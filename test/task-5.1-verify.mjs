import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { JSDOM } from 'jsdom';

import { EXPLORE_HIDE_CLASS } from '../extension/lib/explore-discovery-block.js';
import { findForYouTab } from '../extension/lib/home-for-you-block.js';
import { WWW_HOME_HREF } from '../extension/lib/reels-viewer-block.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionDir = path.join(__dirname, '..', 'extension');
const integrationFixtureDir = path.join(__dirname, 'fixtures', 'integration');
const homeFixtureDir = path.join(__dirname, 'fixtures', 'home');
const exploreFixtureDir = path.join(__dirname, 'fixtures', 'explore');
const reelsFixtureDir = path.join(__dirname, 'fixtures', 'reels');

const homeScriptPath = path.join(extensionDir, 'content', 'home-for-you-block.js');
const reelsScriptPath = path.join(extensionDir, 'content', 'reels-viewer-block.js');
const exploreScriptPath = path.join(extensionDir, 'content', 'explore-discovery-block.js');
const contentScriptPath = path.join(extensionDir, 'content', 'content.js');

/** @type {Array<{ dom: import('jsdom').JSDOM, api?: { teardown?: () => void } }>} */
const openDomSessions = [];

function readFixture(dir, name) {
  return fs.readFileSync(path.join(dir, name), 'utf8');
}

function bodyHtmlFromFixture(dir, name) {
  const dom = new JSDOM(readFixture(dir, name));
  const html = dom.window.document.body.innerHTML;
  dom.window.close();
  return html;
}

const PAGE_BODIES = {
  home: bodyHtmlFromFixture(homeFixtureDir, 'logged-in-home.html'),
  explore: bodyHtmlFromFixture(exploreFixtureDir, 'explore-main.html'),
  reels: bodyHtmlFromFixture(reelsFixtureDir, 'reels-viewer.html'),
  inbox: bodyHtmlFromFixture(integrationFixtureDir, 'direct-inbox.html'),
  profile: bodyHtmlFromFixture(exploreFixtureDir, 'profile.html'),
  post: bodyHtmlFromFixture(integrationFixtureDir, 'single-post.html'),
};

/** @type {Array<{ blockForYou: boolean, blockReels: boolean, blockExploreContents: boolean }>} */
const SWITCH_COMBINATIONS = [
  { blockForYou: true, blockReels: true, blockExploreContents: true },
  { blockForYou: false, blockReels: true, blockExploreContents: true },
  { blockForYou: true, blockReels: false, blockExploreContents: true },
  { blockForYou: true, blockReels: true, blockExploreContents: false },
  { blockForYou: false, blockReels: false, blockExploreContents: true },
  { blockForYou: false, blockReels: true, blockExploreContents: false },
  { blockForYou: true, blockReels: false, blockExploreContents: false },
  { blockForYou: false, blockReels: false, blockExploreContents: false },
];

const REACHABLE_CASES = [
  {
    href: 'https://www.instagram.com/direct/inbox/',
    bodyKey: 'inbox',
    pathPrefix: '/direct/inbox',
    testid: 'direct-inbox',
  },
  {
    href: 'https://www.instagram.com/catlover/',
    bodyKey: 'profile',
    pathPrefix: '/catlover',
    testid: 'profile-username',
  },
  {
    href: 'https://www.instagram.com/p/ABC123/',
    bodyKey: 'post',
    pathPrefix: '/p/ABC123',
    testid: 'single-post',
  },
];

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
  for (let i = 0; i < 16; i += 1) {
    await Promise.resolve();
  }
}

function loadScripts(window) {
  window.eval(`${fs.readFileSync(homeScriptPath, 'utf8')}\n//# sourceURL=home-for-you-block.js`);
  window.eval(`${fs.readFileSync(reelsScriptPath, 'utf8')}\n//# sourceURL=reels-viewer-block.js`);
  window.eval(`${fs.readFileSync(exploreScriptPath, 'utf8')}\n//# sourceURL=explore-discovery-block.js`);
}

function installWwwHomeNavigation(window, dom) {
  window.__IRB_NAVIGATE_WWW_HOME__ = (url) => {
    dom.reconfigure({ url: String(url) });
  };
}

function bootIntegrationSession(href, storageBundle) {
  const dom = new JSDOM(readFixture(homeFixtureDir, 'logged-in-home.html'), {
    url: href,
    pretendToBeVisual: true,
    runScripts: 'outside-only',
  });
  const { window } = dom;
  window.chrome = storageBundle.chrome;
  installWwwHomeNavigation(window, dom);
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

function getHomeTablist(window) {
  return window.document.querySelector('[data-testid="home-feed-tablist"]') ||
    window.document.querySelector('main [role="tablist"]');
}

function findFollowingTab(tablist) {
  for (const tab of tablist.querySelectorAll('[role="tab"]')) {
    if (tab.textContent.trim() === 'Following') {
      return tab;
    }
  }
  return null;
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

async function navigateSession(window, dom, href, bodyKey) {
  window.document.body.innerHTML = PAGE_BODIES[bodyKey];
  window.history.pushState({}, '', href);
  dom.reconfigure({ url: href });
  window.__IRB_HOME_FOR_YOU__.sync();
  window.__IRB_REELS_VIEWER__.sync();
  window.__IRB_EXPLORE_DISCOVERY__.sync();
  await settle();
}

function assertHomeForYouBlocked(window) {
  const tablist = getHomeTablist(window);
  assert.ok(tablist, 'expected home tablist');
  assert.equal(findForYouTab(tablist), null);
  assert.match(window.location.search, /variant=following/);
}

function assertHomeForYouRestored(window) {
  assert.equal(window.location.href, 'https://www.instagram.com/');
  assert.equal(window.location.search, '');

  const tablist = getHomeTablist(window);
  assert.ok(tablist, 'expected home tablist');
  assert.ok(tablist.textContent.includes('Following'), 'Following tab should be present');

  const forYou = findForYouTab(tablist);
  assert.ok(forYou, 'For you tab should be present');
  assert.equal(forYou.getAttribute('aria-selected'), 'true');

  const following = findFollowingTab(tablist);
  assert.ok(following, 'Following tab should be present');
  assert.notEqual(following.getAttribute('aria-selected'), 'true');

  assert.equal(
    window.document.documentElement.classList.contains('irb-home-blocking'),
    false,
  );
}

function assertExploreGridHidden(window) {
  const tiles = getExplorePostTileLinks(window);
  assert.ok(tiles.length > 0, 'expected explore post/reel tile links in DOM');
  for (const tile of tiles) {
    assert.equal(window.getComputedStyle(tile).display, 'none');
  }
}

function assertExploreGridVisible(window) {
  const tiles = getExplorePostTileLinks(window);
  assert.ok(tiles.length > 0, 'expected explore post/reel tile links in DOM');
  for (const tile of tiles) {
    assert.notEqual(window.getComputedStyle(tile).display, 'none');
  }
  assert.equal(
    window.document.documentElement.classList.contains(EXPLORE_HIDE_CLASS),
    false,
  );
}

function assertReelsBlocked(window, navigatedTo, blockForYou = true) {
  assert.equal(
    navigatedTo,
    blockForYou ? 'https://www.instagram.com/?variant=following' : WWW_HOME_HREF,
  );
  assert.match(window.location.pathname, /^\/?$/);
  assert.equal(window.document.documentElement.classList.contains('irb-reels-blocking'), false);
}

function assertReelsViewerOpen(window, navigatedTo) {
  assert.equal(navigatedTo, null);
  assert.match(window.location.pathname, /^\/reels\/?$/);
  assert.ok(window.document.querySelector('[data-testid="reels-viewer"]'));
}

function assertReachablePage(window, expectedPathPrefix, testid) {
  assert.ok(window.location.pathname.startsWith(expectedPathPrefix), window.location.pathname);
  const el = window.document.querySelector(`[data-testid="${testid}"]`);
  assert.ok(el, `expected [data-testid="${testid}"] on ${window.location.pathname}`);
  assert.notEqual(window.getComputedStyle(el).display, 'none');
  assert.notEqual(window.getComputedStyle(el).visibility, 'hidden');
  assert.equal(
    window.document.documentElement.classList.contains('irb-home-blocking'),
    false,
  );
  assert.equal(
    window.document.documentElement.classList.contains('irb-reels-blocking'),
    false,
  );
}

async function applyAllSwitches(storageBundle, switches) {
  await storageBundle.chrome.storage.local.set({
    blockForYou: switches.blockForYou,
    blockReels: switches.blockReels,
    blockExploreContents: switches.blockExploreContents,
  });
  await settle();
}

async function assertCrossToggleIntegrationSession() {
  const storageBundle = createStorageMock();
  const { window, dom } = bootIntegrationSession('https://www.instagram.com/', storageBundle);
  await settle();

  assertHomeForYouBlocked(window);
  await navigateSession(window, dom, 'https://www.instagram.com/explore/', 'explore');
  assertExploreGridHidden(window);

  /** @type {string | null} */
  let navigatedTo = null;
  window.__IRB_NAVIGATE_WWW_HOME__ = (url) => {
    navigatedTo = String(url);
    dom.reconfigure({ url: String(url) });
  };

  await navigateSession(window, dom, 'https://www.instagram.com/reels/', 'reels');
  assertReelsBlocked(window, navigatedTo, true);

  await applyAllSwitches(storageBundle, {
    blockForYou: false,
    blockReels: true,
    blockExploreContents: true,
  });
  await navigateSession(window, dom, 'https://www.instagram.com/', 'home');
  assertHomeForYouRestored(window);

  await navigateSession(window, dom, 'https://www.instagram.com/explore/', 'explore');
  assertExploreGridHidden(window);

  navigatedTo = null;
  await navigateSession(window, dom, 'https://www.instagram.com/reels/', 'reels');
  assertReelsBlocked(window, navigatedTo, false);

  await applyAllSwitches(storageBundle, {
    blockForYou: true,
    blockReels: true,
    blockExploreContents: false,
  });
  await navigateSession(window, dom, 'https://www.instagram.com/explore/', 'explore');
  assertExploreGridVisible(window);

  await navigateSession(window, dom, 'https://www.instagram.com/', 'home');
  assertHomeForYouBlocked(window);

  navigatedTo = null;
  await navigateSession(window, dom, 'https://www.instagram.com/reels/', 'reels');
  assertReelsBlocked(window, navigatedTo, true);

  await applyAllSwitches(storageBundle, {
    blockForYou: true,
    blockReels: false,
    blockExploreContents: true,
  });
  navigatedTo = null;
  await navigateSession(window, dom, 'https://www.instagram.com/reels/', 'reels');
  assertReelsViewerOpen(window, navigatedTo);

  await navigateSession(window, dom, 'https://www.instagram.com/', 'home');
  assertHomeForYouBlocked(window);

  await navigateSession(window, dom, 'https://www.instagram.com/explore/', 'explore');
  assertExploreGridHidden(window);

  for (const combo of SWITCH_COMBINATIONS) {
    await applyAllSwitches(storageBundle, combo);

    assert.equal(window.document.documentElement.dataset.irbBlockForYou, String(combo.blockForYou));
    assert.equal(window.document.documentElement.dataset.irbBlockReels, String(combo.blockReels));
    assert.equal(
      window.document.documentElement.dataset.irbBlockExploreContents,
      String(combo.blockExploreContents),
    );

    for (const page of REACHABLE_CASES) {
      await navigateSession(window, dom, page.href, page.bodyKey);
      assertReachablePage(window, page.pathPrefix, page.testid);
    }
  }
}

async function runTask51Verify() {
  await assertCrossToggleIntegrationSession();

  closeDomSessions();
  console.log('task-5.1-verify: all checks passed');
}

await runTask51Verify();
