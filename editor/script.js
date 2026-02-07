// View elements
const managementView = document.getElementById('managementView');
const formView = document.getElementById('formView');
const postsList = document.getElementById('postsList');
const addPostBtn = document.getElementById('addPostBtn');
const refreshBtn = document.getElementById('refreshBtn');
const backBtn = document.getElementById('backBtn');
const selectModeBtn = document.getElementById('selectModeBtn');
const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
const cancelSelectBtn = document.getElementById('cancelSelectBtn');
const selectedCountSpan = document.getElementById('selectedCount');
const listMessage = document.getElementById('listMessage');

// Form elements
const form = document.getElementById('photoForm');
const photoInput = document.getElementById('photoInput');
const titleInput = document.getElementById('titleInput');
const descriptionInput = document.getElementById('descriptionInput');
const tagsInput = document.getElementById('tagsInput');
const draftInput = document.getElementById('draftInput');
const draftGroup = document.getElementById('draftGroup');
const photoDateInput = document.getElementById('photoDateInput');
const photoDateGroup = document.getElementById('photoDateGroup');
const cameraInput = document.getElementById('cameraInput');
const cameraGroup = document.getElementById('cameraGroup');
const locationGroup = document.getElementById('locationGroup');
const locationSearch = document.getElementById('locationSearch');
const locationResults = document.getElementById('locationResults');
const selectedLocation = document.getElementById('selectedLocation');
const selectedLocationName = document.getElementById('selectedLocationName');
const clearLocationBtn = document.getElementById('clearLocationBtn');
const previewContainer = document.getElementById('previewContainer');
const previewGrid = document.getElementById('previewGrid');
const currentImageContainer = document.getElementById('currentImageContainer');
const currentImage = document.getElementById('currentImage');
const fileName = document.getElementById('fileName');
const fileInputText = document.getElementById('fileInputText');
const submitBtn = document.getElementById('submitBtn');
const deleteBtn = document.getElementById('deleteBtn');
const submitBtnText = document.getElementById('submitBtnText');
const btnLoader = submitBtn.querySelector('.btn-loader');
const message = document.getElementById('message');
const formTitle = document.getElementById('formTitle');
const batchInfo = document.getElementById('batchInfo');
const batchCount = document.getElementById('batchCount');
const uploadProgress = document.getElementById('uploadProgress');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');

// Crop and dark mode elements
const cropSection = document.getElementById('cropSection');
const cropWrapper = document.getElementById('cropWrapper');
const cropImage = document.getElementById('cropImage');
const cropBox = document.getElementById('cropBox');
const cropPreview = document.getElementById('cropPreview');
const resetCropBtn = document.getElementById('resetCropBtn');
const removeThumbnailBtn = document.getElementById('removeThumbnailBtn');
const cropAspectOptions = document.getElementById('cropAspectOptions');
const cropHint = document.getElementById('cropHint');
const darkModeSection = document.getElementById('darkModeSection');
const darkModeInput = document.getElementById('darkModeInput');
const darkModeFileText = document.getElementById('darkModeFileText');
const darkModePreview = document.getElementById('darkModePreview');
const darkModeImage = document.getElementById('darkModeImage');
const removeDarkModeBtn = document.getElementById('removeDarkModeBtn');

// Frame elements
const frameSection = document.getElementById('frameSection');
const framePreview = document.getElementById('framePreview');
const framePreviewImage = document.getElementById('framePreviewImage');
const frameTypeOptions = document.getElementById('frameTypeOptions');
const insetWidthGroup = document.getElementById('insetWidthGroup');
const insetWidthSlider = document.getElementById('insetWidthSlider');
const insetWidthValue = document.getElementById('insetWidthValue');
const frameColorGroup = document.getElementById('frameColorGroup');
const frameColorOptions = document.getElementById('frameColorOptions');

// State
let currentEditingSlug = null;
let isEditMode = false;
let isSelectMode = false;
let selectedPosts = new Set();
let lastSelectedIndex = null; // Track last selected index for shift-click range selection
let currentPosts = []; // Store loaded posts for sorting
let filteredPosts = []; // Posts after filtering
let displayedPosts = []; // Posts in actual display order (filtered + sorted)
let currentSort = { field: 'gallery', order: 'asc' }; // Default to gallery order
let galleryOrder = []; // Order for the published gallery
let isGalleryOrderMode = false; // Whether we're editing gallery order
let currentLocation = null; // Current selected location { name, lat, lng }
let locationSearchTimeout = null; // Debounce timer for location search

// Filter state
let currentFilters = {
    search: '',
    album: '',
    dateFrom: null,
    dateTo: null
};
let allAlbums = []; // Cache for album list

// Filter elements
const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const albumFilter = document.getElementById('albumFilter');
const dateFromInput = document.getElementById('dateFrom');
const dateToInput = document.getElementById('dateTo');
const clearDateBtn = document.getElementById('clearDateBtn');
const filterResults = document.getElementById('filterResults');
const filterResultsCount = document.getElementById('filterResultsCount');
const filterResultsTotal = document.getElementById('filterResultsTotal');

// Crop state
let cropData = {
    x: 0, y: 0, width: 0, height: 0,  // Normalized (0-1) coordinates
    imageWidth: 0, imageHeight: 0,
    isDragging: false,
    isResizing: false,
    activeHandle: null,
    startX: 0, startY: 0,
    startCropX: 0, startCropY: 0,
    startCropW: 0, startCropH: 0
};

// Crop aspect ratio (default 4:5, can be changed by user)
let cropAspectMode = '4:5'; // '1:1', '4:5', '3:4', '9:16', '16:9', 'original', 'free'

// Track whether the user has explicitly modified the thumbnail crop
// (or if one already existed). Prevents auto-creating thumbnails on first save.
let thumbnailCropModified = false;

// Get current aspect ratio value based on mode
function getCropAspectRatio() {
    if (cropAspectMode === 'free') return null; // Freeform - no constraint
    if (cropAspectMode === 'original') {
        return cropData.imageWidth / cropData.imageHeight;
    }
    // Parse ratio string like "4:5"
    const parts = cropAspectMode.split(':');
    if (parts.length === 2) {
        return parseInt(parts[0]) / parseInt(parts[1]);
    }
    return 4 / 5; // Default fallback
}

// Frame state
let frameData = {
    type: 'none',      // 'none', 'even', '1:1', '4:5', '5:4', '9:16', '2:1'
    insetWidth: 10,    // 0-100 percentage
    color: '#FFFFFF'   // hex color
};

// Initialize
loadPosts();

// Event listeners
addPostBtn.addEventListener('click', () => {
    showFormView();
});

refreshBtn.addEventListener('click', () => {
    loadPosts();
});

backBtn.addEventListener('click', () => {
    showManagementView();
});

deleteBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to delete this post? This action cannot be undone.')) {
        deletePost();
    }
});

selectModeBtn.addEventListener('click', () => {
    enterSelectMode();
});

cancelSelectBtn.addEventListener('click', () => {
    exitSelectMode();
});

deleteSelectedBtn.addEventListener('click', () => {
    if (selectedPosts.size === 0) return;
    const count = selectedPosts.size;
    if (confirm(`Are you sure you want to delete ${count} post${count > 1 ? 's' : ''}? This action cannot be undone.`)) {
        deleteSelectedPosts();
    }
});

// Preview images when selected (supports multiple)
photoInput.addEventListener('change', (e) => {
    const files = e.target.files;
    if (files.length > 0) {
        if (files.length === 1) {
            fileName.textContent = files[0].name;
            batchInfo.style.display = 'none';
        } else {
            fileName.textContent = `${files.length} photos selected`;
            batchCount.textContent = files.length;
            batchInfo.style.display = 'block';
        }
        
        // Show previews
        previewGrid.innerHTML = '';
        const maxPreviews = Math.min(files.length, 12); // Limit preview to 12 images
        
        for (let i = 0; i < maxPreviews; i++) {
            const file = files[i];
            const reader = new FileReader();
            reader.onload = (e) => {
                const imgWrapper = document.createElement('div');
                imgWrapper.className = 'preview-item';
                imgWrapper.innerHTML = `<img src="${e.target.result}" alt="Preview ${i + 1}">`;
                previewGrid.appendChild(imgWrapper);
            };
            reader.readAsDataURL(file);
        }
        
        if (files.length > maxPreviews) {
            const moreIndicator = document.createElement('div');
            moreIndicator.className = 'preview-more';
            moreIndicator.textContent = `+${files.length - maxPreviews} more`;
            previewGrid.appendChild(moreIndicator);
        }
        
        previewContainer.style.display = 'block';
        currentImageContainer.style.display = 'none';
        
        // Update button text based on count
        if (!isEditMode) {
            submitBtnText.textContent = files.length > 1 
                ? `Upload ${files.length} Photos` 
                : 'Upload & Create Post';
        }
    } else {
        previewContainer.style.display = 'none';
        fileName.textContent = '';
        batchInfo.style.display = 'none';
        if (!isEditMode) {
            submitBtnText.textContent = 'Upload & Create Post';
        }
    }
});

// Handle form submission
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Hide previous messages
    message.style.display = 'none';
    
    // Validate form - photo required for new posts (unless editing)
    if (!isEditMode && (!photoInput.files || photoInput.files.length === 0)) {
        showMessage('Please select at least one photo', 'error');
        return;
    }
    
    // Disable submit button
    submitBtn.disabled = true;
    submitBtnText.style.display = 'none';
    btnLoader.style.display = 'block';
    
    try {
        if (isEditMode) {
            await updatePost();
        } else if (photoInput.files.length > 1) {
            // Batch upload
            await batchUpload();
        } else {
            // Single upload
            await createPost();
        }
    } catch (error) {
        console.error('Form submission error:', error);
        showMessage('An error occurred. Please try again.', 'error');
    } finally {
        // Re-enable submit button
        submitBtn.disabled = false;
        submitBtnText.style.display = 'block';
        btnLoader.style.display = 'none';
    }
});

// Load and display posts
async function loadPosts() {
    try {
        postsList.innerHTML = '<div class="loading">Loading posts...</div>';
        
        const response = await fetch('/api/posts');
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to load posts');
        }
        
        if (data.posts.length === 0) {
            postsList.innerHTML = '<div class="empty-state">No posts yet. Click "Add Photos" to get started!</div>';
            return;
        }
        
        currentPosts = data.posts;
        
        // Load albums for filter dropdown (only once or if not loaded)
        if (allAlbums.length === 0) {
            await loadAlbumsForFilter();
        }
        
        // Load gallery order if sorting by gallery and not loaded yet
        if (currentSort.field === 'gallery' && galleryOrder.length === 0) {
            await loadGalleryOrder();
            // Initialize with current posts if still empty (sort by date for default order)
            if (galleryOrder.length === 0 && currentPosts.length > 0) {
                const sorted = [...currentPosts].sort((a, b) => {
                    const dateA = new Date(a.date || 0).getTime();
                    const dateB = new Date(b.date || 0).getTime();
                    return dateB - dateA; // newest first
                });
                galleryOrder = sorted.map(p => p.slug);
            }
        }
        
        // Apply filters and render
        applyFiltersAndRender();
        
    } catch (error) {
        console.error('Error loading posts:', error);
        postsList.innerHTML = `<div class="error-state">Error loading posts: ${error.message}</div>`;
    }
}

// Load albums for the filter dropdown
async function loadAlbumsForFilter() {
    try {
        const response = await fetch('/api/albums');
        const data = await response.json();
        
        if (response.ok && data.albums) {
            allAlbums = data.albums;
            populateAlbumFilter();
        }
    } catch (error) {
        console.error('Error loading albums for filter:', error);
    }
}

// Populate the album filter dropdown
function populateAlbumFilter() {
    if (!albumFilter) return;
    
    // Keep the "All Albums" option
    albumFilter.innerHTML = '<option value="">All Albums</option>';
    
    // Add "No Album" option
    albumFilter.innerHTML += '<option value="__none__">No Album</option>';
    
    // Add each album
    allAlbums.forEach(album => {
        const option = document.createElement('option');
        option.value = album.id;
        option.textContent = album.name;
        albumFilter.appendChild(option);
    });
}

// Filter posts based on current filters
function filterPosts(posts) {
    return posts.filter(post => {
        // Search filter (title and description)
        if (currentFilters.search) {
            const searchLower = currentFilters.search.toLowerCase();
            const titleMatch = (post.title || '').toLowerCase().includes(searchLower);
            const descMatch = (post.description || '').toLowerCase().includes(searchLower);
            if (!titleMatch && !descMatch) {
                return false;
            }
        }
        
        // Album filter
        if (currentFilters.album) {
            if (currentFilters.album === '__none__') {
                // Check if post is NOT in any album
                const inAnyAlbum = allAlbums.some(album => 
                    album.photoSlugs && album.photoSlugs.includes(post.slug)
                );
                if (inAnyAlbum) {
                    return false;
                }
            } else {
                // Check if post is in the selected album
                const album = allAlbums.find(a => a.id === currentFilters.album);
                if (!album || !album.photoSlugs || !album.photoSlugs.includes(post.slug)) {
                    return false;
                }
            }
        }
        
        // Date range filter (uses photo date when set, else date created)
        if (currentFilters.dateFrom || currentFilters.dateTo) {
            const dateForFilter = post.photoDate || post.date;
            const postDate = dateForFilter ? new Date(dateForFilter) : null;
            if (!postDate) {
                return false; // No date means it doesn't match date filter
            }
            
            if (currentFilters.dateFrom) {
                const fromDate = new Date(currentFilters.dateFrom);
                fromDate.setHours(0, 0, 0, 0);
                if (postDate < fromDate) {
                    return false;
                }
            }
            
            if (currentFilters.dateTo) {
                const toDate = new Date(currentFilters.dateTo);
                toDate.setHours(23, 59, 59, 999);
                if (postDate > toDate) {
                    return false;
                }
            }
        }
        
        return true;
    });
}

// Apply filters and render
function applyFiltersAndRender() {
    filteredPosts = filterPosts(currentPosts);
    displayedPosts = sortPosts(filteredPosts); // Store the actual display order
    renderPosts(displayedPosts);
    updateFilterResultsDisplay();
}

// Update the filter results count display
function updateFilterResultsDisplay() {
    const hasActiveFilters = currentFilters.search || 
                              currentFilters.album || 
                              currentFilters.dateFrom || 
                              currentFilters.dateTo;
    
    if (hasActiveFilters && filterResults) {
        filterResults.style.display = 'block';
        filterResultsCount.textContent = filteredPosts.length;
        filterResultsTotal.textContent = currentPosts.length;
    } else if (filterResults) {
        filterResults.style.display = 'none';
    }
}

// Filter event listeners
if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        currentFilters.search = e.target.value.trim();
        clearSearchBtn.style.display = currentFilters.search ? 'flex' : 'none';
        applyFiltersAndRender();
    });
}

if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        currentFilters.search = '';
        clearSearchBtn.style.display = 'none';
        applyFiltersAndRender();
    });
}

if (albumFilter) {
    albumFilter.addEventListener('change', (e) => {
        currentFilters.album = e.target.value;
        applyFiltersAndRender();
    });
}

if (dateFromInput) {
    dateFromInput.addEventListener('change', (e) => {
        currentFilters.dateFrom = e.target.value || null;
        updateClearDateBtnVisibility();
        applyFiltersAndRender();
    });
}

if (dateToInput) {
    dateToInput.addEventListener('change', (e) => {
        currentFilters.dateTo = e.target.value || null;
        updateClearDateBtnVisibility();
        applyFiltersAndRender();
    });
}

if (clearDateBtn) {
    clearDateBtn.addEventListener('click', () => {
        dateFromInput.value = '';
        dateToInput.value = '';
        currentFilters.dateFrom = null;
        currentFilters.dateTo = null;
        clearDateBtn.style.display = 'none';
        applyFiltersAndRender();
    });
}

function updateClearDateBtnVisibility() {
    if (clearDateBtn) {
        clearDateBtn.style.display = (currentFilters.dateFrom || currentFilters.dateTo) ? 'flex' : 'none';
    }
}

// Sort posts based on current sort settings (for admin view)
function sortPosts(posts) {
    const sorted = [...posts];
    
    // In gallery order mode or sorting by gallery order
    if (isGalleryOrderMode || currentSort.field === 'gallery') {
        const orderMap = {};
        galleryOrder.forEach((slug, index) => {
            orderMap[slug] = index;
        });
        
        sorted.sort((a, b) => {
            const orderA = orderMap[a.slug] !== undefined ? orderMap[a.slug] : 9999;
            const orderB = orderMap[b.slug] !== undefined ? orderMap[b.slug] : 9999;
            return orderA - orderB;
        });
        
        return sorted;
    }
    
    // Normal admin sorting (date or title)
    sorted.sort((a, b) => {
        let valA, valB;
        
        if (currentSort.field === 'date') {
            valA = new Date(a.date || 0).getTime();
            valB = new Date(b.date || 0).getTime();
        } else if (currentSort.field === 'title') {
            valA = (a.title || '').toLowerCase();
            valB = (b.title || '').toLowerCase();
        }
        
        if (currentSort.order === 'asc') {
            return valA > valB ? 1 : valA < valB ? -1 : 0;
        } else {
            return valA < valB ? 1 : valA > valB ? -1 : 0;
        }
    });
    return sorted;
}

