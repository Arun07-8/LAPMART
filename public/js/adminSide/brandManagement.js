   // Debounce function to limit search requests
        function debounce(func, wait) {
            let timeout;
            return function (...args) {
                clearTimeout(timeout);
                timeout = setTimeout(() => func.apply(this, args), wait);
            };
        }

        // Trigger search with loading state
        async function triggerSearch() {
            const searchInput = document.getElementById('searchInput').value.trim();
            const loadingIcon = document.getElementById('searchLoadingIcon');
            loadingIcon.style.display = 'block';

            try {
                const url = new URL(window.location.href);
                url.searchParams.set('search', searchInput);
                url.searchParams.set('page', '1');
                window.location.href = url.toString();
            } catch (error) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Failed to perform search. Please try again.'
                });
            } finally {
                loadingIcon.style.display = 'none';
            }
        }

        // Clear search and reset
        function clearSearch() {
            const searchInput = document.getElementById('searchInput');
            const loadingIcon = document.getElementById('searchLoadingIcon');
            searchInput.value = '';
            loadingIcon.style.display = 'none';

            const url = new URL(window.location.href);
            url.searchParams.delete('search');
            url.searchParams.set('page', '1');
            window.location.href = url.toString();
        }

        // Search input event listeners
        const searchInput = document.getElementById('searchInput');
        searchInput.addEventListener('input', debounce(function () {
            if (this.value.length >= 2 || this.value.length === 0) {
                triggerSearch();
            }
        }, 500));

        searchInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                triggerSearch();
            }
        });

        // Existing form submission handlers
        function handleFormSubmit(event) {
            event.preventDefault();
            if (!validateForm()) return false;

            const name = document.getElementById("brandName").value.trim();
            const description = document.getElementById("brandDescription").value.trim();

            fetch("/admin/addbrand", {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, description })
            })
            .then(response => response.json().then(data => ({ ok: response.ok, status: response.status, data })))
            .then(({ ok, status, data }) => {
                if (!ok) throw new Error(data.error || `Failed to add brand (Status: ${status})`);
                Swal.fire({
                    icon: 'success',
                    title: 'Brand Added',
                    text: data.message || 'Brand added successfully!',
                    timer: 1500,
                    showConfirmButton: false
                }).then(() => {
                    const modal = bootstrap.Modal.getInstance(document.getElementById('addBrandModal'));
                    if (modal) modal.hide();
                    location.reload();
                });
            })
            .catch(error => {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: error.message || 'An error occurred while adding the brand.'
                });
            });

            return false;
        }

        function handleEditFormSubmit(event) {
            event.preventDefault();
            if (!validateEditForm()) return;

            const brandId = document.getElementById('editBrandId').value;
            const name = document.getElementById('editBrandName').value.trim();
            const description = document.getElementById('editBrandDescription').value.trim();

            fetch(`/admin/editBrand/${brandId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, description })
            })
            .then(response => response.json().then(data => ({ ok: response.ok, status: response.status, data })))
            .then(({ ok, status, data }) => {
                if (!ok) throw new Error(data.error || `Failed to update brand (Status: ${status})`);
                Swal.fire({
                    icon: 'success',
                    title: 'Brand Updated',
                    text: data.message || 'Brand updated successfully!',
                    timer: 1500,
                    showConfirmButton: false
                }).then(() => {
                    const modal = bootstrap.Modal.getInstance(document.getElementById('editBrandModal'));
                    if (modal) modal.hide();
                    location.reload();
                });
            })
            .catch(error => {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: error.message || 'An error occurred while updating the brand.'
                });
            });
        }

        // Validation functions
        function validateForm() {
            clearErrorMessages();
            const name = document.getElementById("brandName").value.trim();
            const description = document.getElementById("brandDescription").value.trim();
            let isValid = true;

            if (name === "") {
                displayErrorMessage("name-error", "Please enter a brand name");
                isValid = false;
            } else if (!/^[a-zA-Z\s]+$/.test(name)) {
                displayErrorMessage("name-error", "Brand name should contain only alphabetic characters");
                isValid = false;
            }

            if (description === "") {
                displayErrorMessage("description-error", "Please enter a description");
                isValid = false;
            }

            return isValid;
        }

        function validateEditForm() {
            clearErrorMessages();
            const name = document.getElementById('editBrandName').value.trim();
            const description = document.getElementById('editBrandDescription').value.trim();
            let isValid = true;

            if (name === "") {
                displayErrorMessage("edit-name-error", "Please enter a brand name");
                isValid = false;
            } else if (!/^[a-zA-Z\s]+$/.test(name)) {
                displayErrorMessage("edit-name-error", "Brand name should contain only alphabetic characters");
                isValid = false;
            }

            if (description === "") {
                displayErrorMessage("edit-description-error", "Please enter a description");
                isValid = false;
            }

            return isValid;
        }

        // Other existing functions
        function handleEditClick(brandId, brandName, brandDescription) {
            document.getElementById('editBrandId').value = brandId;
            document.getElementById('editBrandName').value = brandName;
            document.getElementById('editBrandDescription').value = brandDescription;
        }

        async function handleSoftDeleteClick(brandId) {
            const result = await Swal.fire({
                title: 'Are you sure?',
                text: 'This will mark the brand as deleted. You can restore it later.',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Yes, delete it!',
                cancelButtonText: 'Cancel'
            });

            if (result.isConfirmed) {
                try {
                    const response = await fetch(`/admin/deleteBrand/${brandId}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' }
                    });
                    const data = await response.json();
                    if (!response.ok) throw new Error(data.error || 'Failed to soft delete brand');
                    Swal.fire({
                        icon: 'success',
                        title: 'Deleted',
                        text: data.message || 'Brand has been soft deleted',
                        timer: 1500,
                        showConfirmButton: false
                    }).then(() => location.reload());
                } catch (error) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Oops',
                        text: error.message || 'An error occurred while deleting the brand'
                    });
                }
            }
        }

        async function handleListBrand(brandId) {
            const result = await Swal.fire({
                title: 'Are you sure?',
                text: 'This will list the brand, making it visible.',
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'Yes, list it!',
                cancelButtonText: 'Cancel'
            });
            if (result.isConfirmed) {
                try {
                    const response = await fetch(`/admin/listedBrand/${brandId}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' }
                    });
                    const data = await response.json();
                    if (!response.ok) throw new Error(data.error || 'Failed to list brand');
                    Swal.fire({
                        icon: 'success',
                        title: 'Brand Listed',
                        text: data.message || 'Brand has been listed successfully',
                        timer: 1500,
                        showConfirmButton: false
                    }).then(() => location.reload());
                } catch (error) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: error.message || 'An error occurred while listing the brand'
                    });
                }
            }
        }

        async function handleUnlistBrand(brandId) {
            const result = await Swal.fire({
                title: 'Are you sure?',
                text: 'This will unlist the brand, making it hidden.',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Yes, unlist it!',
                cancelButtonText: 'Cancel'
            });
            if (result.isConfirmed) {
                try {
                    const response = await fetch(`/admin/unlistedBrand/${brandId}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' }
                    });
                    const data = await response.json();
                    if (!response.ok) throw new Error(data.error || 'Failed to unlist brand');
                    Swal.fire({
                        icon: 'success',
                        title: 'Brand Unlisted',
                        text: data.message || 'Brand has been unlisted successfully',
                        timer: 1500,
                        showConfirmButton: false
                    }).then(() => location.reload());
                } catch (error) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: error.message || 'An error occurred while unlisting the brand'
                    });
                }
            }
        }

        function displayErrorMessage(elementId, message) {
            const errorElement = document.getElementById(elementId);
            if (errorElement) {
                errorElement.innerText = message;
                errorElement.style.display = "block";
            }
        }

        function clearErrorMessages() {
            const errorElements = document.getElementsByClassName("error-message");
            Array.from(errorElements).forEach(element => {
                element.innerText = "";
                element.style.display = "none";
            });
        }