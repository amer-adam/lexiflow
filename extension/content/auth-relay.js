// Runs only on the LexiFlow web app origin. Listens for the access token
// posted by ExtensionAuthView (frontend/src/views/ExtensionAuthView.tsx) and
// forwards it to the background worker — the only bridge between the app's
// Auth0 session and the extension, since the extension can't run its own
// Auth0 redirect flow from a chrome-extension:// origin.
window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  if (event.data?.type !== "LEXIFLOW_EXT_TOKEN" || !event.data.token) return;
  chrome.runtime.sendMessage({ type: "SET_TOKEN", token: event.data.token });
});
