import "../mock-preview.js";
import { getTodayKey } from "../../utils/date.js";
import { buildUsageWithSession } from "../../tracker/trackingStorage.js";

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
  const rest = sorted.slice(7).map(item => ({ ...item, isOthers: true }));

  return [...top7, ...rest];
}

// === COMPONENT (Reused from popup.js) ===
function createStackedBar({ element, data = [] }) {
  const oldLegend = element.querySelector(".legend");
  const scrollTop = oldLegend ? oldLegend.scrollTop : 0;

  element.innerHTML = "";

  const totalEl = document.getElementById("totalTime");

  if (!data.length) {
    if (totalEl) totalEl.textContent = "0s";
    return;
  }

  const processed = processData(data);
  const total = processed.reduce((sum, i) => sum + i.value, 0);

  if (totalEl) totalEl.textContent = formatTime(total);

  const colors = [
    "#facc15", "#f97316", "#3b82f6", "#10b981", "#8b5cf6", "#ec4899", "#14b8a6"
  ];

  const bar = document.createElement("div");
  bar.className = "bar";

  processed.forEach((item, index) => {
    const seg = document.createElement("div");
    seg.className = "segment";
    seg.style.width = ((item.value / total) * 100) + "%";
    seg.style.backgroundColor = item.isOthers ? "#9ca3af" : colors[index];
    bar.appendChild(seg);
  });

  const legend = document.createElement("div");
  legend.className = "legend";

  processed.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "row";
    
    const left = document.createElement("div");
    left.className = "left";
    
    const dot = document.createElement("span");
    dot.className = "dot";
    dot.style.backgroundColor = item.isOthers ? "#9ca3af" : colors[index];
    
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

  if (scrollTop > 0) legend.scrollTop = scrollTop;
}

// === ANALYTICS LOGIC ===

let currentDate = new Date();
currentDate.setHours(0, 0, 0, 0);

function pad(v) { return String(v).padStart(2, '0'); }

