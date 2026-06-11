var extensionState = {
  hideReels: false,
  hideExplore: false
};

var extensionApi = (typeof browser !== "undefined" && typeof browser.runtime !== "undefined")
  ? browser
  : (typeof chrome !== "undefined" && typeof chrome.runtime !== "undefined")
    ? chrome
    : null;
var BLOCKED_CONTENT_PAGE_PATH = "src/ui/blocked-content/blocked-content.html";
var EVALUATION_INTERVAL_MS = 1000;
var evaluationTimerId = null;

function applyInstagramFilters(state) {
  var styleBlock = document.getElementById("ig-custom-filter-styles");
  if (!styleBlock) {
    styleBlock = document.createElement("style");
    styleBlock.id = "ig-custom-filter-styles";
    document.head.appendChild(styleBlock);
  }

  var activeCSSRules = [];

  if (state.hideReels) {
    activeCSSRules.push(
      [
        'article:has(a[href^="/reels/"]),',
        'article:has(a[href^="/reel/"]),',
        'div:has(> a[href^="/reels/"]),',
        'div:has(> a[href^="/reel/"]) {',
        "  display: none !important;",
        "}"
      ].join("\n")
    );
  }

  if (state.hideExplore) {
    activeCSSRules.push(
      [
        'div:has(> a[href^="/explore/"]) {',
        "  display: none !important;",
        "}"
      ].join("\n")
    );
  }

  styleBlock.textContent = activeCSSRules.join("\n\n");
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

function isInstagramReelsPage() {
  var pathname = window.location.pathname.replace(/\/+$/, "");

  return pathname.indexOf("/reels") === 0 || pathname.indexOf("/reel/") === 0;
}

function evaluateInstagramRedirect() {
  if (!extensionState.hideReels || !isInstagramReelsPage()) {
    return;
  }

  requestInternalRedirect(BLOCKED_CONTENT_PAGE_PATH, {
    label: "Reels",
    platform: "Instagram"
  });
}

function scheduleEvaluation() {
  if (!extensionState.hideReels) {
    return;
  }

  window.setTimeout(evaluateInstagramRedirect, 0);
}

function updateEvaluationLoop() {
  if (evaluationTimerId !== null) {
    window.clearInterval(evaluationTimerId);
    evaluationTimerId = null;
  }

  if (!extensionState.hideReels) {
    return;
  }

  evaluationTimerId = window.setInterval(evaluateInstagramRedirect, EVALUATION_INTERVAL_MS);
}

function applyState() {
  applyInstagramFilters(extensionState);
  updateEvaluationLoop();
  scheduleEvaluation();
}

(function patchHistory() {
  var originalPushState = history.pushState;
  var originalReplaceState = history.replaceState;

  history.pushState = function () {
    var result = originalPushState.apply(this, arguments);
    scheduleEvaluation();
    return result;
  };

  history.replaceState = function () {
    var result = originalReplaceState.apply(this, arguments);
    scheduleEvaluation();
    return result;
  };
})();

window.addEventListener("popstate", function () {
  scheduleEvaluation();
});

(async function () {
  var data = await extensionApi.storage.local.get("contentFilters");
  const filters = data.contentFilters || {};

  extensionState.hideReels = Boolean(filters.hideInstagramReels);
  extensionState.hideExplore = Boolean(filters.hideInstagramExplore);

  applyState();
})();
