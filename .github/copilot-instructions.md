# Copilot Instructions for Van Dijk Ad Blocker

## Project Overview
Van Dijk is a browser extension that blocks ads and trackers using a two-tier approach:
1. **Network-level blocking** (`background.js`) - intercepts requests via `webRequest` API
2. **DOM-level blocking** (`content.js`) - removes ad/tracker elements from the page

Ads and trackers are tracked and displayed separately throughout the extension.

## Architecture

### Core Components
- **manifest.json**: Manifest v2 configuration with `webRequest`, `webRequestBlocking`, and storage permissions
- **background.js**: Background script running persistent logic for network interception
- **content.js**: Content script injected into all pages at `document_start` with `all_frames: true`
- **popup.html/js/css**: Browser action popup showing statistics

### Data Flow
1. Network request → `background.js` checks URL against ad/tracker lists:
   - **Ads**: `AD_DOMAINS`, `AD_SUBSTRINGS`, `AD_PATTERNS`
   - **Trackers**: `TRACKER_DOMAINS`, `TRACKER_SUBSTRINGS`, `TRACKER_PATTERNS` (includes social media tracking: Facebook Pixel, Twitter analytics, LinkedIn Insights, TikTok Pixel, Pinterest, Reddit)
   - Categorize as "ad" or "tracker" → cancel if match
2. Page load → `content.js` queries DOM using two-tier approach for both categories:
   - **AD_MARKERS/TRACKER_MARKERS**: Explicit indicators → remove immediately
   - **AD_SELECTORS/TRACKER_SELECTORS**: Generic patterns → validate then remove (includes social media tracking scripts and pixels)
3. Badge detection → Find "Sponsored"/"Promoted" text → remove parent container
4. MutationObserver in `content.js` watches for dynamically added content
5. Stats tracked separately by category (ads vs trackers) and stored in `browser.storage.local`
6. Popup displays separate counters for ads and trackers

## Development Workflows

### Testing the Extension
```bash
# No build step required - load directly in Firefox
```
1. Navigate to `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on" → select `manifest.json`
3. Test on ad-heavy sites, check browser console for `[Van Dijk]` logs

### Adding Block Rules

**Network-level blocking in `background.js`:**
- **Ads**: Add to `AD_DOMAINS` Set, `AD_SUBSTRINGS` array, or `AD_PATTERNS` array
- **Trackers**: Add to `TRACKER_DOMAINS` Set, `TRACKER_SUBSTRINGS` array, or `TRACKER_PATTERNS` array
- Use Sets for O(1) domain lookups
- Substrings checked against hostname and full URL
- Regex patterns checked last (most expensive)

**DOM-level blocking in `content.js`:**
- **Ad elements**: Add to `AD_SELECTORS` (validated) or `AD_MARKERS` (immediate removal)
- **Tracker elements**: Add to `TRACKER_SELECTORS` (validated) or `TRACKER_MARKERS` (immediate removal)
- `AD_MARKERS`/`TRACKER_MARKERS` structure:
  - `tags`: HTML tag names (e.g., `'SHREDDIT-AD-POST'`)
  - `attributes`: Presence-based attributes (e.g., `'data-promoted'`)
  - `attributeValues`: Key-value pairs (e.g., `{'data-type': 'ad'}`)
- Badge detection automatically handles "Sponsored"/"Promoted" text

## Key Conventions

### Logging
All console logs use `[Van Dijk]` prefix for easy filtering

### Browser API Usage
- Use `browser.*` namespace (WebExtensions standard), not `chrome.*`
- Always use Promises with `browser.runtime.sendMessage()`, not callbacks
- Stats persistence: batched writes every 5 seconds using `scheduleStatsSave()`
- Tab hostname caching via `Map` to avoid redundant `browser.tabs.get()` calls
- Stats structure separates ads and trackers:
  - `stats.ads.session`/`stats.ads.total`
  - `stats.trackers.session`/`stats.trackers.total`
  - `stats.blockedBySite[site].ads`/`stats.blockedBySite[site].trackers`
  - `recentBlocks` includes `category` field ('ad' or 'tracker')
- `recentBlocks` array: Limited to 50 items (FIFO), includes timestamp and count for batch DOM blocks

### Content Script Patterns
- Wrap in IIFE: `(function() { 'use strict'; ... })()`
- Use `try-catch` around `querySelectorAll` to handle invalid selectors
- Check `offsetHeight > 0` to avoid removing hidden legitimate elements
- Debounce DOM queries (100ms) and reporting (2s) to reduce performance impact
- Combine selectors into single `querySelectorAll()` for efficiency
- Check MutationObserver for addedNodes before processing
- **Separate ad and tracker handling**:
  - Maintain separate counts: `adsRemovedCount`, `trackersRemovedCount`
  - Report with category: `domBlockReport` includes `category` field
  - Separate removal functions: `removeAds()` and `removeTrackers()`
- **Two-tier DOM blocking** (applies to both ads and trackers):
  - `AD_MARKERS`/`TRACKER_MARKERS`: Explicit indicators removed immediately
  - `AD_SELECTORS`/`TRACKER_SELECTORS`: Generic patterns validated before removal
- **Badge detection**: Automatically searches for "Sponsored"/"Promoted" badges and removes containing post/article elements

### Performance Optimizations
- **background.js**: Use `Set` for O(1) domain lookups; cache tab hostnames; batch storage writes; categorize blocks efficiently
- **content.js**: Debounce ad/tracker removal separately; combine selectors; only process relevant mutations; separate counters
- **popup.js**: Hash-based change detection (includes ad/tracker counts); DocumentFragment for DOM updates; reduced polling (3s)

## Firefox-Specific Details
- Manifest v2 (not v3) for full `webRequestBlocking` support
- `browser_specific_settings.gecko` required for extension ID and min version
- Icons referenced must exist or extension load fails (`icons/icon.svg` currently exists)

## Next Development Tasks
See README.md roadmap: icon creation, per-site toggles, custom filter lists, whitelist UI

---
_Last updated: 2026-03-04_
