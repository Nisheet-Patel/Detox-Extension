# <img src="src/icons/icon.png" width="38" height="38" align="center" alt="Detox Icon" /> Detox

Privacy-First Screen Time Tracker & Website Blocker

Detox is a powerful browser extension designed to help you regain control of your attention without breaking the internet. Instead of all-or-nothing bans, Detox provides real-time screen time analytics and allows you to surgically filter out specific distracting components—like individual YouTube channels, Shorts, or Instagram Reels—while setting strict daily budgets for time-sink sites.

---

## 🚀 Why Detox Exists

Typical website blockers are blunt instruments. They force you to choose between completely blocking websites like YouTube (which you might need for study or work) or leaving them completely open to endless rabbit holes.

Detox provides **visibility and surgical control**:
* **Track Your Habits:** See exactly where your time goes with a beautifully designed, real-time analytics dashboard right in your toolbar.
* **Keep the Utility, Block the Noise:** Watch educational lectures on YouTube while hiding the distracting recommendations feed and Shorts.
* **Protect Your Privacy:** Your stats, blocklists, and habits should be yours alone. No cloud sync, no tracking, no subscriptions.

---

## ✨ Key Features

### 📊 Real-Time Screen Time Analytics
Instantly view your daily digital footprint. The Detox popup features a clean dashboard that tracks your active browsing time. It visualizes your day with a color-coded progress bar and provides a detailed, domain-by-domain breakdown of time spent (e.g., `chatgpt.com` vs. `youtube.com`).

### 📺 Surgical YouTube & Instagram Blocking
Block specific YouTube channels by handle, channel ID, or display name. Videos from blocked channels will be hidden from search results, sidebar recommendations, and home feeds. Direct navigation to a blocked channel immediately redirects to an intervention screen.

### 🙈 Hide Infinite Feeds (Shorts & Reels)
Toggle off YouTube Shorts, the YouTube Recommendations feed, Instagram Reels, and Instagram Explore grids. Hiding these features removes infinite-scrolling elements while leaving the core utilities intact.

### ⏳ Daily Site Time Budgets & Quick Block
Define a daily allowance (e.g., 30 minutes) for distracting domains. An elegant status bar keeps track of your active time. Once the limit is reached, access is intercepted. You can also use the **Quick Block** input field on the home dashboard to instantly block a domain or restrict your current active tab.

### 🔒 Local-Only Storage
All usage statistics, blocklists, daily budgets, and toggles are saved locally inside your browser via `chrome.storage.local`. Nothing is uploaded to remote servers, and there are zero tracking analytics.

---

## 🛠️ How It Works

Detox uses an event-driven Manifest V3 Architecture:
1. **Background Tracker:** Listens to tab activation, URL updates, and window focus to record screen time in a passive, batch-written structure that terminates gracefully with MV3 lifecycle states.
2. **Dynamic Stylesheets:** Injects light, non-intrusive CSS styles into YouTube and Instagram to hide elements (`ytd-browse`, `ytd-rich-shelf-renderer`, Reels, etc.) rather than running heavy JavaScript loops.
3. **Redirect Interceptor:** Continuously evaluates current tab contexts against channel and domain blocklists, replacing them with beautiful, local interception pages when rules are violated.

---

## 📸 Dashboard Preview

### Main Dashboard (Popup View)
![Main Dashboard](screenshots/extension-home.png)

---

## 💻 Installation

### Chrome / Edge / Brave / Opera
1. Download or clone this repository to your local machine.
2. Open your browser and navigate to `chrome://extensions/`.
3. In the top-right corner, toggle **Developer mode** on.
4. Click **Load unpacked** in the top-left corner.
5. Select the project root directory containing `manifest.json`.

### Firefox
1. Download or clone this repository to your local machine.
2. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on...** on the right side.
4. Select the `manifest.json` file in the project root directory.

---

## 📖 Usage Guide

1. **Monitor Analytics:** Open the Detox popup to view your total screen time for the day and check the color-coded breakdown of individual websites.
2. **Quick-Add Domain:** In the input field at the bottom, type a domain (e.g., `x.com`) and click **Block**, or simply click **+ This Site** to block the active tab's domain.
3. **Manage Advanced Filters:** Click the **Websites**, **Instagram**, or **YouTube** icons in the dashboard to manage content filters (e.g., toggle Shorts, set budgets, or add specific channels to your blocklist).
4. **Import & Export:** Access the Settings panel (via the gear icon) to export your configuration and screen time history to a JSON file, or restore a backup.

---

## 🛡️ Privacy & Permissions Explained

* **No Telemetry:** Detox collects no browsing behavior, usage metrics, or error logs.
* **No Server Connections:** Detox operates entirely offline.
* **Data Portability:** Inspect, export, or wipe your local database at any time.

To operate, Detox requests the minimum set of permissions:
* `storage`: Required to save your settings, budgets, blocklists, and local screen time statistics.
* `idle`: Required to detect when your browser is inactive so time-tracking pauses.
* `tabs` / `activeTab`: Required to dynamically retrieve the domain of the active tab to update time budgets.
* `declarativeContent` / `scripting`: Required to inject filter stylesheets and intercept blocked domains.

---

## 🤝 Contributing

We welcome contributions from the community! Whether you are fixing a bug, updating content filters to match new platform layout updates, or suggesting a new feature, feel free to open a PR.

### Development Setup
1. Install Node.js (v16+ recommended).
2. Clone the repository:
```bash
   git clone https://github.com/Nisheet-Patel/Detox-Extension.git
   cd Detox-Extension
```

3. Install dependencies:

```bash
   npm install
```

### Build Instructions

Run the build script to copy the required WebExtension polyfills to the vendor directory:

```bash
npm run build
```

Load the root directory into your browser as an unpacked extension.

### Bug Reports & Feature Requests

Please report bugs or request new features by opening an issue on our [GitHub Issues page](https://www.google.com/search?q=https://github.com/Nisheet-Patel/Detox-Extension/issues).

---

## 📜 License

This project is licensed under the Apache License 2.0. See the [LICENSE](LICENSE) file for details.

---

## ⭐ Support the Project

If you find Detox useful, consider sharing it with others who want to improve their digital habits, or star our GitHub repository!