# Detox Browser Extension - Privacy Documentation

This document contains the official submission information required for the Chrome Web Store Developer Program Policies, followed by a complete, publishable Privacy Policy for the Detox browser extension.

---

### 1. Single Purpose
> **Question:** *An extension must have a single purpose that is narrow and easy to understand.*

Detox is a digital wellbeing extension that allows users to surgically block and manage distractions (such as specific YouTube channels, YouTube Shorts, or Instagram Reels) and set daily time budgets for distracting websites.

---

### 2. Permission Justifications
> **Question:** *Describe how you use each permission requested by your extension. Requesting unnecessary permissions will lead to rejection.*

#### API Permissions
*   **`activeTab`**
    *   **Justification:** Allows the extension to temporarily obtain the current active tab's domain when the user opens the extension popup and clicks "Use Current Tab" to easily add that website to their blocklist or time budget settings.
*   **`storage`**
    *   **Justification:** Required to save the user's custom settings, blocklists, daily time budgets, and local screen time history directly on the user's local machine via `chrome.storage.local`.
*   **`tabs`**
    *   **Justification:** Required to monitor tab URL updates so the extension can detect when the user visits a budgeted or blocked website, update active screen time, and trigger the redirection to the local intervention screen when a limit is reached or a channel is blocked.
*   **`idle`**
    *   **Justification:** Required to detect when the browser state becomes inactive or idle, ensuring that active screen time tracking pauses and doesn't falsely consume the user's daily budget while they are away from their device.

#### Host Permissions (Match Patterns)
*   **`*://www.youtube.com/*`**
    *   **Justification:** Required to execute content-filtering scripts and inject custom CSS to hide distracting components (such as YouTube Shorts, the Home feed, and the video recommendations sidebar) and to block/redirect specific channels according to user preferences.
*   **`*://www.instagram.com/*`**
    *   **Justification:** Required to execute content-filtering scripts and inject custom CSS to hide distracting components (such as Instagram Reels and the Explore grid) according to user preferences.

---

### 3. Remote Code Declaration
> **Question:** *Are you using remote code?*

*   **Answer:** **No**, I am not using remote code.
*   **Justification:** All extension code, assets, styling rules, and scripts are packaged and executed locally within the extension bundle.

---

## Privacy Policy

Copy and paste the markdown content below to create your public Privacy Policy page (e.g., on GitHub Pages, a project website, or a hosting platform).

***

# Privacy Policy for Detox Extension

**Effective Date:** June 14, 2026  
**Project Status:** Open Source (Apache License 2.0)  
**GitHub Repository:** [https://github.com/Nisheet-Patel/Detox-Extension](https://github.com/Nisheet-Patel/Detox-Extension)

At Detox, we believe that your digital wellbeing tools should help you regain control of your attention without monitoring your behavior. This Privacy Policy outlines how the Detox browser extension handles data and why you can trust it.

### 1. No Data Collection or Transmission
Detox is a fully offline, local-first browser extension. 
*   **Zero Remote Servers:** We do not operate any web servers for data collection, syncing, or analytics.
*   **No Personal Information:** We do not collect, store, or transmit your name, email address, IP address, browsing history, or any other personal identifier.
*   **No Third-Party Analytics/Tracking:** Detox contains no tracking code, telemetry, or Google Analytics scripts.

### 2. How Data is Stored
All data used by the extension is stored strictly on your local device:
*   **Storage Location:** Settings, blocklists, custom daily time budgets, and active screen time statistics are saved in the browser's local sandbox using the WebExtension Storage API (`chrome.storage.local`).
*   **No Cloud Sync:** Your configuration does not sync to any cloud server.
*   **User Control:** You are in full control of your data. You can export all your settings and history to a JSON file, or permanently wipe all local database entries at any time via the extension's Settings panel.

### 3. Permissions and Host Matches Used
To function correctly, Detox requests the following browser permissions and host match access:
*   **`storage` (API):** Used to save your settings, preferences, blocklists, and usage logs locally.
*   **`tabs` & `activeTab` (API):** Used to detect the active website domain to accurately calculate time limits and perform block redirects.
*   **`idle` (API):** Used to detect when you walk away from your computer so time tracking pauses automatically.
*   **`*://www.youtube.com/*` (Host Match):** Used to apply blocklists to channels, redirect blocked video pages, and hide Shorts/recommendations.
*   **`*://www.instagram.com/*` (Host Match):** Used to apply element-hiding rules for Reels and the Explore feed.

### 4. Open Source and Auditable
Because Detox is open source under the Apache License 2.0, you do not have to take our word for it. Every line of code is publicly available for audit, inspection, and verification at [our GitHub repository](https://github.com/Nisheet-Patel/Detox-Extension).

### 5. Changes to This Policy
Since Detox does not collect any user contact info, we cannot notify users of policy changes directly. Any updates to this policy will be committed directly to our GitHub repository. We recommend reviewing the repository for any updates.

### 6. Contact
If you have any questions or feedback regarding this Privacy Policy or the extension, please open an issue on our [GitHub Issues page](https://github.com/Nisheet-Patel/Detox-Extension/issues).
