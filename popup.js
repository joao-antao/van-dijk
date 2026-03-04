// van-dijk Ad Blocker - Popup Script
// Handles the popup UI and user interactions

let lastStatsHash = '';

// Generate hash of stats to detect changes
function getStatsHash(stats) {
  return `${stats.sessionBlocked}-${stats.totalBlocked}-${Object.keys(stats.blockedBySite || {}).length}-${(stats.recentBlocks || []).length}`;
}

// Update statistics display (optimized)
function updateStats() {
  browser.runtime.sendMessage({ action: 'getStats' })
    .then(stats => {
      const currentHash = getStatsHash(stats);
      
      // Only update if stats actually changed
      if (currentHash === lastStatsHash) {
        return;
      }
      lastStatsHash = currentHash;
      
      // Update counters
      document.getElementById('sessionBlocked').textContent = stats.sessionBlocked.toLocaleString();
      document.getElementById('totalBlocked').textContent = stats.totalBlocked.toLocaleString();
      
      // Update site list
      const siteList = document.getElementById('siteList');
      const sites = stats.blockedBySite || {};
      const siteEntries = Object.entries(sites);
      
      if (siteEntries.length === 0) {
        siteList.innerHTML = '<p class="no-data">No sites visited yet</p>';
      } else {
        // Sort by total blocks (network + dom)
        siteEntries.sort((a, b) => {
          const totalA = a[1].network + a[1].dom;
          const totalB = b[1].network + b[1].dom;
          return totalB - totalA;
        });
        
        // Use DocumentFragment for better performance
        const fragment = document.createDocumentFragment();
        siteEntries.forEach(([site, counts]) => {
          const div = document.createElement('div');
          div.className = 'site-item';
          div.innerHTML = `
            <span class="site-name" title="${site}">${site}</span>
            <div class="site-stats">
              <span class="stat-badge" title="Network blocks">N: ${counts.network}</span>
              <span class="stat-badge" title="DOM blocks">D: ${counts.dom}</span>
            </div>
          `;
          fragment.appendChild(div);
        });
        
        siteList.innerHTML = '';
        siteList.appendChild(fragment);
      }
      
      // Update recent blocks list
      const recentBlocksList = document.getElementById('recentBlocksList');
      const recentBlocks = stats.recentBlocks || [];
      
      if (recentBlocks.length === 0) {
        recentBlocksList.innerHTML = '<p class="no-data">No blocks yet</p>';
      } else {
        const blocksFragment = document.createDocumentFragment();
        
        // Show up to 10 most recent blocks
        recentBlocks.slice(0, 10).forEach(block => {
          const div = document.createElement('div');
          const method = block.method.toLowerCase();
          const displayUrl = block.url.length > 80 ? block.url.substring(0, 80) + '...' : block.url;
          const count = block.count ? ` (${block.count}x)` : '';
          
          div.className = `block-item ${method}`;
          div.innerHTML = `
            <div class="block-header">
              <span class="block-site">${block.site}</span>
              <span class="block-type ${method}">${method}${count}</span>
            </div>
            <div class="block-url" title="${block.url}">${displayUrl}</div>
          `;
          blocksFragment.appendChild(div);
        });
        
        recentBlocksList.innerHTML = '';
        recentBlocksList.appendChild(blocksFragment);
      }
    })
    .catch(err => {
      console.error('[Van Dijk] Failed to get stats:', err);
    });
}

// Reset session statistics
document.getElementById('resetBtn').addEventListener('click', () => {
  browser.runtime.sendMessage({ action: 'resetStats' })
    .then(() => {
      updateStats();
    })
    .catch(err => {
      console.error('[Van Dijk] Failed to reset stats:', err);
    });
});

// Initial stats load
updateStats();

// Update stats every 3 seconds while popup is open
const updateInterval = setInterval(updateStats, 3000);

// Clean up interval when popup closes
window.addEventListener('unload', () => {
  clearInterval(updateInterval);
});
