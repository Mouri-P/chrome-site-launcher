// Load default sites from JSON file
async function loadDefaultSites() {
    try {
        const response = await fetch(chrome.runtime.getURL('default-sites.json'));
        const sites = await response.json();
        // Add createdAt timestamp to each site
        return sites.map(site => ({
            ...site,
            createdAt: Date.now()
        }));
    } catch (error) {
        console.error('Error loading default sites:', error);
        return [];
    }
}

// Storage helper functions
async function getSites() {
    const result = await chrome.storage.local.get(['sites', 'initialized']);
    
    // If first time, initialize with default sites
    if (!result.initialized) {
        const defaultSites = await loadDefaultSites();
        await chrome.storage.local.set({ 
            sites: defaultSites,
            initialized: true 
        });
        return defaultSites;
    }
    
    return result.sites || [];
}

async function saveSites(sites) {
    await chrome.storage.local.set({ sites });
}

// Get favicon URL
function getFaviconUrl(url) {
    try {
        const domain = new URL(url).hostname;
        return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
    } catch (e) {
        return null;
    }
}

// Get first letter for fallback
function getInitial(name) {
    return name.charAt(0).toUpperCase();
}

// Render sites grid
async function renderSites() {
    const sites = await getSites();
    const sitesGrid = document.getElementById('sitesGrid');
    
    if (sites.length === 0) {
        sitesGrid.innerHTML = `
            <div class="empty-state">
                <h2>Welcome to Site Launcher!</h2>
                <p>Click the + button to add your first site</p>
            </div>
        `;
        return;
    }
    
    const isEditMode = await getEditMode();
    
    sitesGrid.innerHTML = sites.map(site => {
        // Use custom icon URL if provided, otherwise use favicon
        const iconUrl = site.iconUrl || getFaviconUrl(site.url);
        const initial = getInitial(site.name);
        return `
            <div class="site-item" data-id="${site.id}" draggable="${isEditMode}">
                <div class="site-icon" data-site-name="${site.name}">
                    <div class="site-icon-fallback">${initial}</div>
                    ${iconUrl ? `<img src="${iconUrl}" alt="${site.name}" data-site-id="${site.id}">` : ''}
                    ${isEditMode ? `
                        <div class="edit-icon" data-id="${site.id}">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </div>
                        <div class="delete-icon" data-id="${site.id}">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </div>
                    ` : ''}
                </div>
                <div class="site-name">${site.name}</div>
            </div>
        `;
    }).join('');
    
    // Add error handlers for images (CSP-compliant way)
    // Show placeholder initially, hide when image loads
    document.querySelectorAll('.site-icon img').forEach(img => {
        // Initially hide image, show placeholder
        img.style.display = 'none';
        const fallback = img.parentElement.querySelector('.site-icon-fallback');
        if (fallback) {
            fallback.style.display = 'flex';
        }
        
        img.addEventListener('error', function() {
            // Hide broken image and show fallback
            this.style.display = 'none';
            const fallback = this.parentElement.querySelector('.site-icon-fallback');
            if (fallback) {
                fallback.style.display = 'flex';
            }
        });
        
        img.addEventListener('load', function() {
            // Hide fallback and show image when loaded
            const fallback = this.parentElement.querySelector('.site-icon-fallback');
            if (fallback) {
                fallback.style.display = 'none';
            }
            this.style.display = 'block';
        });
    });
    
    // Add click handlers
    let dragStarted = false;
    document.querySelectorAll('.site-item').forEach(item => {
        const siteId = item.getAttribute('data-id');
        const site = sites.find(s => s.id === siteId);
        
        item.addEventListener('dragstart', () => {
            dragStarted = true;
        });
        
        item.addEventListener('dragend', () => {
            // Reset after a short delay to allow click event to check
            setTimeout(() => {
                dragStarted = false;
            }, 100);
        });
        
        item.addEventListener('click', async (e) => {
            // Don't navigate if we just finished dragging
            if (dragStarted) {
                dragStarted = false;
                return;
            }
            // Don't navigate if in edit mode or clicking edit/delete buttons
            const isEditMode = await getEditMode();
            if (isEditMode || e.target.closest('.edit-icon') || e.target.closest('.delete-icon')) {
                return;
            }
            window.location.href = site.url;
        });
    });
    
    // Add edit handlers (only in edit mode)
    if (isEditMode) {
        document.querySelectorAll('.edit-icon').forEach(icon => {
            icon.addEventListener('click', (e) => {
                e.stopPropagation();
                const siteId = icon.getAttribute('data-id');
                openEditModal(siteId);
            });
        });
        
        // Add delete handlers
        document.querySelectorAll('.delete-icon').forEach(icon => {
            icon.addEventListener('click', async (e) => {
                e.stopPropagation();
                const siteId = icon.getAttribute('data-id');
                if (confirm('Are you sure you want to delete this site?')) {
                    const sites = await getSites();
                    const filteredSites = sites.filter(s => s.id !== siteId);
                    await saveSites(filteredSites);
                    renderSites();
                }
            });
        });
        
        // Add drag and drop handlers
        setupDragAndDrop();
    }
    
    // Update edit mode controls visibility
    updateEditModeControls();
}

