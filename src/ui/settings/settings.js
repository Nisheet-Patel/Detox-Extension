// settings.js
import "../mock-preview.js";
import { StorageService } from "../../storage/storageService.js";

// DOM Elements
const clearStatsBtn = document.getElementById("clearStats");
const clearChannelsBtn = document.getElementById("clearChannels");
const clearBudgetsBtn = document.getElementById("clearBudgets");
const resetAllBtn = document.getElementById("resetAll");
const historyRange = document.getElementById("historyRange");
const exportBtn = document.getElementById("exportBtn");
const importFile = document.getElementById("importFile");
const feedbackMsg = document.getElementById("feedbackMsg");

// Helper to display temporary feedback messages
function showFeedback(message, className) {
  feedbackMsg.textContent = message;
  feedbackMsg.className = `text-center text-[10px] font-bold mt-2 ${className}`;
  feedbackMsg.classList.remove("hidden");

  window.setTimeout(() => {
    feedbackMsg.classList.add("hidden");
  }, 3000);
}

// Helper to provide inline button feedback
function setButtonFeedback(button, originalText, successText, isDanger = false) {
  button.textContent = successText;
  if (isDanger) {
    button.classList.replace("border-red-200", "border-green-300");
    button.classList.replace("text-red-600", "text-green-700");
  } else {
    button.classList.replace("border-stone-200", "border-green-300");
    button.classList.replace("text-stone-600", "text-green-700");
  }

  window.setTimeout(() => {
    button.textContent = originalText;
    if (isDanger) {
      button.classList.replace("border-green-300", "border-red-200");
      button.classList.replace("text-green-700", "text-red-600");
    } else {
      button.classList.replace("border-green-300", "border-stone-200");
      button.classList.replace("text-green-700", "text-stone-600");
    }
  }, 1500);
}

// 1. Clear browsing statistics
clearStatsBtn.addEventListener("click", async () => {
  try {
    const allData = await browser.storage.local.get(null);
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    const keysToRemove = Object.keys(allData).filter(
      key => dateRegex.test(key) || key === "tracking_session"
    );

    if (keysToRemove.length > 0) {
      await browser.storage.local.remove(keysToRemove);
    }
    setButtonFeedback(clearStatsBtn, "Clear browsing statistics", "Cleared!");
  } catch (err) {
    console.error("Failed to clear browsing statistics:", err);
  }
});

// 2. Clear blocked channels
clearChannelsBtn.addEventListener("click", async () => {
  try {
    await browser.storage.local.set({ blockedYouTubeChannels: [] });
    setButtonFeedback(clearChannelsBtn, "Clear blocked channels", "Cleared!");
  } catch (err) {
    console.error("Failed to clear blocked channels:", err);
  }
});

// 3. Clear site budgets
clearBudgetsBtn.addEventListener("click", async () => {
  try {
    await browser.storage.local.set({ dailyBudgets: [] });
    setButtonFeedback(clearBudgetsBtn, "Clear site budgets", "Cleared!");
  } catch (err) {
    console.error("Failed to clear site budgets:", err);
  }
});

// 4. Reset all Detox data
resetAllBtn.addEventListener("click", async () => {
  const confirmed = confirm("Are you absolutely sure you want to delete all configurations, settings, history, and blocklists? This cannot be undone.");
  if (!confirmed) return;

  try {
    await browser.storage.local.clear();
    await StorageService.init();
    setButtonFeedback(resetAllBtn, "Reset all Detox data", "Reset Complete!", true);
  } catch (err) {
    console.error("Failed to reset Detox:", err);
  }
});

// Helper for date checks (30 days, 60 days)
function isWithinDays(dateStr, days) {
  if (days === "all") return true;
  const targetDate = new Date(dateStr);
  if (isNaN(targetDate.getTime())) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffTime = today - targetDate;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays <= Number(days);
}

// 5. Export Data
exportBtn.addEventListener("click", async () => {
  try {
    const range = historyRange.value;
    const allData = await browser.storage.local.get(null);

    const configKeys = ["blockedDomains", "blockedYouTubeChannels", "dailyBudgets", "contentFilters"];
    const exportData = {
      meta: {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        extensionVersion: "1.0.0"
      },
      config: {},
      history: {}
    };

    // Populate config
    configKeys.forEach(key => {
      if (allData[key] !== undefined) {
        exportData.config[key] = allData[key];
      }
    });

    // Populate history based on selection
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    Object.keys(allData).forEach(key => {
      if (dateRegex.test(key)) {
        if (isWithinDays(key, range)) {
          exportData.history[key] = allData[key];
        }
      }
    });

    // Download JSON file
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `detox-backup-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    showFeedback("Backup downloaded!", "text-yellow-600");
  } catch (err) {
    console.error("Failed to export data:", err);
    showFeedback("Export failed.", "text-red-600");
  }
});

// 6. Import Data
importFile.addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const parsed = JSON.parse(e.target.result);
      if (!parsed || typeof parsed !== "object") {
        throw new Error("Invalid structure");
      }

      // Import configurations
      if (parsed.config) {
        await browser.storage.local.set(parsed.config);
      }

      // Import screen time history
      if (parsed.history) {
        await browser.storage.local.set(parsed.history);
      }

      // Reset the file input value to allow importing the same file again if desired
      importFile.value = "";
      showFeedback("Import successful!", "text-green-600");
    } catch (err) {
      console.error("Failed to import backup:", err);
      showFeedback("Import failed: Invalid JSON format.", "text-red-600");
    }
  };

  reader.readAsText(file);
});
