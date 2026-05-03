// 1. Centralized Configuration State
var extensionState = {
  hideShorts: true,
  blockedChannels: []
};

// 2. The Master Render Function
function applyYouTubeFilters(state) {
  console.log(state);
  // Check if our style block already exists. If not, create it.
  let styleBlock = document.getElementById('yt-custom-filter-styles');
  if (!styleBlock) {
    styleBlock = document.createElement('style');
    styleBlock.id = 'yt-custom-filter-styles';
    document.head.appendChild(styleBlock);
  }

  // Array to hold all our active CSS rules
  let activeCSSRules = [];

  // --- FILTER: HIDE SHORTS ---
  if (state.hideShorts) {
    activeCSSRules.push(`
            /* Hides Mini Sidebar Shorts (using href) */
            ytd-mini-guide-entry-renderer:has(a[href^="/shorts"]),

            /* Hides Expanded Sidebar Shorts (using title with 'i' for case-insensitivity) */
            ytd-guide-entry-renderer:has(a[title="Shorts" i]),
            
            /* Hides the Home Feed Shorts Shelf */
            ytd-rich-shelf-renderer[is-shorts] {
                display: none !important;
            }
        `);
  }

  // --- FILTER: BLOCKED CHANNELS ---
  if (state.blockedChannels && state.blockedChannels.length > 0) {
    // Map the channels into CSS selectors
    const channelSelectors = state.blockedChannels.map(channel =>
      `ytd-rich-item-renderer:has(a[href="${channel}"])`
    ).join(',\n');

    activeCSSRules.push(`
            /* Hides specific channel video cards */
            ${channelSelectors} {
                display: none !important;
            }
        `);
  }

  // 3. Inject the combined CSS into the page
  // Using .join('\n\n') separates our different rule blocks nicely
  styleBlock.textContent = activeCSSRules.join('\n\n');
  console.log("YouTube filters updated successfully!");
}

// 4. Run it on load



// 4. Run it on load
(async () => {
  const data = await browser.storage.local.get(["contentFilters", "blockedYouTubeChannels"]);

  const filters = data.contentFilters || {};

  extensionState.hideShorts = Boolean(filters.hideYouTubeShorts);
  // extensionState.hideRecommendations = Boolean(filters.hideYouTubeRecommendations);
  extensionState.blockedChannels = Array.isArray(data.blockedYouTubeChannels)
    ? data.blockedYouTubeChannels.map(item => item.displayName)
    : [];
  applyYouTubeFilters(extensionState);
})();