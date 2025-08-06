// Debounce function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}

// Utility: Clear all errors and validation states
function clearErrors() {
    document.querySelectorAll('.validation-message').forEach(error => {
        error.textContent = '';
        error.style.display = 'none';
        error.classList.remove('checking');
    });
    document.querySelectorAll('.form-control').forEach(input => {
        input.classList.remove('is-invalid', 'is-valid');
        input.removeAttribute('aria-describedby');
        input.setAttribute('aria-invalid', 'false');
    });
}

// Field validation
function validateField(fieldId, errorId, validationFn, errorMessage, emptyMessage = 'This field is required') {
    const field = document.getElementById(fieldId);
    const error = document.getElementById(errorId);
    if (!field || !error) {
        console.error(`Element not found: ${fieldId} or ${errorId}`);
        return false;
    }
    const value = field.value.trim();
    if (!value) {
        error.textContent = emptyMessage;
        error.style.display = 'block';
        field.classList.add('is-invalid');
        field.classList.remove('is-valid');
        field.setAttribute('aria-describedby', errorId);
        field.setAttribute('aria-invalid', 'true');
        return false;
    }
    if (!validationFn(value)) {
        error.textContent = errorMessage;
        error.style.display = 'block';
        field.classList.add('is-invalid');
        field.classList.remove('is-valid');
        field.setAttribute('aria-describedby', errorId);
        field.setAttribute('aria-invalid', 'true');
        return false;
    }
    error.textContent = '';
    error.style.display = 'none';
    field.classList.remove('is-invalid');
    field.classList.add('is-valid');
    field.setAttribute('aria-invalid', 'false');
    field.removeAttribute('aria-describedby');
    return true;
}

// Date utilities
function isValidDate(dateString) {
    const regex = /^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/(20\d{2})$/;
    if (!regex.test(dateString)) return false;
    const [, day, month, year] = regex.exec(dateString);
    const date = new Date(year, month - 1, day);
    return date.getFullYear() == year && date.getMonth() == month - 1 && date.getDate() == day;
}

function parseDate(dateString) {
    const [day, month, year] = dateString.split('/');
    return new Date(year, month - 1, day);
}

function formatDateForInput(dateStr) {
    if (!dateStr) return '';
    let date;
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        date = new Date(dateStr);
    } else if (isValidDate(dateStr)) {
        date = parseDate(dateStr);
    } else {
        date = new Date(dateStr);
    }
    if (isNaN(date.getTime())) return '';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

function formatDateForServer(dateStr) {
    if (!isValidDate(dateStr)) return '';
    return dateStr.split('/').reverse().join('-');
}

// Validation functions
function validateCouponCode(value) {
    return /^[A-Z0-9]{6,10}$/.test(value);
}

function validateDescription(value) {
    return value.length >= 10 && value.length <= 200;
}

function validatePrices() {
    const offerPrice = document.getElementById('offerPrice')?.value.trim();
    const minPurchase = document.getElementById('minPurchase')?.value.trim();
    const errors = new Set();
    let isValid = true;

    if (!offerPrice || isNaN(offerPrice) || parseFloat(offerPrice) <= 0) {
        const error = document.getElementById('offerPriceError');
        if (error) {
            error.textContent = 'Offer price must be a positive number';
            error.style.display = 'block';
            document.getElementById('offerPrice')?.classList.add('is-invalid');
            document.getElementById('offerPrice')?.classList.remove('is-valid');
            document.getElementById('offerPrice')?.setAttribute('aria-invalid', 'true');
            document.getElementById('offerPrice')?.setAttribute('aria-describedby', 'offerPriceError');
        }
        errors.add('Offer price must be a positive number');
        isValid = false;
    } else {
        const error = document.getElementById('offerPriceError');
        if (error) {
            error.textContent = '';
            error.style.display = 'none';
            document.getElementById('offerPrice')?.classList.remove('is-invalid');
            document.getElementById('offerPrice')?.classList.add('is-valid');
            document.getElementById('offerPrice')?.setAttribute('aria-invalid', 'false');
            document.getElementById('offerPrice')?.removeAttribute('aria-describedby');
        }
    }

    if (!minPurchase || isNaN(minPurchase) || parseFloat(minPurchase) <= 0) {
        const error = document.getElementById('minPurchaseError');
        if (error) {
            error.textContent = 'Minimum purchase must be a positive number';
            error.style.display = 'block';
            document.getElementById('minPurchase')?.classList.add('is-invalid');
            document.getElementById('minPurchase')?.classList.remove('is-valid');
            document.getElementById('minPurchase')?.setAttribute('aria-invalid', 'true');
            document.getElementById('minPurchase')?.setAttribute('aria-describedby', 'minPurchaseError');
        }
        errors.add('Minimum purchase must be a positive number');
        isValid = false;
    } else if (parseFloat(minPurchase) <= parseFloat(offerPrice || 0)) {
        const error = document.getElementById('minPurchaseError');
        if (error) {
            error.textContent = 'Minimum purchase must be greater than offer price';
            error.style.display = 'block';
            document.getElementById('minPurchase')?.classList.add('is-invalid');
            document.getElementById('minPurchase')?.classList.remove('is-valid');
            document.getElementById('minPurchase')?.setAttribute('aria-invalid', 'true');
            document.getElementById('minPurchase')?.setAttribute('aria-describedby', 'minPurchaseError');
        }
        errors.add('Minimum purchase must be greater than offer price');
        isValid = false;
    } else {
        const error = document.getElementById('minPurchaseError');
        if (error) {
            error.textContent = '';
            error.style.display = 'none';
            document.getElementById('minPurchase')?.classList.remove('is-invalid');
            document.getElementById('minPurchase')?.classList.add('is-valid');
            document.getElementById('minPurchase')?.setAttribute('aria-invalid', 'false');
            document.getElementById('minPurchase')?.removeAttribute('aria-describedby');
        }
    }

    return { isValid, errors };
}

