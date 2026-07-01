import "../mock-preview.js";
import { getTodayKey } from "../../utils/date.js";
import { buildUsageWithSession } from "../../tracker/trackingStorage.js";

// Utility formatting
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

let currentDate = new Date();
currentDate.setHours(0, 0, 0, 0);

const params = new URLSearchParams(window.location.search);
const targetDomain = params.get("domain");

if (!targetDomain) {
  window.location.href = "analytics.html";
}

document.getElementById("headerTitle").textContent = targetDomain;
document.getElementById("siteDomain").textContent = targetDomain;
document.getElementById("siteFavicon").src = `https://www.google.com/s2/favicons?domain=${targetDomain}&sz=32`;
document.getElementById("siteFavicon").addEventListener("error", function() {
  this.style.display = 'none';
});

// Navigation helpers
document.getElementById("backBtn").addEventListener("click", () => {
  history.back();
});

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
  const day = d.getDay(); 
  d.setDate(d.getDate() - day);
  return d;
}

function updateDateDisplay() {
  document.getElementById("currentDateDisplay").textContent = formatDateString(currentDate);
}

function getUsageForDay(dateKey, storageData, todayKey, session) {
  let usage = storageData[dateKey] || {};
  if (dateKey === todayKey && session) {
    usage = buildUsageWithSession(usage, session, Date.now());
  }
  // Strip www. 
  const merged = {};
  for (const [domain, ms] of Object.entries(usage)) {
    const cleanDomain = domain.replace(/^www\./, '');
    merged[cleanDomain] = (merged[cleanDomain] || 0) + ms;
  }
  return merged;
}

function getTargetUsage(usage) {
  return usage[targetDomain] || 0;
}

function sumUsage(usage) {
  return Object.values(usage).reduce((a, b) => a + b, 0);
}

async function loadAndRender() {
  updateDateDisplay();
  
  const startOfWeek = getStartOfWeek(currentDate);
  const weekDates = [];
  const weekKeys = [];
  
  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek);
    d.setDate(d.getDate() + i);
    weekDates.push(d);
    weekKeys.push(getDayKey(d));
  }
  
  const todayKey = getTodayKey();
  const storageData = await browser.storage.local.get(null);
  
  // Date limits
  const allKeys = Object.keys(storageData);
  const dateKeys = allKeys.filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k)).sort();
  
  const minDateStr = dateKeys.length > 0 ? dateKeys[0] : todayKey;
  const maxDateStr = todayKey;
  
  const minDate = new Date(minDateStr);
  minDate.setHours(0,0,0,0);
  const maxDate = new Date(maxDateStr);
  maxDate.setHours(0,0,0,0);
  
  // Prev/Next Button logic
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
  
  let session = null;
  try {
    const trackingState = await browser.runtime.sendMessage({ type: "TRACKING_GET_SNAPSHOT" });
    if (trackingState) session = trackingState.session;
  } catch(e) { }
  
  // Weekly Chart Data
  const weekTotals = [];
  let maxTime = 0;
  
  let todayTotalAllSites = 0;
  let todayTotalTarget = 0;
  
  // Week calculations for ranking
  const weekGlobalUsage = {};
  
  for (let i = 0; i < 7; i++) {
    const key = weekKeys[i];
    const usage = getUsageForDay(key, storageData, todayKey, session);
    const targetMs = getTargetUsage(usage);
    const targetSecs = Math.floor(targetMs / 1000);
    
    // Accumulate global week usage
    for (const [dom, ms] of Object.entries(usage)) {
      weekGlobalUsage[dom] = (weekGlobalUsage[dom] || 0) + ms;
    }
    
    weekTotals.push({ date: weekDates[i], key, totalSecs: targetSecs });
    if (targetSecs > maxTime) maxTime = targetSecs;
    
    if (key === getDayKey(currentDate)) {
      todayTotalAllSites = sumUsage(usage);
      todayTotalTarget = targetMs;
    }
  }
  
  document.getElementById("siteTotalTime").textContent = formatTime(Math.floor(todayTotalTarget / 1000));
  
  let yMaxHours = Math.ceil(maxTime / 3600);
  if (yMaxHours < 1) yMaxHours = 1; 
  if (maxTime === 0) yMaxHours = 1;
  const chartMaxTime = yMaxHours * 3600;
  const yMidHours = (yMaxHours / 2).toFixed(1).replace('.0', '');
  
  document.getElementById("yAxisMax").textContent = yMaxHours + "h";
  document.getElementById("yAxisMid").textContent = yMidHours + "h";
  
  renderWeeklyChart(weekTotals, chartMaxTime);
  
  // Daily Summary
  const dailyPercent = todayTotalAllSites > 0 ? Math.round((todayTotalTarget / todayTotalAllSites) * 100) : 0;
  document.getElementById("dailyPercent").textContent = `${dailyPercent}%`;
  document.getElementById("dailyTotalTime").textContent = `${formatTime(Math.floor(todayTotalTarget / 1000))} today`;
  
  const yesterday = new Date(currentDate);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayUsage = getUsageForDay(getDayKey(yesterday), storageData, todayKey, session);
  const yesterdayTargetSecs = Math.floor(getTargetUsage(yesterdayUsage) / 1000);
  const todayTargetSecs = Math.floor(todayTotalTarget / 1000);
  
  const dailyTrendEl = document.getElementById("dailyTrend");
  if (yesterdayTargetSecs === 0 && todayTargetSecs === 0) {
    dailyTrendEl.innerHTML = `<span class="text-stone-400">--</span>`;
  } else {
    const diff = todayTargetSecs - yesterdayTargetSecs;
    
    if (diff > 0) {
      dailyTrendEl.innerHTML = `<span class="text-red-500">↑ ${formatTime(Math.abs(diff))}</span>`;
    } else if (diff < 0) {
      dailyTrendEl.innerHTML = `<span class="text-emerald-500">↓ ${formatTime(Math.abs(diff))}</span>`;
    } else {
      dailyTrendEl.innerHTML = `<span class="text-stone-400">--</span>`;
    }
  }
  
  // Weekly Comparison
  const thisWeekTotalSecs = weekTotals.reduce((sum, d) => sum + d.totalSecs, 0);
  let lastWeekTotalSecs = 0;
  const lastWeekStart = new Date(startOfWeek);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  for (let i = 0; i < 7; i++) {
    const d = new Date(lastWeekStart);
    d.setDate(d.getDate() + i);
    const u = getUsageForDay(getDayKey(d), storageData, todayKey, session);
    lastWeekTotalSecs += Math.floor(getTargetUsage(u) / 1000);
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
  
  // Monthly Average
  let thirtyDayTargetMs = 0;
  for (let i = 0; i < 30; i++) {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - i);
    const u = getUsageForDay(getDayKey(d), storageData, todayKey, session);
    thirtyDayTargetMs += getTargetUsage(u);
  }
  document.getElementById("thirtyDayAvg").textContent = `${formatTime(Math.floor((thirtyDayTargetMs / 1000) / 30))} / day`;
  
  // Rankings
  let todayRank = -1;
  const todayUsage = getUsageForDay(getDayKey(currentDate), storageData, todayKey, session);
  if (todayTotalTarget > 0) {
    const sortedToday = Object.entries(todayUsage).sort((a,b) => b[1] - a[1]);
    todayRank = sortedToday.findIndex(x => x[0] === targetDomain) + 1;
  }
  
  let weekRank = -1;
  const weekTargetUsage = weekGlobalUsage[targetDomain] || 0;
  if (weekTargetUsage > 0) {
    const sortedWeek = Object.entries(weekGlobalUsage).sort((a,b) => b[1] - a[1]);
    weekRank = sortedWeek.findIndex(x => x[0] === targetDomain) + 1;
  }
  
  const rankContainer = document.getElementById("rankingContainer");
  const rankTodayEl = document.getElementById("rankToday");
  const rankWeekEl = document.getElementById("rankWeek");
  
  const getRankingText = (rank, timeFrame) => {
    if (rank === 1) return `🏆 #1 Most Used ${timeFrame}`;
    if (rank === 2) return `🥈 #2 Most Used ${timeFrame}`;
    return `🔥 Top ${rank} ${timeFrame}`;
  };

  const isTop5Today = todayRank > 0 && todayRank <= 5;
  const isTop5Week = weekRank > 0 && weekRank <= 5;

  if (isTop5Today || isTop5Week) {
    rankContainer.classList.remove("hidden");
    rankContainer.classList.add("flex");
    
    if (isTop5Today) {
      rankTodayEl.textContent = getRankingText(todayRank, "Today");
      rankTodayEl.classList.remove("hidden");
    } else {
      rankTodayEl.classList.add("hidden");
    }
    
    if (isTop5Week) {
      rankWeekEl.textContent = getRankingText(weekRank, "This Week");
      rankWeekEl.classList.remove("hidden");
    } else {
      rankWeekEl.classList.add("hidden");
    }
  } else {
    rankContainer.classList.add("hidden");
    rankContainer.classList.remove("flex");
  }
}