// Load gallery order from server
async function loadGalleryOrder() {
    try {
        const response = await fetch('/api/gallery-order');
        if (response.ok) {
            const data = await response.json();
            galleryOrder = data.order || [];
        } else {
            // Fallback to localStorage
            const saved = localStorage.getItem('galleryOrder');
            if (saved) {
                galleryOrder = JSON.parse(saved);
            }
        }
    } catch (e) {
        // Fallback to localStorage
        try {
            const saved = localStorage.getItem('galleryOrder');
            if (saved) {
                galleryOrder = JSON.parse(saved);
            }
        } catch (e2) {
            console.error('Error loading gallery order:', e2);
            galleryOrder = [];
        }
    }
}

// Save gallery order to server (and localStorage as backup)
async function saveGalleryOrder() {
    // Save to localStorage as backup
    try {
        localStorage.setItem('galleryOrder', JSON.stringify(galleryOrder));
    } catch (e) {
        console.error('Error saving gallery order to localStorage:', e);
    }
    
    // Try to save to server
    try {
        const response = await fetch('/api/gallery-order', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order: galleryOrder })
        });
        
        if (!response.ok) {
            console.warn('Could not save gallery order to server, saved locally');
        }
    } catch (e) {
        console.warn('Could not save gallery order to server, saved locally:', e);
    }
}

// Toggle sort menu visibility
function toggleSortMenu() {
    const menu = document.getElementById('sortMenu');
    menu.classList.toggle('open');
}

// Set sort and re-render (admin view only)
async function setSort(field, order) {
    // Exit gallery order mode if active
    if (isGalleryOrderMode) {
        exitGalleryOrderMode();
    }
    
    currentSort = { field, order };
    
    // Load gallery order if sorting by gallery and not loaded yet
    if (field === 'gallery' && galleryOrder.length === 0) {
        await loadGalleryOrder();
        // Initialize with current posts if still empty (sort by date for default order)
        if (galleryOrder.length === 0 && currentPosts.length > 0) {
            const sorted = [...currentPosts].sort((a, b) => {
                const dateA = new Date(a.date || 0).getTime();
                const dateB = new Date(b.date || 0).getTime();
                return dateB - dateA; // newest first
            });
            galleryOrder = sorted.map(p => p.slug);
        }
    }
    
    // Update active state in menu
    document.querySelectorAll('.sort-menu-item').forEach(item => {
        const isActive = item.dataset.sort === field && item.dataset.order === order;
        item.classList.toggle('active', isActive);
    });
    
    // Close menu
    document.getElementById('sortMenu').classList.remove('open');
    
    // Re-render with new sort (respecting filters)
    applyFiltersAndRender();
}

// ========== Gallery Order Mode ==========

const galleryOrderBtn = document.getElementById('galleryOrderBtn');
const exitGalleryOrderBtn = document.getElementById('exitGalleryOrderBtn');
const galleryOrderHint = document.getElementById('galleryOrderHint');

// Enter gallery order editing mode
async function enterGalleryOrderMode() {
    // Load gallery order if not loaded
    if (galleryOrder.length === 0) {
        await loadGalleryOrder();
    }
    
    // Initialize gallery order with all current posts if empty
    if (galleryOrder.length === 0 && currentPosts.length > 0) {
        // Default to current sort order
        galleryOrder = sortPosts(currentPosts).map(p => p.slug);
    }
    
    // Add any new posts that aren't in the gallery order
    currentPosts.forEach(post => {
        if (!galleryOrder.includes(post.slug)) {
            galleryOrder.push(post.slug);
        }
    });
    
    // Remove posts from gallery order that no longer exist
    const currentSlugs = new Set(currentPosts.map(p => p.slug));
    galleryOrder = galleryOrder.filter(slug => currentSlugs.has(slug));
    
    isGalleryOrderMode = true;
    
    // Update UI
    if (galleryOrderBtn) galleryOrderBtn.classList.add('active');
    if (galleryOrderHint) galleryOrderHint.style.display = 'flex';
    if (postsList) postsList.classList.add('reorder-mode', 'gallery-order-mode');
    
    // Hide normal controls
    const sortDropdown = document.getElementById('sortDropdown');
    const filtersRow = document.getElementById('filtersRow');
    if (sortDropdown) sortDropdown.style.display = 'none';
    if (filtersRow) filtersRow.style.display = 'none';
    if (selectModeBtn) selectModeBtn.style.display = 'none';
    
    // Re-render ALL posts in gallery order (ignoring filters)
    displayedPosts = sortPosts(currentPosts);
    renderPosts(displayedPosts);
}

// Exit gallery order editing mode
function exitGalleryOrderMode() {
    isGalleryOrderMode = false;
    
    // Update UI
    if (galleryOrderBtn) galleryOrderBtn.classList.remove('active');
    if (galleryOrderHint) galleryOrderHint.style.display = 'none';
    if (postsList) postsList.classList.remove('reorder-mode', 'gallery-order-mode');
    
    // Restore normal controls
    const sortDropdown = document.getElementById('sortDropdown');
    const filtersRow = document.getElementById('filtersRow');
    if (sortDropdown) sortDropdown.style.display = 'inline-block';
    if (filtersRow) filtersRow.style.display = 'flex';
    if (selectModeBtn) selectModeBtn.style.display = 'inline-flex';
    
    // Re-render in normal sort order (respecting filters)
    applyFiltersAndRender();
}

// Toggle gallery order mode
function toggleGalleryOrderMode() {
    if (isGalleryOrderMode) {
        exitGalleryOrderMode();
    } else {
        enterGalleryOrderMode();
    }
}

// Event listeners for gallery order
if (galleryOrderBtn) {
    galleryOrderBtn.addEventListener('click', toggleGalleryOrderMode);
}

if (exitGalleryOrderBtn) {
    exitGalleryOrderBtn.addEventListener('click', exitGalleryOrderMode);
}

// ========== Highlighted Photos (admin: pin up to 5 at top of gallery) ==========

const MAX_HIGHLIGHTED = 5;
let highlightedPhotosItems = []; // { slug, sizePercent }[], sizePercent default 200

const highlightedPhotosModal = document.getElementById('highlightedPhotosModal');
const highlightedPhotosList = document.getElementById('highlightedPhotosList');
const highlightedAddSection = document.getElementById('highlightedAddSection');
const highlightedAvailableGrid = document.getElementById('highlightedAvailableGrid');
const highlightedPhotosBtn = document.getElementById('highlightedPhotosBtn');
const closeHighlightedModalBtn = document.getElementById('closeHighlightedModalBtn');
const doneHighlightedBtn = document.getElementById('doneHighlightedBtn');

async function loadHighlightedPhotosFromServer() {
    try {
        const response = await fetch('/api/highlighted-photos');
        const data = await response.json();
        if (Array.isArray(data.items)) return data.items;
        if (Array.isArray(data.slugs)) return data.slugs.map(slug => ({ slug, sizePercent: 200 }));
        return [];
    } catch (e) {
        console.error('Error loading highlighted photos:', e);
        return [];
    }
}

async function saveHighlightedPhotosToServer(items) {
    try {
        const response = await fetch('/api/highlighted-photos', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items })
        });
        return response.ok;
    } catch (e) {
        console.error('Error saving highlighted photos:', e);
        return false;
    }
}

function getPostBySlug(slug) {
    return currentPosts.find(p => p.slug === slug) || allPosts.find(p => p.slug === slug);
}

function renderHighlightedList() {
    const slugs = highlightedPhotosItems.map(it => it.slug);
    const posts = highlightedPhotosItems.map(it => ({ ...getPostBySlug(it.slug), sizePercent: it.sizePercent })).filter(p => p.slug);
    highlightedPhotosList.innerHTML = posts.map((post, index) => {
        const thumb = post.thumbnail || post.image || '';
        const title = post.title || post.slug || 'Untitled';
        const pct = Math.min(500, Math.max(100, Number(post.sizePercent) || 200));
        return `
            <div class="highlighted-photo-card" data-slug="${post.slug}" data-index="${index}" draggable="true">
                <div class="highlighted-photo-drag-handle" title="Drag to reorder">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="9" cy="5" r="1.5"></circle>
                        <circle cx="9" cy="12" r="1.5"></circle>
                        <circle cx="9" cy="19" r="1.5"></circle>
                        <circle cx="15" cy="5" r="1.5"></circle>
                        <circle cx="15" cy="12" r="1.5"></circle>
                        <circle cx="15" cy="19" r="1.5"></circle>
                    </svg>
                </div>
                <div class="highlighted-photo-thumb">
                    ${thumb ? `<img src="${thumb}" alt="">` : '<span class="no-thumb">No image</span>'}
                </div>
                <span class="highlighted-photo-title">${escapeHtml(title)}</span>
                <label class="highlighted-size-label" title="Size vs normal grid item (100% = same size)">
                    <input type="number" class="highlighted-size-input" value="${pct}" min="100" max="500" step="10" data-slug="${post.slug}">%
                </label>
                <button type="button" class="highlighted-photo-remove" title="Remove">×</button>
            </div>`;
    }).join('');

    if (highlightedPhotosItems.length < MAX_HIGHLIGHTED) {
        highlightedAddSection.style.display = 'block';
        const available = (currentPosts.length ? currentPosts : allPosts).filter(p => !slugs.includes(p.slug));
        highlightedAvailableGrid.innerHTML = available.map(post => {
            const thumb = post.thumbnail || post.image || '';
            const title = post.title || post.slug || 'Untitled';
            return `
                <button type="button" class="highlighted-available-item" data-slug="${post.slug}" title="${escapeHtml(title)}">
                    ${thumb ? `<img src="${thumb}" alt="">` : '<span>+</span>'}
                </button>`;
        }).join('');
        highlightedAvailableGrid.querySelectorAll('.highlighted-available-item').forEach(btn => {
            btn.addEventListener('click', () => addHighlightedPhoto(btn.dataset.slug));
        });
    } else {
        highlightedAddSection.style.display = 'none';
    }

    // Attach remove, drag, and size input
    highlightedPhotosList.querySelectorAll('.highlighted-photo-card').forEach(card => {
        card.querySelector('.highlighted-photo-remove').addEventListener('click', () => removeHighlightedPhoto(card.dataset.slug));
        const sizeInput = card.querySelector('.highlighted-size-input');
        if (sizeInput) {
            sizeInput.addEventListener('change', () => {
                const val = parseInt(sizeInput.value, 10);
                if (!isNaN(val)) setHighlightedSize(card.dataset.slug, Math.min(500, Math.max(100, val)));
            });
        }
        card.addEventListener('dragstart', handleHighlightedDragStart);
        card.addEventListener('dragover', handleHighlightedDragOver);
        card.addEventListener('drop', handleHighlightedDrop);
        card.addEventListener('dragend', handleHighlightedDragEnd);
    });
}

function setHighlightedSize(slug, sizePercent) {
    const it = highlightedPhotosItems.find(i => i.slug === slug);
    if (it) it.sizePercent = sizePercent;
}

function addHighlightedPhoto(slug) {
    if (highlightedPhotosItems.length >= MAX_HIGHLIGHTED || highlightedPhotosItems.some(i => i.slug === slug)) return;
    highlightedPhotosItems.push({ slug, sizePercent: 200 });
    renderHighlightedList();
}

function removeHighlightedPhoto(slug) {
    highlightedPhotosItems = highlightedPhotosItems.filter(i => i.slug !== slug);
    renderHighlightedList();
}

let highlightedDragSrc = null;

function handleHighlightedDragStart(e) {
    highlightedDragSrc = e.currentTarget;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', e.currentTarget.dataset.index);
    e.currentTarget.classList.add('dragging');
}

function handleHighlightedDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const card = e.currentTarget;
    if (card !== highlightedDragSrc) card.classList.add('drag-over');
}

function handleHighlightedDragEnd(e) {
    e.currentTarget.classList.remove('dragging');
    highlightedPhotosList.querySelectorAll('.highlighted-photo-card').forEach(c => c.classList.remove('drag-over'));
    highlightedDragSrc = null;
}

function handleHighlightedDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    if (!highlightedDragSrc) return;
    const fromIndex = parseInt(highlightedDragSrc.dataset.index);
    const toIndex = parseInt(e.currentTarget.dataset.index);
    if (fromIndex === toIndex) return;
    const [moved] = highlightedPhotosItems.splice(fromIndex, 1);
    highlightedPhotosItems.splice(toIndex, 0, moved);
    renderHighlightedList();
}

async function openHighlightedModal() {
    // Ensure posts are loaded first so thumbnails resolve
    if (currentPosts.length === 0 && allPosts.length === 0) {
        try {
            const res = await fetch('/api/posts');
            if (res.ok) {
                const list = await res.json();
                allPosts = list.posts || list || [];
            }
        } catch (e) { console.error('Error loading posts for highlighted modal:', e); }
    }
    highlightedPhotosItems = await loadHighlightedPhotosFromServer();
    renderHighlightedList();
    if (highlightedPhotosModal) highlightedPhotosModal.style.display = 'flex';
}

function closeHighlightedModal() {
    if (highlightedPhotosModal) highlightedPhotosModal.style.display = 'none';
}

async function doneHighlightedModal() {
    const ok = await saveHighlightedPhotosToServer(highlightedPhotosItems);
    closeHighlightedModal();
    if (ok) showListMessage('Highlighted photos saved', 'success');
    else showListMessage('Failed to save highlighted photos', 'error');
}

if (highlightedPhotosBtn) highlightedPhotosBtn.addEventListener('click', openHighlightedModal);
if (closeHighlightedModalBtn) closeHighlightedModalBtn.addEventListener('click', closeHighlightedModal);
if (doneHighlightedBtn) doneHighlightedBtn.addEventListener('click', doneHighlightedModal);
if (highlightedPhotosModal) {
    highlightedPhotosModal.addEventListener('click', e => {
        if (e.target === highlightedPhotosModal) closeHighlightedModal();
    });
}

// Close sort menu when clicking outside
document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('sortDropdown');
    if (dropdown && !dropdown.contains(e.target)) {
        document.getElementById('sortMenu').classList.remove('open');
    }
});

// Make sort functions available globally
window.toggleSortMenu = toggleSortMenu;
window.setSort = setSort;

// Render posts with selection mode support
function renderPosts(posts) {
    postsList.innerHTML = posts.map((post, index) => `
        <div class="post-card ${isSelectMode ? 'selectable' : ''} ${selectedPosts.has(post.slug) ? 'selected' : ''} ${isGalleryOrderMode ? 'reorderable' : ''}" 
             data-slug="${post.slug}" 
             data-index="${index}"
             ${isGalleryOrderMode && !isSelectMode ? 'draggable="true"' : ''}
             ${isSelectMode ? `onclick="handlePostRowClick(event, '${post.slug}', ${index})"` : ''}>
            ${isGalleryOrderMode && !isSelectMode ? `
                <div class="post-drag-handle" title="Drag to reorder">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="9" cy="5" r="1.5"></circle>
                        <circle cx="9" cy="12" r="1.5"></circle>
                        <circle cx="9" cy="19" r="1.5"></circle>
                        <circle cx="15" cy="5" r="1.5"></circle>
                        <circle cx="15" cy="12" r="1.5"></circle>
                        <circle cx="15" cy="19" r="1.5"></circle>
                    </svg>
                </div>
                <div class="post-order-badge">${index + 1}</div>
            ` : ''}
            ${isSelectMode ? `
                <div class="post-checkbox">
                    <input type="checkbox" ${selectedPosts.has(post.slug) ? 'checked' : ''}>
                </div>
            ` : ''}
            <div class="post-image" onclick="${!isSelectMode ? (isGalleryOrderMode ? '' : `editPost('${post.slug}')`) : ''}">
                ${post.image ? `<img src="${post.image}" alt="${post.title || 'Untitled'}" onerror="this.style.display='none'">` : '<div class="no-image">No Image</div>'}
            </div>
            <div class="post-content ${isSelectMode || isGalleryOrderMode ? '' : 'editable'}">
                ${isSelectMode || isGalleryOrderMode ? `
                    <h3 class="post-title">${escapeHtml(post.title || 'Untitled')}</h3>
                    <p class="post-description">${escapeHtml(post.description || 'No description')}</p>
                ` : `
                    <input type="text" 
                           class="inline-edit-title" 
                           value="${escapeHtml(post.title || '')}" 
                           placeholder="Untitled"
                           data-slug="${post.slug}"
                           data-field="title"
                           oninput="debouncedSaveInlineField(this)"
                           onblur="saveInlineField(this)"
                           onkeydown="handleInlineKeydown(event, this)">
                    <input type="text" 
                           class="inline-edit-description" 
                           value="${escapeHtml(post.description || '')}" 
                           placeholder="No description"
                           data-slug="${post.slug}"
                           data-field="description"
                           oninput="debouncedSaveInlineField(this)"
                           onblur="saveInlineField(this)"
                           onkeydown="handleInlineKeydown(event, this)">
                `}
                <div class="post-meta">
                    ${isSelectMode || isGalleryOrderMode ? `
                        <span class="post-date">${formatDate(post.photoDate || post.date)}</span>
                    ` : `
                        <input type="date" 
                               class="inline-edit-date" 
                               value="${toDateInputValue(post.photoDate || post.date)}" 
                               data-slug="${post.slug}"
                               data-field="photoDate"
                               onchange="saveInlineField(this)"
                               onblur="saveInlineField(this)">
                    `}
                    ${post.draft ? '<span class="draft-badge">Draft</span>' : ''}
                </div>
            </div>
            ${!isSelectMode && !isGalleryOrderMode ? `
                <div class="post-actions">
                    <button class="btn btn-sm btn-edit" onclick="editPost('${post.slug}')" title="Full edit">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                    </button>
                    <button class="btn btn-sm btn-delete-inline" onclick="deletePostInline('${post.slug}')" title="Delete">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            ` : ''}
        </div>
    `).join('');
    
    // Initialize drag-and-drop if in gallery order mode
    if (isGalleryOrderMode && !isSelectMode) {
        initPostDragDrop();
    }
}

