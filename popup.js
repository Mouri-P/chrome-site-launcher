let currentTab = null;

// Get current tab info
async function getCurrentTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
}

// Get sites from storage
async function getSites() {
    const result = await chrome.storage.local.get(['sites']);
    return result.sites || [];
}

// Save sites to storage
async function saveSites(sites) {
    await chrome.storage.local.set({ sites });
}

// Get all possible favicon URLs in order of preference
function getFaviconUrls(url) {
    try {
        const parsedUrl = new URL(url);
        const origin = parsedUrl.origin;
        
        return [
            `https://www.google.com/s2/favicons?domain=${parsedUrl.hostname}&sz=128`,
            `${origin}/icon.png`,
            `${origin}/apple-touch-icon.png`,
            `${origin}/apple-touch-icon-precomposed.png`,
            `${origin}/favicon-32x32.png`,
            `${origin}/favicon-16x16.png`,
            `${origin}/favicon.ico`,
            `${origin}/favicon.png`,
            `${origin}/icons/favicon.ico`,
            `${origin}/icons/favicon.png`,
        ];
    } catch (e) {
        return [];
    }
}

// Get first favicon URL (for initial render)
function getFaviconUrl(url) {
    const urls = getFaviconUrls(url);
    return urls.length > 0 ? urls[0] : null;
}

// Get first letter for fallback
function getInitial(text) {
    return text.charAt(0).toUpperCase();
}

// Initialize popup
async function init() {
    currentTab = await getCurrentTab();
    
    if (!currentTab || !currentTab.url) {
        showError('Unable to get current page information');
        return;
    }

    // Check if it's a valid URL
    if (currentTab.url.startsWith('chrome://') || 
        currentTab.url.startsWith('chrome-extension://') ||
        currentTab.url.startsWith('about:')) {
        showError('Cannot add Chrome internal pages');
        document.getElementById('addBtn').disabled = true;
        return;
    }

    // Display current site info
    const title = currentTab.title || new URL(currentTab.url).hostname;
    const url = currentTab.url;
    
    document.getElementById('siteTitle').textContent = title;
    document.getElementById('siteUrl').textContent = new URL(url).hostname;
    
    const faviconUrls = getFaviconUrls(url);
    const faviconContainer = document.getElementById('siteFavicon');
    const defaultIconUrl = chrome.runtime.getURL('assets/applications-internet.svg');
    
    if (faviconUrls.length > 0) {
        let currentIndex = 0;
        
        const tryNextFavicon = () => {
            if (currentIndex < faviconUrls.length) {
                const currentUrl = faviconUrls[currentIndex];
                const isGoogleFaviconService = currentUrl && currentUrl.includes('www.google.com/s2/favicons');
                
                const img = document.createElement('img');
                img.src = currentUrl;
                img.style.width = '100%';
                img.style.height = '100%';
                img.style.objectFit = 'contain';
                
                img.onerror = () => {
                    // If Google's favicon service failed, immediately use SVG fallback
                    if (isGoogleFaviconService) {
                        const svgImg = document.createElement('img');
                        svgImg.src = defaultIconUrl;
                        svgImg.style.width = '100%';
                        svgImg.style.height = '100%';
                        svgImg.style.objectFit = 'contain';
                        svgImg.onerror = () => {
                            faviconContainer.textContent = getInitial(title);
                        };
                        faviconContainer.innerHTML = '';
                        faviconContainer.appendChild(svgImg);
                        return;
                    }
                    
                    // Try next favicon URL
                    currentIndex++;
                    tryNextFavicon();
                };
                
                img.onload = () => {
                    // Check if this is from Google's favicon service and if it's a 404 placeholder
                    if (isGoogleFaviconService) {
                        // Google's 404 placeholder is typically 16x16 pixels
                        // Check if the natural dimensions are 16x16 (404 placeholder)
                        if (img.naturalWidth === 16 && img.naturalHeight === 16) {
                            // This is a 404 placeholder, use SVG fallback instead
                            const svgImg = document.createElement('img');
                            svgImg.src = defaultIconUrl;
                            svgImg.style.width = '100%';
                            svgImg.style.height = '100%';
                            svgImg.style.objectFit = 'contain';
                            svgImg.onerror = () => {
                                faviconContainer.textContent = getInitial(title);
                            };
                            faviconContainer.innerHTML = '';
                            faviconContainer.appendChild(svgImg);
                            return;
                        }
                    }
                    
                    faviconContainer.innerHTML = '';
                    faviconContainer.appendChild(img);
                };
            } else {
                // All favicon URLs exhausted, try SVG fallback
                const svgImg = document.createElement('img');
                svgImg.src = defaultIconUrl;
                svgImg.style.width = '100%';
                svgImg.style.height = '100%';
                svgImg.style.objectFit = 'contain';
                svgImg.onerror = () => {
                    faviconContainer.textContent = getInitial(title);
                };
                faviconContainer.innerHTML = '';
                faviconContainer.appendChild(svgImg);
            }
        };
        
        tryNextFavicon();
    } else {
        // No favicon URLs available, use SVG fallback
        const svgImg = document.createElement('img');
        svgImg.src = defaultIconUrl;
        svgImg.style.width = '100%';
        svgImg.style.height = '100%';
        svgImg.style.objectFit = 'contain';
        svgImg.onerror = () => {
            faviconContainer.textContent = getInitial(title);
        };
        faviconContainer.appendChild(svgImg);
    }

    // Check if site already exists
    const sites = await getSites();
    const existingSite = sites.find(site => site.url === url);
    
    if (existingSite) {
        document.getElementById('customName').value = existingSite.name;
        showInfo('This site is already in your launcher');
    }
}

