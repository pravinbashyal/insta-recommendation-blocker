# Store Listing Copy

Reference text for the Chrome Web Store and Firefox AMO submissions.

---

## Name
Instagram Recommendation Blocker

## Short description (Chrome: max 132 chars)
Hide Instagram's For you feed, Reels, and Explore recommendations with three toolbar switches. See only who you follow.

## Summary (Firefox AMO: max 250 chars)
Instagram's For you, Reels, and Explore surfaces push ads and algorithmic filler. This extension dials that back with three toolbar switches so the people and creators you chose to follow stay in front. Nothing is collected; state is stored locally.

## Category
- Chrome: **Productivity**
- Firefox: **Other** (or **Privacy & Security**)

## Detailed description (both stores)

Instagram's default surfaces — For you, Reels, and Explore — push a lot of ads
and algorithmic filler. Instagram Recommendation Blocker dials that back so the
people and creators you chose to follow stay in front.

Three toolbar switches, all on after install:

• Block For you — Home opens on Following and the For you tab is removed.
• Block Reels — The Reels tab leaves home and its sidebar icon is hidden. Single
  reels, profile reels, in-feed reels, and reel posts in the Following feed still
  work.
• Block Explore contents — Explore stays open for search and account results;
  recommendation grids stay hidden.

Messages, profiles, and individual posts stay available under every combination
of the switches.

Privacy:
• Works only on instagram.com.
• No data collected, no tracking, no analytics, no remote code.
• Switch state is stored locally in your browser.

---

## Permission justifications

### storage
Used to remember the on/off state of the three toolbar switches between browsing
sessions. Stored locally on the user's device; never transmitted.

### Host permission: *://*.instagram.com/*
The content script must run on Instagram pages to detect and hide recommendation
surfaces (For you feed, Reels viewer, Explore grids). The extension does not run
on any other site.

### Chrome "single purpose" statement
A single-purpose tool that hides Instagram's algorithmic recommendation surfaces
(For you, Reels, Explore) so users see content from accounts they follow.

### Remote code
No. The extension executes no remotely hosted code. All logic is bundled.

### Data usage disclosures (Chrome Privacy tab)
Check: the extension does NOT collect or use any of the listed user data types.
Certify: data is not sold/transferred to third parties, not used for unrelated
purposes, not used for creditworthiness/lending.

---

## Assets still needed before submitting
- Privacy policy URL (host PRIVACY.md publicly — see note below).
- At least one screenshot: Chrome wants 1280×800 or 640×400; Firefox wants
  up to 10 screenshots. Suggested shots: the popup with the three switches, and
  Instagram home showing the Following feed.
- Chrome: small promo tile 440×280 is optional but recommended.

## Hosting the privacy policy
Easiest options for a public URL:
- Enable GitHub Pages on the repo and link to PRIVACY.md, or
- Paste the contents into a public GitHub Gist and use its raw URL, or
- Link directly to the file on GitHub:
  https://github.com/pravinbashyal/insta-recommendation-blocker/blob/main/PRIVACY.md
