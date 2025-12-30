// Background service worker for script injection

console.log('Site Launcher background service worker loaded');

// Listen for tab updates
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
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
        // Get all sites from storage
        const result = await chrome.storage.local.get(['sites']);
        const sites = result.sites || [];
        
        // Find site that matches current URL
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
                
                try {
                    // Execute script based on timing
                    // Use inline functions for proper serialization
                    if (script.timing === 'document_start') {
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
                            args: [script.code],
                            world: 'MAIN'
                        }).catch(err => {
                            console.error('Error injecting script (document_start):', err);
                        });
                    } else if (script.timing === 'document_end') {
                        // Wait for DOMContentLoaded
                        chrome.scripting.executeScript({
                            target: { tabId: tabId },
                            func: (code) => {
                                const execute = () => {
                                    try {
                                        const script = document.createElement('script');
                                        script.textContent = code;
                                        (document.head || document.documentElement).appendChild(script);
                                        script.remove();
                                    } catch (error) {
                                        console.error('Error executing script:', error);
                                    }
                                };
                                
                                if (document.readyState === 'loading') {
                                    document.addEventListener('DOMContentLoaded', execute);
                                } else {
                                    execute();
                                }
                            },
                            args: [script.code],
                            world: 'MAIN'
                        }).catch(err => {
                            console.error('Error injecting script (document_end):', err);
                        });
                    } else if (script.timing === 'document_idle') {
                        // Wait for window load
                        chrome.scripting.executeScript({
                            target: { tabId: tabId },
                            func: (code) => {
                                const execute = () => {
                                    try {
                                        const script = document.createElement('script');
                                        script.textContent = code;
                                        (document.head || document.documentElement).appendChild(script);
                                        script.remove();
                                    } catch (error) {
                                        console.error('Error executing script:', error);
                                    }
                                };
                                
                                if (document.readyState === 'complete') {
                                    execute();
                                } else {
                                    window.addEventListener('load', execute);
                                }
                            },
                            args: [script.code],
                            world: 'MAIN'
                        }).catch(err => {
                            console.error('Error injecting script (document_idle):', err);
                        });
                    }
                } catch (error) {
                    console.error('Error processing script:', error);
                }
            }
            
            // Clear the launcher flag after processing
            if (openedViaLauncher) {
                await chrome.storage.session.remove([`launcher_opened_${matchingSite.id}`]);
            }
        }
    } catch (error) {
        console.error('Error in background script:', error);
    }
});


