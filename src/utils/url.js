// utils/url.js

export function getDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}