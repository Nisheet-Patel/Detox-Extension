// events/windowEvents.js

import { commitTime, start } from "../tracker/trackerService.js";
import { state } from "../tracker/state.js";
import { getDomain } from "../utils/url.js";

export function initWindowEvents() {
  browser.windows.onFocusChanged.addListener(async (windowId) => {
    if (windowId === browser.windows.WINDOW_ID_NONE) {
      await commitTime();
    } else {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (!state.isIdle && tab) {
        const domain = getDomain(tab.url);
        start(domain);
      }
    }
  });
}