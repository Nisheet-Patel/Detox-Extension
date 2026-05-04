// storage/storageService.js

import { getTodayKey } from "../utils/date.js";
import { normalizeDomain } from "../utils/url.js";

let usageWriteQueue = Promise.resolve();

/**
 * Adds duration to a domain for today.
 *
 * @param {string} domain
 * @param {number} duration (ms)
 */
export async function addTime(domain, duration) {
  if (!domain || duration <= 0) return;

  const writeOperation = usageWriteQueue.then(async () => {
    const today = getTodayKey();
    const data = await browser.storage.local.get(today);
    const dayData = data[today] || {};

    dayData[domain] = (dayData[domain] || 0) + duration;

    await browser.storage.local.set({
      [today]: dayData
    });
  });

  usageWriteQueue = writeOperation.catch((error) => {
    console.error("Failed to persist tracked time:", error);
  });

  await writeOperation;
}

// Ensure we use the polyfill namespace
const storage = typeof browser !== 'undefined' ? browser.storage.local : chrome.storage.local;

const DEFAULT_CONFIG = {
  blockedDomains: [],
  blockedYouTubeChannels: [],
  dailyBudgets: [],
  contentFilters: {
    hideYouTubeShorts: false,
    hideYouTubeRecommendations: false,
    hideInstagramReels: false,
    hideInstagramExplore: false,
    hideInstagramStories: false,
    hideInstagramFeed: false // Included based on your previous UI requirements
  }
};

