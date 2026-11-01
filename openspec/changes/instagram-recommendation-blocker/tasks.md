# Tasks

## 1. Extension shell

- [x] 1.1 Build the shared Manifest V3 package for Chromium and Firefox: one manifest with Firefox `browser_specific_settings.gecko`, a toolbar popup whose switches are `Block For you`, `Block Reels`, and `Block Explore contents` in that order, local storage where a missing key means on, a document-start content script on `*://*.instagram.com/*` that reads those switches and hears storage changes, and permissions limited to `storage` plus that host. Verify by loading it unpacked in Chromium: the popup shows those three switches all on, a flip survives a browser restart, the manifest has no other permission or host, and a fixture shows a missing key is on and an open-tab listener sees a storage change without a reinstall.
- [x] 1.2 Add a Safari web-extension target that loads the same popup, storage, and content-script files as the shared manifest, with no second copy of the blocking logic. Verify the Safari target references that shared directory. Safari's per-site allow for instagram.com stays the browser's install step.

## 2. Home For you

- [x] 2.1 Implement `home-for-you-block` in the shared content script per design.md (hide until the first switch read, then commit Following and reveal; rewrite only a logged-in home shell; document-local Following-commit only—no `storage.local` marker; Favorites leave-alone is URL-only via `?variant=favorites`—no Favorites-click flag; on `/` or `?variant=following` select Following even if Favorites is stale- or click-selected; leave the Explore tablist alone). Verify with repeatable fixtures, not a live Instagram session: apex and `www`, trailing slash, `?hl=en` kept alongside `variant=following`, no URL rewrite before storage resolves, home `role="tablist"` re-render drops For you and does not leave it disabled, sidebar Home from Explore, Reels, inbox, and a profile, a direct Following URL, `?variant=favorites` keeps Favorites, `/` or following with Favorites selected still commits Following, Explore's own tabs left in place while `Block Explore contents` is off, a logged-out `/` that does not bounce, `Block For you` off restoring For you without forcing `?variant=following`, repeated on/off still commits Following, and a user-chosen Following URL while off staying put after Favorites or another route.

## 3. Reels

- [x] 3.1 Implement `reels-viewer-block` in the shared content script: `/reels/` and a sidebar control that navigates there leave for `https://www.instagram.com/` with no watchable pass through the viewer, and the home feed then follows the current `Block For you` state. Verify with fixtures: trailing slash and unrelated query params, the sidebar control, `/reel/<shortcode>/` and `/<username>/reel/<shortcode>/` and a profile Reels tab still loading, a reel-format post remaining on the home feed, and `Block Reels` off opening the viewer.

## 4. Explore contents

- [x] 4.1 Implement `explore-discovery-block` in the shared content script: stay on Explore, keep the search input and account results usable, and hide recommendation grids and keyword, hashtag, and place content grids so they cannot be scrolled. Verify with fixtures: `/explore/`, both Explore tabs, sidebar Search, choosing an account through to `/<username>/`, `explore/search/keyword/?q=`, a hashtag grid, a place grid, and `Block Explore contents` off restoring the grid. This switch stays independent of `Block For you`.

## 5. Cross-toggle integration

- [ ] 5.1 Verify the three behaviors together in one fixture session: turning off one switch restores only that surface while the other two stay blocked, and `https://www.instagram.com/direct/inbox/`, `https://www.instagram.com/<username>/`, and `https://www.instagram.com/p/<shortcode>/` still load under every combination of the switches.

## Workflow follow-up

- Implement with `/five-role-team:apply instagram-recommendation-blocker`.
- Live Instagram checks of the `[interaction]` scenarios belong to the interaction gate after the last section, not to a tracked task.
- Archive the change after implementation and review are satisfied.
