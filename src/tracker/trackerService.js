// tracker/trackerService.js

import { state } from "./state.js";
import { addTime } from "../storage/storageService.js";

/**
 * Commits current session time.
 */
export async function commitTime() {
  if (!state.domain || !state.startTime) return;

  const duration = Date.now() - state.startTime;
  if (duration <= 0) return;

  await addTime(state.domain, duration);

  state.startTime = null;
}

/**
 * Starts tracking a domain.
 */
export function start(domain) {
  state.domain = domain;
  state.startTime = Date.now();
}

/**
 * Switches tracking to a new domain.
 */
export async function switchTo(domain) {
  if (domain === state.domain) return;

  await commitTime();
  start(domain);
}