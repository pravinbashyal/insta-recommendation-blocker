/**
 * Reels viewer blocking — pure route helpers (ES module for tests).
 * Classic content bootstrap: extension/content/reels-viewer-block.js
 */

/**
 * @param {string} hostname
 * @returns {boolean}
 */
export function isInstagramHost(hostname) {
  return hostname === 'www.instagram.com' || hostname === 'instagram.com';
}

/**
 * The full-screen Reels viewer destination only (`/reels/`), not single reels.
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
 * @param {string} pathname
 * @returns {boolean}
 */
export function isSingleReelPathname(pathname) {
  return /^\/reel\/[^/]+\/?$/.test(pathname);
}

/**
 * @param {string} pathname
 * @returns {boolean}
 */
export function isProfileReelPathname(pathname) {
  return /^\/[^/]+\/reel\/[^/]+\/?$/.test(pathname);
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
    const url = new URL(href, 'https://www.instagram.com');
    return isReelsDestinationPathname(url.pathname);
  } catch {
    return false;
  }
}

export const WWW_HOME_HREF = 'https://www.instagram.com/';
