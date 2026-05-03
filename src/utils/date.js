// utils/date.js

function pad(value) {
  return String(value).padStart(2, "0");
}

export function getTodayKey(timestamp = Date.now()) {
  const date = new Date(timestamp);

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join("-");
}

export function getStartOfDay(timestamp = Date.now()) {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function getStartOfNextDay(timestamp = Date.now()) {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 1);
  return date.getTime();
}

export function splitDurationByDay(startTime, endTime) {
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime <= startTime) {
    return [];
  }

  const segments = [];
  let segmentStart = startTime;

  while (segmentStart < endTime) {
    const nextDayStart = getStartOfNextDay(segmentStart);
    const segmentEnd = Math.min(endTime, nextDayStart);

    segments.push({
      dayKey: getTodayKey(segmentStart),
      duration: segmentEnd - segmentStart
    });

    segmentStart = segmentEnd;
  }

  return segments;
}