// ========== Photo Drag and Drop Reordering ==========

let draggedPostItem = null;
let draggedPostIndex = null;

function initPostDragDrop() {
    const items = postsList.querySelectorAll('.post-card.reorderable');
    
    items.forEach(item => {
        item.addEventListener('dragstart', handlePostDragStart);
        item.addEventListener('dragend', handlePostDragEnd);
        item.addEventListener('dragover', handlePostDragOver);
        item.addEventListener('dragenter', handlePostDragEnter);
        item.addEventListener('dragleave', handlePostDragLeave);
        item.addEventListener('drop', handlePostDrop);
    });
}

function handlePostDragStart(e) {
    draggedPostItem = this;
    draggedPostIndex = parseInt(this.dataset.index);
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', this.dataset.slug);
    
    // Add a slight delay to allow the dragging class to take effect
    setTimeout(() => {
        this.style.opacity = '0.5';
    }, 0);
}

function handlePostDragEnd(e) {
    this.classList.remove('dragging');
    this.style.opacity = '';
    draggedPostItem = null;
    draggedPostIndex = null;
    
    // Remove all drag-over classes
    postsList.querySelectorAll('.post-card').forEach(item => {
        item.classList.remove('drag-over', 'drag-over-left', 'drag-over-right');
    });
}

function handlePostDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

function handlePostDragEnter(e) {
    e.preventDefault();
    if (this !== draggedPostItem) {
        const thisIndex = parseInt(this.dataset.index);
        // Show indicator on which side the item will be inserted
        this.classList.remove('drag-over-left', 'drag-over-right');
        if (thisIndex < draggedPostIndex) {
            this.classList.add('drag-over-left');
        } else {
            this.classList.add('drag-over-right');
        }
    }
}

function handlePostDragLeave(e) {
    this.classList.remove('drag-over', 'drag-over-left', 'drag-over-right');
}

function handlePostDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    
    if (this !== draggedPostItem) {
        const fromIndex = draggedPostIndex;
        const toIndex = parseInt(this.dataset.index);
        
        // Remove from old position and insert at new position
        const [movedSlug] = galleryOrder.splice(fromIndex, 1);
        galleryOrder.splice(toIndex, 0, movedSlug);
        
        // Save gallery order
        saveGalleryOrder();
        
        // Re-render
        displayedPosts = sortPosts(currentPosts);
        renderPosts(displayedPosts);
        
        // Show feedback
        showListMessage('Gallery order updated', 'success');
    }
    
    return false;
}

// Inline editing functions
let inlineEditPending = {};
let inlineEditTimers = {};  // Debounce timers for each field
let inlineEditControllers = {};  // AbortControllers for pending requests

async function saveInlineField(input) {
    const slug = input.dataset.slug;
    const field = input.dataset.field;
    const value = input.value.trim();
    const key = `${slug}-${field}`;
    
    // Clear any pending debounce timer
    if (inlineEditTimers[key]) {
        clearTimeout(inlineEditTimers[key]);
        delete inlineEditTimers[key];
    }
    
    // Check if value actually changed (avoid unnecessary saves)
    if (inlineEditPending[key] === value) return;
    inlineEditPending[key] = value;
    
    // Cancel any in-flight request for this field
    if (inlineEditControllers[key]) {
        inlineEditControllers[key].abort();
    }
    
    // Add saving indicator
    input.classList.add('saving');
    
    // Create new AbortController for this request
    const controller = new AbortController();
    inlineEditControllers[key] = controller;
    
    try {
        const formData = new FormData();
        formData.append(field, value);
        
        const response = await fetch(`/api/posts/${slug}`, {
            method: 'PUT',
            body: formData,
            signal: controller.signal
        });
        
        // Clean up controller
        delete inlineEditControllers[key];
        
        if (response.ok) {
            input.classList.remove('saving');
            input.classList.add('saved');
            setTimeout(() => input.classList.remove('saved'), 1000);
        } else {
            input.classList.remove('saving');
            input.classList.add('error');
            setTimeout(() => input.classList.remove('error'), 2000);
        }
    } catch (error) {
        // Clean up controller
        delete inlineEditControllers[key];
        
        // Ignore abort errors (expected when cancelling)
        if (error.name === 'AbortError') {
            input.classList.remove('saving');
            return;
        }
        
        console.error('Error saving inline edit:', error);
        input.classList.remove('saving');
        input.classList.add('error');
        setTimeout(() => input.classList.remove('error'), 2000);
    }
}

// Debounced save - called on input to auto-save while typing
function debouncedSaveInlineField(input) {
    const slug = input.dataset.slug;
    const field = input.dataset.field;
    const key = `${slug}-${field}`;
    
    // Clear existing timer
    if (inlineEditTimers[key]) {
        clearTimeout(inlineEditTimers[key]);
    }
    
    // Set new timer - save after 500ms of no typing
    inlineEditTimers[key] = setTimeout(() => {
        saveInlineField(input);
        delete inlineEditTimers[key];
    }, 500);
}

function handleInlineKeydown(event, input) {
    if (event.key === 'Enter') {
        event.preventDefault();
        input.blur();
    } else if (event.key === 'Escape') {
        event.preventDefault();
        // Reload to reset value
        loadPosts();
    }
}

