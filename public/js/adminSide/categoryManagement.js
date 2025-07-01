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

        // Form submission handlers
        function handleFormSubmit(event) {
            event.preventDefault();
            if (!validateForm()) return false;

            const name = document.getElementById("categoryName").value.trim();
            const description = document.getElementById("categoryDescription").value.trim();

            fetch("/admin/addCategory", {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, description })
            })
            .then(response => response.json().then(data => ({ ok: response.ok, status: response.status, data })))
            .then(({ ok, status, data }) => {
                if (!ok) throw new Error(data.error || `Failed to add category (Status: ${status})`);
                Swal.fire({
                    icon: 'success',
                    title: 'Category Added',
                    text: data.message || 'Category added successfully!',
                    timer: 1500,
                    showConfirmButton: false
                }).then(() => {
                    const modal = bootstrap.Modal.getInstance(document.getElementById('addCategoryModal'));
                    if (modal) modal.hide();
                    location.reload();
                });
            })
            .catch(error => {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: error.message || 'An error occurred while adding the category.'
                });
            });

            return false;
        }

        function handleEditFormSubmit(event) {
            event.preventDefault();
            if (!validateEditForm()) return;

            const categoryId = document.getElementById('editCategoryId').value;
            const name = document.getElementById('editCategoryName').value.trim();
            const description = document.getElementById('editCategoryDescription').value.trim();

            fetch(`/admin/editCategory/${categoryId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ categoryname: name, description })
            })
            .then(response => response.json().then(data => ({ ok: response.ok, status: response.status, data })))
            .then(({ ok, status, data }) => {
                if (!ok) throw new Error(data.error || `Failed to update category (Status: ${status})`);
                Swal.fire({
                    icon: 'success',
                    title: 'Category Updated',
                    text: data.message || 'Category updated successfully!',
                    timer: 1500,
                    showConfirmButton: false
                }).then(() => {
                    const modal = bootstrap.Modal.getInstance(document.getElementById('editCategoryModal'));
                    if (modal) modal.hide();
                    location.reload();
                });
            })
            .catch(error => {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: error.message || 'An error occurred while updating the category.'
                });
            });
        }

        // Validation functions
        function validateForm() {
            clearErrorMessages();
            const name = document.getElementById("categoryName").value.trim();
            const description = document.getElementById("categoryDescription").value.trim();
            let isValid = true;

            if (name === "") {
                displayErrorMessage("name-error", "Please enter a category name");
                isValid = false;
            } else if (!/^[a-zA-Z\s]+$/.test(name)) {
                displayErrorMessage("name-error", "Category name should contain only alphabetic characters");
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
            const name = document.getElementById('editCategoryName').value.trim();
            const description = document.getElementById('editCategoryDescription').value.trim();
            let isValid = true;

            if (name === "") {
                displayErrorMessage("edit-name-error", "Please enter a category name");
                isValid = false;
            } else if (!/^[a-zA-Z\s]+$/.test(name)) {
                displayErrorMessage("edit-name-error", "Category name should contain only alphabetic characters");
                isValid = false;
            }

            if (description === "") {
                displayErrorMessage("edit-description-error", "Please enter a description");
                isValid = false;
            }

            return isValid;
        }

        // Other functions
        function handleEditClick(categoryId, categoryName, categoryDescription) {
            document.getElementById('editCategoryId').value = categoryId;
            document.getElementById('editCategoryName').value = categoryName;
            document.getElementById('editCategoryDescription').value = categoryDescription;
        }

        async function handleListedCatClick(categoryId) {
            const button = document.querySelector(`button[onclick="handleListedCatClick('${categoryId}')"]`);
            button.setAttribute('aria-busy', 'true');
            button.disabled = true;

            const result = await Swal.fire({
                title: 'Are you sure?',
                text: 'This will unlist the category, making it hidden.',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Yes, unlist it!',
                cancelButtonText: 'Cancel'
            });

            if (result.isConfirmed) {
                try {
                    const response = await fetch(`/admin/unlistedCategory/${categoryId}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' }
                    });

                    const contentType = response.headers.get('content-type');
                    if (!contentType || !contentType.includes('application/json')) {
                        const text = await response.text();
                        console.error('Non-JSON response:', text);
                        throw new Error('Server returned non-JSON response');
                    }

                    const data = await response.json();
                    if (!response.ok) throw new Error(data.error || 'Failed to unlist category');

                    Swal.fire({
                        icon: 'success',
                        title: 'Category Unlisted',
                        text: data.message || 'Category has been unlisted successfully',
                        timer: 1500,
                        showConfirmButton: false
                    }).then(() => location.reload());
                } catch (error) {
                    console.error('Error unlisting category:', error);
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: error.message || 'An error occurred while unlisting the category'
                    });
                } finally {
                    button.setAttribute('aria-busy', 'false');
                    button.disabled = false;
                }
            } else {
                button.setAttribute('aria-busy', 'false');
                button.disabled = false;
            }
        }

        async function handleUnlistedCatClick(categoryId) {
            const button = document.querySelector(`button[onclick="handleUnlistedCatClick('${categoryId}')"]`);
            button.setAttribute('aria-busy', 'true');
            button.disabled = true;

            const result = await Swal.fire({
                title: 'Are you sure?',
                text: 'This will list the category, making it visible.',
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'Yes, list it!',
                cancelButtonText: 'Cancel'
            });

            if (result.isConfirmed) {
                try {
                    const response = await fetch(`/admin/listedCategory/${categoryId}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' }
                    });

                    const contentType = response.headers.get('content-type');
                    if (!contentType || !contentType.includes('application/json')) {
                        const text = await response.text();
                        console.error('Non-JSON response:', text);
                        throw new Error('Server returned non-JSON response');
                    }

                    const data = await response.json();
                    if (!response.ok) throw new Error(data.error || 'Failed to list category');

                    Swal.fire({
                        icon: 'success',
                        title: 'Category Listed',
                        text: data.message || 'Category has been listed successfully',
                        timer: 1500,
                        showConfirmButton: false
                    }).then(() => location.reload());
                } catch (error) {
                    console.error('Error listing category:', error);
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: error.message || 'An error occurred while listing the category'
                    });
                } finally {
                    button.setAttribute('aria-busy', 'false');
                    button.disabled = false;
                }
            } else {
                button.setAttribute('aria-busy', 'false');
                button.disabled = false;
            }
        }

        async function handleSoftDeleteClick(categoryId) {
            const result = await Swal.fire({
                title: 'Are you sure?',
                text: 'This will mark the category as deleted. You can restore it later.',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Yes, delete it!',
                cancelButtonText: 'Cancel'
            });

            if (result.isConfirmed) {
                try {
                    const response = await fetch(`/admin/categoryDelete/${categoryId}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' }
                    });

                    const data = await response.json();
                    if (!response.ok) throw new Error(data.error || 'Failed to soft delete category');

                    Swal.fire({
                        icon: 'success',
                        title: 'Deleted',
                        text: data.message || 'Category has been soft deleted',
                        timer: 1500,
                        showConfirmButton: false
                    }).then(() => location.reload());
                } catch (error) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Oops',
                        text: error.message || 'An error occurred while deleting the category'
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