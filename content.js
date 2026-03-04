// Van Dijk Ad Blocker - Content Script
// Removes ad elements from the DOM that slip through network blocking

(function() {
  'use strict';
  
  // ====================
  // AD SELECTORS
  // ====================
  
  // Selectors for common ad elements (generic patterns that need validation)
  const AD_SELECTORS = [
    '[id*="ad-"]',
    '[id*="ads-"]',
    '[id*="google_ads"]',
    '[class*="advertisement"]',
    '[class*="ad-container"]',
    '[class*="ad-wrapper"]',
    'iframe[src*="doubleclick"]',
    'iframe[src*="googlesyndication"]',
    'div[id^="div-gpt-ad"]',
    '.adsbygoogle',
    '#ad-banner',
    '.ad-slot'
  ];
  
  // Ad markers - explicit tags and attributes indicating advertising content
  // These are removed immediately without additional validation
  const AD_MARKERS = {
    tags: ['SHREDDIT-AD-POST'],
    attributes: ['data-promoted', 'data-is-advertising', 'data-adclassname'],
    attributeValues: { 'data-type': 'ad' }
  };
  
  // ====================
  // TRACKER SELECTORS
  // ====================
  
  // Selectors for tracking elements
  const TRACKER_SELECTORS = [
    // General analytics
    'script[src*="google-analytics"]',
    'script[src*="googletagmanager"]',
    'script[src*="analytics.js"]',
    'script[src*="ga.js"]',
    'img[src*="/track"]',
    'img[src*="/pixel"]',
    'img[src*="/beacon"]',
    'iframe[src*="analytics"]',
    '[class*="tracking"]',
    '[id*="tracking"]',
    // Social media tracking
    'script[src*="connect.facebook.net"]',
    'script[src*="fbevents"]',
    'script[src*="analytics.twitter.com"]',
    'script[src*="static.ads-twitter.com"]',
    'script[src*="analytics.tiktok.com"]',
    'script[src*="ct.pinterest.com"]',
    'script[src*="snap.licdn.com"]',
    'script[src*="events.reddit.com"]',
    'img[src*="facebook.com/tr"]',
    'img[src*="t.co/i/adsct"]',
    'iframe[src*="facebook.com/plugins"]',
    'iframe[src*="platform.twitter.com"]',
    '[id*="fb-root"]',
    '[id*="twitter-widget"]',
    // Cryptominers
    'script[src*="coinhive"]',
    'script[src*="coin-hive"]',
    'script[src*="jsecoin"]',
    'script[src*="crypto-loot"]',
    'script[src*="cryptoloot"]',
    'script[src*="webminepool"]',
    'script[src*="monerominer"]',
    'script[src*="minero.cc"]',
    'script[src*="authedmine"]',
    'script[src*="miner.js"]',
    'script[src*="webminer"]',
    'script[src*="minr.pw"]',
    'script[src*="minero"]',
    'script[src*="cryptonight"]'
  ];
  
  // Tracker markers - explicit indicators of tracking scripts/pixels
  const TRACKER_MARKERS = {
    tags: [],
    attributes: ['data-tracking', 'data-analytics'],
    attributeValues: { 'data-type': 'tracking' }
  };
  
  // Pre-compute marker selectors and combined selectors for performance
  const AD_MARKER_SELECTORS = [
    ...AD_MARKERS.tags.map(tag => tag.toLowerCase()),
    ...AD_MARKERS.attributes.map(attr => `[${attr}]`),
    ...Object.entries(AD_MARKERS.attributeValues).map(([attr, value]) => `[${attr}="${value}"]`)
  ];
  
  const TRACKER_MARKER_SELECTORS = [
    ...TRACKER_MARKERS.tags.map(tag => tag.toLowerCase()),
    ...TRACKER_MARKERS.attributes.map(attr => `[${attr}]`),
    ...Object.entries(TRACKER_MARKERS.attributeValues).map(([attr, value]) => `[${attr}="${value}"]`)
  ];
  
  const AD_COMBINED_SELECTOR = [...AD_SELECTORS, ...AD_MARKER_SELECTORS].join(', ');
  const TRACKER_COMBINED_SELECTOR = [...TRACKER_SELECTORS, ...TRACKER_MARKER_SELECTORS].join(', ');
  
  const AD_MARKER_ATTRIBUTE_ENTRIES = Object.entries(AD_MARKERS.attributeValues);
  const TRACKER_MARKER_ATTRIBUTE_ENTRIES = Object.entries(TRACKER_MARKERS.attributeValues);
  
  let adsRemovedCount = 0;
  let trackersRemovedCount = 0;
  let adRemovalTimer = null;
  let trackerRemovalTimer = null;
  
  // Remove ad elements from the DOM (optimized and generic)
  function removeAds() {
    let removed = 0;
    
    try {
      const elements = document.querySelectorAll(AD_COMBINED_SELECTOR);
      
      elements.forEach(el => {
        // Skip if already being removed
        if (!el.parentNode) return;
        
        // 1. Remove iframes immediately (always ads)
        if (el.tagName === 'IFRAME') {
          el.remove();
          removed++;
          return;
        }
        
        // 2. Remove elements with explicit ad attributes/tags
        if (AD_MARKERS.tags.includes(el.tagName) ||
            AD_MARKERS.attributes.some(attr => el.hasAttribute(attr)) ||
            AD_MARKER_ATTRIBUTE_ENTRIES.some(([attr, value]) => el.getAttribute(attr) === value)) {
          el.remove();
          removed++;
          return;
        }
        
        // 3. Check for "sponsored" or "promoted" badges in small elements
        // These are typically labels, not content
        if (el.offsetHeight > 0 && el.offsetHeight < 100) {
          const text = el.textContent.trim().toLowerCase();
          if (text === 'sponsored' || text === 'promoted') {
            // Find and remove the parent post/article container
            const container = el.closest('article, [role="article"], div[data-testid*="post"], shreddit-post, .post');
            if (container && container.parentNode) {
              container.remove();
              removed++;
              return;
            }
          }
        }
        
        // 4. For generic ad selectors, check visibility and text
        if (el.offsetHeight > 0) {
          const text = el.textContent.toLowerCase();
          // Only match "advertisement" (very specific)
          if (text.includes('advertisement')) {
            el.remove();
            removed++;
          }
        }
      });
      
      adsRemovedCount += removed;
    } catch (e) {
      console.debug('[Van Dijk] Ad selector error:', e);
    }
  }
  
  // Remove tracker elements from the DOM
  function removeTrackers() {
    let removed = 0;
    
    try {
      const elements = document.querySelectorAll(TRACKER_COMBINED_SELECTOR);
      
      elements.forEach(el => {
        // Skip if already being removed
        if (!el.parentNode) return;
        
        // 1. Remove tracking scripts/iframes immediately
        if (el.tagName === 'SCRIPT' || el.tagName === 'IFRAME') {
          el.remove();
          removed++;
          return;
        }
        
        // 2. Remove tracking pixels (1x1 images)
        if (el.tagName === 'IMG') {
          if (el.width <= 1 && el.height <= 1) {
            el.remove();
            removed++;
            return;
          }
        }
        
        // 3. Remove elements with explicit tracker attributes
        if (TRACKER_MARKERS.attributes.some(attr => el.hasAttribute(attr)) ||
            TRACKER_MARKER_ATTRIBUTE_ENTRIES.some(([attr, value]) => el.getAttribute(attr) === value)) {
          el.remove();
          removed++;
          return;
        }
      });
      
      trackersRemovedCount += removed;
    } catch (e) {
      console.debug('[Van Dijk] Tracker selector error:', e);
    }
  }
  
  // Debounced ad removal to avoid excessive calls
  function scheduleAdRemoval() {
    if (adRemovalTimer) return;
    
    adRemovalTimer = setTimeout(() => {
      removeAds();
      adRemovalTimer = null;
    }, 100);
  }
  
  // Debounced tracker removal to avoid excessive calls
  function scheduleTrackerRemoval() {
    if (trackerRemovalTimer) return;
    
    trackerRemovalTimer = setTimeout(() => {
      removeTrackers();
      trackerRemovalTimer = null;
    }, 100);
  }
  
  // Report DOM blocks to background
  function reportBlocks() {
    const hostname = window.location.hostname;
    
    // Report ads
    if (adsRemovedCount > 0) {
      try {
        browser.runtime.sendMessage({
          action: 'domBlockReport',
          site: hostname,
          count: adsRemovedCount,
          category: 'ad'
        }).catch(() => {});
        adsRemovedCount = 0;
      } catch (e) {
        console.error('[Van Dijk] Error reporting ad blocks:', e);
        adsRemovedCount = 0;
      }
    }
    
    // Report trackers
    if (trackersRemovedCount > 0) {
      try {
        browser.runtime.sendMessage({
          action: 'domBlockReport',
          site: hostname,
          count: trackersRemovedCount,
          category: 'tracker'
        }).catch(() => {});
        trackersRemovedCount = 0;
      } catch (e) {
        console.error('[Van Dijk] Error reporting tracker blocks:', e);
        trackersRemovedCount = 0;
      }
    }
  }
  
  // Initial removal
  removeAds();
  removeTrackers();
  reportBlocks();
  
  // Watch for dynamically added ads (optimized)
  let reportTimer;
  const observer = new MutationObserver((mutations) => {
    // Only process if mutations added nodes
    const hasAddedNodes = mutations.some(mutation => 
      mutation.addedNodes && mutation.addedNodes.length > 0
    );
    
    if (hasAddedNodes) {
      scheduleAdRemoval();
      scheduleTrackerRemoval();
      
      // Debounce reporting to avoid too many messages
      clearTimeout(reportTimer);
      reportTimer = setTimeout(reportBlocks, 2000);
    }
  });
  
  // Start observing when DOM is ready
  if (document.body) {
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    });
  }
  
  console.log('[Van Dijk] Content script loaded');
})();
