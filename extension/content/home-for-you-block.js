(function () {
  'use strict';

  var FOR_YOU_LABEL = 'For you';
  var FOLLOWING_LABEL = 'Following';
  var FAVORITES_LABEL = 'Favorites';
  var EXPLORE_NOT_PERSONALIZED_LABEL = 'Not personalized';
  var WWW_HOME_ORIGIN = 'https://www.instagram.com';
  var HIDE_CLASS = 'irb-home-blocking';
  var STYLE_ID = 'irb-home-for-you-hide-style';
  /** @type {boolean} */
  var blockForYou = false;

  /** @type {boolean} */
  var switchesReady = false;

  /** @type {number} */
  var redirectGuard = 0;

  /** @type {boolean} */
  var extensionCommittedFollowing = false;

  /** @type {WeakMap<Element, Element>} */
  var detachedForYouByTablist = new WeakMap();

  /** @type {boolean} */
  var syncingHomeBlock = false;

  /** @type {boolean} */
  var extensionInitiatedNavigation = false;

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

  function needsFollowingVariant(active, search) {
    if (!active) {
      return false;
    }
    var variant = getVariant(search);
    if (variant === 'favorites' || variant === 'following') {
      return false;
    }
    return true;
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

  function navigateToWwwHomeCanonical(url) {
    var testNavigate = globalThis.__IRB_NAVIGATE_WWW_HOME__;
    if (typeof testNavigate === 'function') {
      testNavigate(url);
      return;
    }
    window.location.replace(url);
  }

  function markExtensionCommittedFollowing(done) {
    extensionCommittedFollowing = true;
    done();
  }

  function clearExtensionCommitFlag() {
    extensionCommittedFollowing = false;
  }

  function buildCommittedHomeSearch(active, search) {
    if (needsFollowingVariant(active, search)) {
      return buildFollowingSearch(search);
    }
    return search || '';
  }

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

  function isExploreStyleTablist(tablist) {
    return tablistContainsLabel(tablist, EXPLORE_NOT_PERSONALIZED_LABEL);
  }

  function isHomeFeedTablist(tablist) {
    if (isExploreStyleTablist(tablist)) {
      return false;
    }
    return tablistContainsLabel(tablist, FOLLOWING_LABEL);
  }

  function findHomeFeedTablists(onHomeRoute) {
    if (!onHomeRoute) {
      return [];
    }
    var result = [];
    var tablists = document.querySelectorAll('[role="tablist"]');
    for (var i = 0; i < tablists.length; i += 1) {
      if (isHomeFeedTablist(tablists[i])) {
        result.push(tablists[i]);
      }
    }
    return result;
  }

  function findForYouTab(tablist) {
    var tabs = tablist.querySelectorAll('[role="tab"]');
    for (var i = 0; i < tabs.length; i += 1) {
      if (normalizedTabText(tabs[i]) === FOR_YOU_LABEL) {
        return tabs[i];
      }
    }
    return null;
  }

  function findFollowingTab(tablist) {
    var tabs = tablist.querySelectorAll('[role="tab"]');
    for (var i = 0; i < tabs.length; i += 1) {
      if (normalizedTabText(tabs[i]) === FOLLOWING_LABEL) {
        return tabs[i];
      }
    }
    return null;
  }

  function findFavoritesTab(tablist) {
    var tabs = tablist.querySelectorAll('[role="tab"]');
    for (var i = 0; i < tabs.length; i += 1) {
      if (normalizedTabText(tabs[i]) === FAVORITES_LABEL) {
        return tabs[i];
      }
    }
    return null;
  }

  function hasDisabledForYouTab(tablist) {
    var tab = findForYouTab(tablist);
    if (!tab) {
      return false;
    }
    return (
      tab.getAttribute('aria-disabled') === 'true' ||
      tab.hasAttribute('disabled') ||
      tab.classList.contains('disabled')
    );
  }

  function hasLoggedOutLoginUi() {
    if (document.querySelector('input[name="username"]')) {
      return true;
    }
    if (document.querySelector('form#loginForm')) {
      return true;
    }
    if (document.querySelector('[data-testid="login-page"]')) {
      return true;
    }
    return false;
  }

  function hasLoggedInHomeShell() {
    if (hasLoggedOutLoginUi()) {
      return false;
    }
    if (document.querySelector('[data-testid="logged-in-home-shell"]')) {
      return true;
    }
    if (document.querySelector('[data-testid="mobile-nav-home-link"]')) {
      return true;
    }
    if (document.querySelector('nav[data-testid="sidebar"] a[href="/"], nav[data-testid="sidebar"] a[href="https://www.instagram.com/"]')) {
      return true;
    }
    var tablists = document.querySelectorAll('[role="tablist"]');
    for (var i = 0; i < tablists.length; i += 1) {
      if (isHomeFeedTablist(tablists[i])) {
        return true;
      }
    }
    return false;
  }

  function shouldRewriteLoggedInHome(active) {
    if (!active) {
      return false;
    }
    if (hasLoggedOutLoginUi()) {
      return false;
    }
    return hasLoggedInHomeShell();
  }

  function needsHomeUrlCommit(active, loc) {
    if (!active || !shouldRewriteLoggedInHome(active) || !isHomeRouteLoc(loc)) {
      return false;
    }
    if (getVariant(loc.search) === 'favorites') {
      return false;
    }
    if (loc.hostname === 'instagram.com') {
      return true;
    }
    return needsFollowingVariant(active, loc.search);
  }

  function restoreForYouTab(tablist) {
    var stored = detachedForYouByTablist.get(tablist);
    if (stored && !findForYouTab(tablist)) {
      var following = findFollowingTab(tablist);
      if (following) {
        tablist.insertBefore(stored, following);
      } else {
        tablist.appendChild(stored);
      }
    }
    detachedForYouByTablist.delete(tablist);
  }

  function selectForYouTab(tablist) {
    var forYou = findForYouTab(tablist);
    if (!forYou) {
      return;
    }
    var tabs = tablist.querySelectorAll('[role="tab"]');
    for (var i = 0; i < tabs.length; i += 1) {
      tabs[i].setAttribute('aria-selected', tabs[i] === forYou ? 'true' : 'false');
    }
  }

  function selectFollowingTab(tablist) {
    var following = findFollowingTab(tablist);
    if (!following) {
      return;
    }
    var tabs = tablist.querySelectorAll('[role="tab"]');
    for (var i = 0; i < tabs.length; i += 1) {
      tabs[i].setAttribute('aria-selected', tabs[i] === following ? 'true' : 'false');
    }
  }

  function selectFavoritesTab(tablist) {
    var favorites = findFavoritesTab(tablist);
    if (!favorites) {
      return;
    }
    var tabs = tablist.querySelectorAll('[role="tab"]');
    for (var i = 0; i < tabs.length; i += 1) {
      tabs[i].setAttribute('aria-selected', tabs[i] === favorites ? 'true' : 'false');
    }
  }

  function shouldLeaveFavoritesSelection(search) {
    return getVariant(search) === 'favorites';
  }

  function applyHomeTablistBlock(tablist, active) {
    if (!active) {
      restoreForYouTab(tablist);
      var variant = getVariant(window.location.search);
      if (variant === 'following') {
        selectFollowingTab(tablist);
      } else if (variant !== 'favorites') {
        selectForYouTab(tablist);
      }
      return;
    }
    var forYou = findForYouTab(tablist);
    if (forYou) {
      forYou.setAttribute('aria-selected', 'false');
      detachedForYouByTablist.set(tablist, forYou);
      forYou.remove();
    }
    if (shouldLeaveFavoritesSelection(window.location.search)) {
      selectFavoritesTab(tablist);
      return;
    }
    var following = findFollowingTab(tablist);
    if (following) {
      var tabs = tablist.querySelectorAll('[role="tab"]');
      for (var i = 0; i < tabs.length; i += 1) {
        tabs[i].setAttribute('aria-selected', tabs[i] === following ? 'true' : 'false');
      }
    }
  }

  function isHomeSurfaceCommitted(active, search, onHomeRoute) {
    if (!onHomeRoute) {
      return true;
    }
    if (!active) {
      return true;
    }
    if (!shouldRewriteLoggedInHome(active)) {
      return true;
    }
    if (window.location.hostname === 'instagram.com' && getVariant(search) !== 'favorites') {
      return false;
    }
    var tablists = findHomeFeedTablists(onHomeRoute);
    if (tablists.length === 0) {
      return false;
    }
    if (getVariant(search) === 'favorites') {
      for (var f = 0; f < tablists.length; f += 1) {
        if (findForYouTab(tablists[f]) || hasDisabledForYouTab(tablists[f])) {
          return false;
        }
      }
      return true;
    }
    if (needsFollowingVariant(active, search)) {
      return false;
    }
    for (var i = 0; i < tablists.length; i += 1) {
      if (findForYouTab(tablists[i]) || hasDisabledForYouTab(tablists[i])) {
        return false;
      }
      var following = findFollowingTab(tablists[i]);
      if (following && following.getAttribute('aria-selected') !== 'true') {
        return false;
      }
    }
    return true;
  }

  function shouldHideHomeSurface(active, search, onHomeRoute) {
    if (!onHomeRoute) {
      return false;
    }
    if (!switchesReady) {
      return hasLoggedInHomeShell() && !hasLoggedOutLoginUi();
    }
    if (!active) {
      return false;
    }
    if (!shouldRewriteLoggedInHome(active)) {
      return false;
    }
    return !isHomeSurfaceCommitted(active, search, onHomeRoute);
  }

  function ensureHideStyle() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent =
      'html.' +
      HIDE_CLASS +
      ' > body { visibility: hidden !important; }';
    var parent = document.documentElement || document.head || document;
    parent.appendChild(style);
  }

  function setHomeHidden(hidden) {
    var root = document.documentElement;
    if (!root) {
      return;
    }
    if (hidden) {
      root.classList.add(HIDE_CLASS);
    } else {
      root.classList.remove(HIDE_CLASS);
    }
  }

  function commitFollowingUrl(active) {
    if (!switchesReady || !needsHomeUrlCommit(active, window.location)) {
      return;
    }
    if (redirectGuard > 2) {
      return;
    }
    redirectGuard += 1;
    var nextSearch = buildCommittedHomeSearch(active, window.location.search);
    extensionInitiatedNavigation = true;
    if (window.location.hostname === 'instagram.com') {
      var target = buildWwwHomeHref(nextSearch);
      markExtensionCommittedFollowing(function () {
        navigateToWwwHomeCanonical(target);
      });
      return;
    }
    if (!needsFollowingVariant(active, window.location.search)) {
      redirectGuard -= 1;
      extensionInitiatedNavigation = false;
      return;
    }
    markExtensionCommittedFollowing(function () {
      history.replaceState(
        history.state,
        '',
        window.location.pathname + nextSearch + window.location.hash,
      );
    });
  }

  function releaseExtensionFollowingUrl() {
    if (blockForYou) {
      return;
    }
    if (!extensionCommittedFollowing) {
      return;
    }
    if (!isHomeRouteLoc(window.location)) {
      extensionCommittedFollowing = false;
      return;
    }
    if (getVariant(window.location.search) !== 'following') {
      return;
    }
    var params = parseSearchParams(window.location.search);
    params.delete('variant');
    var qs = params.toString();
    var nextSearch = qs ? '?' + qs : '';
    history.replaceState(history.state, '', window.location.pathname + nextSearch + window.location.hash);
    clearExtensionCommitFlag();
  }

  function processHomeTablists(active, onHomeRoute) {
    if (!onHomeRoute || !switchesReady) {
      return;
    }
    var tablists = findHomeFeedTablists(onHomeRoute);
    for (var i = 0; i < tablists.length; i += 1) {
      applyHomeTablistBlock(tablists[i], active);
    }
  }

  function syncHomeForYouBlock() {
    if (syncingHomeBlock) {
      return;
    }
    syncingHomeBlock = true;
    try {
      syncHomeForYouBlockInner();
    } finally {
      syncingHomeBlock = false;
    }
  }

  function syncHomeForYouBlockInner() {
    if (!window || !window.location) {
      return;
    }
    ensureHideStyle();
    var onHomeRoute = isHomeRouteLoc(window.location);
    if (!blockForYou) {
      releaseExtensionFollowingUrl();
    } else if (onHomeRoute) {
      commitFollowingUrl(blockForYou);
    }
    processHomeTablists(blockForYou, onHomeRoute);
    var hide = shouldHideHomeSurface(blockForYou, window.location.search, onHomeRoute);
    setHomeHidden(hide);
  }

  function onNavigation() {
    var fromExtension = extensionInitiatedNavigation;
    extensionInitiatedNavigation = false;

    if (!isHomeRouteLoc(window.location)) {
      redirectGuard = 0;
      clearExtensionCommitFlag();
    } else {
      var variant = getVariant(window.location.search);
      if (variant === 'favorites') {
        redirectGuard = 0;
        clearExtensionCommitFlag();
      } else if (!fromExtension && variant === 'following' && !blockForYou) {
        clearExtensionCommitFlag();
      } else if (fromExtension && variant === 'following' && !blockForYou) {
        clearExtensionCommitFlag();
      }
    }
    syncHomeForYouBlock();
  }

  function interceptHistory() {
    var originalPush = history.pushState;
    var originalReplace = history.replaceState;
    history.pushState = function pushStateWrapper(state, title, url) {
      var result = originalPush.apply(this, arguments);
      onNavigation();
      return result;
    };
    history.replaceState = function replaceStateWrapper(state, title, url) {
      var result = originalReplace.apply(this, arguments);
      onNavigation();
      return result;
    };
    window.addEventListener('popstate', onNavigation);
  }

  /** @type {MutationObserver | null} */
  var homeDomObserver = null;

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
      attributes: true,
      attributeFilter: ['aria-selected', 'aria-disabled', 'disabled'],
    });
  }

  function teardownHomeForYouBlock() {
    if (homeDomObserver) {
      homeDomObserver.disconnect();
      homeDomObserver = null;
    }
  }

  function installHomeSidebarHook() {
    document.addEventListener(
      'click',
      function (event) {
        var target = event.target;
        if (!(target instanceof Element)) {
          return;
        }
        if (!blockForYou) {
          return;
        }
        var link = target.closest('a[href="/"], a[href="https://www.instagram.com/"]');
        if (!link) {
          return;
        }
        queueMicrotask(onNavigation);
      },
      true,
    );
  }

  function setBlockForYou(on) {
    blockForYou = on !== false;
    if (blockForYou) {
      redirectGuard = 0;
    }
    syncHomeForYouBlock();
  }

  function applySwitchesFromStorage(switches) {
    var nextBlock = switches.blockForYou !== false;
    if (nextBlock && !blockForYou) {
      redirectGuard = 0;
    }
    blockForYou = nextBlock;
    if (switchesReady) {
      syncHomeForYouBlock();
      return;
    }
    switchesReady = true;
    syncHomeForYouBlock();
  }

  ensureHideStyle();
  interceptHistory();
  observeDom();
  installHomeSidebarHook();

  globalThis.__IRB_HOME_FOR_YOU__ = {
    setBlockForYou: setBlockForYou,
    applySwitchesFromStorage: applySwitchesFromStorage,
    sync: syncHomeForYouBlock,
    isHomeRouteLoc: isHomeRouteLoc,
    needsFollowingVariant: needsFollowingVariant,
    buildFollowingSearch: buildFollowingSearch,
    buildWwwHomeHref: buildWwwHomeHref,
    findHomeFeedTablists: findHomeFeedTablists,
    findForYouTab: findForYouTab,
    hasDisabledForYouTab: hasDisabledForYouTab,
    shouldRewriteLoggedInHome: shouldRewriteLoggedInHome,
    isHomeSurfaceCommitted: isHomeSurfaceCommitted,
    isSwitchesReady: function () {
      return switchesReady;
    },
    teardown: teardownHomeForYouBlock,
  };
})();
