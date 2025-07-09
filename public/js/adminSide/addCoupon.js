// Strong date validation
function validateDateFormat(dateStr, isCreatedDate = false) {
    const regex = /^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/(20\d{2})$/;
    if (!regex.test(dateStr)) return false;

    const [day, month, year] = dateStr.split('/').map(Number);
    const date = new Date(year, month - 1, day);

    if (
        date.getDate() !== day ||
        date.getMonth() !== month - 1 ||
        date.getFullYear() !== year
    ) {
        return false;
    }

    if (isCreatedDate) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return date >= today;
    }

    return true;
}

// Parse DD/MM/YYYY to Date object
function parseDate(dateStr) {
    const [day, month, year] = dateStr.split('/').map(Number);
    return new Date(year, month - 1, day);
}

// Coupon code validation (synchronous format check)
function validateCouponCodeFormat(code) {
    const regex = /^[A-Z0-9]{6,12}$/;
    return regex.test(code);
}

// Coupon code validation
function validateCouponCode(code, errorElement) {
    if (!code) {
        errorElement.textContent = 'Coupon code is required';
        errorElement.style.opacity = '1';
        return false;
    }

    const upperCode = code.toUpperCase();
    if (!validateCouponCodeFormat(upperCode)) {
        errorElement.textContent = 'Coupon code must be 6-12 uppercase letters or numbers';
        errorElement.style.opacity = '1';
        return false;
    }

    errorElement.style.opacity = '0';
    return true;
}

// Description validation
function validateDescription(desc) {
    return desc.length >= 10 && desc.length <= 200;
}

// Clear all errors and invalid states
function clearErrors() {
    document.querySelectorAll('.validation-message').forEach(error => {
        error.textContent = '';
        error.style.opacity = '0';
        error.classList.remove('checking');
    });
    document.querySelectorAll('.form-control').forEach(input => {
        input.classList.remove('is-invalid');
        input.removeAttribute('aria-describedby');
    });
}

// Validate field (for non-async validations)
function validateField(fieldId, errorId, validationFn, errorMessage) {
    const field = document.getElementById(fieldId);
    const error = document.getElementById(errorId);
    const value = field.value.trim();

    let isValid = true;
    let message = errorMessage;

    if (!value) {
        message = `${fieldId.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())} is required`;
        isValid = false;
    } else if (!validationFn(value)) {
        isValid = false;
    }

    if (!isValid) {
        error.textContent = message;
        error.style.opacity = '1';
        field.classList.add('is-invalid');
        field.setAttribute('aria-describedby', errorId);
    } else {
        error.textContent = '';
        error.style.opacity = '0';
        field.classList.remove('is-invalid');
        field.removeAttribute('aria-describedby');
    }

    return isValid;
}

// Validate coupon code field
function validateCouponCodeField() {
    const field = document.getElementById('couponCode');
    const error = document.getElementById('couponCodeError');
    const value = field.value.trim();

    const isValid = validateCouponCode(value, error);
    if (!isValid) {
        field.classList.add('is-invalid');
        field.setAttribute('aria-describedby', 'couponCodeError');
    } else {
        field.classList.remove('is-invalid');
        field.removeAttribute('aria-describedby');
        field.value = value.toUpperCase();
    }
    return isValid;
}

