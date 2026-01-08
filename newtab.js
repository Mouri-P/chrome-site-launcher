// Load default sites from JSON file
async function loadDefaultSites() {
    try {
        const response = await fetch(chrome.runtime.getURL('default.json'));
        const data = await response.json();
        
        // Handle both old format (array) and new format (object with data property)
        let sites = [];
        if (Array.isArray(data)) {
            // Old format - just array of sites
            sites = data;
        } else if (data.data && data.data.sites) {
            // New format - object with data property
            sites = data.data.sites;
        } else {
            console.error('Invalid default.json format');
            return [];
        }
        
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
function getInitial(name) {
    return name.charAt(0).toUpperCase();
}

// Helper function to check if a site has children
function hasChildren(siteId, sites) {
    return sites.some(s => s.parentId === siteId);
}

// Render sites grid
async function renderSites() {
    const sites = await getSites();
    const sitesGrid = document.getElementById('sitesGrid');
    
    // Filter to show only parent sites (sites without parentId) in main grid
    const parentSites = sites.filter(site => !site.parentId);
    
    if (parentSites.length === 0) {
        sitesGrid.innerHTML = `
            <div class="empty-state">
                <h2>Welcome to Site Launcher!</h2>
                <p>Click the + button to add your first site</p>
            </div>
        `;
        return;
    }
    
    const isEditMode = await getEditMode();
    const showOnHover = await getShowEditOnHover();
    
    const defaultIconUrl = chrome.runtime.getURL('assets/applications-internet.svg');
    
    sitesGrid.innerHTML = parentSites.map(site => {
        // Use custom icon URL if provided, otherwise use favicon
        const iconUrl = site.iconUrl || getFaviconUrl(site.url);
        const initial = getInitial(site.name);
        const editIconsClass = isEditMode ? 'edit-icons-visible' : (showOnHover ? 'edit-icons-hover' : 'edit-icons-hidden');
        const hasChildSites = hasChildren(site.id, sites);
        return `
            <div class="site-item" data-id="${site.id}" draggable="${isEditMode}">
                <div class="site-icon" data-site-name="${site.name}">
                    <div class="site-icon-fallback">${initial}</div>
                    ${iconUrl ? `<img src="${iconUrl}" alt="${site.name}" data-site-id="${site.id}" data-site-url="${site.url}" data-favicon-index="0">` : `<img src="${defaultIconUrl}" alt="${site.name}" data-site-id="${site.id}" class="site-icon-svg-fallback">`}
                    <div class="edit-icons ${editIconsClass}">
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
                        <div class="advanced-icon" data-id="${site.id}" title="Advanced Scripts">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"></circle>
                                <path d="M12 16v-4M12 8h.01"></path>
                            </svg>
                        </div>
                        <div class="move-icon" data-id="${site.id}" title="Move">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="5 9 2 12 5 15"></polyline>
                                <polyline points="9 5 12 2 15 5"></polyline>
                                <polyline points="15 19 12 22 9 19"></polyline>
                                <polyline points="19 9 22 12 19 15"></polyline>
                                <line x1="2" y1="12" x2="22" y2="12"></line>
                                <line x1="12" y1="2" x2="12" y2="22"></line>
                            </svg>
                        </div>
                        <div class="move-arrow-left" data-id="${site.id}" data-direction="left" style="display: none;">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="15 18 9 12 15 6"></polyline>
                            </svg>
                        </div>
                        <div class="move-arrow-right" data-id="${site.id}" data-direction="right" style="display: none;">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                        </div>
                    </div>
                    ${hasChildSites ? `
                        <div class="down-arrow-icon" data-parent-id="${site.id}" data-debug-site-name="${site.name}">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="6 9 12 15 18 9"></polyline>
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
        const isSvgFallback = img.classList.contains('site-icon-svg-fallback');
        const fallback = img.parentElement.querySelector('.site-icon-fallback');
        
        if (isSvgFallback) {
            // For SVG fallback, show it immediately and hide initial letter
            // CSS will handle display: block via .site-icon-svg-fallback class
            if (fallback) {
                fallback.style.display = 'none';
            }
            
            // If SVG fails, show initial letter
            img.addEventListener('error', function() {
                this.style.display = 'none';
                if (fallback) {
                    fallback.style.display = 'flex';
                }
            });
        } else {
            // For regular favicon images, hide initially and show placeholder
            img.style.display = 'none';
            if (fallback) {
                fallback.style.display = 'flex';
            }
            
            img.addEventListener('error', function() {
                const siteUrl = this.getAttribute('data-site-url');
                if (!siteUrl) {
                    // No site URL, fall back to SVG immediately
                    this.src = defaultIconUrl;
                    this.classList.add('site-icon-svg-fallback');
                    if (fallback) {
                        fallback.style.display = 'none';
                    }
                    return;
                }
                
                // Check if current URL is Google's favicon service
                const currentSrc = this.src;
                const isGoogleFaviconService = currentSrc && currentSrc.includes('www.google.com/s2/favicons');
                
                // If Google's service failed, immediately use SVG fallback
                if (isGoogleFaviconService) {
                    this.src = defaultIconUrl;
                    this.classList.add('site-icon-svg-fallback');
                    // CSS will handle display: block via .site-icon-svg-fallback class
                    
                    // If SVG also fails, show initial letter
                    this.addEventListener('error', function() {
                        this.style.display = 'none';
                        if (fallback) {
                            fallback.style.display = 'flex';
                        }
                    }, { once: true });
                    
                    if (fallback) {
                        fallback.style.display = 'none';
                    }
                    return;
                }
                
                // Get all possible favicon URLs
                const faviconUrls = getFaviconUrls(siteUrl);
                let currentIndex = parseInt(this.getAttribute('data-favicon-index') || '0', 10);
                currentIndex++;
                
                // Try next favicon URL if available
                if (currentIndex < faviconUrls.length) {
                    this.setAttribute('data-favicon-index', currentIndex.toString());
                    this.src = faviconUrls[currentIndex];
                    // Don't hide fallback yet, wait for load
                } else {
                    // All favicon URLs exhausted, use SVG fallback
                    this.src = defaultIconUrl;
                    this.classList.add('site-icon-svg-fallback');
                    // CSS will handle display: block via .site-icon-svg-fallback class
                    
                    // If SVG also fails, show initial letter
                    this.addEventListener('error', function() {
                        this.style.display = 'none';
                        if (fallback) {
                            fallback.style.display = 'flex';
                        }
                    }, { once: true });
                    
                    if (fallback) {
                        fallback.style.display = 'none';
                    }
                }
            });
            
            img.addEventListener('load', function() {
                // Check if this is from Google's favicon service and if it's a 404 placeholder
                const currentSrc = this.src;
                const isGoogleFaviconService = currentSrc && currentSrc.includes('www.google.com/s2/favicons');
                
                if (isGoogleFaviconService) {
                    // Google's 404 placeholder is typically 16x16 pixels
                    // Check if the natural dimensions are 16x16 (404 placeholder)
                    if (this.naturalWidth === 16 && this.naturalHeight === 16) {
                        // This is a 404 placeholder, use SVG fallback instead
                        this.src = defaultIconUrl;
                        this.classList.add('site-icon-svg-fallback');
                        
                        // If SVG also fails, show initial letter
                        this.addEventListener('error', function() {
                            this.style.display = 'none';
                            if (fallback) {
                                fallback.style.display = 'flex';
                            }
                        }, { once: true });
                        
                        if (fallback) {
                            fallback.style.display = 'none';
                        }
                        return;
                    }
                }
                
                // Hide fallback and show image when loaded
                if (fallback) {
                    fallback.style.display = 'none';
                }
                this.style.display = 'block';
            });
        }
    });
    
    // Add click handlers
    let dragStarted = false;
    document.querySelectorAll('.site-item').forEach(item => {
        const siteId = item.getAttribute('data-id');
        const site = parentSites.find(s => s.id === siteId);
        
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
            // Don't navigate if clicking down arrow or any of its children
            if (e.target.closest('.down-arrow-icon')) {
                return; // Let the down arrow's own click handler handle it
            }
            // Don't navigate if in edit mode or clicking edit/delete/advanced/move buttons
            const isEditMode = await getEditMode();
            if (isEditMode || e.target.closest('.edit-icon') || e.target.closest('.delete-icon') || e.target.closest('.advanced-icon') || e.target.closest('.move-icon') || e.target.closest('.move-arrow-left') || e.target.closest('.move-arrow-right')) {
                return;
            }
            
            // Mark that this site is being opened via launcher
            await chrome.storage.session.set({ [`launcher_opened_${site.id}`]: true });
            
            window.location.href = site.url;
        });
    });
    
    // Down arrow click handlers are set up globally below (outside renderSites)
    
    // Add edit handlers (always add, but only enable drag in edit mode)
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
            const sites = await getSites();
            const site = sites.find(s => s.id === siteId);
            const childSites = sites.filter(s => s.parentId === siteId);
            
            let confirmMessage = 'Are you sure you want to delete this site?';
            if (childSites.length > 0) {
                confirmMessage += `\n\nThis site has ${childSites.length} sub-site(s). They will also be deleted.`;
            }
            
            if (confirm(confirmMessage)) {
                // Delete the site and all its children
                const filteredSites = sites.filter(s => s.id !== siteId && s.parentId !== siteId);
                await saveSites(filteredSites);
                renderSites();
            }
        });
    });
    
    // Add advanced handlers
    document.querySelectorAll('.advanced-icon').forEach(icon => {
        // Remove any existing listeners to prevent duplicates
        const newIcon = icon.cloneNode(true);
        icon.parentNode.replaceChild(newIcon, icon);
        
        newIcon.addEventListener('click', async (e) => {
            e.stopPropagation();
            e.preventDefault();
            const siteId = newIcon.getAttribute('data-id');
            if (siteId) {
                await openAdvancedModal(siteId);
            }
        });
        
        // Also add mousedown to ensure it works
        newIcon.addEventListener('mousedown', (e) => {
            e.stopPropagation();
        });
    });
    
    // Add move handlers
    document.querySelectorAll('.move-icon').forEach(icon => {
        icon.addEventListener('click', (e) => {
            e.stopPropagation();
            const siteId = icon.getAttribute('data-id');
            activateMoveMode(siteId);
        });
    });
    
    // Add move arrow handlers (delegated event handling for dynamically shown arrows)
    document.addEventListener('click', async (e) => {
        if (e.target.closest('.move-arrow-left') || e.target.closest('.move-arrow-right')) {
            e.stopPropagation();
            const arrow = e.target.closest('.move-arrow-left') || e.target.closest('.move-arrow-right');
            const targetSiteId = arrow.getAttribute('data-id');
            const direction = arrow.getAttribute('data-direction');
            await moveSite(targetSiteId, direction);
        }
    });
    
    // Add drag and drop handlers (only in edit mode)
    if (isEditMode) {
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

// Show edit on hover functions
async function getShowEditOnHover() {
    const result = await chrome.storage.local.get(['showEditOnHover']);
    return result.showEditOnHover || false;
}

async function setShowEditOnHover(enabled) {
    await chrome.storage.local.set({ showEditOnHover: enabled });
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

// Move mode functionality
let moveModeActive = false;
let selectedSiteIdForMove = null;

function activateMoveMode(siteId) {
    moveModeActive = true;
    selectedSiteIdForMove = siteId;
    const sitesGrid = document.getElementById('sitesGrid');
    if (sitesGrid) {
        sitesGrid.classList.add('move-mode');
        sitesGrid.setAttribute('data-moving-site-id', siteId);
    }
    
    // Show arrows on all icons except the selected one
    document.querySelectorAll('.site-item').forEach(item => {
        const itemSiteId = item.getAttribute('data-id');
        if (itemSiteId !== siteId) {
            item.classList.add('show-move-arrows');
        } else {
            item.classList.add('moving-site');
        }
    });
    
    // Add click outside handler to exit move mode
    const exitMoveMode = (e) => {
        if (!e.target.closest('.move-arrow-left') && !e.target.closest('.move-arrow-right') && !e.target.closest('.move-icon')) {
            deactivateMoveMode();
            document.removeEventListener('click', exitMoveMode);
        }
    };
    
    // Use setTimeout to avoid immediate trigger
    setTimeout(() => {
        document.addEventListener('click', exitMoveMode);
    }, 100);
}

function deactivateMoveMode() {
    moveModeActive = false;
    selectedSiteIdForMove = null;
    const sitesGrid = document.getElementById('sitesGrid');
    if (sitesGrid) {
        sitesGrid.classList.remove('move-mode');
        sitesGrid.removeAttribute('data-moving-site-id');
    }
    
    // Remove all move mode classes
    document.querySelectorAll('.site-item').forEach(item => {
        item.classList.remove('show-move-arrows', 'moving-site');
    });
}

async function moveSite(targetSiteId, direction) {
    if (!selectedSiteIdForMove) return;
    
    const sites = await getSites();
    const selectedIndex = sites.findIndex(s => s.id === selectedSiteIdForMove);
    const targetIndex = sites.findIndex(s => s.id === targetSiteId);
    
    if (selectedIndex === -1 || targetIndex === -1) return;
    
    // Don't do anything if trying to move to itself
    if (selectedIndex === targetIndex) {
        deactivateMoveMode();
        return;
    }
    
    // Remove the selected site from its current position
    const site = sites[selectedIndex];
    sites.splice(selectedIndex, 1);
    
    // Calculate new index after removal
    // Note: After removing selectedIndex, all indices after it shift down by 1
    let newIndex;
    if (selectedIndex < targetIndex) {
        // Selected was before target, so target index decreased by 1 after removal
        const adjustedTargetIndex = targetIndex - 1;
        if (direction === 'left') {
            // Move before target
            newIndex = adjustedTargetIndex;
        } else {
            // Move after target
            newIndex = adjustedTargetIndex + 1;
        }
    } else {
        // Selected was after target, so target index is unchanged
        if (direction === 'left') {
            // Move before target
            newIndex = targetIndex;
        } else {
            // Move after target
            newIndex = targetIndex + 1;
        }
    }
    
    // Insert at the new position
    sites.splice(newIndex, 0, site);
    
    // Save the new order
    await saveSites(sites);
    
    // Exit move mode and re-render
    deactivateMoveMode();
    renderSites();
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

// Populate parent dropdown
async function populateParentDropdown(selectElement, excludeId = null) {
    const sites = await getSites();
    const parentSites = sites.filter(site => !site.parentId && site.id !== excludeId);
    
    // Clear existing options except "None"
    selectElement.innerHTML = '<option value="">None (Parent Icon)</option>';
    
    parentSites.forEach(site => {
        const option = document.createElement('option');
        option.value = site.id;
        option.textContent = site.name;
        selectElement.appendChild(option);
    });
}

addSiteBtn.addEventListener('click', async () => {
    addSiteModal.classList.add('active');
    await populateParentDropdown(document.getElementById('siteParent'));
    // Clear any previous errors
    hideError('siteName', 'siteNameError');
    hideError('siteUrl', 'siteUrlError');
    document.getElementById('siteName').focus();
});

// Clear errors when user types
document.getElementById('siteName').addEventListener('input', () => {
    hideError('siteName', 'siteNameError');
});

document.getElementById('siteUrl').addEventListener('input', () => {
    hideError('siteUrl', 'siteUrlError');
});

// Helper function to show error message
function showError(inputId, errorId, message) {
    const errorDiv = document.getElementById(errorId);
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        const input = document.getElementById(inputId);
        if (input) {
            input.style.borderColor = '#ff4444';
        }
    }
}

// Helper function to hide error message
function hideError(inputId, errorId) {
    const errorDiv = document.getElementById(errorId);
    if (errorDiv) {
        errorDiv.style.display = 'none';
        const input = document.getElementById(inputId);
        if (input) {
            input.style.borderColor = '#e0e0e0';
        }
    }
}

addSiteForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Clear previous errors
    hideError('siteName', 'siteNameError');
    hideError('siteUrl', 'siteUrlError');
    
    const name = document.getElementById('siteName').value.trim();
    let url = document.getElementById('siteUrl').value.trim();
    let iconUrl = document.getElementById('siteIconUrl').value.trim();
    const parentId = document.getElementById('siteParent').value || null;
    
    // Validate name
    if (!name) {
        showError('siteName', 'siteNameError', 'Please enter a site name.');
        document.getElementById('siteName').focus();
        return;
    }
    
    // Check for duplicate name
    const sites = await getSites();
    const existingSite = sites.find(s => s.name.toLowerCase() === name.toLowerCase());
    if (existingSite) {
        showError('siteName', 'siteNameError', 'A site with this name already exists. Please use a different name.');
        document.getElementById('siteName').focus();
        return;
    }
    
    // Validate URL
    if (!url) {
        showError('siteUrl', 'siteUrlError', 'Please enter a URL.');
        document.getElementById('siteUrl').focus();
        return;
    }
    
    // Ensure URL has protocol (allow chrome://, chrome-extension://, about:, etc.)
    if (!url.startsWith('http://') && !url.startsWith('https://') && 
        !url.startsWith('chrome://') && !url.startsWith('chrome-extension://') && 
        !url.startsWith('about:') && !url.startsWith('file://')) {
        url = 'https://' + url;
    }
    
    // Validate URL format
    try {
        new URL(url);
    } catch (e) {
        showError('siteUrl', 'siteUrlError', 'Please enter a valid URL.');
        document.getElementById('siteUrl').focus();
        return;
    }
    
    // Ensure icon URL has protocol if provided
    if (iconUrl && !iconUrl.startsWith('http://') && !iconUrl.startsWith('https://') && !iconUrl.startsWith('data:')) {
        iconUrl = 'https://' + iconUrl;
    }
    
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
    
    // Add parentId if selected
    if (parentId) {
        newSite.parentId = parentId;
    }
    
    sites.push(newSite);
    await saveSites(sites);
    
    addSiteModal.classList.remove('active');
    addSiteForm.reset();
    hideError('siteName', 'siteNameError');
    hideError('siteUrl', 'siteUrlError');
    renderSites();
});