async function deletePostInline(slug) {
    if (!confirm('Delete this photo? This cannot be undone.')) {
        return;
    }
    
    // Optimistic UI - fade out the card
    const card = document.querySelector(`.post-card[data-slug="${slug}"]`);
    if (card) {
        card.classList.add('deleting');
    }
    
    try {
        const response = await fetch(`/api/posts/${slug}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            // Remove card after animation
            setTimeout(() => {
                if (card) card.remove();
                // Check if list is empty
                if (postsList.querySelectorAll('.post-card').length === 0) {
                    postsList.innerHTML = '<div class="empty-state">No posts yet. Click "Add Photos" to get started!</div>';
                }
            }, 300);
            showListMessage('Photo deleted.', 'success');
        } else {
            // Restore card on error
            if (card) card.classList.remove('deleting');
            const data = await response.json();
            showListMessage(data.error || 'Failed to delete photo', 'error');
        }
    } catch (error) {
        console.error('Error deleting post:', error);
        if (card) card.classList.remove('deleting');
        showListMessage('Network error. Please try again.', 'error');
    }
}

// Make inline functions available globally
window.saveInlineField = saveInlineField;
window.debouncedSaveInlineField = debouncedSaveInlineField;
window.handleInlineKeydown = handleInlineKeydown;
window.deletePostInline = deletePostInline;

// Selection mode functions
function enterSelectMode() {
    // Exit gallery order mode if active
    if (isGalleryOrderMode) {
        exitGalleryOrderMode();
    }
    
    isSelectMode = true;
    selectedPosts.clear();
    lastSelectedIndex = null; // Reset for shift-click range selection
    updateSelectedCount();
    selectModeBtn.style.display = 'none';
    addPostBtn.style.display = 'none';
    deleteSelectedBtn.style.display = 'inline-flex';
    cancelSelectBtn.style.display = 'inline-flex';
    if (addToAlbumBtn) addToAlbumBtn.style.display = 'none'; // Will show when photos selected
    if (galleryOrderBtn) galleryOrderBtn.style.display = 'none';
    if (highlightedPhotosBtn) highlightedPhotosBtn.style.display = 'none';
    const bulkEditBtnEl = document.getElementById('bulkEditBtn');
    if (bulkEditBtnEl) bulkEditBtnEl.style.display = 'none'; // Will show when photos selected
    
    loadPosts();
}

function exitSelectMode() {
    isSelectMode = false;
    selectedPosts.clear();
    lastSelectedIndex = null; // Reset for shift-click range selection
    selectModeBtn.style.display = 'inline-flex';
    addPostBtn.style.display = 'inline-flex';
    deleteSelectedBtn.style.display = 'none';
    cancelSelectBtn.style.display = 'none';
    if (addToAlbumBtn) addToAlbumBtn.style.display = 'none';
    if (galleryOrderBtn) galleryOrderBtn.style.display = 'inline-flex';
    if (highlightedPhotosBtn) highlightedPhotosBtn.style.display = 'inline-flex';
    const bulkEditBtnEl = document.getElementById('bulkEditBtn');
    if (bulkEditBtnEl) bulkEditBtnEl.style.display = 'none';
    
    loadPosts();
}

function togglePostSelection(slug, forceState) {
    if (forceState === undefined) {
        if (selectedPosts.has(slug)) {
            selectedPosts.delete(slug);
        } else {
            selectedPosts.add(slug);
        }
    } else if (forceState) {
        selectedPosts.add(slug);
    } else {
        selectedPosts.delete(slug);
    }
    
    updateSelectedCount();
    
    // Update visual state
    const card = document.querySelector(`.post-card[data-slug="${slug}"]`);
    if (card) {
        card.classList.toggle('selected', selectedPosts.has(slug));
        const checkbox = card.querySelector('input[type="checkbox"]');
        if (checkbox) {
            checkbox.checked = selectedPosts.has(slug);
        }
    }
}

// Handle click on post row in select mode (supports shift+click for range selection)
function handlePostRowClick(event, slug, index) {
    // Prevent text selection on shift+click
    if (event.shiftKey) {
        event.preventDefault();
        window.getSelection()?.removeAllRanges();
    }
    
    // Prevent double-triggering if clicking on the checkbox itself
    if (event.target.type === 'checkbox') {
        // Let the checkbox handle it directly
        togglePostSelection(slug, event.target.checked);
        lastSelectedIndex = index;
        return;
    }
    
    // Handle shift+click for range selection
    if (event.shiftKey && lastSelectedIndex !== null) {
        const start = Math.min(lastSelectedIndex, index);
        const end = Math.max(lastSelectedIndex, index);
        
        // Select all posts in the range using displayedPosts (which is in actual display order)
        for (let i = start; i <= end; i++) {
            if (displayedPosts[i]) {
                selectedPosts.add(displayedPosts[i].slug);
            }
        }
        
        // Update visual state for all cards in range
        for (let i = start; i <= end; i++) {
            if (displayedPosts[i]) {
                const card = document.querySelector(`.post-card[data-slug="${displayedPosts[i].slug}"]`);
                if (card) {
                    card.classList.add('selected');
                    const checkbox = card.querySelector('input[type="checkbox"]');
                    if (checkbox) {
                        checkbox.checked = true;
                    }
                }
            }
        }
        
        updateSelectedCount();
    } else {
        // Normal click - toggle selection
        togglePostSelection(slug);
        lastSelectedIndex = index;
    }
}

window.handlePostRowClick = handlePostRowClick;

function updateSelectedCount() {
    selectedCountSpan.textContent = selectedPosts.size;
    deleteSelectedBtn.disabled = selectedPosts.size === 0;
}

// Batch delete selected posts
async function deleteSelectedPosts() {
    if (selectedPosts.size === 0) return;
    
    const slugsToDelete = Array.from(selectedPosts);
    const total = slugsToDelete.length;
    
    // Optimistic UI: Remove cards immediately
    slugsToDelete.forEach(slug => {
        const card = document.querySelector(`.post-card[data-slug="${slug}"]`);
        if (card) {
            card.classList.add('deleting');
            setTimeout(() => card.remove(), 300);
        }
    });
    
    showListMessage(`Deleting ${total} post${total > 1 ? 's' : ''}...`, 'info');
    
    try {
        // Use batch delete endpoint
        const response = await fetch('/api/posts/batch-delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slugs: slugsToDelete })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showListMessage(`Successfully deleted ${data.deleted} post${data.deleted > 1 ? 's' : ''}.`, 'success');
            exitSelectMode();
        } else {
            showListMessage(data.error || 'Failed to delete some posts', 'error');
            loadPosts(); // Refresh to show actual state
        }
    } catch (error) {
        console.error('Error deleting posts:', error);
        showListMessage('Network error. Please try again.', 'error');
        loadPosts(); // Refresh to show actual state
    }
}

// Show form view for adding new post
function showFormView() {
    // Exit gallery order mode if active
    if (isGalleryOrderMode) {
        exitGalleryOrderMode();
    }
    
    isEditMode = false;
    currentEditingSlug = null;
    formTitle.textContent = 'Add Photos';
    submitBtnText.textContent = 'Upload & Create Post';
    deleteBtn.style.display = 'none';
    draftGroup.style.display = 'none';
    form.reset();
    previewContainer.style.display = 'none';
    previewGrid.innerHTML = '';
    currentImageContainer.style.display = 'none';
    fileName.textContent = '';
    fileInputText.textContent = 'Choose photos (you can select multiple)';
    photoInput.required = false; // Title not required anymore
    photoInput.multiple = true;
    batchInfo.style.display = 'none';
    uploadProgress.style.display = 'none';
    message.style.display = 'none';
    
    // Hide crop, dark mode, and frame sections for new posts
    cropSection.style.display = 'none';
    darkModeSection.style.display = 'none';
    darkModeInput.value = '';
    darkModeFileText.textContent = 'Choose dark mode image';
    darkModePreview.style.display = 'none';
    removeDarkModeFlag = false;
    frameSection.style.display = 'none';
    resetFrameData();
    
    managementView.style.display = 'none';
    formView.style.display = 'block';
}

// Show form view for editing existing post
async function editPost(slug) {
    try {
        isEditMode = true;
        currentEditingSlug = slug;
        formTitle.textContent = 'Edit Post';
        submitBtnText.textContent = 'Update Post';
        deleteBtn.style.display = 'block';
        draftGroup.style.display = 'block';
        photoInput.required = false;
        photoInput.multiple = false; // Single file for edits
        fileInputText.textContent = 'Choose a new photo (optional)';
        batchInfo.style.display = 'none';
        uploadProgress.style.display = 'none';
        message.style.display = 'none';
        
        // Reset file input
        photoInput.value = '';
        fileName.textContent = '';
        previewContainer.style.display = 'none';
        previewGrid.innerHTML = '';
        
        // Reset dark mode state
        darkModeInput.value = '';
        darkModeFileText.textContent = 'Choose dark mode image';
        removeDarkModeFlag = false;
        
        // Load post data
        const response = await fetch(`/api/posts/${slug}`);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to load post');
        }
        
        // Populate form
        titleInput.value = data.title || '';
        descriptionInput.value = data.description || '';
        tagsInput.value = (data.tags || []).join(', ');
        draftInput.checked = data.draft || false;
        
        // Show and populate photo date, camera, and location fields
        photoDateGroup.style.display = 'block';
        cameraGroup.style.display = 'block';
        locationGroup.style.display = 'block';
        photoDateInput.value = toDateInputValue(data.photoDate || '') || '';
        cameraInput.value = data.camera || '';
        
        // Populate location if exists
        if (data.location && data.location.name) {
            currentLocation = data.location;
            selectedLocationName.textContent = data.location.name;
            selectedLocation.style.display = 'flex';
        } else {
            clearLocation();
        }
        
        // Show current image if available
        if (data.image) {
            currentImage.src = data.image;
            currentImageContainer.style.display = 'block';
            previewContainer.style.display = 'none';
            
            // Initialize crop tool
            cropSection.style.display = 'block';
            removeThumbnailFlag = false;
            thumbnailCropModified = !!(data.thumbnailCrop); // only true if thumbnail already exists
            if (removeThumbnailBtn) removeThumbnailBtn.classList.remove('active');
            initCropTool(data.image, data.thumbnailCrop || null);
        } else {
            currentImageContainer.style.display = 'none';
            cropSection.style.display = 'none';
        }
        
        // Show dark mode section
        darkModeSection.style.display = 'block';
        if (data.darkModeImage) {
            darkModeImage.src = data.darkModeImage;
            darkModePreview.style.display = 'block';
        } else {
            darkModePreview.style.display = 'none';
        }
        
        // Show frame section and initialize frame tool
        if (data.image) {
            frameSection.style.display = 'block';
            initFrameTool(data.image, data.frame || null);
        } else {
            frameSection.style.display = 'none';
        }
        
        managementView.style.display = 'none';
        formView.style.display = 'block';
        
    } catch (error) {
        console.error('Error loading post:', error);
        showMessage(`Error loading post: ${error.message}`, 'error');
    }
}

// Show management view
function showManagementView() {
    // Reset form state
    form.reset();
    photoInput.value = '';
    fileName.textContent = '';
    previewContainer.style.display = 'none';
    previewGrid.innerHTML = '';
    currentImageContainer.style.display = 'none';
    batchInfo.style.display = 'none';
    uploadProgress.style.display = 'none';
    
    // Reset crop, dark mode, and frame state
    cropSection.style.display = 'none';
    darkModeSection.style.display = 'none';
    darkModeInput.value = '';
    darkModeFileText.textContent = 'Choose dark mode image';
    darkModePreview.style.display = 'none';
    removeDarkModeFlag = false;
    removeThumbnailFlag = false;
    thumbnailCropModified = false;
    frameSection.style.display = 'none';
    resetFrameData();
    
    // Hide photo date, camera, and location fields (only shown in edit mode)
    photoDateGroup.style.display = 'none';
    cameraGroup.style.display = 'none';
    locationGroup.style.display = 'none';
    clearLocation();
    
    managementView.style.display = 'block';
    formView.style.display = 'none';
    loadPosts();
}

// Create new post (single upload)
async function createPost() {
    const formData = new FormData();
    formData.append('photo', photoInput.files[0]);
    formData.append('title', titleInput.value.trim());
    formData.append('description', descriptionInput.value.trim());
    formData.append('tags', tagsInput.value.trim());
    
    const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
    });
    
    const data = await response.json();
    
    if (response.ok) {
        showMessage('Photo uploaded successfully!', 'success');
        setTimeout(() => showManagementView(), 1000);
    } else {
        showMessage(data.error || 'Failed to upload photo', 'error');
    }
}

// Batch upload multiple photos
async function batchUpload() {
    const files = photoInput.files;
    const total = files.length;
    let completed = 0;
    let failed = 0;
    
    uploadProgress.style.display = 'block';
    progressFill.style.width = '0%';
    progressText.textContent = `Uploading 0 of ${total}...`;
    
    const title = titleInput.value.trim();
    const description = descriptionInput.value.trim();
    const tags = tagsInput.value.trim();
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append('photo', file);
        // For batch, append index to title if title provided
        const photoTitle = title ? (files.length > 1 ? `${title} ${i + 1}` : title) : '';
        formData.append('title', photoTitle);
        formData.append('description', description);
        formData.append('tags', tags);
        
        try {
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });
            
            if (response.ok) {
                completed++;
            } else {
                failed++;
            }
        } catch (error) {
            failed++;
            console.error('Upload error for file:', file.name, error);
        }
        
        // Update progress
        const progress = ((i + 1) / total) * 100;
        progressFill.style.width = `${progress}%`;
        progressText.textContent = `Uploading ${i + 1} of ${total}...`;
    }
    
    uploadProgress.style.display = 'none';
    
    if (failed === 0) {
        showMessage(`Successfully uploaded ${completed} photo${completed > 1 ? 's' : ''}!`, 'success');
    } else {
        showMessage(`Uploaded ${completed} of ${total} photos. ${failed} failed.`, 'error');
    }
    
    setTimeout(() => showManagementView(), 1500);
}

// Update existing post
async function updatePost() {
    const formData = new FormData();
    
    // Add photo if a new one was selected
    if (photoInput.files[0]) {
        formData.append('photo', photoInput.files[0]);
    }
    
    formData.append('title', titleInput.value.trim());
    formData.append('description', descriptionInput.value.trim());
    formData.append('tags', tagsInput.value.trim());
    formData.append('draft', draftInput.checked);
    formData.append('photoDate', photoDateInput.value.trim());
    formData.append('camera', cameraInput.value.trim());
    formData.append('location', currentLocation ? JSON.stringify(currentLocation) : '');
    
    // Thumbnail: either remove it or send crop data (only if user explicitly modified it)
    if (removeThumbnailFlag) {
        formData.append('removeThumbnail', 'true');
    } else if (thumbnailCropModified && cropSection.style.display !== 'none' && cropData.width > 0 && cropData.height > 0) {
        formData.append('thumbnailCrop', JSON.stringify({
            x: cropData.x,
            y: cropData.y,
            width: cropData.width,
            height: cropData.height,
            aspect: cropAspectMode
        }));
    }
    
    // Add frame data
    if (frameSection.style.display !== 'none') {
        formData.append('frame', JSON.stringify({
            type: frameData.type,
            insetWidth: frameData.insetWidth,
            color: frameData.color
        }));
    }
    
    // Add dark mode image if selected
    if (darkModeInput.files[0]) {
        formData.append('darkModePhoto', darkModeInput.files[0]);
    }
    
    // Flag to remove dark mode image
    if (removeDarkModeFlag) {
        formData.append('removeDarkMode', 'true');
    }
    
    const response = await fetch(`/api/posts/${currentEditingSlug}`, {
        method: 'PUT',
        body: formData
    });
    
    const data = await response.json();
    
    if (response.ok) {
        showMessage('Post updated successfully!', 'success');
        setTimeout(() => showManagementView(), 1000);
    } else {
        showMessage(data.error || 'Failed to update post', 'error');
    }
}

// Delete single post (optimistic UI)
async function deletePost() {
    try {
        deleteBtn.disabled = true;
        deleteBtn.innerHTML = `
            <svg class="btn-loader" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
            Deleting...
        `;
        
        // Show immediate feedback
        showMessage('Deleting post...', 'info');
        
        const response = await fetch(`/api/posts/${currentEditingSlug}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showMessage('Post deleted!', 'success');
            // Go back immediately - don't wait
            setTimeout(() => showManagementView(), 500);
        } else {
            showMessage(data.error || 'Failed to delete post', 'error');
            deleteBtn.disabled = false;
            deleteBtn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
                Delete Post
            `;
        }
    } catch (error) {
        console.error('Error deleting post:', error);
        showMessage('Network error. Please check if the server is running.', 'error');
        deleteBtn.disabled = false;
    }
}

function showMessage(text, type) {
    message.textContent = text;
    message.className = `message ${type}`;
    message.style.display = 'block';
}

function showListMessage(text, type) {
    listMessage.textContent = text;
    listMessage.className = `message ${type}`;
    listMessage.style.display = 'block';
    
    // Auto-hide success messages
    if (type === 'success') {
        setTimeout(() => {
            listMessage.style.display = 'none';
        }, 3000);
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateString) {
    if (!dateString) return 'No date';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });
    } catch (e) {
        return dateString;
    }
}

function toDateInputValue(dateString) {
    if (!dateString) return '';
    const s = String(dateString).trim();
    // Treat YYYY-MM-DD (and ISO strings starting with it) as calendar date only — no timezone shift
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
    try {
        const d = new Date(s);
        if (isNaN(d.getTime())) return '';
        const y = d.getUTCFullYear();
        const m = String(d.getUTCMonth() + 1).padStart(2, '0');
        const day = String(d.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    } catch (e) {
        return '';
    }
}

// ========== Crop Tool Functions ==========

function initCropTool(imageSrc, existingCrop = null) {
    cropImage.onload = () => {
        cropData.imageWidth = cropImage.naturalWidth;
        cropData.imageHeight = cropImage.naturalHeight;
        
        // Load aspect ratio from saved data or default to 4:5
        if (existingCrop && existingCrop.aspect) {
            cropAspectMode = existingCrop.aspect;
        } else {
            cropAspectMode = '4:5';
        }
        
        // Update UI to reflect aspect mode
        updateCropAspectUI();
        updateCropHint();
        
        if (existingCrop && existingCrop.width > 0 && existingCrop.height > 0) {
            // Use existing crop data (normalized)
            cropData.x = existingCrop.x;
            cropData.y = existingCrop.y;
            cropData.width = existingCrop.width;
            cropData.height = existingCrop.height;
        } else {
            // Initialize with centered crop covering max area
            resetCropToDefault();
        }
        
        updateCropBox();
        updateCropPreview();
    };
    cropImage.src = imageSrc;
}

function updateCropAspectUI() {
    cropAspectOptions.querySelectorAll('.crop-aspect-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.aspect === cropAspectMode);
    });
}

function resetCropToDefault() {
    const imgAspect = cropData.imageWidth / cropData.imageHeight;
    const targetAspect = getCropAspectRatio();
    
    // Freeform mode - use full image
    if (targetAspect === null) {
        cropData.x = 0;
        cropData.y = 0;
        cropData.width = 1;
        cropData.height = 1;
        return;
    }
    
    if (imgAspect > targetAspect) {
        // Image is wider than target - fit to height
        cropData.height = 1;
        cropData.width = (cropData.imageHeight * targetAspect) / cropData.imageWidth;
        cropData.y = 0;
        cropData.x = (1 - cropData.width) / 2;
    } else {
        // Image is taller than target - fit to width
        cropData.width = 1;
        cropData.height = (cropData.imageWidth / targetAspect) / cropData.imageHeight;
        cropData.x = 0;
        cropData.y = (1 - cropData.height) / 2;
    }
}

function updateCropBox() {
    const wrapperRect = cropWrapper.getBoundingClientRect();
    const imgRect = cropImage.getBoundingClientRect();
    
    // Calculate display scale
    const scaleX = imgRect.width / cropData.imageWidth;
    const scaleY = imgRect.height / cropData.imageHeight;
    
    // Convert normalized coords to pixels
    const x = cropData.x * imgRect.width;
    const y = cropData.y * imgRect.height;
    const w = cropData.width * imgRect.width;
    const h = cropData.height * imgRect.height;
    
    cropBox.style.left = x + 'px';
    cropBox.style.top = y + 'px';
    cropBox.style.width = w + 'px';
    cropBox.style.height = h + 'px';
}

function updateCropPreview() {
    const ctx = cropPreview.getContext('2d');
    
    // Source coordinates (in actual image pixels)
    const sx = cropData.x * cropData.imageWidth;
    const sy = cropData.y * cropData.imageHeight;
    const sw = cropData.width * cropData.imageWidth;
    const sh = cropData.height * cropData.imageHeight;
    
    // Calculate preview dimensions based on actual crop aspect
    const cropAspect = sw / sh;
    const maxSize = 300;
    let previewW, previewH;
    
    if (cropAspect > 1) {
        // Wider than tall
        previewW = maxSize;
        previewH = maxSize / cropAspect;
    } else {
        // Taller than wide
        previewH = maxSize;
        previewW = maxSize * cropAspect;
    }
    
    // Update canvas size
    cropPreview.width = Math.round(previewW);
    cropPreview.height = Math.round(previewH);
    
    // Clear and draw
    ctx.clearRect(0, 0, previewW, previewH);
    ctx.drawImage(cropImage, sx, sy, sw, sh, 0, 0, previewW, previewH);
}

function constrainCrop() {
    const targetAspect = getCropAspectRatio();
    
    // Enforce aspect ratio (unless freeform)
    if (targetAspect !== null) {
        const currentAspect = (cropData.width * cropData.imageWidth) / (cropData.height * cropData.imageHeight);
        if (Math.abs(currentAspect - targetAspect) > 0.01) {
            cropData.height = (cropData.width * cropData.imageWidth) / (targetAspect * cropData.imageHeight);
        }
    }
    
    // Constrain to image bounds
    cropData.x = Math.max(0, Math.min(cropData.x, 1 - cropData.width));
    cropData.y = Math.max(0, Math.min(cropData.y, 1 - cropData.height));
    cropData.width = Math.min(cropData.width, 1 - cropData.x);
    cropData.height = Math.min(cropData.height, 1 - cropData.y);
}

function getEventPos(e) {
    if (e.touches && e.touches.length > 0) {
        return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
}

function handleCropStart(e) {
    e.preventDefault();
    const pos = getEventPos(e);
    const imgRect = cropImage.getBoundingClientRect();
    
    // Check if clicking on a handle
    const handle = e.target.closest('.crop-handle');
    if (handle) {
        cropData.isResizing = true;
        cropData.activeHandle = handle.dataset.handle;
    } else if (e.target === cropBox || e.target.closest('.crop-box')) {
        cropData.isDragging = true;
    } else {
        return;
    }
    
    cropData.startX = pos.x;
    cropData.startY = pos.y;
    cropData.startCropX = cropData.x;
    cropData.startCropY = cropData.y;
    cropData.startCropW = cropData.width;
    cropData.startCropH = cropData.height;
}

function handleCropMove(e) {
    if (!cropData.isDragging && !cropData.isResizing) return;
    e.preventDefault();
    
    const pos = getEventPos(e);
    const imgRect = cropImage.getBoundingClientRect();
    
    const dx = (pos.x - cropData.startX) / imgRect.width;
    const dy = (pos.y - cropData.startY) / imgRect.height;
    
    if (cropData.isDragging) {
        cropData.x = cropData.startCropX + dx;
        cropData.y = cropData.startCropY + dy;
        constrainCrop();
    } else if (cropData.isResizing) {
        const handle = cropData.activeHandle;
        const targetAspect = getCropAspectRatio();
        let newW = cropData.startCropW;
        let newH = cropData.startCropH;
        let newX = cropData.startCropX;
        let newY = cropData.startCropY;
        
        // Handle resize based on which corner
        if (handle === 'se') {
            newW = Math.max(0.1, cropData.startCropW + dx);
            if (targetAspect === null) {
                // Freeform - adjust height independently
                newH = Math.max(0.1, cropData.startCropH + dy);
            }
        } else if (handle === 'sw') {
            newW = Math.max(0.1, cropData.startCropW - dx);
            newX = cropData.startCropX + (cropData.startCropW - newW);
            if (targetAspect === null) {
                newH = Math.max(0.1, cropData.startCropH + dy);
            }
        } else if (handle === 'ne') {
            newW = Math.max(0.1, cropData.startCropW + dx);
            if (targetAspect === null) {
                newH = Math.max(0.1, cropData.startCropH - dy);
                newY = cropData.startCropY + (cropData.startCropH - newH);
            } else {
                newH = (newW * cropData.imageWidth) / (targetAspect * cropData.imageHeight);
                newY = cropData.startCropY + (cropData.startCropH - newH);
            }
        } else if (handle === 'nw') {
            newW = Math.max(0.1, cropData.startCropW - dx);
            newX = cropData.startCropX + (cropData.startCropW - newW);
            if (targetAspect === null) {
                newH = Math.max(0.1, cropData.startCropH - dy);
                newY = cropData.startCropY + (cropData.startCropH - newH);
            } else {
                newH = (newW * cropData.imageWidth) / (targetAspect * cropData.imageHeight);
                newY = cropData.startCropY + (cropData.startCropH - newH);
            }
        }
        
        // Enforce aspect ratio (unless freeform)
        if (targetAspect !== null) {
            newH = (newW * cropData.imageWidth) / (targetAspect * cropData.imageHeight);
        }
        
        // Apply constraints
        if (newX >= 0 && newX + newW <= 1 && newY >= 0 && newY + newH <= 1) {
            cropData.x = newX;
            cropData.y = newY;
            cropData.width = newW;
            cropData.height = newH;
        }
    }
    
    updateCropBox();
    updateCropPreview();
}

function handleCropEnd(e) {
    if (cropData.isDragging || cropData.isResizing) {
        thumbnailCropModified = true;
    }
    cropData.isDragging = false;
    cropData.isResizing = false;
    cropData.activeHandle = null;
}

// Crop event listeners
cropBox.addEventListener('mousedown', handleCropStart);
cropBox.addEventListener('touchstart', handleCropStart, { passive: false });

document.addEventListener('mousemove', handleCropMove);
document.addEventListener('touchmove', handleCropMove, { passive: false });

document.addEventListener('mouseup', handleCropEnd);
document.addEventListener('touchend', handleCropEnd);

// Handle corner resize
cropWrapper.querySelectorAll('.crop-handle').forEach(handle => {
    handle.addEventListener('mousedown', handleCropStart);
    handle.addEventListener('touchstart', handleCropStart, { passive: false });
});

// Remove thumbnail flag (cleared when opening edit or clicking Reset)
let removeThumbnailFlag = false;

// Reset crop button
resetCropBtn.addEventListener('click', () => {
    removeThumbnailFlag = false;
    thumbnailCropModified = true;
    resetCropToDefault();
    updateCropBox();
    updateCropPreview();
    if (removeThumbnailBtn) removeThumbnailBtn.classList.remove('active');
});

// Remove thumbnail button
if (removeThumbnailBtn) {
    removeThumbnailBtn.addEventListener('click', () => {
        removeThumbnailFlag = true;
        removeThumbnailBtn.classList.add('active');
    });
}

// Crop aspect ratio buttons
cropAspectOptions.querySelectorAll('.crop-aspect-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        // Update active state
        cropAspectOptions.querySelectorAll('.crop-aspect-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Update aspect mode
        cropAspectMode = btn.dataset.aspect;
        thumbnailCropModified = true;
        
        // Update hint text
        updateCropHint();
        
        // Reset crop to fit new aspect ratio
        resetCropToDefault();
        updateCropBox();
        updateCropPreview();
    });
});

function updateCropHint() {
    if (cropAspectMode === 'free') {
        cropHint.textContent = 'Drag to position. Freeform crop.';
    } else if (cropAspectMode === 'original') {
        cropHint.textContent = 'Drag to position. Original aspect ratio.';
    } else {
        cropHint.textContent = `Drag to position. Maintains ${cropAspectMode} ratio.`;
    }
}

// Update crop box on window resize
window.addEventListener('resize', () => {
    if (cropSection.style.display !== 'none') {
        updateCropBox();
    }
});

// ========== Dark Mode Image Functions ==========

let removeDarkModeFlag = false;

darkModeInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        darkModeFileText.textContent = file.name;
        removeDarkModeFlag = false;
        
        // Show preview
        const reader = new FileReader();
        reader.onload = (ev) => {
            darkModeImage.src = ev.target.result;
            darkModePreview.style.display = 'block';
        };
        reader.readAsDataURL(file);
    } else {
        darkModeFileText.textContent = 'Choose dark mode image';
    }
});

removeDarkModeBtn.addEventListener('click', () => {
    removeDarkModeFlag = true;
    darkModeInput.value = '';
    darkModeFileText.textContent = 'Choose dark mode image';
    darkModePreview.style.display = 'none';
    darkModeImage.src = '';
});

// ========== Location Picker Functions ==========

// Format location from Nominatim result with address details
// Returns: { name: "formatted display", city, state, country, placeName, lat, lng }
function formatLocationFromNominatim(result) {
    const addr = result.address || {};
    
    // Get the place name (specific location like beach, park, etc.)
    const placeName = addr.tourism || addr.amenity || addr.leisure || addr.natural || 
                      addr.historic || addr.building || addr.shop || result.name || '';
    
    // Get city (Nominatim uses various fields for city-level)
    const city = addr.city || addr.town || addr.village || addr.municipality || 
                 addr.county || addr.district || '';
    
    // Get state/region
    const state = addr.state || addr.region || addr.province || '';
    
    // Get country
    const country = addr.country || '';
    
    // Build formatted name: "Place Name, City, State, Country"
    const parts = [];
    if (placeName && placeName !== city && placeName !== state && placeName !== country) {
        parts.push(placeName);
    }
    if (city) parts.push(city);
    if (state && state !== city) parts.push(state);
    if (country) parts.push(country);
    
    const formattedName = parts.join(', ') || result.display_name;
    
    return {
        name: formattedName,
        placeName: placeName || null,
        city: city || null,
        state: state || null,
        country: country || null,
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon),
        fullName: result.display_name // Keep original for reference
    };
}

// Search for locations using OpenStreetMap Nominatim API
async function searchLocations(query) {
    if (!query || query.length < 2) {
        locationResults.style.display = 'none';
        return;
    }
    
    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`,
            {
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'PanascenicPhotoEditor/1.0'
                }
            }
        );
        
        if (!response.ok) throw new Error('Search failed');
        
        const results = await response.json();
        
        if (results.length === 0) {
            locationResults.innerHTML = '<div class="location-result-item no-results">No locations found</div>';
            locationResults.style.display = 'block';
            return;
        }
        
        // Format each result with structured address data
        const formattedResults = results.map(result => formatLocationFromNominatim(result));
        
        locationResults.innerHTML = formattedResults.map((loc, index) => `
            <div class="location-result-item" data-index="${index}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                    <circle cx="12" cy="10" r="3"></circle>
                </svg>
                <span>${loc.name}</span>
            </div>
        `).join('');
        locationResults.style.display = 'block';
        
        // Add click handlers to results
        locationResults.querySelectorAll('.location-result-item:not(.no-results)').forEach(item => {
            item.addEventListener('click', () => {
                const index = parseInt(item.dataset.index);
                selectLocation(formattedResults[index]);
            });
        });
    } catch (error) {
        console.error('Location search error:', error);
        locationResults.innerHTML = '<div class="location-result-item no-results">Search failed</div>';
        locationResults.style.display = 'block';
    }
}

