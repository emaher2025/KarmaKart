// This script runs in the background and handles events
// for the Chrome extension

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Check if the sender is from Save the Children website
  const isSaveTheChildrenSite = sender.tab && 
                               sender.tab.url && 
                               sender.tab.url.includes('savethechildren.net/donate/donate-now-save-lives');
  
  // Handle messages requesting to open the popup (but not on Save the Children site)
  if (message.action === 'openPopup' && message.isCheckout && message.price && !isSaveTheChildrenSite) {
    // Store the price in local storage so popup can retrieve it
    chrome.storage.local.set({ 
      detectedPrice: message.price,
      lastDetectionTime: Date.now() 
    });
    
    // Open the popup programmatically
    chrome.action.openPopup();
  }
  
  // Handle price found messages for regular popup operation (always store the price)
  if (message.action === 'priceFound') {
    // Store the price in local storage so popup can retrieve it
    chrome.storage.local.set({ 
      detectedPrice: message.price,
      lastDetectionTime: Date.now() 
    });
  }
});

// Initialize or reset when the extension is installed or updated
chrome.runtime.onInstalled.addListener(() => {
  // Clear any stored prices
  chrome.storage.local.set({ 
    detectedPrice: null,
    lastDetectionTime: null
  });

  // Add context menu for manually filling in price
  chrome.contextMenus.create({
    id: "fillDonationForm",
    title: "Fill donation form with last price",
    contexts: ["page"]
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "fillDonationForm") {
    chrome.tabs.sendMessage(tab.id, { action: "manualFillDonation" });
  }
});