// Edit mode functions
async function getEditMode() {
    const result = await chrome.storage.local.get(['editMode']);
    return result.editMode || false;
}

async function setEditMode(enabled) {
    await chrome.storage.local.set({ editMode: enabled });
}

function updateEditModeControls() {
    getEditMode().then(enabled => {
        const editModeControls = document.getElementById('editModeControls');
        if (editModeControls) {
            editModeControls.style.display = enabled ? 'flex' : 'none';
        }
    });
}

// Drag and drop functionality
let draggedElement = null;
let draggedIndex = null;
let dragStarted = false;

function setupDragAndDrop() {
    const siteItems = document.querySelectorAll('.site-item');
    
    siteItems.forEach((item, index) => {
        // Prevent dragging when clicking edit icon
        const editIcon = item.querySelector('.edit-icon');
        if (editIcon) {
            editIcon.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                item.draggable = false;
                setTimeout(() => {
                    item.draggable = true;
                }, 100);
            });
        }
        
        item.addEventListener('dragstart', (e) => {
            draggedElement = item;
            draggedIndex = index;
            item.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/html', item.innerHTML);
            // Set drag image to be the item itself
            e.dataTransfer.setDragImage(item, item.offsetWidth / 2, item.offsetHeight / 2);
            // Mark that drag has started (used to prevent click navigation)
            dragStarted = true;
        });
        
        item.addEventListener('dragend', (e) => {
            item.classList.remove('dragging');
            // Remove all drag-over classes
            document.querySelectorAll('.site-item').forEach(el => {
                el.classList.remove('drag-over');
            });
            draggedElement = null;
            draggedIndex = null;
            // Reset drag flag after a short delay to allow click event to check
            setTimeout(() => {
                dragStarted = false;
            }, 100);
        });
        
        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            
            const sitesGrid = document.getElementById('sitesGrid');
            const dragging = document.querySelector('.dragging');
            if (!dragging) return;
            
            const afterElement = getDragAfterElement(sitesGrid, e.clientY);
            
            // Remove drag-over from all items first
            document.querySelectorAll('.site-item').forEach(el => {
                if (el !== dragging) {
                    el.classList.remove('drag-over');
                }
            });
            
            // Add drag-over to the item we're hovering over
            if (item !== dragging) {
                item.classList.add('drag-over');
            }
            
            if (afterElement == null) {
                sitesGrid.appendChild(dragging);
            } else {
                sitesGrid.insertBefore(dragging, afterElement);
            }
        });
        
        item.addEventListener('dragenter', (e) => {
            e.preventDefault();
            if (item !== draggedElement) {
                item.classList.add('drag-over');
            }
        });
        
        item.addEventListener('dragleave', (e) => {
            // Only remove if we're actually leaving (not entering a child)
            if (!item.contains(e.relatedTarget)) {
                item.classList.remove('drag-over');
            }
        });
        
        item.addEventListener('drop', async (e) => {
            e.preventDefault();
            item.classList.remove('drag-over');
            
            if (draggedElement && draggedElement !== item) {
                const sitesGrid = document.getElementById('sitesGrid');
                // Get all site items in current order
                const allItems = Array.from(sitesGrid.querySelectorAll('.site-item'));
                const newOrder = allItems.map(el => el.getAttribute('data-id'));
                
                // Reorder sites array
                const sites = await getSites();
                const reorderedSites = newOrder.map(id => sites.find(s => s.id === id)).filter(Boolean);
                
                // Save new order
                await saveSites(reorderedSites);
                
                // Re-render to ensure everything is in sync
                renderSites();
            }
        });
    });
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.site-item:not(.dragging)')];
    
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// Add site modal
const addSiteModal = document.getElementById('addSiteModal');
const addSiteBtn = document.getElementById('addSiteBtn');
const cancelBtn = document.getElementById('cancelBtn');
const addSiteForm = document.getElementById('addSiteForm');

