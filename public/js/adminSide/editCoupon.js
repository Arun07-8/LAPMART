
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}

// Clear all errors and validation states
function clearErrors() {
    document.querySelectorAll('.validation-message').forEach(error => {
        error.textContent = '';
        error.style.display = 'none';
        error.classList.remove('checking');
    });
    document.querySelectorAll('.form-control').forEach(input => {
        input.classList.remove('is-invalid', 'is-valid');
        input.removeAttribute('aria-describedby');
    });
}

// Generic field validation
function validateField(fieldId, errorId, validationFn, errorMessage, emptyMessage) {
    const field = document.getElementById(fieldId);
    const error = document.getElementById(errorId);
    const value = field.value.trim();

    if (!value) {
        error.textContent = emptyMessage || `${fieldId.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())} is required`;
        error.style.display = 'block';
        field.classList.add('is-invalid');
        field.classList.remove('is-valid');
        field.setAttribute('aria-describedby', errorId);
        return false;
    }

    if (!validationFn(value)) {
        error.textContent = errorMessage;
        error.style.display = 'block';
        field.classList.add('is-invalid');
        field.classList.remove('is-valid');
        field.setAttribute('aria-describedby', errorId);
        return false;
    }

    error.textContent = '';
    error.style.display = 'none';
    field.classList.remove('is-invalid');
    field.classList.add('is-valid');
    field.removeAttribute('aria-describedby');
    return true;
}

// Coupon code validation
function validateCouponCode(code) {
    const regex = /^[A-Z0-9]{6,12}$/;
    return regex.test(code);
}

function validateCouponCodeField() {
    const field = document.getElementById('couponCode');
    const error = document.getElementById('couponCodeError');
    let value = field.value.trim().toUpperCase();
    // Remove any invalid characters (not A-Z or 0-9)
    value = value.replace(/[^A-Z0-9]/g, '');
    field.value = value;

    if (!value) {
        error.textContent = 'Coupon code is required';
        error.style.display = 'block';
        field.classList.add('is-invalid');
        field.classList.remove('is-valid');
        field.setAttribute('aria-describedby', 'couponCodeError');
        return false;
    }

    if (!validateCouponCode(value)) {
        error.textContent = 'Coupon code must be 6-12 uppercase letters or numbers only (e.g., WELCOME15)';
        error.style.display = 'block';
        field.classList.add('is-invalid');
        field.classList.remove('is-valid');
        field.setAttribute('aria-describedby', 'couponCodeError');
        return false;
    }

    error.textContent = '';
    error.style.display = 'none';
    field.classList.remove('is-invalid');
    field.classList.add('is-valid');
    field.removeAttribute('aria-describedby');
    return true;
}

