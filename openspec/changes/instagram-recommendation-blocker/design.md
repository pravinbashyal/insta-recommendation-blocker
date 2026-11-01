# Design

## Context

The repository has no extension source yet. See proposal.md for why this change exists. The behavior contract is the five capability specs. Live desktop Instagram is the structural constraint: home uses a `role="tablist"` whose tabs are For you and Following, Following is `?variant=following`, sidebar Home is a client-side return to `/`, and Explore has a separate tablist plus search and a grid. A mobile-web chrome that uses those same routes follows the same rules.

## Goals / Non-Goals

**Goals:**

- Apply each switch on a cold load and on a client-side navigation before the blocked surface paints.
- Keep the three switches and the page behavior the same on Chrome, Edge, Firefox, Safari, and other Chromium browsers.
- Store the switches locally without widening site access past Instagram.

**Non-Goals:**

- A settings UI on the Instagram page.
- Blocking `/reel/<shortcode>/`, a profile's reels, or a reel-format post in the home feed.
- Sending Explore to Home or Messages.
- Hiding Stories, notifications, inline suggested cards, or the Following feed.
- Syncing switch state across devices or browsers.

## Decisions

### One early content script, scoped by route

A content script declared for `*://*.instagram.com/*` runs at document start, reads the three switches, and acts only on the route that switch owns. Home For you applies to `/` and `/?variant=*`. Reels applies to `/reels/` and to a sidebar control whose navigation target is that path. Explore contents applies to `/explore/` and to Explore search content grids (keyword, hashtag, place). Messages, profiles, `/p/<shortcode>/`, and single-reel URLs get no block.

```
+------------------+
| toolbar popup    |  three switches, all default on
+--------+---------+
         | storage.local (missing key means on)
         v
+------------------------------------------+
| content script at document start         |
| *://*.instagram.com/*                    |
+------------------------------------------+
         |
         +-- / and /?variant=*     Block For you
         +-- /reels/               Block Reels, then home rules
         +-- /explore/ and         Block Explore contents
             explore search grids
```

Alternative considered: a network redirect of `/` to `/?variant=following` and of `/reels/` to `/`. Rejected as the only mechanism. Sidebar Home and the Reels control are client-side navigations, so a network rule never sees them. A blanket redirect of `/` can also bounce a logged-out session between `/` and `/?variant=following`. One script covers cold loads and client-side navigations and can tell the home tablist from Explore's tablist by the URL.

### Hide, then commit, then reveal

While a switch is on, the script hides that switch's surface until the correct state is committed, then reveals it. For home, that means the address is the Following variant (unrelated query params kept) and the home tablist has no For you tab before the feed is shown. For Reels, the viewer is not shown on the way to `https://www.instagram.com/`. For Explore, the discovery grids are not shown or scrollable; the search input stays. If one browser cannot meet that, amend the affected scenario in the open rather than dropping the requirement.

Alternative considered: mutate the page after it paints. Rejected because the specs require no visible flash of For you posts, a selected For you tab, the Reels viewer, or the Explore grid.

### Local switches, missing key means on

The popup writes three booleans to extension local storage. A missing key means on, so the first Instagram visit blocks even if the popup has never opened and the install hook has not finished. Open Instagram tabs subscribe to storage changes and apply the new state without a reinstall. The popup reads the same keys, so a restart shows the last choice.

Alternative considered: write defaults only when the popup opens, or only from an install hook. Rejected because either can lose the race with the first visit. Sync storage was rejected because the remembered state is local and sync would be a different product.

### Permissions stay on Instagram

The manifest requests `storage` and host access `*://*.instagram.com/*` only. The content script is declared by that host match, so the popup does not need scripting or tab permissions to reach Instagram pages.

### Stable hooks are the URL and the role

Home vs Explore is decided by the route, not by the words "For you", because both pages have a For you tab. The home script touches only the home-feed `role="tablist"`. It removes the For you tab rather than leaving it disabled, and it leaves a Favorites tab alone when Instagram presents one. Explore's For you and Not personalized tabs follow `Block Explore contents` only. Obfuscated class names are not the contract. Search stays usable by leaving the search input and account result rows in place while content grids are hidden.

### One Manifest V3 package, Safari loads the same files

Chrome, Edge, and other Chromium browsers load one manifest. Firefox uses that same manifest plus `browser_specific_settings.gecko`. Safari is a web-extension wrapper whose popup, storage, and content script are those shared files, not a second copy of the blocking logic. Safari's per-site allow step for instagram.com is the browser's install UI.

Alternative considered: a separate implementation per browser. Rejected because the specs require the same switches and the same page behavior.

### Tests that can re-run stay off the live site

Each behavior task verifies with fixtures that encode the verified routes, the home `role="tablist"`, the Reels path, and Explore's search plus grids. A logged-in Instagram session is not part of those tests. The interaction scenarios are checked later against a live session by the interaction gate.

## Risks / Trade-offs

- [Instagram re-renders the home tablist or changes markup] → Observe the home route's `role="tablist"` for the life of the page, and key off the route plus roles rather than class names. Fixtures lock the structure the live check verified.
- [A client-side Home or Reels click paints For you or the viewer before the script runs] → Hide that surface at document start and on navigation, and commit the URL before reveal.
- [Logged-out `/` and `/?variant=following` redirect each other] → Rewrite home only when a logged-in home shell is present. If a rewrite would loop, stop and leave Instagram's login UI in place.
- [Safari packaging drifts from the shared scripts] → The Safari target references the shared extension directory. Blocking logic is not copied into the wrapper.
- [One browser cannot hide a surface before paint] → Amend that scenario in the open. Do not silently weaken the other browsers.

## Migration Plan

This is the first install. There is no previous switch state to migrate. Uninstalling or disabling the extension returns Instagram to its own home, Reels, and Explore behavior. Rollback is that uninstall; nothing is written to Instagram.

## Open Questions

None. A browser that cannot meet the no-flash scenarios is handled by amending that scenario later, which does not change this approach or the task breakdown.
