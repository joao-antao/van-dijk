// Van Dijk Ad Blocker - Background Script
// Handles network request blocking and rule management

// ====================
// AD BLOCKING RULES
// ====================

// Common ad domains (using Set for O(1) lookup)
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

// Ad-related substring patterns
const AD_SUBSTRINGS = ['adsense', 'adserver', 'doubleclick', 'promoted', 'banner', 'sponsor'];

// Ad URL patterns
const AD_PATTERNS = [
  /\/ads?\//i,
  /\/ad[sv]ertis/i,
  /\/banner/i,
  /\/sponsor/i,
  /\.doubleclick\./i,
  /googlesyndication/i,
  /googleadservices/i,
  /promoted/i,
  /utm_source=ads/i,
  /\/promoted-/i,
  /[?&]promoted=/i
];

// ====================
// TRACKER BLOCKING RULES
// ====================

// Common tracking domains
const TRACKER_DOMAINS = new Set([
  // Analytics platforms
  'google-analytics.com',
  'googletagmanager.com',
  'google-analytics.bi',
  'hotjar.com',
  'mouseflow.com',
  'luckyorange.com',
  'mixpanel.com',
  'segment.com',
  'amplitude.com',
  'fullstory.com',
  'loggly.com',
  'bugsnag.com',
  'sentry.io',
  'newrelic.com',
  'quantserve.com',
  'scorecardresearch.com',
  'chartbeat.com',
  'crazyegg.com',
  'kissmetrics.com',
  'heap.io',
  // Social media trackers
  'connect.facebook.net',
  'analytics.facebook.com',
  'pixel.facebook.com',
  'an.facebook.com',
  'analytics.twitter.com',
  'static.ads-twitter.com',
  'analytics.tiktok.com',
  'ads.tiktok.com',
  'analytics.pinterest.com',
  'ct.pinterest.com',
  'log.pinterest.com',
  'trk.pinterest.com',
  'ads.pinterest.com',
  'snap.licdn.com',
  'px.ads.linkedin.com',
  'analytics.pointdrive.linkedin.com',
  'alb.reddit.com',
  'events.reddit.com',
  'redditmedia.com',
  'i.instagram.com'
]);

// Tracker-related substring patterns
const TRACKER_SUBSTRINGS = ['analytics', 'track', 'telemetry', 'beacon', 'pixel', 'collect', 'fbevents', 'fbq'];

// Tracker URL patterns
const TRACKER_PATTERNS = [
  /\/tracking/i,
  /\/analytics/i,
  /\/telemetry/i,
  /\/collect\?/i,
  /\/beacon/i,
  /\/pixel\./i,
  /google-analytics/i,
  /googletagmanager/i,
  /[?&]utm_/i,
  // Social media tracking patterns
  /facebook\.com\/tr\//i,
  /\/fbevents/i,
  /\/fbq/i,
  /twitter\.com\/i\/adsct/i,
  /analytics\.tiktok/i,
  /\/events\.reddit/i,
  /linkedin\.com\/px\//i,
  /pinterest\.com\/ct\//i,
  /\/conversion/i
];

// Statistics
let stats = {
  ads: {
    total: 0,
    session: 0
  },
  trackers: {
    total: 0,
    session: 0
  },
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
    if (!stats.ads) stats.ads = { total: 0, session: 0 };
    if (!stats.trackers) stats.trackers = { total: 0, session: 0 };
    if (!stats.blockedBySite) stats.blockedBySite = {};
    if (!stats.recentBlocks) stats.recentBlocks = [];
  }
  console.log('[Van Dijk] Stats loaded:', stats);
});

// Check if URL is an ad (returns true if ad detected)
function isAdUrl(url, hostname) {
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
  
  return false;
}