// Select a location
function selectLocation(location) {
    currentLocation = location;
    selectedLocationName.textContent = location.name;
    selectedLocation.style.display = 'flex';
    locationSearch.value = '';
    locationResults.style.display = 'none';
}

// Clear selected location
function clearLocation() {
    currentLocation = null;
    selectedLocation.style.display = 'none';
    selectedLocationName.textContent = '';
}

// Location search input handler with debounce
locationSearch.addEventListener('input', (e) => {
    clearTimeout(locationSearchTimeout);
    locationSearchTimeout = setTimeout(() => {
        searchLocations(e.target.value.trim());
    }, 300);
});

// Hide results when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.location-picker')) {
        locationResults.style.display = 'none';
    }
});

// Clear location button
clearLocationBtn.addEventListener('click', clearLocation);

// ========== Frame Tool Functions ==========

function initFrameTool(imageSrc, existingFrame = null) {
    // Set preview image
    framePreviewImage.onload = () => {
        updateFramePreview();
    };
    framePreviewImage.src = imageSrc;
    
    // Load existing frame data or reset to defaults
    if (existingFrame && existingFrame.type && existingFrame.type !== 'none') {
        frameData.type = existingFrame.type;
        frameData.insetWidth = existingFrame.insetWidth || 10;
        frameData.color = existingFrame.color || '#FFFFFF';
    } else {
        frameData.type = 'none';
        frameData.insetWidth = 10;
        frameData.color = '#FFFFFF';
    }
    
    // Update UI to reflect current state
    updateFrameTypeUI();
    updateFrameColorUI();
    updateInsetSliderUI();
    updateFrameControlVisibility();
    updateFramePreview();
}

function updateFrameTypeUI() {
    frameTypeOptions.querySelectorAll('.frame-type-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.type === frameData.type);
    });
}

function updateFrameColorUI() {
    frameColorOptions.querySelectorAll('.frame-color-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.color === frameData.color);
    });
}

function updateInsetSliderUI() {
    insetWidthSlider.value = frameData.insetWidth;
    insetWidthValue.textContent = `${frameData.insetWidth}%`;
}

function updateFrameControlVisibility() {
    const hasFrame = frameData.type !== 'none';
    insetWidthGroup.style.display = hasFrame ? 'block' : 'none';
    frameColorGroup.style.display = hasFrame ? 'block' : 'none';
}

function updateFramePreview() {
    const img = framePreviewImage;
    const container = framePreview;
    
    if (!img.naturalWidth || !img.naturalHeight) return;
    
    // Reset styles
    img.style.maxWidth = '';
    img.style.maxHeight = '';
    
    if (frameData.type === 'none') {
        // No frame - show image normally
        container.style.padding = '0';
        container.style.backgroundColor = 'transparent';
    } else {
        // Calculate frame padding based on inset width (scaled for preview)
        const paddingPercent = frameData.insetWidth / 100;
        const basePadding = 20; // Base padding in pixels for preview
        const padding = Math.round(basePadding * paddingPercent * 2) + 4; // Minimum 4px padding
        
        // Apply frame styling - padding creates the visible frame border
        container.style.padding = `${padding}px`;
        container.style.backgroundColor = frameData.color;
        
        // For aspect ratio frames, we may need asymmetric padding
        if (frameData.type !== 'even') {
            const [w, h] = frameData.type.split(':').map(Number);
            const targetRatio = w / h;
            const imgRatio = img.naturalWidth / img.naturalHeight;
            
            // Calculate how much extra padding is needed on which axis
            if (imgRatio > targetRatio) {
                // Image is wider than target - add vertical padding
                const extraVertical = Math.round(padding * (imgRatio / targetRatio - 1) * 0.5);
                container.style.padding = `${padding + extraVertical}px ${padding}px`;
            } else if (imgRatio < targetRatio) {
                // Image is taller than target - add horizontal padding
                const extraHorizontal = Math.round(padding * (targetRatio / imgRatio - 1) * 0.5);
                container.style.padding = `${padding}px ${padding + extraHorizontal}px`;
            }
        }
    }
}

// Frame type button handlers
frameTypeOptions.addEventListener('click', (e) => {
    const btn = e.target.closest('.frame-type-btn');
    if (!btn) return;
    
    frameData.type = btn.dataset.type;
    updateFrameTypeUI();
    updateFrameControlVisibility();
    updateFramePreview();
});

// Inset width slider handler
insetWidthSlider.addEventListener('input', (e) => {
    frameData.insetWidth = parseInt(e.target.value);
    insetWidthValue.textContent = `${frameData.insetWidth}%`;
    updateFramePreview();
});

// Frame color button handlers
frameColorOptions.addEventListener('click', (e) => {
    const btn = e.target.closest('.frame-color-btn');
    if (!btn) return;
    
    frameData.color = btn.dataset.color;
    updateFrameColorUI();
    updateFramePreview();
});

function resetFrameData() {
    frameData.type = 'none';
    frameData.insetWidth = 10;
    frameData.color = '#FFFFFF';
}

// Make functions available globally for onclick handlers
window.editPost = editPost;
window.togglePostSelection = togglePostSelection;

// Check server health on load
fetch('/api/health')
    .then(res => res.json())
    .then(data => {
        if (data.status === 'ok') {
            console.log('Server is running');
        }
    })
    .catch(err => {
        console.warn('Could not connect to server:', err);
        showMessage('Warning: Could not connect to server. Make sure the editor server is running.', 'error');
    });

// ========== Albums Functionality ==========

// Album elements
const mainTabs = document.getElementById('mainTabs');
const photosTab = document.getElementById('photosTab');
const albumsTab = document.getElementById('albumsTab');
const siteTab = document.getElementById('siteTab');
const albumEditView = document.getElementById('albumEditView');
const albumsList = document.getElementById('albumsList');
const createAlbumBtn = document.getElementById('createAlbumBtn');
const refreshAlbumsBtn = document.getElementById('refreshAlbumsBtn');
const backToAlbumsBtn = document.getElementById('backToAlbumsBtn');
const albumForm = document.getElementById('albumForm');
const albumNameInput = document.getElementById('albumNameInput');
const albumDescInput = document.getElementById('albumDescInput');
const albumFormTitle = document.getElementById('albumFormTitle');
const albumSubmitBtn = document.getElementById('albumSubmitBtn');
const albumSubmitBtnText = document.getElementById('albumSubmitBtnText');
const deleteAlbumBtn = document.getElementById('deleteAlbumBtn');
const albumFormMessage = document.getElementById('albumFormMessage');
const albumPhotosSection = document.getElementById('albumPhotosSection');
const albumPhotosGrid = document.getElementById('albumPhotosGrid');
const albumPhotoCount = document.getElementById('albumPhotoCount');
const addPhotosToAlbumBtn = document.getElementById('addPhotosToAlbumBtn');
const addToAlbumBtn = document.getElementById('addToAlbumBtn');
const layoutOptions = document.getElementById('layoutOptions');

// Photo selection modal elements
const photoSelectModal = document.getElementById('photoSelectModal');
const modalPhotosList = document.getElementById('modalPhotosList');
const closePhotoSelectBtn = document.getElementById('closePhotoSelectBtn');
const cancelPhotoSelectBtn = document.getElementById('cancelPhotoSelectBtn');
const confirmPhotoSelectBtn = document.getElementById('confirmPhotoSelectBtn');
const modalSelectedCount = document.getElementById('modalSelectedCount');

// Album selection modal elements
const albumSelectModal = document.getElementById('albumSelectModal');
const albumSelectList = document.getElementById('albumSelectList');
const closeAlbumSelectBtn = document.getElementById('closeAlbumSelectBtn');
const cancelAlbumSelectBtn = document.getElementById('cancelAlbumSelectBtn');

// Site tab & Favicon modal elements
const faviconPreview = document.getElementById('faviconPreview');
const faviconPreviewImg = document.getElementById('faviconPreviewImg');
const changeFaviconBtn = document.getElementById('changeFaviconBtn');
const changeFaviconBtnText = document.getElementById('changeFaviconBtnText');
const faviconModal = document.getElementById('faviconModal');
const faviconModalTitle = document.getElementById('faviconModalTitle');
const closeFaviconModalBtn = document.getElementById('closeFaviconModalBtn');
const faviconStepPick = document.getElementById('faviconStepPick');
const faviconStepCrop = document.getElementById('faviconStepCrop');
const faviconPickGrid = document.getElementById('faviconPickGrid');
const faviconCropWrapper = document.getElementById('faviconCropWrapper');
const faviconCropImage = document.getElementById('faviconCropImage');
const faviconCropOverlay = document.getElementById('faviconCropOverlay');
const faviconCropBox = document.getElementById('faviconCropBox');
const faviconCirclePreview = document.getElementById('faviconCirclePreview');
const faviconBackBtn = document.getElementById('faviconBackBtn');
const faviconNextBtn = document.getElementById('faviconNextBtn');
const faviconSaveBtn = document.getElementById('faviconSaveBtn');
const faviconCancelBtn = document.getElementById('faviconCancelBtn');

// Thumbnail settings elements
const thumbnailSection = document.getElementById('thumbnailSection');
const thumbnailPreview = document.getElementById('thumbnailPreview');
const thumbnailPhotoOptions = document.getElementById('thumbnailPhotoOptions');
const stackedPreviewInput = document.getElementById('stackedPreviewInput');

// Album state
let currentEditingAlbumId = null;
let isAlbumEditMode = false;
let currentAlbumPhotoSlugs = [];
let currentAlbumLayout = 'horizontal';
let currentThumbnailSlug = null;
let currentStackedPreview = true;
let currentBgColor = '';
let currentBgColorDark = '';
let modalSelectedPhotos = new Set();
let allPosts = [];

// Background color elements
const bgColorOptions = document.getElementById('bgColorOptions');
const bgColorDarkOptions = document.getElementById('bgColorDarkOptions');
const bgColorDarkRow = document.getElementById('bgColorDarkRow');

// Layout option click handler
if (layoutOptions) {
    layoutOptions.addEventListener('click', (e) => {
        const option = e.target.closest('.layout-option');
        if (!option) return;
        
        const layout = option.dataset.layout;
        currentAlbumLayout = layout;
        
        // Update UI
        layoutOptions.querySelectorAll('.layout-option').forEach(opt => {
            opt.classList.toggle('active', opt.dataset.layout === layout);
        });
    });
}

// Background color option handlers
if (bgColorOptions) {
    bgColorOptions.addEventListener('click', (e) => {
        const btn = e.target.closest('.bg-color-btn');
        if (!btn) return;
        
        currentBgColor = btn.dataset.color;
        
        // Update UI
        bgColorOptions.querySelectorAll('.bg-color-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.color === currentBgColor);
        });
        
        // Show/hide dark mode color row
        if (bgColorDarkRow) {
            bgColorDarkRow.style.display = currentBgColor ? 'flex' : 'none';
        }
    });
}

if (bgColorDarkOptions) {
    bgColorDarkOptions.addEventListener('click', (e) => {
        const btn = e.target.closest('.bg-color-btn');
        if (!btn) return;
        
        currentBgColorDark = btn.dataset.color;
        
        // Update UI
        bgColorDarkOptions.querySelectorAll('.bg-color-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.color === currentBgColorDark);
        });
    });
}

