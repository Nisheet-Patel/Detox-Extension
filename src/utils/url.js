// utils/url.js

function sanitizeHostname(hostname) {
  if (typeof hostname !== "string") {
    return null;
  }

  const normalized = hostname.trim().toLowerCase().replace(/\.+$/, "");
  return normalized || null;
}

export function normalizeDomain(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    return sanitizeHostname(parsed.hostname);
  } catch {
    return sanitizeHostname(trimmed.replace(/^https?:\/\//i, "").split("/")[0]);
  }
}

export function getDomain(url) {
  try {
    const parsed = new URL(url);

    if (!["http:", "https:"].includes(parsed.protocol)) {
      return null;
    }

    return sanitizeHostname(parsed.hostname);
  } catch {
    return null;
  }
}

export function domainMatches(hostname, storedDomain) {
  const normalizedHost = normalizeDomain(hostname);
  const normalizedStoredDomain = normalizeDomain(storedDomain);

  if (!normalizedHost || !normalizedStoredDomain) {
    return false;
  }

  return (
    normalizedHost === normalizedStoredDomain ||
    normalizedHost.endsWith(`.${normalizedStoredDomain}`)
  );
}

export function findBestMatchingEntry(hostname, entries, getEntryDomain) {
  const getDomainFromEntry =
    typeof getEntryDomain === "function"
      ? getEntryDomain
      : (entry) => (typeof entry === "string" ? entry : entry?.domain);

  let bestMatch = null;
  let bestMatchLength = -1;

  for (const entry of entries) {
    const entryDomain = normalizeDomain(getDomainFromEntry(entry));

    if (!entryDomain || !domainMatches(hostname, entryDomain)) {
      continue;
    }

    if (entryDomain.length > bestMatchLength) {
      bestMatch = entry;
      bestMatchLength = entryDomain.length;
    }
  }

  return bestMatch;
}

export function getMatchedUsageTotal(usage = {}, domain) {
  const normalizedDomain = normalizeDomain(domain);

  if (!normalizedDomain) {
    return 0;
  }

  return Object.entries(usage).reduce((total, [usageDomain, value]) => {
    if (!Number.isFinite(value) || !domainMatches(usageDomain, normalizedDomain)) {
      return total;
    }

    return total + value;
  }, 0);
}
