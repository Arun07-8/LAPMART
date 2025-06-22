document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('userSearchInput');
    const searchBtn = document.getElementById('searchBtn');
    const clearButton = document.querySelector('.btn-clear');
    const searchLoadingIcon = document.getElementById('searchLoadingIcon');
    const tableContainer = document.querySelector('.table-container');
    const tbody = document.querySelector('.table tbody');

    // Function to toggle clear button visibility
    function toggleClearButton() {
        if (clearButton) {
            clearButton.style.display = searchInput.value.trim() ? 'block' : 'none';
        }
    }

    // Initialize clear button state
    toggleClearButton();

    // Debounce function to limit API calls
    function debounce(func, delay) {
        let timeoutId;
        return function (...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    }

    // Format date as DD-MM-YYYY
    function formatDate(date) {
        try {
            const d = new Date(date);
            if (isNaN(d.getTime())) return 'Invalid Date';
            
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = d.getFullYear();
            return `${day}-${month}-${year}`;
        } catch (error) {
            console.error('Date formatting error:', error);
            return 'Invalid Date';
        }
    }

    // Show loading state
    function showLoading() {
        if (tableContainer) tableContainer.classList.add('loading');
        if (searchLoadingIcon) searchLoadingIcon.style.display = 'block';
    }

    // Hide loading state
    function hideLoading() {
        if (tableContainer) tableContainer.classList.remove('loading');
        if (searchLoadingIcon) searchLoadingIcon.style.display = 'none';
    }

    // Render table rows
    function renderTableRows(users, currentPage, limit = 3) {
        if (!tbody) return;

        tbody.innerHTML = '';

        if (!users || users.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 2rem;">
                        <div style="color: var(--text-secondary);">
                            <i class="fas fa-search" style="font-size: 2rem; margin-bottom: 1rem;"></i>
                            <p>No users found matching your search criteria.</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        users.forEach((user, index) => {
            // Calculate correct serial number for pagination
            const serialNumber = (currentPage - 1) * limit + index + 1;
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${serialNumber}</td>
                <td>
                    <div class="user-image">
                        <img src="${user.image || '/img/register/download.png'}" 
                             alt="${user.name || 'User'}" 
                             class="user-thumbnail" 
                             loading="lazy"
                             onerror="this.src='/img/register/download.png'">
                    </div>
                </td>
                <td>${user.name || 'N/A'}</td>
                <td>${user.email || 'N/A'}</td>
                <td>${user.phoneNumber || 'N/A'}</td>
                <td>${formatDate(user.createdAt)}</td>
                <td>
                    ${user.isBlocked 
                        ? `<button class="btn-status btn-listed2" onclick="handleUnblockUserClick('${user._id}')" aria-label="Unblock user">BLOCKED</button>`
                        : `<button class="btn-status btn-listed" onclick="handleBlockUserClick('${user._id}')" aria-label="Block user">ACTIVE</button>`
                    }
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    // Perform live search
    const performLiveSearch = debounce(function() {
        const searchTerm = searchInput?.value?.trim() || '';
        
        // Validate search term length
        if (searchTerm && searchTerm.length < 2) {
            console.warn('Search term too short');
            return;
        }

        showLoading();

        const url = new URL('/admin/users', window.location.origin);
        if (searchTerm) {
            url.searchParams.set('search', encodeURIComponent(searchTerm));
        }
        url.searchParams.set('page', '1');

        fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            // Validate response data
            if (!data || typeof data !== 'object') {
                throw new Error('Invalid response format');
            }

            // Update URL without reloading
            window.history.pushState({}, '', url.toString());

            // Render table with data
            renderTableRows(data.users || [], data.currentPage || 1, 3);

            // Update pagination
            updatePagination(data.currentPage || 1, data.totalPages || 1, searchTerm);
        })
        .catch(error => {
            console.error('Error in live search:', error);
            
            // Show user-friendly error
            if (tbody) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="7" style="text-align: center; padding: 2rem;">
                            <div style="color: var(--text-secondary);">
                                <i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 1rem; color: #dc3545;"></i>
                                <p>Failed to fetch users. Please try again.</p>
                            </div>
                        </td>
                    </tr>
                `;
            }

            // Show SweetAlert if available
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    icon: 'error',
                    title: 'Search Error',
                    text: 'Failed to fetch users. Please try again.',
                    confirmButtonColor: 'var(--primary-color)'
                });
            }
        })
        .finally(() => {
            hideLoading();
        });
    }, 300);

    // Update pagination links
    function updatePagination(currentPage, totalPages, searchTerm = '') {
        const pagination = document.querySelector('.pagination');
        if (!pagination) return;

        pagination.innerHTML = '';

        // Previous button
        if (currentPage > 1) {
            pagination.innerHTML += `
                <li class="page-item">
                    <a class="page-link" href="#" data-page="${currentPage - 1}" data-search="${searchTerm}" aria-label="Previous">
                        <i class="fas fa-chevron-left"></i>
                    </a>
                </li>
            `;
        } else {
            pagination.innerHTML += `
                <li class="page-item disabled">
                    <span class="page-link">
                        <i class="fas fa-chevron-left"></i>
                    </span>
                </li>
            `;
        }

        // Page numbers with smart pagination
        let startPage = Math.max(1, currentPage - 2);
        let endPage = Math.min(totalPages, startPage + 4);
        
        // Adjust if we're near the end
        if (endPage - startPage < 4 && totalPages > 5) {
            startPage = Math.max(1, endPage - 4);
        }

        for (let i = startPage; i <= endPage; i++) {
            pagination.innerHTML += `
                <li class="page-item ${i === currentPage ? 'active' : ''}">
                    <a class="page-link" href="#" data-page="${i}" data-search="${searchTerm}">${i}</a>
                </li>
            `;
        }

        // Next button
        if (currentPage < totalPages) {
            pagination.innerHTML += `
                <li class="page-item">
                    <a class="page-link" href="#" data-page="${currentPage + 1}" data-search="${searchTerm}" aria-label="Next">
                        <i class="fas fa-chevron-right"></i>
                    </a>
                </li>
            `;
        } else {
            pagination.innerHTML += `
                <li class="page-item disabled">
                    <span class="page-link">
                        <i class="fas fa-chevron-right"></i>
                    </span>
                </li>
            `;
        }

        // Add click event listeners to pagination links
        pagination.querySelectorAll('.page-link[data-page]').forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                const page = this.getAttribute('data-page');
                const search = this.getAttribute('data-search');
                performLiveSearchWithPage(page, search);
            });
        });
    }

    // Perform search with specific page
    function performLiveSearchWithPage(page, searchTerm = '') {
        showLoading();

        const url = new URL('/admin/users', window.location.origin);
        if (searchTerm) {
            url.searchParams.set('search', encodeURIComponent(searchTerm));
        }
        url.searchParams.set('page', page || '1');

        fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            // Validate response data
            if (!data || typeof data !== 'object') {
                throw new Error('Invalid response format');
            }

            // Update URL without reloading
            window.history.pushState({}, '', url.toString());

            // Render table with data
            renderTableRows(data.users || [], data.currentPage || 1, 3);

            // Update pagination
            updatePagination(data.currentPage || 1, data.totalPages || 1, searchTerm);
        })
        .catch(error => {
            console.error('Error in paginated search:', error);
            
            // Show user-friendly error
            if (tbody) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="7" style="text-align: center; padding: 2rem;">
                            <div style="color: var(--text-secondary);">
                                <i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 1rem; color: #dc3545;"></i>
                                <p>Failed to fetch users. Please try again.</p>
                            </div>
                        </td>
                    </tr>
                `;
            }

            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Failed to fetch users. Please try again.',
                    confirmButtonColor: 'var(--primary-color)'
                });
            }
        })
        .finally(() => {
            hideLoading();
        });
    }

    // Event listeners
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            toggleClearButton();
            performLiveSearch();
        });
    }

    if (searchBtn) {
        searchBtn.addEventListener('click', function(e) {
            e.preventDefault();
            performLiveSearch();
        });
    }

    if (clearButton) {
        clearButton.addEventListener('click', function(e) {
            e.preventDefault();
            searchInput.value = '';
            toggleClearButton();
            performLiveSearch();
        });
    }

    // Responsive table handling
    function adjustTableContainer() {
        if (tableContainer) {
            if (window.innerWidth <= 1200) {
                tableContainer.style.overflowX = 'auto';
            } else {
                tableContainer.style.overflowX = 'visible';
            }
        }
    }

    adjustTableContainer();
    window.addEventListener('resize', adjustTableContainer);

    // Restore search term on page load
    const urlParams = new URLSearchParams(window.location.search);
    const searchTerm = urlParams.get('search');
    if (searchTerm && searchInput) {
        searchInput.value = decodeURIComponent(searchTerm);
        toggleClearButton();
        // Delay initial search to ensure DOM is ready
        setTimeout(() => {
            performLiveSearch();
        }, 100);
    }
});

