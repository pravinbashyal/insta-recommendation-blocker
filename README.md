# Instagram Recommendation Blocker

Instagram’s default surfaces — For you, Reels, and Explore — push a lot of ads and algorithmic filler. This extension dials that back so the people and creators you chose to follow stay in front.

## What it does

Three toolbar switches, all on after install:

| Switch | When on |
| --- | --- |
| **Block For you** | Home opens on Following and the For you tab is removed. |
| **Block Reels** | The Reels tab leaves for home and its sidebar icon is hidden. Single reels, profile reels, in-feed reels, and reel posts in the Following feed still work. |
| **Block Explore contents** | Explore stays open for search and account results; recommendation grids stay hidden. |

Messages, profiles, and individual posts stay available under every combination of the switches. Access is limited to Instagram; switch state is stored locally in the browser.

## Installation

The extension is not on the Chrome Web Store, Firefox Add-ons, or the App Store yet. Install it from this repository as an unpacked / local extension.

### 1. Get the code

```bash
git clone https://github.com/pravinbashyal/insta-recommendation-blocker.git
cd insta-recommendation-blocker
```

Or download the ZIP from GitHub and unpack it. You only need the `extension/` folder for Chromium and Firefox.

### 2. Load it in your browser

#### Chrome, Edge, Brave, and other Chromium browsers

1. Open the extensions page:
   - Chrome / Brave: `chrome://extensions`
   - Edge: `edge://extensions`
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked**.
4. Select the `extension/` folder inside this repo (the folder that contains `manifest.json`), not the repo root.
5. Confirm **Instagram Recommendation Blocker** appears and is enabled.
6. Optional: pin it from the puzzle-piece toolbar menu so the popup is easy to open.

Open [instagram.com](https://www.instagram.com/). The three switches start **on**. Click the extension icon to turn any of them off.

If you change files under `extension/`, return to the extensions page and click **Reload** on the card, then refresh Instagram tabs.

#### Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…**.
3. Select `extension/manifest.json`.
4. Open [instagram.com](https://www.instagram.com/) and use the toolbar icon for the switches.

Temporary add-ons are removed when Firefox quits. Load the same file again after a restart.

#### Safari (macOS)

You need Xcode installed.

1. Open `safari/Instagram Recommendation Blocker/Instagram Recommendation Blocker.xcodeproj` in Xcode.
2. Select the **Instagram Recommendation Blocker** scheme and run it (⌘R). That installs the host app and the Safari web extension.
3. In **Safari → Settings → Extensions**, enable **Instagram Recommendation Blocker**.
4. When Safari asks, allow access for `instagram.com`.
5. Open Instagram in Safari and use the extension’s toolbar / popup controls as in other browsers.

The Safari target loads the shared files from `extension/`; you do not maintain a second copy of the blocking logic.

## Develop

```bash
npm test
```

Fixture checks cover home, Reels, Explore, and cross-toggle behavior without a live Instagram session.

## License

MIT — see [LICENSE](LICENSE).
