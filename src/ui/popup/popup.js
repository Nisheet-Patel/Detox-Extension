import { TRACKING_SESSION_KEY, buildUsageWithSession } from "../../tracker/trackingStorage.js";
import { getTodayKey } from "../../utils/date.js";

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
  return Object.entries(usage)
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
    "#f87171",
    "#fb923c",
    "#facc15",
    "#4ade80",
    "#60a5fa",
    "#818cf8",
    "#c084fc"
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


// BLOCK INPUT COMPONENT

const input = document.getElementById("blockInput");
const blockBtn = document.getElementById("blockBtn");
const blockCurrent = document.getElementById("blockCurrent");
const clearBtn = document.getElementById("clearInput");

// Block button click
blockBtn.addEventListener("click", () => {
  const value = input.value.trim();
  if (!value) return;

  console.log("Blocked:", value);

  // TODO: save to chrome.storage if needed
  input.value = "";
});

// Clear input
clearBtn.addEventListener("click", () => {
  input.value = "";
  input.focus();
});

blockCurrent.addEventListener("click", async () => {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true
    });

    if (!tab || !tab.url) return;

    const url = new URL(tab.url);
    input.value = url.hostname;

  } catch (err) {
    console.error("Failed to get active tab:", err);
  }
});
