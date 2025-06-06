async function handleSoftDeleteClick(productId) {
    const result = await Swal.fire({
        title: 'Are you sure?',
        text: 'This will mark the product as deleted. You can restore it later.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Yes, delete it!',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#D74742',
        cancelButtonColor: '#6B7280',
        customClass: {
            confirmButton: 'btn btn-danger',
            cancelButton: 'btn btn-secondary'
        },
        buttonsStyling: true
    });

    if (result.isConfirmed) {
        try {
            const response = await fetch(`/admin/deleteProducts/${productId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to soft delete product');
            }

            Swal.fire({
                icon: 'success',
                title: 'Deleted',
                text: data.message || 'Product has been soft deleted',
                confirmButtonColor: '#219653'
            }).then(() => {
                window.location.href = '/admin/products';
            });
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Oops',
                text: error.message || 'An error occurred while deleting the product',
                confirmButtonColor: '#D74742'
            });
        }
    }
}
document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    const clearButton = document.querySelector('.btn-clear');
    const searchLoadingIcon = document.getElementById('searchLoadingIcon');
    const tableContainer = document.querySelector('.table-container');
    const tbody = document.querySelector('.table tbody');
    const paginationContainer = document.querySelector('.pagination-container');

    // Debounce function to limit API calls
    function debounce(func, delay) {
        let timeoutId;
        return function (...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    }

    // Perform live search
    const performLiveSearch = debounce(function() {
        const searchTerm = searchInput.value.trim();
        tableContainer.classList.add('loading');
        if (searchLoadingIcon) searchLoadingIcon.style.display = 'block';

        const url = new URL('/admin/products', window.location.origin);
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

            if (data.products && data.products.length > 0) {
                data.products.forEach(product => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td class="col-image">
                            <div class="product-image">
                                ${product.productImage && product.productImage.length > 0
                                    ? `<img src="${product.productImage[0]}" alt="${product.productName}" class="product-thumbnail">`
                                    : `<img src="/images/no-image.png" alt="No Image" class="product-thumbnail">`}
                            </div>
                        </td>
                        <td class="col-name">
                            <div class="product-name">
                                <span>${product.productName}</span>
                            </div>
                        </td>
                        <td class="col-category">${product.category?.name || 'N/A'}</td>
                        <td class="col-brand">${product.brand?.name || 'N/A'}</td>
                        <td class="col-stock">${product.quantity}</td>
                        <td class="col-price">₹${product.salePrice}</td>
                        <td class="col-status">
                            ${product.quantity === 0
                                ? `<h5 style="color: rgb(255, 0, 0);">Out of Stock</h5>`
                                : product.isListed
                                    ? 'Available'
                                    : `<h5 style="color: rgb(255, 0, 0);">Not Available</h5>`}
                        </td>
                        <td class="col-status">
                            ${product.isListed
                                ? `<button class="btn-status btn-listed" onclick="handleUnlistProduct('${product._id}')" aria-label="Unlist product">Listed</button>`
                                : `<button class="btn-status btn-listed2" onclick="handleListProduct('${product._id}')" aria-label="List product">Unlisted</button>`}
                        </td>
                        <td class="col-actions actions-cell">
                            <div class="action-buttons">
                                <a href="/admin/editProduct/${product._id}" class="edit-link" title="Edit" style="text-decoration: none;">
                                    <i class="bi bi-pencil edit-icon"></i>
                                </a>
                                <button onclick="handleSoftDeleteClick('${product._id}')" class="delete-btn">
                                    <i class="bi bi-trash delete-icon" title="Delete"></i>
                                </button>
                            </div>
                        </td>
                    `;
                    tbody.appendChild(row);
                });
            } else {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="9" style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                            <i class="fas fa-search" style="font-size: 2rem; margin-bottom: 1rem;"></i>
                            <p>No products found matching your search criteria.</p>
                        </td>
                    </tr>
                `;
            }

            // Update pagination
            updatePagination(data.currentPage, data.totalPages, searchTerm);
        })
        .catch(error => {
            console.error('Error in live search:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Failed to fetch products. Please try again.',
                confirmButtonColor: 'var(--primary-color)'
            });
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" style="text-align: center; padding: 2rem; color: var(--danger-color);">
                    Error loading search results
                    </td>
                </tr>
            `;
        })
        .finally(() => {
            tableContainer.classList.remove('loading');
            if (searchLoadingIcon) searchLoadingIcon.style.display = 'none';
        });
    }, 300);

    // Update pagination links
    function updatePagination(currentPage, totalPages, searchTerm) {
        const pagination = document.querySelector('.pagination');
        if (!pagination || !paginationContainer) return;

        pagination.innerHTML = '';
        paginationContainer.style.display = totalPages > 1 ? 'block' : 'none';

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
        if (searchLoadingIcon) searchLoadingIcon.style.display = 'block';

        const url = new URL('/admin/search', window.location.origin);
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

            if (data.products && data.products.length > 0) {
                data.products.forEach(product => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td class="col-image">
                            <div class="product-image">
                                ${product.productImage && product.productImage.length > 0
                                    ? `<img src="${product.productImage[0]}" alt="${product.productName}" class="product-thumbnail">`
                                    : `<img src="/images/no-image.png" alt="No Image" class="product-thumbnail">`}
                            </div>
                        </td>
                        <td class="col-name">
                            <div class="product-name">
                                <span>${product.productName}</span>
                            </div>
                        </td>
                        <td class="col-category">${product.category?.name || 'N/A'}</td>
                        <td class="col-brand">${product.brand?.name || 'N/A'}</td>
                        <td class="col-stock">${product.quantity}</td>
                        <td class="col-price">₹${product.salePrice}</td>
                        <td class="col-status">
                            ${product.quantity === 0
                                ? `<h5 style="color: rgb(255, 0, 0);">Out of Stock</h5>`
                                : product.isListed
                                    ? 'Available'
                                    : `<h5 style="color: rgb(255, 0, 0);">Not Available</h5>`}
                        </td>
                        <td class="col-status">
                            ${product.isListed
                                ? `<button class="btn-status btn-listed" onclick="handleUnlistProduct('${product._id}')" aria-label="Unlist product">Listed</button>`
                                : `<button class="btn-status btn-listed2" onclick="handleListProduct('${product._id}')" aria-label="List product">Unlisted</button>`}
                        </td>
                        <td class="col-actions actions-cell">
                            <div class="action-buttons">
                                <a href="/admin/editProduct/${product._id}" class="edit-link" title="Edit" style="text-decoration: none;">
                                    <i class="bi bi-pencil edit-icon"></i>
                                </a>
                                <button onclick="handleSoftDeleteClick('${product._id}')" class="delete-btn">
                                    <i class="bi bi-trash delete-icon" title="Delete"></i>
                                </button>
                            </div>
                        </td>
                    `;
                    tbody.appendChild(row);
                });
            } else {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="9" style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                            <i class="fas fa-search" style="font-size: 2rem; margin-bottom: 1rem;"></i>
                            <p>No products found matching your search criteria.</p>
                        </td>
                    </tr>
                `;
            }

            updatePagination(data.currentPage, data.totalPages, searchTerm);
        })
        .catch(error => {
            console.error('Error in live search:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Failed to fetch products. Please try again.',
                confirmButtonColor: 'var(--primary-color)'
            });
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" style="text-align: center; padding: 2rem; color: var(--danger-color);">
                    Error loading search results
                    </td>
                </tr>
            `;
        })
        .finally(() => {
            tableContainer.classList.remove('loading');
            if (searchLoadingIcon) searchLoadingIcon.style.display = 'none';
        });
    }

    // Event listeners
    searchInput.addEventListener('input', function() {
        toggleClearButton();
        performLiveSearch();
    });

    if (searchBtn) {
        searchBtn.addEventListener('click', function(e) {
            e.preventDefault();
            performLiveSearch();
        });
    }

    if (clearButton) {
        clearButton.addEventListener('click', function(e) {
            e.preventDefault(); // Prevent <a> tag navigation
            searchInput.value = '';
            toggleClearButton();
            performLiveSearch();
        });
    }

    function toggleClearButton() {
        if (clearButton) {
            clearButton.style.display = searchInput.value.trim() ? 'block' : 'none';
        }
    }

    // Sidebar active state
    const sidebarItems = document.querySelectorAll('.sidebar-item');
    sidebarItems.forEach(item => {
        if (item.getAttribute('href') === '/admin/products') {
            item.classList.add('active');
        }
    });

    // Restore search term on page load
    const urlParams = new URLSearchParams(window.location.search);
    const searchTerm = urlParams.get('search');
    if (searchTerm) {
        searchInput.value = decodeURIComponent(searchTerm);
        toggleClearButton();
        performLiveSearch();
    }
});

document.addEventListener('DOMContentLoaded', function() {
    const sidebarItems = document.querySelectorAll('.sidebar-item');
    sidebarItems.forEach(item => {
        if (item.getAttribute('href') === '/admin/products') {
            item.classList.add('active');
        }
    });
});
 
async function handleListProduct(productId) {
    console.log(productId,"is product id");
    
    const result = await Swal.fire({
        title: 'Are you sure?',
        text: 'This will list the product, making it visible.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Yes, list it!',
        cancelButtonText: 'Cancel'
    });
    if (result.isConfirmed) {
        try {
            const response = await fetch(`/admin/listedProduct/${productId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to list product');
            Swal.fire({
                icon: 'success',
                title: 'Product Listed',
                text: data.message || 'Product has been listed successfully',
                timer: 1500,
                showConfirmButton: false
            }).then(() => window.location="/admin/products");
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: error.message || 'An error occurred while listing the Product'
            });
        }
    }
}

async function handleUnlistProduct(productId) {
    const result = await Swal.fire({
        title: 'Are you sure?',
        text: 'This will unlist the Product, making it hidden.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Yes, unlist it!',
        cancelButtonText: 'Cancel'
    });
    if (result.isConfirmed) {
        try {
            const response = await fetch(`/admin/unlistedProduct/${productId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' }
            });
            
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to unlist product');
            Swal.fire({
                icon: 'success',
                title: 'Product Unlisted',
                text: data.message || 'Product has been unlisted successfully',
                timer: 1500,
                showConfirmButton: false
            }).then(() => window.location="/admin/products");
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: error.message || 'An error occurred while unlisting the  Product'
            });
        }
    }
}
