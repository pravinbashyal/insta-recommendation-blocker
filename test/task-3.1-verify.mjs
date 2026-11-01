import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { JSDOM } from 'jsdom';

import {
  FOLLOWING_HOME_HREF,
  WWW_HOME_HREF,
  isProfileReelPathname,
  isReelsDestinationPathname,
  isReelsDestinationRoute,
  isReelsSidebarHref,
  isReelsViewerPathname,
  isSingleReelPathname,
  reelsHomeTarget,
} from '../extension/lib/reels-viewer-block.js';
import { findForYouTab } from '../extension/lib/home-for-you-block.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionDir = path.join(__dirname, '..', 'extension');
const fixtureDir = path.join(__dirname, 'fixtures', 'reels');
const homeFixtureDir = path.join(__dirname, 'fixtures', 'home');
const homeScriptPath = path.join(extensionDir, 'content', 'home-for-you-block.js');
const reelsScriptPath = path.join(extensionDir, 'content', 'reels-viewer-block.js');
const contentScriptPath = path.join(extensionDir, 'content', 'content.js');
const manifestPath = path.join(extensionDir, 'manifest.json');

/** @type {Array<{ dom: import('jsdom').JSDOM, api?: { teardown?: () => void } }>} */
const openDomSessions = [];

function readFixture(name) {
  return fs.readFileSync(path.join(fixtureDir, name), 'utf8');
}

function readHomeFixture(name) {
  return fs.readFileSync(path.join(homeFixtureDir, name), 'utf8');
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
}

async function applySwitches(window, switches) {
  window.__IRB_REELS_VIEWER__.applySwitchesFromStorage(switches);
  window.__IRB_HOME_FOR_YOU__.applySwitchesFromStorage(switches);
  await settle();
}

function createSession(html, href) {
  const dom = new JSDOM(html, {
    url: href,
    pretendToBeVisual: true,
    runScripts: 'outside-only',
  });

  const { window } = dom;
  /** @type {string[]} */
  const navigations = [];
  window.__IRB_NAVIGATE_WWW_HOME__ = (url) => {
    navigations.push(String(url));
    dom.reconfigure({ url: String(url) });
  };

  loadScripts(window);
  assert.ok(window.__IRB_REELS_VIEWER__);
  assert.ok(window.__IRB_HOME_FOR_YOU__);

  openDomSessions.push({ dom, api: window.__IRB_HOME_FOR_YOU__ });
  return { window, dom, navigations };
}

