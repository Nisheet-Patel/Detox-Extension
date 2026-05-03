import { getTodayKey, splitDurationByDay } from "../utils/date.js";

export const TRACKING_SESSION_KEY = "detox_tracking_session_v1";

const usageStorage = browser.storage.local;
const sessionStorage = browser.storage.session ?? browser.storage.local;

function cloneUsageMap(usage = {}) {
  return Object.fromEntries(
    Object.entries(usage)
      .filter(([, value]) => Number.isFinite(value) && value > 0)
      .map(([domain, value]) => [domain, value])
  );
}

export async function loadTrackingSession() {
  const data = await sessionStorage.get(TRACKING_SESSION_KEY);
  const session = data[TRACKING_SESSION_KEY];

  if (!session || typeof session.domain !== "string" || !Number.isFinite(session.startedAt)) {
    return null;
  }

  return {
    domain: session.domain,
    startedAt: session.startedAt
  };
}

export async function saveTrackingSession(session) {
  if (!session?.domain || !Number.isFinite(session.startedAt)) {
    await clearTrackingSession();
    return;
  }

  await sessionStorage.set({
    [TRACKING_SESSION_KEY]: {
      domain: session.domain,
      startedAt: session.startedAt
    }
  });
}

export async function clearTrackingSession() {
  await sessionStorage.remove(TRACKING_SESSION_KEY);
}

export async function addUsageSegments(domain, segments) {
  if (!domain || !segments.length) {
    return;
  }

  const totalsByDay = new Map();

  for (const segment of segments) {
    if (!segment?.dayKey || !Number.isFinite(segment.duration) || segment.duration <= 0) {
      continue;
    }

    totalsByDay.set(
      segment.dayKey,
      (totalsByDay.get(segment.dayKey) || 0) + segment.duration
    );
  }

  if (!totalsByDay.size) {
    return;
  }

  const dayKeys = Array.from(totalsByDay.keys());
  const stored = await usageStorage.get(dayKeys);
  const updates = {};

  for (const dayKey of dayKeys) {
    const dayData = { ...(stored[dayKey] || {}) };
    dayData[domain] = (dayData[domain] || 0) + totalsByDay.get(dayKey);
    updates[dayKey] = dayData;
  }

  await usageStorage.set(updates);
}

export async function readUsageForDay(dayKey) {
  const data = await usageStorage.get(dayKey);
  return cloneUsageMap(data[dayKey] || {});
}

export function buildUsageWithSession(persistedUsage, session, now = Date.now()) {
  const usage = { ...cloneUsageMap(persistedUsage) };

  if (!session?.domain || !Number.isFinite(session.startedAt) || now <= session.startedAt) {
    return usage;
  }

  const todayKey = getTodayKey(now);
  const liveSegments = splitDurationByDay(session.startedAt, now);

  for (const segment of liveSegments) {
    if (segment.dayKey !== todayKey) {
      continue;
    }

    usage[session.domain] = (usage[session.domain] || 0) + segment.duration;
  }

  return usage;
}
