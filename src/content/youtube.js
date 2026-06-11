var extensionState = {
  hideShorts: false,
  hideRecommendations: false,
  blockedChannels: []
};

var extensionApi = (typeof browser !== "undefined" && typeof browser.runtime !== "undefined")
  ? browser
  : (typeof chrome !== "undefined" && typeof chrome.runtime !== "undefined")
    ? chrome
    : null;
var BLOCKED_CONTENT_PAGE_PATH = "src/ui/blocked-content/blocked-content.html";
var EVALUATION_INTERVAL_MS = 1000;
var evaluationTimerId = null;

function normalizeValue(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeHandle(value) {
  var normalized = normalizeValue(value);

  if (!normalized) {
    return "";
  }

  return normalized.startsWith("@") ? normalized : "@" + normalized;
}

function escapeCssAttributeValue(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function readStoredChannels(rawChannels) {
  if (!Array.isArray(rawChannels)) {
    return [];
  }

  return rawChannels.map(function (channel) {
    return {
      handle: normalizeHandle(channel && channel.handle),
      channelId: normalizeValue(channel && channel.channelId),
      displayName: normalizeValue(channel && channel.displayName),
      raw: channel || {}
    };
  });
}

function applyYouTubeFilters(state) {
  var styleBlock = document.getElementById("yt-custom-filter-styles");
  if (!styleBlock) {
    styleBlock = document.createElement("style");
    styleBlock.id = "yt-custom-filter-styles";
    document.head.appendChild(styleBlock);
  }

  var activeCSSRules = [];

  if (state.hideShorts) {
    activeCSSRules.push(
      [
        'ytd-mini-guide-entry-renderer:has(a[href^="/shorts"]),',
        'ytd-guide-entry-renderer:has(a[title="Shorts" i]),',
        "ytd-rich-shelf-renderer[is-shorts] {",
        "  display: none !important;",
        "}"
      ].join("\n")
    );
  }

  if (state.hideRecommendations) {
    activeCSSRules.push(
      [
        "ytd-browse {",
        "  display: none !important;",
        "}"
      ].join("\n")
    );
  }

  var blockedSelectors = buildBlockedChannelCardSelectors(state.blockedChannels);
  if (blockedSelectors.length > 0) {
    activeCSSRules.push(
      blockedSelectors.join(",\n") +
      " {\n  display: none !important;\n}"
    );
  }

  styleBlock.textContent = activeCSSRules.join("\n\n");
}

function buildBlockedChannelCardSelectors(channels) {
  var renderers = [
    "ytd-rich-item-renderer",
    "ytd-video-renderer",
    "ytd-grid-video-renderer",
    "ytd-compact-video-renderer",
    "ytd-playlist-video-renderer"
  ];
  var selectors = [];

  channels.forEach(function (channel) {
    renderers.forEach(function (renderer) {
      if (channel.handle) {
        selectors.push(
          renderer + ':has(a[href^="/' + escapeCssAttributeValue(channel.handle) + '"])'
        );
      }

      if (channel.channelId) {
        selectors.push(
          renderer + ':has(a[href^="/channel/' + escapeCssAttributeValue(channel.channelId) + '"])'
        );
      }
    });
  });

  return selectors;
}

function parseChannelUrl(urlValue) {
  try {
    var url = new URL(urlValue, window.location.origin);
    if (url.hostname !== window.location.hostname) {
      return null;
    }

    var pathname = url.pathname.replace(/\/+$/, "");
    var segments = pathname.split("/").filter(Boolean);
    var context = {
      handle: "",
      channelId: ""
    };

    if (segments[0] && segments[0].charAt(0) === "@") {
      context.handle = normalizeHandle(segments[0]);
      return context;
    }

    if (segments[0] === "channel" && segments[1]) {
      context.channelId = normalizeValue(segments[1]);
      return context;
    }

    return null;
  } catch (error) {
    return null;
  }
}

function pickFirstText(selectors) {
  for (var index = 0; index < selectors.length; index += 1) {
    var element = document.querySelector(selectors[index]);
    var text = normalizeValue(element && element.textContent);

    if (text) {
      return text;
    }
  }

  return "";
}

function pickFirstChannelLink(selectors) {
  for (var index = 0; index < selectors.length; index += 1) {
    var element = document.querySelector(selectors[index]);
    var href = element && element.getAttribute("href");
    var parsed = href ? parseChannelUrl(href) : null;

    if (parsed && (parsed.handle || parsed.channelId)) {
      return parsed;
    }
  }

  return null;
}

function getCurrentPageChannelContext() {
  var pathname = window.location.pathname.replace(/\/+$/, "");
  var isWatchPage = pathname === "/watch";
  var isShortsPage = pathname.indexOf("/shorts/") === 0;
  var isChannelPage =
    /^\/@/.test(pathname) ||
    /^\/channel\//.test(pathname) ||
    /^\/c\//.test(pathname) ||
    /^\/user\//.test(pathname);

  if (!isWatchPage && !isShortsPage && !isChannelPage) {
    return null;
  }

  var context = {
    handle: "",
    channelId: "",
    displayName: ""
  };

  if (isChannelPage) {
    var fromPath = parseChannelUrl(window.location.href);
    if (fromPath) {
      context.handle = fromPath.handle;
      context.channelId = fromPath.channelId;
    }

    var canonicalLink = document.querySelector('link[rel="canonical"]');
    var fromCanonical = canonicalLink ? parseChannelUrl(canonicalLink.href) : null;
    if (fromCanonical) {
      context.handle = context.handle || fromCanonical.handle;
      context.channelId = context.channelId || fromCanonical.channelId;
    }

    context.displayName = pickFirstText([
      "ytd-c4-tabbed-header-renderer yt-dynamic-text-view-model h1",
      "ytd-channel-name #text",
      "#channel-header-container #text"
    ]);

    return context;
  }

  var ownerSelectors = isShortsPage
    ? [
      "ytd-reel-player-header-renderer ytd-channel-name a[href]",
      "ytd-reel-video-renderer[is-active] ytd-channel-name a[href]"
    ]
    : [
      "ytd-watch-metadata ytd-channel-name a[href]",
      "ytd-video-owner-renderer ytd-channel-name a[href]",
      "#owner ytd-channel-name a[href]"
    ];
  var ownerTextSelectors = isShortsPage
    ? [
      "ytd-reel-player-header-renderer ytd-channel-name a",
      "ytd-reel-video-renderer[is-active] ytd-channel-name a"
    ]
    : [
      "ytd-watch-metadata ytd-channel-name a",
      "ytd-video-owner-renderer ytd-channel-name a",
      "#owner ytd-channel-name a"
    ];
  var ownerLink = pickFirstChannelLink(ownerSelectors);

  if (ownerLink) {
    context.handle = ownerLink.handle;
    context.channelId = ownerLink.channelId;
  }

  context.displayName = pickFirstText(ownerTextSelectors);

  if (!context.handle && !context.channelId && !context.displayName) {
    return null;
  }

  return context;
}

function getBlockedChannelMatch(context) {
  if (!context) {
    return null;
  }

  for (var index = 0; index < extensionState.blockedChannels.length; index += 1) {
    var blockedChannel = extensionState.blockedChannels[index];

    if (blockedChannel.handle && blockedChannel.handle === context.handle) {
      return blockedChannel;
    }

    if (blockedChannel.channelId && blockedChannel.channelId === context.channelId) {
      return blockedChannel;
    }

    if (blockedChannel.displayName && blockedChannel.displayName === context.displayName) {
      return blockedChannel;
    }
  }

  return null;
}

function buildBlockedChannelPageUrl(channel) {
  return {
    path: BLOCKED_CONTENT_PAGE_PATH,
    message: "This channel is blocked."
  };
}

function isYouTubeShortsPage() {
  return window.location.pathname.replace(/\/+$/, "").indexOf("/shorts/") === 0;
}

function requestInternalRedirect(path, query) {
  void extensionApi.runtime.sendMessage({
    type: "OPEN_INTERNAL_PAGE",
    payload: {
      path: path,
      query: query || {}
    }
  });
}

function evaluateBlockedChannelRedirect() {
  if (!extensionState.blockedChannels.length) {
    return;
  }

  var context = getCurrentPageChannelContext();
  var match = getBlockedChannelMatch(context);

  if (!match) {
    return;
  }

  requestInternalRedirect(buildBlockedChannelPageUrl(match).path, {
    message: buildBlockedChannelPageUrl(match).message
  });
}

function evaluateShortsRedirect() {
  if (!extensionState.hideShorts || !isYouTubeShortsPage()) {
    return false;
  }

  requestInternalRedirect(BLOCKED_CONTENT_PAGE_PATH, {
    label: "Shorts",
    platform: "YouTube"
  });

  return true;
}

function evaluateYouTubeRedirects() {
  if (evaluateShortsRedirect()) {
    return;
  }

  evaluateBlockedChannelRedirect();
}

function shouldWatchYouTubeRedirects() {
  return extensionState.hideShorts || extensionState.blockedChannels.length > 0;
}

function scheduleEvaluation() {
  if (!shouldWatchYouTubeRedirects()) {
    return;
  }

  window.setTimeout(evaluateYouTubeRedirects, 0);
}

function updateEvaluationLoop() {
  if (evaluationTimerId !== null) {
    window.clearInterval(evaluationTimerId);
    evaluationTimerId = null;
  }

  if (!shouldWatchYouTubeRedirects()) {
    return;
  }

  evaluationTimerId = window.setInterval(evaluateYouTubeRedirects, EVALUATION_INTERVAL_MS);
}

function applyState() {
  applyYouTubeFilters(extensionState);
  updateEvaluationLoop();
  scheduleEvaluation();
}

async function loadInitialState() {
  var data = await extensionApi.storage.local.get(["contentFilters", "blockedYouTubeChannels"]);
  var filters = data.contentFilters || {};

  extensionState.hideShorts = Boolean(filters.hideYouTubeShorts);
  extensionState.hideRecommendations = Boolean(filters.hideYouTubeRecommendations);
  extensionState.blockedChannels = readStoredChannels(data.blockedYouTubeChannels);

  applyState();
}

window.addEventListener("yt-navigate-finish", scheduleEvaluation);
window.addEventListener("popstate", scheduleEvaluation);

void loadInitialState();