// Price validation
function validatePrices() {
    const offerPrice = parseFloat(document.getElementById('offerPrice').value) || 0;
    const minPurchase = parseFloat(document.getElementById('minPurchase').value) || 0;
    const validationMessage = document.getElementById('validationMessage');
    const offerPriceError = document.getElementById('offerPriceError');
    const minPurchaseError = document.getElementById('minPurchaseError');
    const offerPriceInput = document.getElementById('offerPrice');
    const minPurchaseInput = document.getElementById('minPurchase');

    let isValid = true;
    let errors = [];

    if (!offerPrice || isNaN(offerPrice)) {
        offerPriceError.textContent = 'Discount amount is required';
        offerPriceError.style.opacity = '1';
        offerPriceInput.classList.add('is-invalid');
        offerPriceInput.setAttribute('aria-describedby', 'offerPriceError');
        errors.push('Discount amount is required');
        isValid = false;
    } else if (offerPrice <= 1000) {
        offerPriceError.textContent = 'Discount amount must be greater than ₹1000';
        offerPriceError.style.opacity = '1';
        offerPriceInput.classList.add('is-invalid');
        offerPriceInput.setAttribute('aria-describedby', 'offerPriceError');
        errors.push('Discount amount must be greater than ₹1000');
        isValid = false;
    } else if (offerPrice > 10000) {
        offerPriceError.textContent = 'Discount amount cannot exceed ₹100,000';
        offerPriceError.style.opacity = '1';
        offerPriceInput.classList.add('is-invalid');
        offerPriceInput.setAttribute('aria-describedby', 'offerPriceError');
        errors.push('Discount amount cannot exceed ₹100,000');
        isValid = false;
    } else {
        offerPriceError.textContent = '';
        offerPriceError.style.opacity = '0';
        offerPriceInput.classList.remove('is-invalid');
        offerPriceInput.removeAttribute('aria-describedby');
    }

    if (!minPurchase || isNaN(minPurchase)) {
        minPurchaseError.textContent = 'Minimum purchase amount is required';
        minPurchaseError.style.opacity = '1';
        minPurchaseInput.classList.add('is-invalid');
        minPurchaseInput.setAttribute('aria-describedby', 'minPurchaseError');
        errors.push('Minimum purchase amount is required');
        isValid = false;
    } else if (minPurchase <= 20000) {
        minPurchaseError.textContent = 'Minimum purchase amount must be greater than ₹20,000';
        minPurchaseError.style.opacity = '1';
        minPurchaseInput.classList.add('is-invalid');
        minPurchaseInput.setAttribute('aria-describedby', 'minPurchaseError');
        errors.push('Minimum purchase amount must be greater than ₹20,000');
        isValid = false;
    } else if (minPurchase > 1000000) {
        minPurchaseError.textContent = 'Minimum purchase cannot exceed ₹1,000,000';
        minPurchaseError.style.opacity = '1';
        minPurchaseInput.classList.add('is-invalid');
        minPurchaseInput.setAttribute('aria-describedby', 'minPurchaseError');
        errors.push('Minimum purchase cannot exceed ₹1,000,000');
        isValid = false;
    } else {
        minPurchaseError.textContent = '';
        minPurchaseError.style.opacity = '0';
        minPurchaseInput.classList.remove('is-invalid');
        minPurchaseInput.removeAttribute('aria-describedby');
    }

    if (minPurchase > 0 && offerPrice > minPurchase * 0.3) {
        validationMessage.textContent = `Discount amount cannot exceed 30% of minimum purchase (₹${(minPurchase * 0.3).toFixed(2)})`;
        validationMessage.style.opacity = '1';
        offerPriceInput.classList.add('is-invalid');
        minPurchaseInput.classList.add('is-invalid');
        offerPriceInput.setAttribute('aria-describedby', 'validationMessage');
        minPurchaseInput.setAttribute('aria-describedby', 'validationMessage');
        errors.push(`Discount amount cannot exceed 30% of minimum purchase`);
        isValid = false;
    } else {
        validationMessage.textContent = '';
        validationMessage.style.opacity = '0';
    }

    return { isValid, errors };
}

// Initialize Flatpickr for date inputs
flatpickr('#createdDate', {
    dateFormat: 'd/m/Y',
    minDate: 'today',
    enableTime: false,
    allowInput: true,
    onClose: function(selectedDates, dateStr, instance) {
        validateField(
            'createdDate',
            'createdDateError',
            value => validateDateFormat(value, true),
            'Please enter a valid date (DD/MM/YYYY) on or after today'
        );
    }
});

flatpickr('#expiryDate', {
    dateFormat: 'd/m/Y',
    minDate: new Date().fp_incr(1),
    enableTime: false,
    allowInput: true,
    onClose: function(selectedDates, dateStr, instance) {
        validateField(
            'expiryDate',
            'expiryDateError',
            value => {
                if (!validateDateFormat(value)) return false;
                const createdDateStr = document.getElementById('createdDate').value;
                if (!validateDateFormat(createdDateStr, true)) return false;
                const createdDate = parseDate(createdDateStr);
                const expiryDate = parseDate(value);
                return expiryDate > createdDate;
            },
            'Expiry date must be valid and after created date'
        );
    }
});

