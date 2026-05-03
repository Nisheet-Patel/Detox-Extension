// 1. Centralized Configuration State
let extensionState = {
    hideReels: false,
    hideExplore: false,
};

// 2. The Master Render Function
function applyInstagramFilters(state) {
    console.log(state);

    let styleBlock = document.getElementById('ig-custom-filter-styles');
    if (!styleBlock) {
        styleBlock = document.createElement('style');
        styleBlock.id = 'ig-custom-filter-styles';
        document.head.appendChild(styleBlock);
    }

    let activeCSSRules = [];

    // --- FILTER 1: HIDE REELS ---
    if (state.hideReels) {
        activeCSSRules.push(`
            /* Hides any post in the feed that is a Reel */
            article:has(a[href^="/reels/"]) {
                display: none !important;
            }
            
            /* Hides the "Reels" button in the left sidebar menu */
            div:has(> a[href^="/reels/"]) {
                display: none !important;
            }
        `);
    }

    if (state.hideExplore) {
        activeCSSRules.push(`
            /* Hides the "Explore" button in the left sidebar menu */
            div:has(> a[href^="/explore/"]) {
                display: none !important;
            }
        `);
    }

    // 3. Inject the combined CSS
    styleBlock.textContent = activeCSSRules.join('\n\n');
    console.log("Instagram filters applied successfully!");
}

// 4. Run it on load
(async () => {
    const data = await browser.storage.local.get('contentFilters');

    extensionState.hideReels = data.contentFilters.hideInstagramReels;
    extensionState.hideExplore = data.contentFilters.hideInstagramExplore;

    applyInstagramFilters(extensionState);
})();