// Tab switching
mainTabs.addEventListener('click', (e) => {
    const tabBtn = e.target.closest('.tab-btn');
    if (!tabBtn) return;
    
    const tabName = tabBtn.dataset.tab;
    
    // Update tab buttons
    mainTabs.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    tabBtn.classList.add('active');
    
    // Update tab content
    if (tabName === 'photos') {
        photosTab.classList.add('active');
        albumsTab.classList.remove('active');
        if (siteTab) siteTab.classList.remove('active');
        albumEditView.style.display = 'none';
        showManagementView();
    } else if (tabName === 'albums') {
        photosTab.classList.remove('active');
        albumsTab.classList.add('active');
        if (siteTab) siteTab.classList.remove('active');
        albumEditView.style.display = 'none';
        loadAlbums();
    } else if (tabName === 'site' && siteTab) {
        photosTab.classList.remove('active');
        albumsTab.classList.remove('active');
        siteTab.classList.add('active');
        albumEditView.style.display = 'none';
        loadSiteTab();
    }
});

// ========== Site Tab & Favicon ==========

async function loadSiteTab() {
    if (!faviconPreview || !faviconPreviewImg || !changeFaviconBtn || !changeFaviconBtnText) return;
    try {
        const response = await fetch('/api/config');
        const data = await response.json();
        const faviconPath = data.favicon ? `/${data.favicon}` : null;
        if (faviconPath) {
            faviconPreviewImg.src = faviconPath + '?t=' + Date.now();
            faviconPreview.style.display = 'block';
            changeFaviconBtnText.textContent = 'Change Favicon';
        } else {
            faviconPreview.style.display = 'none';
            changeFaviconBtnText.textContent = 'Set Favicon';
        }
    } catch (e) {
        faviconPreview.style.display = 'none';
        changeFaviconBtnText.textContent = 'Set Favicon';
    }
}

let faviconSelectedSlug = null;
let faviconSelectedImage = null;
let faviconCropData = { x: 0.25, y: 0.25, size: 0.5 };
let faviconCropImageWidth = 1;
let faviconCropImageHeight = 1;
let faviconCropDragging = false;
let faviconCropStartX = 0;
let faviconCropStartY = 0;

function openFaviconModal() {
    faviconSelectedSlug = null;
    faviconSelectedImage = null;
    faviconStepPick.style.display = 'block';
    faviconStepCrop.style.display = 'none';
    faviconModalTitle.textContent = 'Choose Photo';
    faviconBackBtn.style.display = 'none';
    faviconNextBtn.style.display = 'none';
    faviconSaveBtn.style.display = 'none';
    faviconCancelBtn.style.display = 'inline-flex';
    if (allPosts.length === 0) {
        fetch('/api/posts').then(r => r.json()).then(data => {
            allPosts = data.posts || [];
            renderFaviconPickGrid();
        });
    } else {
        renderFaviconPickGrid();
    }
    faviconModal.style.display = 'flex';
}

function renderFaviconPickGrid() {
    if (!faviconPickGrid) return;
    faviconPickGrid.innerHTML = (allPosts || [])
        .filter(p => p.image)
        .map(post => `
            <div class="modal-photo-item ${faviconSelectedSlug === post.slug ? 'selected' : ''}" data-slug="${post.slug}" data-image="${escapeHtml(post.image)}">
                <img src="${post.image}" alt="">
            </div>
        `).join('');
    faviconPickGrid.querySelectorAll('.modal-photo-item').forEach(el => {
        el.addEventListener('click', () => {
            faviconSelectedSlug = el.dataset.slug;
            faviconSelectedImage = el.dataset.image;
            faviconPickGrid.querySelectorAll('.modal-photo-item').forEach(i => i.classList.remove('selected'));
            el.classList.add('selected');
            faviconNextBtn.style.display = 'inline-flex';
        });
    });
}

function showFaviconCropStep() {
    if (!faviconSelectedSlug || !faviconSelectedImage) return;
    faviconStepPick.style.display = 'none';
    faviconStepCrop.style.display = 'block';
    faviconModalTitle.textContent = 'Crop to Circle';
    faviconBackBtn.style.display = 'inline-flex';
    faviconNextBtn.style.display = 'none';
    faviconSaveBtn.style.display = 'inline-flex';
    faviconCropImage.onload = () => {
        faviconCropImageWidth = faviconCropImage.naturalWidth;
        faviconCropImageHeight = faviconCropImage.naturalHeight;
        const imgAspect = faviconCropImageWidth / faviconCropImageHeight;
        const size = Math.min(1, 1 / imgAspect, imgAspect);
        faviconCropData.size = size;
        faviconCropData.x = (1 - size) / 2;
        faviconCropData.y = (1 - size) / 2;
        updateFaviconCropBox();
        updateFaviconCirclePreview();
    };
    faviconCropImage.src = faviconSelectedImage;
}

function updateFaviconCropBox() {
    if (!faviconCropWrapper || !faviconCropBox) return;
    const imgRect = faviconCropImage.getBoundingClientRect();
    const wrapperRect = faviconCropWrapper.getBoundingClientRect();
    const x = faviconCropData.x * imgRect.width;
    const y = faviconCropData.y * imgRect.height;
    const s = Math.min(faviconCropData.size * imgRect.width, faviconCropData.size * imgRect.height);
    faviconCropBox.style.left = (imgRect.left - wrapperRect.left + x) + 'px';
    faviconCropBox.style.top = (imgRect.top - wrapperRect.top + y) + 'px';
    faviconCropBox.style.width = s + 'px';
    faviconCropBox.style.height = s + 'px';
}

function updateFaviconCirclePreview() {
    const ctx = faviconCirclePreview.getContext('2d');
    const d = 64;
    const sx = faviconCropData.x * faviconCropImageWidth;
    const sy = faviconCropData.y * faviconCropImageHeight;
    const sw = faviconCropData.size * faviconCropImageWidth;
    const sh = faviconCropData.size * faviconCropImageHeight;
    ctx.clearRect(0, 0, d, d);
    ctx.save();
    ctx.beginPath();
    ctx.arc(d / 2, d / 2, d / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(faviconCropImage, sx, sy, sw, sh, 0, 0, d, d);
    ctx.restore();
}

function constrainFaviconCrop() {
    const s = faviconCropData.size;
    faviconCropData.x = Math.max(0, Math.min(faviconCropData.x, 1 - s));
    faviconCropData.y = Math.max(0, Math.min(faviconCropData.y, 1 - s));
}

function faviconCropPointerDown(e) {
    e.preventDefault();
    faviconCropDragging = true;
    faviconCropStartX = (e.touches ? e.touches[0].clientX : e.clientX);
    faviconCropStartY = (e.touches ? e.touches[0].clientY : e.clientY);
}

function faviconCropPointerMove(e) {
    if (!faviconCropDragging) return;
    e.preventDefault();
    const x = (e.touches ? e.touches[0].clientX : e.clientX);
    const y = (e.touches ? e.touches[0].clientY : e.clientY);
    const imgRect = faviconCropImage.getBoundingClientRect();
    const dx = (x - faviconCropStartX) / imgRect.width;
    const dy = (y - faviconCropStartY) / imgRect.height;
    faviconCropStartX = x;
    faviconCropStartY = y;
    faviconCropData.x += dx;
    faviconCropData.y += dy;
    constrainFaviconCrop();
    updateFaviconCropBox();
    updateFaviconCirclePreview();
}

function faviconCropPointerUp() {
    faviconCropDragging = false;
}

async function saveFavicon() {
    if (!faviconSelectedSlug) return;
    faviconSaveBtn.disabled = true;
    try {
        const crop = {
            x: faviconCropData.x,
            y: faviconCropData.y,
            width: faviconCropData.size,
            height: faviconCropData.size
        };
        const response = await fetch('/api/favicon', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slug: faviconSelectedSlug, crop })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to save favicon');
        showMessage('Favicon updated.', 'success');
        closeFaviconModal();
        loadSiteTab();
    } catch (err) {
        showMessage(err.message || 'Failed to save favicon', 'error');
    } finally {
        faviconSaveBtn.disabled = false;
    }
}

function closeFaviconModal() {
    faviconModal.style.display = 'none';
    faviconSelectedSlug = null;
    faviconSelectedImage = null;
}

if (changeFaviconBtn) {
    changeFaviconBtn.addEventListener('click', openFaviconModal);
}
if (closeFaviconModalBtn) closeFaviconModalBtn.addEventListener('click', closeFaviconModal);
if (faviconCancelBtn) faviconCancelBtn.addEventListener('click', closeFaviconModal);
if (faviconBackBtn) {
    faviconBackBtn.addEventListener('click', () => {
        faviconStepPick.style.display = 'block';
        faviconStepCrop.style.display = 'none';
        faviconModalTitle.textContent = 'Choose Photo';
        faviconBackBtn.style.display = 'none';
        faviconNextBtn.style.display = 'inline-flex';
        faviconSaveBtn.style.display = 'none';
    });
}
if (faviconNextBtn) faviconNextBtn.addEventListener('click', showFaviconCropStep);
if (faviconSaveBtn) faviconSaveBtn.addEventListener('click', saveFavicon);

if (faviconCropBox) {
    faviconCropBox.addEventListener('mousedown', faviconCropPointerDown);
    faviconCropBox.addEventListener('touchstart', faviconCropPointerDown, { passive: false });
}
document.addEventListener('mousemove', faviconCropPointerMove);
document.addEventListener('touchmove', faviconCropPointerMove, { passive: false });
document.addEventListener('mouseup', faviconCropPointerUp);
document.addEventListener('touchend', faviconCropPointerUp);

// Load albums
async function loadAlbums() {
    try {
        albumsList.innerHTML = '<div class="loading">Loading albums...</div>';
        
        const response = await fetch('/api/albums');
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to load albums');
        }
        
        // Also fetch posts for preview images
        const postsResponse = await fetch('/api/posts');
        const postsData = await postsResponse.json();
        allPosts = postsData.posts || [];
        
        if (data.albums.length === 0) {
            albumsList.innerHTML = '<div class="empty-state">No albums yet. Click "Create Album" to get started!</div>';
            return;
        }
        
        renderAlbums(data.albums);
        
    } catch (error) {
        console.error('Error loading albums:', error);
        albumsList.innerHTML = `<div class="error-state">Error loading albums: ${error.message}</div>`;
    }
}

