// mock-preview.js
// Mock WebExtension APIs for local previewing/development outside of Extension environment

if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.id) {
  const mockStorage = {
    blockedDomains: [
      { domain: "facebook.com", addedAt: "2026-06-11T00:00:00Z" },
      { domain: "twitter.com", addedAt: "2026-06-11T00:00:00Z" },
      { domain: "reddit.com", addedAt: "2026-06-11T00:00:00Z" }
    ],
    blockedYouTubeChannels: [
      { handle: "@mrbeast", displayName: "MrBeast", addedAt: "2026-06-11T00:00:00Z" },
      { handle: "@tseries", displayName: "T-Series", addedAt: "2026-06-11T00:00:00Z" }
    ],
    dailyBudgets: [
      { domain: "youtube.com", limitSeconds: 1800 },
      { domain: "reddit.com", limitSeconds: 600 }
    ],
    contentFilters: {
      hideYouTubeShorts: true,
      hideYouTubeRecommendations: false,
      hideInstagramReels: true,
      hideInstagramExplore: false,
      hideInstagramStories: true,
      hideInstagramFeed: false
    }
  };

  const getTodayKey = () => new Date().toISOString().split('T')[0];

  window.browser = {
    runtime: {
      sendMessage: async (msg) => {
        console.log("[Mock Runtime] Message sent:", msg);
        if (msg.type === "TRACKING_GET_SNAPSHOT") {
          return {
            dayKey: getTodayKey(),
            persistedUsage: {
              "youtube.com": 2400000, // 40m in ms
              "instagram.com": 900000, // 15m in ms
              "facebook.com": 300000,  // 5m in ms
              "reddit.com": 120000,    // 2m in ms
              "others": 60000
            },
            session: {
              domain: "youtube.com",
              startTime: Date.now() - 300000 // 5m active session
            }
          };
        }
        return { success: true };
      }
    },
    storage: {
      local: {
        get: async (keys) => {
          console.log("[Mock Storage] Get:", keys);
          if (!keys) {
            return mockStorage;
          }
          if (typeof keys === "string") {
            const today = getTodayKey();
            if (keys === today) {
              return {
                [today]: {
                  "youtube.com": 2400000,
                  "instagram.com": 900000,
                  "facebook.com": 300000
                }
              };
            }
            return { [keys]: mockStorage[keys] };
          }
          if (Array.isArray(keys)) {
            const res = {};
            keys.forEach(k => { res[k] = mockStorage[k]; });
            return res;
          }
          if (typeof keys === "object") {
            const res = {};
            Object.keys(keys).forEach(k => {
              res[k] = mockStorage[k] !== undefined ? mockStorage[k] : keys[k];
            });
            return res;
          }
          return mockStorage;
        },
        set: async (obj) => {
          console.log("[Mock Storage] Set:", obj);
          Object.assign(mockStorage, obj);
          return {};
        },
        remove: async (keys) => {
          console.log("[Mock Storage] Remove:", keys);
          if (typeof keys === "string") {
            delete mockStorage[keys];
          } else if (Array.isArray(keys)) {
            keys.forEach(k => { delete mockStorage[k]; });
          }
          return {};
        },
        clear: async () => {
          console.log("[Mock Storage] Clear all");
          Object.keys(mockStorage).forEach(k => { delete mockStorage[k]; });
          return {};
        }
      },
      onChanged: {
        addListener: () => {},
        removeListener: () => {}
      }
    },
    tabs: {
      query: async () => [{ url: "https://youtube.com/watch?v=123" }],
      reload: async (id) => { console.log("[Mock Tabs] Reload tab:", id); }
    }
  };
}
