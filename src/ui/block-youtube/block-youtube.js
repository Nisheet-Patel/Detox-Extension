import "../mock-preview.js";
import "../../vendor/browser-polyfill.min.js";
import { StorageService } from "../../storage/storageService.js";

let channels = [];
let drafts = {};
let searchQuery = "";

const container = document.getElementById("cardsContainer");
const channelInput = document.getElementById("channelInput");
const blockBtn = document.getElementById("blockBtn");
const emptyState = document.getElementById("emptyState");
const channelCount = document.getElementById("channelCount");
const toggleShorts = document.getElementById("toggleShorts");
const toggleFeed = document.getElementById("toggleFeed");

function normalizeValue(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getChannelKey(channel) {
  return channel.addedAt || channel.handle || channel.channelId || channel.displayName;
}

function getChannelLabel(channel) {
  return channel.handle || channel.displayName || channel.channelId || "Unknown channel";
}

function highlightLabel(label, query) {
  if (!query) {
    return escapeHtml(label);
  }

  const parts = label.split(new RegExp(`(${escapeRegExp(query)})`, "gi"));

  return parts
    .map((part) =>
      normalizeValue(part) === normalizeValue(query)
        ? `<span class="bg-yellow-100 text-stone-900">${escapeHtml(part)}</span>`
        : escapeHtml(part)
    )
    .join("");
}

function buildChannelPayload(value) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  const normalizedHandleInput = trimmedValue.replace(/^\/+/, "");
  const plainHandleMatch = normalizedHandleInput.match(/^@?([a-zA-Z0-9._-]+)$/);

  if (plainHandleMatch) {
    return {
      handle: `@${plainHandleMatch[1].toLowerCase()}`,
      displayName: `@${plainHandleMatch[1].toLowerCase()}`
    };
  }

  try {
    const url = new URL(
      trimmedValue.startsWith("http://") || trimmedValue.startsWith("https://")
        ? trimmedValue
        : `https://youtube.com${trimmedValue.startsWith("/") ? "" : "/"}${trimmedValue}`
    );
    const pathname = url.pathname.replace(/\/+$/, "");
    const segments = pathname.split("/").filter(Boolean);

    if (segments[0]?.startsWith("@")) {
      const handle = `@${segments[0].slice(1).toLowerCase()}`;
      return {
        handle,
        displayName: handle
      };
    }

    if (segments[0] === "channel" && segments[1]) {
      return {
        channelId: segments[1].toLowerCase(),
        displayName: segments[1]
      };
    }
  } catch (error) {
    // Treat non-URL input as a plain channel label.
  }

  return {
    displayName: trimmedValue
  };
}

async function reloadDomain(domain) {
  const tabs = await browser.tabs.query({});

  for (const tab of tabs) {
    try {
      const url = new URL(tab.url);

      if (url.hostname === domain || url.hostname.endsWith(`.${domain}`)) {
        await browser.tabs.reload(tab.id);
      }
    } catch (error) {
      // Ignore chrome:// and other unsupported URLs.
    }
  }
}

async function refreshChannels() {
  channels = await StorageService.getBlockedYouTubeChannels();
  render();
}

function render() {
  container.innerHTML = "";

  const filteredChannels = channels.filter((channel) =>
    normalizeValue(getChannelLabel(channel)).includes(normalizeValue(searchQuery))
  );

  channelCount.textContent = `${channels.length} Blocked Channel${channels.length === 1 ? "" : "s"}`;

  if (filteredChannels.length === 0) {
    emptyState.classList.remove("hidden");
    emptyState.classList.add("flex");
    emptyState.querySelector("p").textContent =
      searchQuery !== "" ? "No matching channels." : "No channels blocked.";
  } else {
    emptyState.classList.add("hidden");
    emptyState.classList.remove("flex");
  }

  filteredChannels.forEach((channel) => {
    const wrapper = document.createElement("div");
    wrapper.className =
      "relative bg-white border border-stone-200/60 rounded-2xl shadow-sm hover:border-yellow-300 hover:shadow-md transition-all duration-200 overflow-hidden";

    const channelKey = getChannelKey(channel);
    wrapper.innerHTML = drafts[channelKey]
      ? generateEditState(channelKey)
      : generateViewState(channel);

    container.appendChild(wrapper);
  });
}

function generateViewState(channel) {
  const channelKey = getChannelKey(channel);
  const displayName = highlightLabel(getChannelLabel(channel), searchQuery);

  return `
    <div class="group relative p-3 h-[52px]">
      <div class="flex items-center gap-3 transition-all duration-200 group-hover:blur-[1px] group-hover:opacity-30 h-full w-full">
        <div class="w-7 h-7 rounded-full bg-stone-50 border border-stone-100 flex items-center justify-center text-stone-400">
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-xs font-bold text-stone-800 truncate leading-tight">${displayName}</p>
        </div>
      </div>

      <div class="absolute inset-0 flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none group-hover:pointer-events-auto">
        <button data-action="edit" data-id="${escapeHtml(channelKey)}" class="p-2 bg-white text-stone-600 rounded-xl shadow-sm border border-stone-200 hover:bg-yellow-50 hover:text-yellow-700 hover:border-yellow-300 active:scale-95 transition-all">
          <svg class="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
        </button>
        <button data-action="delete" data-id="${escapeHtml(channelKey)}" class="p-2 bg-white text-stone-600 rounded-xl shadow-sm border border-stone-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 active:scale-95 transition-all">
          <svg class="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
        </button>
      </div>
    </div>
  `;
}

