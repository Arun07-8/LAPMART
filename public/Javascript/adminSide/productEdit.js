let croppers = {};
let originalImages = {};
let hasImage = `<%= product && product.productImage && product.productImage.length > 0 ? 'true' : 'false' %>`;

document.addEventListener('DOMContentLoaded', function () {
    for (let i = 1; i <= 4; i++) {
        document.getElementById(`image${i}`).addEventListener('change', function (event) {
            previewImage(event, i);
        });
    }

    document.getElementById('editProductForm').addEventListener('submit', async function (event) {
        event.preventDefault();

        if (!validateForm()) {
            Swal.fire({
                icon: 'error',
                title: 'Validation Error',
                text: 'Please correct the errors in the form before submitting.',
            });
            return;
        }

               
        Swal.fire({
            title: 'Processing...',
            text: 'Editing your product',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });
        const productId = document.getElementById("proID").value;
        const form = document.getElementById('editProductForm');
        const formData = new FormData(form);

        try {
            const response = await fetch(`/admin/editProduct/${productId}`, {
                method: 'POST',
                body: formData  
            });
          

            const result = await response.json();
            console.log('Response data:', result);

            if (response.ok) {
                Swal.fire({
                    icon: 'success',
                    title: 'Success',
                    text: result.message || 'Product updated successfully!',
                    timer: 1500,
                    showConfirmButton: false
                }).then(() => {
                    window.location.href = '/admin/products';
                });
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: result.message || 'Failed to update product.',
                });
            }
        } catch (error) {
            console.error('Form submission error:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'An unexpected error occurred. Please try again.',
            });
        }
    });
});

async function removeImage(productId, imageIndex) {
    // Validate imageIndex
    if (!Number.isInteger(imageIndex) || imageIndex < 0 || imageIndex > 5) {
        Swal.fire({
            icon: 'error',
            title: 'Invalid Index',
            text: 'The image index is invalid.'
        });
        return;
    }

    Swal.fire({
        title: "Are you sure?",
        text: "This image will be permanently removed!",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#d33",
        cancelButtonColor: "#3085d6",
        confirmButtonText: "Yes, remove it!"
    }).then(async (result) => {
        if (result.isConfirmed) {
            const removeButton = document.querySelector(`#imageContainer${imageIndex + 1} .btn-danger`);
            if (removeButton) {
                removeButton.disabled = true;
                removeButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Removing...';
            }

            try {
                console.log('Sending request to remove image:', { productId, imageIndex });

                // Get authentication token (adjust based on your auth mechanism)
                const token = localStorage.getItem('adminToken') || ''; // Example: Retrieve token

                const response = await fetch(`/admin/remove-product-image/${productId}/${imageIndex}`, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}` // Include if adminAuth requires it
                    }
                });

                console.log('Response status:', response.status);

                // Check if response is JSON
                const contentType = response.headers.get('content-type');
                if (!contentType || !contentType.includes('application/json')) {
                    const text = await response.text();
                    console.error('Non-JSON response:', text);
                    throw new Error('Server returned a non-JSON response, likely an error page');
                }

                const data = await response.json();
                console.log('Response data:', data);

                if (data.success) {
                    const imageContainer = document.querySelector(`#imageContainer${imageIndex + 1} .existing-image-container`);
                    if (imageContainer) {
                        imageContainer.style.display = 'none';
                    }

                    const previewContainer = document.getElementById(`previewContainer${imageIndex + 1}`);
                    if (previewContainer) {
                        previewContainer.style.display = 'none';
                    }
                    document.getElementById(`preview${imageIndex + 1}`).src = '#';
                    document.getElementById(`image${imageIndex + 1}`).value = '';

                    hasImage = data.updatedImages.length > 0;

                    Swal.fire({
                        icon: 'success',
                        title: 'Image removed successfully!',
                        showConfirmButton: false,
                        timer: 1500
                    });
                } else {
                    console.error('Backend error:', data.message);
                    Swal.fire({
                        icon: 'error',
                        title: 'Oops...',
                        text: data.message || 'Failed to remove the image!'
                    });
                }
            } catch (error) {
                console.error('Error removing image:', error);
                Swal.fire({
                    icon: 'error',
                    title: 'Error!',
                    text: 'An error occurred while removing the image: ' + error.message
                });
            } finally {
                if (removeButton) {
                    removeButton.disabled = false;
                    removeButton.innerHTML = '<i class="fas fa-trash"></i> Remove';
                }
            }
        }
    });
}
function previewImage(event, index) {
    const input = event.target;
    const previewContainer = document.getElementById(`previewContainer${index}`);
    const cropperContainer = document.getElementById(`cropperContainer${index}`);
    const cropperImg = document.getElementById(`cropperImg${index}`);
    const existingImageContainer = document.querySelector(`#imageContainer${index} .existing-image-container`);

    if (input.files && input.files[0]) {
        const file = input.files[0];
        const validImageTypes = ['image/png', 'image/jpeg', 'image/webp'];
        
        if (!validImageTypes.includes(file.type)) {
            Swal.fire({
                icon: 'error',
                title: 'Invalid File Type',
                text: 'Please upload only PNG, JPEG, or WebP images.',
            });
            input.value = '';
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            Swal.fire({
                icon: 'error',
                title: 'File Too Large',
                text: 'Image size must be less than 5MB.',
            });
            input.value = '';
            return;
        }

        // Hide existing image if present
        if (existingImageContainer) {
            existingImageContainer.style.display = 'none';
        }

        const reader = new FileReader();
        reader.onload = function (e) {
            originalImages[index] = e.target.result;
            cropperImg.src = e.target.result;
            cropperContainer.style.display = 'block';
            previewContainer.style.display = 'none';

            if (croppers[index]) {
                croppers[index].destroy();
            }

            croppers[index] = new Cropper(cropperImg, {
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

            setActiveAspectRatioButton(index, 'free');
        };
        reader.readAsDataURL(file);
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
            scalable: true,
            zoomable: true,
            guides: true,
            aspectRatio: NaN,
            ready: function () { this.cropper.crop(); }
        });
        setActiveAspectRatioButton(index, 'free');
        cropperContainer.style.display = 'block';
        previewContainer.style.display = 'none';
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
                text: 'Cropped image must be at least 256x256 pixels.',
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
            imageSmoothingQuality: 'high',
        });

        // Determine file type based on original image
        const fileInput = document.getElementById(`image${index}`);
        const file = fileInput.files[0];
        const mimeType = file.type;
        const extension = mimeType.split('/')[1];

        preview.src = croppedCanvas.toDataURL(mimeType, 0.9);
        previewContainer.style.display = 'block';
        croppedCanvas.toBlob((blob) => {
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(new File([blob], `cropped_image_${index}.${extension}`, {
                type: mimeType,
                lastModified: Date.now()
            }));
            fileInput.files = dataTransfer.files;
            hasImage = true;
        }, mimeType, 0.9);
        cropperContainer.style.display = 'none';
    }
}

