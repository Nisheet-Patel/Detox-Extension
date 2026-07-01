import "../mock-preview.js";
import { TRACKING_SESSION_KEY, buildUsageWithSession } from "../../tracker/trackingStorage.js";
import { StorageService } from "../../storage/storageService.js";
import { getTodayKey } from "../../utils/date.js";
import { getDomain, normalizeDomain } from "../../utils/url.js";

// === FORMAT TIME ===
function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  const parts = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (s > 0 || parts.length === 0) parts.push(`${s}s`);

  return parts.join(" ");
}

let latestSnapshot = null;
let liveRefreshTimer = null;

function normalizeUsageEntries(usage = {}) {
  const merged = {};
  for (const [name, val] of Object.entries(usage)) {
    const cleanName = name.replace(/^www\./, '');
    merged[cleanName] = (merged[cleanName] || 0) + val;
  }
  return Object.entries(merged)
    .map(([name, value]) => ({
      name,
      value: Math.floor(value / 1000)
    }))
    .filter((item) => item.value > 0);
}

// === PROCESS DATA ===
function processData(data) {
  const sorted = [...data].sort((a, b) => b.value - a.value);

  const top7 = sorted.slice(0, 7);
  const rest = sorted.slice(7);

  if (rest.length > 0) {
    const othersValue = rest.reduce((sum, i) => sum + i.value, 0);
    top7.push({ name: "Others", value: othersValue, isOthers: true });
  }

  return top7;
}

// === COMPONENT ===
function createStackedBar({ element, data = [] }) {
  const oldLegend = element.querySelector(".legend");
  const scrollTop = oldLegend ? oldLegend.scrollTop : 0;

  element.innerHTML = "";

  const totalEl = document.getElementById("totalTime");

  if (!data.length) {
    if (totalEl) {
      totalEl.textContent = "0s";
    }

    return;
  }

  const processed = processData(data);
  const total = processed.reduce((sum, i) => sum + i.value, 0);

  if (totalEl) {
    totalEl.textContent = formatTime(total);
  }

  const colors = [
    "#facc15", // soft gold / yellow
    "#f97316", // warm orange
    "#3b82f6", // bright blue
    "#10b981", // emerald green
    "#8b5cf6", // violet purple
    "#ec4899", // pink
    "#14b8a6"  // teal
  ];

  // BAR
  const bar = document.createElement("div");
  bar.className = "bar";

  processed.forEach((item, index) => {
    const seg = document.createElement("div");
    seg.className = "segment";

    seg.style.width = ((item.value / total) * 100) + "%";
    seg.style.backgroundColor = item.isOthers
      ? "#9ca3af"
      : colors[index];

    bar.appendChild(seg);
  });

  // LEGEND
  const legend = document.createElement("div");
  legend.className = "legend";

  processed.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "row";
    
    if (!item.isOthers || item.name !== "Others") {
      row.style.cursor = "pointer";
      row.addEventListener("click", () => {
        const pathPrefix = window.location.pathname.includes('popup.html') ? '../analytics/' : '';
        window.location.href = `${pathPrefix}website.html?domain=${encodeURIComponent(item.name)}`;
      });
    }

    const left = document.createElement("div");
    left.className = "left";

    const dot = document.createElement("span");
    dot.className = "dot";
    dot.style.backgroundColor = item.isOthers
      ? "#9ca3af"
      : colors[index];

    const name = document.createElement("span");
    name.textContent = item.name;

    left.appendChild(dot);
    left.appendChild(name);

    const value = document.createElement("span");
    value.textContent = formatTime(item.value);

    row.appendChild(left);
    row.appendChild(value);

    legend.appendChild(row);
  });

  element.appendChild(bar);
  element.appendChild(legend);

  if (scrollTop > 0) {
    legend.scrollTop = scrollTop;
  }
}

async function loadTrackingSnapshot() {
  try {
    return await browser.runtime.sendMessage({ type: "TRACKING_GET_SNAPSHOT" });
  } catch (error) {
    console.error("Failed to load tracking snapshot:", error);
    return null;
  }
}

