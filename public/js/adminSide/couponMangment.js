  // Initialize flatpickr for date inputs
        flatpickr('.date-input', {
            dateFormat: 'd/m/y', // Enforce DD/MM/YY format
            allowInput: true, // Allow manual input
            onChange: function(selectedDates, dateStr, instance) {
                validateAndSubmit();
            }
        });

        // Debounce function
        function debounce(func, wait) {
            let timeout;
            return function (...args) {
                clearTimeout(timeout);
                timeout = setTimeout(() => func.apply(this, args), wait);
            };
        }

        // Validate dates and submit form
        function validateAndSubmit() {
            const fromDateInput = document.querySelector('.date-input[name="fromDate"]');
            const toDateInput = document.querySelector('.date-input[name="toDate"]');
            const fromDate = fromDateInput.value;
            const toDate = toDateInput.value;

            if (fromDate && toDate) {
                const fromDateParsed = new Date(fromDate.split('/').reverse().join('-')); // Convert DD/MM/YY to YYYY-MM-DD
                const toDateParsed = new Date(toDate.split('/').reverse().join('-'));
                if (fromDateParsed > toDateParsed) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Invalid Date Range',
                        text: 'From Date cannot be after To Date'
                    });
                    fromDateInput.value = '';
                    toDateInput.value = '';
                    return;
                }
            }
            document.getElementById('searchForm').submit();
        }

        // Edit coupon
        function editCoupon(couponId) {
            window.location.href = `/admin/edit-coupon/${couponId}`;
        }

        // Delete coupon
        async function deleteCoupon(couponId) {
            const result = await Swal.fire({
                title: 'Are you sure?',
                text: 'This will mark the coupon as deleted. You can restore it later.',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Yes, delete it!',
                cancelButtonText: 'Cancel'
            });
            if (result.isConfirmed) {
                try {
                    const response = await fetch(`/admin/coupondelete/${couponId}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' }
                    });
                    const data = await response.json();
                    if (!response.ok) throw new Error(data.error || 'Failed to soft delete coupon');
                    Swal.fire({
                        icon: 'success',
                        title: 'Deleted',
                        text: data.message || 'Coupon has been soft deleted',
                        timer: 1500,
                        showConfirmButton: false
                    }).then(() => window.location.href = "/admin/coupon");
                } catch (error) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Oops',
                        text: error.message || 'An error occurred while deleting the coupon'
                    });
                }
            }
        }

        // Activate coupon
        async function handleActiveCoupon(couponId) {
            const result = await Swal.fire({
                title: 'Are you sure?',
                text: 'This will activate the coupon, making it visible and applicable.',
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'Yes, activate it!',
                cancelButtonText: 'Cancel'
            });
            if (result.isConfirmed) {
                try {
                    const response = await fetch(`/admin/active-coupon/${couponId}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' }
                    });
                    const data = await response.json();
                    if (!response.ok) throw new Error(data.error || 'Failed to activate coupon');
                    Swal.fire({
                        icon: 'success',
                        title: 'Coupon Activated',
                        text: data.message || 'Coupon has been activated successfully',
                        timer: 1500,
                        showConfirmButton: false
                    }).then(() => window.location.href = "/admin/coupon");
                } catch (error) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: error.message || 'An error occurred while activating the coupon'
                    });
                }
            }
        }

        // Deactivate coupon
        async function handleinActiveCoupon(couponId) {
            const result = await Swal.fire({
                title: 'Are you sure?',
                text: 'This will deactivate the coupon, making it hidden and inapplicable.',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Yes, deactivate it!',
                cancelButtonText: 'Cancel'
            });
            if (result.isConfirmed) {
                try {
                    const response = await fetch(`/admin/inactive-coupon/${couponId}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' }
                    });
                    const data = await response.json();
                    if (!response.ok) throw new Error(data.error || 'Failed to deactivate coupon');
                    Swal.fire({
                        icon: 'success',
                        title: 'Coupon Deactivated',
                        text: data.message || 'Coupon has been deactivated successfully',
                        timer: 1500,
                        showConfirmButton: false
                    }).then(() => window.location.href = "/admin/coupon");
                } catch (error) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: error.message || 'An error occurred while deactivating the coupon'
                    });
                }
            }
        }

        // Initialize event listeners
        document.addEventListener('DOMContentLoaded', function () {
            // Debounced search input
            document.querySelector('.search-input').addEventListener('input', debounce(function() {
                document.getElementById('searchForm').submit();
            }, 300));

            // Sort dropdown submission
            document.querySelector('#sortSelect').addEventListener('change', function() {
                document.getElementById('searchForm').submit();
            });
        });