// Initialize Flatpickr and event listeners
document.addEventListener('DOMContentLoaded', () => {
    const createdInput = document.getElementById('createdDate');
    const expiryInput = document.getElementById('expiryDate');
    const couponNameInput = document.getElementById('couponName');
    const couponCodeInput = document.getElementById('couponCode');
    const descriptionInput = document.getElementById('description');
    const offerPriceInput = document.getElementById('offerPrice');
    const minPurchaseInput = document.getElementById('minPurchase');
    const form = document.getElementById('couponForm');

    if (!createdInput || !expiryInput || !couponNameInput || !couponCodeInput || !descriptionInput || !offerPriceInput || !minPurchaseInput || !form) {
        console.error('Required form elements not found');
        return;
    }

    // Pre-fill input values
    createdInput.value = formatDateForInput(createdInput.value);
    expiryInput.value = formatDateForInput(expiryInput.value);

    // Debounced validation functions
    const debouncedValidateCouponName = debounce(() => validateField(
        'couponName',
        'couponNameError',
        value => value.length >= 3 && value.length <= 50 && /^[A-Za-z0-9\s]+$/.test(value),
        'Coupon name must be 3-50 alphanumeric characters'
    ), 300);

    const debouncedValidateCouponCode = debounce(() => validateField(
        'couponCode',
        'couponCodeError',
        validateCouponCode,
        'Coupon code must be 6-10 uppercase alphanumeric characters'
    ), 500);

    const debouncedValidateDescription = debounce(() => validateField(
        'description',
        'descriptionError',
        validateDescription,
        'Description must be 10-200 characters long'
    ), 300);

    const debouncedValidateCreated = debounce(() => validateField(
        'createdDate',
        'createdDateError',
        value => {
            if (!isValidDate(value)) return false;
            const inputDate = parseDate(value);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const maxDate = new Date(today);
            maxDate.setDate(today.getDate() + 30);
            return inputDate >= today && inputDate <= maxDate;
        },
        'Created date must be today or within the next 30 days'
    ), 300);

    const debouncedValidateExpiry = debounce(() => validateField(
        'expiryDate',
        'expiryDateError',
        value => {
            if (!isValidDate(value) || !isValidDate(createdInput.value)) return false;
            const expiryDate = parseDate(value);
            const createdDate = parseDate(createdInput.value);
            const maxExpiry = new Date(createdDate);
            maxExpiry.setFullYear(createdDate.getFullYear() + 1);
            return expiryDate > createdDate && expiryDate <= maxExpiry;
        },
        'Expiry date must be after created date and within 1 year'
    ), 300);

    const debouncedValidatePrices = debounce(() => validatePrices(), 300);

    // Flatpickr initialization
    const createdPickerInstance = flatpickr('#createdDate', {
        dateFormat: 'd/m/Y',
        defaultDate: createdInput.value || new Date(),
        minDate: 'today',
        maxDate: new Date().fp_incr(30),
        allowInput: true,
        onChange: function (selectedDates, dateStr) {
            createdInput.value = dateStr;
            debouncedValidateCreated();
            expiryPickerInstance.set('minDate', dateStr ? parseDate(dateStr) : 'today');
            expiryPickerInstance.set('maxDate', dateStr ? parseDate(dateStr).fp_incr(365) : null);
            if (expiryInput.value) debouncedValidateExpiry();
        }
    });

    const expiryPickerInstance = flatpickr('#expiryDate', {
        dateFormat: 'd/m/Y',
        defaultDate: expiryInput.value || null,
        minDate: createdInput.value ? parseDate(createdInput.value) : new Date().fp_incr(1),
        maxDate: createdInput.value ? parseDate(createdInput.value).fp_incr(365) : null,
        allowInput: true,
        onChange: function (selectedDates, dateStr) {
            expiryInput.value = dateStr;
            debouncedValidateExpiry();
        }
    });

    // Real-time validation event listeners
    couponNameInput.addEventListener('input', debouncedValidateCouponName);
    couponCodeInput.addEventListener('input', () => {
        couponCodeInput.value = couponCodeInput.value.toUpperCase();
        debouncedValidateCouponCode();
    });
    descriptionInput.addEventListener('input', debouncedValidateDescription);
    createdInput.addEventListener('input', debouncedValidateCreated);
    expiryInput.addEventListener('input', debouncedValidateExpiry);
    offerPriceInput.addEventListener('input', debouncedValidatePrices);
    minPurchaseInput.addEventListener('input', debouncedValidatePrices);

    // Form submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearErrors();
        const errors = new Set();
        let isValid = true;

        if (!validateField(
            'couponName',
            'couponNameError',
            value => value.length >= 3 && value.length <= 50 && /^[A-Za-z0-9\s]+$/.test(value),
            'Coupon name must be 3-50 alphanumeric characters'
        )) {
            errors.add('Coupon name is invalid');
            isValid = false;
        }

        if (!validateField(
            'couponCode',
            'couponCodeError',
            validateCouponCode,
            'Coupon code must be 6-10 uppercase alphanumeric characters'
        )) {
            errors.add('Coupon code is invalid');
            isValid = false;
        }

        if (!validateField(
            'description',
            'descriptionError',
            validateDescription,
            'Description must be 10-200 characters long'
        )) {
            errors.add('Description is invalid');
            isValid = false;
        }

        if (!validateField(
            'createdDate',
            'createdDateError',
            value => {
                if (!isValidDate(value)) return false;
                const inputDate = parseDate(value);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const maxDate = new Date(today);
                maxDate.setDate(today.getDate() + 30);
                return inputDate >= today && inputDate <= maxDate;
            },
            'Created date must be today or within the next 30 days'
        )) {
            errors.add('Created date is invalid');
            isValid = false;
        }

        if (!validateField(
            'expiryDate',
            'expiryDateError',
            value => {
                if (!isValidDate(value) || !isValidDate(createdInput.value)) return false;
                const expiryDate = parseDate(value);
                const createdDate = parseDate(createdInput.value);
                const maxExpiry = new Date(createdDate);
                maxExpiry.setFullYear(createdDate.getFullYear() + 1);
                return expiryDate > createdDate && expiryDate <= maxExpiry;
            },
            'Expiry date must be after created date and within 1 year'
        )) {
            errors.add('Expiry date is invalid');
            isValid = false;
        }

        const priceValidation = validatePrices();
        if (!priceValidation.isValid) {
            priceValidation.errors.forEach(err => errors.add(err));
            isValid = false;
        }

        if (isValid) {
            const couponData = {
                couponName: couponNameInput.value.trim(),
                couponCode: couponCodeInput.value.trim().toUpperCase(),
                description: descriptionInput.value.trim(),
                validFrom: formatDateForServer(createdInput.value),
                validUpto: formatDateForServer(expiryInput.value),
                offerPrice: parseFloat(offerPriceInput.value),
                minPurchase: parseFloat(minPurchaseInput.value)
            };

            const couponId = document.getElementById('couponID').value;
            const submitButton = form.querySelector('.btn-primary');
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

    // Cancel button
    document.getElementById('cancelButton')?.addEventListener('click', () => {
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
    });

    // Validate pre-filled values on load
    if (couponNameInput.value) debouncedValidateCouponName();
    if (couponCodeInput.value) debouncedValidateCouponCode();
    if (descriptionInput.value) debouncedValidateDescription();
    if (createdInput.value) debouncedValidateCreated();
    if (expiryInput.value) debouncedValidateExpiry();
    if (offerPriceInput.value || minPurchaseInput.value) debouncedValidatePrices();
});