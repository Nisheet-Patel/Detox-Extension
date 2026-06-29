// events/windowEvents.js

import { state } from "../tracker/state.js";

export function initWindowEvents(triggerSync) {
  browser.windows.onFocusChanged.addListener(async (windowId) => {
    state.stateVersion++;
    const currentVersion = state.stateVersion;

    if (windowId === browser.windows.WINDOW_ID_NONE) {
      state.focusedWindowId = null;
      state.isWindowFocused = false;
      state.activeTabId = null;
      state.activeTabUrl = null;
      state.activeTabHidden = false;
      triggerSync();
    } else {
      state.focusedWindowId = windowId;
      state.isWindowFocused = true;

      const win = await browser.windows.get(windowId).catch(() => null);
      if (currentVersion !== state.stateVersion) {
        return;
      }

      if (win && win.focused && win.state !== "minimized") {
        const [tab] = await browser.tabs.query({ active: true, windowId }).catch(() => []);
        if (currentVersion !== state.stateVersion) {
          return;
        }

        state.activeTabId = tab?.id ?? null;
        state.activeTabUrl = tab?.url ?? null;
        state.activeTabHidden = tab?.hidden ?? false;
      } else {
        state.focusedWindowId = null;
        state.isWindowFocused = false;
        state.activeTabId = null;
        state.activeTabUrl = null;
        state.activeTabHidden = false;
      }
      triggerSync();
    }
  });
}
