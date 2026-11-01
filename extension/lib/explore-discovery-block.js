/**
 * Explore discovery grid blocking — pure route helpers (ES module for tests).
 * Classic content bootstrap: extension/content/explore-discovery-block.js
 */

export const EXPLORE_HIDE_CLASS = 'irb-explore-blocking';

export const EXPLORE_SEARCH_INPUT_TESTID = 'explore-search-input';

export const EXPLORE_ACCOUNT_RESULT_TESTID = 'explore-search-account';

/**
 * Post/reel tile surfaces on Explore (not search accounts, tablist, or search input).
 * Live Explore often omits role="grid"; tile links use /p/, /reel/, or /reels/ paths.
 */
export function exploreTileGridSelectorFragments() {
  return [
    'main [role="grid"]',
    'main a[href^="/p/"]',
    'main a[href^="/reel/"]',
    'main a[href^="/reels/"]',
  ];
}

/**
 * Full hide rule: every selector is prefixed with the blocking class on html.
 *
 * @param {string} hideClass
 */
export function buildExploreHideCssRule(hideClass) {
  var prefix = 'html.' + hideClass + ' ';
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

/**
 * @param {string} hostname
 */
export function isInstagramHost(hostname) {
  return hostname === 'www.instagram.com' || hostname === 'instagram.com';
}

/**
 * @param {string} pathname
 */
export function isExplorePathname(pathname) {
  return (
    pathname === '/explore' ||
    pathname === '/explore/' ||
    pathname.startsWith('/explore/')
  );
}

/**
 * Routes where Explore discovery or search-content grids may appear.
 *
 * @param {{ hostname: string, pathname: string }} locationLike
 */
export function isExploreRoute(locationLike) {
  return isInstagramHost(locationLike.hostname) && isExplorePathname(locationLike.pathname);
}

/**
 * Left sidebar Search navigates to Explore.
 *
 * @param {string | null | undefined} href
 */
export function isExploreSidebarSearchHref(href) {
  if (!href) {
    return false;
  }
  try {
    var url = new URL(href, 'https://www.instagram.com');
    return isExplorePathname(url.pathname);
  } catch (err) {
    return false;
  }
}
