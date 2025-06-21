let cropper = null;
let currentImageIndex = -1;
let isRecropping = false;
let originalImages = [];
let croppedImages = [];
let existingImages = [];
const minImages = 2; 
const maxImages = 5; 
const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];


<% if (product && product.productImage && product.productImage.length > 0) { %>
    existingImages = <%- JSON.stringify(product.productImage) %>;
    existingImages.forEach((imageUrl, index) => {
        croppedImages[index] = { dataUrl: imageUrl };
    });
<% } %>

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
    const newFiles = Array.from(files).filter(file => {
        if (!allowedTypes.includes(file.type)) {
            Swal.fire({ icon: 'error', title: 'Invalid File', text: `${file.name} is not a supported image type.` });
            return false;
        }
        if (file.size > 5 * 1024 * 1024) {
            Swal.fire({ icon: 'error', title: 'File Too Large', text: `${file.name} exceeds 5MB.` });
            return false;
        }
        return true;
    });
}
    originalImages = [];
    newFiles.forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
            originalImages.push({ file, dataUrl: e.target.result });
            if (originalImages.length === newFiles.length) {
                startCrop(0);
            }
        };
        reader.readAsDataURL(file);
    });


    function updatePreview() {
        const previewContainer = document.getElementById('imagePreviewContainer');
        previewContainer.innerHTML = '';
        const productId = document.getElementById('proID').value;
    
        if (croppedImages.length > 0) {
            // Main Image (First Image)
            const mainImageContainer = document.createElement('div');
            mainImageContainer.className = 'main-image-container';
            const mainImageDiv = document.createElement('div');
            mainImageDiv.className = 'main-image-preview';
            mainImageDiv.innerHTML = `
                <img src="${croppedImages[0].dataUrl}" alt="Main Preview">
                <div class="preview-controls">
                    <button type="button" class="recrop-btn" onclick="recropImage(0)" title="Recrop"><i class="fas fa-crop-alt"></i></button>
                    <button type="button" class="remove-btn" onclick="removeImage('${productId}', 0)" title="Remove"><i class="fas fa-trash"></i></button>
                </div>
            `;
            mainImageContainer.appendChild(mainImageDiv);
            previewContainer.appendChild(mainImageContainer);
    
            // Secondary Images (2nd, 3rd, 4th, etc.)
            if (croppedImages.length > 1) {
                const secondaryImagesDiv = document.createElement('div');
                secondaryImagesDiv.className = 'secondary-images';
                croppedImages.slice(1).forEach((img, index) => {
                    const actualIndex = index + 1; // Adjust index for secondary images
                    const secondaryImageDiv = document.createElement('div');
                    secondaryImageDiv.className = 'secondary-image-preview';
                    secondaryImageDiv.innerHTML = `
                        <img src="${img.dataUrl}" alt="Secondary Preview ${actualIndex}">
                        <div class="preview-controls">
                            <button type="button" class="recrop-btn" onclick="recropImage(${actualIndex})" title="Recrop"><i class="fas fa-crop-alt"></i></button>
                            <button type="button" class="remove-btn" onclick="removeImage('${productId}', ${actualIndex})" title="Remove"><i class="fas fa-trash"></i></button>
                        </div>
                    `;
                    secondaryImagesDiv.appendChild(secondaryImageDiv);
                });
                previewContainer.appendChild(secondaryImagesDiv);
            }
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
    if (!croppedImages[index]) return;
    originalImages = [{ dataUrl: croppedImages[index].dataUrl, file: null }];
    currentImageIndex = 0;
    isRecropping = true;
    startCrop(0);
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

    const mimeType = originalImages[currentImageIndex].file ? originalImages[currentImageIndex].file.type : 'image/jpeg';
    const extension = mimeType.split('/')[1];

    croppedCanvas.toBlob((blob) => {
        const croppedFile = new File([blob], `cropped_image_${currentImageIndex}.${extension}`, {
            type: mimeType,
            lastModified: Date.now()
        });
        if (isRecropping) {
            croppedImages[currentImageIndex] = {
                file: croppedFile,
                dataUrl: croppedCanvas.toDataURL(mimeType)
            };
        } else {
            croppedImages.push({
                file: croppedFile,
                dataUrl: croppedCanvas.toDataURL(mimeType)
            });
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

function cancelCrop() {
    if (cropper) {
        cropper.destroy();
        cropper = null;
    }
    document.getElementById('cropperContainer').style.display = 'none';
    if (!isRecropping) {
        originalImages = [];
    }
    updatePreview();
    updateFormFiles();
    isRecropping = false;
}

function removePreviewImage(index) {
    Swal.fire({
        title: "Are you sure?",
        text: "This image will be removed from the preview!",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#d33",
        cancelButtonColor: "#3085d6",
        confirmButtonText: "Yes, remove it!"
    }).then((result) => {
        if (result.isConfirmed) {
            croppedImages.splice(index, 1);
            updatePreview();
            updateFormFiles();
            if (croppedImages.length < minImages) {
                displayErrorMessage('images', `Please upload at least ${minImages} images.`);
            }
            Swal.fire({
                icon: 'success',
                title: 'Image removed from preview!',
                showConfirmButton: false,
                timer: 1500
            });
        }
    });
}

function updateFormFiles() {
    const dataTransfer = new DataTransfer();
    croppedImages.forEach(img => {
        if (img.file) {
            dataTransfer.items.add(img.file);
        }
    });
    imageInput.files = dataTransfer.files;
}

async function removeImage(productId, imageIndex) {
    if (!Number.isInteger(imageIndex) || imageIndex < 0 || imageIndex >= croppedImages.length) {
        Swal.fire({
            icon: 'error',
            title: 'Invalid Index',
            text: 'The image index is invalid.'
        });
        return;
    }
       Swal.fire({
                title: 'Processing...',
                text: 'Adding your product',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });

            

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
            try {
                const response = await fetch(`/admin/remove-product-image/${productId}/${imageIndex}`, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                    }
                });

                const data = await response.json();
                if (data.success) {
                    croppedImages.splice(imageIndex, 1);
                    existingImages.splice(imageIndex, 1);
                    updatePreview();
                    updateFormFiles();
                    Swal.fire({
                        icon: 'success',
                        title: 'Image removed successfully!',
                        showConfirmButton: false,
                        timer: 1500
                    });
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: 'Oops...',
                        text: data.message || 'Failed to remove the image!'
                    });
                }
            } catch (error) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error!',
                    text: 'An error occurred while removing the image: ' + error.message
                });
            }
        }
    });
}

