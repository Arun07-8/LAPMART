let cropper = null;
let currentImageIndex = -1;
let isRecropping = false;
let originalImages = [];
let croppedImages = [];
let existingImages = window.existingImages || [];
const minImages = 2;
const maxImages = 5;
const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];

// Convert existing images into cropped format
existingImages.forEach((imageUrl, index) => {
    croppedImages[index] = { dataUrl: imageUrl, file: null };
});

// Elements for image upload (only on edit page)
const dropZone = document.getElementById('dropZone');
const imageInput = document.getElementById('images');

// Image upload event listeners (only attach if elements exist)
if (dropZone && imageInput) {
    dropZone.addEventListener('click', () => imageInput.click());
    dropZone.addEventListener('dragover', e => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });
    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });
    dropZone.addEventListener('drop', e => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        handleFiles(e.dataTransfer.files);
    });

    imageInput.addEventListener('change', e => {
        handleFiles(e.target.files);
    });
}

function handleFiles(files) {
    clearErrorMessage('images');
    const newFiles = Array.from(files).filter(file =>
        allowedTypes.includes(file.type) && file.size <= 5 * 1024 * 1024
    );

    const totalImages = existingImages.length + newFiles.length;
    if (totalImages > maxImages) {
        Swal.fire({
            icon: 'error',
            title: 'Too Many Images',
            text: `Maximum ${maxImages} images. You already have ${existingImages.length}.`
        });
        imageInput.value = '';
        return;
    }

    originalImages = [];
    newFiles.forEach(file => {
        const reader = new FileReader();
        reader.onload = e => {
            originalImages.push({ file, dataUrl: e.target.result });
            if (originalImages.length === newFiles.length) {
                startCrop(0);
            }
        };
        reader.readAsDataURL(file);
    });
}

function updatePreview() {
    const previewContainer = document.getElementById('imagePreviewContainer');
    if (!previewContainer) return; // Skip if not on edit page
    previewContainer.innerHTML = '';
    const productId = document.getElementById('proID')?.value || '';

    const imagesToDisplay = croppedImages.length > 0 ? croppedImages : existingImages.map(url => ({ dataUrl: url, file: null }));

    if (imagesToDisplay.length === 0) {
        previewContainer.innerHTML = '<p class="text-white">No images uploaded.</p>';
        return;
    }

    const mainImageContainer = document.createElement('div');
    mainImageContainer.className = 'main-image-container';
    const mainImageDiv = document.createElement('div');
    mainImageDiv.className = 'main-image-preview';
    mainImageDiv.innerHTML = `
        <img src="${imagesToDisplay[0].dataUrl}" alt="Main Preview">
        <div class="preview-controls">
            <button type="button" class="recrop-btn" onclick="recropImage(0)"><i class="fas fa-crop-alt"></i></button>
            <button type="button" class="remove-btn" onclick="removeImage('${productId}', 0)"><i class="fas fa-trash"></i></button>
        </div>
    `;
    mainImageContainer.appendChild(mainImageDiv);
    previewContainer.appendChild(mainImageContainer);

    if (imagesToDisplay.length > 1) {
        const secondaryImagesDiv = document.createElement('div');
        secondaryImagesDiv.className = 'secondary-images';
        imagesToDisplay.slice(1).forEach((img, index) => {
            const actualIndex = index + 1;
            const secondaryImageDiv = document.createElement('div');
            secondaryImageDiv.className = 'secondary-image-preview';
            secondaryImageDiv.innerHTML = `
                <img src="${img.dataUrl}" alt="Secondary Preview ${actualIndex}">
                <div class="preview-controls">
                    <button type="button" class="recrop-btn" onclick="recropImage(${actualIndex})"><i class="fas fa-crop-alt"></i></button>
                    <button type="button" class="remove-btn" onclick="removeImage('${productId}', ${actualIndex})"><i class="fas fa-trash"></i></button>
                </div>
            `;
            secondaryImagesDiv.appendChild(secondaryImageDiv);
        });
        previewContainer.appendChild(secondaryImagesDiv);
    }
}

function startCrop(index) {
    if (index >= originalImages.length) {
        updatePreview();
        updateFormFiles();
        return;
    }

    currentImageIndex = index;
    const cropperContainer = document.getElementById('cropperContainer');
    const cropperImg = document.getElementById('cropperImg');
    const cropImageNumber = document.getElementById('cropImageNumber');

    if (!cropperContainer || !cropperImg || !cropImageNumber) return;

    cropperImg.src = originalImages[index].dataUrl;
    cropImageNumber.textContent = isRecropping ? `(Recropping Image ${index + 1})` : `(${index + 1} of ${originalImages.length})`;
    cropperContainer.style.display = 'block';

    cropperImg.onload = () => {
        if (cropper) cropper.destroy();
        cropper = new Cropper(cropperImg, {
            viewMode: 1,
            dragMode: 'crop',
            responsive: true,
            autoCropArea: 0.8,
            movable: true,
            scalable: true,
            zoomable: true,
            aspectRatio: NaN
        });
        setActiveAspectRatioButton('free');
    };
}

