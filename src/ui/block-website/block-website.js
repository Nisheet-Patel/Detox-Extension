// popup.js

// 1. State
let sites = [
  { id: 1, url: 'youtube.com', limit: 30, unit: 'm' },
  { id: 2, url: 'twitter.com', limit: 0, unit: 'm' },
  { id: 3, url: 'reddit.com', limit: 1, unit: 'h' }
];

let drafts = {};
let searchQuery = '';

// DOM Elements
const container = document.getElementById('cardsContainer');
const siteInput = document.getElementById('siteInput');
const blockBtn = document.getElementById('blockBtn');
const thisSiteBtn = document.getElementById('thisSiteBtn');
const clearBtn = document.getElementById('clearBtn');
const emptyState = document.getElementById('emptyState');

// Helper to fetch dynamic favicon
function getFavicon(url) {
  let domain = url;
  try {
    domain = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
  } catch (e) {
    domain = url.trim().split('/')[0];
  }
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
}

// 2. Render Function
function render() {
  container.innerHTML = '';
  
  // Filter sites based on search query
  const filteredSites = sites.filter(s => s.url.toLowerCase().includes(searchQuery.toLowerCase()));
  
  // Toggle Empty State
  if (filteredSites.length === 0 && searchQuery !== '') {
    emptyState.classList.remove('hidden');
    emptyState.classList.add('flex');
  } else {
    emptyState.classList.add('hidden');
    emptyState.classList.remove('flex');
  }

  // Toggle Clear Button
  if (searchQuery !== '') {
    clearBtn.classList.remove('hidden');
  } else {
    clearBtn.classList.add('hidden');
  }

  // Render Cards
  filteredSites.forEach(site => {
    const wrapper = document.createElement('div');
    wrapper.className = 'relative bg-white border border-gray-200 rounded-xl shadow-sm transition-all overflow-hidden';
    
    if (drafts[site.id]) {
      wrapper.innerHTML = generateEditState(site.id);
    } else {
      wrapper.innerHTML = generateViewState(site);
    }
    container.appendChild(wrapper);
  });
}

// 3. View & Edit State Generators (From previous step)
function generateViewState(site) {
  const limitText = site.limit === 0 ? 'No limit' : `${site.limit}${site.unit}`;
  const faviconUrl = getFavicon(site.url);
  
  // Highlight matching text if searching
  let displayUrl = site.url;
  if (searchQuery) {
    const regex = new RegExp(`(${searchQuery})`, 'gi');
    displayUrl = site.url.replace(regex, '<span class="bg-yellow-200 text-gray-900">$1</span>');
  }
  
  return `
    <div class="group relative p-3 h-[60px]">
      <div class="flex items-center gap-3 transition-all duration-200 group-hover:blur-[2px] group-hover:opacity-30 h-full w-full">
        <img src="${faviconUrl}" class="w-6 h-6 rounded-sm bg-gray-100" onerror="this.src='https://via.placeholder.com/24'">
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-gray-800 truncate">${displayUrl}</p>
          <p class="text-xs text-gray-500 mt-0.5">${limitText}</p>
        </div>
      </div>

      <div class="absolute inset-0 flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none group-hover:pointer-events-auto">
        <button data-action="edit" data-id="${site.id}" class="p-2 bg-white text-gray-600 rounded-full shadow-md border border-gray-100 hover:text-blue-600 hover:-translate-y-0.5 transition-all">
          <svg class="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
        </button>
        <button data-action="delete" data-id="${site.id}" class="p-2 bg-white text-gray-600 rounded-full shadow-md border border-gray-100 hover:text-red-500 hover:-translate-y-0.5 transition-all">
          <svg class="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
        </button>
      </div>
    </div>
  `;
}

function generateEditState(id) {
  const draft = drafts[id];
  const chips = [
    { label: 'No', val: 0, unit: 'm' },
    { label: '15m', val: 15, unit: 'm' },
    { label: '30m', val: 30, unit: 'm' },
    { label: '1h', val: 1, unit: 'h' }
  ];

  const chipHTML = chips.map(c => {
    const isActive = draft.limit === c.val && draft.unit === c.unit && !draft.isCustom;
    const baseClass = "flex-1 py-1 text-xs font-medium rounded-md border transition-colors";
    const activeClass = isActive ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100";
    return `<button data-action="chip" data-id="${id}" data-val="${c.val}" data-unit="${c.unit}" class="${baseClass} ${activeClass} chip-btn-${id}">${c.label}</button>`;
  }).join('');

  return `
    <div class="p-3 bg-gray-50/50">
      <input type="text" id="url-${id}" value="${draft.url}" class="w-full text-sm font-medium border border-gray-200 rounded-md px-2.5 py-1.5 mb-4 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-shadow bg-white shadow-sm" placeholder="example.com">
      <p class="text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Time Limit</p>
      <div class="flex gap-1.5 mb-3">${chipHTML}</div>
      <div class="flex gap-2 mb-4">
        <input type="number" data-action="custom-input" data-id="${id}" id="custom-val-${id}" value="${draft.isCustom ? draft.limit : ''}" class="flex-1 text-sm border border-gray-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white shadow-sm text-center" placeholder="Custom time" min="1">
        <button data-action="toggle-unit" data-id="${id}" class="w-12 border border-gray-200 bg-white text-gray-700 text-sm font-semibold rounded-md shadow-sm hover:bg-gray-50 transition-colors">
          ${draft.unit.toUpperCase()}
        </button>
      </div>
      <div class="flex gap-2">
        <button data-action="cancel" data-id="${id}" class="flex-1 bg-white border border-gray-200 text-gray-600 text-sm font-medium py-1.5 rounded-md hover:bg-gray-50 transition-colors shadow-sm">Cancel</button>
        <button data-action="save" data-id="${id}" class="flex-1 bg-blue-600 text-white text-sm font-medium py-1.5 rounded-md hover:bg-blue-700 transition-colors shadow-sm">Save</button>
      </div>
    </div>
  `;
}