function renderCurrentUsage() {
  createStackedBar({
    element: document.getElementById("chart"),
    data: normalizeUsageEntries(
      buildUsageWithSession(
        latestSnapshot?.persistedUsage || {},
        latestSnapshot?.session || null,
        Date.now()
      )
    )
  });
}

async function refreshTrackingView() {
  const snapshot = await loadTrackingSnapshot();
  if (!snapshot) {
    return;
  }

  latestSnapshot = snapshot;
  renderCurrentUsage();
}

function startLiveRefresh() {
  if (liveRefreshTimer !== null) {
    clearInterval(liveRefreshTimer);
  }

  liveRefreshTimer = window.setInterval(() => {
    if (!latestSnapshot) {
      return;
    }

    if (latestSnapshot.dayKey !== getTodayKey()) {
      refreshTrackingView();
      return;
    }

    renderCurrentUsage();
  }, 1000);
}

function handleStorageChange(changes) {
  if (changes[TRACKING_SESSION_KEY] || changes[getTodayKey()]) {
    refreshTrackingView();
  }
}

// === INIT ===
async function init() {
  await refreshTrackingView();
  startLiveRefresh();
  browser.storage.onChanged.addListener(handleStorageChange);
}

document.addEventListener("DOMContentLoaded", init);
window.addEventListener("beforeunload", () => {
  if (liveRefreshTimer !== null) {
    clearInterval(liveRefreshTimer);
  }

  browser.storage.onChanged.removeListener(handleStorageChange);
});

const container = document.getElementById("scrollContainer");
const leftBtn = document.getElementById("leftBtn");
const rightBtn = document.getElementById("rightBtn");

const scrollAmount = 120;

function updateButtons() {
  const maxScrollLeft = container.scrollWidth - container.clientWidth;

  // Show left if not at start
  if (container.scrollLeft > 0) {
    leftBtn.classList.remove("hidden");
  } else {
    leftBtn.classList.add("hidden");
  }

  // Show right if not at end
  if (container.scrollLeft < maxScrollLeft - 1) {
    rightBtn.classList.remove("hidden");
  } else {
    rightBtn.classList.add("hidden");
  }
}

leftBtn.addEventListener("click", () => {
  container.scrollBy({ left: -scrollAmount, behavior: "smooth" });
});

rightBtn.addEventListener("click", () => {
  container.scrollBy({ left: scrollAmount, behavior: "smooth" });
});

container.addEventListener("scroll", updateButtons);
window.addEventListener("load", updateButtons);

const openSettingsBtn = document.getElementById("openSettings");
if (openSettingsBtn) {
  openSettingsBtn.addEventListener("click", () => {
    window.location.href = "../settings/settings.html";
  });
}

const openAnalyticsBtn = document.getElementById("openAnalytics");
if (openAnalyticsBtn) {
  openAnalyticsBtn.addEventListener("click", () => {
    window.location.href = "../analytics/analytics.html";
  });
}


// BLOCK INPUT COMPONENT

const input = document.getElementById("blockInput");
const blockBtn = document.getElementById("blockBtn");
const blockCurrent = document.getElementById("blockCurrent");
const clearBtn = document.getElementById("clearInput");

// Block button click
blockBtn.addEventListener("click", () => {
  void (async () => {
    const value = normalizeDomain(input.value);
    if (!value) {
      return;
    }

    await StorageService.upsertManagedWebsite(value, 0);
    input.value = "";
    blockBtn.textContent = "Blocked";

    window.setTimeout(() => {
      blockBtn.textContent = "Block";
    }, 1200);
  })();
});

// Clear input
clearBtn.addEventListener("click", () => {
  input.value = "";
  input.focus();
});

blockCurrent.addEventListener("click", async () => {
  try {
    const [tab] = await browser.tabs.query({
      active: true,
      currentWindow: true
    });

    const domain = getDomain(tab?.url);
    if (!domain) {
      return;
    }

    input.value = domain;

  } catch (err) {
    console.error("Failed to get active tab:", err);
  }
});
