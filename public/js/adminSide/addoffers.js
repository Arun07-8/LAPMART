        // Date formatting function
        function formatDateInput(input) {
            let value = input.value.replace(/\D/g, '');
            if (value.length >= 3 && value.length <= 4) {
                value = value.slice(0, 2) + '/' + value.slice(2);
            } else if (value.length >= 5) {
                value = value.slice(0, 2) + '/' + value.slice(2, 4) + '/' + value.slice(4, 8);
            }
            input.value = value;
        }

        // Date validation function
        function isValidDate(dateString) {
            const dateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
            if (!dateRegex.test(dateString)) return false;

            const [, day, month, year] = dateString.match(dateRegex);
            const date = new Date(year, month - 1, day);
            
            return date.getFullYear() == year && 
                   date.getMonth() == month - 1 && 
                   date.getDate() == day;
        }

         flatpickr("#validFrom", {
    dateFormat: "d/m/Y"
  });

  flatpickr("#validUpto", {
    dateFormat: "d/m/Y"
  });

        // Convert dd/mm/yyyy to Date object
        function parseDate(dateString) {
            const [day, month, year] = dateString.split('/');
            return new Date(year, month - 1, day);
        }

        // Add date input formatting
        document.getElementById('validFrom').addEventListener('input', function() {
            formatDateInput(this);
            validateField(this);
        });

        document.getElementById('validUpto').addEventListener('input', function() {
            formatDateInput(this);
            validateField(this);
        });

        // Form elements
        const form = document.getElementById('offerForm');
        const offerType = document.getElementById('offerType');
        const applicable = document.getElementById('applicable');
        const applicableGroup = document.getElementById('applicableGroup');
        const discountType = document.getElementById('discountType');
        const offerAmount = document.getElementById('offerAmount');
        const validFrom = document.getElementById('validFrom');
        const validUpto = document.getElementById('validUpto');

        // Handle offerType change
        offerType.addEventListener('change', async function () {
            const selectedType = this.value.toLowerCase();
            if (!applicableGroup || !applicable) return;

            clearError('offerType');
            clearError('applicable');

            if (selectedType === 'product') {
                const res = await fetch('/admin/offer-products');
                const data = await res.json();
                fillDropdown(applicable, data.products, 'productName');
                applicableGroup.style.display = 'block';
                applicable.disabled = false;
            } else if (selectedType === 'category') {
                const res = await fetch('/admin/offer-categories');
                const data = await res.json();
                fillDropdown(applicable, data.categories, 'name');
                applicableGroup.style.display = 'block';
                applicable.disabled = false;
            } else if (selectedType === 'brand') {
                const res = await fetch('/admin/offer-brands');
                const data = await res.json();
                fillDropdown(applicable, data.brands, 'name');
                applicableGroup.style.display = 'block';
                applicable.disabled = false;
            } else {
                applicable.innerHTML = '<option value="">-- Select Item --</option>';
                applicable.disabled = true;
                applicableGroup.style.display = 'none';
                clearError('applicable');
            }

            validateField(this);
        });

        // Fill dropdown
        function fillDropdown(select, items, labelKey) {
            select.disabled = false;
            select.innerHTML = `<option value="">-- Select --</option>`;
            items.forEach(item => {
                select.innerHTML += `<option value="${item._id}">${item[labelKey]}</option>`;
            });
        }

        // Update amount label based on discount type
        discountType.addEventListener('change', function() {
            const amountLabel = document.getElementById('offerAmountLabel');
            const amountInput = document.getElementById('offerAmount');
            if (this.value === 'percentage') {
                amountLabel.innerHTML = 'Offer Amount (%) <span class="required">*</span>';
                amountInput.placeholder = 'Enter percentage (e.g., 10)';
                amountInput.max = '100';
            } else if (this.value === 'flat') {
                amountLabel.innerHTML = 'Offer Amount ($) <span class="required">*</span>';
                amountInput.placeholder = 'Enter flat amount (e.g., 50.00)';
                amountInput.removeAttribute('max');
            } else {
                amountLabel.innerHTML = 'Offer Amount <span class="required">*</span>';
                amountInput.placeholder = 'Enter amount';
                amountInput.removeAttribute('max');
            }
            clearError('discountType');
            validateField(this);
        });

        // Clear error function
        function clearError(fieldName) {
            const field = document.getElementById(fieldName);
            const errorMsg = document.getElementById(fieldName + 'Error');
            if (field && errorMsg) {
                field.classList.remove('field-error');
                errorMsg.classList.remove('show');
                errorMsg.textContent = '';
            }
        }

        // Show error function
        function showError(fieldName, message) {
            const field = document.getElementById(fieldName);
            const errorMsg = document.getElementById(fieldName + 'Error');
            if (field && errorMsg) {
                field.classList.add('field-error');
                errorMsg.textContent = message;
                errorMsg.classList.add('show');
            }
        }

        // Validation functions
        function validateField(field) {
            const value = field.value.trim();
            const name = field.name;

            clearError(name);

            if (!value && isFieldRequired(name)) {
                showError(name, getFieldDisplayName(name) + ' is required');
                return false;
            }

            if (!value && !isFieldRequired(name)) return true;

            if (name === 'offerName') {
                const nameRegex =  /^[\p{L}\p{N}\s\-&@%()!#$*+:'",.🔥🌟🎉😎💥]{3,50}$/u;
                if (!nameRegex.test(value)) {
                    showError(name, 'Offer name must be 3-50 characters and contain only letters, numbers, spaces, hyphens, or &');
                    return false;
                }
            }

            if (name === 'offerAmount') {
                const amount = parseFloat(value);
                if (isNaN(amount) || amount <= 0) {
                    showError(name, 'Please enter a valid positive amount');
                    return false;
                }
                if (discountType.value === 'percentage' && amount > 100) {
                    showError(name, 'Percentage cannot exceed 100%');
                    return false;
                }
            }

            if (name === 'validFrom' || name === 'validUpto') {
                if (!value) {
                    showError(name, 'Please enter a valid date in dd/mm/yyyy format');
                    return false;
                }

                if (!isValidDate(value)) {
                    showError(name, 'Please enter a valid date in dd/mm/yyyy format');
                    return false;
                }

                const inputDate = parseDate(value);
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                if (inputDate < today) {
                    showError(name, 'Date cannot be in the past');
                    return false;
                }

                if (name === 'validUpto') {
                    const fromValue = validFrom.value;
                    if (fromValue && isValidDate(fromValue)) {
                        const fromDate = parseDate(fromValue);
                        if (inputDate < fromDate) {
                            showError(name, 'Valid upto date must be on or after valid from date');
                            return false;
                        }
                    }
                }

                if (name === 'validFrom' && validUpto.value && isValidDate(validUpto.value)) {
                    const toDate = parseDate(validUpto.value);
                    if (toDate < inputDate) {
                        showError('validUpto', 'Valid upto date must be on or after valid from date');
                        return false;
                    }
                }
            }

            return true;
        }

        function isFieldRequired(fieldName) {
            const requiredFields = ['offerName', 'offerType', 'applicable', 'discountType', 'offerAmount', 'validFrom', 'validUpto'];
            return requiredFields.includes(fieldName);
        }

        function getFieldDisplayName(fieldName) {
            const displayNames = {
                'offerName': 'Offer name',
                'offerType': 'Offer type',
                'applicable': 'Applicable to',
                'discountType': 'Discount type',
                'offerAmount': 'Offer amount',
                'validFrom': 'Valid from date',
                'validUpto': 'Valid upto date'
            };
            return displayNames[fieldName] || fieldName;
        }

        // Real-time validation for all fields
        document.querySelectorAll('input, select, textarea').forEach(field => {
            field.removeAttribute('required');
            
            field.addEventListener('input', function() {
                validateField(this);
                if (this.name === 'validFrom' && validUpto.value) {
                    validateField(validUpto);
                } else if (this.name === 'validUpto' && validFrom.value) {
                    validateField(validFrom);
                }
            });
            
            field.addEventListener('change', function() {
                validateField(this);
                if (this.name === 'validFrom' && validUpto.value) {
                    validateField(validUpto);
                } else if (this.name === 'validUpto' && validFrom.value) {
                    validateField(validFrom);
                }
            });

            field.addEventListener('blur', function() {
                validateField(this);
                if (this.name === 'validFrom' && validUpto.value) {
                    validateField(validUpto);
                } else if (this.name === 'validUpto' && validFrom.value) {
                    validateField(validFrom);
                }
            });
        });

        // Mobile menu functionality
        const menuToggle = document.getElementById('menuToggle');
        const sidebar = document.getElementById('sidebar');
        const sidebarOverlay = document.getElementById('sidebarOverlay');

        if (menuToggle && sidebar && sidebarOverlay) {
            menuToggle.addEventListener('click', () => {
                sidebar.classList.toggle('open');
                sidebarOverlay.classList.toggle('show');
            });

            sidebarOverlay.addEventListener('click', () => {
                sidebar.classList.remove('open');
                sidebarOverlay.classList.remove('show');
            });
        }

        // Form submission
        form.addEventListener('submit', async function(e) {
            e.preventDefault();

            // Validate all fields
            let isValid = true;
            const fields = document.querySelectorAll('input, select, textarea');
            fields.forEach(field => {
                if (!validateField(field)) {
                    isValid = false;
                }
            });

            if (isValid) {
                const formData = {
                    offerName: document.getElementById('offerName').value,
                    offerType: document.getElementById('offerType').value,
                    applicable: document.getElementById('applicable').value,
                    discountType: document.getElementById('discountType').value,
                    offerAmount: parseFloat(document.getElementById('offerAmount').value),
                    validFrom: document.getElementById('validFrom').value,
                    validUpto: document.getElementById('validUpto').value,
                    description: document.getElementById('description').value || null
                };

                try {
                    const response = await fetch('/admin/add-offers', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(formData)
                    });

                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.message || 'Failed to create offer');
                    }

                    // Success case
                    Swal.fire({
                        icon: 'success',
                        title: 'Success',
                        text: 'Offer created successfully!',
                        confirmButtonColor: '#3085d6',
                        timer: 5000,
                        timerProgressBar: true
                    }).then(() => {
                        form.reset();
                        applicable.innerHTML = '<option value="">-- Select Item --</option>';
                        applicable.disabled = true;
                        applicableGroup.style.display = 'none';
                        offerType.value = '';
                        discountType.value = '';
                        window.location.href = '/admin/offers';
                    });
                } catch (error) {
                    // Error case
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: error.message || 'Failed to create offer. Please try again.',
                        confirmButtonColor: '#3085d6',
                        timer: 5000,
                        timerProgressBar: true
                    }).then(() => {
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                    });
                }
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Form Error',
                    text: 'Please correct the errors in the form and try again.',
                    confirmButtonColor: '#3085d6',
                    timer: 5000,
                    timerProgressBar: true
                }).then(() => {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                });
            }
        });

        // Back button functionality
        function goBack() {
            Swal.fire({
                title: 'Are you sure?',
                text: 'Any unsaved changes will be lost.',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#d33',
                confirmButtonText: 'Yes, go back',
                cancelButtonText: 'Cancel'
            }).then((result) => {
                if (result.isConfirmed) {
                    window.location.href = '/admin/offers';
                }
            });
        }

        // Set minimum date to today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayFormatted = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
        validFrom.min = todayFormatted;
        validUpto.min = todayFormatted;

        // Update minimum date for validUpto
        validFrom.addEventListener('change', function() {
            validUpto.min = this.value;
            if (validUpto.value) {
                validateField(validUpto);
            }
        });