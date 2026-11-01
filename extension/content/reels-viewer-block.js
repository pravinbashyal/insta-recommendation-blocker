(function () {
  'use strict';

  var WWW_HOME_HREF = 'https://www.instagram.com/';
  var FOLLOWING_HOME_HREF = 'https://www.instagram.com/?variant=following';
  var NAV_HIDE_CLASS = 'irb-reels-nav-hidden';
  var NAV_STYLE_ID = 'irb-reels-nav-hide-style';

  /** @type {boolean} */
  var blockReels = false;
  /** @type {boolean} */
  var blockForYou = true;
  /** @type {boolean} */
  var switchesReady = false;

  // ---------------------------------------------------------------------------
  // Route helpers
  // ---------------------------------------------------------------------------

  function isInstagramHost(hostname) {
    return hostname === 'www.instagram.com' || hostname === 'instagram.com';
  }

  // Only the Reels discovery destination — never a single reel (`/reel/<id>/`,
  // `/<user>/reel/<id>/`) or the in-feed reel viewer (`/reels/<id>/`).
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
      var url = new URL(href, WWW_HOME_HREF);
      return isReelsDestinationPathname(url.pathname);
    } catch (err) {
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Sidebar Reels icon — hidden via a toggled class so it tracks re-renders
  // without an observer. Only the exact `/reels/` (or `/reels`) link matches,
  // i.e. the left-nav entry — never a `/reels/<id>/` or `/reels/audio/...` link.
  // ---------------------------------------------------------------------------

  function ensureNavHideStyle() {
    if (document.getElementById(NAV_STYLE_ID)) {
      return;
    }
    var style = document.createElement('style');
    style.id = NAV_STYLE_ID;
    style.textContent =
      'html.' + NAV_HIDE_CLASS + ' a[href="/reels/"],' +
      'html.' + NAV_HIDE_CLASS + ' a[href="/reels"],' +
      'html.' + NAV_HIDE_CLASS + ' a[href="https://www.instagram.com/reels/"],' +
      'html.' + NAV_HIDE_CLASS + ' a[href="https://www.instagram.com/reels"]' +
      ' { display: none !important; }';
    var parent = document.documentElement || document.head || document;
    parent.appendChild(style);
  }

  function applyNavVisibility() {
    var root = document.documentElement;
    if (!root) {
      return;
    }
    if (switchesReady && blockReels) {
      root.classList.add(NAV_HIDE_CLASS);
    } else {
      root.classList.remove(NAV_HIDE_CLASS);
    }
  }

  // The home feed to land on must match the current Block For you state, so the
  // single redirect already carries the right variant and there is no second
  // hop through the home blocker.
  function homeTarget() {
    return blockForYou ? FOLLOWING_HOME_HREF : WWW_HOME_HREF;
  }

  function navigateToHome() {
    var testNavigate = globalThis.__IRB_NAVIGATE_WWW_HOME__;
    if (typeof testNavigate === 'function') {
      testNavigate(homeTarget());
      return;
    }
    window.location.replace(homeTarget());
  }

  // ---------------------------------------------------------------------------
  // Sync
  // ---------------------------------------------------------------------------

  function syncReelsViewerBlock() {
    if (!switchesReady || !blockReels || !window || !window.location) {
      return;
    }
    if (isReelsDestinationRoute(window.location)) {
      navigateToHome();
    }
  }

  // ---------------------------------------------------------------------------
  // Navigation hooks
  // ---------------------------------------------------------------------------

  function interceptHistory() {
    var originalPush = history.pushState;
    var originalReplace = history.replaceState;
    history.pushState = function pushStateWrapper() {
      var result = originalPush.apply(this, arguments);
      syncReelsViewerBlock();
      return result;
    };
    history.replaceState = function replaceStateWrapper() {
      var result = originalReplace.apply(this, arguments);
      syncReelsViewerBlock();
      return result;
    };
    window.addEventListener('popstate', syncReelsViewerBlock);
  }

  // Send in-app clicks on the sidebar Reels control straight home so the viewer
  // never appears.
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
        if (!link || !isReelsSidebarHref(link.getAttribute('href'))) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        navigateToHome();
      },
      true,
    );
  }

  // ---------------------------------------------------------------------------
  // Public interface
  // ---------------------------------------------------------------------------

  function setBlockReels(on) {
    blockReels = on !== false;
    switchesReady = true;
    applyNavVisibility();
    syncReelsViewerBlock();
  }

  function applySwitchesFromStorage(switches) {
    blockReels = switches.blockReels !== false;
    blockForYou = switches.blockForYou !== false;
    switchesReady = true;
    applyNavVisibility();
    syncReelsViewerBlock();
  }

  ensureNavHideStyle();
  interceptHistory();
  installReelsSidebarHook();

  globalThis.__IRB_REELS_VIEWER__ = {
    setBlockReels: setBlockReels,
    applySwitchesFromStorage: applySwitchesFromStorage,
    sync: syncReelsViewerBlock,
    isReelsDestinationRoute: isReelsDestinationRoute,
    isReelsSidebarHref: isReelsSidebarHref,
    NAV_HIDE_CLASS: NAV_HIDE_CLASS,
    isSwitchesReady: function () {
      return switchesReady;
    },
  };
})();
