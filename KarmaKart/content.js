// This script runs in the context of web pages
// It communicates with the popup via message passing

// Main function to extract price from the current page
function findPriceOnPage() {
  // Check if we're on the Save the Children donation page, and if so, don't extract price
  if (window.location.href.includes('savethechildren.net/donate/donate-now-save-lives')) {
    return null;
  }

  // PRIORITY 1: Find bolded numbers with dollar signs
  const boldPriceResult = findBoldedPricesWithDollarSigns();
  if (boldPriceResult) {
    return cleanAndDeduplicatePrice(boldPriceResult);
  }
  
  // PRIORITY 2: Common price selectors and patterns to try
  const priceSelectors = [
    // Common checkout page selectors
    '.price', 
    '.total',
    '.subtotal',
    '.amount',
    '.checkout-price',
    '.cart-total',
    '#total',
    '#price',
    // Common price format patterns with currency symbols
    '[class*="price"]',
    '[class*="total"]',
    '[class*="amount"]',
    '[class*="cost"]',
    '[id*="price"]',
    '[id*="total"]',
    // More specific selectors
    '.cart__total',
    '.cart-subtotal',
    '.order-summary__total',
    '.payment-due__price',
    '.checkout-total',
    // Amazon specific selectors
    '.a-price',
    '.a-color-price',
    '[data-a-color="price"]'
  ];
  
  // Try each selector to find a price element
  const foundPrices = new Set();
  
  for (const selector of priceSelectors) {
    const elements = document.querySelectorAll(selector);
    for (const element of elements) {
      // Skip hidden elements
      if (window.getComputedStyle(element).display === 'none') {
        continue;
      }
      
      const text = element.textContent.trim();
      
      // Check if the text contains a currency symbol or looks like a price
      const priceRegex = /(?:[\$\£\€\¥]|USD|EUR|GBP|JPY|CAD|AUD)\s*\d+(?:[.,]\d{2})?|\d+(?:[.,]\d{2})?\s*(?:[\$\£\€\¥]|USD|EUR|GBP|JPY|CAD|AUD)/i;
      if (priceRegex.test(text)) {
        const cleanPrice = cleanAndDeduplicatePrice(text);
        if (cleanPrice) {
          foundPrices.add(cleanPrice);
        }
      }
    }
  }
  
  // If we found prices using selectors, return the most likely one
  if (foundPrices.size > 0) {
    return findMostLikelyPrice(Array.from(foundPrices));
  }
  
  // PRIORITY 3: If no price found using selectors, try a broader approach using regex
  const allText = document.body.textContent;
  const priceMatches = allText.match(/(?:[\$\£\€\¥]|USD|EUR|GBP|JPY|CAD|AUD)\s*\d+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?\s*(?:[\$\£\€\¥]|USD|EUR|GBP|JPY|CAD|AUD)/gi);
  
  if (priceMatches && priceMatches.length > 0) {
    // Deduplicate prices
    const uniquePrices = new Set();
    for (const match of priceMatches) {
      const cleanPrice = cleanAndDeduplicatePrice(match);
      if (cleanPrice) {
        uniquePrices.add(cleanPrice);
      }
    }
    
    // Convert back to array for processing
    const uniquePricesArray = Array.from(uniquePrices);
    
    // Return the most likely price
    return findMostLikelyPrice(uniquePricesArray);
  }
  
  // No price found
  return null;
}

// Function to clean and deduplicate price text
function cleanAndDeduplicatePrice(priceText) {
  if (!priceText) return null;
  
  // Remove duplicate price patterns (e.g., "$11.50$11.50")
  const cleanedText = priceText.trim();
  
  // Extract the currency symbol and number
  const match = cleanedText.match(/(?:([\$\£\€\¥]|USD|EUR|GBP|JPY|CAD|AUD)\s*(\d+(?:[.,]\d{1,2})?))|(?:(\d+(?:[.,]\d{1,2})?)\s*([\$\£\€\¥]|USD|EUR|GBP|JPY|CAD|AUD))/i);
  
  if (!match) return cleanedText;
  
  // Determine which capture group has our values
  let currencySymbol, amount;
  
  if (match[1] && match[2]) {
    // Currency before number (e.g., $11.50)
    currencySymbol = match[1];
    amount = match[2];
  } else if (match[3] && match[4]) {
    // Number before currency (e.g., 11.50$)
    currencySymbol = match[4];
    amount = match[3];
  }
  
  if (currencySymbol && amount) {
    // Check for duplicated prices (e.g., $11.50$11.50)
    const duplicatePattern = new RegExp(`${escapeRegExp(currencySymbol)}\\s*${escapeRegExp(amount)}.*${escapeRegExp(currencySymbol)}\\s*${escapeRegExp(amount)}`, 'i');
    
    if (duplicatePattern.test(cleanedText)) {
      // Return just one instance of the price
      return `${currencySymbol}${amount}`;
    }
    
    // Return the normalized price format
    return `${currencySymbol}${amount}`;
  }
  
  return cleanedText;
}