// 4. Input & Top Section Listeners

// Debounced Search Input
let debounceTimer;
siteInput.addEventListener('input', (e) => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    searchQuery = e.target.value.trim();
    
    // Check if exact match exists to disable block button (optional, but good UX)
    const exactMatch = sites.some(s => s.url.toLowerCase() === searchQuery.toLowerCase());
    blockBtn.disabled = exactMatch;
    blockBtn.textContent = exactMatch ? 'Added' : 'Block';

    render();
  }, 200); // 200ms debounce
});

// Block (Add) Button
blockBtn.addEventListener('click', () => {
  const newUrl = siteInput.value.trim();
  if (!newUrl) return;

  // Create new site with default 30m limit
  const newSite = {
    id: Date.now(), // Generate unique ID
    url: newUrl.replace(/^https?:\/\//, ''), // Strip http/https for cleanliness
    limit: 0,
    unit: 'm'
  };

  sites.unshift(newSite); // Add to top of list
  
  // Clear input and reset search
  siteInput.value = '';
  searchQuery = '';
  blockBtn.disabled = false;
  blockBtn.textContent = 'Block';
  
  render();
});

// Clear Chip
clearBtn.addEventListener('click', () => {
  siteInput.value = '';
  searchQuery = '';
  blockBtn.disabled = false;
  blockBtn.textContent = 'Block';
  render();
});

// "+ This Site" Chip (Mocks getting current tab domain)
thisSiteBtn.addEventListener('click', () => {
  // In a real extension, you'd use chrome.tabs.query({active: true, currentWindow: true})
  const currentTabDomain = 'github.com'; // Mock value
  
  siteInput.value = currentTabDomain;
  // Manually trigger the input event to update search/button state
  siteInput.dispatchEvent(new Event('input'));
});

// 5. Global Event Listener for Cards (Event Delegation)
container.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;

  const action = btn.dataset.action;
  const id = parseInt(btn.dataset.id, 10);

  if (action === 'edit') {
    const site = sites.find(s => s.id === id);
    const isPreset = ([0, 15, 30].includes(site.limit) && site.unit === 'm') || (site.limit === 1 && site.unit === 'h');
    drafts[id] = { ...site, isCustom: !isPreset };
    render();
  } 
  else if (action === 'delete') {
    sites = sites.filter(s => s.id !== id);
    render();
  } 
  else if (action === 'cancel') {
    delete drafts[id];
    render();
  } 
  else if (action === 'save') {
    const urlInput = document.getElementById(`url-${id}`).value.trim();
    const customInput = document.getElementById(`custom-val-${id}`).value;
    const draft = drafts[id];

    if (!urlInput) { alert("Please enter a valid URL."); return; }
    if (draft.isCustom) {
      const val = parseInt(customInput, 10);
      if (isNaN(val) || val <= 0) { alert("Please enter a valid time limit."); return; }
      draft.limit = val;
    }

    const index = sites.findIndex(s => s.id === id);
    sites[index] = { ...sites[index], url: urlInput, limit: draft.limit, unit: draft.unit };
    delete drafts[id];
    render();
  } 
  else if (action === 'toggle-unit') {
    drafts[id].unit = drafts[id].unit === 'm' ? 'h' : 'm';
    drafts[id].isCustom = true; 
    render();
  } 
  else if (action === 'chip') {
    drafts[id].limit = parseInt(btn.dataset.val, 10);
    drafts[id].unit = btn.dataset.unit;
    drafts[id].isCustom = false;
    render(); 
  }
});

// Listener for the custom number input
container.addEventListener('input', (e) => {
  if (e.target.dataset.action === 'custom-input') {
    const id = parseInt(e.target.dataset.id, 10);
    const val = parseInt(e.target.value, 10);
    
    if (!isNaN(val)) {
      drafts[id].limit = val;
      drafts[id].isCustom = true;
    }
    document.querySelectorAll(`.chip-btn-${id}`).forEach(btn => {
      btn.classList.remove('bg-blue-50', 'border-blue-200', 'text-blue-700');
      btn.classList.add('bg-gray-50', 'border-gray-200', 'text-gray-600');
    });
  }
});

// Initialize
render();