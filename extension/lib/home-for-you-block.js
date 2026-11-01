/**
 * Home For you blocking — pure helpers and DOM routines (ES module for tests).
 * Classic content bootstrap: extension/content/home-for-you-block.js
 */

export const FOR_YOU_LABEL = 'For you';
export const FOLLOWING_LABEL = 'Following';
export const FAVORITES_LABEL = 'Favorites';
export const EXPLORE_NOT_PERSONALIZED_LABEL = 'Not personalized';

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
 * @param {boolean} blockForYou
 * @param {string} search
 * @returns {boolean}
 */
export function needsFollowingVariant(blockForYou, search) {
  if (!blockForYou) {
    return false;
  }
  const variant = getVariant(search);
  if (variant === 'favorites' || variant === 'following') {
    return false;
  }
  return true;
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
 * @param {string} href
 * @returns {string}
 */
export function canonicalHomeFollowingHref(href) {
  const url = new URL(href);
  url.hostname = 'www.instagram.com';
  url.pathname = '/';
  url.search = buildFollowingSearch(url.search);
  return url.href;
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
 * @param {boolean} onHomeRoute
 * @returns {Element[]}
 */
export function findHomeFeedTablists(root, onHomeRoute) {
  if (!onHomeRoute) {
    return [];
  }
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
 * @returns {Element | null}
 */
export function findForYouTab(tablist) {
  const tabs = tablist.querySelectorAll('[role="tab"]');
  for (const tab of tabs) {
    if (normalizedTabText(tab) === FOR_YOU_LABEL) {
      return tab;
    }
  }
  return null;
}

/**
 * @param {Element} tablist
 * @returns {Element | null}
 */
export function findFollowingTab(tablist) {
  const tabs = tablist.querySelectorAll('[role="tab"]');
  for (const tab of tabs) {
    if (normalizedTabText(tab) === FOLLOWING_LABEL) {
      return tab;
    }
  }
  return null;
}

/**
 * @param {Element} tablist
 * @returns {boolean}
 */
export function hasDisabledForYouTab(tablist) {
  const tab = findForYouTab(tablist);
  if (!tab) {
    return false;
  }
  return (
    tab.getAttribute('aria-disabled') === 'true' ||
    tab.hasAttribute('disabled') ||
    tab.classList.contains('disabled')
  );
}

/**
 * @param {Element} tablist
 * @param {boolean} blockForYou
 */
export function findFavoritesTab(tablist) {
  const tabs = tablist.querySelectorAll('[role="tab"]');
  for (const tab of tabs) {
    if (normalizedTabText(tab) === FAVORITES_LABEL) {
      return tab;
    }
  }
  return null;
}

export function shouldLeaveFavoritesSelection(search) {
  return getVariant(search) === 'favorites';
}

export function applyHomeTablistBlock(tablist, blockForYou, search) {
  if (!blockForYou) {
    return;
  }
  const forYou = findForYouTab(tablist);
  if (forYou) {
    forYou.remove();
  }
  if (shouldLeaveFavoritesSelection(search)) {
    return;
  }
  const following = findFollowingTab(tablist);
  if (following) {
    const tabs = tablist.querySelectorAll('[role="tab"]');
    for (const tab of tabs) {
      tab.setAttribute('aria-selected', tab === following ? 'true' : 'false');
    }
  }
}

/**
 * @param {Document | Element} doc
 * @returns {boolean}
 */
export function hasLoggedOutLoginUi(doc) {
  if (doc.querySelector('input[name="username"]')) {
    return true;
  }
  if (doc.querySelector('form#loginForm')) {
    return true;
  }
  if (doc.querySelector('[data-testid="login-page"]')) {
    return true;
  }
  return false;
}

/**
 * @param {Document | Element} doc
 * @returns {boolean}
 */
export function hasLoggedInHomeShell(doc) {
  if (hasLoggedOutLoginUi(doc)) {
    return false;
  }
  if (doc.querySelector('[data-testid="logged-in-home-shell"]')) {
    return true;
  }
  if (doc.querySelector('[data-testid="mobile-nav-home-link"]')) {
    return true;
  }
  if (
    doc.querySelector(
      'nav[data-testid="sidebar"] a[href="/"], nav[data-testid="sidebar"] a[href="https://www.instagram.com/"]',
    )
  ) {
    return true;
  }
  const tablists = doc.querySelectorAll('[role="tablist"]');
  for (const tablist of tablists) {
    if (isHomeFeedTablist(tablist)) {
      return true;
    }
  }
  return false;
}

/**
 * @param {Document | Element} doc
 * @param {boolean} blockForYou
 * @returns {boolean}
 */
export function shouldRewriteLoggedInHome(doc, blockForYou) {
  if (!blockForYou) {
    return false;
  }
  if (hasLoggedOutLoginUi(doc)) {
    return false;
  }
  return hasLoggedInHomeShell(doc);
}

/**
 * @param {boolean} blockForYou
 * @param {string} search
 * @param {Document | Element} doc
 * @returns {boolean}
 */
export function isHomeSurfaceCommitted(blockForYou, search, doc, onHomeRoute) {
  if (!onHomeRoute) {
    return true;
  }
  if (!blockForYou) {
    return true;
  }
  if (!shouldRewriteLoggedInHome(doc, blockForYou)) {
    return true;
  }
  if (needsFollowingVariant(blockForYou, search) && getVariant(search) !== 'favorites') {
    return false;
  }
  const tablists = findHomeFeedTablists(doc, onHomeRoute);
  if (tablists.length === 0) {
    return false;
  }
  for (const tablist of tablists) {
    if (findForYouTab(tablist) || hasDisabledForYouTab(tablist)) {
      return false;
    }
    const following = findFollowingTab(tablist);
    const variant = getVariant(search);
    if (variant !== 'favorites' && following && following.getAttribute('aria-selected') !== 'true') {
      return false;
    }
  }
  return true;
}

/**
 * @param {boolean} blockForYou
 * @param {string} search
 * @param {Document | Element} doc
 * @param {boolean} onHomeRoute
 * @returns {boolean}
 */
export function shouldHideHomeSurface(blockForYou, search, doc, onHomeRoute) {
  if (!onHomeRoute || !blockForYou) {
    return false;
  }
  if (!shouldRewriteLoggedInHome(doc, blockForYou)) {
    return false;
  }
  return !isHomeSurfaceCommitted(blockForYou, search, doc, onHomeRoute);
}
