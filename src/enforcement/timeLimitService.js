import { StorageService } from "../storage/storageService.js";
import { getUsageSnapshot, stopTracking } from "../tracker/trackerService.js";
import { state } from "../tracker/state.js";
import {
  findBestMatchingEntry,
  getDomain,
  getMatchedUsageTotal,
  normalizeDomain
} from "../utils/url.js";

const CHECK_INTERVAL_MS = 1000;
const LIMIT_REACHED_PAGE_PATH = "src/ui/limit-reached/limit-reached.html";

function getLimitReachedPageUrl(params) {
  const url = new URL(browser.runtime.getURL(LIMIT_REACHED_PAGE_PATH));

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) {
      continue;
    }

    url.searchParams.set(key, String(value));
  }

  return url.toString();
}

async function getFocusedActiveTab() {
  if (state.activeTabId !== null) {
    const activeTab = await browser.tabs.get(state.activeTabId).catch(() => null);

    if (activeTab?.active) {
      return activeTab;
    }
  }

  const query = state.focusedWindowId === null
    ? { active: true, lastFocusedWindow: true }
    : { active: true, windowId: state.focusedWindowId };
  const [tab] = await browser.tabs.query(query);

  return tab ?? null;
}

async function getMatchingWebsiteRule(hostname) {
  const managedWebsites = await StorageService.getManagedWebsites();
  return findBestMatchingEntry(hostname, managedWebsites);
}

async function redirectTabToLimitPage(tabId, data) {
  const redirectUrl = getLimitReachedPageUrl(data);

  await stopTracking(Date.now());
  await browser.tabs.update(tabId, { url: redirectUrl });
}

export async function enforceTimeLimitForTab(tab) {
  if (!tab?.id || state.isIdle) {
    return false;
  }

  if (typeof tab.url === "string" && tab.url.startsWith(browser.runtime.getURL(LIMIT_REACHED_PAGE_PATH))) {
    return false;
  }

  const hostname = getDomain(tab.url);
  if (!hostname) {
    return false;
  }

  const matchedRule = await getMatchingWebsiteRule(hostname);
  if (!matchedRule) {
    return false;
  }

  if (matchedRule.limitSeconds === 0) {
    await redirectTabToLimitPage(tab.id, {
      domain: normalizeDomain(matchedRule.domain),
      hostname,
      reason: "blocked"
    });

    return true;
  }

  const snapshot = await getUsageSnapshot();
  const timeSpentMs = getMatchedUsageTotal(snapshot.usage, matchedRule.domain);
  const timeLimitMs = matchedRule.limitSeconds * 1000;

  if (timeSpentMs < timeLimitMs) {
    return false;
  }

  await redirectTabToLimitPage(tab.id, {
    domain: normalizeDomain(matchedRule.domain),
    hostname,
    reason: "limit",
    timeSpentMs,
    timeLimitMs
  });

  return true;
}

export async function enforceActiveTabTimeLimit() {
  if (state.isIdle) {
    return false;
  }

  const activeTab = await getFocusedActiveTab();

  if (!activeTab?.active) {
    return false;
  }

  return enforceTimeLimitForTab(activeTab);
}

export function startTimeLimitMonitor() {
  if (state.timeLimitMonitorId !== null) {
    clearInterval(state.timeLimitMonitorId);
  }

  state.timeLimitMonitorId = setInterval(() => {
    void enforceActiveTabTimeLimit();
  }, CHECK_INTERVAL_MS);
}
