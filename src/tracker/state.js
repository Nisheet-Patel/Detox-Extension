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
  focusedWindowId: null,
  operationQueue: Promise.resolve(),
};