addSiteBtn.addEventListener('click', () => {
    addSiteModal.classList.add('active');
    document.getElementById('siteName').focus();
});

cancelBtn.addEventListener('click', () => {
    addSiteModal.classList.remove('active');
    addSiteForm.reset();
});

addSiteModal.addEventListener('click', (e) => {
    if (e.target === addSiteModal) {
        addSiteModal.classList.remove('active');
        addSiteForm.reset();
    }
});

addSiteForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('siteName').value.trim();
    let url = document.getElementById('siteUrl').value.trim();
    let iconUrl = document.getElementById('siteIconUrl').value.trim();
    
    // Ensure URL has protocol
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
    }
    
    // Ensure icon URL has protocol if provided
    if (iconUrl && !iconUrl.startsWith('http://') && !iconUrl.startsWith('https://') && !iconUrl.startsWith('data:')) {
        iconUrl = 'https://' + iconUrl;
    }
    
    const sites = await getSites();
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
    await saveSites(sites);
    
    addSiteModal.classList.remove('active');
    addSiteForm.reset();
    renderSites();
});

// Edit site modal
const editSiteModal = document.getElementById('editSiteModal');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const editSiteForm = document.getElementById('editSiteForm');
const deleteSiteBtn = document.getElementById('deleteSiteBtn');

async function openEditModal(siteId) {
    const sites = await getSites();
    const site = sites.find(s => s.id === siteId);
    
    if (!site) return;
    
    document.getElementById('editSiteId').value = site.id;
    document.getElementById('editSiteName').value = site.name;
    document.getElementById('editSiteUrl').value = site.url;
    document.getElementById('editSiteIconUrl').value = site.iconUrl || '';
    
    editSiteModal.classList.add('active');
}

cancelEditBtn.addEventListener('click', () => {
    editSiteModal.classList.remove('active');
    editSiteForm.reset();
});

editSiteModal.addEventListener('click', (e) => {
    if (e.target === editSiteModal) {
        editSiteModal.classList.remove('active');
        editSiteForm.reset();
    }
});

editSiteForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const siteId = document.getElementById('editSiteId').value;
    const name = document.getElementById('editSiteName').value.trim();
    let url = document.getElementById('editSiteUrl').value.trim();
    let iconUrl = document.getElementById('editSiteIconUrl').value.trim();
    
    // Ensure URL has protocol
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
    }
    
    // Ensure icon URL has protocol if provided
    if (iconUrl && !iconUrl.startsWith('http://') && !iconUrl.startsWith('https://') && !iconUrl.startsWith('data:')) {
        iconUrl = 'https://' + iconUrl;
    }
    
    const sites = await getSites();
    const siteIndex = sites.findIndex(s => s.id === siteId);
    
    if (siteIndex !== -1) {
        const updatedSite = {
            ...sites[siteIndex],
            name,
            url
        };
        
        // Set iconUrl or remove it if empty
        if (iconUrl) {
            updatedSite.iconUrl = iconUrl;
        } else {
            delete updatedSite.iconUrl;
        }
        
        sites[siteIndex] = updatedSite;
        await saveSites(sites);
    }
    
    editSiteModal.classList.remove('active');
    editSiteForm.reset();
    renderSites();
});

