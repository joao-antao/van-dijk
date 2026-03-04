# Copilot Instructions for Van Dijk Ad Blocker

## Project Overview
Van Dijk is a browser extension that blocks ads using a two-tier approach:
1. **Network-level blocking** (`background.js`) - intercepts requests via `webRequest` API
2. **DOM-level blocking** (`content.js`) - removes ad elements from the page

## Architecture

### Core Components
- **manifest.json**: Manifest v2 configuration with `webRequest`, `webRequestBlocking`, and storage permissions
- **background.js**: Background script running persistent logic for network interception
- **content.js**: Content script injected into all pages at `document_start` with `all_frames: true`
- **popup.html/js/css**: Browser action popup showing statistics

### Data Flow
1. Network request → `background.js` checks URL against `AD_DOMAINS`/`AD_PATTERNS` → cancel if match
2. Page load → `content.js` queries DOM using two-tier approach:
   - **AD_MARKERS**: Explicit ad indicators (data-promoted, SHREDDIT-AD-POST) → remove immediately
   - **AD_SELECTORS**: Generic patterns (iframe[src*="ads"]) → validate then remove
3. Badge detection → Find "Sponsored"/"Promoted" text → remove parent container
4. MutationObserver in `content.js` watches for dynamically added ads
5. Stats (including recentBlocks) stored in `browser.storage.local` and displayed in popup

## Development Workflows

### Testing the Extension
```bash
# No build step required - load directly in Firefox
```
1. Navigate to `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on" → select `manifest.json`
3. Test on ad-heavy sites, check browser console for `[Van Dijk]` logs

### Adding Block Rules
- **Domain blocking**: Add to `AD_DOMAINS` Set in `background.js`
- **Substring patterns**: Add to `AD_SUBSTRINGS` array in `background.js`
- **Pattern blocking**: Add regex to `AD_PATTERNS` in `background.js`
- **Generic element blocking**: Add CSS selector to `AD_SELECTORS` in `content.js` (requires validation)
- **Explicit ad markers**: Add to `AD_MARKERS` object in `content.js`:
  - `tags`: HTML tag names always indicating ads (e.g., `'SHREDDIT-AD-POST'`)
  - `attributes`: Attributes whose presence indicates ads (e.g., `'data-promoted'`)
  - `attributeValues`: Key-value pairs for precise matching (e.g., `{'data-type': 'ad'}`)
- **Badge detection**: The existing pattern automatically finds "Sponsored"/"Promoted" text and removes parent containers

## Key Conventions

### Logging
All console logs use `[Van Dijk]` prefix for easy filtering

### Browser API Usage
- Use `browser.*` namespace (WebExtensions standard), not `chrome.*`
- Always use Promises with `browser.runtime.sendMessage()`, not callbacks
- Stats persistence: batched writes every 5 seconds using `scheduleStatsSave()`
- Tab hostname caching via `Map` to avoid redundant `browser.tabs.get()` calls
- `recentBlocks` array: Limited to 50 items (FIFO), includes timestamp and count for batch DOM blocks

### Content Script Patterns
- Wrap in IIFE: `(function() { 'use strict'; ... })()`
- Use `try-catch` around `querySelectorAll` to handle invalid selectors
- Check `offsetHeight > 0` to avoid removing hidden legitimate elements
- Debounce DOM queries (100ms) and reporting (2s) to reduce performance impact
- Combine selectors into single `querySelectorAll()` for efficiency
- Check MutationObserver for addedNodes before processing
- **Two-tier DOM blocking**:
  - `AD_MARKERS`: Explicit indicators removed immediately without validation
  - `AD_SELECTORS`: Generic patterns validated (visibility, text checks) before removal
- **Badge detection**: Automatically searches for "Sponsored"/"Promoted" badges and removes containing post/article elements
- **Attribute checking**: Use `AD_MARKERS.attributes`/`attributeValues` for data-attributes indicating ads

### Performance Optimizations
- **background.js**: Use `Set` for O(1) domain lookups; cache tab hostnames; batch storage writes
- **content.js**: Debounce ad removal; combine selectors; only process relevant mutations
- **popup.js**: Hash-based change detection; DocumentFragment for DOM updates; reduced polling (3s)

## Firefox-Specific Details
- Manifest v2 (not v3) for full `webRequestBlocking` support
- `browser_specific_settings.gecko` required for extension ID and min version
- Icons referenced must exist or extension load fails (`icons/icon.svg` currently exists)

## Next Development Tasks
See README.md roadmap: icon creation, per-site toggles, custom filter lists, whitelist UI

---
_Last updated: 2026-03-04_
