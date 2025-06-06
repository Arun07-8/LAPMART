toggleClearButton();
document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('userSearchInput');
    const searchBtn = document.getElementById('searchBtn');
    const clearButton = document.querySelector('.btn-clear');
    const searchLoadingIcon = document.getElementById('searchLoadingIcon');
    const tableContainer = document.querySelector('.table-container');
    const tbody = document.querySelector('.table tbody');

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
        const d = new Date(date);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}-${month}-${year}`;
    }

    // Perform live search
    const performLiveSearch = debounce(function() {
        const searchTerm = searchInput.value.trim();
        tableContainer.classList.add('loading');
        searchLoadingIcon.style.display = 'block';

        const url = new URL('/admin/users', window.location.origin);
        if (searchTerm) {
            url.searchParams.set('search', encodeURIComponent(searchTerm));
        }
        url.searchParams.set('page', '1');

        fetch(url, {
            headers: {
                'Accept': 'application/json'
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            // Update URL without reloading
            window.history.pushState({}, '', url.toString());

            // Clear existing table rows
            tbody.innerHTML = '';

            if (data.users.length === 0) {
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
            } else {
                data.users.forEach((user, index) => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${index + 1}</td>
                        <td>
                            <div class="user-image">
                                <img src="${user.image || '/img/register/download.png'}" 
                                     alt="${user.name}" 
                                     class="user-thumbnail" 
                                     loading="lazy">
                            </div>
                        </td>
                        <td>${user.name}</td>
                        <td>${user.email}</td>
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

            // Update pagination
            updatePagination(data.currentPage, data.totalPages, searchTerm);
        })
        .catch(error => {
            console.error('Error in live search:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Failed to fetch users. Please try again.',
                confirmButtonColor: 'var(--primary-color)'
            });
        })
        .finally(() => {
            tableContainer.classList.remove('loading');
            searchLoadingIcon.style.display = 'none';
        });
    }, 300);

    // Update pagination links
    function updatePagination(currentPage, totalPages, searchTerm) {
        const pagination = document.querySelector('.pagination');
        if (!pagination) return;

        pagination.innerHTML = '';

        // Previous button
        if (currentPage > 1) {
            pagination.innerHTML += `
                <li class="page-item">
                    <a class="page-link" href="?page=${currentPage - 1}&search=${encodeURIComponent(searchTerm || '')}" aria-label="Previous">
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

        // Page numbers
        let startPage = Math.max(1, currentPage - 2);
        let endPage = Math.min(totalPages, startPage + 4);
        if (endPage - startPage < 4 && totalPages > 5) {
            startPage = Math.max(1, endPage - 4);
        }

        for (let i = startPage; i <= endPage; i++) {
            pagination.innerHTML += `
                <li class="page-item ${i === currentPage ? 'active' : ''}">
                    <a class="page-link" href="?page=${i}&search=${encodeURIComponent(searchTerm || '')}">${i}</a>
                </li>
            `;
        }

        // Next button
        if (currentPage < totalPages) {
            pagination.innerHTML += `
                <li class="page-item">
                    <a class="page-link" href="?page=${currentPage + 1}&search=${encodeURIComponent(searchTerm || '')}" aria-label="Next">
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
        document.querySelectorAll('.page-link').forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                const href = this.getAttribute('href');
                const url = new URL(window.location.origin + href);
                performLiveSearchWithPage(url.searchParams.get('page'), url.searchParams.get('search'));
            });
        });
    }

    // Perform search with specific page
    function performLiveSearchWithPage(page, searchTerm) {
        tableContainer.classList.add('loading');
        searchLoadingIcon.style.display = 'block';

        const url = new URL('/admin/users', window.location.origin);
        if (searchTerm) {
            url.searchParams.set('search', encodeURIComponent(searchTerm));
        }
        url.searchParams.set('page', page || '1');

        fetch(url, {
            headers: {
                'Accept': 'application/json'
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            window.history.pushState({}, '', url.toString());
            tbody.innerHTML = '';

            if (data.users.length === 0) {
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
            } else {
                data.users.forEach((user, index) => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${index + 1}</td>
                        <td>
                            <div class="user-image">
                                <img src="${user.image || '/img/register/download.png'}" 
                                     alt="${user.name}" 
                                     class="user-thumbnail" 
                                     loading="lazy">
                            </div>
                        </td>
                        <td>${user.name}</td>
                        <td>${user.email}</td>
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

            updatePagination(data.currentPage, data.totalPages, searchTerm);
        })
        .catch(error => {
            console.error('Error in live search:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Failed to fetch users. Please try again.',
                confirmButtonColor: 'var(--primary-color)'
            });
        })
        .finally(() => {
            tableContainer.classList.remove('loading');
            searchLoadingIcon.style.display = 'none';
        });
    }

    // Event listeners
    searchInput.addEventListener('input', function() {
        toggleClearButton();
        performLiveSearch();
    });

    searchBtn.addEventListener('click', function(e) {
        e.preventDefault();
        performLiveSearch();
    });

    clearButton.addEventListener('click', function(e) {
        e.preventDefault(); // Prevent <a> tag navigation
        searchInput.value = '';
        toggleClearButton();
        performLiveSearch();
    });

    function toggleClearButton() {
        clearButton.style.display = searchInput.value.trim() ? 'block' : 'none';
    }

    function adjustTableContainer() {
        if (window.innerWidth <= 1200) {
            tableContainer.style.overflowX = 'auto';
        } else {
            tableContainer.style.overflowX = 'visible';
        }
    }

    adjustTableContainer();
    window.addEventListener('resize', adjustTableContainer);

    // Restore search term on page load
    const urlParams = new URLSearchParams(window.location.search);
    const searchTerm = urlParams.get('search');
    if (searchTerm) {
        searchInput.value = decodeURIComponent(searchTerm);
        performLiveSearch();
    }
});
async function handleBlockUserClick(userId) {
    const button = document.querySelector(`button[onclick="handleBlockUserClick('${userId}')"]`);
    button.setAttribute('aria-busy', 'true');
    button.disabled = true;

    const result = await Swal.fire({
        title: 'Are you sure?',
        text: 'This will block the user, logging them out and restricting their access.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Yes, block user!',
        cancelButtonText: 'Cancel'
    });

    if (result.isConfirmed) {
        try {
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

            Swal.fire({
                icon: 'success',
                title: 'User Blocked',
                text: data.message || 'User has been blocked successfully',
                timer: 1500,
                showConfirmButton: false
            }).then(() => location.reload());
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
    } else {
        button.setAttribute('aria-busy', 'false');
        button.disabled = false;
    }
}

async function handleUnblockUserClick(userId) {
    const button = document.querySelector(`button[onclick="handleUnblockUserClick('${userId}')"]`);
    button.setAttribute('aria-busy', 'true');
    button.disabled = true;

    const result = await Swal.fire({
        title: 'Are you sure?',
        text: 'This will unblock the user, restoring their access.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Yes, unblock user!',
        cancelButtonText: 'Cancel'
    });

    if (result.isConfirmed) {
        try {
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

            Swal.fire({
                icon: 'success',
                title: 'User Unblocked',
                text: data.message || 'User has been unblocked successfully',
                timer: 1500,
                showConfirmButton: false
            }).then(() => location.reload());
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
    } else {
        button.setAttribute('aria-busy', 'false');
        button.disabled = false;
    }
}