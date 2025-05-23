# KarmaKart
# Price Extractor Chrome Extension

A Chrome extension that detects prices on checkout pages and shows their impact in terms of children's vaccinations, encouraging charitable giving.

## Overview

When you're about to make a purchase online, this extension automatically detects the price and shows you how many children could be vaccinated against measles with that same amount of money. It provides a direct link to donate to Save the Children, making it easy to make a positive impact with your purchasing power.

## Features

- **Automatic Price Detection**: Scans checkout pages for prices using multiple detection methods
- **Impact Visualization**: Shows how many children could be vaccinated with the detected amount
- **Visual Interface**: Animated grid display with impact messaging
- **One-Click Donation**: Direct link to Save the Children donation page
- **Auto-fill Donation**: Automatically fills donation forms with the detected price amount
- **Context Menu**: Right-click option to manually fill donation forms

## Installation

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension folder
5. The extension icon will appear in your toolbar

## How It Works

1. **Price Detection**: The extension monitors web pages for checkout indicators and automatically extracts prices using:
   - Bold text with dollar signs (highest priority)
   - Common CSS selectors for prices and totals
   - Regex patterns for currency formats

2. **Impact Calculation**: Detected prices are multiplied by 0.8 to calculate how many children could be vaccinated

3. **User Interface**: A popup displays the impact message with an animated grid and donation button

4. **Donation Integration**: The extension can auto-fill donation amounts on Save the Children's website

## Beta Status ⚠️

This extension is currently in beta and has several limitations:

- **Single Image**: Uses placeholder images instead of actual children's photos
- **No Small Amount Filtering**: Doesn't distinguish between small everyday purchases and larger expenses
- **No Purchase Type Detection**: Treats all purchases equally (frivolous vs. necessary)
- **False Positives**: May detect prices on non-checkout pages or misidentify pricing elements
- **Limited Currency Support**: Primarily designed for USD with basic support for other currencies

## File Structure

```
├── manifest.json          # Extension configuration
├── popup.html             # Extension popup interface
├── popup.js               # Popup logic and price display
├── content.js             # Page content scanning and price detection
├── background.js          # Background service worker
└── images/                # Extension icons and assets
```

## Technical Implementation

### Price Detection Strategy

1. **Priority 1**: Bold elements containing dollar signs
2. **Priority 2**: Common price-related CSS selectors
3. **Priority 3**: Regex patterns across page content

### Key Components

- **Content Script**: Runs on all pages to detect checkout scenarios and extract prices
- **Background Script**: Handles inter-component communication and popup management
- **Popup Interface**: Displays impact visualization and donation options

## Permissions

- `activeTab`: Access current tab content for price detection
- `scripting`: Execute content scripts for price extraction
- `storage`: Store detected prices temporarily
- `contextMenus`: Add right-click donation options

## Privacy

This extension:
- Only processes data locally in your browser
- Does not send personal information to external servers
- Stores detected prices temporarily in local browser storage
- Only accesses page content when checking for prices


---

**Disclaimer**: This extension is not affiliated with Save the Children. Vaccination cost calculations are estimates for demonstration purposes.