function recropImage(index) {
    if (!croppedImages[index]) return;
    const img = new Image();
    img.src = croppedImages[index].dataUrl;
    img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        originalImages = [{ dataUrl: canvas.toDataURL('image/jpeg'), file: null }];
        currentImageIndex = 0;
        isRecropping = true;
        startCrop(0);
    };
}

function cropImage() {
    if (!cropper) return;
    const croppedCanvas = cropper.getCroppedCanvas({ minWidth: 256, minHeight: 256 });
    const mimeType = originalImages[currentImageIndex].file?.type || 'image/jpeg';
    const extension = mimeType.split('/')[1];

    croppedCanvas.toBlob(blob => {
        const croppedFile = new File([blob], `cropped_${Date.now()}.${extension}`, { type: mimeType });
        const dataUrl = croppedCanvas.toDataURL(mimeType);

        if (isRecropping) {
            croppedImages[currentImageIndex] = { file: croppedFile, dataUrl };
            existingImages[currentImageIndex] = dataUrl;
        } else {
            croppedImages.push({ file: croppedFile, dataUrl });
            existingImages.push(dataUrl);
        }

        cropper.destroy();
        cropper = null;
        document.getElementById('cropperContainer').style.display = 'none';
        if (!isRecropping && currentImageIndex + 1 < originalImages.length) {
            startCrop(currentImageIndex + 1);
        } else {
            updatePreview();
            updateFormFiles();
        }
        isRecropping = false;
    }, mimeType, 0.9);
}

function removeImage(productId, index) {
    if (!existingImages[index] && !croppedImages[index]) return;

    const totalImages = existingImages.length + croppedImages.filter(i => i.file).length;
    if (totalImages <= minImages) {
        Swal.fire({ icon: 'warning', title: 'Minimum Images', text: `At least ${minImages} images required.` });
        return;
    }

    existingImages.splice(index, 1);
    croppedImages.splice(index, 1);
    updatePreview();
    updateFormFiles();
}

function updateFormFiles() {
    if (!imageInput) return;
    const dataTransfer = new DataTransfer();
    croppedImages.forEach(img => {
        if (img.file) dataTransfer.items.add(img.file);
    });
    imageInput.files = dataTransfer.files;
}

function setActiveAspectRatioButton(ratio) {
    document.querySelectorAll('.aspect-ratio-btn').forEach(btn => btn.classList.remove('active'));
    const btn = document.querySelector(`.aspect-ratio-btn[data-ratio="${ratio}"]`);
    if (btn) btn.classList.add('active');
}

