// background.js

import "./vendor/browser-polyfill.min.js";

// 1. Import your new StorageService
import { StorageService } from "../src/storage/storageService.js"; 

import { initTabEvents } from "./events/tabEvents.js";
import { initIdleEvents } from "./events/idleEvents.js";
import { initWindowEvents } from "./events/windowEvents.js";
import {
  enforceTimeLimitForTab,
  initTimeLimitService
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

// Queued synchronization mechanism to prevent race conditions and excessive I/O
let isSyncing = false;
let hasPendingSync = false;

function triggerSync() {
  if (isSyncing) {
    hasPendingSync = true;
    return;
  }

  isSyncing = true;
  hasPendingSync = false;

  void (async () => {
    try {
      await syncTrackingState();
    } catch (error) {
      console.error("Error during syncTrackingState:", error);
    } finally {
      isSyncing = false;
      if (hasPendingSync) {
        // Yield to event loop to avoid call stack overhead
        setTimeout(() => triggerSync(), 0);
      }
    }
  })();
}

// authoritatively query and update memory cache of browser state
async function updateCachedState() {
  const idleState = await browser.idle.queryState(15).catch(() => "active");
  state.isIdle = (idleState === "locked" || idleState === "idle");

  const window = await browser.windows.getLastFocused().catch(() => null);
  if (!window || !window.focused || window.state === "minimized") {
    state.focusedWindowId = null;
    state.isWindowFocused = false;
    state.activeTabId = null;
    state.activeTabUrl = null;
    state.activeTabHidden = false;
    return;
  }

  state.focusedWindowId = window.id;
  state.isWindowFocused = true;

  const [tab] = await browser.tabs.query({ active: true, windowId: window.id }).catch(() => []);
  if (!tab) {
    state.activeTabId = null;
    state.activeTabUrl = null;
    state.activeTabHidden = false;
    return;
  }

  state.activeTabId = tab.id;
  state.activeTabUrl = tab.url;
  state.activeTabHidden = tab.hidden ?? false;
}

let lastSyncState = {
  isIdle: undefined,
  isWindowFocused: undefined,
  activeTabId: undefined,
  activeTabDomain: undefined,
  activeTabHidden: undefined
};

async function syncTrackingState() {
  await initializeTrackerSession();

  const domain = getDomain(state.activeTabUrl);

  // If nothing changed since last sync, skip to avoid duplicate work and I/O
  if (
    state.isIdle === lastSyncState.isIdle &&
    state.isWindowFocused === lastSyncState.isWindowFocused &&
    state.activeTabId === lastSyncState.activeTabId &&
    domain === lastSyncState.activeTabDomain &&
    state.activeTabHidden === lastSyncState.activeTabHidden
  ) {
    return;
  }

  // Update last sync state cache
  lastSyncState = {
    isIdle: state.isIdle,
    isWindowFocused: state.isWindowFocused,
    activeTabId: state.activeTabId,
    activeTabDomain: domain,
    activeTabHidden: state.activeTabHidden
  };

  if (state.isIdle) {
    await stopTracking();
    return;
  }

  if (!state.isWindowFocused || state.focusedWindowId === null) {
    await stopTracking();
    return;
  }

  if (state.activeTabId === null || state.activeTabHidden) {
    await stopTracking();
    return;
  }

  if (!domain) {
    await stopTracking();
    return;
  }

  // Avoid duplicate calls to trackDomain when already tracking the same domain
  if (!state.session || state.session.domain !== domain) {
    await trackDomain(domain);
  }

  const activeTab = {
    id: state.activeTabId,
    url: state.activeTabUrl,
    active: true
  };
  await enforceTimeLimitForTab(activeTab);
}

// Initialize your tracking events
initTabEvents(triggerSync);
initIdleEvents(triggerSync);
initWindowEvents(triggerSync);

// Perform initial startup sync
void (async () => {
  await updateCachedState();
  await initTimeLimitService();
  await syncTrackingState();
})();

// 3. Use the StorageService in your message listeners
browser.runtime.onMessage.addListener(async (message, sender) => {
  if (message?.type === "TRACKING_GET_SNAPSHOT") {
    await updateCachedState();
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

  if (message.type === 'INSTAGRAM_TOGGLE_STORIES') {
    await StorageService.updateContentFilters({ 
      hideInstagramStories: message.payload 
    });

    return { success: true };
  }

  if (message.type === 'INSTAGRAM_TOGGLE_FEED') {
    await StorageService.updateContentFilters({ 
      hideInstagramFeed: message.payload 
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
    const added = await StorageService.addBlockedYouTubeChannel(message.payload);

    return { success: added };
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

  if (message.type === "OPEN_INTERNAL_PAGE") {
    const tabId = sender?.tab?.id;

    if (!tabId) {
      return { success: false };
    }

    const internalPageUrl = new URL(
      browser.runtime.getURL(message.payload?.path || "src/ui/blocked-content/blocked-content.html")
    );

    const query = message.payload?.query || {};
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === "") {
        continue;
      }

      internalPageUrl.searchParams.set(key, String(value));
    }

    await browser.tabs.update(tabId, { url: internalPageUrl.toString() });
    return { success: true };
  }

});