function normalizeYouTubeValue(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeLimitSeconds(limitSeconds) {
  const normalized = Number(limitSeconds);

  if (!Number.isFinite(normalized) || normalized < 0) {
    return 0;
  }

  return Math.floor(normalized);
}

function matchesBlockedYouTubeChannel(channel, identifier) {
  if (!channel || !identifier) {
    return false;
  }

  if (typeof identifier === "string") {
    const normalizedIdentifier = normalizeYouTubeValue(identifier);

    return [
      channel.addedAt,
      channel.handle,
      channel.channelId,
      channel.displayName
    ].some((value) => normalizeYouTubeValue(value) === normalizedIdentifier);
  }

  return ["addedAt", "handle", "channelId", "displayName"].some((key) => {
    if (!identifier[key]) {
      return false;
    }

    if (key === "addedAt") {
      return channel[key] === identifier[key];
    }

    return normalizeYouTubeValue(channel[key]) === normalizeYouTubeValue(identifier[key]);
  });
}

export class StorageService {
  
  // ==========================================
  // INITIALIZATION & CORE
  // ==========================================

  static async init() {
    const data = await storage.get(Object.keys(DEFAULT_CONFIG));
    const needsInit = Object.keys(DEFAULT_CONFIG).some(key => data[key] === undefined);
    
    if (needsInit) {
      // Merge existing data with defaults to ensure no missing keys
      await storage.set({ ...DEFAULT_CONFIG, ...data });
    }
  }

  static async getConfig() {
    return await storage.get(Object.keys(DEFAULT_CONFIG));
  }

  // ==========================================
  // BLOCKED DOMAINS
  // ==========================================

  static async getBlockedDomains() {
    const data = await storage.get('blockedDomains');
    return (data.blockedDomains || [])
      .map((entry) => ({
        ...entry,
        domain: normalizeDomain(entry?.domain)
      }))
      .filter((entry) => entry.domain);
  }

  static async addBlockedDomain(domain) {
    const normalizedDomain = normalizeDomain(domain);
    if (!normalizedDomain) {
      return false;
    }

    const domains = await this.getBlockedDomains();
    // Prevent duplicates
    if (!domains.find(d => d.domain === normalizedDomain)) {
      domains.push({ domain: normalizedDomain, addedAt: new Date().toISOString() });
      await storage.set({ blockedDomains: domains });
      return true;
    }

    return false;
  }

  static async removeBlockedDomain(domain) {
    const normalizedDomain = normalizeDomain(domain);
    if (!normalizedDomain) {
      return;
    }

    const domains = await this.getBlockedDomains();
    const updatedDomains = domains.filter(d => d.domain !== normalizedDomain);
    await storage.set({ blockedDomains: updatedDomains });
  }

  // ==========================================
  // BLOCKED YOUTUBE CHANNELS
  // ==========================================

  static async getBlockedYouTubeChannels() {
    const data = await storage.get('blockedYouTubeChannels');
    return data.blockedYouTubeChannels || [];
  }

  static async addBlockedYouTubeChannel({ handle, channelId, displayName }) {
    const channels = await this.getBlockedYouTubeChannels();
    
    // Check for duplicates by handle OR channelId (if they exist)
    const exists = channels.find(c => 
      (handle && normalizeYouTubeValue(c.handle) === normalizeYouTubeValue(handle)) || 
      (channelId && c.channelId === channelId) ||
      (displayName && normalizeYouTubeValue(c.displayName) === normalizeYouTubeValue(displayName)) // Fallback
    );

    if (!exists) {
      channels.push({ handle, channelId, displayName, addedAt: new Date().toISOString() });
      await storage.set({ blockedYouTubeChannels: channels });
    }
  }

  static async removeBlockedYouTubeChannel(identifier) {
    const channels = await this.getBlockedYouTubeChannels();
    const updatedChannels = channels.filter((channel) => !matchesBlockedYouTubeChannel(channel, identifier));
    await storage.set({ blockedYouTubeChannels: updatedChannels });
  }

  static async updateBlockedYouTubeChannel(identifier, updates) {
    const channels = await this.getBlockedYouTubeChannels();
    const index = channels.findIndex((channel) => matchesBlockedYouTubeChannel(channel, identifier));

    if (index === -1) {
      return false;
    }

    const updatedChannel = {
      ...channels[index],
      ...updates
    };

    const hasDuplicate = channels.some((channel, channelIndex) => {
      if (channelIndex === index) {
        return false;
      }

      return (
        (updatedChannel.handle &&
          normalizeYouTubeValue(channel.handle) === normalizeYouTubeValue(updatedChannel.handle)) ||
        (updatedChannel.channelId && channel.channelId === updatedChannel.channelId) ||
        (updatedChannel.displayName &&
          normalizeYouTubeValue(channel.displayName) === normalizeYouTubeValue(updatedChannel.displayName))
      );
    });

    if (hasDuplicate) {
      return false;
    }

    channels[index] = updatedChannel;
    await storage.set({ blockedYouTubeChannels: channels });
    return true;
  }

  // ==========================================
  // DAILY BUDGETS (Time Limits)
  // ==========================================

  static async getDailyBudgets() {
    const data = await storage.get('dailyBudgets');
    return (data.dailyBudgets || [])
      .map((budget) => ({
        ...budget,
        domain: normalizeDomain(budget?.domain),
        limitSeconds: normalizeLimitSeconds(budget?.limitSeconds)
      }))
      .filter((budget) => budget.domain);
  }

  static async getDailyBudget(domain) {
    const normalizedDomain = normalizeDomain(domain);
    if (!normalizedDomain) {
      return null;
    }

    const budgets = await this.getDailyBudgets();
    return budgets.find(b => b.domain === normalizedDomain) || null;
  }

  static async setDailyBudget(domain, limitSeconds) {
    const normalizedDomain = normalizeDomain(domain);
    if (!normalizedDomain) {
      return false;
    }

    const budgets = await this.getDailyBudgets();
    const index = budgets.findIndex(b => b.domain === normalizedDomain);
    const normalizedLimitSeconds = normalizeLimitSeconds(limitSeconds);

    if (index !== -1) {
      // Update existing budget
      budgets[index].limitSeconds = normalizedLimitSeconds;
    } else {
      // Add new budget
      budgets.push({ domain: normalizedDomain, limitSeconds: normalizedLimitSeconds });
    }

    await storage.set({ dailyBudgets: budgets });
    return true;
  }

  static async removeDailyBudget(domain) {
    const normalizedDomain = normalizeDomain(domain);
    if (!normalizedDomain) {
      return;
    }

    const budgets = await this.getDailyBudgets();
    const updatedBudgets = budgets.filter(b => b.domain !== normalizedDomain);
    await storage.set({ dailyBudgets: updatedBudgets });
  }

  static async getManagedWebsites() {
    const [blockedDomains, dailyBudgets] = await Promise.all([
      this.getBlockedDomains(),
      this.getDailyBudgets()
    ]);
    const websites = new Map();

    for (const budget of dailyBudgets) {
      websites.set(budget.domain, {
        domain: budget.domain,
        limitSeconds: budget.limitSeconds
      });
    }

    for (const blockedDomain of blockedDomains) {
      websites.set(blockedDomain.domain, {
        domain: blockedDomain.domain,
        limitSeconds: 0
      });
    }

    return Array.from(websites.values()).sort((left, right) => {
      if (left.limitSeconds === 0 && right.limitSeconds !== 0) {
        return -1;
      }

      if (left.limitSeconds !== 0 && right.limitSeconds === 0) {
        return 1;
      }

      return left.domain.localeCompare(right.domain);
    });
  }

  static async upsertManagedWebsite(domain, limitSeconds) {
    const normalizedDomain = normalizeDomain(domain);
    if (!normalizedDomain) {
      return null;
    }

    const normalizedLimitSeconds = normalizeLimitSeconds(limitSeconds);

    if (normalizedLimitSeconds === 0) {
      await this.addBlockedDomain(normalizedDomain);
      await this.removeDailyBudget(normalizedDomain);

      return {
        domain: normalizedDomain,
        limitSeconds: 0
      };
    }

    await this.removeBlockedDomain(normalizedDomain);
    await this.setDailyBudget(normalizedDomain, normalizedLimitSeconds);

    return {
      domain: normalizedDomain,
      limitSeconds: normalizedLimitSeconds
    };
  }

  static async removeManagedWebsite(domain) {
    const normalizedDomain = normalizeDomain(domain);
    if (!normalizedDomain) {
      return;
    }

    await this.removeBlockedDomain(normalizedDomain);
    await this.removeDailyBudget(normalizedDomain);
  }

  // ==========================================
  // CONTENT FILTERS (Toggles)
  // ==========================================

  static async getContentFilters() {
    const data = await storage.get('contentFilters');
    return data.contentFilters || DEFAULT_CONFIG.contentFilters;
  }

  static async updateContentFilters(filtersToUpdate) {
    const currentFilters = await this.getContentFilters();
    const updatedFilters = { ...currentFilters, ...filtersToUpdate };
    await storage.set({ contentFilters: updatedFilters });
  }

  // ==========================================
  // EXPORT / IMPORT
  // ==========================================

  static async exportConfig() {
    const config = await this.getConfig();
    
    // Get extension version dynamically, fallback if not available
    const extVersion = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest 
      ? chrome.runtime.getManifest().version 
      : "1.0.0";

    const exportData = {
      meta: {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        extensionVersion: extVersion
      },
      config: config
    };

    return JSON.stringify(exportData, null, 2);
  }

  static async importConfig(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      
      if (!parsed.config) {
        throw new Error("Invalid file format: Missing 'config' object.");
      }

      // Safely merge imported data with defaults to prevent missing keys
      const mergedConfig = {
        blockedDomains: parsed.config.blockedDomains || DEFAULT_CONFIG.blockedDomains,
        blockedYouTubeChannels: parsed.config.blockedYouTubeChannels || DEFAULT_CONFIG.blockedYouTubeChannels,
        dailyBudgets: parsed.config.dailyBudgets || DEFAULT_CONFIG.dailyBudgets,
        contentFilters: { ...DEFAULT_CONFIG.contentFilters, ...(parsed.config.contentFilters || {}) }
      };

      await storage.set(mergedConfig);
      return { success: true };
      
    } catch (error) {
      console.error("Import failed:", error);
      return { success: false, error: error.message };
    }
  }
}
