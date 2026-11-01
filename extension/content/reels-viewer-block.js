(function () {
  'use strict';

  var WWW_HOME_HREF = 'https://www.instagram.com/';
  var HIDE_CLASS = 'irb-reels-blocking';
  var STYLE_ID = 'irb-reels-viewer-hide-style';

  /** @type {boolean} */
  var blockReels = false;

  /** @type {boolean} */
  var switchesReady = false;

  /** @type {boolean} */
  var extensionInitiatedNavigation = false;

  function isInstagramHost(hostname) {
    return hostname === 'www.instagram.com' || hostname === 'instagram.com';
  }

  function isReelsDestinationPathname(pathname) {
    return pathname === '/reels' || pathname === '/reels/';
  }

  function isReelsDestinationRoute(loc) {
    return isInstagramHost(loc.hostname) && isReelsDestinationPathname(loc.pathname);
  }

  function isReelsSidebarHref(href) {
    if (!href) {
      return false;
    }
    try {
      var url = new URL(href, 'https://www.instagram.com');
      return isReelsDestinationPathname(url.pathname);
    } catch (err) {
      return false;
    }
  }

  function navigateToHome() {
    extensionInitiatedNavigation = true;
    var testNavigate = globalThis.__IRB_NAVIGATE_WWW_HOME__;
    if (typeof testNavigate === 'function') {
      testNavigate(WWW_HOME_HREF);
      return;
    }
    window.location.replace(WWW_HOME_HREF);
  }

  function ensureHideStyle() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent =
      'html.' + HIDE_CLASS + ' > body { visibility: hidden !important; }';
    var parent = document.documentElement || document.head || document;
    parent.appendChild(style);
  }

  function setReelsHidden(hidden) {
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

  function shouldHideReelsSurface() {
    if (!isReelsDestinationRoute(window.location)) {
      return false;
    }
    if (!switchesReady) {
      return true;
    }
    return blockReels;
  }

  function commitLeaveReels() {
    if (!switchesReady || !blockReels) {
      return;
    }
    if (!isReelsDestinationRoute(window.location)) {
      return;
    }
    navigateToHome();
  }

  function syncReelsViewerBlock() {
    if (!window || !window.location) {
      return;
    }
    ensureHideStyle();
    commitLeaveReels();
    setReelsHidden(shouldHideReelsSurface());
  }

  function onNavigation() {
    extensionInitiatedNavigation = false;
    syncReelsViewerBlock();
    var home = globalThis.__IRB_HOME_FOR_YOU__;
    if (home && typeof home.sync === 'function') {
      home.sync();
    }
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

  function installReelsSidebarHook() {
    document.addEventListener(
      'click',
      function (event) {
        if (!switchesReady || !blockReels) {
          return;
        }
        var target = event.target;
        if (!(target instanceof Element)) {
          return;
        }
        var link = target.closest('a[href]');
        if (!link) {
          return;
        }
        var href = link.getAttribute('href');
        if (!isReelsSidebarHref(href)) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        navigateToHome();
        queueMicrotask(onNavigation);
      },
      true,
    );
  }

  function setBlockReels(on) {
    blockReels = on !== false;
    syncReelsViewerBlock();
  }

  function applySwitchesFromStorage(switches) {
    blockReels = switches.blockReels !== false;
    if (switchesReady) {
      syncReelsViewerBlock();
      return;
    }
    switchesReady = true;
    syncReelsViewerBlock();
  }

  ensureHideStyle();
  interceptHistory();
  installReelsSidebarHook();
  syncReelsViewerBlock();

  globalThis.__IRB_REELS_VIEWER__ = {
    setBlockReels: setBlockReels,
    applySwitchesFromStorage: applySwitchesFromStorage,
    sync: syncReelsViewerBlock,
    isReelsDestinationRoute: isReelsDestinationRoute,
    isReelsSidebarHref: isReelsSidebarHref,
    isSwitchesReady: function () {
      return switchesReady;
    },
  };
})();