function bootContentSession(html, href, storageBundle) {
  const dom = new JSDOM(html, {
    url: href,
    pretendToBeVisual: true,
    runScripts: 'outside-only',
  });
  const { window } = dom;
  window.chrome = storageBundle.chrome;
  /** @type {string[]} */
  const navigations = [];
  window.__IRB_NAVIGATE_WWW_HOME__ = (url) => {
    navigations.push(String(url));
    dom.reconfigure({ url: String(url) });
  };
  loadScripts(window);
  window.eval(`${fs.readFileSync(contentScriptPath, 'utf8')}\n//# sourceURL=content.js`);
  openDomSessions.push({ dom, api: window.__IRB_HOME_FOR_YOU__ });
  return { window, dom, storageBundle, navigations };
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

function assertPureRouteHelpers() {
  assert.equal(isReelsDestinationPathname('/reels/'), true);
  assert.equal(isReelsDestinationPathname('/reels'), true);
  assert.equal(isReelsDestinationPathname('/reel/ABC123/'), false);
  assert.equal(isReelsDestinationPathname('/reels/SHORT999/'), false);
  assert.equal(isReelsDestinationRoute({ hostname: 'www.instagram.com', pathname: '/reels/' }), true);

  // A single reel, a profile reel, and the in-feed reel viewer all stay.
  assert.equal(isSingleReelPathname('/reel/ABC123/'), true);
  assert.equal(isSingleReelPathname('/reels/'), false);
  assert.equal(isProfileReelPathname('/someuser/reel/ABC123/'), true);
  assert.equal(isProfileReelPathname('/someuser/reels/'), false);
  assert.equal(isReelsViewerPathname('/reels/SHORT999/'), true);
  assert.equal(isReelsViewerPathname('/reels/'), false);

  assert.equal(isReelsSidebarHref('/reels/'), true);
  assert.equal(isReelsSidebarHref('https://www.instagram.com/reels/'), true);
  assert.equal(isReelsSidebarHref('/reel/ABC123/'), false);

  assert.equal(WWW_HOME_HREF, 'https://www.instagram.com/');
  assert.equal(FOLLOWING_HOME_HREF, 'https://www.instagram.com/?variant=following');
  assert.equal(reelsHomeTarget(true), FOLLOWING_HOME_HREF);
  assert.equal(reelsHomeTarget(false), WWW_HOME_HREF);
}

function assertManifestLoadsReelsScript() {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const scripts = manifest.content_scripts[0].js;
  assert.equal(scripts[1], 'content/reels-viewer-block.js');
}

async function assertReelsDestinationLeavesForFollowing() {
  for (const href of [
    'https://www.instagram.com/reels/',
    'https://www.instagram.com/reels/?hl=en',
    'https://www.instagram.com/reels',
  ]) {
    const { window, navigations } = createSession(readFixture('reels-viewer.html'), href);
    await applySwitches(window, { blockReels: true, blockForYou: true });

    assert.equal(navigations[navigations.length - 1], FOLLOWING_HOME_HREF);
    assert.equal(window.location.pathname, '/');
    assert.match(window.location.search, /variant=following/);
  }
}

async function assertReelsDestinationLeavesForBareHomeWhenForYouAllowed() {
  const { window, navigations } = createSession(
    readFixture('reels-viewer.html'),
    'https://www.instagram.com/reels/',
  );
  await applySwitches(window, { blockReels: true, blockForYou: false });

  assert.equal(navigations[navigations.length - 1], WWW_HOME_HREF);
  assert.equal(window.location.pathname, '/');
  assert.equal(window.location.search, '');
}

async function assertSidebarReelsControlLeavesForHome() {
  const { window } = createSession(
    readHomeFixture('sidebar-context.html'),
    'https://www.instagram.com/explore/',
  );
  /** @type {string | null} */
  let navigatedTo = null;
  window.__IRB_NAVIGATE_WWW_HOME__ = (url) => {
    navigatedTo = String(url);
  };
  await applySwitches(window, { blockReels: true, blockForYou: true });

  const reelsLink = window.document.querySelector('[data-testid="sidebar-reels"]');
  assert.ok(reelsLink);
  reelsLink.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  await settle();

  assert.equal(navigatedTo, FOLLOWING_HOME_HREF);
}

async function assertHomeAfterReelsStripsForYou() {
  const homeHtml = readHomeFixture('logged-in-home.html');
  const { window, dom, navigations } = createSession(
    readFixture('reels-viewer.html'),
    'https://www.instagram.com/reels/',
  );
  await applySwitches(window, { blockReels: true, blockForYou: true });
  assert.equal(navigations[navigations.length - 1], FOLLOWING_HOME_HREF);

  // Simulate the reload landing on the home document.
  window.document.body.innerHTML = new JSDOM(homeHtml).window.document.body.innerHTML;
  window.__IRB_HOME_FOR_YOU__.sync();
  await settle();

  assert.match(window.location.search, /variant=following/);
  assert.equal(findForYouTab(getHomeTablist(window)), null);
}

async function assertSingleReelStillLoads() {
  const { window, navigations } = createSession(
    readFixture('single-reel.html'),
    'https://www.instagram.com/reel/ABC123/',
  );
  await applySwitches(window, { blockReels: true, blockForYou: true });

  assert.equal(navigations.length, 0);
  assert.equal(window.location.pathname, '/reel/ABC123/');
  assert.ok(window.document.querySelector('[data-testid="single-reel-viewer"]'));
}

async function assertUserReelStillLoads() {
  const { window, navigations } = createSession(
    readFixture('user-reel.html'),
    'https://www.instagram.com/someuser/reel/ABC123/',
  );
  await applySwitches(window, { blockReels: true, blockForYou: true });

  assert.equal(navigations.length, 0);
  assert.equal(window.location.pathname, '/someuser/reel/ABC123/');
  assert.ok(window.document.querySelector('[data-testid="profile-reel-viewer"]'));
}

async function assertProfileReelsTabStillLoads() {
  const { window, navigations } = createSession(
    readFixture('profile-reels-tab.html'),
    'https://www.instagram.com/someuser/',
  );
  await applySwitches(window, { blockReels: true, blockForYou: true });

  assert.equal(navigations.length, 0);
  assert.equal(window.location.pathname, '/someuser/');
  assert.ok(window.document.querySelector('[data-testid="profile-reels-grid"]'));
  assert.ok(window.document.querySelector('[data-testid="profile-tablist"]')?.textContent.includes('Reels'));
}

async function assertInFeedReelsViewerStillLoads() {
  // `/reels/<id>/` is the in-feed reel viewer and stays accessible — only the
  // bare `/reels/` destination is blocked.
  const { window, navigations } = createSession(
    readFixture('reels-viewer.html'),
    'https://www.instagram.com/reels/SHORT999/',
  );
  await applySwitches(window, { blockReels: true, blockForYou: true });

  assert.equal(navigations.length, 0);
  assert.equal(window.location.pathname, '/reels/SHORT999/');
  assert.ok(window.document.querySelector('[data-testid="reels-viewer"]'));
}

async function assertHomeFeedReelPostRemains() {
  const { window, navigations } = createSession(
    readFixture('home-reel-post.html'),
    'https://www.instagram.com/?variant=following',
  );
  await applySwitches(window, { blockReels: true, blockForYou: true });

  assert.equal(navigations.length, 0);
  assert.ok(window.document.querySelector('[data-testid="feed-reel-post"]'));
  assert.equal(findForYouTab(getHomeTablist(window)), null);
}

async function assertBlockReelsOffOpensViewer() {
  for (const href of ['https://www.instagram.com/reels/', 'https://www.instagram.com/reels/?hl=en']) {
    const { window, navigations } = createSession(readFixture('reels-viewer.html'), href);
    await applySwitches(window, { blockReels: false, blockForYou: true });

    assert.equal(navigations.length, 0);
    assert.match(window.location.pathname, /^\/reels\/?$/);
    assert.ok(window.document.querySelector('[data-testid="reels-viewer"]'));
  }

  // Block off then client-navigate to /reels/ — the viewer still opens.
  const { window } = createSession(
    readHomeFixture('sidebar-context.html'),
    'https://www.instagram.com/explore/',
  );
  /** @type {string | null} */
  let navigatedTo = null;
  window.__IRB_NAVIGATE_WWW_HOME__ = (url) => {
    navigatedTo = String(url);
  };
  await applySwitches(window, { blockReels: false, blockForYou: true });
  window.history.pushState({}, '', 'https://www.instagram.com/reels/');
  window.__IRB_REELS_VIEWER__.sync();
  await settle();

  assert.equal(navigatedTo, null);
  assert.equal(window.location.pathname, '/reels/');
}

async function assertSidebarReelsIconHiddenWhileBlocked() {
  const { window } = createSession(
    readHomeFixture('sidebar-context.html'),
    'https://www.instagram.com/',
  );
  // A content reel link that must stay visible (only the exact /reels/ nav
  // entry is hidden).
  const contentReel = window.document.createElement('a');
  contentReel.setAttribute('href', '/reels/DfNqg8bo1Q4/');
  contentReel.setAttribute('data-testid', 'content-reel-link');
  contentReel.textContent = 'a reel in content';
  window.document.body.appendChild(contentReel);

  const navIcon = window.document.querySelector('[data-testid="sidebar-reels"]');
  assert.ok(navIcon);

  await applySwitches(window, { blockReels: true, blockForYou: true });
  assert.ok(
    window.document.documentElement.classList.contains(window.__IRB_REELS_VIEWER__.NAV_HIDE_CLASS),
    'root carries the nav-hide class while blocking',
  );
  assert.equal(window.getComputedStyle(navIcon).display, 'none', 'sidebar Reels icon hidden');
  assert.notEqual(
    window.getComputedStyle(contentReel).display,
    'none',
    'a content reel link is not hidden',
  );

  // Turning Block Reels off restores the icon.
  window.__IRB_REELS_VIEWER__.setBlockReels(false);
  await settle();
  assert.equal(
    window.document.documentElement.classList.contains(window.__IRB_REELS_VIEWER__.NAV_HIDE_CLASS),
    false,
  );
  assert.notEqual(window.getComputedStyle(navIcon).display, 'none', 'sidebar Reels icon restored');
}

async function assertClientNavigationToReelsBlocked() {
  const { window, navigations } = createSession(
    readFixture('reels-viewer.html'),
    'https://www.instagram.com/explore/',
  );
  await applySwitches(window, { blockReels: true, blockForYou: false });

  window.history.pushState({}, '', 'https://www.instagram.com/reels/?hl=en');
  await settle();

  assert.equal(navigations[navigations.length - 1], WWW_HOME_HREF);
  assert.equal(window.location.pathname, '/');
}

async function assertContentScriptWiresReelsBlock() {
  const storageBundle = createStorageMock({ blockReels: false, blockForYou: false });
  const { window } = bootContentSession(
    readFixture('reels-viewer.html'),
    'https://www.instagram.com/reels/',
    storageBundle,
  );
  await settle();

  assert.equal(window.location.pathname, '/reels/');
  assert.ok(window.document.querySelector('[data-testid="reels-viewer"]'));

  await storageBundle.chrome.storage.local.set({ blockReels: true });
  await settle();
  assert.equal(window.location.pathname, '/');
}

async function runTask31Verify() {
  assertPureRouteHelpers();
  assertManifestLoadsReelsScript();
  await assertReelsDestinationLeavesForFollowing();
  await assertReelsDestinationLeavesForBareHomeWhenForYouAllowed();
  await assertSidebarReelsControlLeavesForHome();
  await assertHomeAfterReelsStripsForYou();
  await assertSingleReelStillLoads();
  await assertUserReelStillLoads();
  await assertProfileReelsTabStillLoads();
  await assertInFeedReelsViewerStillLoads();
  await assertHomeFeedReelPostRemains();
  await assertBlockReelsOffOpensViewer();
  await assertSidebarReelsIconHiddenWhileBlocked();
  await assertClientNavigationToReelsBlocked();
  await assertContentScriptWiresReelsBlock();

  closeDomSessions();
  console.log('task-3.1-verify: all checks passed');
}

await runTask31Verify();
