import "../mock-preview.js";
import "../../vendor/browser-polyfill.min.js";
import { StorageService } from "../../storage/storageService.js";


// Toggle Elements
const toggleReels = document.getElementById('toggleReels');
const toggleExplore = document.getElementById('toggleExplore');
const toggleStories = document.getElementById('toggleStories');

(async () => {
    const filters = await StorageService.getContentFilters();

    toggleReels.checked = filters.hideInstagramReels;
    toggleExplore.checked = filters.hideInstagramExplore;
    toggleStories.checked = filters.hideInstagramStories;
    console.log(filters);  
})();


async function reloadDomain(domain) {
    const tabs = await browser.tabs.query({});

    for (const tab of tabs) {
        try {
            const url = new URL(tab.url);

            if (url.hostname === domain || url.hostname.endsWith('.' + domain)) {
                await browser.tabs.reload(tab.id);
            }

        } catch (e) {
            // Ignore chrome:// or invalid URLs
        }
    }
}


// Send Message 
// Hide Reels
toggleReels.addEventListener('change', async (e) => {
    const value = e.target.checked;

    const response = await browser.runtime.sendMessage({
        type: 'INSTAGRAM_TOGGLE_REELS',
        payload: value
    });

    console.log('SW response:', response);

    reloadDomain('instagram.com');
});

toggleFeed.addEventListener('change', (e) => {
    console.log('Hide Feed:', e.target.checked);
});


// Hide Explore Tab
toggleExplore.addEventListener('change', async (e) => {
    const value = e.target.checked;

    const response = await browser.runtime.sendMessage({
        type: 'INSTAGRAM_TOGGLE_EXPLORE',
        payload: value
    });

    reloadDomain('instagram.com');

    console.log('Hide Explore:', e.target.checked);
});

// Hide Stories
toggleStories.addEventListener('change', async (e) => {
    const value = e.target.checked;

    const response = await browser.runtime.sendMessage({
        type: 'INSTAGRAM_TOGGLE_STORIES',
        payload: value
    });

    reloadDomain('instagram.com');

    console.log('Hide Stories:', e.target.checked);
});
