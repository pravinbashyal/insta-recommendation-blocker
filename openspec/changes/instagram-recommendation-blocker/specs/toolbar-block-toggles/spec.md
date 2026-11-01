# Spec Delta

## Purpose

Provides the toolbar popup switches that choose which Instagram recommendation surfaces are blocked, remembers those choices on this browser, and limits install access to Instagram.

## ADDED Requirements

### Requirement: Popup lists the three block switches
The toolbar popup SHALL show three switches named `Block For you`, `Block Reels`, and `Block Explore contents`, in that order, and those switches SHALL be enough to control the matching blocks.

#### Scenario: [interaction] The toolbar popup lists three block toggles
- **WHEN** the person has the extension installed and activates its toolbar icon in Chrome, Edge, Firefox, Safari, or another Chromium browser, on any tab
- **THEN** a popup opens with three switches named `Block For you`, `Block Reels`, and `Block Explore contents`, in that order, and no other switch is required to make those behaviors work

### Requirement: A fresh install starts blocking with Instagram-only access
A fresh install SHALL start with all three switches on, SHALL request access only for `*://*.instagram.com/*`, and SHALL apply the on behaviors before any setup step.

#### Scenario: [interaction] A fresh install starts with all three toggles on
- **WHEN** the person finishes installing the extension and opens the toolbar popup before changing anything
- **THEN** `Block For you`, `Block Reels`, and `Block Explore contents` are all on, and visiting Instagram already follows the "toggle on" scenarios below without opening the popup first

#### Scenario: [interaction] Install asks only for Instagram access
- **WHEN** the person installs from the store for that browser (Chrome Web Store, Edge Add-ons, addons.mozilla.org, or Safari's web-extension install, including Safari's per-site allow step for instagram.com)
- **THEN** the install permission is limited to Instagram (`*://*.instagram.com/*`), the three switches exist and are on, and no setup step is required before blocking starts

### Requirement: Switch changes apply immediately, persist, and stay independent
Flipping a switch SHALL update open Instagram tabs without a reinstall and SHALL show the same state after a browser restart. Turning one switch off SHALL restore only that switch's surface.

#### Scenario: [interaction] Toggle changes apply on open Instagram tabs and stick
- **WHEN** the person flips any of the three switches in the toolbar popup, closes the popup, and looks at an open Instagram tab, then later reopens the popup after a browser restart
- **THEN** the Instagram tab shows that switch's new behavior without a reinstall, and the popup shows the same on/off state the person last set

#### Scenario: [interaction] Each toggle changes only its own surface
- **WHEN** the person turns off one switch in the toolbar popup and leaves the other two on
- **THEN** only that switch's surface returns to ordinary Instagram behavior; the other two stay blocked as specified for their on state. Turning `Block For you` off leaves the Explore recommendation grid hidden while `Block Explore contents` is on. Turning `Block Explore contents` off leaves the home For you tab removed while `Block For you` is on. Turning `Block Reels` off leaves both of those in place while they are on
