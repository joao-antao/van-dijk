// Van Dijk Ad Blocker - Background Script
// Handles network request blocking and rule management

// Common ad domains and patterns (using Set for O(1) lookup)
const AD_DOMAINS = new Set([
  'doubleclick.net',
  'googleadservices.com',
  'googlesyndication.com',
  'adservice.google.com',
  'advertising.com',
  'adbrite.com',
  'adbureau.net',
  'indexexchange.com',
  'adform.com',
  'seedtag.com',
  'lijit.com',
  'onetag.com',
  'xandr.com',
  'smartadserver.com',
  'openx.com',
  'adyoulike.com',
  'sharethrough.com',
  'admob.com'
]);

// Substring patterns for hostname matching
const AD_SUBSTRINGS = ['adsense', 'adserver', 'analytics', 'track', 'telemetry', 'doubleclick', 'promoted'];

// URL patterns to block
const AD_PATTERNS = [
  /\/ads?\//i,
  /\/ad[sv]ertis/i,
  /\/banner/i,
  /\/sponsor/i,
  /\/tracking/i,
  /\/analytics/i,
  /\.doubleclick\./i,
  /googlesyndication/i,
  /googleadservices/i,
  /promoted/i,
  /utm_source=ads/i,
  /\/promoted-/i,
  /[?&]promoted=/i
];

// Statistics
let stats = {
  totalBlocked: 0,
  sessionBlocked: 0,
  enabledSites: {},
  blockedBySite: {},
  recentBlocks: []
};

// Performance: Batch storage writes
let statsChanged = false;
let saveTimer = null;

function scheduleStatsSave() {
  statsChanged = true;
  if (!saveTimer) {
    saveTimer = setTimeout(() => {
      if (statsChanged) {
        browser.storage.local.set({ stats });
        statsChanged = false;
      }
      saveTimer = null;
    }, 5000); // Save every 5 seconds max
  }
}

// Tab hostname cache to avoid repeated lookups
const tabHostnameCache = new Map();

// Load stats from storage
browser.storage.local.get(['stats']).then((result) => {
  if (result.stats) {
    stats = Object.assign({}, stats, result.stats);
    // Ensure new properties exist
    if (!stats.blockedBySite) stats.blockedBySite = {};
    if (!stats.recentBlocks) stats.recentBlocks = [];
  }
  console.log('[Van Dijk] Stats loaded:', stats);
});

// Check if URL should be blocked (optimized)
function shouldBlockUrl(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    
    // Fast Set lookup for exact domain matches
    if (AD_DOMAINS.has(hostname)) {
      return true;
    }
    
    // Check if any ad domain is in hostname
    for (const domain of AD_DOMAINS) {
      if (hostname.includes(domain)) {
        return true;
      }
    }
    
    // Check substring patterns
    for (const substring of AD_SUBSTRINGS) {
      if (hostname.includes(substring) || url.includes(substring)) {
        return true;
      }
    }
    
    // Check URL patterns (regex is slower, check last)
    for (const pattern of AD_PATTERNS) {
      if (pattern.test(url)) {
        return true;
      }
    }
  } catch (e) {
    // Invalid URL
    return false;
  }
  
  return false;
}

// Block network requests
browser.webRequest.onBeforeRequest.addListener(
  (details) => {
    // Check if blocking is enabled for this tab
    const tabId = details.tabId;
    
    if (shouldBlockUrl(details.url)) {
      stats.totalBlocked++;
      stats.sessionBlocked++;
      
      // Track by site (do this async, don't block the request)
      if (tabId >= 0) {
        // Check cache first
        const cachedHostname = tabHostnameCache.get(tabId);
        if (cachedHostname) {
          updateSiteStats(cachedHostname, details.url);
        } else {
          browser.tabs.get(tabId).then((tab) => {
            try {
              const siteUrl = new URL(tab.url);
              const site = siteUrl.hostname;
              tabHostnameCache.set(tabId, site);
              updateSiteStats(site, details.url);
            } catch (e) {
              console.error('[Van Dijk] Error tracking block:', e);
            }
          }).catch(() => {});
        }
      }
      
      return { cancel: true };
    }
    
    return { cancel: false };
  },
  {
    urls: ["<all_urls>"],
    types: [
      "script",
      "image",
      "stylesheet",
      "sub_frame",
      "xmlhttprequest",
      "media",
      "other"
    ]
  },
  ["blocking"]
);

// Helper function to update site statistics
function updateSiteStats(site, url) {
  if (!stats.blockedBySite[site]) {
    stats.blockedBySite[site] = { network: 0, dom: 0 };
  }
  stats.blockedBySite[site].network++;
  
  // Add to recent blocks (limited to 50)
  if (stats.recentBlocks.length >= 50) {
    stats.recentBlocks.pop();
  }
  stats.recentBlocks.unshift({
    site: site,
    url: url,
    method: 'Network',
    time: Date.now()
  });
  
  scheduleStatsSave();
}

// Clear cache when tab is closed or updated
browser.tabs.onRemoved.addListener((tabId) => {
  tabHostnameCache.delete(tabId);
});

browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url) {
    tabHostnameCache.delete(tabId);
  }
});

// Handle messages from popup and content scripts
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getStats') {
    sendResponse(stats);
  } else if (message.action === 'resetStats') {
    stats.sessionBlocked = 0;
    stats.blockedBySite = {};
    stats.recentBlocks = [];
    browser.storage.local.set({ stats });
    sendResponse({ success: true });
  } else if (message.action === 'domBlockReport') {
    // Content script reporting DOM removals
    const { site, count } = message;
    if (!stats.blockedBySite[site]) {
      stats.blockedBySite[site] = { network: 0, dom: 0 };
    }
    stats.blockedBySite[site].dom += count;
    stats.totalBlocked += count;
    stats.sessionBlocked += count;
    
    // Add single entry for batch of DOM blocks (optimized)
    if (stats.recentBlocks.length >= 50) {
      stats.recentBlocks.pop();
    }
    stats.recentBlocks.unshift({
      site: site,
      url: site,
      method: 'DOM',
      count: count,
      time: Date.now()
    });
    
    scheduleStatsSave();
    sendResponse({ success: true });
  }
  return true;
});

// Reset session stats on browser startup
browser.runtime.onStartup.addListener(() => {
  stats.sessionBlocked = 0;
  stats.blockedBySite = {};
  stats.recentBlocks = [];
  browser.storage.local.set({ stats });
});

console.log('[Van Dijk] Ad Blocker initialized');