// Render albums
function renderAlbums(albums) {
    // Create a map of posts for quick lookup
    const postsMap = {};
    allPosts.forEach(post => {
        postsMap[post.slug] = post;
    });
    
    albumsList.innerHTML = albums.map((album, index) => {
        const photoCount = album.photoSlugs ? album.photoSlugs.length : 0;
        
        // Get preview images (up to 4)
        const previewImages = [];
        if (album.photoSlugs) {
            for (let i = 0; i < Math.min(4, album.photoSlugs.length); i++) {
                const post = postsMap[album.photoSlugs[i]];
                if (post && post.image) {
                    previewImages.push(post.image);
                }
            }
        }
        
        let previewHtml = '';
        if (previewImages.length > 0) {
            previewHtml = previewImages.map(img => `<img src="${img}" alt="">`).join('');
        } else {
            previewHtml = `
                <div class="album-card-preview-empty">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        <circle cx="8.5" cy="8.5" r="1.5"></circle>
                        <polyline points="21 15 16 10 5 21"></polyline>
                    </svg>
                </div>
            `;
        }
        
        return `
            <div class="album-card-editor" data-album-id="${album.id}" data-index="${index}" draggable="true">
                <div class="album-drag-handle" title="Drag to reorder">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="9" cy="6" r="1.5"></circle>
                        <circle cx="15" cy="6" r="1.5"></circle>
                        <circle cx="9" cy="12" r="1.5"></circle>
                        <circle cx="15" cy="12" r="1.5"></circle>
                        <circle cx="9" cy="18" r="1.5"></circle>
                        <circle cx="15" cy="18" r="1.5"></circle>
                    </svg>
                </div>
                <div class="album-card-clickable" onclick="editAlbum('${album.id}')">
                    <div class="album-card-preview">
                        ${previewHtml}
                    </div>
                    <div class="album-card-info">
                        <h3 class="album-card-name">${escapeHtml(album.name)}</h3>
                        ${album.description ? `<p class="album-card-desc">${escapeHtml(album.description)}</p>` : ''}
                        <div class="album-card-meta">${photoCount} photo${photoCount !== 1 ? 's' : ''}</div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    // Initialize album drag-and-drop
    initAlbumCardDragDrop();
}

// Create album button
createAlbumBtn.addEventListener('click', () => {
    showAlbumForm();
});

refreshAlbumsBtn.addEventListener('click', () => {
    loadAlbums();
});

backToAlbumsBtn.addEventListener('click', () => {
    showAlbumsView();
});

// Show album form for creating new album
function showAlbumForm() {
    isAlbumEditMode = false;
    currentEditingAlbumId = null;
    currentAlbumPhotoSlugs = [];
    currentAlbumLayout = 'horizontal';
    currentThumbnailSlug = null;
    currentStackedPreview = true;
    currentBgColor = '';
    currentBgColorDark = '';
    
    albumFormTitle.textContent = 'Create Album';
    albumSubmitBtnText.textContent = 'Create Album';
    deleteAlbumBtn.style.display = 'none';
    albumPhotosSection.style.display = 'none';
    thumbnailSection.style.display = 'none';
    
    albumForm.reset();
    albumFormMessage.style.display = 'none';
    
    // Reset layout selection
    if (layoutOptions) {
        layoutOptions.querySelectorAll('.layout-option').forEach(opt => {
            opt.classList.toggle('active', opt.dataset.layout === 'horizontal');
        });
    }
    
    // Reset thumbnail settings
    if (stackedPreviewInput) {
        stackedPreviewInput.checked = true;
    }
    
    // Reset background color options
    if (bgColorOptions) {
        bgColorOptions.querySelectorAll('.bg-color-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.color === '');
        });
    }
    if (bgColorDarkOptions) {
        bgColorDarkOptions.querySelectorAll('.bg-color-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.color === '');
        });
    }
    if (bgColorDarkRow) {
        bgColorDarkRow.style.display = 'none';
    }
    
    albumsTab.classList.remove('active');
    albumEditView.style.display = 'block';
}

// Edit existing album
async function editAlbum(albumId) {
    try {
        isAlbumEditMode = true;
        currentEditingAlbumId = albumId;
        
        albumFormTitle.textContent = 'Edit Album';
        albumSubmitBtnText.textContent = 'Update Album';
        deleteAlbumBtn.style.display = 'block';
        albumFormMessage.style.display = 'none';
        
        // Load album data
        const response = await fetch(`/api/albums/${albumId}`);
        const album = await response.json();
        
        if (!response.ok) {
            throw new Error(album.error || 'Failed to load album');
        }
        
        // Populate form
        albumNameInput.value = album.name || '';
        albumDescInput.value = album.description || '';
        currentAlbumPhotoSlugs = album.photoSlugs || [];
        currentAlbumLayout = album.layout || 'horizontal';
        currentThumbnailSlug = album.thumbnailSlug || null;
        currentStackedPreview = album.stackedPreview !== false; // Default to true
        currentBgColor = album.bgColor || '';
        currentBgColorDark = album.bgColorDark || '';
        
        // Update layout selection UI
        if (layoutOptions) {
            layoutOptions.querySelectorAll('.layout-option').forEach(opt => {
                opt.classList.toggle('active', opt.dataset.layout === currentAlbumLayout);
            });
        }
        
        // Update stacked preview checkbox
        if (stackedPreviewInput) {
            stackedPreviewInput.checked = currentStackedPreview;
        }
        
        // Update background color UI
        if (bgColorOptions) {
            bgColorOptions.querySelectorAll('.bg-color-btn').forEach(b => {
                b.classList.toggle('active', b.dataset.color === currentBgColor);
            });
        }
        if (bgColorDarkOptions) {
            bgColorDarkOptions.querySelectorAll('.bg-color-btn').forEach(b => {
                b.classList.toggle('active', b.dataset.color === currentBgColorDark);
            });
        }
        if (bgColorDarkRow) {
            bgColorDarkRow.style.display = currentBgColor ? 'flex' : 'none';
        }
        
        // Show photos section and thumbnail settings
        albumPhotosSection.style.display = 'block';
        thumbnailSection.style.display = currentAlbumPhotoSlugs.length > 0 ? 'block' : 'none';
        renderAlbumPhotos();
        renderThumbnailOptions();
        
        albumsTab.classList.remove('active');
        albumEditView.style.display = 'block';
        
    } catch (error) {
        console.error('Error loading album:', error);
        showAlbumFormMessage(`Error loading album: ${error.message}`, 'error');
    }
}

// Render photos in album edit form
function renderAlbumPhotos() {
    const postsMap = {};
    allPosts.forEach(post => {
        postsMap[post.slug] = post;
    });
    
    albumPhotoCount.textContent = currentAlbumPhotoSlugs.length;
    
    if (currentAlbumPhotoSlugs.length === 0) {
        albumPhotosGrid.innerHTML = '<div class="empty-state" style="padding: 1rem;">No photos in this album yet.</div>';
        return;
    }
    
    albumPhotosGrid.innerHTML = currentAlbumPhotoSlugs.map((slug, index) => {
        const post = postsMap[slug];
        if (!post || !post.image) return '';
        
        return `
            <div class="album-photo-item" data-slug="${slug}" data-index="${index}" draggable="true">
                <div class="album-photo-drag-handle" title="Drag to reorder">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="9" cy="5" r="1"></circle>
                        <circle cx="9" cy="12" r="1"></circle>
                        <circle cx="9" cy="19" r="1"></circle>
                        <circle cx="15" cy="5" r="1"></circle>
                        <circle cx="15" cy="12" r="1"></circle>
                        <circle cx="15" cy="19" r="1"></circle>
                    </svg>
                </div>
                <img src="${post.image}" alt="${escapeHtml(post.title || 'Photo')}">
                <button type="button" class="album-photo-remove" onclick="removePhotoFromAlbum('${slug}')" title="Remove from album">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
                <div class="album-photo-order">${index + 1}</div>
            </div>
        `;
    }).filter(html => html).join('');
    
    // Add drag-and-drop event listeners
    initAlbumPhotoDragDrop();
    
    // Update thumbnail section visibility and options
    if (thumbnailSection) {
        thumbnailSection.style.display = currentAlbumPhotoSlugs.length > 0 ? 'block' : 'none';
        if (currentAlbumPhotoSlugs.length > 0) {
            renderThumbnailOptions();
        }
    }
}

// Drag and drop for album photo reordering
let draggedPhotoItem = null;
let draggedPhotoIndex = null;

function initAlbumPhotoDragDrop() {
    const items = albumPhotosGrid.querySelectorAll('.album-photo-item');
    
    items.forEach(item => {
        item.addEventListener('dragstart', handleAlbumPhotoDragStart);
        item.addEventListener('dragend', handleAlbumPhotoDragEnd);
        item.addEventListener('dragover', handleAlbumPhotoDragOver);
        item.addEventListener('dragenter', handleAlbumPhotoDragEnter);
        item.addEventListener('dragleave', handleAlbumPhotoDragLeave);
        item.addEventListener('drop', handleAlbumPhotoDrop);
    });
}

function handleAlbumPhotoDragStart(e) {
    draggedPhotoItem = this;
    draggedPhotoIndex = parseInt(this.dataset.index);
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', this.dataset.slug);
}

function handleAlbumPhotoDragEnd(e) {
    this.classList.remove('dragging');
    draggedPhotoItem = null;
    draggedPhotoIndex = null;
    
    // Remove all drag-over classes
    albumPhotosGrid.querySelectorAll('.album-photo-item').forEach(item => {
        item.classList.remove('drag-over', 'drag-over-left', 'drag-over-right');
    });
}

function handleAlbumPhotoDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

function handleAlbumPhotoDragEnter(e) {
    e.preventDefault();
    if (this !== draggedPhotoItem) {
        const thisIndex = parseInt(this.dataset.index);
        // Show indicator on which side the item will be inserted
        if (thisIndex < draggedPhotoIndex) {
            this.classList.add('drag-over-left');
        } else {
            this.classList.add('drag-over-right');
        }
    }
}

function handleAlbumPhotoDragLeave(e) {
    this.classList.remove('drag-over', 'drag-over-left', 'drag-over-right');
}

function handleAlbumPhotoDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    
    if (this !== draggedPhotoItem) {
        const fromIndex = draggedPhotoIndex;
        const toIndex = parseInt(this.dataset.index);
        
        // Reorder the array
        const [movedSlug] = currentAlbumPhotoSlugs.splice(fromIndex, 1);
        currentAlbumPhotoSlugs.splice(toIndex, 0, movedSlug);
        
        // Re-render
        renderAlbumPhotos();
    }
    
    return false;
}

// Remove photo from album
function removePhotoFromAlbum(slug) {
    currentAlbumPhotoSlugs = currentAlbumPhotoSlugs.filter(s => s !== slug);
    
    // If removed photo was the thumbnail, reset thumbnail
    if (currentThumbnailSlug === slug) {
        currentThumbnailSlug = currentAlbumPhotoSlugs[0] || null;
    }
    
    renderAlbumPhotos();
    renderThumbnailOptions();
    
    // Hide thumbnail section if no photos left
    if (thumbnailSection) {
        thumbnailSection.style.display = currentAlbumPhotoSlugs.length > 0 ? 'block' : 'none';
    }
}

// Render thumbnail selection options
function renderThumbnailOptions() {
    if (!thumbnailPhotoOptions || !thumbnailPreview) return;
    
    const postsMap = {};
    allPosts.forEach(post => {
        postsMap[post.slug] = post;
    });
    
    // If no thumbnail selected, default to first photo
    if (!currentThumbnailSlug && currentAlbumPhotoSlugs.length > 0) {
        currentThumbnailSlug = currentAlbumPhotoSlugs[0];
    }
    
    // Update preview
    updateThumbnailPreview(postsMap);
    
    // Render photo options
    if (currentAlbumPhotoSlugs.length === 0) {
        thumbnailPhotoOptions.innerHTML = '<div class="empty-state" style="padding: 0.5rem; font-size: 12px;">Add photos to select a thumbnail</div>';
        return;
    }
    
    thumbnailPhotoOptions.innerHTML = currentAlbumPhotoSlugs.map(slug => {
        const post = postsMap[slug];
        if (!post || !post.image) return '';
        
        const isSelected = slug === currentThumbnailSlug;
        return `
            <div class="thumbnail-option ${isSelected ? 'selected' : ''}" 
                 data-slug="${slug}" 
                 onclick="selectThumbnail('${slug}')"
                 title="${escapeHtml(post.title || 'Photo')}">
                <img src="${post.image}" alt="${escapeHtml(post.title || 'Photo')}">
                ${isSelected ? '<div class="thumbnail-option-check"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg></div>' : ''}
            </div>
        `;
    }).filter(html => html).join('');
}

// Update thumbnail preview display
function updateThumbnailPreview(postsMap) {
    if (!thumbnailPreview) return;
    
    if (!currentThumbnailSlug) {
        thumbnailPreview.innerHTML = '<span class="thumbnail-preview-empty">Select a photo</span>';
        return;
    }
    
    const post = postsMap[currentThumbnailSlug];
    if (!post || !post.image) {
        thumbnailPreview.innerHTML = '<span class="thumbnail-preview-empty">Select a photo</span>';
        return;
    }
    
    if (currentStackedPreview && currentAlbumPhotoSlugs.length > 1) {
        // Show stacked preview - thumbnail on top with others behind
        const otherSlugs = currentAlbumPhotoSlugs.filter(s => s !== currentThumbnailSlug).slice(0, 3);
        let stackHtml = '';
        
        // Background photos
        otherSlugs.forEach((slug, i) => {
            const otherPost = postsMap[slug];
            if (otherPost && otherPost.image) {
                const rotation = (i % 2 === 0 ? -1 : 1) * (4 + i * 2);
                const translate = (i % 2 === 0 ? -1 : 1) * (3 + i * 2);
                stackHtml += `<img src="${otherPost.image}" class="thumbnail-preview-stacked" style="transform: rotate(${rotation}deg) translate(${translate}px, ${translate}px); z-index: ${i};">`;
            }
        });
        
        // Top photo (thumbnail)
        stackHtml += `<img src="${post.image}" class="thumbnail-preview-top" style="z-index: 10;">`;
        
        thumbnailPreview.innerHTML = stackHtml;
        thumbnailPreview.classList.add('stacked');
    } else {
        // Single photo preview
        thumbnailPreview.innerHTML = `<img src="${post.image}" class="thumbnail-preview-single">`;
        thumbnailPreview.classList.remove('stacked');
    }
}

// Select thumbnail photo
function selectThumbnail(slug) {
    currentThumbnailSlug = slug;
    renderThumbnailOptions();
}

// Stacked preview checkbox handler
if (stackedPreviewInput) {
    stackedPreviewInput.addEventListener('change', () => {
        currentStackedPreview = stackedPreviewInput.checked;
        
        const postsMap = {};
        allPosts.forEach(post => {
            postsMap[post.slug] = post;
        });
        updateThumbnailPreview(postsMap);
    });
}

// Make selectThumbnail available globally
window.selectThumbnail = selectThumbnail;

// Show albums view
function showAlbumsView() {
    albumEditView.style.display = 'none';
    albumsTab.classList.add('active');
    loadAlbums();
}

// ========== Album Card Drag & Drop Reordering ==========
let draggedAlbumCard = null;
let draggedAlbumIndex = null;
let albumDragStartedFromHandle = false;

function initAlbumCardDragDrop() {
    const cards = albumsList.querySelectorAll('.album-card-editor');
    
    cards.forEach(card => {
        // Only allow drag to start from the handle
        const handle = card.querySelector('.album-drag-handle');
        if (handle) {
            handle.addEventListener('mousedown', () => { albumDragStartedFromHandle = true; });
            handle.addEventListener('touchstart', () => { albumDragStartedFromHandle = true; }, { passive: true });
        }
        
        card.addEventListener('dragstart', handleAlbumCardDragStart);
        card.addEventListener('dragend', handleAlbumCardDragEnd);
        card.addEventListener('dragover', handleAlbumCardDragOver);
        card.addEventListener('dragenter', handleAlbumCardDragEnter);
        card.addEventListener('dragleave', handleAlbumCardDragLeave);
        card.addEventListener('drop', handleAlbumCardDrop);
    });
}

function handleAlbumCardDragStart(e) {
    if (!albumDragStartedFromHandle) {
        e.preventDefault();
        return;
    }
    draggedAlbumCard = this;
    draggedAlbumIndex = parseInt(this.dataset.index);
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', this.dataset.albumId);
    
    // Reset handle flag after a short delay
    setTimeout(() => { albumDragStartedFromHandle = false; }, 0);
}

function handleAlbumCardDragEnd(e) {
    this.classList.remove('dragging');
    draggedAlbumCard = null;
    draggedAlbumIndex = null;
    albumDragStartedFromHandle = false;
    
    // Remove all drag-over classes
    albumsList.querySelectorAll('.album-card-editor').forEach(card => {
        card.classList.remove('drag-over-above', 'drag-over-below');
    });
}

function handleAlbumCardDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

function handleAlbumCardDragEnter(e) {
    e.preventDefault();
    if (this !== draggedAlbumCard) {
        const thisIndex = parseInt(this.dataset.index);
        // Show indicator above or below depending on direction
        this.classList.remove('drag-over-above', 'drag-over-below');
        if (thisIndex < draggedAlbumIndex) {
            this.classList.add('drag-over-above');
        } else {
            this.classList.add('drag-over-below');
        }
    }
}

function handleAlbumCardDragLeave(e) {
    this.classList.remove('drag-over-above', 'drag-over-below');
}

function handleAlbumCardDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    
    if (this !== draggedAlbumCard && draggedAlbumIndex !== null) {
        const fromIndex = draggedAlbumIndex;
        const toIndex = parseInt(this.dataset.index);
        
        // Save the new order via API
        saveAlbumOrder(fromIndex, toIndex);
    }
    
    return false;
}

async function saveAlbumOrder(fromIndex, toIndex) {
    try {
        const response = await fetch('/api/albums/reorder', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fromIndex, toIndex })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to reorder albums');
        }
        
        // Reload albums to reflect new order
        loadAlbums();
        
        // Also refresh the album filter cache
        allAlbums = data.albums || allAlbums;
        
    } catch (error) {
        console.error('Error reordering albums:', error);
        // Reload to reset state on failure
        loadAlbums();
    }
}

// Album form submission
albumForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    albumFormMessage.style.display = 'none';
    
    const name = albumNameInput.value.trim();
    if (!name) {
        showAlbumFormMessage('Album name is required', 'error');
        return;
    }
    
    albumSubmitBtn.disabled = true;
    albumSubmitBtnText.style.display = 'none';
    albumSubmitBtn.querySelector('.btn-loader').style.display = 'block';
    
    try {
        const albumData = {
            name: name,
            description: albumDescInput.value.trim(),
            photoSlugs: currentAlbumPhotoSlugs,
            layout: currentAlbumLayout,
            thumbnailSlug: currentThumbnailSlug,
            stackedPreview: currentStackedPreview,
            bgColor: currentBgColor || null,
            bgColorDark: currentBgColorDark || null
        };
        
        let response;
        if (isAlbumEditMode) {
            response = await fetch(`/api/albums/${currentEditingAlbumId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(albumData)
            });
        } else {
            response = await fetch('/api/albums', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(albumData)
            });
        }
        
        const data = await response.json();
        
        if (response.ok) {
            showAlbumFormMessage(isAlbumEditMode ? 'Album updated!' : 'Album created!', 'success');
            setTimeout(() => showAlbumsView(), 1000);
        } else {
            showAlbumFormMessage(data.error || 'Failed to save album', 'error');
        }
    } catch (error) {
        console.error('Album form error:', error);
        showAlbumFormMessage('An error occurred. Please try again.', 'error');
    } finally {
        albumSubmitBtn.disabled = false;
        albumSubmitBtnText.style.display = 'block';
        albumSubmitBtn.querySelector('.btn-loader').style.display = 'none';
    }
});

// Delete album
deleteAlbumBtn.addEventListener('click', async () => {
    if (!confirm('Are you sure you want to delete this album? Photos will not be deleted.')) {
        return;
    }
    
    try {
        deleteAlbumBtn.disabled = true;
        
        const response = await fetch(`/api/albums/${currentEditingAlbumId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showAlbumFormMessage('Album deleted!', 'success');
            setTimeout(() => showAlbumsView(), 500);
        } else {
            showAlbumFormMessage(data.error || 'Failed to delete album', 'error');
            deleteAlbumBtn.disabled = false;
        }
    } catch (error) {
        console.error('Delete album error:', error);
        showAlbumFormMessage('An error occurred. Please try again.', 'error');
        deleteAlbumBtn.disabled = false;
    }
});

function showAlbumFormMessage(text, type) {
    albumFormMessage.textContent = text;
    albumFormMessage.className = `message ${type}`;
    albumFormMessage.style.display = 'block';
}

// ========== Photo Selection Modal ==========

// Open photo selection modal from album edit form
addPhotosToAlbumBtn.addEventListener('click', () => {
    openPhotoSelectModal('album');
});

// Open photo selection modal
async function openPhotoSelectModal(mode) {
    modalSelectedPhotos.clear();
    updateModalSelectedCount();
    
    // Load posts if not already loaded
    if (allPosts.length === 0) {
        const response = await fetch('/api/posts');
        const data = await response.json();
        allPosts = data.posts || [];
    }
    
    // Render photos
    const existingSlugs = new Set(currentAlbumPhotoSlugs);
    modalPhotosList.innerHTML = allPosts.map(post => {
        if (!post.image) return '';
        const isInAlbum = existingSlugs.has(post.slug);
        return `
            <div class="modal-photo-item ${isInAlbum ? 'selected' : ''}" data-slug="${post.slug}" onclick="toggleModalPhoto('${post.slug}')">
                <img src="${post.image}" alt="${escapeHtml(post.title || 'Photo')}">
            </div>
        `;
    }).filter(html => html).join('');
    
    photoSelectModal.style.display = 'flex';
}

// Toggle photo selection in modal
function toggleModalPhoto(slug) {
    const item = modalPhotosList.querySelector(`[data-slug="${slug}"]`);
    if (!item) return;
    
    if (modalSelectedPhotos.has(slug)) {
        modalSelectedPhotos.delete(slug);
        item.classList.remove('selected');
    } else {
        modalSelectedPhotos.add(slug);
        item.classList.add('selected');
    }
    
    updateModalSelectedCount();
}

function updateModalSelectedCount() {
    modalSelectedCount.textContent = modalSelectedPhotos.size;
}

// Close photo selection modal
function closePhotoSelectModal() {
    photoSelectModal.style.display = 'none';
    modalSelectedPhotos.clear();
}

closePhotoSelectBtn.addEventListener('click', closePhotoSelectModal);
cancelPhotoSelectBtn.addEventListener('click', closePhotoSelectModal);

// Confirm photo selection
confirmPhotoSelectBtn.addEventListener('click', () => {
    // Add selected photos to current album
    const newSlugs = Array.from(modalSelectedPhotos);
    currentAlbumPhotoSlugs = [...new Set([...currentAlbumPhotoSlugs, ...newSlugs])];
    renderAlbumPhotos();
    closePhotoSelectModal();
});

// ========== Add Photos to Album (from photos view) ==========

// Show "Add to Album" and "Bulk Edit" buttons when in select mode
function updateSelectedCount() {
    selectedCountSpan.textContent = selectedPosts.size;
    deleteSelectedBtn.disabled = selectedPosts.size === 0;
    
    // Show/hide Add to Album button
    if (addToAlbumBtn) {
        addToAlbumBtn.style.display = selectedPosts.size > 0 ? 'inline-flex' : 'none';
    }
    
    // Show/hide Bulk Edit button
    const bulkEditBtn = document.getElementById('bulkEditBtn');
    if (bulkEditBtn) {
        bulkEditBtn.style.display = selectedPosts.size > 0 ? 'inline-flex' : 'none';
    }
}

// Open album selection modal
addToAlbumBtn.addEventListener('click', async () => {
    if (selectedPosts.size === 0) return;
    
    // Load albums
    const response = await fetch('/api/albums');
    const data = await response.json();
    
    if (data.albums.length === 0) {
        albumSelectList.innerHTML = `
            <div class="album-select-empty">
                <p>No albums yet.</p>
                <button class="btn btn-primary btn-sm" onclick="closeAlbumSelectModal(); switchToAlbumsTab();">Create Album</button>
            </div>
        `;
    } else {
        albumSelectList.innerHTML = data.albums.map(album => `
            <div class="album-select-item" onclick="addSelectedPhotosToAlbum('${album.id}')">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="3" width="7" height="7"></rect>
                    <rect x="14" y="3" width="7" height="7"></rect>
                    <rect x="14" y="14" width="7" height="7"></rect>
                    <rect x="3" y="14" width="7" height="7"></rect>
                </svg>
                <div class="album-select-item-info">
                    <div class="album-select-item-name">${escapeHtml(album.name)}</div>
                    <div class="album-select-item-count">${album.photoSlugs ? album.photoSlugs.length : 0} photos</div>
                </div>
            </div>
        `).join('');
    }
    
    albumSelectModal.style.display = 'flex';
});

// Add selected photos to album
async function addSelectedPhotosToAlbum(albumId) {
    try {
        const photoSlugs = Array.from(selectedPosts);
        
        const response = await fetch(`/api/albums/${albumId}/photos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ photoSlugs })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showListMessage(`Added ${photoSlugs.length} photo${photoSlugs.length > 1 ? 's' : ''} to album!`, 'success');
            closeAlbumSelectModal();
            exitSelectMode();
        } else {
            showListMessage(data.error || 'Failed to add photos to album', 'error');
        }
    } catch (error) {
        console.error('Error adding photos to album:', error);
        showListMessage('An error occurred. Please try again.', 'error');
    }
}