deleteSiteBtn.addEventListener('click', async () => {
    if (!confirm('Are you sure you want to delete this site?')) {
        return;
    }
    
    const siteId = document.getElementById('editSiteId').value;
    const sites = await getSites();
    const filteredSites = sites.filter(s => s.id !== siteId);
    
    await saveSites(filteredSites);
    
    editSiteModal.classList.remove('active');
    editSiteForm.reset();
    renderSites();
});

// Keyboard shortcuts
// Note: Cmd/Ctrl + N is reserved by Chrome for "New Window"
// We could use other shortcuts here if needed in the future

// Clean up Chrome's injected elements
function cleanUpChromeUI() {
    // Remove all elements that aren't our extension's content
    const allowedIds = ['sitesGrid', 'addSiteBtn', 'themeBtn', 'addSiteModal', 'editSiteModal', 'themeModal'];
    const allowedClasses = ['launchpad-container', 'button-group-container', 'add-button-container', 'theme-button-container', 'modal'];
    
    document.querySelectorAll('body > *').forEach(element => {
        if (element.tagName === 'SCRIPT') return;
        
        const hasAllowedId = allowedIds.includes(element.id);
        const hasAllowedClass = allowedClasses.some(cls => element.classList.contains(cls));
        
        if (!hasAllowedId && !hasAllowedClass) {
            element.remove();
        }
    });
}

// Theme functionality
// Load default images from folder
async function loadDefaultImages() {
    // Start with empty array - users can upload their own images
    // We removed Unsplash images to comply with their attribution requirements
    // Users can upload their own images or use image URLs
    const defaultImages = [];
    
    // Load user-uploaded images from local storage
    const result = await chrome.storage.local.get(['customImages']);
    if (result.customImages && Array.isArray(result.customImages)) {
        result.customImages.forEach((img, index) => {
            defaultImages.push({
                name: `Custom ${index + 1}`,
                url: img
            });
        });
    }
    
    return defaultImages;
}

// Load and apply theme
async function loadTheme() {
    const result = await chrome.storage.local.get(['theme']);
    const theme = result.theme || { type: 'color', value: '#ffffff' };
    applyTheme(theme);
}

// Load and apply icon size
async function loadIconSize() {
    const result = await chrome.storage.local.get(['iconSize']);
    const iconSize = result.iconSize || 100;
    applyIconSize(iconSize);
}

// Apply icon size to CSS variable
function applyIconSize(size) {
    document.documentElement.style.setProperty('--icon-size', `${size}px`);
}

// Save icon size
async function saveIconSize(size) {
    await chrome.storage.local.set({ iconSize: size });
    applyIconSize(size);
}

// Calculate brightness of a color (0-255)
function getColorBrightness(color) {
    let r, g, b;
    
    // Handle hex colors
    if (color.startsWith('#')) {
        color = color.replace('#', '');
        // Handle 3-digit hex
        if (color.length === 3) {
            r = parseInt(color[0] + color[0], 16);
            g = parseInt(color[1] + color[1], 16);
            b = parseInt(color[2] + color[2], 16);
        } else {
            r = parseInt(color.substring(0, 2), 16);
            g = parseInt(color.substring(2, 4), 16);
            b = parseInt(color.substring(4, 6), 16);
        }
    } 
    // Handle rgb/rgba colors
    else if (color.startsWith('rgb')) {
        const matches = color.match(/\d+/g);
        if (matches && matches.length >= 3) {
            r = parseInt(matches[0]);
            g = parseInt(matches[1]);
            b = parseInt(matches[2]);
        } else {
            return 128; // Default to medium brightness
        }
    } else {
        // Try to parse as named color or default
        return 128;
    }
    
    // Calculate relative luminance (perceived brightness)
    // Using the formula: 0.299*R + 0.587*G + 0.114*B
    return (0.299 * r + 0.587 * g + 0.114 * b);
}

