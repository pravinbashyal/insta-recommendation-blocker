# Spec Delta

## Purpose

Keeps the Instagram home route on Following and removes the For you tab from the home-feed tablist while Block For you is on, and restores Instagram's home For you behavior when that switch is off.

## ADDED Requirements

### Requirement: Home opens on Following without a For you tab
While `Block For you` is on, the home route SHALL open on Following, keep unrelated query params, and show a home-feed tablist with Following selected and no For you tab, including after that tablist re-renders.

#### Scenario: [interaction] Opening instagram.com lands on Following while Block For you is on
- **WHEN** `Block For you` is on and the person opens `https://www.instagram.com/` or `https://instagram.com/` (apex or `www`, trailing slash or not, with or without unrelated query params such as `?hl=en`)
- **THEN** the address is `https://www.instagram.com/?variant=following` (unrelated query params kept), the home-feed `role="tablist"` has Following selected, that tablist has no For you tab, and the Following feed is what they see, without a visible flash of For you posts or a selected For you tab

#### Scenario: [interaction] The home feed tablist has no For you tab while Block For you is on
- **WHEN** `Block For you` is on and the person is on the home route (`https://www.instagram.com/` or `https://www.instagram.com/?variant=following`, including unrelated query params) while Instagram renders or re-renders the `role="tablist"` at the top of the home feed
- **THEN** that home tablist shows a Following tab and no For you tab, Following is the selected tab, and For you is not left as a disabled control in that tablist

#### Scenario: [interaction] Sidebar Home returns to Following while Block For you is on
- **WHEN** `Block For you` is on and the person is on `https://www.instagram.com/explore/`, `https://www.instagram.com/reels/`, `https://www.instagram.com/direct/inbox/`, or `https://www.instagram.com/<username>/` and activates the left sidebar Home control
- **THEN** they land on `https://www.instagram.com/?variant=following` with Following selected in the home-feed tablist and no For you tab there, without a visible stop on the For you feed

#### Scenario: [interaction] A direct Following URL stays on Following while Block For you is on
- **WHEN** `Block For you` is on and the person opens `https://www.instagram.com/?variant=following` directly
- **THEN** Following stays selected in the home-feed tablist, the For you tab is absent from that tablist, and the URL stays on the following variant

### Requirement: Block For you stays on the home route
While `Block For you` is on, Explore's own tablist and grid SHALL stay as Instagram shows them when `Block Explore contents` is off, Favorites SHALL stay available if Instagram presents it, and a logged-out home visit SHALL reach Instagram login without bouncing between `/` and `/?variant=following`.

#### Scenario: [interaction] Block For you ignores the Explore page tablist
- **WHEN** `Block For you` is on, `Block Explore contents` is off, and the person is on `https://www.instagram.com/explore/`, whose own tabs are For you and Not personalized
- **THEN** those Explore tabs and the Explore recommendation grid stay as Instagram shows them; `Block For you` applies only to the home route's tablist

#### Scenario: [interaction] Favorites on the home tablist stays available while Block For you is on
- **WHEN** `Block For you` is on and the home-feed `role="tablist"` also contains a Favorites tab, or the person opens `https://www.instagram.com/?variant=favorites`
- **THEN** Favorites still loads and its tab remains selectable. This desktop session did not show a Favorites tab; the scenario applies only if Instagram presents one

#### Scenario: [interaction] Logged-out instagram.com still reaches Instagram login while Block For you is on
- **WHEN** `Block For you` is on and a logged-out person opens `https://www.instagram.com/`
- **THEN** they reach Instagram's own login (the login route or Instagram's login UI on `/`), the extension does not bounce them between `/` and `/?variant=following`, and after they sign in they land on Following as in the first home scenario

### Requirement: Turning Block For you off restores Instagram home
While `Block For you` is off, `/` SHALL stay on Instagram's For you feed with the For you tab usable, and a chosen Following URL SHALL stay on Following.

#### Scenario: [interaction] Turning off Block For you restores the home For you tab
- **WHEN** the person turns `Block For you` off in the toolbar popup and opens `https://www.instagram.com/` or activates the left sidebar Home control
- **THEN** the home-feed `role="tablist"` includes For you and Following, For you is selected on `/`, the extension leaves `/` on Instagram's For you feed, and the For you tab can be used

#### Scenario: [interaction] Following still works through Instagram while Block For you is off
- **WHEN** `Block For you` is off and the person selects the Following tab in the home-feed tablist, or opens `https://www.instagram.com/?variant=following`
- **THEN** Instagram's own Following feed loads and stays on that URL; the extension does not remove the For you tab and does not force `/` onto `?variant=following`
