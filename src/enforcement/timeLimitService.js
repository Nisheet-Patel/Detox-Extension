import { StorageService } from "../storage/storageService.js";
import { getUsageSnapshot, stopTracking } from "../tracker/trackerService.js";
import { state } from "../tracker/state.js";
import {
  findBestMatchingEntry,
  getDomain,
  getMatchedUsageTotal,
  normalizeDomain
} from "../utils/url.js";

const LIMIT_REACHED_PAGE_PATH = "src/ui/limit-reached/limit-reached.html";

// Memory cache for managed websites (domains and budgets)
let cachedManagedWebsites = [];

export async function loadCachedManagedWebsites() {
  cachedManagedWebsites = await StorageService.getManagedWebsites().catch(() => []);
}

// Keep the local memory rules cache in sync whenever storage changes
browser.storage.onChanged.addListener((changes) => {
  if (changes.blockedDomains || changes.dailyBudgets) {
    void loadCachedManagedWebsites();
  }
});

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

function getMatchingWebsiteRule(hostname) {
  return findBestMatchingEntry(hostname, cachedManagedWebsites);
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

  const matchedRule = getMatchingWebsiteRule(hostname);
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
  if (state.isIdle || !state.isWindowFocused || state.activeTabId === null || state.activeTabHidden) {
    return false;
  }

  const activeTab = {
    id: state.activeTabId,
    url: state.activeTabUrl,
    active: true
  };

  return enforceTimeLimitForTab(activeTab);
}

export function startTimeLimitMonitor() {
  if (state.timeLimitMonitorId !== null) {
    clearInterval(state.timeLimitMonitorId);
  }

  state.timeLimitMonitorId = setInterval(() => {
    void enforceActiveTabTimeLimit();
  }, 5000); // 5-second interval for time-limit enforcement to optimize performance
}

export async function initTimeLimitService() {
  await loadCachedManagedWebsites();
  startTimeLimitMonitor();
}
