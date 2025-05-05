let croppers = {};
let originalImages = {};
let croppedImages = [];
let croppedBlobs = [];

function sanitizeInput(input) {
    const div = document.createElement('div');
    div.textContent = input;
    return div.innerHTML.replace(/[<>&"]/g, '');
}

document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('addProductForm').addEventListener('submit', async function (event) {
        event.preventDefault();
        console.log('Form submitted');

        if (validateForm()) {
            console.log('Form validation passed');
            const form = this;
            const formData = new FormData(form);

            // Clear existing images in FormData
            formData.delete('images');

            // Append cropped images
            croppedBlobs.forEach((blob, index) => {
                formData.append('images', blob, `cropped_image_${index + 1}.${blob.type.split('/')[1]}`);
            });

            Swal.fire({
                title: 'Processing...',
                text: 'Adding your product',
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });

            try {
                console.log('Sending fetch request to /admin/addProducts');
                const response = await fetch('/admin/addProducts', {
                    method: 'POST',
                    body: formData
                });

                console.log('Response status:', response.status);

                const contentType = response.headers.get('content-type');
                let result;

                if (contentType && contentType.includes('application/json')) {
                    result = await response.json();
                    console.log('Response JSON:', result);
                } else {
                    const text = await response.text();
                    console.log('Response text:', text);
                    result = { message: 'Operation completed', success: response.ok };
                }

                if (response.ok) {
                    Swal.fire({
                        icon: 'success',
                        title: 'Success',
                        text: result.message || 'Product added successfully!',
                        timer: 2000,
                        showConfirmButton: false
                    }).then(() => {
                        console.log('Redirecting to products page');
                        window.location.href = '/admin/products';
                    });
                } else {
                    console.log('Request failed with status ' + response.status);
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: result.error || 'Failed to add product.'
                    });
                }
            } catch (error) {
                console.error('Submission error:', error);
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'An unexpected error occurred. Please try again.'
                });
            }
        } else {
            console.log('Form validation failed');
            const firstInvalid = document.querySelector('.is-invalid');
            if (firstInvalid) {
                console.log('Scrolling to first invalid field:', firstInvalid.id);
                setTimeout(() => {
                    firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 100);
            }
            Swal.fire({
                icon: 'error',
                title: 'Validation Error',
                text: 'Please correct the errors in the form before submitting.'
            });
        }
    });
});

