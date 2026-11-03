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

This extension isn't in the Chrome Web Store or Firefox Add-ons yet, so you install it yourself. It's quick and you don't need any technical knowledge — just follow the steps for your browser.

### Step 1 — Download and unzip the extension

1. **[⬇️ Click here to download the ZIP](https://github.com/pravinbashyal/insta-recommendation-blocker/archive/refs/heads/main.zip)**
2. Find the downloaded file (usually in your **Downloads** folder). It's called `insta-recommendation-blocker-main.zip`.
3. **Unzip it:**
   - **Windows:** right-click the file → **Extract All…** → **Extract**.
   - **Mac:** double-click the file.
4. You now have a folder called `insta-recommendation-blocker-main`. Inside it is a folder named **`extension`** — that's the one you'll point your browser at in the next step.

> 💡 Keep this folder somewhere you won't delete it (e.g. Documents). The extension runs from these files, so if you move them to the trash it stops working.

### Step 2 — Add it to your browser

#### Chrome, Edge, Brave (and other Chrome-based browsers)

1. Open a new tab and go to:
   - **Chrome / Brave:** type `chrome://extensions` in the address bar and press Enter
   - **Edge:** type `edge://extensions` and press Enter
2. Turn on **Developer mode** — the switch in the **top-right** corner.
3. Click the **Load unpacked** button (top-left).
4. A file picker opens. Go into the folder you unzipped and select the **`extension`** folder, then click **Select / Open**.
   - ⚠️ Pick the folder *named* `extension`, not the outer `insta-recommendation-blocker-main` folder.
5. **Instagram Recommendation Blocker** now appears in your list — you're done!
6. *(Recommended)* Click the puzzle-piece 🧩 icon near the address bar and pin the extension so its button is always visible.

#### Firefox

1. Open a new tab, type `about:debugging#/runtime/this-firefox` in the address bar, and press Enter.
2. Click **Load Temporary Add-on…**.
3. Go into the unzipped folder, open the **`extension`** folder, and select the file called **`manifest.json`**.

> ⚠️ Firefox note: temporary add-ons are removed every time you fully quit Firefox. You'll need to repeat these three steps the next time you open it. (Chrome/Edge/Brave remember the extension permanently.)

### Step 3 — Use it

1. Open [instagram.com](https://www.instagram.com/).
2. Click the extension's icon (the toolbar button) to open its popup.
3. You'll see **three switches, all turned on** by default. Flip any of them off to let that content back in.

That's it. Your Following feed, not the algorithm, is now in charge.

<details>
<summary>Safari on Mac (advanced — requires Xcode)</summary>

1. Open `safari/Instagram Recommendation Blocker/Instagram Recommendation Blocker.xcodeproj` in Xcode.
2. Select the **Instagram Recommendation Blocker** scheme and run it (⌘R). That installs the host app and the Safari web extension.
3. In **Safari → Settings → Extensions**, enable **Instagram Recommendation Blocker**.
4. When Safari asks, allow access for `instagram.com`.
5. Open Instagram in Safari and use the extension's toolbar / popup controls as in other browsers.

The Safari target loads the shared files from `extension/`; you do not maintain a second copy of the blocking logic.

</details>

### Updating to a newer version

Download the ZIP again, unzip it (replacing the old folder), then:
- **Chrome / Edge / Brave:** go back to the extensions page and click **Reload** ↻ on the extension's card.
- **Firefox:** load the add-on again as in Step 2.

## Develop

```bash
git clone https://github.com/pravinbashyal/insta-recommendation-blocker.git
cd insta-recommendation-blocker
npm test
```

Fixture checks cover home, Reels, Explore, and cross-toggle behavior without a live Instagram session.

## License

MIT — see [LICENSE](LICENSE).
