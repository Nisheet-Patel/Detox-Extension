// storage/storageService.js

import { getTodayKey } from "../utils/date.js";

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
    return data.blockedDomains || [];
  }

  static async addBlockedDomain(domain) {
    const domains = await this.getBlockedDomains();
    // Prevent duplicates
    if (!domains.find(d => d.domain === domain)) {
      domains.push({ domain, addedAt: new Date().toISOString() });
      await storage.set({ blockedDomains: domains });
    }
  }

  static async removeBlockedDomain(domain) {
    const domains = await this.getBlockedDomains();
    const updatedDomains = domains.filter(d => d.domain !== domain);
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
    return data.dailyBudgets || [];
  }

  static async getDailyBudget(domain) {
    const budgets = await this.getDailyBudgets();
    return budgets.find(b => b.domain === domain) || null;
  }

  static async setDailyBudget(domain, limitSeconds) {
    const budgets = await this.getDailyBudgets();
    const index = budgets.findIndex(b => b.domain === domain);

    if (index !== -1) {
      // Update existing budget
      budgets[index].limitSeconds = limitSeconds;
    } else {
      // Add new budget
      budgets.push({ domain, limitSeconds });
    }

    await storage.set({ dailyBudgets: budgets });
  }

  static async removeDailyBudget(domain) {
    const budgets = await this.getDailyBudgets();
    const updatedBudgets = budgets.filter(b => b.domain !== domain);
    await storage.set({ dailyBudgets: updatedBudgets });
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