function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    errorDiv.textContent = message;
    errorDiv.classList.add('active');
}

function showInfo(message) {
    const errorDiv = document.getElementById('errorMessage');
    errorDiv.textContent = message;
    errorDiv.style.background = '#e3f2fd';
    errorDiv.style.border = '1px solid #90caf9';
    errorDiv.style.color = '#1976d2';
    errorDiv.classList.add('active');
}

// Handle form submission
document.getElementById('siteForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!currentTab) return;
    
    const customName = document.getElementById('customName').value.trim();
    const name = customName || currentTab.title || new URL(currentTab.url).hostname;
    const url = currentTab.url;
    let iconUrl = document.getElementById('customIconUrl').value.trim();
    
    // Ensure icon URL has protocol if provided
    if (iconUrl && !iconUrl.startsWith('http://') && !iconUrl.startsWith('https://') && !iconUrl.startsWith('data:')) {
        iconUrl = 'https://' + iconUrl;
    }
    
    const sites = await getSites();
    
    // Check if site already exists
    const existingIndex = sites.findIndex(site => site.url === url);
    
    if (existingIndex !== -1) {
        // Update existing site
        const updatedSite = {
            ...sites[existingIndex],
            name,
            url
        };
        
        // Set iconUrl or remove it if empty
        if (iconUrl) {
            updatedSite.iconUrl = iconUrl;
        } else {
            delete updatedSite.iconUrl;
        }
        
        sites[existingIndex] = updatedSite;
    } else {
        // Add new site
        const newSite = {
            id: Date.now().toString(),
            name,
            url,
            createdAt: Date.now()
        };
        
        // Only add iconUrl if provided
        if (iconUrl) {
            newSite.iconUrl = iconUrl;
        }
        
        sites.push(newSite);
    }
    
    await saveSites(sites);
    
    // Show success message
    document.getElementById('addForm').style.display = 'none';
    document.getElementById('successMessage').classList.add('active');
    
    // Close popup after 1 second
    setTimeout(() => {
        window.close();
    }, 1000);
});

// Handle cancel button
document.getElementById('cancelBtn').addEventListener('click', () => {
    window.close();
});

// Initialize
init();

