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
 * Full-screen Reels viewer after Instagram redirects from `/reels/`.
 * @param {string} pathname
 * @returns {boolean}
 */
export function isReelsViewerPathname(pathname) {
  return /^\/reels\/[^/]+\/?$/.test(pathname);
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
 * @param {boolean} reelsDestinationSession
 * @returns {boolean}
 */
export function isReelsBlockedPathname(pathname, reelsDestinationSession) {
  if (isReelsDestinationPathname(pathname)) {
    return true;
  }
  return reelsDestinationSession && isReelsViewerPathname(pathname);
}

/**
 * @param {{ hostname: string, pathname: string }} locationLike
 * @param {boolean} reelsDestinationSession
 * @returns {boolean}
 */
export function isReelsBlockedRoute(locationLike, reelsDestinationSession) {
  return (
    isInstagramHost(locationLike.hostname) &&
    isReelsBlockedPathname(locationLike.pathname, reelsDestinationSession)
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
