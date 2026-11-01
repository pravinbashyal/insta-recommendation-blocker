/**
 * Home For you blocking — pure helpers and tablist routines (ES module for tests).
 * Classic content bootstrap: extension/content/home-for-you-block.js
 */

export const FOR_YOU_LABEL = 'For you';
export const FOLLOWING_LABEL = 'Following';
export const FAVORITES_LABEL = 'Favorites';
export const EXPLORE_NOT_PERSONALIZED_LABEL = 'Not personalized';
export const WWW_HOME_ORIGIN = 'https://www.instagram.com';

/**
 * @param {string} hostname
 * @returns {boolean}
 */
export function isInstagramHost(hostname) {
  return hostname === 'www.instagram.com' || hostname === 'instagram.com';
}

/**
 * @param {string} pathname
 * @returns {boolean}
 */
export function isHomePathname(pathname) {
  return pathname === '/' || pathname === '';
}

/**
 * @param {{ hostname: string, pathname: string }} locationLike
 * @returns {boolean}
 */
export function isHomeRoute(locationLike) {
  return isInstagramHost(locationLike.hostname) && isHomePathname(locationLike.pathname);
}

/**
 * @param {string} search
 * @returns {URLSearchParams}
 */
export function parseSearchParams(search) {
  const raw = search && search.startsWith('?') ? search.slice(1) : search || '';
  return new URLSearchParams(raw);
}

/**
 * @param {string} search
 * @returns {string | null}
 */
export function getVariant(search) {
  return parseSearchParams(search).get('variant');
}

/**
 * @param {string} search
 * @returns {string}
 */
export function buildFollowingSearch(search) {
  const params = parseSearchParams(search);
  params.set('variant', 'following');
  const qs = params.toString();
  return qs ? `?${qs}` : '?variant=following';
}

/**
 * @param {string} search
 * @returns {string}
 */
export function buildWwwHomeHref(search) {
  if (!search) {
    return `${WWW_HOME_ORIGIN}/`;
  }
  const qs = search.startsWith('?') ? search : `?${search}`;
  return `${WWW_HOME_ORIGIN}/${qs}`;
}

/**
 * The bare home feed (For you) redirects to Following. Favorites and an
 * already-following URL are left exactly as they are.
 * @param {boolean} blockForYou
 * @param {{ hostname: string, pathname: string, search: string }} locationLike
 * @returns {boolean}
 */
export function needsFollowingRedirect(blockForYou, locationLike) {
  if (!blockForYou || !isHomeRoute(locationLike)) {
    return false;
  }
  const variant = getVariant(locationLike.search);
  return variant !== 'following' && variant !== 'favorites';
}

/**
 * @param {Element} node
 * @returns {string}
 */
export function normalizedTabText(node) {
  return (node.textContent || '').replace(/\s+/g, ' ').trim();
}

/**
 * @param {Element} tablist
 * @param {string} label
 * @returns {boolean}
 */
export function tablistContainsLabel(tablist, label) {
  const tabs = tablist.querySelectorAll('[role="tab"]');
  for (const tab of tabs) {
    if (normalizedTabText(tab) === label) {
      return true;
    }
  }
  return false;
}

/**
 * Explore's tablist is "For you" / "Not personalized"; never touch it.
 * @param {Element} tablist
 * @returns {boolean}
 */
export function isExploreStyleTablist(tablist) {
  return tablistContainsLabel(tablist, EXPLORE_NOT_PERSONALIZED_LABEL);
}

/**
 * @param {Element} tablist
 * @returns {boolean}
 */
export function isHomeFeedTablist(tablist) {
  if (isExploreStyleTablist(tablist)) {
    return false;
  }
  return tablistContainsLabel(tablist, FOLLOWING_LABEL);
}

/**
 * @param {ParentNode} root
 * @returns {Element[]}
 */
export function findHomeFeedTablists(root) {
  /** @type {Element[]} */
  const result = [];
  const tablists = root.querySelectorAll('[role="tablist"]');
  for (const tablist of tablists) {
    if (isHomeFeedTablist(tablist)) {
      result.push(tablist);
    }
  }
  return result;
}

/**
 * @param {Element} tablist
 * @param {string} label
 * @returns {Element | null}
 */
export function findTabByLabel(tablist, label) {
  const tabs = tablist.querySelectorAll('[role="tab"]');
  for (const tab of tabs) {
    if (normalizedTabText(tab) === label) {
      return tab;
    }
  }
  return null;
}

/**
 * @param {Element} tablist
 * @returns {Element | null}
 */
export function findForYouTab(tablist) {
  return findTabByLabel(tablist, FOR_YOU_LABEL);
}

/**
 * @param {Element} tablist
 * @returns {Element | null}
 */
export function findFollowingTab(tablist) {
  return findTabByLabel(tablist, FOLLOWING_LABEL);
}

/**
 * @param {Element} tablist
 * @returns {Element | null}
 */
export function findFavoritesTab(tablist) {
  return findTabByLabel(tablist, FAVORITES_LABEL);
}
