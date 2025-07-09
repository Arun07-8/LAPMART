    let cropper = null;
    let currentImageIndex = -1;
    let isRecropping = false;
    let originalImages = [];
    let croppedImages = [];
    const minImages = 2;
    const maxImages = 4;
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];

    function sanitizeInput(input) {
        const div = document.createElement('div');
        div.textContent = input;
        return div.innerHTML.replace(/[<>&"]/g, '');
    }

    // Drag and Drop
    const dropZone = document.getElementById('dropZone');
    const imageInput = document.getElementById('images');
    dropZone.addEventListener('click', () => imageInput.click());
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });
    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        handleFiles(e.dataTransfer.files);
    });

    // File Input Change
    imageInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
    });
    function handleFiles(files) {
        clearErrorMessage('images');
        
        // Check if any files were provided
        if (!files || files.length === 0) {
            Swal.fire({
                icon: 'error',
                title: 'No Files Selected',
                text: 'Please select valid image files to upload.'
            });
            return;
        }

        const newFiles = Array.from(files).filter(file => 
            allowedTypes.includes(file.type) && file.size <= 5 * 1024 * 1024
        );

        // Check if any valid files remain after filtering
        if (newFiles.length === 0) {
            Swal.fire({
                icon: 'error',
                title: 'Invalid Files',
                text: 'Only JPEG, PNG, or WebP images up to 5MB are allowed.'
            });
            return;
        }

        // Calculate total images
        const totalImages = croppedImages.length + newFiles.length;

        // Check minimum images
        if (totalImages < minImages) {
       
            
            Swal.fire({
                icon: 'error',
                title: 'Insufficient Images',
                text: `You have ${croppedImages.length} images. Please add at least ${minImages - croppedImages.length} more images to meet the minimum requirement of ${minImages}.`
            });
            return;
        }

        // Check maximum images
        if (totalImages > maxImages) {
            
            Swal.fire({
                icon: 'error',
                title: 'Maximum Images Exceeded',
                text: `You have selected ${totalImages} images. Please select ${maxImages - croppedImages.length} or fewer images to stay within the maximum limit of ${maxImages}.`
            });
            return;
        }

        // Append new files to originalImages
        newFiles.forEach(file => {
            const reader = new FileReader();
            reader.onload = (e) => {
                originalImages.push({ file, dataUrl: e.target.result });
                // Start cropping only for the newly added images
                if (originalImages.length === croppedImages.length + newFiles.length) {
                    updatePreview();
                    startCrop(croppedImages.length); // Start cropping from the first new image
                }
            };
            reader.readAsDataURL(file);
        });
    }
    function removeImage(index) {
        croppedImages.splice(index, 1);
        originalImages.splice(index, 1);
        updatePreview();
        updateFormFiles();
        // Reset file input to allow new uploads
        imageInput.value = '';
        if (croppedImages.length < minImages) {
            Swal.fire({
                icon: 'error',
                title: 'Insufficient Images',
                text: `You have ${croppedImages.length} images. Please add at least ${minImages - croppedImages.length} more images to meet the minimum requirement of ${minImages}.`
            });
        }
    }

    function updateFormFiles() {
        const dataTransfer = new DataTransfer();
        croppedImages.forEach(img => dataTransfer.items.add(img.file));
        imageInput.files = dataTransfer.files;
    }

    function updatePreview() {
        const previewContainer = document.getElementById('imagePreviewContainer');
        previewContainer.innerHTML = '';
        
        if (croppedImages.length > 0) {
            // Main Image (First Image)
            const mainImageDiv = document.createElement('div');
            mainImageDiv.className = 'main-image-preview';
            mainImageDiv.innerHTML = `
                <img src="${croppedImages[0].dataUrl}" alt="Main Preview">
                <div class="preview-controls">
                    <button type="button" class="recrop-btn" onclick="recropImage(0)" title="Recrop"><i class="fas fa-crop-alt"></i></button>
                    <button type="button" class="remove-btn" onclick="removeImage(0)" title="Remove">×</button>
                </div>
            `;
            previewContainer.appendChild(mainImageDiv);

            // Secondary Images (2nd, 3rd, 4th, etc.)
            if (croppedImages.length > 1) {
                const secondaryImagesDiv = document.createElement('div');
                secondaryImagesDiv.className = 'secondary-images';
                croppedImages.slice(1).forEach((img, index) => {
                    const secondaryImageDiv = document.createElement('div');
                    secondaryImageDiv.className = 'secondary-image-preview';
                    secondaryImageDiv.innerHTML = `
                        <img src="${img.dataUrl}" alt="Secondary Preview ${index + 2}">
                        <div class="preview-controls">
                            <button type="button" class="recrop-btn" onclick="recropImage(${index + 1})" title="Recrop"><i class="fas fa-crop-alt"></i></button>
                            <button type="button" class="remove-btn" onclick="removeImage(${index + 1})" title="Remove">×</button>
                        </div>
                    `;
                    secondaryImagesDiv.appendChild(secondaryImageDiv);
                });
                previewContainer.appendChild(secondaryImagesDiv);
            }
        }
    }

    function startCrop(index) {
        if (index >= originalImages.length) return;
        currentImageIndex = index;
        const cropperContainer = document.getElementById('cropperContainer');
        const cropperImg = document.getElementById('cropperImg');
        const cropImageNumber = document.getElementById('cropImageNumber');
        cropperImg.src = originalImages[index].dataUrl;
        cropImageNumber.textContent = isRecropping ? `(Recropping Image ${index + 1})` : `(${index + 1} of ${originalImages.length})`;
        cropperContainer.style.display = 'block';

        if (cropper) cropper.destroy();
        cropper = new Cropper(cropperImg, {
            viewMode: 1,
            dragMode: 'crop',
            responsive: true,
            restore: false,
            center: true,
            highlight: true,
            background: true,
            autoCrop: true,
            autoCropArea: 0.8,
            movable: true,
            rotatable: false,
            scalable: true,
            zoomable: true,
            zoomOnTouch: true,
            zoomOnWheel: true,
            aspectRatio: NaN
        });

        setActiveAspectRatioButton('free');
    }

    function recropImage(index) {
        isRecropping = true;
        startCrop(index);
    }

    function setAspectRatio(ratio) {
        if (cropper) {
            cropper.setAspectRatio(ratio === 'free' ? NaN : ratio);
            setActiveAspectRatioButton(ratio);
        }
    }

    function setActiveAspectRatioButton(ratio) {
        document.querySelectorAll('.aspect-ratio-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`.aspect-ratio-btn[data-ratio="${ratio}"]`).classList.add('active');
    }

    function cropImage() {
        if (!cropper) return;
        const cropData = cropper.getData();
        if (cropData.width < 256 || cropData.height < 256) {
            Swal.fire({
                icon: 'error',
                title: 'Invalid Crop',
                text: 'Cropped image must be at least 256x256 pixels.'
            });
            return;
        }

        const croppedCanvas = cropper.getCroppedCanvas({
            minWidth: 256,
            minHeight: 256,
            maxWidth: 4096,
            maxHeight: 4096,
            fillColor: '#fff',
            imageSmoothingEnabled: true,
            imageSmoothingQuality: 'high'
        });

        const file = originalImages[currentImageIndex].file;
        const mimeType = file.type;
        const extension = mimeType.split('/')[1];

        croppedCanvas.toBlob((blob) => {
            const croppedFile = new File([blob], `cropped_image_${currentImageIndex}.${extension}`, {
                type: mimeType,
                lastModified: Date.now()
            });
            croppedImages[currentImageIndex] = {
                file: croppedFile,
                dataUrl: croppedCanvas.toDataURL(mimeType)
            };
            updatePreview();
            cropper.destroy();
            cropper = null;
            document.getElementById('cropperContainer').style.display = 'none';
            updateFormFiles();
            if (!isRecropping && currentImageIndex + 1 < originalImages.length) {
                startCrop(currentImageIndex + 1);
            }
            isRecropping = false;
        }, mimeType, 0.9);
    }

    function cancelCrop() {
        if (cropper) {
            cropper.destroy();
            cropper = null;
        }
        document.getElementById('cropperContainer').style.display = 'none';
        if (!isRecropping) {
            originalImages = [];
            croppedImages = [];
            imageInput.value = '';
        }
        updatePreview();
        updateFormFiles();
        isRecropping = false;
    }


document.getElementById('editProductForm').addEventListener('submit', async function (event) {
    event.preventDefault();
    if (validateForm()) {
        const form = this;
        const formData = new FormData(form);
        for (const [key, value] of formData.entries()) {
        }
        Swal.fire({
            title: 'Processing...',
            text: 'Updating your product',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        try {
            const response = await fetch('/admin/addProduct', {
                method: 'POST',
                body: formData,
            });
            const result = await response.json();
            if (response.ok) {
                Swal.fire({
                    icon: 'success',
                    title: 'Success',
                    text: result.message || 'Product updated successfully!',
                    timer: 2000,
                    showConfirmButton: false
                }).then(() => {
                    window.location.href = '/admin/products';
                });
            } else {
                console.error('Server error:', await response.text());
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: result.error || 'Failed to update product.'
                });
            }
        } catch (error) {
            console.error('Fetch error:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: `An unexpected error occurred: ${error.message}. Please try again.`
            });
        }
    } else {
        const firstInvalid = document.querySelector('.is-invalid');
        if (firstInvalid) {
            firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        Swal.fire({
            icon: 'error',
            title: 'Validation Error',
            text: 'Please correct the errors in the form before submitting.'
        });
    }
});

function validateForm() {
    clearErrorMessages();
    let isValid = true;
    let firstInvalidField = null;

    const fields = [
        { id: 'productName', validate: (value) => {
            value = sanitizeInput(value);
            if (!value) return 'Product name is required.';
            const wordCount = value.trim().split(/\s+/).length;
            if (wordCount < 3) return 'Product name must contain at least 3 words.';
            return '';
        }},
        { id: 'description', validate: (value) => {
            value = sanitizeInput(value);
            if (!value) return 'Description is required.';
            const wordCount = value.trim().split(/\s+/).length;
            if (wordCount < 5) return 'Description must contain at least 5 words.';
            return '';
        }},
        { id: 'brandId', validate: (value) => !value ? 'Please select a brand.' : '' }, // Corrected ID
        { id: 'categoryId', validate: (value) => !value ? 'Please select a category.' : '' }, // Corrected ID
        
        { id: 'offerAmount', validate: (value) => { // Corrected ID to match input
            if (!value) return 'Offer price is required.';
            const price = parseFloat(value);
            if (isNaN(price) || price < 15000 || price > 150000) return 'Offer price must be between 15000 and 150,000.';
            return '';
        }},
        { id: 'stockCount', validate: (value) => { // Corrected ID to match input
            if (!value) return 'Stock count is required.';
            const qty = parseInt(value);
            if (isNaN(qty) || qty < 0 || qty > 1000) return 'Stock count must be between 0 and 1,000.';
            return '';
        }},
        { id: 'processor', validate: (value) => {
            value = sanitizeInput(value);
            if (!value) return 'Processor is required.';
            const wordCount = value.trim().split(/\s+/).length;
            if (wordCount < 2) return 'Processor must contain at least 2 words.';
            return '';
        }},
        { id: 'gpu', validate: (value) => { // Corrected ID to match input
            value = sanitizeInput(value);
            if (!value) return 'Graphics card is required.';
            const wordCount = value.trim().split(/\s+/).length;
            if (wordCount < 2) return 'Graphics card must contain at least 2 words.';
            return '';
        }},
        { id: 'ram', validate: (value) => {
            value = sanitizeInput(value);
            if (!value) return 'RAM is required.';
            const wordCount = value.trim().split(/\s+/).length;
            if (wordCount < 2) return 'RAM must contain at least 2 words.';
            return '';
        }},
        { id: 'Storage', validate: (value) => {
            value = sanitizeInput(value);
            if (!value) return 'Storage is required.';
            const wordCount = value.trim().split(/\s+/).length;
            if (wordCount < 2) return 'Storage must contain at least 2 words.';
            return '';
        }},
        { id: 'display', validate: (value) => {
            value = sanitizeInput(value);
            if (!value) return 'Display is required.';
            const wordCount = value.trim().split(/\s+/).length;
            if (wordCount < 2) return 'Display must contain at least 2 words.';
            return '';
        }},
        { id: 'operatingSystem', validate: (value) => {
            value = sanitizeInput(value);
            if (!value) return 'Operating system is required.';
            const wordCount = value.trim().split(/\s+/).length;
            if (wordCount < 2) return 'Operating system must contain at least 2 words.';
            return '';
        }},
        { id: 'Battery', validate: (value) => {
            value = sanitizeInput(value);
            if (!value) return 'Battery is required.';
            const wordCount = value.trim().split(/\s+/).length;
            if (wordCount < 2) return 'Battery must contain at least 2 words.';
            return '';
        }},
        { id: 'Weight', validate: (value) => {
            value = sanitizeInput(value);
            if (!value) return 'Weight is required.';
            const wordCount = value.trim().split(/\s+/).length;
            if (wordCount < 2) return 'Weight must contain at least 2 words.';
            return '';
        }},
        { id: 'Warranty', validate: (value) => {
            value = sanitizeInput(value);
            if (!value) return 'Warranty is required.';
            const wordCount = value.trim().split(/\s+/).length;
            if (wordCount < 2) return 'Warranty must contain at least 2 words.';
            return '';
        }},
        { id: 'additionalFeatures', validate: (value) => {
            value = sanitizeInput(value);
            if (value && value.trim().split(/\s+/).length < 2) return 'Additional features must contain at least 2 words.';
            return '';
        }}
    ];

    fields.forEach(field => {
        const element = document.getElementById(field.id);
        if (!element) {
            console.error(`Element with ID ${field.id} not found.`);
            isValid = false;
            return;
        }
        const value = element.value.trim();
        const errorMessage = field.validate(value);
        if (errorMessage) {
            displayErrorMessage(field.id, errorMessage);
            element.classList.add('is-invalid');
            if (!firstInvalidField) firstInvalidField = element;
            isValid = false;
        }
    });


    const salePrice = parseFloat(document.getElementById('offerAmount').value);

    if (croppedImages.length < minImages) {
        Swal.fire({
            icon: 'error',
            title: 'Insufficient Images',
            text: `You have ${croppedImages.length} images. Please add at least ${minImages - croppedImages.length} more images to meet the minimum requirement of ${minImages}.`
        });
        displayErrorMessage('images', `Please upload and crop at least ${minImages} images (maximum ${maxImages}).`);
        document.getElementById('images').classList.add('is-invalid');
        if (!firstInvalidField) firstInvalidField = document.getElementById('images');
        isValid = false;
    } else if (croppedImages.length > maxImages) {
        Swal.fire({
            icon: 'error',
            title: 'Maximum Images Exceeded',
            text: `You have ${croppedImages.length} images. Please remove ${croppedImages.length - maxImages} image(s) to stay within the maximum limit of ${maxImages}.`
        });
        displayErrorMessage('images', `You have uploaded ${croppedImages.length} images. Please remove ${croppedImages.length - maxImages} image(s) to stay within the maximum limit of ${maxImages}.`);
        document.getElementById('images').classList.add('is-invalid');
        if (!firstInvalidField) firstInvalidField = document.getElementById('images');
        isValid = false;
    }

    return isValid;
}
    function displayErrorMessage(id, message) {
        const errorElement = document.getElementById(`${id}-error`);
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.classList.add('active');
            errorElement.style.display = 'block';
        }
    }

    function clearErrorMessage( id) {
        const errorElement = document.getElementById(`${id}-error`);
        if (errorElement) {
            errorElement.textContent = '';
            errorElement.classList.remove('active');
            errorElement.style.display = 'none';
        }
        const element = document.getElementById(id);
        if (element) {
            element.classList.remove('is-invalid');
        }
    }

    function clearErrorMessages() {
        const errorElements = document.getElementsByClassName('error-message');
        for (let element of errorElements) {
            element.textContent = '';
            element.classList.remove('active');
            element.style.display = 'none';
        }
        const inputs = document.querySelectorAll('input, select, textarea');
        for (let input of inputs) {
            input.classList.remove('is-invalid');
        }
    }