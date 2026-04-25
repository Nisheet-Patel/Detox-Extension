// events/idleEvents.js

import { state } from "../tracker/state.js";
import { commitTime, start } from "../tracker/trackerService.js";
import { getDomain } from "../utils/url.js";

export function initIdleEvents() {
  browser.idle.setDetectionInterval(15);

  browser.idle.onStateChanged.addListener(async (idleState) => {
    if (idleState === "idle" || idleState === "locked") {
      state.isIdle = true;
      await commitTime();
    } else if (idleState === "active") {
      state.isIdle = false;

      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        const domain = getDomain(tab.url);
        start(domain);
      }
    }
  });
}