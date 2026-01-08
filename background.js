// Background service worker for script injection

console.log('Site Launcher background service worker loaded');

// Track previous URLs for navigation detection
const tabPreviousUrls = new Map();
// Track if page was refreshed (navigation type)
const tabNavigationTypes = new Map();
// Track previous URL for the current navigation (before it gets updated)
const tabNavigationPreviousUrls = new Map();

// Show confirm popup and wait for user response
async function showConfirmPopup(tabId, scriptName) {
    return new Promise((resolve) => {
        const popupId = `confirm_popup_${Date.now()}`;
        const resultKey = `confirm_result_${popupId}`;
        
        // Inject popup script
        chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: (popupId, resultKey, scriptName) => {
                // Create popup overlay
                const overlay = document.createElement('div');
                overlay.id = popupId;
                overlay.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.5);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 999999;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                `;
                
                // Create popup modal
                const modal = document.createElement('div');
                modal.style.cssText = `
                    background: white;
                    border-radius: 12px;
                    padding: 24px;
                    max-width: 400px;
                    width: 90%;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
                `;
                
                modal.innerHTML = `
                    <h3 style="margin: 0 0 16px 0; font-size: 18px; color: #333; font-weight: 600;">Confirm Script Execution</h3>
                    <p style="margin: 0 0 20px 0; font-size: 14px; color: #666; line-height: 1.5;">
                        Script "<strong>${scriptName.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</strong>" is about to execute.
                    </p>
                    <div style="display: flex; gap: 10px; justify-content: flex-end;">
                        <button id="${popupId}_cancel" style="
                            padding: 10px 20px;
                            background: #f0f0f0;
                            color: #333;
                            border: none;
                            border-radius: 6px;
                            cursor: pointer;
                            font-size: 14px;
                            font-weight: 500;
                        ">Cancel (Esc)</button>
                        <button id="${popupId}_confirm" style="
                            padding: 10px 20px;
                            background: #667eea;
                            color: white;
                            border: none;
                            border-radius: 6px;
                            cursor: pointer;
                            font-size: 14px;
                            font-weight: 500;
                        ">Confirm (Enter)</button>
                    </div>
                `;
                
                overlay.appendChild(modal);
                document.body.appendChild(overlay);
                
                // Focus the confirm button
                const confirmBtn = document.getElementById(`${popupId}_confirm`);
                confirmBtn.focus();
                
                // Store result in a hidden input that we can poll
                const resultInput = document.createElement('input');
                resultInput.type = 'hidden';
                resultInput.id = resultKey;
                document.body.appendChild(resultInput);
                
                // Handle button clicks
                const handleConfirm = () => {
                    resultInput.value = 'confirmed';
                    overlay.remove();
                };
                
                const handleCancel = () => {
                    resultInput.value = 'cancelled';
                    overlay.remove();
                };
                
                confirmBtn.addEventListener('click', handleConfirm);
                document.getElementById(`${popupId}_cancel`).addEventListener('click', handleCancel);
                
                // Handle keyboard
                const handleKeyDown = (e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.altKey) {
                        e.preventDefault();
                        handleConfirm();
                    } else if (e.key === 'Escape') {
                        e.preventDefault();
                        handleCancel();
                    }
                };
                
                document.addEventListener('keydown', handleKeyDown);
                
                // Clean up listener when popup is removed
                const observer = new MutationObserver((mutations) => {
                    if (!document.body.contains(overlay)) {
                        document.removeEventListener('keydown', handleKeyDown);
                        observer.disconnect();
                    }
                });
                observer.observe(document.body, { childList: true });
            },
            args: [popupId, resultKey, scriptName],
            world: 'MAIN'
        }).catch(err => {
            console.error('Error showing confirm popup:', err);
            resolve(false);
        });
        
        // Poll for response by checking the hidden input
        const checkResponse = async () => {
            try {
                // First check if tab still exists
                try {
                    await chrome.tabs.get(tabId);
                } catch (tabError) {
                    // Tab doesn't exist anymore, resolve as cancelled
                    resolve(false);
                    return;
                }
                
                const results = await chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    func: (resultKey) => {
                        const input = document.getElementById(resultKey);
                        return input ? input.value : null;
                    },
                    args: [resultKey],
                    world: 'MAIN'
                });
                
                if (results && results[0] && results[0].result) {
                    const value = results[0].result;
                    // Clean up the hidden input
                    chrome.scripting.executeScript({
                        target: { tabId: tabId },
                        func: (resultKey) => {
                            const input = document.getElementById(resultKey);
                            if (input) input.remove();
                        },
                        args: [resultKey],
                        world: 'MAIN'
                    }).catch(() => {});
                    resolve(value === 'confirmed');
                } else {
                    setTimeout(checkResponse, 100);
                }
            } catch (error) {
                // Check if error is about tab not existing
                if (error.message && error.message.includes('No tab with id')) {
                    // Tab was closed, resolve as cancelled silently
                    resolve(false);
                } else {
                    // Other error, log it but still resolve as cancelled
                    console.error('Error checking popup response:', error);
                    resolve(false);
                }
            }
        };
        
        // Start checking after a short delay
        setTimeout(checkResponse, 100);
        
        // Timeout after 30 seconds
        setTimeout(() => {
            checkResponse().then(result => {
                if (result === undefined) {
                    resolve(false);
                }
            });
        }, 30000);
    });
}

// Helper function to execute a script with given timing
function executeScriptWithTiming(tabId, code, timing) {
    if (timing === 'document_start') {
        // Inject immediately
        chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: (code) => {
                try {
                    const script = document.createElement('script');
                    script.textContent = code;
                    (document.head || document.documentElement).appendChild(script);
                    script.remove();
                } catch (error) {
                    console.error('Error executing script:', error);
                }
            },
            args: [code],
            world: 'MAIN'
        }).catch(err => {
            console.error('Error injecting script (document_start):', err);
        });
    } else if (timing === 'document_end') {
        // Wait for DOMContentLoaded, then add a small delay for dynamic content
        chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: (code) => {
                const execute = () => {
                    // Add a small delay to allow dynamic content to load
                    setTimeout(() => {
                        try {
                            const script = document.createElement('script');
                            script.textContent = code;
                            (document.head || document.documentElement).appendChild(script);
                            script.remove();
                        } catch (error) {
                            console.error('Error executing script:', error);
                        }
                    }, 200); // 200ms delay to allow dynamic content to load
                };
                
                if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', execute);
                } else {
                    execute();
                }
            },
            args: [code],
            world: 'MAIN'
        }).catch(err => {
            console.error('Error injecting script (document_end):', err);
        });
    } else if (timing === 'document_idle') {
        // Wait for window load, then add a small delay to ensure dynamic content is loaded
        chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: (code) => {
                const execute = () => {
                    // Add a small delay to ensure all dynamic content is loaded
                    setTimeout(() => {
                        try {
                            const script = document.createElement('script');
                            script.textContent = code;
                            (document.head || document.documentElement).appendChild(script);
                            script.remove();
                        } catch (error) {
                            console.error('Error executing script:', error);
                        }
                    }, 100); // 100ms delay to allow dynamic content to load
                };
                
                if (document.readyState === 'complete') {
                    execute();
                } else {
                    window.addEventListener('load', execute);
                }
            },
            args: [code],
            world: 'MAIN'
        }).catch(err => {
            console.error('Error injecting script (document_idle):', err);
        });
    }
}

// Check if URL matches a wildcard pattern
// Supports patterns like "*.example.com", "auth.example.com", "some.example.com/auth/login", "some*.example.com"
// Can match against hostname only or full URL (hostname + path)
function matchesPattern(url, pattern) {
    try {
        // Check if pattern contains a path (contains / after domain part)
        const hasPath = pattern.includes('/');
        
        let urlToMatch;
        if (hasPath) {
            // If pattern has a path, match against full URL (hostname + pathname)
            try {
                const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
                urlToMatch = urlObj.hostname + urlObj.pathname;
            } catch (e) {
                // If URL parsing fails, try to extract hostname and path manually
                const match = url.match(/^(?:https?:\/\/)?([^\/]+)(\/.*)?$/);
                if (match) {
                    urlToMatch = match[1] + (match[2] || '');
                } else {
                    urlToMatch = url;
                }
            }
        } else {
            // If pattern has no path, match against hostname only
            try {
                const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
                urlToMatch = urlObj.hostname;
            } catch (e) {
                // If URL parsing fails, extract hostname manually
                const match = url.match(/^(?:https?:\/\/)?([^\/]+)/);
                urlToMatch = match ? match[1] : url;
            }
        }
        
        // Convert pattern to regex:
        // 1. Replace * with a placeholder first (to avoid escaping issues)
        // 2. Escape all special regex characters
        // 3. Replace placeholder with .* (regex for any characters)
        const placeholder = '___WILDCARD_PLACEHOLDER___';
        const patternWithPlaceholder = pattern.replace(/\*/g, placeholder);
        
        // Escape special regex characters
        const escapedPattern = patternWithPlaceholder
            .replace(/[.+?^${}()|[\]\\]/g, '\\$&');
        
        // Replace placeholder with .* (regex wildcard)
        const regexPattern = escapedPattern.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '.*');
        
        const regex = new RegExp(`^${regexPattern}$`);
        return regex.test(urlToMatch);
    } catch (e) {
        console.error('Invalid pattern:', pattern, e);
        return false;
    }
}

// Get hostname from URL for pattern matching
function getHostname(url) {
    try {
        return new URL(url).hostname;
    } catch (e) {
        return '';
    }
}

// Get full URL path (hostname + pathname) for pattern matching
function getUrlPath(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname + urlObj.pathname;
    } catch (e) {
        // Fallback: try to extract manually
        const match = url.match(/^(?:https?:\/\/)?([^\/]+)(\/.*)?$/);
        if (match) {
            return match[1] + (match[2] || '');
        }
        return url;
    }
}

// Listen for tab updates
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    // Handle URL changes (for navigating_out trigger and tracking)
    if (changeInfo.url && tab.url) {
        const currentUrl = tab.url;
        const currentHostname = getHostname(currentUrl);
        const previousUrl = tabPreviousUrls.get(tabId);
        const previousHostname = previousUrl ? getHostname(previousUrl) : null;
        
        // Store the previous URL for this navigation (before updating)
        // This will be used in the complete handler for "navigating_in_from" checks
        if (previousUrl) {
            tabNavigationPreviousUrls.set(tabId, previousUrl);
        }
        
        // Detect if this is a refresh (same URL)
        const isRefresh = previousUrl === currentUrl;
        if (isRefresh) {
            tabNavigationTypes.set(tabId, 'refresh');
        } else if (previousHostname && previousHostname !== currentHostname) {
            tabNavigationTypes.set(tabId, 'navigation');
        } else {
            tabNavigationTypes.set(tabId, 'direct');
        }
        
        // If we're navigating away from a domain, check for navigating_out scripts
        if (previousHostname && previousHostname !== currentHostname) {
            try {
                const result = await chrome.storage.local.get(['globalScripts']);
                const globalScripts = result.globalScripts || [];
                
                // Check for scripts that should run on navigating out
                for (const globalScript of globalScripts) {
                    if (globalScript.whenToRun !== 'navigating_out') {
                        continue;
                    }
                    
                    // Check if previous hostname matches the pattern
                    const patternHasPath = globalScript.domainPattern.includes('/');
                    const urlToMatch = patternHasPath ? getUrlPath(previousUrl) : previousHostname;
                    if (!matchesPattern(urlToMatch, globalScript.domainPattern)) {
                        continue;
                    }
                    
                    // Skip if onRefresh is enabled (navigating_out shouldn't run on refresh)
                    if (globalScript.onRefresh) {
                        continue;
                    }
                    
                    // Execute scripts
                    if (globalScript.scripts && globalScript.scripts.length > 0) {
                        // Check if confirm popup is enabled
                        if (globalScript.confirmPopup) {
                            // Show confirm popup and wait for user response
                            const confirmed = await showConfirmPopup(tabId, globalScript.name);
                            if (!confirmed) {
                                continue; // User cancelled, skip script execution
                            }
                        }
                        
                        for (const scriptCode of globalScript.scripts) {
                            executeScriptWithTiming(tabId, scriptCode.code, scriptCode.timing);
                        }
                    }
                }
            } catch (error) {
                console.error('Error handling navigating_out scripts:', error);
            }
        }
        
        // Update previous URL
        tabPreviousUrls.set(tabId, currentUrl);
    }
    
    // Only proceed when page is fully loaded
    if (changeInfo.status !== 'complete' || !tab.url) {
        return;
    }
    
    // Skip chrome:// and extension pages
    if (tab.url.startsWith('chrome://') || 
        tab.url.startsWith('chrome-extension://') ||
        tab.url.startsWith('about:')) {
        return;
    }
    
    try {
        const currentUrl = tab.url;
        const currentHostname = getHostname(currentUrl);
        // Get previous URL from navigation tracking (captured when URL changed)
        // Fall back to tabPreviousUrls if not in navigation tracking
        const previousUrl = tabNavigationPreviousUrls.get(tabId) || tabPreviousUrls.get(tabId);
        const previousHostname = previousUrl ? getHostname(previousUrl) : null;
        const navigationType = tabNavigationTypes.get(tabId) || 'direct';
        
        // Determine navigation direction
        const isNavigatingIn = previousHostname && previousHostname !== currentHostname;
        
        // Update previous URL after we've used it for all checks
        tabPreviousUrls.set(tabId, currentUrl);
        
        // Clear navigation tracking after use
        tabNavigationPreviousUrls.delete(tabId);
        
        // Get all sites and global scripts from storage
        const result = await chrome.storage.local.get(['sites', 'globalScripts']);
        const sites = result.sites || [];
        const globalScripts = result.globalScripts || [];
        
        // ========== Handle Site-Specific Scripts ==========
        const matchingSite = sites.find(site => {
            try {
                const siteUrl = new URL(site.url);
                const tabUrl = new URL(tab.url);
                // Match by origin (protocol + hostname)
                return siteUrl.origin === tabUrl.origin;
            } catch (e) {
                return false;
            }
        });
        
        if (matchingSite && matchingSite.scripts && matchingSite.scripts.length > 0) {
            // Check if site was opened via launcher
            const sessionData = await chrome.storage.session.get([`launcher_opened_${matchingSite.id}`]);
            const openedViaLauncher = sessionData[`launcher_opened_${matchingSite.id}`] === true;
            
            // Inject scripts based on their timing
            for (const script of matchingSite.scripts) {
                // Check if script should run
                // If runAlways is false, only run if opened via launcher
                // If runAlways is true (or undefined for backward compatibility), always run
                const shouldRun = script.runAlways !== false || openedViaLauncher;
                
                if (!shouldRun) {
                    continue; // Skip this script
                }
                
                // Check if confirm popup is enabled
                if (script.confirmPopup) {
                    // Show confirm popup and wait for user response
                    const scriptName = `Script for ${matchingSite.name}`;
                    const confirmed = await showConfirmPopup(tabId, scriptName);
                    if (!confirmed) {
                        continue; // User cancelled, skip script execution
                    }
                }
                
                executeScriptWithTiming(tabId, script.code, script.timing);
            }
            
            // Clear the launcher flag after processing
            if (openedViaLauncher) {
                await chrome.storage.session.remove([`launcher_opened_${matchingSite.id}`]);
            }
        }
        
        // ========== Handle Global Scripts ==========
        for (const globalScript of globalScripts) {
            // Check if URL matches the domain pattern
            // Use full URL (hostname + path) if pattern contains path, otherwise use hostname only
            const patternHasPath = globalScript.domainPattern.includes('/');
            const urlToMatch = patternHasPath ? getUrlPath(currentUrl) : currentHostname;
            const patternMatches = matchesPattern(urlToMatch, globalScript.domainPattern);
            if (!patternMatches) {
                continue;
            }
            
            // Check trigger condition
            let shouldRun = false;
            const navigationType = tabNavigationTypes.get(tabId) || 'direct';
            const isRefresh = navigationType === 'refresh';
            
            // Handle refresh separately if onRefresh checkbox is enabled
            if (globalScript.onRefresh && isRefresh) {
                // If onRefresh is checked and this is a refresh, run regardless of whenToRun
                shouldRun = true;
            } else if (!globalScript.onRefresh && isRefresh) {
                // If onRefresh is not checked and this is a refresh, skip
                continue;
            } else {
                // Not a refresh, check the main trigger
                if (globalScript.whenToRun === 'on_site_open') {
                    // Check if opened via launcher (for any site)
                    const sessionKeys = await chrome.storage.session.get(null);
                    const openedViaLauncher = Object.keys(sessionKeys).some(key => 
                        key.startsWith('launcher_opened_') && sessionKeys[key] === true
                    );
                    shouldRun = openedViaLauncher;
                } else if (globalScript.whenToRun === 'navigating_in') {
                    // Run whenever the page loads on a matching domain
                    // This includes: navigation from another domain, direct navigation
                    shouldRun = true;
                } else if (globalScript.whenToRun === 'navigating_out') {
                    // For navigating out, we need to check the previous URL
                    // This is handled when we detect navigation away
                    continue; // Skip for now, will handle in navigation listener
                }
            }
            
            if (!shouldRun) {
                continue;
            }
            
            // Execute all script code blocks for this global script
            if (globalScript.scripts && globalScript.scripts.length > 0) {
                // Check if confirm popup is enabled
                if (globalScript.confirmPopup) {
                    // Show confirm popup and wait for user response
                    const confirmed = await showConfirmPopup(tabId, globalScript.name);
                    if (!confirmed) {
                        continue; // User cancelled, skip script execution
                    }
                }
                
                for (const scriptCode of globalScript.scripts) {
                    executeScriptWithTiming(tabId, scriptCode.code, scriptCode.timing);
                }
            }
        }
        
    } catch (error) {
        console.error('Error in background script:', error);
    }
});

// Clean up when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
    tabPreviousUrls.delete(tabId);
    tabNavigationTypes.delete(tabId);
    tabNavigationPreviousUrls.delete(tabId);
});


