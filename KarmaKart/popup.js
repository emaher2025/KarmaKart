// This script runs when the popup is opened
document.addEventListener('DOMContentLoaded', function() {
  // Get references to the DOM elements
  const impactDisplay = document.getElementById('impact-display');
  const imageGrid = document.querySelectorAll('.grid-image');
  
  // Animate images fading in one by one
  animateImages();
  
  // Check if there's a recently detected price in storage
  checkStoredPrice();
  
  // Function to animate images fading in one by one
  function animateImages() {
    imageGrid.forEach((img, index) => {
      // Add animation with sequential delay - slower animation and longer delay
      img.style.animation = `fadeIn 0.8s forwards`; // Slowed from 0.5s to 0.8s
      img.style.animationDelay = `${index * 0.08}s`; // Increased from 0.05s to 0.08s delay between images
    });
  }
  
  // Function to check for stored price from auto-detection
  function checkStoredPrice() {
    chrome.storage.local.get(['detectedPrice', 'lastDetectionTime'], function(result) {
      // Check if we have a recent price detection (within the last 10 seconds)
      if (result.detectedPrice && result.lastDetectionTime) {
        const currentTime = Date.now();
        const timeSinceDetection = currentTime - result.lastDetectionTime;
        
        // If the price was detected in the last 10 seconds, use it
        if (timeSinceDetection < 10000) {
          displayImpact(result.detectedPrice);
          return;
        }
      }
      
      // If no recent stored price, scan the page
      scanForPrice();
    });
  }
  
  // Function to calculate and display the impact message and show Google link
  function displayImpact(price) {
    if (!price || price === 'No price found' || price === 'Error scanning page' || price === 'Scanning page...') {
      // Update the impact display with a message
      impactDisplay.innerHTML = price;
      return;
    }
    
    // Extract the numeric value from the price
    const priceMatch = price.match(/(\d+(?:[.,]\d{1,2})?)/);
    
    if (priceMatch && priceMatch[1]) {
      // Convert the price to a number
      const numericPrice = parseFloat(priceMatch[1].replace(',', '.'));
      
      // Calculate the impact (price * 0.8)
      const impactValue = (numericPrice * 0.8).toFixed(0);
      
      // Create a more compact impact message with highlighted parts
      const impactMessage = `<span class="highlight">YOU</span> can vaccinate <span class="highlight">${impactValue}</span> children against measles with that money`;
      
      // Update the impact display with highlighted text
      impactDisplay.innerHTML = impactMessage;
    } else {
      // If we couldn't parse the price
      impactDisplay.textContent = 'Could not calculate impact';
    }
  }
  
  // Function to scan the active tab for price information
  async function scanForPrice() {
    // Reset display while scanning
    impactDisplay.textContent = 'Scanning page...';
    
    try {
      // Get the active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Execute the content script on the active tab
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: extractPriceFromPage
      });
      
      // Get the result from the first script execution (should only be one)
      const price = results[0].result;
      
      // Display the extracted price or a message if no price was found
      if (price) {
        displayImpact(price);
        
        // Store the detected price
        chrome.storage.local.set({
          detectedPrice: price,
          lastDetectionTime: Date.now()
        });
      } else {
        displayImpact('No price found');
      }
    } catch (error) {
      displayImpact('Error scanning page');
      console.error('Error:', error);
    }
  }
  
  // Function that will be injected into the page to extract price
  function extractPriceFromPage() {
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
  }
});