// Edit site modal
const editSiteModal = document.getElementById('editSiteModal');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const editSiteForm = document.getElementById('editSiteForm');
const deleteSiteBtn = document.getElementById('deleteSiteBtn');

// Advanced scripts modal - initialize after DOM is ready
let advancedScriptsModal, cancelAdvancedBtn, advancedScriptsForm, addScriptBtn, scriptsContainer;

// Initialize modal elements
function initAdvancedModalElements() {
    advancedScriptsModal = document.getElementById('advancedScriptsModal');
    cancelAdvancedBtn = document.getElementById('cancelAdvancedBtn');
    advancedScriptsForm = document.getElementById('advancedScriptsForm');
    addScriptBtn = document.getElementById('addScriptBtn');
    scriptsContainer = document.getElementById('scriptsContainer');
    
    if (!advancedScriptsModal || !cancelAdvancedBtn || !advancedScriptsForm || !addScriptBtn || !scriptsContainer) {
        console.error('Advanced modal elements not found:', {
            advancedScriptsModal: !!advancedScriptsModal,
            cancelAdvancedBtn: !!cancelAdvancedBtn,
            advancedScriptsForm: !!advancedScriptsForm,
            addScriptBtn: !!addScriptBtn,
            scriptsContainer: !!scriptsContainer
        });
        return false;
    }
    return true;
}

async function openEditModal(siteId) {
    const sites = await getSites();
    const site = sites.find(s => s.id === siteId);
    
    if (!site) return;
    
    document.getElementById('editSiteId').value = site.id;
    document.getElementById('editSiteName').value = site.name;
    document.getElementById('editSiteUrl').value = site.url;
    document.getElementById('editSiteIconUrl').value = site.iconUrl || '';
    
    // Populate and set parent dropdown
    await populateParentDropdown(document.getElementById('editSiteParent'), site.id);
    document.getElementById('editSiteParent').value = site.parentId || '';
    
    // Clear any previous errors
    hideError('editSiteName', 'editSiteNameError');
    hideError('editSiteUrl', 'editSiteUrlError');
    
    editSiteModal.classList.add('active');
    // Ensure edit modal appears above sub-launcher modal
    editSiteModal.style.zIndex = '1002';
}

// Clear errors when user types in edit form
document.getElementById('editSiteName').addEventListener('input', () => {
    hideError('editSiteName', 'editSiteNameError');
});

