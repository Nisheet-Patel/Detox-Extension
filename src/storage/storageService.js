// storage/storageService.js

import { getTodayKey } from "../utils/date.js";

/**
 * Adds duration to a domain for today.
 *
 * @param {string} domain
 * @param {number} duration (ms)
 */
export async function addTime(domain, duration) {
  if (!domain || duration <= 0) return;

  const today = getTodayKey();

  const data = await browser.storage.local.get(today);
  const dayData = data[today] || {};

  dayData[domain] = (dayData[domain] || 0) + duration;

  await browser.storage.local.set({
    [today]: dayData
  });
}