function cancelCrop(index) {
    const cropperContainer = document.getElementById(`cropperContainer${index}`);
    const previewContainer = document.getElementById(`previewContainer${index}`);
    if (croppers[index]) {
        croppers[index].destroy();
        delete croppers[index];
    }
    cropperContainer.style.display = 'none';
    previewContainer.style.display = 'none';
    document.getElementById(`image${index}`).value = '';
}

function validateForm() {
    clearErrorMessages();
    const productName = document.getElementById('productName').value;
    const description = document.getElementById('description').value;
    const regularPrice = document.getElementById('productAmount').value;
    const salePrice = document.getElementById('offerAmount').value;
    const quantity = document.getElementById('stockCount').value;
    const brand = document.getElementById('brandId').value;
    const category = document.getElementById('categoryId').value;
    const processor = document.getElementById('processor').value;
    const graphicsCard = document.getElementById('gpu').value;
    const ram = document.getElementById('ram').value;
    const Storage = document.getElementById('storage').value;
    const display = document.getElementById('display').value;
    const operatingSystem = document.getElementById('os').value;
    const Battery = document.getElementById('battery').value;
    const Weight = document.getElementById('weight').value;
    const Warranty = document.getElementById('warranty').value;

    let isValid = true;

    if (productName.trim() === "") {
        displayErrorMessage('productName-error', 'Product name is required.');
        isValid = false;
    }

    if (description.trim() === "") {
        displayErrorMessage('description-error', 'Description is required.');
        isValid = false;
    }

    if (regularPrice.trim() === "") {
        displayErrorMessage('regularPrice-error', 'Regular price is required.');
        isValid = false;
    }

    if (salePrice.trim() === "") {
        displayErrorMessage('offerPrice-error', 'Sale price is required.');
        isValid = false;
    }

    if (quantity.trim() === "") {
        displayErrorMessage('quantity-error', 'Stock count is required.');
        isValid = false;
    }

    if (brand.trim() === "") {
        displayErrorMessage('brandName-error', 'Brand is required.');
        isValid = false;
    }

    if (category.trim() === "") {
        displayErrorMessage('category-error', 'Category is required.');
        isValid = false;
    }

    if (processor.trim() === "") {
        displayErrorMessage('processor-error', 'Processor is required.');
        isValid = false;
    }

    if (graphicsCard.trim() === "") {
        displayErrorMessage('gpu-error', 'Graphics card is required.');
        isValid = false;
    }

    if (ram.trim() === "") {
        displayErrorMessage('ram-error', 'RAM is required.');
        isValid = false;
    }

    if (Storage.trim() === "") {
        displayErrorMessage('storage-error', 'Storage is required.');
        isValid = false;
    }

    if (display.trim() === "") {
        displayErrorMessage('display-error', 'Display is required.');
        isValid = false;
    }

    if (operatingSystem.trim() === "") {
        displayErrorMessage('os-error', 'Operating system is required.');
        isValid = false;
    }

    if (Battery.trim() === "") {
        displayErrorMessage('battery-error', 'Battery is required.');
        isValid = false;
    }

    if (Weight.trim() === "") {
        displayErrorMessage('weight-error', 'Weight is required.');
        isValid = false;
    }

    if (Warranty.trim() === "") {
        displayErrorMessage('warranty-error', 'Warranty is required.');
        isValid = false;
    }

    if (!hasImage) {
        displayErrorMessage('image1-error', 'At least one product image is required.');
        isValid = false;
    }

    return isValid;
}

function displayErrorMessage(elementId, message) {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.color = 'red';
        errorElement.style.display = 'block';
    }
}

function clearErrorMessages() {
    const errorElements = document.getElementsByClassName('error-message');
    for (let i = 0; i < errorElements.length; i++) {
        errorElements[i].textContent = '';
        errorElements[i].style.display = 'none';
    }
}