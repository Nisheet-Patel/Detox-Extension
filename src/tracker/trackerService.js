// tracker/trackerService.js

import { getTodayKey } from "../utils/date.js";
import {
  addUsageSegments,
  clearTrackingSession,
  buildUsageWithSession,
  loadTrackingSession,
  readUsageForDay,
  saveTrackingSession
} from "./trackingStorage.js";
import { splitDurationByDay } from "../utils/date.js";
import { state } from "./state.js";

function queueOperation(task) {
  const operation = state.operationQueue.then(task, task);
  state.operationQueue = operation.catch((error) => {
    console.error("Tracking operation failed:", error);
  });
  return operation;
}

async function ensureSessionLoaded() {
  if (state.sessionLoaded) {
    return state.session;
  }

  state.session = await loadTrackingSession();
  state.sessionLoaded = true;
  return state.session;
}

async function persistSession(session) {
  state.session = session;
  state.sessionLoaded = true;

  if (session) {
    await saveTrackingSession(session);
    return;
  }

  await clearTrackingSession();
}

async function commitSession(endTime = Date.now()) {
  const session = await ensureSessionLoaded();
  if (!session?.domain || !Number.isFinite(session.startedAt) || endTime <= session.startedAt) {
    return session;
  }

  const segments = splitDurationByDay(session.startedAt, endTime);
  await addUsageSegments(session.domain, segments);

  return {
    domain: session.domain,
    startedAt: endTime
  };
}

export async function initializeTrackerSession() {
  return queueOperation(async () => {
    await ensureSessionLoaded();
  });
}

export async function commitTime(endTime = Date.now()) {
  return queueOperation(async () => {
    const committedSession = await commitSession(endTime);
    await persistSession(null);
    return committedSession;
  });
}

export async function stopTracking(endTime = Date.now()) {
  return commitTime(endTime);
}

export async function trackDomain(domain, startedAt = Date.now()) {
  return queueOperation(async () => {
    await ensureSessionLoaded();

    if (!domain) {
      const committedSession = await commitSession(startedAt);
      await persistSession(null);
      return committedSession;
    }

    if (!Number.isFinite(startedAt)) {
      startedAt = Date.now();
    }

    if (state.session && startedAt < state.session.startedAt) {
      startedAt = state.session.startedAt;
    }

    if (!state.session) {
      const nextSession = { domain, startedAt };
      await persistSession(nextSession);
      return nextSession;
    }

    if (state.session.domain === domain) {
      return state.session;
    }

    await commitSession(startedAt);

    const nextSession = { domain, startedAt };
    await persistSession(nextSession);
    return nextSession;
  });
}

export async function getUsageSnapshot(now = Date.now()) {
  return queueOperation(async () => {
    const dayKey = getTodayKey(now);
    const session = await ensureSessionLoaded();
    const persistedUsage = await readUsageForDay(dayKey);

    return {
      dayKey,
      persistedUsage,
      session,
      usage: buildUsageWithSession(persistedUsage, session, now)
    };
  });
}