document.getElementById('editSiteUrl').addEventListener('input', () => {
    hideError('editSiteUrl', 'editSiteUrlError');
});

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
    
    // Clear previous errors
    hideError('editSiteName', 'editSiteNameError');
    hideError('editSiteUrl', 'editSiteUrlError');
    
    const siteId = document.getElementById('editSiteId').value;
    const name = document.getElementById('editSiteName').value.trim();
    let url = document.getElementById('editSiteUrl').value.trim();
    let iconUrl = document.getElementById('editSiteIconUrl').value.trim();
    const parentId = document.getElementById('editSiteParent').value || null;
    
    // Validate name
    if (!name) {
        showError('editSiteName', 'editSiteNameError', 'Please enter a site name.');
        document.getElementById('editSiteName').focus();
        return;
    }
    
    // Check for duplicate name (excluding current site)
    const sites = await getSites();
    const existingSite = sites.find(s => s.id !== siteId && s.name.toLowerCase() === name.toLowerCase());
    if (existingSite) {
        showError('editSiteName', 'editSiteNameError', 'A site with this name already exists. Please use a different name.');
        document.getElementById('editSiteName').focus();
        return;
    }
    
    // Validate URL
    if (!url) {
        showError('editSiteUrl', 'editSiteUrlError', 'Please enter a URL.');
        document.getElementById('editSiteUrl').focus();
        return;
    }
    
    // Ensure URL has protocol (allow chrome://, chrome-extension://, about:, etc.)
    if (!url.startsWith('http://') && !url.startsWith('https://') && 
        !url.startsWith('chrome://') && !url.startsWith('chrome-extension://') && 
        !url.startsWith('about:') && !url.startsWith('file://')) {
        url = 'https://' + url;
    }
    
    // Validate URL format
    try {
        new URL(url);
    } catch (e) {
        showError('editSiteUrl', 'editSiteUrlError', 'Please enter a valid URL.');
        document.getElementById('editSiteUrl').focus();
        return;
    }
    
    // Ensure icon URL has protocol if provided
    if (iconUrl && !iconUrl.startsWith('http://') && !iconUrl.startsWith('https://') && !iconUrl.startsWith('data:')) {
        iconUrl = 'https://' + iconUrl;
    }
    
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
        
        // Set parentId or remove it if empty
        if (parentId) {
            updatedSite.parentId = parentId;
        } else {
            delete updatedSite.parentId;
        }
        
        sites[siteIndex] = updatedSite;
        await saveSites(sites);
    }
    
    editSiteModal.classList.remove('active');
    editSiteForm.reset();
    hideError('editSiteName', 'editSiteNameError');
    hideError('editSiteUrl', 'editSiteUrlError');
    renderSites();
    
    // If sub-launcher modal is open, refresh it if:
    // 1. The edited site is a child of the currently open parent, OR
    // 2. The edited site IS the currently open parent
    if (currentOpenSubLauncherParentId) {
        const updatedSites = await getSites();
        const editedSite = updatedSites.find(s => s.id === siteId);
        if (editedSite && (
            editedSite.parentId === currentOpenSubLauncherParentId ||
            editedSite.id === currentOpenSubLauncherParentId
        )) {
            openSubLauncherModal(currentOpenSubLauncherParentId);
        }
    }
});

deleteSiteBtn.addEventListener('click', async () => {
    const siteId = document.getElementById('editSiteId').value;
    const sites = await getSites();
    const site = sites.find(s => s.id === siteId);
    const childSites = sites.filter(s => s.parentId === siteId);
    
    let confirmMessage = 'Are you sure you want to delete this site?';
    if (childSites.length > 0) {
        confirmMessage += `\n\nThis site has ${childSites.length} sub-site(s). They will also be deleted.`;
    }
    
    if (!confirm(confirmMessage)) {
        return;
    }
    
    // Delete the site and all its children
    const filteredSites = sites.filter(s => s.id !== siteId && s.parentId !== siteId);
    
    await saveSites(filteredSites);
    
    editSiteModal.classList.remove('active');
    editSiteForm.reset();
    renderSites();
});

// Duplicate site button
const duplicateSiteBtn = document.getElementById('duplicateSiteBtn');
duplicateSiteBtn.addEventListener('click', async () => {
    const siteId = document.getElementById('editSiteId').value;
    const sites = await getSites();
    const site = sites.find(s => s.id === siteId);
    
    if (!site) return;
    
    // Find the next available copy number
    const baseName = site.name;
    const copyPattern = /^(.+?)\s*\(copy\s+(\d+)\)$/i;
    const match = baseName.match(copyPattern);
    const originalName = match ? match[1] : baseName;
    
    // Find all existing copies
    const existingCopies = sites.filter(s => {
        if (s.name === originalName) return true;
        const siteMatch = s.name.match(copyPattern);
        return siteMatch && siteMatch[1] === originalName;
    });
    
    // Find the highest copy number
    let maxCopyNumber = 0;
    existingCopies.forEach(s => {
        if (s.name === originalName) {
            maxCopyNumber = Math.max(maxCopyNumber, 0);
        } else {
            const siteMatch = s.name.match(copyPattern);
            if (siteMatch) {
                const copyNum = parseInt(siteMatch[2], 10);
                maxCopyNumber = Math.max(maxCopyNumber, copyNum);
            }
        }
    });
    
    // Create new copy number
    const newCopyNumber = maxCopyNumber + 1;
    const newName = newCopyNumber === 1 
        ? `${originalName} (copy 1)`
        : `${originalName} (copy ${newCopyNumber})`;
    
    // Create duplicate site with all the same data
    const duplicatedSite = {
        id: Date.now().toString(),
        name: newName,
        url: site.url,
        createdAt: Date.now(),
        parentId: site.parentId || undefined
    };
    
    // Copy iconUrl if it exists
    if (site.iconUrl) {
        duplicatedSite.iconUrl = site.iconUrl;
    }
    
    // Copy advanced scripts if they exist
    if (site.scripts && Array.isArray(site.scripts)) {
        duplicatedSite.scripts = [...site.scripts];
    }
    
    // Add the duplicated site
    sites.push(duplicatedSite);
    await saveSites(sites);
    
    // Close modal and re-render
    editSiteModal.classList.remove('active');
    editSiteForm.reset();
    renderSites();
    
    // If sub-launcher modal is open, refresh it if the duplicated site is a child of the currently open parent
    if (currentOpenSubLauncherParentId) {
        const updatedSites = await getSites();
        const duplicatedSiteUpdated = updatedSites.find(s => s.id === duplicatedSite.id);
        if (duplicatedSiteUpdated && duplicatedSiteUpdated.parentId === currentOpenSubLauncherParentId) {
            openSubLauncherModal(currentOpenSubLauncherParentId);
        }
    }
});

// Keyboard shortcuts
// Note: Cmd/Ctrl + N is reserved by Chrome for "New Window"
// We could use other shortcuts here if needed in the future