// Price validation
function validatePrices() {
    const offerPrice = parseFloat(document.getElementById('offerPrice').value);
    const minPurchase = parseFloat(document.getElementById('minPurchase').value);
    const validationMessage = document.getElementById('validationMessage');
    const offerPriceError = document.getElementById('offerPriceError');
    const minPurchaseError = document.getElementById('minPurchaseError');
    const offerPriceInput = document.getElementById('offerPrice');
    const minPurchaseInput = document.getElementById('minPurchase');

    let isValid = true;
    let errors = [];

    // Validate offerPrice
    if (!document.getElementById('offerPrice').value || isNaN(offerPrice) || offerPrice <= 0) {
        offerPriceError.textContent = 'Discount amount is required and must be a valid number';
        offerPriceError.style.display = 'block';
        offerPriceInput.classList.add('is-invalid');
        offerPriceInput.classList.remove('is-valid');
        offerPriceInput.setAttribute('aria-describedby', 'offerPriceError');
        errors.push('Discount amount is required');
        isValid = false;
    } else if (offerPrice <= 1000) {
        offerPriceError.textContent = 'Discount amount must be greater than ₹1000';
        offerPriceError.style.display = 'block';
        offerPriceInput.classList.add('is-invalid');
        offerPriceInput.classList.remove('is-valid');
        offerPriceInput.setAttribute('aria-describedby', 'offerPriceError');
        errors.push('Discount amount must be greater than ₹1000');
        isValid = false;
    } else if (offerPrice > 100000) {
        offerPriceError.textContent = 'Discount amount cannot exceed ₹100,000';
        offerPriceError.style.display = 'block';
        offerPriceInput.classList.add('is-invalid');
        offerPriceInput.classList.remove('is-valid');
        offerPriceInput.setAttribute('aria-describedby', 'offerPriceError');
        errors.push('Discount amount cannot exceed ₹100,000');
        isValid = false;
    } else {
        offerPriceError.textContent = '';
        offerPriceError.style.display = 'none';
        offerPriceInput.classList.remove('is-invalid');
        offerPriceInput.classList.add('is-valid');
        offerPriceInput.removeAttribute('aria-describedby');
    }

    // Validate minPurchase
    if (!document.getElementById('minPurchase').value || isNaN(minPurchase) || minPurchase <= 0) {
        minPurchaseError.textContent = 'Minimum purchase amount is required and must be a valid number';
        minPurchaseError.style.display = 'block';
        minPurchaseInput.classList.add('is-invalid');
        minPurchaseInput.classList.remove('is-valid');
        minPurchaseInput.setAttribute('aria-describedby', 'minPurchaseError');
        errors.push('Minimum purchase amount is required');
        isValid = false;
    } else if (minPurchase <= 20000) {
        minPurchaseError.textContent = 'Minimum purchase amount must be greater than ₹20,000';
        minPurchaseError.style.display = 'block';
        minPurchaseInput.classList.add('is-invalid');
        minPurchaseInput.classList.remove('is-valid');
        minPurchaseInput.setAttribute('aria-describedby', 'minPurchaseError');
        errors.push('Minimum purchase amount must be greater than ₹20,000');
        isValid = false;
    } else if (minPurchase > 1000000) {
        minPurchaseError.textContent = 'Minimum purchase cannot exceed ₹1,000,000';
        minPurchaseError.style.display = 'block';
        minPurchaseInput.classList.add('is-invalid');
        minPurchaseInput.classList.remove('is-valid');
        minPurchaseInput.setAttribute('aria-describedby', 'minPurchaseError');
        errors.push('Minimum purchase cannot exceed ₹1,000,000');
        isValid = false;
    } else {
        minPurchaseError.textContent = '';
        minPurchaseError.style.display = 'none';
        minPurchaseInput.classList.remove('is-invalid');
        minPurchaseInput.classList.add('is-valid');
        minPurchaseInput.removeAttribute('aria-describedby');
    }

    // Validate 30% rule - only if both values are valid
    if (isValid && minPurchase > 0 && offerPrice > minPurchase * 0.3) {
        const maxAllowed = (minPurchase * 0.3).toFixed(2);
        validationMessage.textContent = `Discount amount cannot exceed 30% of minimum purchase (₹${maxAllowed})`;
        validationMessage.style.display = 'block';
        offerPriceInput.classList.add('is-invalid');
        offerPriceInput.classList.remove('is-valid');
        offerPriceInput.setAttribute('aria-describedby', 'validationMessage');
        errors.push('Discount amount cannot exceed 30% of minimum purchase');
        isValid = false;
    } else if (validationMessage) {
        validationMessage.textContent = '';
        validationMessage.style.display = 'none';
    }

    return { isValid, errors };
}

// Validate date format (DD/MM/YYYY)
function validateDateFormat(value) {
    const regex = /^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/(20\d{2})$/;
    if (!regex.test(value)) return false;

    const [day, month, year] = value.split('/').map(Number);
    const date = new Date(year, month - 1, day);
    return date.getDate() === day && date.getMonth() === month - 1 && date.getFullYear() === year;
}