// Close album selection modal
function closeAlbumSelectModal() {
    albumSelectModal.style.display = 'none';
}

closeAlbumSelectBtn.addEventListener('click', closeAlbumSelectModal);
cancelAlbumSelectBtn.addEventListener('click', closeAlbumSelectModal);

// Switch to albums tab
function switchToAlbumsTab() {
    const albumsTabBtn = mainTabs.querySelector('[data-tab="albums"]');
    if (albumsTabBtn) {
        albumsTabBtn.click();
    }
}

// Make functions globally available
window.editAlbum = editAlbum;
window.removePhotoFromAlbum = removePhotoFromAlbum;
window.toggleModalPhoto = toggleModalPhoto;
window.addSelectedPhotosToAlbum = addSelectedPhotosToAlbum;
window.closeAlbumSelectModal = closeAlbumSelectModal;
window.switchToAlbumsTab = switchToAlbumsTab;

// ========== Bulk Edit Functionality ==========

// Bulk edit elements
const bulkEditBtn = document.getElementById('bulkEditBtn');
const bulkEditModal = document.getElementById('bulkEditModal');
const closeBulkEditBtn = document.getElementById('closeBulkEditBtn');
const cancelBulkEditBtn = document.getElementById('cancelBulkEditBtn');
const applyBulkEditBtn = document.getElementById('applyBulkEditBtn');
const bulkEditCount = document.getElementById('bulkEditCount');
const bulkTitleInput = document.getElementById('bulkTitleInput');
const bulkDescriptionInput = document.getElementById('bulkDescriptionInput');
const bulkPhotoDateInput = document.getElementById('bulkPhotoDateInput');
const bulkCameraInput = document.getElementById('bulkCameraInput');
const bulkFrameTypeOptions = document.getElementById('bulkFrameTypeOptions');
const bulkInsetWidthGroup = document.getElementById('bulkInsetWidthGroup');
const bulkInsetWidthSlider = document.getElementById('bulkInsetWidthSlider');
const bulkInsetWidthValue = document.getElementById('bulkInsetWidthValue');
const bulkFrameColorGroup = document.getElementById('bulkFrameColorGroup');
const bulkFrameColorOptions = document.getElementById('bulkFrameColorOptions');
const bulkFramePreview = document.getElementById('bulkFramePreview');
const bulkFramePreviewImage = document.getElementById('bulkFramePreviewImage');

// Bulk frame state
let bulkFrameData = {
    type: '',          // '' means no change, 'none' removes frame
    insetWidth: 10,
    color: '#FFFFFF'
};

// Bulk location state
let bulkLocation = null; // { name, lat, lng }
let bulkLocationSearchTimeout = null;

// Bulk location elements
const bulkLocationSearch = document.getElementById('bulkLocationSearch');
const bulkLocationResults = document.getElementById('bulkLocationResults');
const bulkSelectedLocation = document.getElementById('bulkSelectedLocation');
const bulkSelectedLocationName = document.getElementById('bulkSelectedLocationName');
const clearBulkLocationBtn = document.getElementById('clearBulkLocationBtn');

// Reset bulk frame state
function resetBulkFrameData() {
    bulkFrameData = {
        type: '',
        insetWidth: 10,
        color: '#FFFFFF'
    };
    
    // Reset UI
    if (bulkFrameTypeOptions) {
        bulkFrameTypeOptions.querySelectorAll('.frame-type-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.type === '');
        });
    }
    if (bulkInsetWidthSlider) {
        bulkInsetWidthSlider.value = 10;
        bulkInsetWidthValue.textContent = '10%';
    }
    if (bulkFrameColorOptions) {
        bulkFrameColorOptions.querySelectorAll('.frame-color-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.color === '#FFFFFF');
        });
    }
    if (bulkInsetWidthGroup) bulkInsetWidthGroup.style.display = 'none';
    if (bulkFrameColorGroup) bulkFrameColorGroup.style.display = 'none';
    
    // Reset preview styling (no frame for "No Change" state)
    if (bulkFramePreview) {
        bulkFramePreview.style.padding = '0';
        bulkFramePreview.style.backgroundColor = 'transparent';
    }
}

// Reset bulk location state
function resetBulkLocation() {
    bulkLocation = null;
    if (bulkLocationSearch) bulkLocationSearch.value = '';
    if (bulkLocationResults) bulkLocationResults.style.display = 'none';
    if (bulkSelectedLocation) bulkSelectedLocation.style.display = 'none';
    if (bulkSelectedLocationName) bulkSelectedLocationName.textContent = '';
}

// Update bulk frame preview
function updateBulkFramePreview() {
    const img = bulkFramePreviewImage;
    const container = bulkFramePreview;
    
    if (!img || !container || !img.naturalWidth || !img.naturalHeight) return;
    
    // Reset styles
    img.style.maxWidth = '';
    img.style.maxHeight = '';
    
    // If no change selected or no frame, show image normally
    if (bulkFrameData.type === '' || bulkFrameData.type === 'none') {
        container.style.padding = '0';
        container.style.backgroundColor = 'transparent';
    } else {
        // Calculate frame padding based on inset width (scaled for preview)
        const paddingPercent = bulkFrameData.insetWidth / 100;
        const basePadding = 20; // Base padding in pixels for preview
        const padding = Math.round(basePadding * paddingPercent * 2) + 4; // Minimum 4px padding
        
        // Apply frame styling - padding creates the visible frame border
        container.style.padding = `${padding}px`;
        container.style.backgroundColor = bulkFrameData.color;
        
        // For aspect ratio frames, we may need asymmetric padding
        if (bulkFrameData.type !== 'even') {
            const [w, h] = bulkFrameData.type.split(':').map(Number);
            const targetRatio = w / h;
            const imgRatio = img.naturalWidth / img.naturalHeight;
            
            // Calculate how much extra padding is needed on which axis
            if (imgRatio > targetRatio) {
                // Image is wider than target - add vertical padding
                const extraVertical = Math.round(padding * (imgRatio / targetRatio - 1) * 0.5);
                container.style.padding = `${padding + extraVertical}px ${padding}px`;
            } else if (imgRatio < targetRatio) {
                // Image is taller than target - add horizontal padding
                const extraHorizontal = Math.round(padding * (targetRatio / imgRatio - 1) * 0.5);
                container.style.padding = `${padding}px ${padding + extraHorizontal}px`;
            }
        }
    }
}

// Open bulk edit modal
function openBulkEditModal() {
    if (selectedPosts.size === 0) return;
    
    // Reset form
    bulkTitleInput.value = '';
    bulkDescriptionInput.value = '';
    bulkPhotoDateInput.value = '';
    bulkCameraInput.value = '';
    resetBulkFrameData();
    resetBulkLocation();
    
    // Update count
    bulkEditCount.textContent = selectedPosts.size;
    
    // Initialize frame preview with first selected photo
    if (bulkFramePreviewImage) {
        const firstSlug = Array.from(selectedPosts)[0];
        const posts = filteredPosts.length > 0 ? filteredPosts : currentPosts;
        const firstPost = posts.find(p => p.slug === firstSlug);
        if (firstPost && firstPost.image) {
            bulkFramePreviewImage.src = firstPost.image;
            bulkFramePreviewImage.onload = () => updateBulkFramePreview();
        }
    }
    
    // Show modal
    bulkEditModal.style.display = 'flex';
}

// Close bulk edit modal
function closeBulkEditModal() {
    bulkEditModal.style.display = 'none';
}

// Apply bulk edit
async function applyBulkEdit() {
    if (selectedPosts.size === 0) return;
    
    const slugs = Array.from(selectedPosts);
    const updates = {};
    
    // Collect non-empty fields
    if (bulkTitleInput.value.trim()) {
        updates.title = bulkTitleInput.value.trim();
    }
    if (bulkDescriptionInput.value.trim()) {
        updates.description = bulkDescriptionInput.value.trim();
    }
    if (bulkPhotoDateInput.value) {
        updates.photoDate = bulkPhotoDateInput.value;
    }
    if (bulkCameraInput.value.trim()) {
        updates.camera = bulkCameraInput.value.trim();
    }
    
    // Handle frame settings
    if (bulkFrameData.type !== '') {
        updates.frame = {
            type: bulkFrameData.type,
            insetWidth: bulkFrameData.insetWidth,
            color: bulkFrameData.color
        };
    }
    
    // Handle location
    if (bulkLocation) {
        updates.location = {
            name: bulkLocation.name,
            lat: bulkLocation.lat,
            lng: bulkLocation.lng
        };
        // Include structured address fields if present
        if (bulkLocation.placeName) updates.location.placeName = bulkLocation.placeName;
        if (bulkLocation.city) updates.location.city = bulkLocation.city;
        if (bulkLocation.state) updates.location.state = bulkLocation.state;
        if (bulkLocation.country) updates.location.country = bulkLocation.country;
    }
    
    // Check if there's anything to update
    if (Object.keys(updates).length === 0) {
        showListMessage('No changes to apply.', 'info');
        closeBulkEditModal();
        return;
    }
    
    // Show loading state
    applyBulkEditBtn.disabled = true;
    applyBulkEditBtn.textContent = 'Applying...';
    showListMessage(`Updating ${slugs.length} photo${slugs.length > 1 ? 's' : ''}...`, 'info');
    
    try {
        const response = await fetch('/api/posts/batch-update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slugs, updates })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showListMessage(`Successfully updated ${data.updated} photo${data.updated > 1 ? 's' : ''}.`, 'success');
            closeBulkEditModal();
            exitSelectMode();
            loadPosts(); // Refresh the list
        } else {
            showListMessage(data.error || 'Failed to update some photos', 'error');
        }
    } catch (error) {
        console.error('Error bulk updating posts:', error);
        showListMessage('Network error. Please try again.', 'error');
    } finally {
        applyBulkEditBtn.disabled = false;
        applyBulkEditBtn.textContent = 'Apply Changes';
    }
}

// Event listeners for bulk edit
if (bulkEditBtn) {
    bulkEditBtn.addEventListener('click', openBulkEditModal);
}

if (closeBulkEditBtn) {
    closeBulkEditBtn.addEventListener('click', closeBulkEditModal);
}

if (cancelBulkEditBtn) {
    cancelBulkEditBtn.addEventListener('click', closeBulkEditModal);
}

if (applyBulkEditBtn) {
    applyBulkEditBtn.addEventListener('click', applyBulkEdit);
}

// Bulk frame type selection
if (bulkFrameTypeOptions) {
    bulkFrameTypeOptions.querySelectorAll('.frame-type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            // Update active state
            bulkFrameTypeOptions.querySelectorAll('.frame-type-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            bulkFrameData.type = btn.dataset.type;
            
            // Show/hide inset and color options
            const showOptions = bulkFrameData.type !== '' && bulkFrameData.type !== 'none';
            if (bulkInsetWidthGroup) bulkInsetWidthGroup.style.display = showOptions ? 'block' : 'none';
            if (bulkFrameColorGroup) bulkFrameColorGroup.style.display = showOptions ? 'block' : 'none';
            
            // Update preview
            updateBulkFramePreview();
        });
    });
}

// Bulk inset width slider
if (bulkInsetWidthSlider) {
    bulkInsetWidthSlider.addEventListener('input', () => {
        bulkFrameData.insetWidth = parseInt(bulkInsetWidthSlider.value);
        bulkInsetWidthValue.textContent = bulkFrameData.insetWidth + '%';
        updateBulkFramePreview();
    });
}

// Bulk frame color selection
if (bulkFrameColorOptions) {
    bulkFrameColorOptions.querySelectorAll('.frame-color-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            bulkFrameColorOptions.querySelectorAll('.frame-color-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            bulkFrameData.color = btn.dataset.color;
            updateBulkFramePreview();
        });
    });
}

// Close modal on backdrop click
if (bulkEditModal) {
    bulkEditModal.addEventListener('click', (e) => {
        if (e.target === bulkEditModal) {
            closeBulkEditModal();
        }
    });
}

// ========== Bulk Location Search ==========

// Search locations for bulk edit
async function searchBulkLocations(query) {
    if (!query || query.length < 2) {
        if (bulkLocationResults) bulkLocationResults.style.display = 'none';
        return;
    }
    
    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`,
            {
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'PanascenicPhotoEditor/1.0'
                }
            }
        );
        
        if (!response.ok) throw new Error('Search failed');
        
        const results = await response.json();
        
        if (results.length === 0) {
            bulkLocationResults.innerHTML = '<div class="location-result-item no-results">No locations found</div>';
            bulkLocationResults.style.display = 'block';
            return;
        }
        
        // Format each result with structured address data
        const formattedResults = results.map(result => formatLocationFromNominatim(result));
        
        bulkLocationResults.innerHTML = formattedResults.map((loc, index) => `
            <div class="location-result-item" data-index="${index}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                    <circle cx="12" cy="10" r="3"></circle>
                </svg>
                <span>${loc.name}</span>
            </div>
        `).join('');
        bulkLocationResults.style.display = 'block';
        
        // Add click handlers to results
        bulkLocationResults.querySelectorAll('.location-result-item:not(.no-results)').forEach(item => {
            item.addEventListener('click', () => {
                const index = parseInt(item.dataset.index);
                selectBulkLocation(formattedResults[index]);
            });
        });
    } catch (error) {
        console.error('Error searching locations:', error);
        bulkLocationResults.innerHTML = '<div class="location-result-item no-results">Search failed</div>';
        bulkLocationResults.style.display = 'block';
    }
}

// Select a location for bulk edit
function selectBulkLocation(location) {
    bulkLocation = location;
    bulkSelectedLocationName.textContent = location.name;
    bulkSelectedLocation.style.display = 'flex';
    bulkLocationSearch.value = '';
    bulkLocationResults.style.display = 'none';
}

// Bulk location search input handler with debounce
if (bulkLocationSearch) {
    bulkLocationSearch.addEventListener('input', (e) => {
        clearTimeout(bulkLocationSearchTimeout);
        bulkLocationSearchTimeout = setTimeout(() => {
            searchBulkLocations(e.target.value.trim());
        }, 300);
    });
}

// Clear bulk location button
if (clearBulkLocationBtn) {
    clearBulkLocationBtn.addEventListener('click', () => {
        resetBulkLocation();
    });
}

// Make bulk edit functions globally available
window.openBulkEditModal = openBulkEditModal;
window.closeBulkEditModal = closeBulkEditModal;
window.applyBulkEdit = applyBulkEdit;
