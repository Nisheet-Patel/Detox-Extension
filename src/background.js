// background.js

import "./vendor/browser-polyfill.min.js";

import { initTabEvents } from "./events/tabEvents.js";
import { initIdleEvents } from "./events/idleEvents.js";
import { initWindowEvents } from "./events/windowEvents.js";

initTabEvents();
initIdleEvents();
initWindowEvents();

/**
 * Midnight boundary handler
 */
setInterval(async () => {
  const now = new Date();
  if (now.getHours() === 0 && now.getMinutes() === 0) {
    const { commitTime } = await import("./tracker/trackerService.js");
    await commitTime();
  }
}, 60000);