function formatDateString(date) {
  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${String(date.getFullYear()).slice(2)}`;
}

function getDayKey(date) {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join("-");
}

function getStartOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 (Sun) to 6 (Sat)
  d.setDate(d.getDate() - day);
  return d;
}

function updateDateDisplay() {
  document.getElementById("currentDateDisplay").textContent = formatDateString(currentDate);
}

async function loadAndRender() {
  updateDateDisplay();
  
  // Get all days for the week
  const startOfWeek = getStartOfWeek(currentDate);
  const weekDates = [];
  const weekKeys = [];
  
  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek);
    d.setDate(d.getDate() + i);
    weekDates.push(d);
    weekKeys.push(getDayKey(d));
  }
  
  // Also need today's key for live tracking
  const todayKey = getTodayKey();
  
  // Load data
  const storageData = await browser.storage.local.get(null);
  
  // Min / Max logic
  const allKeys = Object.keys(storageData);
  const dateKeys = allKeys.filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k)).sort();
  
  const minDateStr = dateKeys.length > 0 ? dateKeys[0] : todayKey;
  const maxDateStr = todayKey;
  
  const minDate = new Date(minDateStr);
  minDate.setHours(0,0,0,0);
  const maxDate = new Date(maxDateStr);
  maxDate.setHours(0,0,0,0);
  
  // Disable logic
  const prevDayBtn = document.getElementById("prevDay");
  const prevWeekBtn = document.getElementById("prevWeek");
  const nextDayBtn = document.getElementById("nextDay");
  const nextWeekBtn = document.getElementById("nextWeek");
  
  const tempPrevDay = new Date(currentDate);
  tempPrevDay.setDate(tempPrevDay.getDate() - 1);
  const canGoPrevDay = tempPrevDay >= minDate;
  prevDayBtn.disabled = !canGoPrevDay;
  prevDayBtn.style.opacity = canGoPrevDay ? "1" : "0.5";
  prevDayBtn.style.pointerEvents = canGoPrevDay ? "auto" : "none";
  
  const tempPrevWeek = new Date(currentDate);
  tempPrevWeek.setDate(tempPrevWeek.getDate() - 7);
  const minWeekStart = getStartOfWeek(minDate);
  const tempPrevWeekStart = getStartOfWeek(tempPrevWeek);
  const canGoPrevWeek = tempPrevWeekStart >= minWeekStart;
  prevWeekBtn.disabled = !canGoPrevWeek;
  prevWeekBtn.style.opacity = canGoPrevWeek ? "1" : "0.5";
  prevWeekBtn.style.pointerEvents = canGoPrevWeek ? "auto" : "none";

  const tempNextDay = new Date(currentDate);
  tempNextDay.setDate(tempNextDay.getDate() + 1);
  const canGoNextDay = tempNextDay <= maxDate;
  nextDayBtn.disabled = !canGoNextDay;
  nextDayBtn.style.opacity = canGoNextDay ? "1" : "0.5";
  nextDayBtn.style.pointerEvents = canGoNextDay ? "auto" : "none";
  
  const tempNextWeek = new Date(currentDate);
  tempNextWeek.setDate(tempNextWeek.getDate() + 7);
  const maxWeekStart = getStartOfWeek(maxDate);
  const tempNextWeekStart = getStartOfWeek(tempNextWeek);
  const canGoNextWeek = tempNextWeekStart <= maxWeekStart;
  nextWeekBtn.disabled = !canGoNextWeek;
  nextWeekBtn.style.opacity = canGoNextWeek ? "1" : "0.5";
  nextWeekBtn.style.pointerEvents = canGoNextWeek ? "auto" : "none";

  // Need to merge live session if any of the days is today
  let session = null;
  try {
    const trackingState = await browser.runtime.sendMessage({ type: "TRACKING_GET_SNAPSHOT" });
    if (trackingState) {
      session = trackingState.session;
    }
  } catch(e) {
    console.error("Could not get snapshot", e);
  }
  
  // Calculate totals for each day in week
  const weekTotals = [];
  let maxTime = 0;
  let selectedDayUsageEntries = [];
  
  for (let i = 0; i < 7; i++) {
    const key = weekKeys[i];
    let usage = storageData[key] || {};
    
    if (key === todayKey && session) {
      usage = buildUsageWithSession(usage, session, Date.now());
    }
    
    // Sum the total for the day
    let totalMs = 0;
    for (const val of Object.values(usage)) {
      totalMs += val;
    }
    const totalSecs = Math.floor(totalMs / 1000);
    weekTotals.push({ date: weekDates[i], key, totalSecs });
    
    if (totalSecs > maxTime) maxTime = totalSecs;
    
    // If this is the currently selected date, save usage
    if (key === getDayKey(currentDate)) {
      selectedDayUsageEntries = normalizeUsageEntries(usage);
    }
  }
  
  let yMaxHours = Math.ceil(maxTime / 3600);
  if (yMaxHours < 2) yMaxHours = 2; // at least 2h min scale
  const chartMaxTime = yMaxHours * 3600;
  const yMidHours = (yMaxHours / 2).toFixed(1).replace('.0', '');
  
  const yAxisMaxEl = document.getElementById("yAxisMax");
  if (yAxisMaxEl) yAxisMaxEl.textContent = yMaxHours + "h";
  const yAxisMidEl = document.getElementById("yAxisMid");
  if (yAxisMidEl) yAxisMidEl.textContent = yMidHours + "h";
  
  renderWeeklyChart(weekTotals, chartMaxTime);
  createStackedBar({
    element: document.getElementById("chart"),
    data: selectedDayUsageEntries
  });
}

function renderWeeklyChart(weekTotals, maxTime) {
  const container = document.getElementById("weeklyChartContainer");
  container.innerHTML = "";
  
  const currentKey = getDayKey(currentDate);
  
  weekTotals.forEach((day, index) => {
    const col = document.createElement("div");
    col.className = "weekly-bar-col";
    
    const bar = document.createElement("div");
    bar.className = "weekly-bar" + (day.key === currentKey ? " active" : "");
    const heightPercent = Math.max((day.totalSecs / maxTime) * 100, 4); // min height
    bar.style.height = day.totalSecs > 0 ? `${heightPercent}%` : "4px";
    
    bar.addEventListener("click", () => {
      currentDate = new Date(day.date);
      loadAndRender();
    });
    
    col.appendChild(bar);
    container.appendChild(col);
  });
}

// Navigation Events
document.getElementById("prevDay").addEventListener("click", () => {
  currentDate.setDate(currentDate.getDate() - 1);
  loadAndRender();
});
document.getElementById("nextDay").addEventListener("click", () => {
  currentDate.setDate(currentDate.getDate() + 1);
  loadAndRender();
});
document.getElementById("prevWeek").addEventListener("click", () => {
  currentDate.setDate(currentDate.getDate() - 7);
  loadAndRender();
});
document.getElementById("nextWeek").addEventListener("click", () => {
  currentDate.setDate(currentDate.getDate() + 7);
  loadAndRender();
});
document.getElementById("currentDateDisplay").addEventListener("click", () => {
  currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);
  loadAndRender();
});

// Live Refresh (only if looking at today)
let liveRefreshTimer = null;

function startLiveRefresh() {
  if (liveRefreshTimer !== null) clearInterval(liveRefreshTimer);
  liveRefreshTimer = setInterval(() => {
    if (getDayKey(currentDate) === getTodayKey()) {
      loadAndRender(); // Re-render to update the chart dynamically
    }
  }, 1000);
}

document.addEventListener("DOMContentLoaded", () => {
  loadAndRender();
  startLiveRefresh();
  
  browser.storage.onChanged.addListener((changes) => {
    // If current selected day changed or today changed
    if (changes[getDayKey(currentDate)] || changes[getTodayKey()]) {
      loadAndRender();
    }
  });
});

window.addEventListener("beforeunload", () => {
  if (liveRefreshTimer !== null) clearInterval(liveRefreshTimer);
});
