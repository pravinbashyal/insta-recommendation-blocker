# Spec Delta

## Purpose

Hides Explore discovery grids while Block Explore contents is on, keeps the page on Explore, and leaves the search input and account results usable.

## ADDED Requirements

### Requirement: Explore discovery grids follow the Block Explore contents switch
While `Block Explore contents` is on, Explore SHALL stay on Explore with a usable search input and choosable account results, and recommendation and search-content grids SHALL stay hidden. While it is off, those grids SHALL return.

#### Scenario: [interaction] Explore shows search without the recommendation grid while Block Explore contents is on
- **WHEN** `Block Explore contents` is on and the person opens `https://www.instagram.com/explore/`
- **THEN** the search input on that page is usable, the recommendation grid is not shown and cannot be scrolled, and the page stays on Explore

#### Scenario: [interaction] Explore's For you and Not personalized tabs show no discovery grid while Block Explore contents is on
- **WHEN** `Block Explore contents` is on and the person is on `https://www.instagram.com/explore/`, where the tabs are For you and Not personalized
- **THEN** neither tab presents a recommendation grid, and the search input on that page remains usable. This switch is separate from `Block For you`

#### Scenario: [interaction] Sidebar Search still opens Explore search while Block Explore contents is on
- **WHEN** `Block Explore contents` is on and the person activates the left sidebar Search control, which navigates to `https://www.instagram.com/explore/`
- **THEN** they arrive on Explore with the search input usable and the recommendation grid not shown

#### Scenario: [interaction] Searching for a user from Explore opens that profile while Block Explore contents is on
- **WHEN** `Block Explore contents` is on and the person types in the search input on `https://www.instagram.com/explore/` and chooses an account from the results
- **THEN** that account's profile loads at `https://www.instagram.com/<username>/`, including that profile's posts and reels grid

#### Scenario: [interaction] Explore search content grids stay hidden while account results stay choosable
- **WHEN** `Block Explore contents` is on and the person submits a search that would show a post or reel grid, including `https://www.instagram.com/explore/search/keyword/?q=<query>`, a hashtag grid, or a place grid
- **THEN** that content grid is not shown, the search input remains usable, and account rows in the search results can still be chosen to open a profile

#### Scenario: [interaction] Turning off Block Explore contents restores the Explore grid
- **WHEN** the person turns `Block Explore contents` off and opens `https://www.instagram.com/explore/`
- **THEN** Instagram's search input, For you and Not personalized tabs, and recommendation grid all behave as they do without this block, and search still works
