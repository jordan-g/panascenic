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
const darkModeSection = document.getElementById('darkModeSection');
const darkModeInput = document.getElementById('darkModeInput');
const darkModeFileText = document.getElementById('darkModeFileText');
const darkModePreview = document.getElementById('darkModePreview');
const darkModeImage = document.getElementById('darkModeImage');
const removeDarkModeBtn = document.getElementById('removeDarkModeBtn');

// State
let currentEditingSlug = null;
let isEditMode = false;
let isSelectMode = false;
let selectedPosts = new Set();

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
const ASPECT_RATIO = 4 / 5; // 600x750 thumbnail

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
        
        renderPosts(data.posts);
        
    } catch (error) {
        console.error('Error loading posts:', error);
        postsList.innerHTML = `<div class="error-state">Error loading posts: ${error.message}</div>`;
    }
}

// Render posts with selection mode support
function renderPosts(posts) {
    postsList.innerHTML = posts.map(post => `
        <div class="post-card ${isSelectMode ? 'selectable' : ''} ${selectedPosts.has(post.slug) ? 'selected' : ''}" data-slug="${post.slug}">
            ${isSelectMode ? `
                <div class="post-checkbox">
                    <input type="checkbox" ${selectedPosts.has(post.slug) ? 'checked' : ''} onchange="togglePostSelection('${post.slug}', this.checked)">
                </div>
            ` : ''}
            <div class="post-image" onclick="${isSelectMode ? `togglePostSelection('${post.slug}')` : `editPost('${post.slug}')`}">
                ${post.image ? `<img src="${post.image}" alt="${post.title || 'Untitled'}" onerror="this.style.display='none'">` : '<div class="no-image">No Image</div>'}
            </div>
            <div class="post-content" onclick="${isSelectMode ? `togglePostSelection('${post.slug}')` : `editPost('${post.slug}')`}">
                <h3 class="post-title">${escapeHtml(post.title || 'Untitled')}</h3>
                <p class="post-description">${escapeHtml(post.description || 'No description')}</p>
                <div class="post-meta">
                    <span class="post-date">${formatDate(post.date)}</span>
                    ${post.draft ? '<span class="draft-badge">Draft</span>' : ''}
                </div>
            </div>
            ${!isSelectMode ? `
                <div class="post-actions">
                    <button class="btn btn-sm btn-edit" onclick="editPost('${post.slug}')">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                        Edit
                    </button>
                </div>
            ` : ''}
        </div>
    `).join('');
}

// Selection mode functions
function enterSelectMode() {
    isSelectMode = true;
    selectedPosts.clear();
    updateSelectedCount();
    selectModeBtn.style.display = 'none';
    addPostBtn.style.display = 'none';
    deleteSelectedBtn.style.display = 'inline-flex';
    cancelSelectBtn.style.display = 'inline-flex';
    loadPosts();
}

function exitSelectMode() {
    isSelectMode = false;
    selectedPosts.clear();
    selectModeBtn.style.display = 'inline-flex';
    addPostBtn.style.display = 'inline-flex';
    deleteSelectedBtn.style.display = 'none';
    cancelSelectBtn.style.display = 'none';
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
    
    // Hide crop and dark mode sections for new posts
    cropSection.style.display = 'none';
    darkModeSection.style.display = 'none';
    darkModeInput.value = '';
    darkModeFileText.textContent = 'Choose dark mode image';
    darkModePreview.style.display = 'none';
    removeDarkModeFlag = false;
    
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
        
        // Show current image if available
        if (data.image) {
            currentImage.src = data.image;
            currentImageContainer.style.display = 'block';
            previewContainer.style.display = 'none';
            
            // Initialize crop tool
            cropSection.style.display = 'block';
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
    
    // Add crop data (normalized coordinates)
    if (cropSection.style.display !== 'none' && cropData.width > 0 && cropData.height > 0) {
        formData.append('thumbnailCrop', JSON.stringify({
            x: cropData.x,
            y: cropData.y,
            width: cropData.width,
            height: cropData.height
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

// ========== Crop Tool Functions ==========

function initCropTool(imageSrc, existingCrop = null) {
    cropImage.onload = () => {
        cropData.imageWidth = cropImage.naturalWidth;
        cropData.imageHeight = cropImage.naturalHeight;
        
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

function resetCropToDefault() {
    const imgAspect = cropData.imageWidth / cropData.imageHeight;
    
    if (imgAspect > ASPECT_RATIO) {
        // Image is wider than target - fit to height
        cropData.height = 1;
        cropData.width = (cropData.imageHeight * ASPECT_RATIO) / cropData.imageWidth;
        cropData.y = 0;
        cropData.x = (1 - cropData.width) / 2;
    } else {
        // Image is taller than target - fit to width
        cropData.width = 1;
        cropData.height = (cropData.imageWidth / ASPECT_RATIO) / cropData.imageHeight;
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
    
    // Clear and draw
    ctx.clearRect(0, 0, 120, 150);
    ctx.drawImage(cropImage, sx, sy, sw, sh, 0, 0, 120, 150);
}

function constrainCrop() {
    // Enforce aspect ratio
    const currentAspect = (cropData.width * cropData.imageWidth) / (cropData.height * cropData.imageHeight);
    if (Math.abs(currentAspect - ASPECT_RATIO) > 0.01) {
        cropData.height = (cropData.width * cropData.imageWidth) / (ASPECT_RATIO * cropData.imageHeight);
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
        let newW = cropData.startCropW;
        let newH = cropData.startCropH;
        let newX = cropData.startCropX;
        let newY = cropData.startCropY;
        
        // Handle resize based on which corner
        if (handle === 'se') {
            newW = Math.max(0.1, cropData.startCropW + dx);
        } else if (handle === 'sw') {
            newW = Math.max(0.1, cropData.startCropW - dx);
            newX = cropData.startCropX + (cropData.startCropW - newW);
        } else if (handle === 'ne') {
            newW = Math.max(0.1, cropData.startCropW + dx);
            const oldH = newH;
            newH = (newW * cropData.imageWidth) / (ASPECT_RATIO * cropData.imageHeight);
            newY = cropData.startCropY + (cropData.startCropH - newH);
        } else if (handle === 'nw') {
            newW = Math.max(0.1, cropData.startCropW - dx);
            newX = cropData.startCropX + (cropData.startCropW - newW);
            const oldH = newH;
            newH = (newW * cropData.imageWidth) / (ASPECT_RATIO * cropData.imageHeight);
            newY = cropData.startCropY + (cropData.startCropH - newH);
        }
        
        // Enforce aspect ratio
        newH = (newW * cropData.imageWidth) / (ASPECT_RATIO * cropData.imageHeight);
        
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

// Reset crop button
resetCropBtn.addEventListener('click', () => {
    resetCropToDefault();
    updateCropBox();
    updateCropPreview();
});

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