// Calculate average brightness of an image
function getImageBrightness(imageUrl, callback) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = function() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        
        try {
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            let totalBrightness = 0;
            let pixelCount = 0;
            
            // Sample every 10th pixel for performance
            for (let i = 0; i < data.length; i += 40) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                totalBrightness += (0.299 * r + 0.587 * g + 0.114 * b);
                pixelCount++;
            }
            
            const avgBrightness = totalBrightness / pixelCount;
            callback(avgBrightness);
        } catch (e) {
            // If CORS blocks, default to dark text
            callback(128);
        }
    };
    
    img.onerror = function() {
        // Default to dark text if image fails to load
        callback(128);
    };
    
    img.src = imageUrl;
}

// Set text color based on background brightness
function setAdaptiveTextColor(brightness) {
    const root = document.documentElement;
    // If brightness > 128, use dark text, otherwise use light text
    if (brightness > 128) {
        root.style.setProperty('--text-color', '#1a1a1a');
        root.style.setProperty('--text-color-secondary', '#4a4a4a');
    } else {
        root.style.setProperty('--text-color', '#ffffff');
        root.style.setProperty('--text-color-secondary', '#e0e0e0');
    }
}

function applyTheme(theme) {
    const body = document.body;
    
    if (theme.type === 'color') {
        body.style.background = theme.value;
        body.style.backgroundImage = 'none';
        
        // Calculate brightness and set text color
        const brightness = getColorBrightness(theme.value);
        setAdaptiveTextColor(brightness);
    } else if (theme.type === 'image') {
        if (theme.value.startsWith('data:') || theme.value.startsWith('blob:')) {
            // Local image
            body.style.backgroundImage = `url(${theme.value})`;
        } else {
            // URL image
            body.style.backgroundImage = `url(${theme.value})`;
        }
        body.style.backgroundSize = 'cover';
        body.style.backgroundPosition = 'center';
        body.style.backgroundRepeat = 'no-repeat';
        body.style.backgroundAttachment = 'fixed';
        
        // Calculate image brightness and set text color
        getImageBrightness(theme.value, (brightness) => {
            setAdaptiveTextColor(brightness);
        });
    }
}

// Theme modal
const themeModal = document.getElementById('themeModal');
const themeBtn = document.getElementById('themeBtn');
const cancelThemeBtn = document.getElementById('cancelThemeBtn');
const themeForm = document.getElementById('themeForm');
const colorOptions = document.getElementById('colorOptions');
const imageOptions = document.getElementById('imageOptions');
const defaultImagesContainer = document.getElementById('defaultImages');

// Populate default images
async function populateDefaultImages() {
    defaultImagesContainer.innerHTML = '';
    const images = await loadDefaultImages();
    
    images.forEach((img, index) => {
        const preset = document.createElement('div');
        preset.className = 'image-preset';
        preset.setAttribute('data-url', img.url);
        preset.innerHTML = `<img src="${img.url}" alt="${img.name}" loading="lazy">`;
        preset.addEventListener('click', () => {
            document.querySelectorAll('.image-preset').forEach(p => p.classList.remove('selected'));
            preset.classList.add('selected');
            document.getElementById('imageUrl').value = img.url;
        });
        defaultImagesContainer.appendChild(preset);
    });
}

