# Van Dijk Ad Blocker

A lightweight, open-source ad blocker extension for Firefox. Van Dijk blocks ads at both the network and DOM levels for comprehensive protection.

## Features

- **Network-level blocking**: Intercepts and blocks ad and tracker requests before they load
- **DOM-level blocking**: Removes ad and tracker elements that slip through network filters
- **Smart ad detection**: Detects sponsored content badges and removes parent containers
- **Separate ads and trackers**: Track and display ads vs trackers independently
- **Social media tracking protection**: Blocks Facebook Pixel, Twitter analytics, LinkedIn Insights, TikTok Pixel, Pinterest tracking, and Reddit tracking
- **Cryptominer protection**: Blocks cryptocurrency mining scripts (Coinhive, CryptoLoot, JSEcoin, and 20+ others)
- **Recent blocks viewer**: See exactly what URLs and elements were blocked in real-time
- **Real-time statistics**: Track blocked ads and trackers per session and total
- **Lightweight**: Minimal performance impact
- **Privacy-focused**: No data collection or external connections

## Installation

### From Source (Development)

1. Clone or download this repository:
   ```bash
   cd van-dijk
   ```

2. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`

3. Click "Load Temporary Add-on"

4. Navigate to the project directory and select `manifest.json`

## Project Structure

```
van-dijk/
├── manifest.json       # Extension configuration
├── background.js       # Network request blocking logic
├── content.js          # DOM manipulation and ad removal
├── popup.html          # Extension popup UI
├── popup.css           # Popup styling
├── popup.js            # Popup interaction logic
├── icons/              # Extension icons
└── LICENSE             # License file
```

## How It Works

### Network Blocking (background.js)
- Uses `webRequest` API to intercept network requests
- **Separate ad and tracker blocking**:
  - `AD_DOMAINS`, `AD_SUBSTRINGS`, `AD_PATTERNS`: Block advertising content
  - `TRACKER_DOMAINS`, `TRACKER_SUBSTRINGS`, `TRACKER_PATTERNS`: Block analytics and tracking
- Set-based O(1) domain lookups for performance
- Categorizes each block as "ad" or "tracker"
- Caches tab hostnames to reduce API calls
- Batches storage writes every 5 seconds for performance
- Maintains separate statistics for ads and trackers

### DOM Blocking (content.js)
- Runs on every page load with pre-computed CSS selectors
- **Separate ad and tracker removal**:
  - `AD_SELECTORS` + `AD_MARKERS`: Generic and explicit advertising indicators
  - `TRACKER_SELECTORS` + `TRACKER_MARKERS`: Analytics scripts, tracking pixels, beacons
- Two-tier approach for each category:
  - Generic selectors require validation (visibility, text content)
  - Explicit markers removed immediately (data attributes, specific tags)
- Smart badge detection: Finds "Sponsored"/"Promoted" labels and removes parent post containers
- Uses MutationObserver to catch dynamically loaded content (debounced 100ms)
- Reports blocks separately by category (ad vs tracker)

### User Interface (popup.html/js/css)
- Shows session and total blocked counts (overall, ads, and trackers)
- Displays per-site blocking statistics with separate ad/tracker counts
- **Recent Blocks list**: View the last 10 blocked requests/elements with:
  - Site where the block occurred
  - Block category (Ad or Tracker)
  - Actual URL or element that was blocked
  - Color-coded by category (red for ads, orange for trackers)
- Allows resetting session statistics
- Clean, modern gradient design with smooth scrolling

## Development

### Building
No build step required - the extension runs directly from source files.

### Testing
1. Load the extension in Firefox (see Installation)
2. Visit ad-heavy websites to test blocking
3. Check browser console for `[Van Dijk]` log messages
4. Open the popup to view statistics

### Adding New Block Rules

**Network-level blocking** (edit `background.js`):

*For Ads:*
- Add domains to `AD_DOMAINS` Set for exact hostname matches (e.g., `'doubleclick.net'`)
- Add substrings to `AD_SUBSTRINGS` array for partial matches (e.g., `'adserver'`)
- Add regex patterns to `AD_PATTERNS` array for complex URL patterns (e.g., `/\/ads\//i`)

*For Trackers:*
- Add domains to `TRACKER_DOMAINS` Set (e.g., `'google-analytics.com'`)
- Add substrings to `TRACKER_SUBSTRINGS` array (e.g., `'analytics'`)
- Add regex patterns to `TRACKER_PATTERNS` array (e.g., `/\/tracking/i`)

**DOM-level blocking** (edit `content.js`):

*For Ads:*
- Add generic CSS selectors to `AD_SELECTORS` array (e.g., `'[id*="ad-"]'`)
  - These require validation (visibility/text content checks)
- Add explicit ad indicators to `AD_MARKERS` object:
  - `tags`: HTML tag names that are always ads (e.g., `'SHREDDIT-AD-POST'`)
  - `attributes`: Attributes whose presence indicates ads (e.g., `'data-promoted'`)
  - `attributeValues`: Attribute-value pairs for precise matching (e.g., `{'data-type': 'ad'}`)
  - These are removed immediately without additional validation

*For Trackers:*
- Add selectors to `TRACKER_SELECTORS` array (e.g., `'script[src*="analytics"]'`)
- Add explicit tracker indicators to `TRACKER_MARKERS` object (same structure as `AD_MARKERS`)

## Contributing

Contributions are welcome! Please feel free to submit pull requests or open issues.

## Roadmap

- [x] Per-site statistics breakdown
- [x] Separate ads vs trackers tracking
- [ ] Per-site enable/disable toggle
- [ ] Toggle ads/trackers blocking independently
- [ ] Custom filter lists support
- [ ] Import/export settings
- [ ] Whitelist management
- [ ] Site-specific blocking rules
- [ ] Advanced statistics dashboard with charts
- [ ] Export blocked request logs

## Credits

**Built with AI assistance** - This extension was developed with the help of GitHub Copilot and AI coding agents, demonstrating the potential of AI-assisted software development.

Named after Virgil van Dijk, the legendary defensive football player.