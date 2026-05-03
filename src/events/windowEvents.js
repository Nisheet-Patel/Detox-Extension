// events/windowEvents.js

import { stopTracking, trackDomain } from "../tracker/trackerService.js";
import { state } from "../tracker/state.js";
import { getDomain } from "../utils/url.js";

export function initWindowEvents() {
  browser.windows.onFocusChanged.addListener(async (windowId) => {
    if (windowId === browser.windows.WINDOW_ID_NONE) {
      state.focusedWindowId = null;
      await stopTracking();
      return;
    }

    state.focusedWindowId = windowId;

    const [tab] = await browser.tabs.query({ active: true, windowId });
    state.activeTabId = tab?.id ?? null;

    if (!state.isIdle && tab) {
      await trackDomain(getDomain(tab.url));
    }
  });
}
