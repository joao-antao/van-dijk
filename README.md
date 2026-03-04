# Van Dijk Ad Blocker

A lightweight, open-source ad blocker extension for Firefox. Van Dijk blocks ads at both the network and DOM levels for comprehensive protection.

## Features

- **Network-level blocking**: Intercepts and blocks ad requests before they load
- **DOM-level blocking**: Removes ad elements that slip through network filters
- **Smart ad detection**: Detects sponsored content badges and removes parent containers
- **Blocking method breakdown**: Track Network vs DOM-level blocks separately
- **Recent blocks viewer**: See exactly what URLs and elements were blocked in real-time
- **Real-time statistics**: Track blocked ads per session and total
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
- Blocks requests matching known ad domains (Set-based O(1) lookup)
- Blocks requests matching URL patterns (substring and regex)
- Caches tab hostnames to reduce API calls
- Batches storage writes every 5 seconds for performance
- Maintains statistics on blocked requests

### DOM Blocking (content.js)
- Runs on every page load with pre-computed CSS selectors
- Removes ad elements using two-tier approach:
  - `AD_SELECTORS`: Generic patterns requiring validation (iframes, ad containers)
  - `AD_MARKERS`: Explicit indicators removed immediately (data-promoted, data-is-advertising)
- Smart badge detection: Finds "Sponsored"/"Promoted" labels and removes parent post containers
- Uses MutationObserver to catch dynamically loaded ads (debounced 100ms)
- Special handling for Reddit promoted posts

### User Interface (popup.html/js/css)
- Shows session and total blocked ad counts
- Displays per-site blocking statistics
- Shows Network (N) and DOM (D) block counts for each site
- **Recent Blocks list**: View the last 10 blocked requests/elements with:
  - Site where the block occurred
  - Block type (Network or DOM)
  - Actual URL or element that was blocked
  - Color-coded by method (red for Network, teal for DOM)
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
- Add domains to `AD_DOMAINS` Set for exact hostname matches (e.g., `'doubleclick.net'`)
- Add substrings to `AD_SUBSTRINGS` array for partial matches (e.g., `'adserver'`)
- Add regex patterns to `AD_PATTERNS` array for complex URL patterns (e.g., `/\/ads\//i`)

**DOM-level blocking** (edit `content.js`):
- Add generic CSS selectors to `AD_SELECTORS` array (e.g., `'[id*="ad-"]'`)
  - These require validation (visibility/text content checks)
- Add explicit ad indicators to `AD_MARKERS` object:
  - `tags`: HTML tag names that are always ads (e.g., `'SHREDDIT-AD-POST'`)
  - `attributes`: Attributes whose presence indicates ads (e.g., `'data-promoted'`)
  - `attributeValues`: Attribute-value pairs for precise matching (e.g., `{'data-type': 'ad'}`)
  - These are removed immediately without additional validation

## Contributing

Contributions are welcome! Please feel free to submit pull requests or open issues.

## Roadmap

- [x] Per-site statistics breakdown
- [x] Network vs DOM blocking indicators
- [ ] Per-site enable/disable toggle
- [ ] Custom filter lists support
- [ ] Import/export settings
- [ ] Whitelist management
- [ ] Site-specific blocking rules
- [ ] Advanced statistics dashboard with charts
- [ ] Export blocked request logs
- [ ] Firefox Add-ons store submission

## Credits

**Built with AI assistance** - This extension was developed with the help of GitHub Copilot and AI coding agents, demonstrating the potential of AI-assisted software development.

Named after Virgil van Dijk, the legendary defensive football player.