// Initialize Flatpickr for createdDate
flatpickr('#createdDate', {
    dateFormat: 'd/m/Y',
    defaultDate: new Date(),
    minDate: 'today',
    maxDate: new Date().fp_incr(30),
    enableTime: false,
    allowInput: true,
    onChange: function(selectedDates, dateStr) {
        if (dateStr) {
            // Validate createdDate
            validateField(
                'createdDate',
                'createdDateError',
                value => {
                    if (!validateDateFormat(value)) return false;
                    const selectedDate = new Date(value.split('/').reverse().join('-'));
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const maxDate = new Date();
                    maxDate.setDate(maxDate.getDate() + 30);
                    maxDate.setHours(23, 59, 59, 999);
                    return selectedDate >= today && selectedDate <= maxDate;
                },
                'Created date must be today or within the next 30 days',
                'Created date is required'
            );

            // Update expiryDate minDate dynamically
            const expiryPicker = flatpickr('#expiryDate');
            const selectedCreatedDate = new Date(dateStr.split('/').reverse().join('-'));
            selectedCreatedDate.setDate(selectedCreatedDate.getDate() + 1);
            expiryPicker.set('minDate', selectedCreatedDate);

            // Trigger expiry date validation if a value exists
            const expiryField = document.getElementById('expiryDate');
            if (expiryField.value) {
                validateField(
                    'expiryDate',
                    'expiryDateError',
                    value => {
                        if (!validateDateFormat(value)) return false;
                        const createdDate = new Date(document.getElementById('createdDate').value.split('/').reverse().join('-'));
                        const expiryDate = new Date(value.split('/').reverse().join('-'));
                        return expiryDate > createdDate;
                    },
                    'Expiry date must be after created date',
                    'Expiry date is required'
                );
            }
        }
    }
});

// Initialize Flatpickr for expiryDate
flatpickr('#expiryDate', {
    dateFormat: 'd/m/Y',
    minDate: new Date().fp_incr(1),
    enableTime: false,
    allowInput: true,
    onChange: function(selectedDates, dateStr) {
        if (dateStr) {
            validateField(
                'expiryDate',
                'expiryDateError',
                value => {
                    if (!validateDateFormat(value)) return false;
                    const createdDate = new Date(document.getElementById('createdDate').value.split('/').reverse().join('-'));
                    const expiryDate = new Date(value.split('/').reverse().join('-'));
                    return expiryDate > createdDate;
                },
                'Expiry date must be after created date',
                'Expiry date is required'
            );
        }
    }
});

