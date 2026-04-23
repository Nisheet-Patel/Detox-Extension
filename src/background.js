import "./vendor/browser-polyfill.min.js";

console.log("Background service worker loaded");

browser.runtime.onInstalled.addListener(() => {
  console.log("Hello World from background!");

});
