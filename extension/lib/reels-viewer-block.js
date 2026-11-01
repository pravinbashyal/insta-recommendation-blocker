/**
 * Reels viewer blocking — pure route helpers (ES module for tests).
 * Classic content bootstrap: extension/content/reels-viewer-block.js
 */

export const WWW_HOME_HREF = 'https://www.instagram.com/';
export const FOLLOWING_HOME_HREF = 'https://www.instagram.com/?variant=following';

/** Root class that hides the left-sidebar Reels entry while Block Reels is on. */
export const NAV_HIDE_CLASS = 'irb-reels-nav-hidden';

/**
 * CSS selectors (exact `/reels/` nav link only) hidden under NAV_HIDE_CLASS.
 * @returns {string[]}
 */
export function reelsNavHrefSelectors() {
  return [
    'a[href="/reels/"]',
    'a[href="/reels"]',
    'a[href="https://www.instagram.com/reels/"]',
    'a[href="https://www.instagram.com/reels"]',
  ];
}

/**
 * @param {string} hostname
 * @returns {boolean}
 */
export function isInstagramHost(hostname) {
  return hostname === 'www.instagram.com' || hostname === 'instagram.com';
}

/**
 * The Reels discovery destination only (`/reels/`), never a single reel or the
 * in-feed reel viewer.
 * @param {string} pathname
 * @returns {boolean}
 */
export function isReelsDestinationPathname(pathname) {
  return pathname === '/reels' || pathname === '/reels/';
}

/**
 * @param {{ hostname: string, pathname: string }} locationLike
 * @returns {boolean}
 */
export function isReelsDestinationRoute(locationLike) {
  return (
    isInstagramHost(locationLike.hostname) &&
    isReelsDestinationPathname(locationLike.pathname)
  );
}

/**
 * A single reel permalink, e.g. `/reel/<shortcode>/` — stays available.
 * @param {string} pathname
 * @returns {boolean}
 */
export function isSingleReelPathname(pathname) {
  return /^\/reel\/[^/]+\/?$/.test(pathname);
}

/**
 * A profile's reel permalink, e.g. `/<username>/reel/<shortcode>/` — stays available.
 * @param {string} pathname
 * @returns {boolean}
 */
export function isProfileReelPathname(pathname) {
  return /^\/[^/]+\/reel\/[^/]+\/?$/.test(pathname);
}

/**
 * The in-feed Reels viewer, e.g. `/reels/<id>/` — stays available (only the
 * bare `/reels/` destination is blocked).
 * @param {string} pathname
 * @returns {boolean}
 */
export function isReelsViewerPathname(pathname) {
  return /^\/reels\/[^/]+\/?$/.test(pathname);
}

/**
 * @param {string} href
 * @returns {boolean}
 */
export function isReelsSidebarHref(href) {
  if (!href) {
    return false;
  }
  try {
    const url = new URL(href, WWW_HOME_HREF);
    return isReelsDestinationPathname(url.pathname);
  } catch {
    return false;
  }
}

/**
 * The home feed to land on after leaving Reels, matching Block For you state.
 * @param {boolean} blockForYou
 * @returns {string}
 */
export function reelsHomeTarget(blockForYou) {
  return blockForYou ? FOLLOWING_HOME_HREF : WWW_HOME_HREF;
}