// Clean up Chrome's injected elements
function cleanUpChromeUI() {
    // Remove all elements that aren't our extension's content
    const allowedIds = ['sitesGrid', 'addSiteBtn', 'themeBtn', 'addSiteModal', 'editSiteModal', 'themeModal', 'advancedScriptsModal'];
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

// Set text color for modal based on background brightness
// Use the same approach as main page - set CSS variables on the modal element
function setAdaptiveTextColorForModal(brightness) {
    const modal = document.getElementById('subLauncherModal');
    if (!modal) {
        return;
    }
    
    // Use the same CSS variable names as the main page
    // The site-name class already uses var(--text-color) from CSS
    // Set on the modal element so all children inherit it
    if (brightness > 128) {
        modal.style.setProperty('--text-color', '#1a1a1a');
        modal.style.setProperty('--text-color-secondary', '#4a4a4a');
    } else {
        modal.style.setProperty('--text-color', '#ffffff');
        modal.style.setProperty('--text-color-secondary', '#e0e0e0');
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
    
    // Render scripts if scripts page is shown
    if (pageId === 'scripts') {
        renderGlobalScripts();
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

// Handle file input change for immediate preview
const localImageInput = document.getElementById('localImage');
if (localImageInput) {
    localImageInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            // Validate file type
            if (!file.type.startsWith('image/')) {
                alert('Please select a valid image file');
                e.target.value = '';
                return;
            }
            
            // Show preview in the uploaded images section
            const reader = new FileReader();
            reader.onload = async (event) => {
                const dataUrl = event.target.result;
                
                // Add to custom images list immediately
                const result = await chrome.storage.local.get(['customImages']);
                const customImages = result.customImages || [];
                if (!customImages.includes(dataUrl)) {
                    customImages.push(dataUrl);
                    await chrome.storage.local.set({ customImages });
                }
                
                // Refresh the image presets to show the new image
                await populateDefaultImages();
                
                // Pre-select the uploaded image
                const imagePresets = document.querySelectorAll('.image-preset');
                imagePresets.forEach(preset => {
                    if (preset.getAttribute('data-url') === dataUrl) {
                        preset.classList.add('selected');
                        document.getElementById('imageUrl').value = dataUrl;
                    }
                });
            };
            
            reader.onerror = () => {
                alert('Error reading image file. Please try again.');
                e.target.value = '';
            };
            
            reader.readAsDataURL(file);
        }
    });
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
            
            reader.onload = async (event) => {
                try {
                    const dataUrl = event.target.result;
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
                    themeForm.reset();
                } catch (error) {
                    console.error('Error saving theme:', error);
                    alert('Error saving theme. Please try again.');
                }
            };
            
            reader.onerror = () => {
                alert('Error reading image file. Please try again.');
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

// Export all data
exportBtn.addEventListener('click', async () => {
    // Get all data from storage
    const allData = await chrome.storage.local.get(null);
    
    // Create export object with metadata
    const exportData = {
        version: '1.0.0',
        exportDate: new Date().toISOString(),
        data: {
            sites: allData.sites || [],
            theme: allData.theme || null,
            iconSize: allData.iconSize || 100,
            customImages: allData.customImages || [],
            showEditOnHover: allData.showEditOnHover || false,
            globalScripts: allData.globalScripts || []
        }
    };
    
    // Create JSON blob
    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    // Create download link
    const link = document.createElement('a');
    link.href = url;
    link.download = `site-launcher-data-${new Date().toISOString().split('T')[0]}.json`;
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

// Import all data
importBtn.addEventListener('click', async () => {
    const file = importFile.files[0];
    if (!file) {
        showImportStatus('Please select a JSON file', 'error');
        return;
    }
    
    const importMode = document.querySelector('input[name="importMode"]:checked').value;
    
    try {
        const text = await file.text();
        const importedData = JSON.parse(text);
        
        // Support both old format (array of sites) and new format (object with data property)
        let dataToImport;
        if (Array.isArray(importedData)) {
            // Old format - just sites array
            dataToImport = { sites: importedData };
        } else if (importedData.data && typeof importedData.data === 'object') {
            // New format - object with data property
            dataToImport = importedData.data;
        } else if (importedData.sites) {
            // Direct data object
            dataToImport = importedData;
        } else {
            throw new Error('Invalid JSON format: Expected an array of sites or a data object');
        }
        
        const importedSites = dataToImport.sites || [];
        
        // Validate sites if present
        if (importedSites.length > 0) {
            for (const site of importedSites) {
                if (!site.name || !site.url) {
                    throw new Error('Invalid site format: Each site must have "name" and "url" fields');
                }
            }
        }
        
        let finalSites;
        let message = [];
        
        if (importMode === 'replace') {
            // Replace all data
            if (importedSites.length > 0) {
                finalSites = importedSites.map((site, index) => ({
                    ...site,
                    id: site.id || `imported-${Date.now()}-${index}`,
                    createdAt: site.createdAt || Date.now()
                }));
                await saveSites(finalSites);
                message.push(`${importedSites.length} site(s) replaced`);
            }
            
            // Import theme
            if (dataToImport.theme) {
                await chrome.storage.local.set({ theme: dataToImport.theme });
                applyTheme(dataToImport.theme);
                message.push('Theme imported');
            }
            
            // Import icon size
            if (dataToImport.iconSize !== undefined) {
                await saveIconSize(dataToImport.iconSize);
                message.push('Icon size imported');
            }
            
            // Import custom images
            if (dataToImport.customImages && Array.isArray(dataToImport.customImages)) {
                await chrome.storage.local.set({ customImages: dataToImport.customImages });
                message.push(`${dataToImport.customImages.length} custom image(s) imported`);
            }
            
            // Import showEditOnHover
            if (dataToImport.showEditOnHover !== undefined) {
                await setShowEditOnHover(dataToImport.showEditOnHover);
                message.push('Settings imported');
            }
            
            // Import global scripts
            if (dataToImport.globalScripts && Array.isArray(dataToImport.globalScripts)) {
                await chrome.storage.local.set({ globalScripts: dataToImport.globalScripts });
                message.push(`${dataToImport.globalScripts.length} global script(s) imported`);
            }
            
            showImportStatus(`Successfully imported: ${message.join(', ')}. All data replaced.`, 'success');
        } else {
            // Merge with existing data
            if (importedSites.length > 0) {
                const existingSites = await getSites();
                const existingUrls = new Set(existingSites.map(s => s.url));
                
                const newSites = importedSites
                    .filter(site => !existingUrls.has(site.url))
                    .map((site, index) => ({
                        ...site,
                        id: site.id || `imported-${Date.now()}-${index}`,
                        createdAt: site.createdAt || Date.now()
                    }));
                
                finalSites = [...existingSites, ...newSites];
                await saveSites(finalSites);
                
                const skippedCount = importedSites.length - newSites.length;
                if (newSites.length > 0) {
                    message.push(`${newSites.length} new site(s) added`);
                }
                if (skippedCount > 0) {
                    message.push(`${skippedCount} duplicate site(s) skipped`);
                }
            }
            
            // Merge theme (only if not already set, or if imported theme exists)
            if (dataToImport.theme) {
                const currentTheme = await chrome.storage.local.get(['theme']);
                if (!currentTheme.theme || importMode === 'replace') {
                    await chrome.storage.local.set({ theme: dataToImport.theme });
                    applyTheme(dataToImport.theme);
                    message.push('Theme imported');
                }
            }
            
            // Merge icon size
            if (dataToImport.iconSize !== undefined) {
                await saveIconSize(dataToImport.iconSize);
                message.push('Icon size updated');
            }
            
            // Merge custom images
            if (dataToImport.customImages && Array.isArray(dataToImport.customImages)) {
                const currentImages = await chrome.storage.local.get(['customImages']);
                const existingImages = currentImages.customImages || [];
                const newImages = dataToImport.customImages.filter(img => !existingImages.includes(img));
                if (newImages.length > 0) {
                    await chrome.storage.local.set({ customImages: [...existingImages, ...newImages] });
                    message.push(`${newImages.length} new custom image(s) added`);
                }
            }
            
            // Merge showEditOnHover
            if (dataToImport.showEditOnHover !== undefined) {
                await setShowEditOnHover(dataToImport.showEditOnHover);
                message.push('Settings updated');
            }
            
            // Merge global scripts
            if (dataToImport.globalScripts && Array.isArray(dataToImport.globalScripts)) {
                const currentScripts = await getGlobalScripts();
                const existingNames = new Set(currentScripts.map(s => s.name));
                const newScripts = dataToImport.globalScripts.filter(s => !existingNames.has(s.name));
                if (newScripts.length > 0) {
                    await chrome.storage.local.set({ globalScripts: [...currentScripts, ...newScripts] });
                    message.push(`${newScripts.length} new global script(s) added`);
                }
            }
            
            showImportStatus(`Successfully imported: ${message.join(', ')}.`, 'success');
        }
        
        // Reset file input
        importFile.value = '';
        importBtn.disabled = true;
        
        // Reload everything
        renderSites();
        loadTheme();
        loadIconSize();
        renderGlobalScripts();
        
        // Close modal after a delay
        setTimeout(() => {
            themeModal.classList.remove('active');
            importStatus.style.display = 'none';
        }, 3000);
        
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
const showEditOnHoverCheckbox = document.getElementById('showEditOnHover');

// Load show edit on hover preference
async function loadShowEditOnHoverPreference() {
    if (showEditOnHoverCheckbox) {
        const showOnHover = await getShowEditOnHover();
        showEditOnHoverCheckbox.checked = showOnHover;
    }
}

// Show edit on hover toggle handler
if (showEditOnHoverCheckbox) {
    showEditOnHoverCheckbox.addEventListener('change', async (e) => {
        await setShowEditOnHover(e.target.checked);
        renderSites();
    });
}

// Load preference when edit page is shown
const editPage = document.getElementById('editPage');
if (editPage) {
    const observer = new MutationObserver((mutations) => {
        if (editPage.classList.contains('active')) {
            loadShowEditOnHoverPreference();
        }
    });
    observer.observe(editPage, {
        attributes: true,
        attributeFilter: ['class']
    });
}

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

// Advanced scripts modal functions
let scriptCounter = 0;

function createScriptItem(script = null) {
    const scriptId = scriptCounter++;
    const scriptItem = document.createElement('div');
    scriptItem.className = 'script-item';
    scriptItem.dataset.scriptId = scriptId;
    
    const timing = script?.timing || 'document_end';
    const code = script?.code || '';
    const runAlways = script?.runAlways !== false; // Default to true (always run)
    const confirmPopup = script?.confirmPopup || false; // Default to false
    
    const timingSelectId = `script-timing-${scriptId}`;
    const codeTextareaId = `script-code-${scriptId}`;
    scriptItem.innerHTML = `
        <div class="script-item-header">
            <h4 style="margin: 0; font-size: 13px; font-weight: 600; color: #333;">Script ${scriptId + 1}</h4>
            <button type="button" class="remove-script-btn" data-script-id="${scriptId}">Remove</button>
        </div>
        <div class="form-group" style="margin-bottom: 10px;">
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <input type="checkbox" class="script-run-always" name="script-run-always-${scriptId}" data-script-id="${scriptId}" ${runAlways ? 'checked' : ''}>
                <span>Run always (even if not opened via launcher)</span>
            </label>
            <small style="display: block; margin-top: 4px; color: #666; font-size: 12px; margin-left: 24px;">
                Uncheck to run only when opened via launcher
            </small>
        </div>
        <div class="form-group" style="margin-bottom: 10px;">
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <input type="checkbox" class="script-confirm-popup" name="script-confirm-popup-${scriptId}" data-script-id="${scriptId}" ${confirmPopup ? 'checked' : ''}>
                <span>Confirm Popup</span>
            </label>
            <small style="display: block; margin-top: 4px; color: #666; font-size: 12px; margin-left: 24px;">
                Shows a confirmation popup before executing the script. Press Enter to confirm or Esc to cancel.
            </small>
        </div>
        <label for="${timingSelectId}" style="display: block; margin-bottom: 8px; color: #555; font-weight: 500; font-size: 13px;">Execution Timing</label>
        <select id="${timingSelectId}" class="script-timing-select" name="script-timing-${scriptId}" data-script-id="${scriptId}">
            <option value="document_start" ${timing === 'document_start' ? 'selected' : ''}>Before DOM (document_start)</option>
            <option value="document_end" ${timing === 'document_end' ? 'selected' : ''}>After DOM (document_end)</option>
            <option value="document_idle" ${timing === 'document_idle' ? 'selected' : ''}>After Page Load (document_idle)</option>
        </select>
        <label for="${codeTextareaId}" style="display: block; margin-top: 10px; margin-bottom: 8px; color: #555; font-weight: 500; font-size: 13px;">Script Code</label>
        <textarea id="${codeTextareaId}" class="script-code-textarea" name="script-code-${scriptId}" placeholder="Enter your JavaScript code here..." data-script-id="${scriptId}">${code}</textarea>
    `;
    
    // Add remove button handler
    const removeBtn = scriptItem.querySelector('.remove-script-btn');
    removeBtn.addEventListener('click', () => {
        scriptItem.remove();
    });
    
    return scriptItem;
}

async function openAdvancedModal(siteId) {
    try {
        if (!initAdvancedModalElements()) {
            return;
        }
        
        if (!advancedScriptsModal || !scriptsContainer) {
            return;
        }
        
        const sites = await getSites();
        const site = sites.find(s => s.id === siteId);
        
        if (!site) {
            return;
        }
        
        const advancedSiteIdInput = document.getElementById('advancedSiteId');
        if (!advancedSiteIdInput) {
            return;
        }
        
        advancedSiteIdInput.value = site.id;
        scriptsContainer.innerHTML = '';
        scriptCounter = 0;
        
        if (site.scripts && site.scripts.length > 0) {
            site.scripts.forEach(script => {
                scriptsContainer.appendChild(createScriptItem(script));
            });
        } else {
            scriptsContainer.appendChild(createScriptItem());
        }
        
        advancedScriptsModal.classList.add('active');
        advancedScriptsModal.style.setProperty('display', 'flex', 'important');
        advancedScriptsModal.style.setProperty('visibility', 'visible', 'important');
        advancedScriptsModal.style.setProperty('opacity', '1', 'important');
        advancedScriptsModal.style.setProperty('z-index', '1000', 'important');
        advancedScriptsModal.style.setProperty('pointer-events', 'auto', 'important');
        
        void advancedScriptsModal.offsetWidth;
    } catch (error) {
        console.error('Error opening advanced modal:', error);
    }
}

// Setup advanced modal event listeners
function setupAdvancedModalListeners() {
    if (!initAdvancedModalElements()) {
        console.error('Failed to initialize advanced modal elements');
        return;
    }
    
    cancelAdvancedBtn.addEventListener('click', () => {
        advancedScriptsModal.classList.remove('active');
        advancedScriptsModal.style.display = ''; // Remove inline style
        scriptsContainer.innerHTML = '';
        scriptCounter = 0;
    });

    advancedScriptsModal.addEventListener('click', (e) => {
        if (e.target === advancedScriptsModal) {
            advancedScriptsModal.classList.remove('active');
            advancedScriptsModal.style.display = ''; // Remove inline style
            scriptsContainer.innerHTML = '';
            scriptCounter = 0;
        }
    });

    addScriptBtn.addEventListener('click', () => {
        const scriptItem = createScriptItem();
        scriptsContainer.appendChild(scriptItem);
    });

    advancedScriptsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const siteId = document.getElementById('advancedSiteId').value;
        const scriptItems = scriptsContainer.querySelectorAll('.script-item');
        
        const scripts = [];
        scriptItems.forEach(item => {
            const scriptId = item.dataset.scriptId;
            const timing = item.querySelector('.script-timing-select').value;
            const code = item.querySelector('.script-code-textarea').value.trim();
            const runAlways = item.querySelector('.script-run-always').checked;
            const confirmPopup = item.querySelector('.script-confirm-popup').checked;
            
            if (code) {
                scripts.push({
                    timing,
                    code,
                    runAlways,
                    confirmPopup: confirmPopup || false
                });
            }
        });
        
        const sites = await getSites();
        const siteIndex = sites.findIndex(s => s.id === siteId);
        
        if (siteIndex !== -1) {
            if (scripts.length > 0) {
                sites[siteIndex].scripts = scripts;
            } else {
                delete sites[siteIndex].scripts;
            }
            await saveSites(sites);
        }
        
        advancedScriptsModal.classList.remove('active');
        advancedScriptsModal.style.display = '';
        scriptsContainer.innerHTML = '';
        scriptCounter = 0;
    });
}

// Initialize advanced modal listeners
setupAdvancedModalListeners();

// ==================== Global Scripts Management ====================

let globalScriptCodeCounter = 0;

// Get global scripts from storage
async function getGlobalScripts() {
    const result = await chrome.storage.local.get(['globalScripts']);
    return result.globalScripts || [];
}

// Save global scripts to storage
async function saveGlobalScripts(scripts) {
    await chrome.storage.local.set({ globalScripts: scripts });
}

// Create a script code block item
function createGlobalScriptCodeItem(scriptCode = null) {
    const codeId = globalScriptCodeCounter++;
    const codeItem = document.createElement('div');
    codeItem.className = 'global-script-code-item';
    codeItem.dataset.codeId = codeId;
    
    const timing = scriptCode?.timing || 'document_end';
    const code = scriptCode?.code || '';
    
    const timingSelectId = `script-code-timing-${codeId}`;
    const codeTextareaId = `script-code-text-${codeId}`;
    codeItem.innerHTML = `
        <div class="script-code-item-header">
            <h4 style="margin: 0; font-size: 13px; font-weight: 600; color: #333;">Code Block ${codeId + 1}</h4>
            <button type="button" class="remove-script-code-btn" data-code-id="${codeId}">Remove</button>
        </div>
        <label for="${timingSelectId}" style="display: block; margin-bottom: 8px; color: #555; font-weight: 500; font-size: 13px;">Execution Timing</label>
        <select id="${timingSelectId}" class="script-code-timing-select" name="script-code-timing-${codeId}" data-code-id="${codeId}" style="width: 100%; padding: 10px; border: 2px solid #e0e0e0; border-radius: 8px; margin-bottom: 10px; font-size: 14px;">
            <option value="document_start" ${timing === 'document_start' ? 'selected' : ''}>Before DOM (document_start)</option>
            <option value="document_end" ${timing === 'document_end' ? 'selected' : ''}>After DOM (document_end)</option>
            <option value="document_idle" ${timing === 'document_idle' ? 'selected' : ''}>After Page Load (document_idle)</option>
        </select>
        <label for="${codeTextareaId}" style="display: block; margin-bottom: 8px; color: #555; font-weight: 500; font-size: 13px;">Script Code</label>
        <textarea id="${codeTextareaId}" class="script-code-textarea" name="script-code-text-${codeId}" placeholder="Enter your JavaScript code here..." data-code-id="${codeId}" style="width: 100%; min-height: 150px; padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px; font-family: 'Courier New', monospace; font-size: 13px; resize: vertical;">${code}</textarea>
    `;
    
    // Add remove button handler
    const removeBtn = codeItem.querySelector('.remove-script-code-btn');
    removeBtn.addEventListener('click', () => {
        codeItem.remove();
    });
    
    return codeItem;
}

// Render global scripts list
async function renderGlobalScripts() {
    const scripts = await getGlobalScripts();
    const container = document.getElementById('globalScriptsContainer');
    
    if (!container) return;
    
    if (scripts.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="padding: 40px 20px;">
                <p style="color: #666; font-size: 14px;">No global scripts yet. Click "Create New Script" to add one.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = scripts.map(script => {
        const whenToRunLabels = {
            'on_site_open': 'On Site Open',
            'navigating_in': 'Navigating In',
            'navigating_out': 'Navigating Out'
        };
        
        const options = [];
        if (script.onRefresh) options.push('On Refresh');
        if (script.confirmPopup) options.push('Confirm Popup');
        const optionsText = options.length > 0 ? ` • ${options.join(', ')}` : '';
        
        return `
            <div class="global-script-item" data-script-id="${script.id}">
                <div class="global-script-item-header">
                    <div>
                        <h3 style="margin: 0; font-size: 16px; color: #333;">${escapeHtml(script.name)}</h3>
                        <p style="margin: 4px 0 0 0; font-size: 12px; color: #666;">
                            ${whenToRunLabels[script.whenToRun] || script.whenToRun} • Pattern: <code style="background: #f0f0f0; padding: 2px 6px; border-radius: 3px; font-size: 11px;">${escapeHtml(script.domainPattern)}</code>${optionsText}
                        </p>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button type="button" class="edit-global-script-btn" data-script-id="${script.id}" style="padding: 8px 16px; background: #667eea; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px;">Edit</button>
                        <button type="button" class="delete-global-script-btn" data-script-id="${script.id}" style="padding: 8px 16px; background: #ff4444; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px;">Delete</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    // Add event listeners
    container.querySelectorAll('.edit-global-script-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const scriptId = btn.getAttribute('data-script-id');
            await openGlobalScriptModal(scriptId);
        });
    });
    
    container.querySelectorAll('.delete-global-script-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const scriptId = btn.getAttribute('data-script-id');
            if (confirm('Are you sure you want to delete this global script?')) {
                const scripts = await getGlobalScripts();
                const filtered = scripts.filter(s => s.id !== scriptId);
                await saveGlobalScripts(filtered);
                renderGlobalScripts();
            }
        });
    });
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Open global script modal for create or edit
async function openGlobalScriptModal(scriptId = null) {
    const modal = document.getElementById('globalScriptModal');
    const form = document.getElementById('globalScriptForm');
    const title = document.getElementById('globalScriptModalTitle');
    const deleteBtn = document.getElementById('deleteGlobalScriptBtn');
    const codeContainer = document.getElementById('globalScriptsCodeContainer');
    
    if (!modal) {
        console.error('globalScriptModal not found');
        return;
    }
    if (!form) {
        console.error('globalScriptForm not found');
        return;
    }
    if (!codeContainer) {
        console.error('globalScriptsCodeContainer not found');
        return;
    }
    
    // Reset form
    form.reset();
    globalScriptCodeCounter = 0;
    codeContainer.innerHTML = '';
    
    if (scriptId) {
        // Edit mode
        if (title) {
            title.textContent = 'Edit Global Script';
        }
        if (deleteBtn) {
            deleteBtn.style.display = 'block';
        }
        
        const scripts = await getGlobalScripts();
        const script = scripts.find(s => s.id === scriptId);
        
        if (script) {
            const scriptIdInput = document.getElementById('globalScriptId');
            const nameInput = document.getElementById('globalScriptName');
            const whenToRunInput = document.getElementById('globalScriptWhenToRun');
            const domainPatternInput = document.getElementById('globalScriptDomainPattern');
            const onRefreshCheckbox = document.getElementById('globalScriptOnRefresh');
            const confirmPopupCheckbox = document.getElementById('globalScriptConfirmPopup');
            
            if (scriptIdInput) scriptIdInput.value = script.id;
            if (nameInput) nameInput.value = script.name;
            if (whenToRunInput) whenToRunInput.value = script.whenToRun;
            if (domainPatternInput) domainPatternInput.value = script.domainPattern;
            if (onRefreshCheckbox) onRefreshCheckbox.checked = script.onRefresh || false;
            if (confirmPopupCheckbox) confirmPopupCheckbox.checked = script.confirmPopup || false;
            
            // Add script code blocks
            if (script.scripts && script.scripts.length > 0) {
                script.scripts.forEach(scriptCode => {
                    codeContainer.appendChild(createGlobalScriptCodeItem(scriptCode));
                });
            } else {
                codeContainer.appendChild(createGlobalScriptCodeItem());
            }
        }
    } else {
        // Create mode
        if (title) {
            title.textContent = 'Create Global Script';
        }
        if (deleteBtn) {
            deleteBtn.style.display = 'none';
        }
        codeContainer.appendChild(createGlobalScriptCodeItem());
    }
    
    // Force modal to be visible
    modal.classList.add('active');
    modal.style.display = 'flex';
    modal.style.visibility = 'visible';
    modal.style.opacity = '1';
    modal.style.zIndex = '1000';
    modal.style.pointerEvents = 'auto';
    
    // Force a reflow to ensure styles are applied
    void modal.offsetWidth;
}


// Setup global scripts page
function setupGlobalScriptsPage() {
    const createBtn = document.getElementById('createScriptBtn');
    const modal = document.getElementById('globalScriptModal');
    const form = document.getElementById('globalScriptForm');
    const cancelBtn = document.getElementById('cancelGlobalScriptBtn');
    const deleteBtn = document.getElementById('deleteGlobalScriptBtn');
    const addCodeBtn = document.getElementById('addGlobalScriptCodeBtn');
    const codeContainer = document.getElementById('globalScriptsCodeContainer');
    const whenToRunSelect = document.getElementById('globalScriptWhenToRun');
    
    if (!createBtn) {
        console.error('createScriptBtn not found');
        return;
    }
    if (!modal) {
        console.error('globalScriptModal not found');
        return;
    }
    if (!form) {
        console.error('globalScriptForm not found');
        return;
    }
    
    // Create button - check if listener already attached
    if (!createBtn.dataset.listenerAttached) {
        createBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openGlobalScriptModal();
        });
        createBtn.dataset.listenerAttached = 'true';
    }
    
    
    // Helper function to close modal
    const closeModal = () => {
        modal.classList.remove('active');
        // Clear inline styles
        modal.style.display = '';
        modal.style.visibility = '';
        modal.style.opacity = '';
        modal.style.zIndex = '';
        modal.style.pointerEvents = '';
        form.reset();
        globalScriptCodeCounter = 0;
        if (codeContainer) {
            codeContainer.innerHTML = '';
        }
    };
    
    // Cancel button
    if (cancelBtn) {
        cancelBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            closeModal();
        });
    }
    
    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            e.preventDefault();
            e.stopPropagation();
            closeModal();
        }
    });
    
    // Add code block button
    if (addCodeBtn && codeContainer) {
        addCodeBtn.addEventListener('click', () => {
            codeContainer.appendChild(createGlobalScriptCodeItem());
        });
    }
    
    // Delete button
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
            const scriptId = document.getElementById('globalScriptId')?.value;
            if (!scriptId) return;
            
            if (confirm('Are you sure you want to delete this global script?')) {
                const scripts = await getGlobalScripts();
                const filtered = scripts.filter(s => s.id !== scriptId);
                await saveGlobalScripts(filtered);
                closeModal();
                renderGlobalScripts();
            }
        });
    }
    
    // Form submission - check if listener already attached
    if (!form.dataset.submitListenerAttached) {
        form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const scriptId = document.getElementById('globalScriptId').value;
        const name = document.getElementById('globalScriptName').value.trim();
        const whenToRun = document.getElementById('globalScriptWhenToRun').value;
        const domainPattern = document.getElementById('globalScriptDomainPattern').value.trim();
        const onRefresh = document.getElementById('globalScriptOnRefresh').checked;
        const confirmPopup = document.getElementById('globalScriptConfirmPopup').checked;
        
        if (!name || !whenToRun || !domainPattern) {
            alert('Please fill in all required fields');
            return;
        }
        
        // Validate domain pattern (basic validation for wildcard patterns with optional paths)
        if (!domainPattern || domainPattern.trim().length === 0) {
            alert('Please enter a domain pattern.');
            return;
        }
        
        // Split pattern into domain and path parts
        const [domainPart, ...pathParts] = domainPattern.split('/');
        const pathPart = pathParts.length > 0 ? '/' + pathParts.join('/') : '';
        
        // Validate domain part: should contain at least one dot or be a valid domain-like pattern
        // Allow wildcards anywhere in the domain (e.g., some*.example.com)
        const domainPatternRegex = /^([a-zA-Z0-9*]([a-zA-Z0-9-*]*[a-zA-Z0-9*])?\.)*[a-zA-Z0-9*]([a-zA-Z0-9-*]*[a-zA-Z0-9*])?$/;
        if (!domainPatternRegex.test(domainPart)) {
            alert('Invalid domain pattern. Please use a valid domain format like "example.com", "*.example.com", "some*.example.com", or "some.example.com/auth/login".');
            return;
        }
        
        // Validate path part if present (should start with / and contain valid path characters)
        if (pathPart && !/^\/[a-zA-Z0-9\-_\/\.]*$/.test(pathPart)) {
            alert('Invalid path in domain pattern. Path should start with / and contain only letters, numbers, hyphens, underscores, dots, and slashes.');
            return;
        }
        
        // Collect script code blocks
        const codeItems = codeContainer.querySelectorAll('.global-script-code-item');
        const scripts = [];
        codeItems.forEach(item => {
            const codeId = item.dataset.codeId;
            const timing = item.querySelector('.script-code-timing-select').value;
            const code = item.querySelector('.script-code-textarea').value.trim();
            
            if (code) {
                scripts.push({
                    timing,
                    code
                });
            }
        });
        
        if (scripts.length === 0) {
            alert('Please add at least one script code block');
            return;
        }
        
        const globalScripts = await getGlobalScripts();
        
        if (scriptId) {
            // Update existing
            const index = globalScripts.findIndex(s => s.id === scriptId);
            if (index !== -1) {
                const existingScript = globalScripts[index];
                const updatedScript = {
                    ...existingScript, // Preserve any existing properties
                    id: scriptId,
                    name,
                    whenToRun,
                    domainPattern,
                    onRefresh: onRefresh || false,
                    confirmPopup: confirmPopup || false,
                    scripts
                };
                globalScripts[index] = updatedScript;
            }
        } else {
            // Create new
            const newScript = {
                id: Date.now().toString(),
                name,
                whenToRun,
                domainPattern,
                onRefresh: onRefresh || false,
                confirmPopup: confirmPopup || false,
                scripts,
                createdAt: Date.now()
            };
            globalScripts.push(newScript);
        }
        
        await saveGlobalScripts(globalScripts);
        closeModal();
        renderGlobalScripts();
        });
        form.dataset.submitListenerAttached = 'true';
    }
    
    // Render scripts when scripts page is shown
    const scriptsPage = document.getElementById('scriptsPage');
    if (scriptsPage) {
        const observer = new MutationObserver((mutations) => {
            if (scriptsPage.classList.contains('active')) {
                renderGlobalScripts();
            }
        });
        observer.observe(scriptsPage, {
            attributes: true,
            attributeFilter: ['class']
        });
    }
}

// Initialize global scripts page
// Try to initialize immediately, and also when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setupGlobalScriptsPage();
    });
} else {
    // DOM is already ready
    setupGlobalScriptsPage();
}

// Also re-initialize when scripts page becomes visible (in case elements weren't ready)
const scriptsPage = document.getElementById('scriptsPage');
if (scriptsPage) {
    const observer = new MutationObserver((mutations) => {
        if (scriptsPage.classList.contains('active')) {
            // Re-check if button exists and has listener
            const createBtn = document.getElementById('createScriptBtn');
            if (createBtn && !createBtn.dataset.listenerAttached) {
                createBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    openGlobalScriptModal();
                });
                createBtn.dataset.listenerAttached = 'true';
            }
        }
    });
    observer.observe(scriptsPage, {
        attributes: true,
        attributeFilter: ['class']
    });
}

// Global down arrow click handler - set up once
let downArrowClickHandler = null;

function setupDownArrowClickHandler() {
    if (downArrowClickHandler) {
        document.removeEventListener('click', downArrowClickHandler, true);
    }
    
    downArrowClickHandler = (e) => {
        // Check if click is on down arrow or its SVG child
        const downArrow = e.target.closest('.down-arrow-icon');
        
        if (downArrow) {
            e.stopPropagation();
            e.preventDefault();
            const parentId = downArrow.getAttribute('data-parent-id');
            
            if (parentId) {
                openSubLauncherModal(parentId);
            }
        }
    };
    
    document.addEventListener('click', downArrowClickHandler, true); // Use capture phase
}

// Track which parent's sub-launcher modal is currently open
let currentOpenSubLauncherParentId = null;

// Sub-launcher modal functions
async function openSubLauncherModal(parentId) {
    const sites = await getSites();
    const parentSite = sites.find(s => s.id === parentId);
    const childSites = sites.filter(s => s.parentId === parentId);
    
    if (!parentSite) {
        return;
    }
    
    const modal = document.getElementById('subLauncherModal');
    const grid = document.getElementById('subLauncherGrid');
    
    if (!modal) {
        return;
    }
    
    // Track the currently open parent ID
    currentOpenSubLauncherParentId = parentId;
    
    const modalContentEl = modal.querySelector('.sub-launcher-modal-content');
    
    if (childSites.length === 0) {
        grid.innerHTML = `
            <div class="empty-state" style="text-align: center; padding: 40px; color: var(--text-color, #333);">
                <h2 style="color: var(--text-color, #333);">No Sub-Sites</h2>
                <p style="color: var(--text-color-secondary, #666);">This site doesn't have any sub-sites yet. Add sub-sites by selecting this site as a parent when adding or editing a site.</p>
            </div>
        `;
    } else {
        const defaultIconUrl = chrome.runtime.getURL('assets/applications-internet.svg');
        const isEditMode = await getEditMode();
        const showOnHover = await getShowEditOnHover();
        const editIconsClass = isEditMode ? 'edit-icons-visible' : (showOnHover ? 'edit-icons-hover' : 'edit-icons-hidden');
        
        grid.innerHTML = childSites.map(site => {
            const iconUrl = site.iconUrl || getFaviconUrl(site.url);
            const initial = getInitial(site.name);
            return `
                <div class="site-item" data-id="${site.id}" draggable="${isEditMode}">
                    <div class="site-icon" data-site-name="${site.name}">
                        <div class="site-icon-fallback">${initial}</div>
                        ${iconUrl ? `<img src="${iconUrl}" alt="${site.name}" data-site-id="${site.id}" data-site-url="${site.url}" data-favicon-index="0">` : `<img src="${defaultIconUrl}" alt="${site.name}" data-site-id="${site.id}" class="site-icon-svg-fallback">`}
                        <div class="edit-icons ${editIconsClass}">
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
                            <div class="advanced-icon" data-id="${site.id}" title="Advanced Scripts">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <path d="M12 16v-4M12 8h.01"></path>
                                </svg>
                            </div>
                            <div class="move-icon" data-id="${site.id}" title="Move">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="5 9 2 12 5 15"></polyline>
                                    <polyline points="9 5 12 2 15 5"></polyline>
                                    <polyline points="15 19 12 22 9 19"></polyline>
                                    <polyline points="19 9 22 12 19 15"></polyline>
                                    <line x1="2" y1="12" x2="22" y2="12"></line>
                                    <line x1="12" y1="2" x2="12" y2="22"></line>
                                </svg>
                            </div>
                            <div class="move-arrow-left" data-id="${site.id}" data-direction="left" style="display: none;">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="15 18 9 12 15 6"></polyline>
                                </svg>
                            </div>
                            <div class="move-arrow-right" data-id="${site.id}" data-direction="right" style="display: none;">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="9 18 15 12 9 6"></polyline>
                                </svg>
                            </div>
                        </div>
                    </div>
                    <div class="site-name">${site.name}</div>
                </div>
            `;
        }).join('');
        
        // Add image error handlers for child sites
        document.querySelectorAll('#subLauncherGrid .site-icon img').forEach(img => {
            const isSvgFallback = img.classList.contains('site-icon-svg-fallback');
            const fallback = img.parentElement.querySelector('.site-icon-fallback');
            
            if (isSvgFallback) {
                if (fallback) {
                    fallback.style.display = 'none';
                }
                img.addEventListener('error', function() {
                    this.style.display = 'none';
                    if (fallback) {
                        fallback.style.display = 'flex';
                    }
                });
            } else {
                img.style.display = 'none';
                if (fallback) {
                    fallback.style.display = 'flex';
                }
                
                img.addEventListener('error', function() {
                    const siteUrl = this.getAttribute('data-site-url');
                    if (!siteUrl) {
                        this.src = defaultIconUrl;
                        this.classList.add('site-icon-svg-fallback');
                        if (fallback) {
                            fallback.style.display = 'none';
                        }
                        return;
                    }
                    
                    const currentSrc = this.src;
                    const isGoogleFaviconService = currentSrc && currentSrc.includes('www.google.com/s2/favicons');
                    
                    if (isGoogleFaviconService) {
                        this.src = defaultIconUrl;
                        this.classList.add('site-icon-svg-fallback');
                        this.addEventListener('error', function() {
                            this.style.display = 'none';
                            if (fallback) {
                                fallback.style.display = 'flex';
                            }
                        }, { once: true });
                        if (fallback) {
                            fallback.style.display = 'none';
                        }
                        return;
                    }
                    
                    const faviconUrls = getFaviconUrls(siteUrl);
                    let currentIndex = parseInt(this.getAttribute('data-favicon-index') || '0', 10);
                    currentIndex++;
                    
                    if (currentIndex < faviconUrls.length) {
                        this.setAttribute('data-favicon-index', currentIndex.toString());
                        this.src = faviconUrls[currentIndex];
                    } else {
                        this.src = defaultIconUrl;
                        this.classList.add('site-icon-svg-fallback');
                        this.addEventListener('error', function() {
                            this.style.display = 'none';
                            if (fallback) {
                                fallback.style.display = 'flex';
                            }
                        }, { once: true });
                        if (fallback) {
                            fallback.style.display = 'none';
                        }
                    }
                });
                
                img.addEventListener('load', function() {
                    const currentSrc = this.src;
                    const isGoogleFaviconService = currentSrc && currentSrc.includes('www.google.com/s2/favicons');
                    
                    if (isGoogleFaviconService) {
                        if (this.naturalWidth === 16 && this.naturalHeight === 16) {
                            this.src = defaultIconUrl;
                            this.classList.add('site-icon-svg-fallback');
                            this.addEventListener('error', function() {
                                this.style.display = 'none';
                                if (fallback) {
                                    fallback.style.display = 'flex';
                                }
                            }, { once: true });
                            if (fallback) {
                                fallback.style.display = 'none';
                            }
                            return;
                        }
                    }
                    
                    if (fallback) {
                        fallback.style.display = 'none';
                    }
                    this.style.display = 'block';
                });
            }
        });
        
        // Add click handlers for child sites
        document.querySelectorAll('#subLauncherGrid .site-item').forEach(item => {
            const siteId = item.getAttribute('data-id');
            const site = childSites.find(s => s.id === siteId);
            
            item.addEventListener('click', async (e) => {
                // Don't navigate if clicking on edit icons
                if (e.target.closest('.edit-icon, .delete-icon, .advanced-icon, .move-icon, .move-arrow-left, .move-arrow-right')) {
                    return;
                }
                e.stopPropagation();
                // Mark that this site is being opened via launcher
                await chrome.storage.session.set({ [`launcher_opened_${site.id}`]: true });
                window.location.href = site.url;
            });
        });
        
        // Add edit icon handlers for modal sites
        document.querySelectorAll('#subLauncherGrid .edit-icon').forEach(icon => {
            icon.addEventListener('click', async (e) => {
                e.stopPropagation();
                const siteId = icon.getAttribute('data-id');
                await openEditModal(siteId);
            });
        });
        
        // Add delete handlers for modal sites
        document.querySelectorAll('#subLauncherGrid .delete-icon').forEach(icon => {
            icon.addEventListener('click', async (e) => {
                e.stopPropagation();
                const siteId = icon.getAttribute('data-id');
                const sites = await getSites();
                const site = sites.find(s => s.id === siteId);
                const childSites = sites.filter(s => s.parentId === siteId);
                
                let confirmMessage = 'Are you sure you want to delete this site?';
                if (childSites.length > 0) {
                    confirmMessage += `\n\nThis site has ${childSites.length} sub-site(s). They will also be deleted.`;
                }
                
                if (confirm(confirmMessage)) {
                    // Delete the site and all its children
                    const filteredSites = sites.filter(s => s.id !== siteId && s.parentId !== siteId);
                    await saveSites(filteredSites);
                    // Re-render both main page and modal
                    renderSites();
                    openSubLauncherModal(parentId);
                }
            });
        });
        
        // Add advanced handlers for modal sites
        document.querySelectorAll('#subLauncherGrid .advanced-icon').forEach(icon => {
            const newIcon = icon.cloneNode(true);
            icon.parentNode.replaceChild(newIcon, icon);
            
            newIcon.addEventListener('click', async (e) => {
                e.stopPropagation();
                e.preventDefault();
                const siteId = newIcon.getAttribute('data-id');
                if (siteId) {
                    await openAdvancedModal(siteId);
                }
            });
            
            newIcon.addEventListener('mousedown', (e) => {
                e.stopPropagation();
            });
        });
        
        // Add move handlers for modal sites
        document.querySelectorAll('#subLauncherGrid .move-icon').forEach(icon => {
            icon.addEventListener('click', (e) => {
                e.stopPropagation();
                const siteId = icon.getAttribute('data-id');
                activateMoveMode(siteId);
            });
        });
        
        // Add move arrow handlers for modal sites (delegated event handling)
        document.addEventListener('click', async (e) => {
            if (e.target.closest('#subLauncherGrid .move-arrow-left') || e.target.closest('#subLauncherGrid .move-arrow-right')) {
                e.stopPropagation();
                const arrow = e.target.closest('.move-arrow-left') || e.target.closest('.move-arrow-right');
                const targetSiteId = arrow.getAttribute('data-id');
                const direction = arrow.getAttribute('data-direction');
                await moveSite(targetSiteId, direction);
                // Re-render modal after move
                openSubLauncherModal(parentId);
            }
        });
        
        // Add drag and drop handlers for modal sites (only in edit mode)
        if (isEditMode) {
            setupDragAndDropForModal();
        }
    }
    
    modal.classList.add('active');
    // Force modal to be visible (override Chrome UI hiding CSS)
    modal.style.display = 'flex';
    modal.style.visibility = 'visible';
    modal.style.opacity = '1';
    modal.style.zIndex = '1000';
    
    // If opened via keyboard, show number overlays
    if (keyboardShortcutMode && isMacOS) {
        // Use requestAnimationFrame to ensure DOM is ready
        requestAnimationFrame(() => {
            showNumberOverlays(grid, subLauncherNumberMap, false);
        });
    }
    
    // Apply the same background theme to modal as the main page
    const result = await chrome.storage.local.get(['theme']);
    const theme = result.theme || { type: 'color', value: '#ffffff' };
    
    // Apply the same background to modal content
    if (modalContentEl) {
        if (theme.type === 'color') {
            modalContentEl.style.background = theme.value;
            modalContentEl.style.backgroundImage = 'none';
            const brightness = getColorBrightness(theme.value);
            setAdaptiveTextColorForModal(brightness);
        } else if (theme.type === 'image') {
            if (theme.value.startsWith('data:') || theme.value.startsWith('blob:')) {
                modalContentEl.style.backgroundImage = `url(${theme.value})`;
            } else {
                modalContentEl.style.backgroundImage = `url(${theme.value})`;
            }
            modalContentEl.style.backgroundSize = 'cover';
            modalContentEl.style.backgroundPosition = 'center';
            modalContentEl.style.backgroundRepeat = 'no-repeat';
            getImageBrightness(theme.value, (brightness) => {
                setAdaptiveTextColorForModal(brightness);
            });
        }
    }
}

// Setup drag and drop for modal sites
function setupDragAndDropForModal() {
    const siteItems = document.querySelectorAll('#subLauncherGrid .site-item');
    const subLauncherGrid = document.getElementById('subLauncherGrid');
    
    siteItems.forEach((item) => {
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
            item.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/html', item.innerHTML);
            e.dataTransfer.setDragImage(item, item.offsetWidth / 2, item.offsetHeight / 2);
        });
        
        item.addEventListener('dragend', (e) => {
            item.classList.remove('dragging');
            document.querySelectorAll('#subLauncherGrid .site-item').forEach(el => {
                el.classList.remove('drag-over');
            });
        });
        
        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            const dragging = document.querySelector('.dragging');
            if (!dragging) return;
            
            const afterElement = getDragAfterElement(subLauncherGrid, e.clientY);
            
            // Remove drag-over from all items first
            document.querySelectorAll('#subLauncherGrid .site-item').forEach(el => {
                if (el !== dragging) {
                    el.classList.remove('drag-over');
                }
            });
            
            // Add drag-over to the item we're hovering over
            if (item !== dragging) {
                item.classList.add('drag-over');
            }
            
            if (afterElement == null) {
                subLauncherGrid.appendChild(dragging);
            } else {
                subLauncherGrid.insertBefore(dragging, afterElement);
            }
        });
        
        item.addEventListener('dragenter', (e) => {
            e.preventDefault();
            if (item !== document.querySelector('.dragging')) {
                item.classList.add('drag-over');
            }
        });
        
        item.addEventListener('dragleave', (e) => {
            if (!item.contains(e.relatedTarget)) {
                item.classList.remove('drag-over');
            }
        });
        
        item.addEventListener('drop', async (e) => {
            e.preventDefault();
            item.classList.remove('drag-over');
            
            const dragging = document.querySelector('.dragging');
            if (dragging && dragging !== item) {
                // Get all site items in current order
                const allItems = Array.from(subLauncherGrid.querySelectorAll('.site-item'));
                const newOrder = allItems.map(el => el.getAttribute('data-id'));
                
                // Get the parent ID from the modal's data attribute or find it from the sites
                const sites = await getSites();
                const firstChildId = allItems[0]?.getAttribute('data-id');
                const firstChild = sites.find(s => s.id === firstChildId);
                const parentId = firstChild?.parentId;
                
                if (parentId) {
                    const childSites = sites.filter(s => s.parentId === parentId);
                    const reorderedChildSites = newOrder.map(id => childSites.find(s => s.id === id)).filter(Boolean);
                    const otherSites = sites.filter(s => s.parentId !== parentId);
                    const reorderedSites = [...otherSites, ...reorderedChildSites];
                    
                    // Save new order
                    await saveSites(reorderedSites);
                    
                    // Re-render modal
                    openSubLauncherModal(parentId);
                }
            }
        });
    });
}

// Close sub-launcher modal
// Close sub-launcher modal function
function closeSubLauncherModal() {
    const subLauncherModal = document.getElementById('subLauncherModal');
    if (subLauncherModal) {
        subLauncherModal.classList.remove('active');
        // Clear inline styles
        subLauncherModal.style.display = '';
        subLauncherModal.style.visibility = '';
        subLauncherModal.style.opacity = '';
        subLauncherModal.style.zIndex = '';
    }
    // Clear the tracked parent ID
    currentOpenSubLauncherParentId = null;
    // Reset keyboard shortcut mode
    keyboardShortcutMode = false;
    subLauncherNumberMap.clear();
}

// Setup close handlers for sub-launcher modal
const closeSubLauncherBtn = document.getElementById('closeSubLauncherBtn');
const subLauncherModal = document.getElementById('subLauncherModal');

if (closeSubLauncherBtn) {
    closeSubLauncherBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeSubLauncherModal();
    });
}

if (subLauncherModal) {
    // Close on backdrop click
    subLauncherModal.addEventListener('click', (e) => {
        if (e.target === subLauncherModal) {
            closeSubLauncherModal();
        }
    });
}

// Generic function to close any modal
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    
    // Special handling for sub-launcher modal
    if (modalId === 'subLauncherModal') {
        closeSubLauncherModal();
        return;
    }
    
    // Special handling for global script modal
    if (modalId === 'globalScriptModal') {
        const form = document.getElementById('globalScriptForm');
        if (form) {
            form.reset();
        }
        const codeContainer = document.getElementById('globalScriptCodeContainer');
        if (codeContainer) {
            codeContainer.innerHTML = '';
        }
        // Reset any other state if needed
    }
    
    // Special handling for edit site modal
    if (modalId === 'editSiteModal') {
        const form = document.getElementById('editSiteForm');
        if (form) {
            form.reset();
        }
    }
    
    // Special handling for add site modal
    if (modalId === 'addSiteModal') {
        const form = document.getElementById('addSiteForm');
        if (form) {
            form.reset();
        }
        // Hide error messages
        const nameError = document.getElementById('siteNameError');
        const urlError = document.getElementById('siteUrlError');
        if (nameError) nameError.style.display = 'none';
        if (urlError) urlError.style.display = 'none';
    }
    
    // Close the modal
    modal.classList.remove('active');
    // Clear inline styles if any
    modal.style.display = '';
    modal.style.visibility = '';
    modal.style.opacity = '';
    modal.style.zIndex = '';
}

// Setup close button handlers for all modals
document.querySelectorAll('.modal-close-btn').forEach(btn => {
    const modalId = btn.getAttribute('data-modal');
    if (modalId) {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeModal(modalId);
        });
    }
});

// Unified Escape key handler for all modals
document.addEventListener('keydown', (e) => {
    // Don't interfere with keyboard shortcuts
    if (isMacOS && e.ctrlKey && !e.metaKey) {
        return;
    }
    
    if (e.key === 'Escape') {
        // Find the currently active modal
        const modals = ['addSiteModal', 'editSiteModal', 'themeModal', 'advancedScriptsModal', 'globalScriptModal', 'subLauncherModal'];
        for (const modalId of modals) {
            const modal = document.getElementById(modalId);
            if (modal && modal.classList.contains('active')) {
                e.preventDefault();
                e.stopPropagation();
                closeModal(modalId);
                break;
            }
        }
    }
});

// Setup down arrow click handler once
setupDownArrowClickHandler();

// ========== Keyboard Shortcuts (macOS only) ==========
// Detect macOS
const isMacOS = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

// Track keyboard state
let isControlPressed = false;
let isShiftPressed = false;
let keyboardShortcutMode = false; // true if sub-launcher opened via keyboard
let siteNumberMap = new Map(); // Maps number/letter to site element
let subLauncherNumberMap = new Map(); // Maps number/letter to site element in sub-launcher
let lastControlKeydownTime = 0; // Track when Control was last pressed

// Get number/letter label for index (1-9, then a-z)
function getNumberLabel(index) {
    if (index < 9) {
        return (index + 1).toString();
    } else if (index < 35) { // 9 + 26 = 35 total
        return String.fromCharCode(97 + (index - 9)); // 'a' to 'z'
    }
    return null; // No label if exhausted
}

// Show number overlays on site icons
async function showNumberOverlays(container, numberMap, showArrows = false) {
    numberMap.clear();
    const siteItems = container.querySelectorAll('.site-item');
    let index = 0;
    
    // Get sites to check for children
    const sites = await getSites();
    
    siteItems.forEach(item => {
        const label = getNumberLabel(index);
        if (!label) return; // Skip if no more labels available
        
        const siteIcon = item.querySelector('.site-icon');
        if (!siteIcon) return;
        
        // Remove existing number overlay
        const existingOverlay = siteIcon.querySelector('.keyboard-number-overlay');
        if (existingOverlay) {
            existingOverlay.remove();
        }
        
        // Create number overlay
        const overlay = document.createElement('div');
        overlay.className = 'keyboard-number-overlay';
        overlay.textContent = label;
        overlay.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(102, 126, 234, 0.9);
            color: white;
            width: 28px;
            height: 28px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            font-weight: 600;
            z-index: 20;
            pointer-events: none;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
        `;
        siteIcon.style.position = 'relative';
        siteIcon.appendChild(overlay);
        
        // Store mapping
        numberMap.set(label.toLowerCase(), item);
        
        // Show down arrow if Control+Shift and site has children
        if (showArrows) {
            const siteId = item.getAttribute('data-id');
            const hasChildren = sites.some(s => s.parentId === siteId);
            if (hasChildren) {
                const downArrow = item.querySelector('.down-arrow-icon');
                if (downArrow) {
                    downArrow.style.display = 'flex';
                    downArrow.style.opacity = '1';
                    downArrow.style.pointerEvents = 'auto';
                }
            }
        } else {
            // Hide arrows if showArrows is false
            const downArrow = item.querySelector('.down-arrow-icon');
            if (downArrow) {
                const siteId = item.getAttribute('data-id');
                const hasChildren = sites.some(s => s.parentId === siteId);
                if (hasChildren) {
                    downArrow.style.display = '';
                    downArrow.style.opacity = '';
                    downArrow.style.pointerEvents = '';
                }
            }
        }
        
        index++;
    });
}

// Hide number overlays
function hideNumberOverlays(container) {
    // Don't hide if Control is still pressed
    if (isControlPressed) {
        return;
    }
    
    const overlays = container.querySelectorAll('.keyboard-number-overlay');
    overlays.forEach(overlay => {
        overlay.remove();
    });
    
    // Hide down arrows
    container.querySelectorAll('.down-arrow-icon').forEach(arrow => {
        arrow.style.display = '';
        arrow.style.opacity = '';
        arrow.style.pointerEvents = '';
    });
}

// Handle keyboard events
if (isMacOS) {
    document.addEventListener('keydown', async (e) => {
        // Don't interfere with Escape key handling
        if (e.key === 'Escape') {
            return;
        }
        
        const subLauncherModal = document.getElementById('subLauncherModal');
        const sitesGrid = document.getElementById('sitesGrid');
        const subLauncherGrid = document.getElementById('subLauncherGrid');
        
        // Check if sub-launcher is open and was opened via keyboard - handle number presses without Control
        if (subLauncherModal && subLauncherModal.classList.contains('active') && keyboardShortcutMode) {
            const key = e.key.toLowerCase();
            // Check if it's a valid number (1-9) or letter (a-z) and NOT a modifier key
            if (((key >= '1' && key <= '9') || (key >= 'a' && key <= 'z')) && !e.metaKey && !e.ctrlKey && !e.altKey) {
                e.preventDefault();
                e.stopPropagation();
                
                const siteItem = subLauncherNumberMap.get(key);
                if (siteItem) {
                    const siteId = siteItem.getAttribute('data-id');
                    const sites = await getSites();
                    const site = sites.find(s => s.id === siteId);
                    if (site) {
                        await chrome.storage.session.set({ [`launcher_opened_${site.id}`]: true });
                        window.location.href = site.url;
                    }
                }
                return;
            }
        }
        
        // Check for Control key specifically (not Command/Meta on Mac)
        // On macOS, we want the Control key, not the Command key (Meta)
        if (e.ctrlKey && !e.metaKey) {
            isControlPressed = true;
            lastControlKeydownTime = Date.now();
            
            if (e.shiftKey) {
                isShiftPressed = true;
            } else {
                // If Shift is not pressed, make sure we're not showing arrows
                isShiftPressed = false;
            }
            
            // Show number overlays on main page
            if (sitesGrid && (!subLauncherModal || !subLauncherModal.classList.contains('active'))) {
                const sites = await getSites();
                const parentSites = sites.filter(site => !site.parentId);
                if (parentSites.length > 0) {
                    // Use e.shiftKey directly to determine if arrows should be shown
                    await showNumberOverlays(sitesGrid, siteNumberMap, e.shiftKey);
                }
            }
            
            // Show number overlays in sub-launcher if opened via keyboard
            if (subLauncherGrid && subLauncherModal && subLauncherModal.classList.contains('active') && keyboardShortcutMode) {
                showNumberOverlays(subLauncherGrid, subLauncherNumberMap, false);
            }
        }
        
        // Handle number/letter key presses with Control (not Command/Meta)
        if (e.ctrlKey && !e.metaKey && !e.altKey) {
            const key = e.key.toLowerCase();
            
            // Check if it's a valid number (1-9) or letter (a-z)
            if ((key >= '1' && key <= '9') || (key >= 'a' && key <= 'z')) {
                e.preventDefault();
                e.stopPropagation();
                
                // Check if we're in sub-launcher keyboard mode - if so, don't handle here (handled above)
                const inSubLauncherKeyboardMode = subLauncherModal && subLauncherModal.classList.contains('active') && keyboardShortcutMode;
                
                if (!inSubLauncherKeyboardMode) {
                    // Ensure number map is populated (in case overlays weren't shown yet)
                    if (sitesGrid && siteNumberMap.size === 0) {
                        const sites = await getSites();
                        const parentSites = sites.filter(site => !site.parentId);
                        if (parentSites.length > 0) {
                            await showNumberOverlays(sitesGrid, siteNumberMap, isShiftPressed);
                        }
                    }
                    
                    // Handle main page number press
                    const siteItem = siteNumberMap.get(key);
                    if (siteItem) {
                        const siteId = siteItem.getAttribute('data-id');
                        const sites = await getSites();
                        const site = sites.find(s => s.id === siteId);
                        
                        if (site) {
                            if (isShiftPressed) {
                                // Control+Shift+Number: Open sub-launcher if exists, otherwise open site
                                const childSites = sites.filter(s => s.parentId === siteId);
                                if (childSites.length > 0) {
                                    keyboardShortcutMode = true;
                                    await openSubLauncherModal(siteId);
                                    // Show numbers in sub-launcher
                                    requestAnimationFrame(() => {
                                        const subLauncherGrid = document.getElementById('subLauncherGrid');
                                        if (subLauncherGrid) {
                                            showNumberOverlays(subLauncherGrid, subLauncherNumberMap, false);
                                        }
                                    });
                                } else {
                                    await chrome.storage.session.set({ [`launcher_opened_${site.id}`]: true });
                                    window.location.href = site.url;
                                }
                            } else {
                                // Control+Number: Open site
                                await chrome.storage.session.set({ [`launcher_opened_${site.id}`]: true });
                                window.location.href = site.url;
                            }
                        }
                    }
                    
                    // Hide overlays after action
                    if (sitesGrid) {
                        hideNumberOverlays(sitesGrid);
                    }
                    isControlPressed = false;
                    isShiftPressed = false;
                }
            }
        }
    });
    
    document.addEventListener('keyup', async (e) => {
        const subLauncherModal = document.getElementById('subLauncherModal');
        const sitesGrid = document.getElementById('sitesGrid');
        const subLauncherGrid = document.getElementById('subLauncherGrid');
        
        // Only hide overlays when Control is actually released (not Command/Meta)
        // Check the key name and verify the modifier is no longer pressed
        if (e.key === 'Control' && !e.ctrlKey) {
            // Check if enough time has passed since the last keydown to avoid false positives
            const timeSinceKeydown = Date.now() - lastControlKeydownTime;
            
            // Only hide if at least 100ms has passed since keydown (to avoid immediate hiding)
            if (timeSinceKeydown > 100) {
                isControlPressed = false;
                
                // Use a delay to ensure this isn't a false positive from blur events
                setTimeout(() => {
                    // Double-check that Control is still not pressed
                    if (!isControlPressed && !e.ctrlKey) {
                        // Hide number overlays on main page
                        if (sitesGrid) {
                            hideNumberOverlays(sitesGrid);
                        }
                        // Hide overlays in sub-launcher only if NOT in keyboard shortcut mode
                        if (subLauncherGrid && (!keyboardShortcutMode || !subLauncherModal || !subLauncherModal.classList.contains('active'))) {
                            hideNumberOverlays(subLauncherGrid);
                        }
                    }
                }, 100);
            }
        }
        
        if (e.key === 'Shift' && !e.shiftKey) {
            isShiftPressed = false;
            
            // If Control is still pressed (check e.ctrlKey directly), re-show overlays without arrows
            if (e.ctrlKey && !e.metaKey) {
                // Update isControlPressed to true since Control is still held
                isControlPressed = true;
                const subLauncherModal = document.getElementById('subLauncherModal');
                const sitesGrid = document.getElementById('sitesGrid');
                
                // Re-show number overlays without arrows
                if (sitesGrid && (!subLauncherModal || !subLauncherModal.classList.contains('active'))) {
                    const sites = await getSites();
                    const parentSites = sites.filter(site => !site.parentId);
                    if (parentSites.length > 0) {
                        await showNumberOverlays(sitesGrid, siteNumberMap, false); // false = no arrows
                    }
                }
            }
        }
    });
}

// Make body focusable for keyboard shortcuts (macOS)
if (isMacOS) {
    document.body.setAttribute('tabindex', '-1');
}

// Load theme and icon size, then initial render
loadTheme();
loadIconSize();
setupIconSizeSlider();
renderSites();