document.addEventListener('DOMContentLoaded', function () {
    // Initial preview of existing images
    updatePreview();

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
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'An unexpected error occurred. Please try again.',
            });
        }
    });
});

function validateForm() {
    clearErrorMessages();
    const productName = document.getElementById('productName').value;
    const description = document.getElementById('description').value;
    const salePrice = document.getElementById('offerAmount').value;
    const quantity = document.getElementById('stockCount').value;
    const brand = document.getElementById('brandId').value;
    const category = document.getElementById('categoryId').value;
    const processor = document.getElementById('processor').value;
    const graphicsCard = document.getElementById('gpu').value;
    const ram = document.getElementById('ram').value;
    const Storage = document.getElementById('Storage').value;
    const display = document.getElementById('display').value;
    const operatingSystem = document.getElementById('operatingSystem').value;
    const Battery = document.getElementById('Battery').value;
    const Weight = document.getElementById('Weight').value;
    const Warranty = document.getElementById('Warranty').value;

    let isValid = true;

    if (productName.trim() === "") {
        displayErrorMessage('productName-error', 'Product name is required.');
        isValid = false;
    }

    if (description.trim() === "") {
        displayErrorMessage('description-error', 'Description is required.');
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
        displayErrorMessage('graphicsCard-error', 'Graphics card is required.');
        isValid = false;
    }

    if (ram.trim() === "") {
        displayErrorMessage('ram-error', 'RAM is required.');
        isValid = false;
    }

    if (Storage.trim() === "") {
        displayErrorMessage('Storage-error', 'Storage is required.');
        isValid = false;
    }

    if (display.trim() === "") {
        displayErrorMessage('display-error', 'Display is required.');
        isValid = false;
    }

    if (operatingSystem.trim() === "") {
        displayErrorMessage('operatingSystem-error', 'Operating system is required.');
        isValid = false;
    }

    if (Battery.trim() === "") {
        displayErrorMessage('Battery-error', 'Battery is required.');
        isValid = false;
    }

    if (Weight.trim() === "") {
        displayErrorMessage('Weight-error', 'Weight is required.');
        isValid = false;
    }

    if (Warranty.trim() === "") {
        displayErrorMessage('Warranty-error', 'Warranty is required.');
        isValid = false;
    }

    if (croppedImages.length < minImages) {
        displayErrorMessage('images-error', `Please upload at least ${minImages} images.`);
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
    const errorElements = document.getElementsByClassName('error-message');
    for (let i = 0; i < errorElements.length; i++) {
        errorElements[i].textContent = '';
        errorElements[i].style.display = 'none';
    }
}