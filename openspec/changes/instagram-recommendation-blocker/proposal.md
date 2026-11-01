# Proposal

## Why

Instagram opens the home feed on For you, and Reels and Explore keep offering recommendation grids beside the people someone chose to follow. A cross-browser extension with three switches, on by default, should keep home on Following, leave the Reels viewer, and hide Explore discovery while user search still works.

## What Changes

- Add a toolbar popup with three independent switches, all on after install: `Block For you`, `Block Reels`, and `Block Explore contents`. The popup is the only place these switches live.
- While `Block For you` is on, the home route opens on Following and the home-feed tablist has no For you tab. Turning it off restores Instagram’s home For you feed.
- While `Block Reels` is on, `/reels/` and the sidebar entry into it leave for home. A single reel, a profile’s reels, and posts in the home feed stay available.
- While `Block Explore contents` is on, Explore discovery grids stay hidden and the page stays on Explore. The search input and account results stay usable.
- Messages, a profile, and a single post stay reachable under every combination of the switches.
- Limit install access to Instagram (`*://*.instagram.com/*`). Remember the three switches in local extension state across browser restarts.

## Capabilities

### New Capabilities

- `toolbar-block-toggles`: The toolbar popup’s three independent switches, their default-on state, Instagram-only install access, and persistence.
- `home-for-you-block`: Home opens on Following and the home For you tab is removed while `Block For you` is on, and Instagram’s home For you behavior returns when it is off.
- `reels-viewer-block`: The Reels destination and its sidebar entry leave for home while `Block Reels` is on, without taking single reels, profile reels, or home-feed posts.
- `explore-discovery-block`: Explore discovery grids stay hidden while `Block Explore contents` is on, and search plus account results stay usable on Explore.
- `reachable-instagram-pages`: Messages, a profile, and a single post stay available no matter how the three switches are set.

### Modified Capabilities

None. The project has no existing capabilities.

## Impact

- New Manifest V3 browser extension for Chrome, Edge, Firefox, Safari, and other Chromium browsers. The repository has no extension source yet.
- Site access stays limited to `*://*.instagram.com/*`. The three switches are local extension state and do not widen that access.
- Instagram desktop web is the verified surface: the home-feed `role="tablist"` (For you and Following, with `?variant=following`), the `/reels/` destination, and Explore’s separate tabs, search, and grid. The same routes are the contract on a mobile-web chrome that uses them.
- Out of scope: direct messages as a feature, notifications, inline suggested cards, Stories, and hiding the Following feed.