function renderWeeklyChart(weekTotals, maxTime) {
  const container = document.getElementById("weeklyChartContainer");
  container.innerHTML = "";
  const currentKey = getDayKey(currentDate);
  
  weekTotals.forEach((day) => {
    const col = document.createElement("div");
    col.className = "weekly-bar-col";
    const bar = document.createElement("div");
    bar.className = "weekly-bar" + (day.key === currentKey ? " active" : "");
    const heightPercent = Math.max((day.totalSecs / maxTime) * 100, 4);
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
document.getElementById("prevDay").addEventListener("click", () => { currentDate.setDate(currentDate.getDate() - 1); loadAndRender(); });
document.getElementById("nextDay").addEventListener("click", () => { currentDate.setDate(currentDate.getDate() + 1); loadAndRender(); });
document.getElementById("prevWeek").addEventListener("click", () => { currentDate.setDate(currentDate.getDate() - 7); loadAndRender(); });
document.getElementById("nextWeek").addEventListener("click", () => { currentDate.setDate(currentDate.getDate() + 7); loadAndRender(); });
document.getElementById("currentDateDisplay").addEventListener("click", () => { currentDate = new Date(); currentDate.setHours(0,0,0,0); loadAndRender(); });

// Live Refresh
let liveRefreshTimer = null;
function startLiveRefresh() {
  if (liveRefreshTimer !== null) clearInterval(liveRefreshTimer);
  liveRefreshTimer = setInterval(() => {
    if (getDayKey(currentDate) === getTodayKey()) loadAndRender();
  }, 1000);
}

document.addEventListener("DOMContentLoaded", () => {
  loadAndRender();
  startLiveRefresh();
  browser.storage.onChanged.addListener((changes) => {
    if (changes[getDayKey(currentDate)] || changes[getTodayKey()]) loadAndRender();
  });
});

window.addEventListener("beforeunload", () => {
  if (liveRefreshTimer !== null) clearInterval(liveRefreshTimer);
});
