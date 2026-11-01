(function () {
  'use strict';

  var HIDE_CLASS = 'irb-explore-blocking';
  var STYLE_ID = 'irb-explore-discovery-hide-style';

  /** @type {boolean} */
  var blockExploreContents = false;

  /** @type {boolean} */
  var switchesReady = false;

  function isInstagramHost(hostname) {
    return hostname === 'www.instagram.com' || hostname === 'instagram.com';
  }

  function isExplorePathname(pathname) {
    return (
      pathname === '/explore' ||
      pathname === '/explore/' ||
      pathname.startsWith('/explore/')
    );
  }

  function isExploreRoute(loc) {
    return isInstagramHost(loc.hostname) && isExplorePathname(loc.pathname);
  }

  function exploreTileGridSelectorFragments() {
    return [
      'main [role="grid"]',
      'main a[href^="/p/"]',
      'main a[href^="/reel/"]',
      'main a[href^="/reels/"]',
    ];
  }

  function buildHideCssRule() {
    var prefix = 'html.' + HIDE_CLASS + ' ';
    var selectors = exploreTileGridSelectorFragments()
      .map(function (fragment) {
        return prefix + fragment;
      })
      .join(', ');
    return (
      selectors +
      ' { display: none !important; visibility: hidden !important; overflow: hidden !important; max-height: 0 !important; pointer-events: none !important; }'
    );
  }

  function ensureHideStyle() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = buildHideCssRule();
    var parent = document.documentElement || document.head || document;
    parent.appendChild(style);
  }

  function setExploreGridsHidden(hidden) {
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

  function shouldHideExploreGrids() {
    if (!isExploreRoute(window.location)) {
      return false;
    }
    if (!switchesReady) {
      return true;
    }
    return blockExploreContents;
  }

  function syncExploreDiscoveryBlock() {
    if (!window || !window.location) {
      return;
    }
    ensureHideStyle();
    setExploreGridsHidden(shouldHideExploreGrids());
  }

  function onNavigation() {
    syncExploreDiscoveryBlock();
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

  function installGridObserver() {
    if (typeof MutationObserver === 'undefined') {
      return;
    }
    var observer = new MutationObserver(function () {
      syncExploreDiscoveryBlock();
    });
    observer.observe(document.documentElement || document, {
      childList: true,
      subtree: true,
    });
  }

  function setBlockExploreContents(on) {
    blockExploreContents = on !== false;
    syncExploreDiscoveryBlock();
  }

  function applySwitchesFromStorage(switches) {
    blockExploreContents = switches.blockExploreContents !== false;
    if (switchesReady) {
      syncExploreDiscoveryBlock();
      return;
    }
    switchesReady = true;
    syncExploreDiscoveryBlock();
  }

  ensureHideStyle();
  interceptHistory();
  installGridObserver();
  syncExploreDiscoveryBlock();

  globalThis.__IRB_EXPLORE_DISCOVERY__ = {
    setBlockExploreContents: setBlockExploreContents,
    applySwitchesFromStorage: applySwitchesFromStorage,
    sync: syncExploreDiscoveryBlock,
    isExploreRoute: isExploreRoute,
    buildHideCssRule: buildHideCssRule,
    isSwitchesReady: function () {
      return switchesReady;
    },
  };
})();