// Block/Unblock user functions (unchanged but with better error handling)
async function handleBlockUserClick(userId) {
    const button = document.querySelector(`button[onclick="handleBlockUserClick('${userId}')"]`);
    if (!button) return;

    button.setAttribute('aria-busy', 'true');
    button.disabled = true;

    try {
        const result = await Swal.fire({
            title: 'Are you sure?',
            text: 'This will block the user, logging them out and restricting their access.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Yes, block user!',
            cancelButtonText: 'Cancel',
            confirmButtonColor: '#dc3545'
        });

        if (result.isConfirmed) {
            const response = await fetch(`/admin/blockUser/${userId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                console.error('Non-JSON response:', text);
                throw new Error('Server returned non-JSON response');
            }

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to block user');

            await Swal.fire({
                icon: 'success',
                title: 'User Blocked',
                text: data.message || 'User has been blocked successfully',
                timer: 1500,
                showConfirmButton: false
            });
            
            location.reload();
        }
    } catch (error) {
        console.error('Error blocking user:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message || 'An error occurred while blocking the user'
        });
    } finally {
        button.setAttribute('aria-busy', 'false');
        button.disabled = false;
    }
}

async function handleUnblockUserClick(userId) {
    const button = document.querySelector(`button[onclick="handleUnblockUserClick('${userId}')"]`);
    if (!button) return;

    button.setAttribute('aria-busy', 'true');
    button.disabled = true;

    try {
        const result = await Swal.fire({
            title: 'Are you sure?',
            text: 'This will unblock the user, restoring their access.',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Yes, unblock user!',
            cancelButtonText: 'Cancel',
            confirmButtonColor: '#28a745'
        });

        if (result.isConfirmed) {
            const response = await fetch(`/admin/unblockUser/${userId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                console.error('Non-JSON response:', text);
                throw new Error('Server returned non-JSON response');
            }

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to unblock user');

            await Swal.fire({
                icon: 'success',
                title: 'User Unblocked',
                text: data.message || 'User has been unblocked successfully',
                timer: 1500,
                showConfirmButton: false
            });
            
            location.reload();
        }
    } catch (error) {
        console.error('Error unblocking user:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message || 'An error occurred while unblocking the user'
        });
    } finally {
        button.setAttribute('aria-busy', 'false');
        button.disabled = false;
    }
}