// Helper function to escape special regex characters
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Function to find the most likely price from an array of prices
function findMostLikelyPrice(prices) {
  if (!prices || prices.length === 0) return null;
  if (prices.length === 1) return prices[0];
  
  // 1. Check for prices near keywords like "total" or "checkout"
  for (const price of prices) {
    const nearbyText = findNearbyText(price);
    if (nearbyText.includes('total') || nearbyText.includes('checkout') || 
        nearbyText.includes('payment') || nearbyText.includes('order') ||
        nearbyText.includes('cart')) {
      return price;
    }
  }
  
  // 2. On e-commerce sites, find the most prominent price
  // Look for prices that are positioned prominently (higher up or more centrally)
  // For now, use a simpler heuristic: return the highest value price
  let highestPrice = 0;
  let highestPriceText = '';
  
  for (const priceText of prices) {
    // Extract just the number from the price
    const numMatch = priceText.match(/\d+(?:[.,]\d{1,2})?/);
    if (numMatch) {
      const price = parseFloat(numMatch[0].replace(',', '.'));
      if (price > highestPrice) {
        highestPrice = price;
        highestPriceText = priceText;
      }
    }
  }
  
  if (highestPriceText) {
    return highestPriceText;
  }
  
  // If all else fails, return the first price
  return prices[0];
}

// Helper function to find bolded prices with dollar signs
function findBoldedPricesWithDollarSigns() {
  // Elements that typically represent bold text
  const boldElements = document.querySelectorAll('b, strong, [style*="font-weight: bold"], [style*="font-weight:bold"]');
  
  // Regular expression to match prices with dollar signs
  const priceRegex = /\$\s*\d+(?:[.,]\d{1,3})?|\d+(?:[.,]\d{1,3})?\s*\$/;
  
  // Check each bold element
  for (const element of boldElements) {
    const text = element.textContent.trim();
    
    // Check if the bold text contains a price
    if (priceRegex.test(text)) {
      return text;
    }
    
    // Check if there's a dollar sign in or right next to the bold element
    if (text.includes('$') || 
        (element.previousSibling && element.previousSibling.textContent && element.previousSibling.textContent.trim().endsWith('$')) ||
        (element.nextSibling && element.nextSibling.textContent && element.nextSibling.textContent.trim().startsWith('$'))) {
      
      // If the bold element is just the number and the dollar sign is adjacent
      const combinedText = 
        (element.previousSibling ? element.previousSibling.textContent.trim() : '') + 
        text + 
        (element.nextSibling ? element.nextSibling.textContent.trim() : '');
      
      const match = combinedText.match(priceRegex);
      if (match) {
        return match[0];
      }
    }
  }
  
  // Also check for elements that may have inline CSS for bold font-weight
  const allElements = document.querySelectorAll('*');
  for (const element of allElements) {
    const style = window.getComputedStyle(element);
    if (style.fontWeight >= 600 || style.fontWeight === 'bold' || style.fontWeight === 'bolder') {
      const text = element.textContent.trim();
      
      // Check if this computed-bold text contains a price
      if (priceRegex.test(text)) {
        return text;
      }
      
      // Check surrounding content as above
      if (text.includes('$') || 
          (element.previousSibling && element.previousSibling.textContent && element.previousSibling.textContent.trim().endsWith('$')) ||
          (element.nextSibling && element.nextSibling.textContent && element.nextSibling.textContent.trim().startsWith('$'))) {
        
        const combinedText = 
          (element.previousSibling ? element.previousSibling.textContent.trim() : '') + 
          text + 
          (element.nextSibling ? element.nextSibling.textContent.trim() : '');
        
        const match = combinedText.match(priceRegex);
        if (match) {
          return match[0];
        }
      }
    }
  }
  
  return null;
}

// Helper function to find text near an element with the matching price
function findNearbyText(priceText) {
  // Find elements that contain this exact price text
  const elements = [];
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walk.nextNode())) {
    if (node.textContent.includes(priceText)) {
      elements.push(node.parentElement);
    }
  }
  
  // Get surrounding text for context
  for (const element of elements) {
    // Try to get parent elements that might contain context like "Total"
    let parent = element;
    for (let i = 0; i < 3; i++) {
      if (!parent) break;
      const text = parent.textContent.toLowerCase();
      if (text.includes('total') || text.includes('checkout') || 
          text.includes('payment') || text.includes('order') ||
          text.includes('cart')) {
        return text;
      }
      parent = parent.parentElement;
    }
  }
  
  return '';
}

// Listen for messages from the popup or background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'findPrice') {
    const price = findPriceOnPage();
    sendResponse({ price: price || 'No price found' });
  } else if (message.action === 'manualFillDonation') {
    autofillDonationAmount();
  }
  return true; // Keep the message channel open for async response
});

// Function to check if the page is a checkout page
function isCheckoutPage() {
  // Get all text on the page
  const pageText = document.body.textContent.toLowerCase();
  
  // Check for common checkout indicators
  const checkoutIndicators = [
    'checkout',
    'check out',
    'Checkout',
    'CHECKOUT'
  ];
  
  // Return true if any of the checkout indicators are found
  return checkoutIndicators.some(indicator => pageText.includes(indicator));
}

