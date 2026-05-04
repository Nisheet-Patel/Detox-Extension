// background.js

import "./vendor/browser-polyfill.min.js";

// 1. Import your new StorageService
import { StorageService } from "../src/storage/storageService.js"; 

import { initTabEvents } from "./events/tabEvents.js";
import { initIdleEvents } from "./events/idleEvents.js";
import { initWindowEvents } from "./events/windowEvents.js";
import {
  enforceActiveTabTimeLimit,
  enforceTimeLimitForTab,
  startTimeLimitMonitor
} from "./enforcement/timeLimitService.js";
import { state } from "./tracker/state.js";
import {
  getUsageSnapshot,
  initializeTrackerSession,
  stopTracking,
  trackDomain
} from "./tracker/trackerService.js";
import { getDomain } from "./utils/url.js";

// 2. Initialize defaults when the extension is installed
browser.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install" || details.reason === "update") {
    await StorageService.init();
    console.log("Storage initialized with default schema.");
  }
});

// Initialize your tracking events
initTabEvents();
initIdleEvents();
initWindowEvents();
initTimeLimitEnforcement();
startTimeLimitMonitor();
syncTrackingState();

async function syncTrackingState() {
  await initializeTrackerSession();

  const idleState = await browser.idle.queryState(15);
  state.isIdle = idleState === "locked";

  if (state.isIdle) {
    await stopTracking();
    return;
  }

  const window = await browser.windows.getLastFocused();
  if (!window?.focused) {
    await stopTracking();
    return;
  }

  state.focusedWindowId = window.id ?? null;

  const [tab] = await browser.tabs.query({ active: true, windowId: window.id });
  if (!tab) {
    await stopTracking();
    return;
  }

  state.activeTabId = tab.id ?? null;
  await trackDomain(getDomain(tab.url));
  await enforceTimeLimitForTab(tab);
}

function initTimeLimitEnforcement() {
  browser.tabs.onActivated.addListener(async ({ tabId }) => {
    const tab = await browser.tabs.get(tabId).catch(() => null);

    if (tab) {
      await enforceTimeLimitForTab(tab);
    }
  });

  browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (!tab?.active || (!changeInfo.url && changeInfo.status !== "complete")) {
      return;
    }

    if (tabId !== state.activeTabId) {
      return;
    }

    await enforceTimeLimitForTab(tab);
  });

  browser.windows.onFocusChanged.addListener(async (windowId) => {
    if (windowId === browser.windows.WINDOW_ID_NONE) {
      return;
    }

    await enforceActiveTabTimeLimit();
  });

  browser.idle.onStateChanged.addListener(async (idleState) => {
    if (idleState === "active") {
      await enforceActiveTabTimeLimit();
    }
  });
}

// 3. Use the StorageService in your message listeners
browser.runtime.onMessage.addListener(async (message, sender) => {
  if (message?.type === "TRACKING_GET_SNAPSHOT") {
    await syncTrackingState();
    return await getUsageSnapshot();
  }

  if (message.type === 'INSTAGRAM_TOGGLE_REELS') {
    console.log('Received:', message.payload);

    // Update the specific filter using your service method
    await StorageService.updateContentFilters({ 
      hideInstagramReels: message.payload 
    });

    return { success: true };
  }

  if (message.type === 'INSTAGRAM_TOGGLE_EXPLORE') {
    await StorageService.updateContentFilters({ 
      hideInstagramExplore: message.payload 
    });

    return { success: true };
  }

  if (message.type === 'YOUTUBE_TOGGLE_SHORTS') {
    await StorageService.updateContentFilters({
      hideYouTubeShorts: message.payload
    });

    return { success: true };
  }

  if (message.type === 'YOUTUBE_TOGGLE_RECOMMENDATIONS') {
    await StorageService.updateContentFilters({
      hideYouTubeRecommendations: message.payload
    });

    return { success: true };
  }

  if (message.type === 'YOUTUBE_ADD_BLOCKED_CHANNEL') {
    await StorageService.addBlockedYouTubeChannel(message.payload);

    return { success: true };
  }

  if (message.type === 'YOUTUBE_REMOVE_BLOCKED_CHANNEL') {
    await StorageService.removeBlockedYouTubeChannel(message.payload);

    return { success: true };
  }

  if (message.type === 'YOUTUBE_UPDATE_BLOCKED_CHANNEL') {
    const updated = await StorageService.updateBlockedYouTubeChannel(
      message.payload.identifier,
      message.payload.updates
    );

    return { success: updated };
  }

});