function generateEditState(channelKey) {
  const draft = drafts[channelKey];

  return `
    <div class="p-3 bg-stone-50/50">
      <input type="text" id="name-${escapeHtml(channelKey)}" value="${escapeHtml(draft.name)}" class="w-full text-xs font-semibold border border-stone-200 rounded-xl px-2.5 py-1.5 mb-3 focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition-shadow bg-white shadow-sm text-stone-800" placeholder="Channel Name">

      <div class="flex gap-1.5">
        <button data-action="cancel" data-id="${escapeHtml(channelKey)}" class="flex-1 bg-white border border-stone-200 text-stone-600 text-xs font-bold py-1.5 rounded-xl hover:bg-stone-50 active:scale-95 transition-all shadow-sm">Cancel</button>
        <button data-action="save" data-id="${escapeHtml(channelKey)}" class="flex-1 bg-yellow-400 border border-yellow-500/20 text-stone-900 text-xs font-bold py-1.5 rounded-xl hover:bg-yellow-500 active:scale-95 transition-all shadow-sm">Save</button>
      </div>
    </div>
  `;
}

let debounceTimer;
channelInput.addEventListener("input", (event) => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    searchQuery = event.target.value.trim();

    const exactMatch = channels.some(
      (channel) => normalizeValue(getChannelLabel(channel)) === normalizeValue(searchQuery)
    );

    blockBtn.disabled = exactMatch;
    blockBtn.textContent = exactMatch ? "Added" : "Block";

    render();
  }, 200);
});

blockBtn.addEventListener("click", async () => {
  const payload = buildChannelPayload(channelInput.value);

  if (!payload) {
    return;
  }

  blockBtn.disabled = true;

  try {
    const response = await browser.runtime.sendMessage({
      type: "YOUTUBE_ADD_BLOCKED_CHANNEL",
      payload
    });

    if (!response?.success) {
      blockBtn.textContent = "Added";
      return;
    }

    channelInput.value = "";
    searchQuery = "";
    blockBtn.textContent = "Block";

    await refreshChannels();
    await reloadDomain("youtube.com");
  } finally {
    blockBtn.disabled = false;
  }
});

container.addEventListener("click", async (event) => {
  const button = event.target.closest("button");

  if (!button) {
    return;
  }

  const action = button.dataset.action;
  const channelKey = button.dataset.id;
  const channel = channels.find((item) => getChannelKey(item) === channelKey);

  if (action === "edit" && channel) {
    drafts[channelKey] = { name: getChannelLabel(channel) };
    render();
    return;
  }

  if (action === "delete" && channel) {
    await browser.runtime.sendMessage({
      type: "YOUTUBE_REMOVE_BLOCKED_CHANNEL",
      payload: {
        addedAt: channel.addedAt,
        handle: channel.handle,
        channelId: channel.channelId,
        displayName: channel.displayName
      }
    });

    delete drafts[channelKey];
    await refreshChannels();
    await reloadDomain("youtube.com");
    return;
  }

  if (action === "cancel") {
    delete drafts[channelKey];
    render();
    return;
  }

  if (action === "save" && channel) {
    const input = document.getElementById(`name-${channelKey}`);
    const name = input?.value.trim();

    if (!name) {
      alert("Please enter a channel name.");
      return;
    }

    const response = await browser.runtime.sendMessage({
      type: "YOUTUBE_UPDATE_BLOCKED_CHANNEL",
      payload: {
        identifier: { addedAt: channel.addedAt },
        updates: { displayName: name }
      }
    });

    if (!response?.success) {
      alert("That channel is already blocked.");
      return;
    }

    delete drafts[channelKey];
    await refreshChannels();
    await reloadDomain("youtube.com");
  }
});

toggleShorts.addEventListener("change", async (event) => {
  await browser.runtime.sendMessage({
    type: "YOUTUBE_TOGGLE_SHORTS",
    payload: event.target.checked
  });

  await reloadDomain("youtube.com");
});

toggleFeed.addEventListener("change", async (event) => {
  await browser.runtime.sendMessage({
    type: "YOUTUBE_TOGGLE_RECOMMENDATIONS",
    payload: event.target.checked
  });

  await reloadDomain("youtube.com");
});

(async () => {
  const [filters, storedChannels] = await Promise.all([
    StorageService.getContentFilters(),
    StorageService.getBlockedYouTubeChannels()
  ]);

  toggleShorts.checked = filters.hideYouTubeShorts;
  toggleFeed.checked = filters.hideYouTubeRecommendations;
  channels = storedChannels;

  render();
})();
