
// events/tabEvents.js

import { switchTo } from "../tracker/trackerService.js";
import { state } from "../tracker/state.js";
import { getDomain } from "../utils/url.js";

export function initTabEvents() {
  browser.tabs.onActivated.addListener(async ({ tabId }) => {
    const tab = await browser.tabs.get(tabId);
    const domain = getDomain(tab.url);

    if (!state.isIdle) {
      await switchTo(domain);
    }
  });

  browser.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
    if (changeInfo.url && !state.isIdle) {
      const domain = getDomain(changeInfo.url);
      await switchTo(domain);
    }
  });
}