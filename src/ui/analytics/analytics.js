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

function getUsageForDay(dateKey, storageData, todayKey, session) {
  let usage = storageData[dateKey] || {};
  if (dateKey === todayKey && session) {
    usage = buildUsageWithSession(usage, session, Date.now());
  }
  return usage;
}

function sumUsage(usage) {
  let sum = 0;
  for (const v of Object.values(usage)) sum += v;
  return sum;
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

  // 1. Daily Insights
  const todayTotalSecs = weekTotals.find(d => d.key === getDayKey(currentDate))?.totalSecs || 0;
  
  const yesterday = new Date(currentDate);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = getDayKey(yesterday);
  const yesterdayUsage = getUsageForDay(yesterdayKey, storageData, todayKey, session);
  const yesterdayTotalSecs = Math.floor(sumUsage(yesterdayUsage) / 1000);
  
  document.getElementById("insightTotalTime").textContent = formatTime(todayTotalSecs);
  
  if (selectedDayUsageEntries.length > 0) {
    const topSite = selectedDayUsageEntries[0];
    const topPercent = Math.round((topSite.value / (todayTotalSecs || 1)) * 100);
    document.getElementById("insightTopSite").textContent = topSite.name;
    document.getElementById("insightTopPercent").textContent = `${topPercent}% of total`;
  } else {
    document.getElementById("insightTopSite").textContent = "None";
    document.getElementById("insightTopPercent").textContent = "0% of total";
  }
  
  const insightTrendEl = document.getElementById("insightTrend");
  if (yesterdayTotalSecs === 0 && todayTotalSecs === 0) {
    insightTrendEl.innerHTML = `<span class="text-stone-400">--</span>`;
  } else {
    const diff = todayTotalSecs - yesterdayTotalSecs;
    const diffPercent = yesterdayTotalSecs > 0 ? Math.abs(Math.round((diff / yesterdayTotalSecs) * 100)) : 100;
    
    if (diff > 0) {
      insightTrendEl.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="3" stroke="currentColor" class="w-2.5 h-2.5 text-red-500"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" /></svg><span class="text-red-500">+${diffPercent}%</span>`;
    } else if (diff < 0) {
      insightTrendEl.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="3" stroke="currentColor" class="w-2.5 h-2.5 text-emerald-500"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 4.5l-15 15m0 0h11.25m-11.25 0V8.25" /></svg><span class="text-emerald-500">-${diffPercent}%</span>`;
    } else {
      insightTrendEl.innerHTML = `<span class="text-stone-400">0%</span>`;
    }
  }

  // 2. Weekly Comparison
  const thisWeekTotalSecs = weekTotals.reduce((sum, d) => sum + d.totalSecs, 0);
  
  let lastWeekTotalSecs = 0;
  const lastWeekStart = new Date(startOfWeek);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  for (let i = 0; i < 7; i++) {
    const d = new Date(lastWeekStart);
    d.setDate(d.getDate() + i);
    const u = getUsageForDay(getDayKey(d), storageData, todayKey, session);
    lastWeekTotalSecs += Math.floor(sumUsage(u) / 1000);
  }
  
  document.getElementById("compThisWeek").textContent = formatTime(thisWeekTotalSecs);
  document.getElementById("compLastWeek").textContent = formatTime(lastWeekTotalSecs);
  
  const compTrendBadge = document.getElementById("compTrendBadge");
  if (lastWeekTotalSecs === 0 && thisWeekTotalSecs === 0) {
    compTrendBadge.innerHTML = `--`;
    compTrendBadge.className = "flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-stone-400 bg-stone-100";
  } else {
    const diffW = thisWeekTotalSecs - lastWeekTotalSecs;
    const diffPercentW = lastWeekTotalSecs > 0 ? Math.abs(Math.round((diffW / lastWeekTotalSecs) * 100)) : 100;
    
    if (diffW > 0) {
      compTrendBadge.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="3" stroke="currentColor" class="w-3 h-3"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" /></svg>+${diffPercentW}%`;
      compTrendBadge.className = "flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-red-600 bg-red-100/80";
    } else if (diffW < 0) {
      compTrendBadge.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="3" stroke="currentColor" class="w-3 h-3"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 4.5l-15 15m0 0h11.25m-11.25 0V8.25" /></svg>-${diffPercentW}%`;
      compTrendBadge.className = "flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-emerald-600 bg-emerald-100/80";
    } else {
      compTrendBadge.innerHTML = `0%`;
      compTrendBadge.className = "flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-stone-500 bg-stone-200/60";
    }
  }

  // 3. Last 30 Days
  let thirtyDayTotalMs = 0;
  const thirtyDayAgg = {}; // domain -> ms
  
  for (let i = 0; i < 30; i++) {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - i);
    const u = getUsageForDay(getDayKey(d), storageData, todayKey, session);
    
    for (const [domain, ms] of Object.entries(u)) {
      if (ms > 0) {
        const cleanDomain = domain.replace(/^www\./, '');
        thirtyDayTotalMs += ms;
        thirtyDayAgg[cleanDomain] = (thirtyDayAgg[cleanDomain] || 0) + ms;
      }
    }
  }
  
  const thirtyDayAvgSecs = Math.floor((thirtyDayTotalMs / 1000) / 30);
  document.getElementById("thirtyDayAvg").textContent = formatTime(thirtyDayAvgSecs);
  
  const top30 = Object.entries(thirtyDayAgg)
    .map(([name, ms]) => ({ name, value: Math.floor(ms / 1000) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 3);
    
  const listEl = document.getElementById("thirtyDayTopList");
  listEl.innerHTML = "";
  
  if (top30.length === 0) {
    listEl.innerHTML = `<div class="text-[10px] font-bold text-stone-400 text-center py-2">No data recorded</div>`;
  } else {
    top30.forEach((site, index) => {
      const el = document.createElement("div");
      el.className = "flex items-center justify-between p-2.5 bg-stone-50 border border-stone-100 rounded-xl hover:bg-yellow-50 hover:border-yellow-200 transition";
      el.innerHTML = `
        <div class="flex items-center gap-2 overflow-hidden">
          <div class="flex items-center justify-center w-5 h-5 rounded-full bg-stone-200 text-stone-500 text-[9px] font-extrabold flex-shrink-0">
            ${index + 1}
          </div>
          <span class="text-xs font-bold text-stone-700 truncate">${site.name}</span>
        </div>
        <div class="text-[11px] font-extrabold text-stone-900 flex-shrink-0">${formatTime(site.value)}</div>
      `;
      listEl.appendChild(el);
    });
  }
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
