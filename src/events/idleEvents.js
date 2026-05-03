// events/idleEvents.js

import { state } from "../tracker/state.js";
import { stopTracking, trackDomain } from "../tracker/trackerService.js";
import { getDomain } from "../utils/url.js";

export function initIdleEvents() {
  browser.idle.setDetectionInterval(15);

  browser.idle.onStateChanged.addListener(async (idleState) => {
    if (idleState === "locked") {
      state.isIdle = true;
      await stopTracking();
    } else if (idleState === "active" && state.isIdle) {
      state.isIdle = false;

      const query = state.focusedWindowId === null
        ? { active: true, lastFocusedWindow: true }
        : { active: true, windowId: state.focusedWindowId };
      const [tab] = await browser.tabs.query(query);

      if (tab) {
        state.activeTabId = tab.id ?? null;
        state.focusedWindowId = tab.windowId ?? state.focusedWindowId;
        await trackDomain(getDomain(tab.url));
      }
    }
  });
}
