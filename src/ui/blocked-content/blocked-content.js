const params = new URLSearchParams(window.location.search);
const label = params.get("label");
const platform = params.get("platform");
const message = params.get("message");
const surfaceText = document.getElementById("surfaceText");

if (surfaceText) {
  if (message) {
    surfaceText.textContent = message;
  } else if (label && platform) {
    surfaceText.textContent = `${label} on ${platform} is blocked here.`;
  } else if (label) {
    surfaceText.textContent = `${label} is blocked here.`;
  }
}

document.getElementById("goBackButton")?.addEventListener("click", () => {
  window.history.back();
});
