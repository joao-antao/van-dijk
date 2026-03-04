// Van Dijk Ad Blocker - Content Script
// Removes ad elements from the DOM that slip through network blocking

(function() {
  'use strict';
  
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
  
  // Pre-compute marker selectors and combined selector for performance
  const MARKER_SELECTORS = [
    ...AD_MARKERS.tags.map(tag => tag.toLowerCase()),
    ...AD_MARKERS.attributes.map(attr => `[${attr}]`),
    ...Object.entries(AD_MARKERS.attributeValues).map(([attr, value]) => `[${attr}="${value}"]`)
  ];
  const COMBINED_SELECTOR = [...AD_SELECTORS, ...MARKER_SELECTORS].join(', ');
  const MARKER_ATTRIBUTE_ENTRIES = Object.entries(AD_MARKERS.attributeValues);
  
  let removedCount = 0;
  let adRemovalTimer = null;
  
  // Remove ad elements from the DOM (optimized and generic)
  function removeAds() {
    let removed = 0;
    
    try {
      const elements = document.querySelectorAll(COMBINED_SELECTOR);
      
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
            MARKER_ATTRIBUTE_ENTRIES.some(([attr, value]) => el.getAttribute(attr) === value)) {
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
      
      removedCount += removed;
    } catch (e) {
      console.debug('[Van Dijk] Selector error:', e);
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
  
  // Report DOM blocks to background
  function reportBlocks() {
    if (removedCount > 0) {
      try {
        const hostname = window.location.hostname;
        browser.runtime.sendMessage({
          action: 'domBlockReport',
          site: hostname,
          count: removedCount
        }).catch(() => {});
        removedCount = 0;
      } catch (e) {
        console.error('[Van Dijk] Error reporting blocks:', e);
        removedCount = 0; // Reset count even on error
      }
    }
  }
  
  // Initial removal
  removeAds();
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
