// events/idleEvents.js

import { state } from "../tracker/state.js";

export function initIdleEvents(triggerSync) {
  browser.idle.setDetectionInterval(15);

  browser.idle.onStateChanged.addListener(async (idleState) => {
    state.stateVersion++;
    state.isIdle = (idleState === "locked" || idleState === "idle");
    triggerSync();
  });
}
