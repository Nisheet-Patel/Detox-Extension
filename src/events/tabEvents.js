// events/tabEvents.js

import { state } from "../tracker/state.js";

export function initTabEvents(triggerSync) {
  browser.tabs.onActivated.addListener(async ({ tabId, windowId }) => {
    if (windowId === state.focusedWindowId) {
      state.stateVersion++;
      const currentVersion = state.stateVersion;

      state.activeTabId = tabId;

      const tab = await browser.tabs.get(tabId).catch(() => null);
      if (currentVersion !== state.stateVersion) {
        return;
      }

      if (tab) {
        state.activeTabUrl = tab.url;
        state.activeTabHidden = tab.hidden ?? false;
      } else {
        state.activeTabUrl = null;
        state.activeTabHidden = false;
      }
      triggerSync();
    }
  });

  browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (tabId === state.activeTabId && tab.active && tab.windowId === state.focusedWindowId) {
      let changed = false;

      if (changeInfo.url !== undefined) {
        state.activeTabUrl = changeInfo.url;
        changed = true;
      }
      if (changeInfo.hidden !== undefined) {
        state.activeTabHidden = changeInfo.hidden;
        changed = true;
      }

      if (changed || changeInfo.status === "complete") {
        state.stateVersion++; // Invalidate any pending async queries from previous events
        triggerSync();
      }
    }
  });

  browser.tabs.onRemoved.addListener(async (tabId) => {
    if (tabId === state.activeTabId) {
      state.stateVersion++; // Invalidate any pending async queries
      state.activeTabId = null;
      state.activeTabUrl = null;
      state.activeTabHidden = false;
      triggerSync();
    }
  });
}
