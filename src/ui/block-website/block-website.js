import { StorageService } from "../../storage/storageService.js";
import { getDomain, normalizeDomain } from "../../utils/url.js";

let sites = [];
let drafts = {};
let searchQuery = "";

const container = document.getElementById("cardsContainer");
const siteInput = document.getElementById("siteInput");
const blockBtn = document.getElementById("blockBtn");
const thisSiteBtn = document.getElementById("thisSiteBtn");
const clearBtn = document.getElementById("clearBtn");
const emptyState = document.getElementById("emptyState");

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

function getFavicon(url) {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(url)}&sz=64`;
}

function formatLimit(limitSeconds) {
  if (limitSeconds === 0) {
    return "Always blocked";
  }

  if (limitSeconds % 3600 === 0) {
    return `${limitSeconds / 3600}h/day`;
  }

  if (limitSeconds % 60 === 0) {
    return `${limitSeconds / 60}m/day`;
  }

  return `${limitSeconds}s/day`;
}

function toDraft(site) {
  if (site.limitSeconds === 0) {
    return {
      domain: site.domain,
      limit: 0,
      unit: "m",
      isCustom: false
    };
  }

  if (site.limitSeconds % 3600 === 0) {
    const hours = site.limitSeconds / 3600;
    return {
      domain: site.domain,
      limit: hours,
      unit: "h",
      isCustom: hours !== 1
    };
  }

  const minutes = Math.max(1, Math.floor(site.limitSeconds / 60));
  return {
    domain: site.domain,
    limit: minutes,
    unit: "m",
    isCustom: ![15, 30].includes(minutes)
  };
}

function getDraftLimitSeconds(draft, customInputValue) {
  if (draft.limit === 0 && !draft.isCustom) {
    return 0;
  }

  const value = draft.isCustom ? Number.parseInt(customInputValue, 10) : draft.limit;

  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  return draft.unit === "h" ? value * 3600 : value * 60;
}

function updateBlockButtonState() {
  const normalizedQuery = normalizeDomain(searchQuery);
  const exactMatch = normalizedQuery && sites.some((site) => site.domain === normalizedQuery);

  blockBtn.disabled = Boolean(exactMatch);
  blockBtn.textContent = exactMatch ? "Added" : "Block";
}

function render() {
  container.innerHTML = "";

  const filteredSites = sites.filter((site) =>
    site.domain.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!filteredSites.length) {
    emptyState.classList.remove("hidden");
    emptyState.classList.add("flex");
  } else {
    emptyState.classList.add("hidden");
    emptyState.classList.remove("flex");
  }

  if (searchQuery !== "") {
    clearBtn.classList.remove("hidden");
  } else {
    clearBtn.classList.add("hidden");
  }

  filteredSites.forEach((site) => {
    const wrapper = document.createElement("div");
    wrapper.className = "relative overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-all";
    wrapper.innerHTML = drafts[site.domain]
      ? generateEditState(site.domain)
      : generateViewState(site);
    container.appendChild(wrapper);
  });
}

function highlightMatch(domain) {
  if (!searchQuery) {
    return escapeHtml(domain);
  }

  const safeRegex = new RegExp(`(${escapeRegExp(searchQuery)})`, "gi");
  return escapeHtml(domain).replace(safeRegex, '<span class="bg-yellow-200 text-gray-900">$1</span>');
}

function generateViewState(site) {
  return `
    <div class="group relative p-3 h-[60px]">
      <div class="flex h-full w-full items-center gap-3 transition-all duration-200 group-hover:blur-[2px] group-hover:opacity-30">
        <img src="${getFavicon(site.domain)}" class="h-6 w-6 rounded-sm bg-gray-100" alt="" />
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium text-gray-800">${highlightMatch(site.domain)}</p>
          <p class="mt-0.5 text-xs text-gray-500">${formatLimit(site.limitSeconds)}</p>
        </div>
      </div>

      <div class="pointer-events-none absolute inset-0 flex items-center justify-center gap-3 opacity-0 transition-opacity duration-200 group-hover:pointer-events-auto group-hover:opacity-100">
        <button data-action="edit" data-id="${site.domain}" class="rounded-full border border-gray-100 bg-white p-2 text-gray-600 shadow-md transition-all hover:-translate-y-0.5 hover:text-blue-600">
          <svg class="pointer-events-none h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
        </button>
        <button data-action="delete" data-id="${site.domain}" class="rounded-full border border-gray-100 bg-white p-2 text-gray-600 shadow-md transition-all hover:-translate-y-0.5 hover:text-red-500">
          <svg class="pointer-events-none h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
        </button>
      </div>
    </div>
  `;
}

function generateEditState(id) {
  const draft = drafts[id];
  const chips = [
    { label: "Block", val: 0, unit: "m" },
    { label: "15m", val: 15, unit: "m" },
    { label: "30m", val: 30, unit: "m" },
    { label: "1h", val: 1, unit: "h" }
  ];

  const chipHtml = chips.map((chip) => {
    const isActive = draft.limit === chip.val && draft.unit === chip.unit && !draft.isCustom;
    const baseClass = "flex-1 rounded-md border py-1 text-xs font-medium transition-colors";
    const activeClass = isActive
      ? "border-blue-200 bg-blue-50 text-blue-700"
      : "border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100";

    return `<button data-action="chip" data-id="${id}" data-val="${chip.val}" data-unit="${chip.unit}" class="${baseClass} ${activeClass}">${chip.label}</button>`;
  }).join("");

  return `
    <div class="bg-gray-50/50 p-3">
      <input type="text" id="url-${id}" value="${escapeHtml(draft.domain)}" class="mb-4 w-full rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-sm font-medium shadow-sm transition-shadow focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="example.com">
      <p class="mb-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500">Time Limit</p>
      <div class="mb-3 flex gap-1.5">${chipHtml}</div>
      <div class="mb-4 flex gap-2">
        <input type="number" data-action="custom-input" data-id="${id}" id="custom-val-${id}" value="${draft.isCustom ? draft.limit : ""}" class="flex-1 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-center text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="Custom time" min="1">
        <button data-action="toggle-unit" data-id="${id}" class="w-12 rounded-md border border-gray-200 bg-white text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50">
          ${draft.unit.toUpperCase()}
        </button>
      </div>
      <div class="flex gap-2">
        <button data-action="cancel" data-id="${id}" class="flex-1 rounded-md border border-gray-200 bg-white py-1.5 text-sm font-medium text-gray-600 shadow-sm transition-colors hover:bg-gray-50">Cancel</button>
        <button data-action="save" data-id="${id}" class="flex-1 rounded-md bg-blue-600 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700">Save</button>
      </div>
    </div>
  `;
}

async function loadSites() {
  sites = await StorageService.getManagedWebsites();
  updateBlockButtonState();
  render();
}

siteInput.addEventListener("input", () => {
  searchQuery = siteInput.value.trim();
  updateBlockButtonState();
  render();
});

blockBtn.addEventListener("click", async () => {
  const normalizedDomain = normalizeDomain(siteInput.value);
  if (!normalizedDomain) {
    return;
  }

  await StorageService.upsertManagedWebsite(normalizedDomain, 0);
  siteInput.value = "";
  searchQuery = "";
  updateBlockButtonState();
  await loadSites();
});

clearBtn.addEventListener("click", () => {
  siteInput.value = "";
  searchQuery = "";
  updateBlockButtonState();
  render();
});

thisSiteBtn.addEventListener("click", async () => {
  try {
    const [tab] = await browser.tabs.query({
      active: true,
      currentWindow: true
    });

    const domain = getDomain(tab?.url);
    if (!domain) {
      return;
    }

    siteInput.value = domain;
    searchQuery = domain;
    updateBlockButtonState();
    render();
  } catch (error) {
    console.error("Failed to read current tab domain:", error);
  }
});

container.addEventListener("click", async (event) => {
  const button = event.target.closest("button");
  if (!button) {
    return;
  }

  const action = button.dataset.action;
  const id = button.dataset.id;

  if (action === "edit") {
    const site = sites.find((entry) => entry.domain === id);
    if (!site) {
      return;
    }

    drafts[id] = toDraft(site);
    render();
    return;
  }

  if (action === "delete") {
    await StorageService.removeManagedWebsite(id);
    delete drafts[id];
    await loadSites();
    return;
  }

  if (action === "cancel") {
    delete drafts[id];
    render();
    return;
  }

  if (action === "toggle-unit") {
    drafts[id].unit = drafts[id].unit === "m" ? "h" : "m";
    drafts[id].isCustom = true;
    render();
    return;
  }

  if (action === "chip") {
    drafts[id].limit = Number.parseInt(button.dataset.val, 10);
    drafts[id].unit = button.dataset.unit;
    drafts[id].isCustom = false;
    render();
    return;
  }

  if (action === "save") {
    const domainInput = document.getElementById(`url-${id}`)?.value || "";
    const customInputValue = document.getElementById(`custom-val-${id}`)?.value || "";
    const normalizedDomain = normalizeDomain(domainInput);

    if (!normalizedDomain) {
      window.alert("Please enter a valid domain.");
      return;
    }

    const nextLimitSeconds = getDraftLimitSeconds(drafts[id], customInputValue);
    if (nextLimitSeconds === null) {
      window.alert("Please enter a valid time limit.");
      return;
    }

    await StorageService.removeManagedWebsite(id);
    await StorageService.upsertManagedWebsite(normalizedDomain, nextLimitSeconds);
    delete drafts[id];
    await loadSites();
  }
});

container.addEventListener("input", (event) => {
  if (event.target.dataset.action !== "custom-input") {
    return;
  }

  const id = event.target.dataset.id;
  const value = Number.parseInt(event.target.value, 10);

  drafts[id].isCustom = true;

  if (Number.isFinite(value) && value > 0) {
    drafts[id].limit = value;
  }
});

browser.storage.onChanged.addListener(() => {
  void loadSites();
});

void loadSites();