function validateForm() {
    clearErrorMessages();
    let isValid = true;
    let firstInvalidField = null;

    const fields = [
        {
            id: 'productName',
            validate: (value) => {
                value = sanitizeInput(value);
                if (!value) return 'Product name is required.';
                const wordCount = value.trim().split(/\s+/).length;
                if (wordCount < 3) return 'Product name must contain at least 3 words.';
                return '';
            }
        },
        {
            id: 'description',
            validate: (value) => {
                value = sanitizeInput(value);
                if (!value) return 'Description is required.';
                const wordCount = value.trim().split(/\s+/).length;
                if (wordCount < 5) return 'Description must contain at least 5 words.';
                return '';
            }
        },
        {
            id: 'brand',
            validate: (value) => !value ? 'Please select a brand.' : ''
        },
        {
            id: 'category',
            validate: (value) => !value ? 'Please select a category.' : ''
        },
        {
            id: 'regularPrice',
            validate: (value) => {
                if (!value) return 'Regular price is required.';
                const price = parseFloat(value);
                if (isNaN(price) || price < 15000 || price > 150000) return 'Regular price must be between 15000 and 150,000.';
                return '';
            }
        },
        {
            id: 'salePrice',
            validate: (value) => {
                if (!value) return 'Offer price is required.';
                const price = parseFloat(value);
                if (isNaN(price) || price < 15000 || price > 150000) return 'Offer price must be between 15000 and 150,000.';
                return '';
            }
        },
        {
            id: 'quantity',
            validate: (value) => {
                if (!value) return 'Stock count is required.';
                const qty = parseInt(value);
                if (isNaN(qty) || qty < 0 || qty > 1000) return 'Stock count must be between 0 and 1,000.';
                return '';
            }
        },
        {
            id: 'processor',
            validate: (value) => {
               value = sanitizeInput(value);
                if (!value) return 'Processor is required.';
                const wordCount = value.trim().split(/\s+/).length;
                if (wordCount < 2) return 'Processor must contain at least 2 words.';
                return '';
            }
        },
        {
            id: 'graphicsCard',
            validate: (value) => {
                value = sanitizeInput(value);
                if (!value) return 'Graphics card is required.';
                const wordCount = value.trim().split(/\s+/).length;
                if (wordCount < 2) return 'Graphics card must contain at least 2 words.';
                return '';
            }
        },
        {
            id: 'ram',
            validate: (value) => {
                value = sanitizeInput(value);
                if (!value) return 'RAM is required.';
                const wordCount = value.trim().split(/\s+/).length;
                if (wordCount < 2) return 'RAM must contain at least 2 words.';
                return '';
            }
        },
        {
            id: 'Storage',
            validate: (value) => {
                value = sanitizeInput(value);
                if (!value) return 'Storage is required.';
                const wordCount = value.trim().split(/\s+/).length;
                if (wordCount < 2) return 'Storage must contain at least 2 words.';
                return '';
            }
        },
        {
            id: 'display',
            validate: (value) => {
                value = sanitizeInput(value);
                if (!value) return 'Display is required.';
                const wordCount = value.trim().split(/\s+/).length;
                if (wordCount < 2) return 'Display must contain at least 2 words.';
                return '';
            }
        },
        {
            id: 'operatingSystem',
            validate: (value) => {
                value = sanitizeInput(value);
                if (!value) return 'Operating system is required.';
                const wordCount = value.trim().split(/\s+/).length;
                if (wordCount < 2) return 'Operating system must contain at least 2 words.';
                return '';
            }
        },
        {
            id: 'Battery',
            validate: (value) => {
                value = sanitizeInput(value);
                if (!value) return 'Battery is required.';
                const wordCount = value.trim().split(/\s+/).length;
                if (wordCount < 2) return 'Battery must contain at least 2 words.';
                return '';
            }
        },
        {
            id: 'Weight',
            validate: (value) => {
                value = sanitizeInput(value);
                if (!value) return 'Weight is required.';
                const wordCount = value.trim().split(/\s+/).length;
                if (wordCount < 2) return 'Weight must contain at least 2 words.';
                return '';
            }
        },
        {
            id: 'Warranty',
            validate: (value) => {
                value = sanitizeInput(value);
                if (!value) return 'Warranty is required.';
                const wordCount = value.trim().split(/\s+/).length;
                if (wordCount < 2) return 'Warranty must contain at least 2 words.';
                return '';
            }
        },
        {
            id: 'additionalFeatures',
            validate: (value) => {
                value = sanitizeInput(value);
                if (value && value.trim().split(/\s+/).length < 2) return 'Additional features must contain at least 2 words.';
                return '';
            }
        }
    ];

    // Validate all fields
    fields.forEach(field => {
        const element = document.getElementById(field.id);
        if (!element) {
            console.error(`Field element not found for ID: ${field.id}`);
            isValid = false;
            return;
        }
        const value = element.value.trim();
        const errorMessage = field.validate(value);
        if (errorMessage) {
            console.log(`Validation error for ${field.id}: ${errorMessage}`);
            displayErrorMessage(field.id, errorMessage);
            element.classList.add('is-invalid');
            if (!firstInvalidField) firstInvalidField = element;
            isValid = false;
        }
    });

    // Validate sale price <= regular price
    const regularPrice = parseFloat(document.getElementById('regularPrice').value);
    const salePrice = parseFloat(document.getElementById('salePrice').value);
    if (!isNaN(regularPrice) && !isNaN(salePrice) && salePrice > regularPrice) {
        console.log('Sale price validation error');
        displayErrorMessage('salePrice', 'Offer price must be less than or equal to regular price.');
        document.getElementById('salePrice').classList.add('is-invalid');
        if (!firstInvalidField) firstInvalidField = document.getElementById('salePrice');
        isValid = false;
    }

    // Validate images
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const fileInput = document.getElementById('images');
    if (!fileInput) {
        console.error('Image input not found for ID: images');
        isValid = false;
    } else {
        const files = fileInput.files;
        if (files.length > 4) {
            console.log('Image validation error: Too many images');
            displayErrorMessage('images', 'You can upload up to 4 images.');
            fileInput.classList.add('is-invalid');
            if (!firstInvalidField) firstInvalidField = fileInput;
            isValid = false;
        } else if (croppedBlobs.length === 0) {
            console.log('Image validation error: No cropped images');
            displayErrorMessage('images', 'Please upload and crop at least one image.');
            fileInput.classList.add('is-invalid');
            if (!firstInvalidField) firstInvalidField = fileInput;
            isValid = false;
        } else {
            croppedBlobs.forEach((blob, index) => {
                if (!allowedTypes.includes(blob.type)) {
                    console.log(`Image ${index + 1} validation error: Invalid том type`);
                    displayErrorMessage('images', 'Only JPEG, PNG, or WebP images are allowed.');
                    fileInput.classList.add('is-invalid');
                    if (!firstInvalidField) firstInvalidField = fileInput;
                    isValid = false;
                } else if (blob.size > 5 * 1024 * 1024) {
                    console.log(`Image ${index + 1} validation error: File too large`);
                    displayErrorMessage('images', 'Each image must be less than 5MB.');
                    fileInput.classList.add('is-invalid');
                    if (!firstInvalidField) firstInvalidField = fileInput;
                    isValid = false;
                }
            });
        }
    }

    console.log(`Validation complete, isValid: ${isValid}`);
    return isValid;
}