// Settings navigation
function showSettingsPage(pageId) {
    // Hide all pages
    document.querySelectorAll('.settings-page').forEach(page => {
        page.classList.remove('active');
    });
    
    // Show selected page
    const page = document.getElementById(pageId + 'Page');
    if (page) {
        page.classList.add('active');
    }
    
    // Update nav items
    document.querySelectorAll('.settings-nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    const navItem = document.querySelector(`.settings-nav-item[data-page="${pageId}"]`);
    if (navItem) {
        navItem.classList.add('active');
    }
}

// Setup navigation
document.querySelectorAll('.settings-nav-item').forEach(item => {
    item.addEventListener('click', () => {
        const pageId = item.getAttribute('data-page');
        showSettingsPage(pageId);
    });
});

// Theme button click
themeBtn.addEventListener('click', async () => {
    // Show info page by default
    showSettingsPage('info');
    
    // Populate default images for theme page
    await populateDefaultImages();
    
    const result = await chrome.storage.local.get(['theme', 'iconSize']);
    const theme = result.theme || { type: 'color', value: '#ffffff' };
    const iconSize = result.iconSize || 100;
    
    // Set current theme values (for when user navigates to theme page)
    if (theme.type === 'color') {
        const colorRadio = document.querySelector('input[name="bgType"][value="color"]');
        if (colorRadio) {
            colorRadio.checked = true;
            document.getElementById('bgColor').value = theme.value;
            colorOptions.style.display = 'block';
            imageOptions.style.display = 'none';
        }
    } else {
        const imageRadio = document.querySelector('input[name="bgType"][value="image"]');
        if (imageRadio) {
            imageRadio.checked = true;
            document.getElementById('imageUrl').value = theme.value || '';
            colorOptions.style.display = 'none';
            imageOptions.style.display = 'block';
        }
    }
    
    // Set current icon size value
    const iconSizeInput = document.getElementById('iconSize');
    const iconSizeValue = document.getElementById('iconSizeValue');
    if (iconSizeInput && iconSizeValue) {
        iconSizeInput.value = iconSize;
        iconSizeValue.textContent = `${iconSize}px`;
    }
    
    // Setup icon size slider
    setupIconSizeSlider();
    
    themeModal.classList.add('active');
});

cancelThemeBtn.addEventListener('click', () => {
    themeModal.classList.remove('active');
    themeForm.reset();
});

themeModal.addEventListener('click', (e) => {
    if (e.target === themeModal) {
        themeModal.classList.remove('active');
        themeForm.reset();
    }
});

// Background type toggle
document.querySelectorAll('input[name="bgType"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        if (e.target.value === 'color') {
            colorOptions.style.display = 'block';
            imageOptions.style.display = 'none';
        } else {
            colorOptions.style.display = 'none';
            imageOptions.style.display = 'block';
        }
    });
});

// When theme page is shown, populate images if needed
const themePageObserver = new MutationObserver((mutations) => {
    const themePage = document.getElementById('themePage');
    if (themePage && themePage.classList.contains('active')) {
        populateDefaultImages();
    }
});

themePageObserver.observe(document.getElementById('themePage'), {
    attributes: true,
    attributeFilter: ['class']
});

// Color presets
document.querySelectorAll('.color-preset').forEach(preset => {
    preset.addEventListener('click', () => {
        document.getElementById('bgColor').value = preset.getAttribute('data-color');
    });
});

// Icon size slider - setup event listener
function setupIconSizeSlider() {
    const iconSizeInput = document.getElementById('iconSize');
    const iconSizeValue = document.getElementById('iconSizeValue');
    if (iconSizeInput && iconSizeValue && !iconSizeInput.dataset.listenerAttached) {
        iconSizeInput.addEventListener('input', (e) => {
            const size = parseInt(e.target.value);
            iconSizeValue.textContent = `${size}px`;
            // Apply preview in real-time
            applyIconSize(size);
        });
        iconSizeInput.dataset.listenerAttached = 'true';
    }
}

// Theme form submission
themeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const bgType = document.querySelector('input[name="bgType"]:checked').value;
    let theme;
    
    if (bgType === 'color') {
        const color = document.getElementById('bgColor').value;
        theme = { type: 'color', value: color };
    } else {
        const imageUrl = document.getElementById('imageUrl').value.trim();
        const localImage = document.getElementById('localImage').files[0];
        
        if (localImage) {
            // Convert to data URL and save to custom images
            const reader = new FileReader();
            reader.onload = async (e) => {
                const dataUrl = e.target.result;
                theme = { type: 'image', value: dataUrl };
                
                // Save to custom images list
                const result = await chrome.storage.local.get(['customImages']);
                const customImages = result.customImages || [];
                if (!customImages.includes(dataUrl)) {
                    customImages.push(dataUrl);
                    await chrome.storage.local.set({ customImages });
                }
                
                // Save icon size
                const iconSize = parseInt(document.getElementById('iconSize').value) || 100;
                await saveIconSize(iconSize);
                
                await chrome.storage.local.set({ theme });
                applyTheme(theme);
                themeModal.classList.remove('active');
            };
            reader.readAsDataURL(localImage);
            return;
        } else if (imageUrl) {
            theme = { type: 'image', value: imageUrl };
        } else {
            alert('Please select an image or enter an image URL');
            return;
        }
    }
    
    // Save icon size
    const iconSize = parseInt(document.getElementById('iconSize').value) || 100;
    await saveIconSize(iconSize);
    
    await chrome.storage.local.set({ theme });
    applyTheme(theme);
    themeModal.classList.remove('active');
    themeForm.reset();
});