// Form submission validation
document.getElementById('couponForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    clearErrors();

    let isValid = true;
    let errors = new Set();

    // Validate coupon name
    if (!validateField(
        'couponName',
        'couponNameError',
        value => value.length >= 3 && value.length <= 50 && /^[A-Z0-9]+$/.test(value),
        'Coupon name must be 3-50 uppercase letters or numbers only (e.g., WELCOME15)',
        'Coupon name is required'
    )) {
        errors.add('Coupon name is invalid');
        isValid = false;
    }

    // Validate coupon code
    if (!validateCouponCodeField()) {
        errors.add('Coupon code is invalid');
        isValid = false;
    }

    // Validate description
    if (!validateField(
        'description',
        'descriptionError',
        value => value.length >= 10 && value.length <= 200,
        'Description must be 10-200 characters long',
        'Description is required'
    )) {
        errors.add('Description is invalid');
        isValid = false;
    }

    // Validate created date
    if (!validateField(
        'createdDate',
        'createdDateError',
        value => {
            if (!validateDateFormat(value)) return false;
            const selectedDate = new Date(value.split('/').reverse().join('-'));
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const maxDate = new Date();
            maxDate.setDate(maxDate.getDate() + 30);
            maxDate.setHours(23, 59, 59, 999);
            return selectedDate >= today && selectedDate <= maxDate;
        },
        'Created date must be today or within the next 30 days',
        'Created date is required'
    )) {
        errors.add('Created date is invalid');
        isValid = false;
    }

    // Validate expiry date
    if (!validateField(
        'expiryDate',
        'expiryDateError',
        value => {
            if (!validateDateFormat(value)) return false;
            const createdDate = new Date(document.getElementById('createdDate').value.split('/').reverse().join('-'));
            const expiryDate = new Date(value.split('/').reverse().join('-'));
            return expiryDate > createdDate;
        },
        'Expiry date must be after created date',
        'Expiry date is required'
    )) {
        errors.add('Expiry date is invalid');
        isValid = false;
    }

    // Validate prices
    const priceValidation = validatePrices();
    if (!priceValidation.isValid) {
        priceValidation.errors.forEach(err => errors.add(err));
        isValid = false;
    }

    if (isValid) {
        const couponData = {
            couponName: document.getElementById('couponName').value.trim(),
            couponCode: document.getElementById('couponCode').value.trim().toUpperCase(),
            description: document.getElementById('description').value.trim(),
            validFrom: document.getElementById('createdDate').value,
            validUpto: document.getElementById('expiryDate').value,
            offerPrice: parseFloat(document.getElementById('offerPrice').value),
            minPurchase: parseFloat(document.getElementById('minPurchase').value)
        };

        const couponId = document.getElementById('couponID').value;
        const submitButton = document.querySelector('.btn-primary');
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Submitting...';

        try {
            const response = await fetch(`/admin/edit-coupon/${couponId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(couponData)
            });
            const data = await response.json();
            if (response.ok) {
                Swal.fire({
                    icon: 'success',
                    title: 'Success',
                    text: data.message || 'Coupon updated successfully!',
                    confirmButtonColor: '#6366f1'
                }).then(() => {
                    window.location.href = '/admin/coupon';
                });
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: data.message || 'Failed to update coupon. Please try again.',
                    confirmButtonColor: '#6366f1'
                });
            }
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'An unexpected error occurred. Please try again.',
                confirmButtonColor: '#6366f1'
            });
        } finally {
            submitButton.disabled = false;
            submitButton.innerHTML = '<i class="fas fa-plus me-2"></i>Update Coupon';
        }
    } else {
        Swal.fire({
            icon: 'error',
            title: 'Validation Error',
            html: `Please fix the following errors:<ul>${[...errors].map(err => `<li>${err}</li>`).join('')}</ul>`,
            confirmButtonColor: '#6366f1'
        });
    }
});

// Real-time validation for coupon name
document.getElementById('couponName').addEventListener('input', debounce(() => {
    const field = document.getElementById('couponName');
    field.value = field.value.replace(/[^A-Z0-9]/g, '').toUpperCase();
    validateField(
        'couponName',
        'couponNameError',
        value => value.length >= 3 && value.length <= 50 && /^[A-Z0-9]+$/.test(value),
        'Coupon name must be 3-50 uppercase letters or numbers only (e.g., WELCOME15)',
        'Coupon name is required'
    );
}, 300));

// Real-time validation for coupon code
document.getElementById('couponCode').addEventListener('input', debounce(() => {
    validateCouponCodeField();
}, 300));

// Real-time validation for description
document.getElementById('description').addEventListener('input', debounce(() => {
    validateField(
        'description',
        'descriptionError',
        value => value.length >= 10 && value.length <= 200,
        'Description must be 10-200 characters long',
        'Description is required'
    );
}, 300));

// Real-time validation for prices
document.getElementById('offerPrice').addEventListener('input', debounce(() => {
    validatePrices();
}, 300));

document.getElementById('minPurchase').addEventListener('input', debounce(() => {
    validatePrices();
}, 300));

// Cancel button
function goBack() {
    Swal.fire({
        title: 'Are you sure?',
        text: 'Any unsaved changes will be lost.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#6366f1',
        cancelButtonColor: '#dc3545',
        confirmButtonText: 'Yes, cancel'
    }).then((result) => {
        if (result.isConfirmed) {
            window.location.href = '/admin/coupon';
        }
    });
}