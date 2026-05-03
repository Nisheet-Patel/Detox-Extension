
// events/tabEvents.js

import { trackDomain } from "../tracker/trackerService.js";
import { state } from "../tracker/state.js";
import { getDomain } from "../utils/url.js";

export function initTabEvents() {
  browser.tabs.onActivated.addListener(async ({ tabId, windowId }) => {
    state.activeTabId = tabId;
    state.focusedWindowId = windowId;

    const tab = await browser.tabs.get(tabId);
    if (state.isIdle || tab.windowId !== state.focusedWindowId) {
      return;
    }

    await trackDomain(getDomain(tab.url));
  });

  browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    const nextUrl = changeInfo.url ?? tab?.url;
    if (!nextUrl || state.isIdle) {
      return;
    }

    if (tabId !== state.activeTabId || !tab?.active) {
      return;
    }

    if (state.focusedWindowId === null || tab.windowId !== state.focusedWindowId) {
      return;
    }

    await trackDomain(getDomain(nextUrl));
  });
}