// Run cleanup immediately and after DOM loads
cleanUpChromeUI();
setTimeout(cleanUpChromeUI, 100);
setTimeout(cleanUpChromeUI, 500);

// Import/Export functionality
const exportBtn = document.getElementById('exportBtn');
const importBtn = document.getElementById('importBtn');
const importFile = document.getElementById('importFile');
const importStatus = document.getElementById('importStatus');
const importChromeBtn = document.getElementById('importChromeBtn');
const chromeImportStatus = document.getElementById('chromeImportStatus');

// Export sites
exportBtn.addEventListener('click', async () => {
    const sites = await getSites();
    
    // Create JSON blob
    const json = JSON.stringify(sites, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    // Create download link
    const link = document.createElement('a');
    link.href = url;
    link.download = `site-launcher-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up
    setTimeout(() => URL.revokeObjectURL(url), 100);
});

// Enable import button when file is selected
importFile.addEventListener('change', (e) => {
    importBtn.disabled = !e.target.files || e.target.files.length === 0;
});

// Import sites
importBtn.addEventListener('click', async () => {
    const file = importFile.files[0];
    if (!file) {
        showImportStatus('Please select a JSON file', 'error');
        return;
    }
    
    const importMode = document.querySelector('input[name="importMode"]:checked').value;
    
    try {
        const text = await file.text();
        const importedSites = JSON.parse(text);
        
        // Validate JSON structure
        if (!Array.isArray(importedSites)) {
            throw new Error('Invalid JSON format: Expected an array of sites');
        }
        
        // Validate each site has required fields
        for (const site of importedSites) {
            if (!site.name || !site.url) {
                throw new Error('Invalid site format: Each site must have "name" and "url" fields');
            }
        }
        
        let finalSites;
        
        if (importMode === 'replace') {
            // Replace all sites
            finalSites = importedSites.map((site, index) => ({
                ...site,
                id: site.id || `imported-${Date.now()}-${index}`,
                createdAt: site.createdAt || Date.now()
            }));
            
            // Save sites
            await saveSites(finalSites);
            
            // Show success message
            showImportStatus(
                `Successfully imported ${importedSites.length} site(s). All sites replaced.`,
                'success'
            );
        } else {
            // Merge with existing sites
            const existingSites = await getSites();
            const existingUrls = new Set(existingSites.map(s => s.url));
            
            // Add new sites, skip duplicates by URL
            const newSites = importedSites
                .filter(site => !existingUrls.has(site.url))
                .map((site, index) => ({
                    ...site,
                    id: site.id || `imported-${Date.now()}-${index}`,
                    createdAt: site.createdAt || Date.now()
                }));
            
            finalSites = [...existingSites, ...newSites];
            
            // Calculate counts before saving
            const addedCount = newSites.length;
            const skippedCount = importedSites.length - addedCount;
            
            // Save sites
            await saveSites(finalSites);
            
            // Show success message
            let message = `Successfully imported ${importedSites.length} site(s). ${addedCount} new site(s) added.`;
            if (skippedCount > 0) {
                message += ` ${skippedCount} duplicate(s) skipped.`;
            }
            showImportStatus(message, 'success');
        }
        
        // Reset file input
        importFile.value = '';
        importBtn.disabled = true;
        
        // Reload sites
        renderSites();
        
        // Close modal after a delay
        setTimeout(() => {
            themeModal.classList.remove('active');
            importStatus.style.display = 'none';
        }, 2000);
        
    } catch (error) {
        showImportStatus(`Error: ${error.message}`, 'error');
        console.error('Import error:', error);
    }
});

function showImportStatus(message, type) {
    importStatus.textContent = message;
    importStatus.style.display = 'block';
    
    if (type === 'success') {
        importStatus.style.background = '#e8f5e9';
        importStatus.style.color = '#2e7d32';
        importStatus.style.border = '1px solid #4caf50';
    } else {
        importStatus.style.background = '#ffebee';
        importStatus.style.color = '#c62828';
        importStatus.style.border = '1px solid #f44336';
    }
}

function showChromeImportStatus(message, type) {
    chromeImportStatus.textContent = message;
    chromeImportStatus.style.display = 'block';
    
    if (type === 'success') {
        chromeImportStatus.style.background = '#e8f5e9';
        chromeImportStatus.style.color = '#2e7d32';
        chromeImportStatus.style.border = '1px solid #4caf50';
    } else {
        chromeImportStatus.style.background = '#ffebee';
        chromeImportStatus.style.color = '#c62828';
        chromeImportStatus.style.border = '1px solid #f44336';
    }
}

// Import from Chrome's frequently visited sites
importChromeBtn.addEventListener('click', async () => {
    try {
        showChromeImportStatus('Loading frequently visited sites...', 'success');
        
        // Get top sites from Chrome
        const topSites = await chrome.topSites.get();
        
        if (!topSites || topSites.length === 0) {
            showChromeImportStatus('No frequently visited sites found. Visit some websites first!', 'error');
            return;
        }
        
        // Get existing sites to check for duplicates
        const existingSites = await getSites();
        const existingUrls = new Set(existingSites.map(s => s.url));
        
        // Convert top sites to our format
        const newSites = topSites
            .filter(site => !existingUrls.has(site.url))
            .map((site, index) => {
                // Extract domain name for site name if title is not available
                let siteName = site.title || new URL(site.url).hostname;
                // Clean up the name
                siteName = siteName.replace(/^https?:\/\//, '').replace(/^www\./, '');
                
                return {
                    id: `chrome-import-${Date.now()}-${index}`,
                    name: siteName,
                    url: site.url,
                    createdAt: Date.now()
                };
            });
        
        if (newSites.length === 0) {
            showChromeImportStatus('All frequently visited sites are already in your launcher.', 'error');
            return;
        }
        
        // Add new sites to existing ones
        const finalSites = [...existingSites, ...newSites];
        await saveSites(finalSites);
        
        const skippedCount = topSites.length - newSites.length;
        let message = `Successfully imported ${newSites.length} site(s) from Chrome.`;
        if (skippedCount > 0) {
            message += ` ${skippedCount} duplicate(s) skipped.`;
        }
        
        showChromeImportStatus(message, 'success');
        
        // Reload sites
        renderSites();
        
        // Close modal after a delay
        setTimeout(() => {
            themeModal.classList.remove('active');
            chromeImportStatus.style.display = 'none';
        }, 2000);
        
    } catch (error) {
        showChromeImportStatus(`Error: ${error.message}`, 'error');
        console.error('Chrome import error:', error);
    }
});

// Privacy policy link
const privacyPolicyLink = document.getElementById('privacyPolicyLink');
if (privacyPolicyLink) {
    privacyPolicyLink.href = chrome.runtime.getURL('privacy-policy.html');
}

// Edit mode button handlers
const enableEditModeBtn = document.getElementById('enableEditModeBtn');
const doneEditBtn = document.getElementById('doneEditBtn');

if (enableEditModeBtn) {
    enableEditModeBtn.addEventListener('click', async () => {
        await setEditMode(true);
        themeModal.classList.remove('active');
        renderSites();
    });
}

if (doneEditBtn) {
    doneEditBtn.addEventListener('click', async () => {
        await setEditMode(false);
        renderSites();
    });
}

// Load theme and icon size, then initial render
loadTheme();
loadIconSize();
setupIconSizeSlider();
renderSites();