function displayErrorMessage(id, message) {
    const errorElement = document.getElementById(`${id}-error`);
    if (errorElement) {
        console.log(`Displaying error for ${id}: ${message}`);
        errorElement.textContent = message;
        errorElement.classList.add('active');
        errorElement.style.display = 'block';
    } else {
        console.error(`Error element not found for ID: ${id}-error`);
    }
}

function clearErrorMessage(id) {
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
    console.log('Clearing all error messages');
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

function previewImages(event) {
    const input = event.target;
    const previewsContainer = document.getElementById('image-previews');
    previewsContainer.innerHTML = '';
    croppedImages = [];
    croppedBlobs = [];
    originalImages = {};
    Object.keys(croppers).forEach(index => {
        if (croppers[index]) croppers[index].destroy();
    });
    croppers = {};

    clearErrorMessage('images');

    if (input.files && input.files.length > 0) {
        const files = Array.from(input.files).slice(0, 4); // Limit to 4 images
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];

        files.forEach((file, index) => {
            if (!allowedTypes.includes(file.type)) {
                displayErrorMessage('images', 'Only JPEG, PNG, or WebP images are allowed.');
                input.classList.add('is-invalid');
                return;
            }
            if (file.size > 5 * 1024 * 1024) {
                displayErrorMessage('images', 'Each image must be less than 5MB.');
                input.classList.add('is-invalid');
                return;
            }

            const reader = new FileReader();
            reader.onload = function (e) {
                const imageIndex = index + 1;
                originalImages[imageIndex] = e.target.result;

                const imageContainer = document.createElement('div');
                imageContainer.className = 'form-group image-item';
                imageContainer.id = `imageContainer${imageIndex}`;
                imageContainer.innerHTML = `
                    <h5 class="text-white">Image ${imageIndex}</h5>
                    <div class="cropper-container" id="cropperContainer${imageIndex}">
                        <div class="cropper-wrapper">
                            <img id="cropperImg${imageIndex}" src="${e.target.result}" alt="Image to crop">
                        </div>
                        <div class="aspect-ratio-controls">
                            <span class="text-white me-2">Aspect Ratio:</span>
                            <button type="button" class="aspect-ratio-btn active" data-index="${imageIndex}" data-ratio="free" onclick="setAspectRatio(${imageIndex}, 'free')">Free</button>
                            <button type="button" class="aspect-ratio-btn" data-index="${imageIndex}" data-ratio="30/37" onclick="setAspectRatio(${imageIndex}, 30/37)">Fit image</button>
                        </div>
                        <div class="cropper-controls">
                            <button type="button" class="btn btn-primary" onclick="cropImage(${imageIndex})"><i class="fas fa-check"></i> Apply Crop</button>
                            <button type="button" class="btn btn-secondary" onclick="cancelCrop(${imageIndex})"><i class="fas fa-times"></i> Cancel</button>
                        </div>
                    </div>
                    <div class="crop-result-container" id="previewContainer${imageIndex}" style="display: none;">
                        <h5 class="text-white">Final Image</h5>
                        <img id="preview${imageIndex}" src="#" alt="Image preview" class="image-preview">
                        <button type="button" class="btn btn-outline-light btn-sm mt-2" onclick="recropImage(${imageIndex})"><i class="fas fa-crop-alt"></i> Re-crop Image</button>
                    </div>
                `;
                previewsContainer.appendChild(imageContainer);

                croppers[imageIndex] = new Cropper(document.getElementById(`cropperImg${imageIndex}`), {
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
                    aspectRatio: NaN,
                    crop: function (event) {}
                });

                setActiveAspectRatioButton(imageIndex, 'free');
            };
            reader.readAsDataURL(file);
        });
    }
}

