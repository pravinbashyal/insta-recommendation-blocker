# Spec Delta

## Purpose

Leaves the Reels destination and its sidebar entry for home while Block Reels is on, and leaves single reels, profile reels, and home-feed posts available.

## ADDED Requirements

### Requirement: The Reels destination follows the Block Reels switch
While `Block Reels` is on, `/reels/` and its sidebar entry SHALL leave for `https://www.instagram.com/` with the current `Block For you` state, and a single reel, profile reels, and home-feed posts SHALL stay. While it is off, the Reels viewer SHALL open.

#### Scenario: [interaction] Opening the Reels route leaves the viewer while Block Reels is on
- **WHEN** `Block Reels` is on and the person opens `https://www.instagram.com/reels/` (trailing slash or unrelated query params included)
- **THEN** they leave that route for `https://www.instagram.com/`, they do not get a watchable pass through the Reels viewer, and the home feed they land on matches the current `Block For you` state

#### Scenario: [interaction] The sidebar Reels control does not open the viewer while Block Reels is on
- **WHEN** `Block Reels` is on and the person looks at the left sidebar control that navigates to `https://www.instagram.com/reels/`
- **THEN** that control is not a way into the Reels viewer; activating a `/reels/` control Instagram still inserts ends on `https://www.instagram.com/` with the home feed matching the current `Block For you` state, and the viewer does not remain on screen

#### Scenario: [interaction] A single reel link and a profile's reels still open while Block Reels is on
- **WHEN** `Block Reels` is on and the person opens `https://www.instagram.com/reel/<shortcode>/` or `https://www.instagram.com/<username>/reel/<shortcode>/`, or opens the Reels tab on `https://www.instagram.com/<username>/`
- **THEN** that reel or that profile's reels grid loads as Instagram loads it

#### Scenario: [interaction] Following-feed posts stay while Block Reels is on
- **WHEN** `Block Reels` is on and the person is on the home feed at `https://www.instagram.com/` or `https://www.instagram.com/?variant=following`
- **THEN** the home feed still shows the posts Instagram places there, including a post that is a reel; home tablist behavior continues to follow `Block For you` only

#### Scenario: [interaction] Turning off Block Reels restores the Reels viewer
- **WHEN** the person turns `Block Reels` off and activates the left sidebar Reels control or opens `https://www.instagram.com/reels/`
- **THEN** the Reels viewer opens as Instagram opens it