// Check if URL is a tracker (returns true if tracker detected)
function isTrackerUrl(url, hostname) {
  // Fast Set lookup for exact domain matches
  if (TRACKER_DOMAINS.has(hostname)) {
    return true;
  }
  
  // Check if any tracker domain is in hostname
  for (const domain of TRACKER_DOMAINS) {
    if (hostname.includes(domain)) {
      return true;
    }
  }
  
  // Check substring patterns
  for (const substring of TRACKER_SUBSTRINGS) {
    if (hostname.includes(substring) || url.includes(substring)) {
      return true;
    }
  }
  
  // Check URL patterns (regex is slower, check last)
  for (const pattern of TRACKER_PATTERNS) {
    if (pattern.test(url)) {
      return true;
    }
  }
  
  return false;
}

// Categorize and check if URL should be blocked (returns category or null)
function categorizeBlockedUrl(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    
    // Check ads first (more specific)
    if (isAdUrl(url, hostname)) {
      return 'ad';
    }
    
    // Then check trackers
    if (isTrackerUrl(url, hostname)) {
      return 'tracker';
    }
  } catch (e) {
    // Invalid URL
    return null;
  }
  
  return null;
}

// Block network requests
browser.webRequest.onBeforeRequest.addListener(
  (details) => {
    // Check if blocking is enabled for this tab
    const tabId = details.tabId;
    
    const category = categorizeBlockedUrl(details.url);
    if (category) {
      // Update category-specific stats
      if (category === 'ad') {
        stats.ads.total++;
        stats.ads.session++;
      } else if (category === 'tracker') {
        stats.trackers.total++;
        stats.trackers.session++;
      }
      
      // Update total stats
      stats.totalBlocked++;
      stats.sessionBlocked++;
      
      // Track by site (do this async, don't block the request)
      if (tabId >= 0) {
        // Check cache first
        const cachedHostname = tabHostnameCache.get(tabId);
        if (cachedHostname) {
          updateSiteStats(cachedHostname, details.url, category);
        } else {
          browser.tabs.get(tabId).then((tab) => {
            try {
              const siteUrl = new URL(tab.url);
              const site = siteUrl.hostname;
              tabHostnameCache.set(tabId, site);
              updateSiteStats(site, details.url, category);
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
function updateSiteStats(site, url, category) {
  if (!stats.blockedBySite[site]) {
    stats.blockedBySite[site] = { ads: 0, trackers: 0 };
  }
  
  // Update category count
  if (category === 'ad') {
    stats.blockedBySite[site].ads++;
  } else if (category === 'tracker') {
    stats.blockedBySite[site].trackers++;
  }
  
  // Add to recent blocks (limited to 50)
  if (stats.recentBlocks.length >= 50) {
    stats.recentBlocks.pop();
  }
  stats.recentBlocks.unshift({
    site: site,
    url: url,
    category: category,
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
    stats.ads.session = 0;
    stats.trackers.session = 0;
    stats.sessionBlocked = 0;
    stats.blockedBySite = {};
    stats.recentBlocks = [];
    browser.storage.local.set({ stats });
    sendResponse({ success: true });
  } else if (message.action === 'domBlockReport') {
    // Content script reporting DOM removals
    const { site, count, category } = message;
    
    if (!stats.blockedBySite[site]) {
      stats.blockedBySite[site] = { ads: 0, trackers: 0 };
    }
    
    // Update category-specific stats
    if (category === 'ad') {
      stats.blockedBySite[site].ads += count;
      stats.ads.total += count;
      stats.ads.session += count;
    } else if (category === 'tracker') {
      stats.blockedBySite[site].trackers += count;
      stats.trackers.total += count;
      stats.trackers.session += count;
    }
    
    // Update total stats
    stats.totalBlocked += count;
    stats.sessionBlocked += count;
    
    // Add single entry for batch of DOM blocks (optimized)
    if (stats.recentBlocks.length >= 50) {
      stats.recentBlocks.pop();
    }
    stats.recentBlocks.unshift({
      site: site,
      url: `${count} ${category}${count > 1 ? 's' : ''}`,
      category: category,
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
  stats.ads.session = 0;
  stats.trackers.session = 0;
  stats.sessionBlocked = 0;
  stats.blockedBySite = {};
  stats.recentBlocks = [];
  browser.storage.local.set({ stats });
});

console.log('[Van Dijk] Ad Blocker initialized');