// Debounce function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Form validation and submission
document.getElementById('couponForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    if (Swal.isVisible()) return;
    clearErrors();

    let isValid = true;
    let errors = [];

    const couponNameValid = validateField(
        'couponName',
        'couponNameError',
        value => value.length >= 3 && value.length <= 50 && /^[A-Za-z0-9\s]+$/.test(value),
        'Coupon name must be 3-50 alphanumeric characters'
    );
    if (!couponNameValid) errors.push('Coupon name is invalid');

    const couponCodeValid = validateCouponCodeField();
    if (!couponCodeValid) errors.push('Coupon code is invalid');

    const descriptionValid = validateField(
        'description',
        'descriptionError',
        validateDescription,
        'Description must be 10-200 characters long'
    );
    if (!descriptionValid) errors.push('Description is invalid');

    const createdDateValid = validateField(
        'createdDate',
        'createdDateError',
        value => validateDateFormat(value, true),
        'Please enter a valid date (DD/MM/YYYY) on or after today'
    );
    if (!createdDateValid) errors.push('Created date is invalid');

    const expiryDateValid = validateField(
        'expiryDate',
        'expiryDateError',
        value => {
            if (!validateDateFormat(value)) return false;
            const createdDateStr = document.getElementById('createdDate').value;
            if (!validateDateFormat(createdDateStr, true)) return false;
            const createdDate = parseDate(createdDateStr);
            const expiryDate = parseDate(value);
            return expiryDate > createdDate;
        },
        'Expiry date must be valid and after created date'
    );
    if (!expiryDateValid) errors.push('Expiry date is invalid');

    const priceValidation = validatePrices();
    if (!priceValidation.isValid) {
        errors = errors.concat(priceValidation.errors);
    }

    isValid = couponNameValid && couponCodeValid && descriptionValid && createdDateValid && expiryDateValid && priceValidation.isValid;

    if (isValid) {
        const couponData = {
            couponName: document.getElementById('couponName').value.trim(),
            couponCode: document.getElementById('couponCode').value.trim().toUpperCase(),
            description: document.getElementById('description').value.trim(),
            createdDate: document.getElementById('createdDate').value,
            expiryDate: document.getElementById('expiryDate').value,
            offerPrice: parseFloat(document.getElementById('offerPrice').value),
            minPurchase: parseFloat(document.getElementById('minPurchase').value)
        };

        try {
            const response = await fetch('/admin/addcoupon', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(couponData)
            });
            const data = await response.json();
            if (response.ok) {
                Swal.fire({
                    icon: 'success',
                    title: 'Success',
                    text: data.message || 'Coupon added successfully!',
                    confirmButtonColor: '#6366f1'
                }).then(() => {
                    clearErrors();
                    window.location.href = "/admin/coupon";
                });
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: data.message || 'Failed to add coupon. Please try again.',
                    confirmButtonColor: '#6366f1'
                });
            }
        } catch (error) {
            console.error('Error submitting coupon:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'An error occurred. Please try again.',
                confirmButtonColor: '#6366f1'
            });
        }
    } else {
        Swal.fire({
            icon: 'error',
            title: 'Validation Error',
            html: `Please fix the following errors:<ul>${errors.map(err => `<li>${err}</li>`).join('')}</ul>`,
            confirmButtonColor: '#6366f1'
        });
    }
});

// Real-time validation events
document.getElementById('couponName').addEventListener('input', debounce(() => {
    validateField(
        'couponName',
        'couponNameError',
        value => value.length >= 3 && value.length <= 50 && /^[A-Za-z0-9\s]+$/.test(value),
        'Coupon name must be 3-50 alphanumeric characters'
    );
}, 300));

document.getElementById('couponCode').addEventListener('input', debounce(() => {
    const field = document.getElementById('couponCode');
    field.value = field.value.toUpperCase();
    validateCouponCodeField();
}, 500));

document.getElementById('description').addEventListener('input', debounce(() => {
    validateField(
        'description',
        'descriptionError',
        validateDescription,
        'Description must be 10-200 characters long'
    );
}, 300));

document.getElementById('offerPrice').addEventListener('input', debounce(() => {
    validatePrices();
}, 300));

document.getElementById('minPurchase').addEventListener('input', debounce(() => {
    validatePrices();
}, 300));

['createdDate', 'expiryDate'].forEach(id => {
    const input = document.getElementById(id);
    input.addEventListener('input', function(e) {
        let value = e.target.value.replace(/[^0-9/]/g, '');
        if (value.length === 2 || value.length === 5) {
            value += '/';
        }
        e.target.value = value.slice(0, 10);
        if (value.length === 10) {
            validateField(
                id,
                `${id}Error`,
                value => validateDateFormat(value, id === 'createdDate'),
                id === 'createdDate'
                    ? 'Please enter a valid date (DD/MM/YYYY) on or after today'
                    : 'Please enter a valid date (DD/MM/YYYY)'
            );
        } else {
            document.getElementById(`${id}Error`).style.opacity = '0';
            document.getElementById(id).classList.remove('is-invalid');
            document.getElementById(id).removeAttribute('aria-describedby');
        }
    });
});

function goBack() {
    Swal.fire({
        title: 'Are you sure?',
        text: 'Any unsaved changes will be lost.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#6366f1',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Yes, cancel'
    }).then((result) => {
        if (result.isConfirmed) {
            window.history.back();
        }
    });
}