function setAspectRatio(index, ratio) {
    if (croppers[index]) {
        if (ratio === 'free') {
            croppers[index].setAspectRatio(NaN);
        } else {
            croppers[index].setAspectRatio(ratio);
        }
        setActiveAspectRatioButton(index, ratio);
    }
}

function setActiveAspectRatioButton(index, ratio) {
    const ratioButtons = document.querySelectorAll(`.aspect-ratio-btn[data-index="${index}"]`);
    ratioButtons.forEach(button => button.classList.remove('active'));
    const activeButton = document.querySelector(`.aspect-ratio-btn[data-index="${index}"][data-ratio="${ratio}"]`);
    if (activeButton) activeButton.classList.add('active');
}

function recropImage(index) {
    const previewContainer = document.getElementById(`previewContainer${index}`);
    const cropperContainer = document.getElementById(`cropperContainer${index}`);
    const cropperImg = document.getElementById(`cropperImg${index}`);

    if (originalImages[index]) {
        cropperImg.src = originalImages[index];
        if (croppers[index]) croppers[index].destroy();
        croppers[index] = new Cropper(cropperImg, {
            viewMode: 1,
            dragMode: 'crop',
            responsive: true,
            background: true,
            autoCropArea: 0.8,
            movable: true,
            rotatable: false,
            scalablepack: true,
            zoomable: true,
            guides: true,
            aspectRatio: NaN,
            ready: function () { this.cropper.crop(); }
        });
        setActiveAspectRatioButton(index, 'free');
        cropperContainer.style.display = 'block';
        previewContainer.style.display = 'none';
        croppedImages[index - 1] = false;
        croppedBlobs[index - 1] = null;
    }
}

function cropImage(index) {
    const cropper = croppers[index];
    const preview = document.getElementById(`preview${index}`);
    const cropperContainer = document.getElementById(`cropperContainer${index}`);
    const previewContainer = document.getElementById(`previewContainer${index}`);

    if (cropper) {
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

        const fileInput = document.getElementById('images');
        const files = Array.from(fileInput.files).slice(0, 4);
        const file = files[index - 1];
        const mimeType = file.type;

        preview.src = croppedCanvas.toDataURL(mimeType);
        previewContainer.style.display = 'block';

        croppedCanvas.toBlob((blob) => {
            croppedImages[index - 1] = true;
            croppedBlobs[index - 1] = blob;
            clearErrorMessage('images');
        }, mimeType, 0.9);

        cropperContainer.style.display = 'none';
    }
}

function cancelCrop(index) {
    const cropperContainer = document.getElementById(`cropperContainer${index}`);
    const previewContainer = document.getElementById(`previewContainer${index}`);
    const imageContainer = document.getElementById(`imageContainer${index}`);
    if (croppers[index]) {
        croppers[index].destroy();
        delete croppers[index];
    }
    imageContainer.remove();
    croppedImages[index - 1] = false;
    croppedBlobs[index - 1] = null;

    const fileInput = document.getElementById('images');
    const files = Array.from(fileInput.files).slice(0, 4);
    if (files.length > 0) {
        const dataTransfer = new DataTransfer();
        files.forEach((file, i) => {
            if (i !== index - 1) dataTransfer.items.add(file);
        });
        fileInput.files = dataTransfer.files;
        previewImages({ target: fileInput });
    } else {
        fileInput.value = '';
    }
}