function setAspectRatio(ratio) {
    if (cropper) {
        cropper.setAspectRatio(ratio === 'free' ? NaN : ratio);
        setActiveAspectRatioButton(ratio);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Image upload initialization (only on edit page)
    if (document.getElementById('imagePreviewContainer')) {
        updatePreview();
    }

    // Product edit form submission
    const form = document.getElementById('editProductForm');
    if (form) {
        form.addEventListener('submit', async event => {
            event.preventDefault();
            if (!validateForm()) {
                Swal.fire({ icon: 'error', title: 'Validation Error', text: 'Please fill all required fields.' });
                return;
            }

            const productId = document.getElementById('proID').value;
            const formData = new FormData(form);

            Swal.fire({ title: 'Saving...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

            try {
                const response = await fetch(`/admin/editProduct/${productId}`, {
                    method: 'POST',
                    body: formData,
                    credentials: 'include'
                });
                const result = await response.json();
                if (response.ok) {
                    Swal.fire({ icon: 'success', title: 'Product updated', timer: 1500, showConfirmButton: false })
                        .then(() => window.location.href = '/admin/products');
                } else {
                    throw new Error(result.message || 'Update failed');
                }
            } catch (error) {
                Swal.fire({ icon: 'error', title: 'Error', text: error.message });
            }
        });
    }

    
    const searchInput = document.getElementById('searchInput');
    const tableBody = document.querySelector('tbody');
    let debounceTimeout;

    if (searchInput && tableBody) {
    
        fetchProducts('');

        // Search input event listener
        searchInput.addEventListener('input', () => {
            clearTimeout(debounceTimeout);
            const searchTerm = searchInput.value.trim();
            tableBody.innerHTML = '<tr><td colspan="9" class="loading-spinner">Loading...</td></tr>';

            debounceTimeout = setTimeout(() => {
                fetchProducts(searchTerm);
            }, 300);
        });

    }

    async function fetchProducts(searchTerm) {
        try {
            const url = searchTerm ? `/admin/products?search=${encodeURIComponent(searchTerm)}` : '/admin/products';
      
            const response = await fetch(url, {
                method: 'GET',
                headers: { 'Accept': 'application/json' },
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
          
            if (!data.products) {
                throw new Error('Invalid response format: "products" field missing');
            }
      if(searchTerm){
        updateTable(data.products);}

         
       
        } catch (error) {
            console.error('Fetch error:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: `Failed to load products: ${error.message}`
            });
            tableBody.innerHTML = '<tr><td colspan="9" class="text-center">Error loading products</td></tr>';
        }
    }

    function updateTable(products) {
        if (!tableBody) return;
        tableBody.innerHTML = '';

        if (!products || products.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="9" class="text-center">No products found.</td></tr>';
            return;
        }

        products.forEach(product => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>
                    <div class="product-image">
                        <img src="${product.productImage && product.productImage.length > 0 ? product.productImage[0] : '/images/no-image.png'}" 
                             alt="Product Image" class="product-thumbnail">
                    </div>
                </td>
                <td><div class="product-name"><span>${product.productName}</span></div></td>
                <td>${product?.category?.name || 'N/A'}</td>
                <td>${product?.brand?.name || 'N/A'}</td>
                <td>${product?.quantity || 0}</td>
                <td>₹${product?.salePrice || 0}</td>
                <td>
                    ${product.quantity === 0 ? '<h5 style="color: rgb(255, 0, 0);">Out of stock</h5>' : 
                      product.isListed ? 'Available' : '<h5 style="color: rgb(255, 0, 0);">Not Available</h5>'}
                </td>
                <td>
                    ${product.isListed ? 
                        `<button class="btn-status btn-listed" onclick="handleUnlistProduct('${product._id}')" aria-label="Unlist product">Listed</button>` :
                        `<button class="btn-status btn-listed2" onclick="handleListProduct('${product._id}')" aria-label="List product">Unlisted</button>`}
                </td>
                <td class="actions-cell">
                    <div class="action-buttons">
                        <a href="/admin/editProduct/${product._id}" class="edit-link" title="Edit" style="text-decoration: none;">
                            <i class="bi bi-pencil edit-icon"></i>
                        </a>
                        <button onclick="handleSoftDeleteClick('${product._id}')" style="background: none; border: none; color: inherit;">
                            <i class="bi bi-trash delete-icon" title="Delete"></i>
                        </button>
                    </div>
                </td>
            `;
            tableBody.appendChild(row);
        });
    }
});

function validateForm() {
    let isValid = true;
    const fields = [
        'productName', 'description', 'offerAmount', 'stockCount',
        'brandId', 'categoryId', 'processor', 'gpu',
        'ram', 'Storage', 'display', 'operatingSystem',
        'Battery', 'Weight', 'Warranty'
    ];
    fields.forEach(id => {
        const value = document.getElementById(id)?.value.trim();
        if (!value) {
            displayErrorMessage(`${id}-error`, `${id} is required.`);
            isValid = false;
        }
    });
    const totalImages = existingImages.length + croppedImages.filter(i => i.file).length;
    if (totalImages < minImages) {
        displayErrorMessage('images-error', `At least ${minImages} images required.`);
        isValid = false;
    }
    return isValid;
}

function displayErrorMessage(id, msg) {
    const el = document.getElementById(id);
    if (el) {
        el.textContent = msg;
        el.style.display = 'block';
    }
}

function clearErrorMessage(id) {
    const el = document.getElementById(`${id}-error`);
    if (el) {
        el.textContent = '';
        el.style.display = 'none';
    }
}

async function handleSoftDeleteClick(orderId) {
    const result = await Swal.fire({
        title: 'Are you sure?',
        text: 'This will mark the product as deleted. You can restore it later.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Yes, delete it!',
        cancelButtonText: 'Cancel'
    });

    if (result.isConfirmed) {
        try {
            const response = await fetch(`/admin/deleteProducts/${orderId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to soft delete product');
            Swal.fire({
                icon: 'success',
                title: 'Deleted',
                text: data.message || 'Product has been soft deleted',
                timer: 1500,
                showConfirmButton: false
            }).then(() => location.reload());
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Oops',
                text: error.message || 'An error occurred while deleting the product'
            });
        }
    }
}

async function handleListProduct(orderId) {
    const result = await Swal.fire({
        title: 'Are you sure?',
        text: 'This will list the product, making it visible.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Yes, list it!',
        cancelButtonText: 'Cancel'
    });
    if (result.isConfirmed) {
        try {
            const response = await fetch(`/admin/listedProduct/${orderId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to list product');
            Swal.fire({
                icon: 'success',
                title: 'Product Listed',
                text: data.message || 'Product has been listed successfully',
                timer: 1500,
                showConfirmButton: false
            }).then(() => location.reload());
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: error.message || 'An error occurred while listing the product'
            });
        }
    }
}

async function handleUnlistProduct(orderId) {
    const result = await Swal.fire({
        title: 'Are you sure?',
        text: 'This will unlist the product, making it hidden.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Yes, unlist it!',
        cancelButtonText: 'Cancel'
    });
    if (result.isConfirmed) {
        try {
            const response = await fetch(`/admin/unlistedProduct/${orderId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to unlist product');
            Swal.fire({
                icon: 'success',
                title: 'Product Unlisted',
                text: data.message || 'Product has been unlisted successfully',
                timer: 1500,
                showConfirmButton: false
            }).then(() => location.reload());
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: error.message || 'An error occurred while unlisting the product'
            });
        }
    }
}