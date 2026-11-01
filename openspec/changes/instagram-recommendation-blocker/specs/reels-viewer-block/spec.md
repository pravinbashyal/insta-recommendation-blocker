# Spec Delta

## Purpose

Leaves the Reels destination and its sidebar entry for home while Block Reels is on, hides the left-sidebar Reels icon, and leaves single reels, profile reels, the in-feed reel viewer, and home-feed posts available.

## ADDED Requirements

### Requirement: The Reels destination follows the Block Reels switch
While `Block Reels` is on, the bare `/reels/` destination and its sidebar entry SHALL leave for `https://www.instagram.com/` with the current `Block For you` state, the left-sidebar Reels icon SHALL be hidden, and a single reel, profile reels, the in-feed reel viewer at `/reels/<id>/`, and home-feed posts SHALL stay. While it is off, the Reels viewer SHALL open and the sidebar icon SHALL be shown.

#### Scenario: [interaction] Opening the Reels route leaves the viewer while Block Reels is on
- **WHEN** `Block Reels` is on and the person opens `https://www.instagram.com/reels/` (trailing slash or unrelated query params included)
- **THEN** they leave that route for `https://www.instagram.com/`, they do not get a watchable pass through the Reels viewer, and the home feed they land on matches the current `Block For you` state

#### Scenario: [interaction] The sidebar Reels icon is hidden while Block Reels is on
- **WHEN** `Block Reels` is on and the person looks at the left sidebar
- **THEN** the Reels icon (the control that navigates to `https://www.instagram.com/reels/`) is not shown; if a `/reels/` control Instagram re-inserts is activated, it ends on `https://www.instagram.com/` with the home feed matching the current `Block For you` state, and the viewer does not remain on screen

#### Scenario: [interaction] A single reel, a profile's reels, and the in-feed reel viewer still open while Block Reels is on
- **WHEN** `Block Reels` is on and the person opens `https://www.instagram.com/reel/<shortcode>/` or `https://www.instagram.com/<username>/reel/<shortcode>/`, opens the Reels tab on `https://www.instagram.com/<username>/`, or opens an in-feed reel at `https://www.instagram.com/reels/<id>/`
- **THEN** that reel, that profile's reels grid, or that in-feed reel loads as Instagram loads it; only the bare `/reels/` discovery destination is blocked

#### Scenario: [interaction] Following-feed posts stay while Block Reels is on
- **WHEN** `Block Reels` is on and the person is on the home feed at `https://www.instagram.com/` or `https://www.instagram.com/?variant=following`
- **THEN** the home feed still shows the posts Instagram places there, including a post that is a reel; home tablist behavior continues to follow `Block For you` only

#### Scenario: [interaction] Turning off Block Reels restores the Reels viewer and the sidebar icon
- **WHEN** the person turns `Block Reels` off and activates the left sidebar Reels control or opens `https://www.instagram.com/reels/`
- **THEN** the left-sidebar Reels icon is shown again and the Reels viewer opens as Instagram opens it
