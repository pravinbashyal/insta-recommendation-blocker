(function () {
  'use strict';

  var FOR_YOU_LABEL = 'For you';
  var FOLLOWING_LABEL = 'Following';
  var NOT_PERSONALIZED_LABEL = 'Not personalized';
  var WWW_HOME_ORIGIN = 'https://www.instagram.com';

  /** @type {boolean} */
  var blockForYou = false;
  /** @type {boolean} */
  var switchesReady = false;

  /**
   * For You tabs we detached, keyed by their tablist, so turning the switch off
   * can put them back without waiting for Instagram to re-render.
   * @type {WeakMap<Element, Element>}
   */
  var detachedForYouByTablist = new WeakMap();

  // ---------------------------------------------------------------------------
  // Route + URL helpers
  // ---------------------------------------------------------------------------

  function isInstagramHost(hostname) {
    return hostname === 'www.instagram.com' || hostname === 'instagram.com';
  }

  function isHomePathname(pathname) {
    return pathname === '/' || pathname === '';
  }

  function isHomeRouteLoc(loc) {
    return isInstagramHost(loc.hostname) && isHomePathname(loc.pathname);
  }

  function parseSearchParams(search) {
    var raw = search && search.charAt(0) === '?' ? search.slice(1) : search || '';
    return new URLSearchParams(raw);
  }

  function getVariant(search) {
    return parseSearchParams(search).get('variant');
  }

  function buildFollowingSearch(search) {
    var params = parseSearchParams(search);
    params.set('variant', 'following');
    var qs = params.toString();
    return qs ? '?' + qs : '?variant=following';
  }

  function buildWwwHomeHref(search) {
    if (!search) {
      return WWW_HOME_ORIGIN + '/';
    }
    if (search.charAt(0) !== '?') {
      search = '?' + search;
    }
    return WWW_HOME_ORIGIN + '/' + search;
  }

  // Redirect the bare home feed (For You) to Following. Favorites and an
  // already-following URL are left exactly as they are.
  function needsFollowingRedirect(loc) {
    if (!blockForYou || !isHomeRouteLoc(loc)) {
      return false;
    }
    var variant = getVariant(loc.search);
    return variant !== 'following' && variant !== 'favorites';
  }

  function navigateToWwwHomeCanonical(url) {
    var testNavigate = globalThis.__IRB_NAVIGATE_WWW_HOME__;
    if (typeof testNavigate === 'function') {
      testNavigate(url);
      return;
    }
    window.location.replace(url);
  }

  function commitFollowingRedirect() {
    if (!needsFollowingRedirect(window.location)) {
      return false;
    }
    navigateToWwwHomeCanonical(buildWwwHomeHref(buildFollowingSearch(window.location.search)));
    return true;
  }

  // ---------------------------------------------------------------------------
  // Tablist helpers — remove only the home feed's "For you" tab
  // ---------------------------------------------------------------------------

  function normalizedTabText(node) {
    return (node.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function tablistContainsLabel(tablist, label) {
    var tabs = tablist.querySelectorAll('[role="tab"]');
    for (var i = 0; i < tabs.length; i += 1) {
      if (normalizedTabText(tabs[i]) === label) {
        return true;
      }
    }
    return false;
  }

  // Explore's tablist is "For you" / "Not personalized"; never touch it.
  function isExploreStyleTablist(tablist) {
    return tablistContainsLabel(tablist, NOT_PERSONALIZED_LABEL);
  }

  function isHomeFeedTablist(tablist) {
    if (isExploreStyleTablist(tablist)) {
      return false;
    }
    return tablistContainsLabel(tablist, FOLLOWING_LABEL);
  }

  function findHomeFeedTablists() {
    var result = [];
    var tablists = document.querySelectorAll('[role="tablist"]');
    for (var i = 0; i < tablists.length; i += 1) {
      if (isHomeFeedTablist(tablists[i])) {
        result.push(tablists[i]);
      }
    }
    return result;
  }

  function findTabByLabel(tablist, label) {
    var tabs = tablist.querySelectorAll('[role="tab"]');
    for (var i = 0; i < tabs.length; i += 1) {
      if (normalizedTabText(tabs[i]) === label) {
        return tabs[i];
      }
    }
    return null;
  }

  function findForYouTab(tablist) {
    return findTabByLabel(tablist, FOR_YOU_LABEL);
  }

  function removeForYouTabs() {
    var tablists = findHomeFeedTablists();
    for (var i = 0; i < tablists.length; i += 1) {
      var forYou = findForYouTab(tablists[i]);
      if (forYou) {
        detachedForYouByTablist.set(tablists[i], forYou);
        forYou.remove();
      }
    }
  }

  function restoreForYouTabs() {
    var tablists = document.querySelectorAll('[role="tablist"]');
    for (var i = 0; i < tablists.length; i += 1) {
      var tablist = tablists[i];
      var stored = detachedForYouByTablist.get(tablist);
      if (stored && !findForYouTab(tablist)) {
        var following = findTabByLabel(tablist, FOLLOWING_LABEL);
        if (following) {
          tablist.insertBefore(stored, following);
        } else {
          tablist.appendChild(stored);
        }
      }
      detachedForYouByTablist.delete(tablist);
    }
  }

  // ---------------------------------------------------------------------------
  // Sync
  // ---------------------------------------------------------------------------

  function syncHomeForYouBlock() {
    if (!switchesReady || !window || !window.location) {
      return;
    }
    if (!blockForYou) {
      restoreForYouTabs();
      return;
    }
    if (!isHomeRouteLoc(window.location)) {
      return;
    }
    // Strip the "For you" tab first so the tablist is clean even on the
    // bare-home pass that is about to redirect, then send the bare feed to
    // Following. On a real redirect the page reloads and runs this again on
    // the committed Following URL; both steps are idempotent.
    removeForYouTabs();
    commitFollowingRedirect();
  }

  // ---------------------------------------------------------------------------
  // Navigation + DOM observation
  // ---------------------------------------------------------------------------

  function interceptHistory() {
    var originalPush = history.pushState;
    var originalReplace = history.replaceState;
    history.pushState = function pushStateWrapper() {
      var result = originalPush.apply(this, arguments);
      syncHomeForYouBlock();
      return result;
    };
    history.replaceState = function replaceStateWrapper() {
      var result = originalReplace.apply(this, arguments);
      syncHomeForYouBlock();
      return result;
    };
    window.addEventListener('popstate', syncHomeForYouBlock);
  }

  /** @type {MutationObserver | null} */
  var homeDomObserver = null;

  // childList/subtree only — never observe attributes. The old implementation
  // observed aria-selected and rewrote it on every sync, which fed its own
  // observer and pinned the main thread. Watching structure only means we react
  // when Instagram actually re-renders the tablist, not to our own edits.
  function observeDom() {
    if (typeof MutationObserver === 'undefined') {
      return;
    }
    homeDomObserver = new MutationObserver(function () {
      syncHomeForYouBlock();
    });
    homeDomObserver.observe(document.documentElement || document, {
      childList: true,
      subtree: true,
    });
  }

  function teardownHomeForYouBlock() {
    if (homeDomObserver) {
      homeDomObserver.disconnect();
      homeDomObserver = null;
    }
  }

  // Send in-app Home clicks straight to Following so there is no stop on the
  // For You feed before the redirect.
  function installHomeSidebarHook() {
    document.addEventListener(
      'click',
      function (event) {
        if (!switchesReady || !blockForYou) {
          return;
        }
        var target = event.target;
        if (!(target instanceof Element)) {
          return;
        }
        var link = target.closest('a[href="/"], a[href="https://www.instagram.com/"]');
        if (!link) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        navigateToWwwHomeCanonical(buildWwwHomeHref(buildFollowingSearch('')));
      },
      true,
    );
  }

  // ---------------------------------------------------------------------------
  // Public interface
  // ---------------------------------------------------------------------------

  function setBlockForYou(on) {
    blockForYou = on !== false;
    switchesReady = true;
    syncHomeForYouBlock();
  }

  function applySwitchesFromStorage(switches) {
    blockForYou = switches.blockForYou !== false;
    switchesReady = true;
    syncHomeForYouBlock();
  }

  interceptHistory();
  observeDom();
  installHomeSidebarHook();

  globalThis.__IRB_HOME_FOR_YOU__ = {
    setBlockForYou: setBlockForYou,
    applySwitchesFromStorage: applySwitchesFromStorage,
    sync: syncHomeForYouBlock,
    isHomeRouteLoc: isHomeRouteLoc,
    getVariant: getVariant,
    needsFollowingRedirect: needsFollowingRedirect,
    buildFollowingSearch: buildFollowingSearch,
    buildWwwHomeHref: buildWwwHomeHref,
    findHomeFeedTablists: findHomeFeedTablists,
    findForYouTab: findForYouTab,
    isSwitchesReady: function () {
      return switchesReady;
    },
    teardown: teardownHomeForYouBlock,
  };
})();
