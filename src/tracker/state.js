// tracker/state.js

/**
 * Central runtime state.
 * Kept isolated so it can be reused/tested easily.
 */
export const state = {
  session: null,
  sessionLoaded: false,
  isIdle: false,
  activeTabId: null,
  activeTabUrl: null,
  activeTabHidden: false,
  focusedWindowId: null,
  isWindowFocused: false,
  stateVersion: 0,
  operationQueue: Promise.resolve(),
  timeLimitMonitorId: null,
};