// Function to check if this is Save the Children donation page
function isSaveTheChildrenDonationPage() {
  return window.location.href.includes('savethechildren.net/donate/donate-now-save-lives');
}

// Function to autofill the donation amount on Save the Children website
function autofillDonationAmount() {
  if (isSaveTheChildrenDonationPage()) {
    // Get the stored price from chrome.storage
    chrome.storage.local.get(['detectedPrice'], function(result) {
      if (result.detectedPrice) {
        // Extract the numeric value from the price
        const priceMatch = result.detectedPrice.match(/(\d+(?:[.,]\d{1,2})?)/);
        
        if (priceMatch && priceMatch[1]) {
          // Convert the price to a number
          const numericPrice = parseFloat(priceMatch[1].replace(',', '.'));
          
          // Find the first input field that looks like it accepts monetary values
          const inputSelectors = [
            'input[type="text"]', 
            'input[type="number"]', 
            'input.donation-amount',
            'input[name*="amount"]',
            'input[name*="donation"]',
            'input[id*="amount"]',
            'input[id*="donation"]',
            'input[class*="amount"]',
            'input[class*="donation"]'
          ];
          
          // Try to find a suitable input field
          let foundInput = null;
          
          // First try specific selectors that are more likely to be donation amount fields
          for (const selector of inputSelectors) {
            const inputs = document.querySelectorAll(selector);
            for (const input of inputs) {
              // Skip hidden inputs
              if (input.type === 'hidden' || window.getComputedStyle(input).display === 'none') {
                continue;
              }
              
              // Check if the input is likely a donation amount field
              const inputId = (input.id || '').toLowerCase();
              const inputName = (input.name || '').toLowerCase();
              const inputClass = (input.className || '').toLowerCase();
              const inputPlaceholder = (input.placeholder || '').toLowerCase();
              
              if (inputId.includes('amount') || 
                  inputName.includes('amount') || 
                  inputClass.includes('amount') ||
                  inputId.includes('donation') || 
                  inputName.includes('donation') || 
                  inputClass.includes('donation') ||
                  inputPlaceholder.includes('amount') ||
                  inputPlaceholder.includes('donation')) {
                foundInput = input;
                break;
              }
            }
            if (foundInput) break;
          }
          
          // If we still haven't found a suitable input, try with the first visible input field
          if (!foundInput) {
            const allInputs = document.querySelectorAll('input[type="text"], input[type="number"]');
            for (const input of allInputs) {
              if (input.type !== 'hidden' && window.getComputedStyle(input).display !== 'none') {
                foundInput = input;
                break;
              }
            }
          }
          
          // If we found an input field, fill it with the numeric price
          if (foundInput) {
            foundInput.value = numericPrice.toString();
            
            // Trigger input and change events to ensure the site's JavaScript recognizes the change
            const inputEvent = new Event('input', { bubbles: true });
            const changeEvent = new Event('change', { bubbles: true });
            
            foundInput.dispatchEvent(inputEvent);
            foundInput.dispatchEvent(changeEvent);
            
            // Visual feedback (briefly highlight the field)
            const originalBg = foundInput.style.backgroundColor;
            const originalBorder = foundInput.style.border;
            
            foundInput.style.backgroundColor = '#ffff99';
            foundInput.style.border = '2px solid #ff0000';
            
            setTimeout(() => {
              foundInput.style.backgroundColor = originalBg;
              foundInput.style.border = originalBorder;
            }, 1500);
          }
        }
      }
    });
  }
}

// Automatically check if this is a checkout page with a price
function checkPageAndNotify() {
  // If this is Save the Children donation page, try to autofill without showing popup
  if (isSaveTheChildrenDonationPage()) {
    // Wait a bit for the page to fully render before attempting to autofill
    setTimeout(autofillDonationAmount, 1000);
    return; // Exit early to prevent popup from showing
  }
  
  // For other pages, proceed with normal price detection
  const isCheckout = isCheckoutPage();
  
  // If it's a checkout page, find the price
  if (isCheckout) {
    const price = findPriceOnPage();
    
    // If a price is found, send a message to open the popup
    if (price) {
      chrome.runtime.sendMessage({ 
        action: 'openPopup', 
        price: price,
        isCheckout: true
      });
    }
  }
}

// Wait for the page to fully load before checking
window.addEventListener('load', () => {
  // Give a small delay to ensure all dynamic content is loaded
  setTimeout(checkPageAndNotify, 1000);
});

// Listen for DOM changes that might indicate a single-page app navigation
const observer = new MutationObserver(() => {
  // Skip if we're on Save the Children site
  if (isSaveTheChildrenDonationPage()) return;
  
  // Debounce this to avoid excessive checks
  clearTimeout(window.checkTimeout);
  window.checkTimeout = setTimeout(checkPageAndNotify, 1000);
});

// Start observing changes to the body
observer.observe(document.body, { 
  childList: true, 
  subtree: true 
});

// Automatically find price when page loads (for popup communication)
// Except on Save the Children donation page
if (!isSaveTheChildrenDonationPage()) {
  const price = findPriceOnPage();
  if (price) {
    chrome.runtime.sendMessage({ action: 'priceFound', price: price });
  }
}