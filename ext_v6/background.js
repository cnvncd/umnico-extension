// background.js

const BASE_URL = "http://5.42.124.161/api";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "fetchData") {
    const { leadId, referer, saId } = message;
    const apiUrl = saId 
      ? `${BASE_URL}/browser-extension/${leadId}?sa_id=${saId}`
      : `${BASE_URL}/browser-extension/${leadId}`;

    fetch(apiUrl, {
      method: "GET",
      headers: { "X-Referer": referer }
    })
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then(data => sendResponse({ success: true, data }))
      .catch(error => sendResponse({ success: false, error: error.toString() }));

    return true;
  }
});
